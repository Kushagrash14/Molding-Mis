import React, { useState, useMemo, useLayoutEffect } from "react";
import * as XLSX from "xlsx";
import { computeMetrics, findProduct } from "../lib/calculations.js";
import { familyInPlant } from "../data/familyMolds.js";

function runsOf(entry) {
  if (Array.isArray(entry.runs) && entry.runs.length > 1) {
    return entry.runs.map((r) => ({ ...r, plant_id: r.plant_id || entry.plant_id }));
  }
  return [
    {
      ...entry,
      sap_code: entry.primary_sap_code || entry.runs?.[0]?.sap_code || entry.sap_code,
    },
  ];
}

function fmtNum(n, d = 0) {
  if (n === null || n === undefined || isNaN(n)) return "0";
  return Number(n).toLocaleString("en-IN", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
}

function fmtInt(n) {
  if (n === null || n === undefined || isNaN(n)) return "0";
  return Math.round(Number(n)).toLocaleString("en-IN");
}

function getTodayStr() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getOffsetDateStr(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function fmtMonthLabel(ym) {
  if (!ym || ym.length < 7) return ym;
  const [y, m] = ym.split("-");
  const idx = Number(m) - 1;
  return `${MONTH_NAMES[idx] || m} ${y}`;
}

export default function MaterialConsumptionView({
  entries = [],
  master = [],
  plants = [],
  machines = [],
  shifts = [],
  reasonCodes = [],
  selectedPlantId = "all",
  onSelectPlant,
  currentUser,
  embedded = false,
  filtersOpen,
  onFiltersOpenChange,
  viewMode: controlledViewMode,
  onViewModeChange,
  onChromeChange,
  exportRef,
}) {
  // Filters
  const [dateFilterType, setDateFilterType] = useState("month"); // 'today', 'yesterday', 'last7', 'month', 'lastMonth', 'selectMonth', 'custom', 'allTime'
  const [selectedYm, setSelectedYm] = useState(() => getTodayStr().slice(0, 7));
  const [customStartDate, setCustomStartDate] = useState(() => getOffsetDateStr(-30));
  const [customEndDate, setCustomEndDate] = useState(() => getTodayStr());
  const [plantFilter, setPlantFilter] = useState(selectedPlantId || "all");
  const [shiftFilter, setShiftFilter] = useState("all");
  const [machineFilter, setMachineFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [internalViewMode, setInternalViewMode] = useState("machine"); // 'machine', 'summary' (part), 'detailed' (shift run)
  const viewMode = controlledViewMode ?? internalViewMode;
  const setViewMode = (next) => {
    const value = typeof next === "function" ? next(viewMode) : next;
    if (typeof onViewModeChange === "function") onViewModeChange(value);
    else setInternalViewMode(value);
  };
  const [expandedMachineId, setExpandedMachineId] = useState(null);
  const [selectedExampleSap, setSelectedExampleSap] = useState(null);
  const [internalShowFilters, setInternalShowFilters] = useState(false);

  const showFilters = typeof filtersOpen === "boolean" ? filtersOpen : internalShowFilters;
  const setShowFilters = (next) => {
    const value = typeof next === "function" ? next(showFilters) : next;
    if (typeof onFiltersOpenChange === "function") onFiltersOpenChange(value);
    else setInternalShowFilters(value);
  };

  // Keep plant in sync with dashboard / top plant picker
  React.useEffect(() => {
    if (selectedPlantId != null && selectedPlantId !== plantFilter) {
      setPlantFilter(selectedPlantId || "all");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlantId]);

  const activePlantId = plantFilter;

  // Extract all available months present in data + past 12 months for quick jumping back in time
  const availableMonths = useMemo(() => {
    const set = new Set();
    entries.forEach((e) => {
      if (e.shift_date && e.shift_date.length >= 7) {
        set.add(e.shift_date.slice(0, 7));
      }
    });
    // Add past 12 months from today
    const now = new Date();
    for (let i = 0; i < 18; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      set.add(ym);
    }
    return Array.from(set).sort().reverse();
  }, [entries]);

  // Determine active date range based on filter type
  const { startDate, endDate, dateRangeLabel } = useMemo(() => {
    const today = getTodayStr();
    if (dateFilterType === "today") {
      return { startDate: today, endDate: today, dateRangeLabel: `Today (${today})` };
    }
    if (dateFilterType === "yesterday") {
      const yest = getOffsetDateStr(-1);
      return { startDate: yest, endDate: yest, dateRangeLabel: `Yesterday (${yest})` };
    }
    if (dateFilterType === "last7") {
      const start = getOffsetDateStr(-6);
      return { startDate: start, endDate: today, dateRangeLabel: `Last 7 Days (${start} to ${today})` };
    }
    if (dateFilterType === "month") {
      const y = today.slice(0, 4);
      const m = today.slice(5, 7);
      return { startDate: `${y}-${m}-01`, endDate: today, dateRangeLabel: `This Month (${fmtMonthLabel(`${y}-${m}`)})` };
    }
    if (dateFilterType === "lastMonth") {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const lastDay = new Date(y, d.getMonth() + 1, 0).getDate();
      const s = `${y}-${m}-01`;
      const e = `${y}-${m}-${String(lastDay).padStart(2, "0")}`;
      return { startDate: s, endDate: e, dateRangeLabel: `Last Month (${fmtMonthLabel(`${y}-${m}`)})` };
    }
    if (dateFilterType === "selectMonth") {
      const [y, m] = selectedYm.split("-");
      const lastDay = new Date(Number(y), Number(m), 0).getDate();
      const s = `${selectedYm}-01`;
      const e = `${selectedYm}-${String(lastDay).padStart(2, "0")}`;
      return { startDate: s, endDate: e, dateRangeLabel: fmtMonthLabel(selectedYm) };
    }
    if (dateFilterType === "allTime") {
      return { startDate: "1970-01-01", endDate: "2099-12-31", dateRangeLabel: "All Time (Complete History)" };
    }
    return {
      startDate: customStartDate,
      endDate: customEndDate,
      dateRangeLabel: `${customStartDate} to ${customEndDate}`,
    };
  }, [dateFilterType, selectedYm, customStartDate, customEndDate]);

  // Extract flattened run-level records with consumption metrics
  const processedData = useMemo(() => {
    const records = [];

    entries.forEach((entry) => {
      if (!entry.shift_date) return;
      if (entry.shift_date < startDate || entry.shift_date > endDate) return;

      const entryPlant = String(entry.plant_id || "1040");
      if (activePlantId !== "all" && entryPlant !== activePlantId) return;

      if (shiftFilter !== "all" && String(entry.shift_id) !== String(shiftFilter)) return;
      if (machineFilter !== "all" && String(entry.machine_id) !== String(machineFilter)) return;

      const runs = runsOf(entry);
      runs.forEach((run, runIdx) => {
        const sap = String(run.sap_code || "").trim();
        if (!sap || sap === "DOWN_12H") return;

        const runPlant = String(run.plant_id || entryPlant);
        const m = computeMetrics(run, master, reasonCodes);

        const ok = Number(m.ok_prod) || 0;
        const rej = Number(m.total_rej) || 0;
        const produced = ok + rej;
        const runHour = Number(m.net_run_time) || Number(run.run_hour) || 0;
        if (produced <= 0 && runHour <= 0) return;

        const product = findProduct(master, sap, runPlant);
        const family = familyInPlant(master, sap, runPlant);

        const partWt = Number(product?.part_wt || run.part_wt || 0);
        const runWt = Number(product?.run_wt || run.run_wt || 0);

        const ownCavity = Number(product?.cavity) || Number(run.running_cavity) || Number(run.std_cavity) || 1;
        const cavityFactor = family ? family.pieceFactor : ownCavity > 0 ? ownCavity : 1;
        const moldCombo = family?.combo || product?.mold_combo || String(ownCavity);

        // Net weight per piece: Part Wt + (Runner Wt / Active Cavities)
        const netWt = partWt + (cavityFactor > 0 ? runWt / cavityFactor : 0);

        // Component breakdown
        const fgWeight = Number(m.ok_prod_wt) || (partWt * ok);
        const rejWeight = Number(m.rej_wt) || (partWt * rej);
        const totalConsumption = Number(m.total_consumption) || (netWt * produced);
        const runnerScrap = Math.max(0, totalConsumption - fgWeight - rejWeight);

        // Shots
        const shots = cavityFactor > 0 ? produced / cavityFactor : produced;

        const mcObj = machines.find((mc) => mc.machine_id === entry.machine_id);
        const plantObj = plants.find((p) => String(p.plant_id) === runPlant);
        const shiftObj = shifts.find((s) => String(s.shift_id) === String(entry.shift_id));

        records.push({
          id: `${entry.entry_id || entry.id || "e"}_${entry.shift_date}_${entry.machine_id}_r${runIdx}`,
          date: entry.shift_date,
          shiftId: entry.shift_id,
          shiftName: shiftObj?.name || `Shift ${entry.shift_id}`,
          plantId: runPlant,
          plantName: plantObj?.name || runPlant,
          machineId: entry.machine_id,
          machineNo: mcObj?.machine_no || entry.machine_id,
          runHour,
          sapCode: sap,
          partNo: product?.part_no || run.part_no || "—",
          description: product?.material_description || run.material_description || "—",
          moldCombo,
          cavityFactor,
          shots,
          ok,
          rej,
          produced,
          partWt,
          runWt,
          netWt,
          fgWeight,
          rejWeight,
          runnerScrap,
          totalConsumption,
        });
      });
    });

    return records;
  }, [entries, master, plants, machines, shifts, reasonCodes, startDate, endDate, activePlantId, shiftFilter, machineFilter]);

  // Filter by search term
  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return processedData;
    const q = searchTerm.toLowerCase().trim();
    return processedData.filter(
      (r) =>
        r.sapCode.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.partNo.toLowerCase().includes(q) ||
        r.machineNo.toLowerCase().includes(q) ||
        r.plantName.toLowerCase().includes(q)
    );
  }, [processedData, searchTerm]);

  // Aggregate by Machine for the Machine-Wise View
  const machineSummary = useMemo(() => {
    const map = new Map();
    filteredRecords.forEach((r) => {
      const key = `${r.plantId}_${r.machineId}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          plantId: r.plantId,
          plantName: r.plantName,
          machineId: r.machineId,
          machineNo: r.machineNo,
          runHours: 0,
          runsCount: 0,
          partsMap: new Map(),
          shots: 0,
          ok: 0,
          rej: 0,
          produced: 0,
          fgWeight: 0,
          rejWeight: 0,
          runnerScrap: 0,
          totalConsumption: 0,
        });
      }
      const agg = map.get(key);
      agg.runsCount += 1;
      agg.runHours += r.runHour;
      agg.shots += r.shots;
      agg.ok += r.ok;
      agg.rej += r.rej;
      agg.produced += r.produced;
      agg.fgWeight += r.fgWeight;
      agg.rejWeight += r.rejWeight;
      agg.runnerScrap += r.runnerScrap;
      agg.totalConsumption += r.totalConsumption;

      if (!agg.partsMap.has(r.sapCode)) {
        agg.partsMap.set(r.sapCode, {
          sapCode: r.sapCode,
          partNo: r.partNo,
          description: r.description,
          moldCombo: r.moldCombo,
          partWt: r.partWt,
          runWt: r.runWt,
          netWt: r.netWt,
          ok: 0,
          rej: 0,
          produced: 0,
          fgWeight: 0,
          runnerScrap: 0,
          rejWeight: 0,
          totalConsumption: 0,
        });
      }
      const pAgg = agg.partsMap.get(r.sapCode);
      pAgg.ok += r.ok;
      pAgg.rej += r.rej;
      pAgg.produced += r.produced;
      pAgg.fgWeight += r.fgWeight;
      pAgg.runnerScrap += r.runnerScrap;
      pAgg.rejWeight += r.rejWeight;
      pAgg.totalConsumption += r.totalConsumption;
    });

    return Array.from(map.values())
      .map((m) => ({
        ...m,
        partsList: Array.from(m.partsMap.values()).sort((a, b) => b.totalConsumption - a.totalConsumption),
      }))
      .sort((a, b) => b.totalConsumption - a.totalConsumption);
  }, [filteredRecords]);

  // Aggregate by Part (SAP Code) for the Summary View
  const partSummary = useMemo(() => {
    const map = new Map();
    filteredRecords.forEach((r) => {
      const key = `${r.plantId}_${r.sapCode}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          plantId: r.plantId,
          plantName: r.plantName,
          sapCode: r.sapCode,
          partNo: r.partNo,
          description: r.description,
          moldCombo: r.moldCombo,
          cavityFactor: r.cavityFactor,
          partWt: r.partWt,
          runWt: r.runWt,
          netWt: r.netWt,
          runsCount: 0,
          shots: 0,
          ok: 0,
          rej: 0,
          produced: 0,
          fgWeight: 0,
          rejWeight: 0,
          runnerScrap: 0,
          totalConsumption: 0,
        });
      }
      const agg = map.get(key);
      agg.runsCount += 1;
      agg.shots += r.shots;
      agg.ok += r.ok;
      agg.rej += r.rej;
      agg.produced += r.produced;
      agg.fgWeight += r.fgWeight;
      agg.rejWeight += r.rejWeight;
      agg.runnerScrap += r.runnerScrap;
      agg.totalConsumption += r.totalConsumption;
    });

    return Array.from(map.values()).sort((a, b) => b.totalConsumption - a.totalConsumption);
  }, [filteredRecords]);

  // Overall KPIs
  const totals = useMemo(() => {
    let ok = 0;
    let rej = 0;
    let produced = 0;
    let shots = 0;
    let fgWeight = 0;
    let rejWeight = 0;
    let runnerScrap = 0;
    let totalConsumption = 0;

    filteredRecords.forEach((r) => {
      ok += r.ok;
      rej += r.rej;
      produced += r.produced;
      shots += r.shots;
      fgWeight += r.fgWeight;
      rejWeight += r.rejWeight;
      runnerScrap += r.runnerScrap;
      totalConsumption += r.totalConsumption;
    });

    const fgPct = totalConsumption > 0 ? (fgWeight / totalConsumption) * 100 : 0;
    const runnerPct = totalConsumption > 0 ? (runnerScrap / totalConsumption) * 100 : 0;
    const rejPct = totalConsumption > 0 ? (rejWeight / totalConsumption) * 100 : 0;
    const scrapPct = totalConsumption > 0 ? ((runnerScrap + rejWeight) / totalConsumption) * 100 : 0;

    return {
      ok,
      rej,
      produced,
      shots,
      fgWeight,
      rejWeight,
      runnerScrap,
      totalConsumption,
      totalTonnes: totalConsumption / 1000,
      fgPct,
      runnerPct,
      rejPct,
      scrapPct,
    };
  }, [filteredRecords]);

  // Pick part for the live interactive formula example at bottom
  const examplePart = useMemo(() => {
    if (selectedExampleSap) {
      const found = partSummary.find((p) => p.sapCode === selectedExampleSap);
      if (found) return found;
    }
    return partSummary[0] || null;
  }, [partSummary, selectedExampleSap]);

  React.useEffect(() => {
    if (typeof onChromeChange !== "function") return;
    onChromeChange({
      machineCount: machineSummary.length,
      partCount: partSummary.length,
      shiftCount: filteredRecords.length,
      dateRangeLabel,
    });
  }, [
    onChromeChange,
    machineSummary.length,
    partSummary.length,
    filteredRecords.length,
    dateRangeLabel,
  ]);

  // Export to Excel function
  const handleExportExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: Machine-Wise Summary
      const machineSheetData = [
        ["MACHINE-WISE RM CONSUMPTION REPORT", "", "", "", "", "", "", "", "", "", "", ""],
        [`Period: ${dateRangeLabel} | Plant: ${activePlantId === "all" ? "All Plants" : activePlantId}`, "", "", "", "", "", "", "", "", "", "", ""],
        [`Total RM Consumption: ${fmtInt(totals.totalConsumption)} kg (${(totals.totalConsumption / 1000).toFixed(1)} MT) | FG: ${Math.round(totals.fgPct)}% | Runner: ${Math.round(totals.runnerPct)}% | Rejection: ${Math.round(totals.rejPct)}%`, "", "", "", "", "", "", "", "", "", "", ""],
        [],
        [
          "Plant",
          "Machine No",
          "Molds Run Count",
          "Run Hours",
          "OK Qty (pcs)",
          "Rej Qty (pcs)",
          "Total Produced",
          "FG Net Wt (kg)",
          "Runner Scrap (kg)",
          "Rej Scrap (kg)",
          "Total RM Consumption (kg)",
          "Share %",
        ],
      ];

      machineSummary.forEach((m) => {
        const share = totals.totalConsumption > 0 ? (m.totalConsumption / totals.totalConsumption) * 100 : 0;
        machineSheetData.push([
          m.plantName,
          m.machineNo,
          m.partsList.length,
          Number(m.runHours.toFixed(1)),
          m.ok,
          m.rej,
          m.produced,
          Math.round(m.fgWeight),
          Math.round(m.runnerScrap),
          Math.round(m.rejWeight),
          Math.round(m.totalConsumption),
          Math.round(share),
        ]);
      });

      machineSheetData.push([
        "TOTAL",
        "",
        "",
        "",
        totals.ok,
        totals.rej,
        totals.produced,
        Math.round(totals.fgWeight),
        Math.round(totals.runnerScrap),
        Math.round(totals.rejWeight),
        Math.round(totals.totalConsumption),
        100,
      ]);

      const wsMachine = XLSX.utils.aoa_to_sheet(machineSheetData);
      XLSX.utils.book_append_sheet(wb, wsMachine, "Machine Summary");

      // Sheet 2: Part-Wise Summary
      const summarySheetData = [
        ["PART-WISE RM CONSUMPTION REPORT", "", "", "", "", "", "", "", "", "", "", "", "", ""],
        [`Period: ${dateRangeLabel} | Plant: ${activePlantId === "all" ? "All Plants" : activePlantId}`, "", "", "", "", "", "", "", "", "", "", "", "", ""],
        [],
        [
          "Plant",
          "SAP Code",
          "Part No",
          "Material Description",
          "Cavity",
          "Part Wt (kg)",
          "Run Wt (kg)",
          "Net Wt/Pc (kg)",
          "OK Qty (pcs)",
          "Rej Qty (pcs)",
          "Total Produced",
          "FG Net Wt (kg)",
          "Runner Scrap (kg)",
          "Rej Scrap (kg)",
          "Total RM Consumption (kg)",
          "Share %",
        ],
      ];

      partSummary.forEach((p) => {
        const share = totals.totalConsumption > 0 ? (p.totalConsumption / totals.totalConsumption) * 100 : 0;
        summarySheetData.push([
          p.plantName,
          p.sapCode,
          p.partNo,
          p.description,
          p.moldCombo,
          Number(p.partWt.toFixed(4)),
          Number(p.runWt.toFixed(4)),
          Number(p.netWt.toFixed(4)),
          p.ok,
          p.rej,
          p.produced,
          Math.round(p.fgWeight),
          Math.round(p.runnerScrap),
          Math.round(p.rejWeight),
          Math.round(p.totalConsumption),
          Math.round(share),
        ]);
      });

      const wsSummary = XLSX.utils.aoa_to_sheet(summarySheetData);
      XLSX.utils.book_append_sheet(wb, wsSummary, "Part Summary");

      // Sheet 3: Shift Detailed Log
      const detailedSheetData = [
        [
          "Date",
          "Shift",
          "Plant",
          "Machine",
          "SAP Code",
          "Part No",
          "Description",
          "Cavity",
          "OK Pcs",
          "Rej Pcs",
          "Total Produced",
          "Part Wt (kg)",
          "Run Wt (kg)",
          "Net Wt (kg)",
          "FG Wt (kg)",
          "Runner Wt (kg)",
          "Rej Wt (kg)",
          "Total RM Consumption (kg)",
        ],
      ];

      filteredRecords.forEach((r) => {
        detailedSheetData.push([
          r.date,
          r.shiftName,
          r.plantName,
          r.machineNo,
          r.sapCode,
          r.partNo,
          r.description,
          r.moldCombo,
          r.ok,
          r.rej,
          r.produced,
          Number(r.partWt.toFixed(4)),
          Number(r.runWt.toFixed(4)),
          Number(r.netWt.toFixed(4)),
          Math.round(r.fgWeight),
          Math.round(r.runnerScrap),
          Math.round(r.rejWeight),
          Math.round(r.totalConsumption),
        ]);
      });

      const wsDetailed = XLSX.utils.aoa_to_sheet(detailedSheetData);
      XLSX.utils.book_append_sheet(wb, wsDetailed, "Shift Detailed Log");

      const cleanDate = dateRangeLabel.replace(/[^a-zA-Z0-9_-]/g, "_");
      const fileName = `RM_Consumption_${cleanDate}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (err) {
      console.error("Excel export error:", err);
      alert("Failed to export Excel report: " + err.message);
    }
  };

  useLayoutEffect(() => {
    if (!exportRef) return undefined;
    exportRef.current = handleExportExcel;
    return () => {
      exportRef.current = null;
    };
  });

  const extraFilterCount =
    (dateFilterType !== "month" ? 1 : 0) +
    (shiftFilter !== "all" ? 1 : 0) +
    (machineFilter !== "all" ? 1 : 0) +
    (searchTerm.trim() ? 1 : 0);

  return (
    <div className={`rm-consumption-page${embedded ? " embedded" : ""}`} style={{ padding: embedded ? "0" : "0 0 12px", color: "#0f172a" }}>
      {!embedded && (
        <div className="rm-toolbar">
          <h1 className="rm-toolbar-title">RM Consumption</h1>
          <span className="rm-toolbar-badge">Admin</span>

          <select
            className="rm-toolbar-select"
            value={plantFilter}
            onChange={(e) => {
              setPlantFilter(e.target.value);
              if (onSelectPlant) onSelectPlant(e.target.value);
            }}
            title="Plant"
          >
            {plants.length > 1 && <option value="all">All Plants</option>}
            {plants.map((p) => (
              <option key={p.plant_id} value={p.plant_id}>
                {p.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            className={`rm-toolbar-btn${showFilters || extraFilterCount > 0 ? " active" : ""}`}
            onClick={() => setShowFilters((v) => !v)}
          >
            Filters{extraFilterCount > 0 ? ` (${extraFilterCount})` : ""}
          </button>

          <span className="rm-toolbar-range">{dateRangeLabel}</span>

          <button type="button" className="rm-toolbar-excel" onClick={handleExportExcel}>
            Excel
          </button>
        </div>
      )}

      <div className="rm-freeze-top">
      {showFilters && (
        <div className="rm-filter-panel">
          <div className="rm-filter-row">
            {[
              { id: "today", label: "Today" },
              { id: "yesterday", label: "Yesterday" },
              { id: "last7", label: "Last 7 Days" },
              { id: "month", label: "This Month" },
              { id: "lastMonth", label: "Last Month" },
              { id: "selectMonth", label: "Select Month" },
              { id: "custom", label: "Custom" },
              { id: "allTime", label: "All Time" },
            ].map((pill) => (
              <button
                key={pill.id}
                type="button"
                className={`rm-pill${dateFilterType === pill.id ? " active" : ""}`}
                onClick={() => setDateFilterType(pill.id)}
              >
                {pill.label}
              </button>
            ))}

            {dateFilterType === "selectMonth" && (
              <>
                <select
                  className="rm-toolbar-select"
                  value={selectedYm}
                  onChange={(e) => setSelectedYm(e.target.value)}
                >
                  {availableMonths.map((ym) => (
                    <option key={ym} value={ym}>
                      {fmtMonthLabel(ym)}
                    </option>
                  ))}
                </select>
                <input
                  type="month"
                  className="rm-toolbar-input"
                  value={selectedYm}
                  onChange={(e) => setSelectedYm(e.target.value)}
                />
              </>
            )}

            {dateFilterType === "custom" && (
              <>
                <input
                  type="date"
                  className="rm-toolbar-input"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                />
                <span style={{ fontSize: "11px", color: "#64748b" }}>to</span>
                <input
                  type="date"
                  className="rm-toolbar-input"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                />
              </>
            )}
          </div>

          <div className="rm-filter-row">
            <select
              className="rm-toolbar-select"
              value={shiftFilter}
              onChange={(e) => setShiftFilter(e.target.value)}
            >
              <option value="all">All Shifts</option>
              {shifts.map((s) => (
                <option key={s.shift_id} value={s.shift_id}>
                  {s.name}
                </option>
              ))}
            </select>

            <select
              className="rm-toolbar-select"
              value={machineFilter}
              onChange={(e) => setMachineFilter(e.target.value)}
            >
              <option value="all">All Machines</option>
              {machines
                .filter((mc) => activePlantId === "all" || String(mc.plant_id || "1040") === activePlantId)
                .map((mc) => (
                  <option key={mc.machine_id} value={mc.machine_id}>
                    {mc.machine_no}
                  </option>
                ))}
            </select>

            <input
              type="text"
              className="rm-toolbar-input rm-search"
              placeholder="Search SAP, part, machine…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* KPI strip — dense 5-column row */}
      <div className="rm-kpi-grid">
        {[
          {
            label: "Total RM Consumed",
            value: `${fmtInt(totals.totalConsumption)} kg`,
            sub: `≈ ${(totals.totalConsumption / 1000).toFixed(1)} MT`,
            color: "#1e3a8a",
            subColor: "#2563eb",
            border: "#2563eb",
          },
          {
            label: "Finished Goods (FG)",
            value: `${fmtInt(totals.fgWeight)} kg`,
            sub: `${Math.round(totals.fgPct)}% of consumed`,
            color: "#166534",
            subColor: "#16a34a",
            border: "#16a34a",
          },
          {
            label: "Runner Scrap",
            value: `${fmtInt(totals.runnerScrap)} kg`,
            sub: `${Math.round(totals.runnerPct)}% runner loss`,
            color: "#92400e",
            subColor: "#d97706",
            border: "#d97706",
          },
          {
            label: "Rejection Scrap",
            value: `${fmtInt(totals.rejWeight)} kg`,
            sub: `${Math.round(totals.rejPct)}% · ${fmtInt(totals.rej)} pcs`,
            color: "#991b1b",
            subColor: "#dc2626",
            border: "#dc2626",
          },
          {
            label: "Machines & Shots",
            value: `${machineSummary.length} Machines`,
            sub: `Shots ${fmtInt(totals.shots)} · Prod ${fmtInt(totals.produced)}`,
            color: "#3730a3",
            subColor: "#4f46e5",
            border: "#6366f1",
          },
        ].map((card) => (
          <div key={card.label} className="rm-kpi-card" style={{ borderLeftColor: card.border }}>
            <div className="rm-kpi-label">{card.label}</div>
            <div className="rm-kpi-value" style={{ color: card.color }}>{card.value}</div>
            <div className="rm-kpi-sub" style={{ color: card.subColor }}>{card.sub}</div>
          </div>
        ))}
      </div>

        {!embedded && (
          <div className="rm-view-tabs">
            {[
              { id: "machine", label: `Machine (${machineSummary.length})` },
              { id: "summary", label: `Part (${partSummary.length})` },
              { id: "detailed", label: `Shift Log (${filteredRecords.length})` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setViewMode(tab.id)}
                style={{
                  padding: "4px 10px",
                  fontSize: "11px",
                  fontWeight: "700",
                  borderRadius: "5px",
                  border: "1px solid",
                  borderColor: viewMode === tab.id ? "#2563eb" : "#cbd5e1",
                  background: viewMode === tab.id ? "#eff6ff" : "#ffffff",
                  color: viewMode === tab.id ? "#1e40af" : "#64748b",
                  cursor: "pointer",
                }}
              >
                {tab.label}
              </button>
            ))}
            <span style={{ marginLeft: "auto", fontSize: "11px", color: "#64748b", fontWeight: "600" }}>
              {dateRangeLabel}
            </span>
            <button type="button" className="rm-toolbar-excel" onClick={handleExportExcel}>
              Excel
            </button>
          </div>
        )}
      </div>

      <div className={`rm-table-card${embedded ? " rm-table-card--solo" : ""}`}>
      <div className="rm-table-scroll">
        {/* View 1: Machine-Wise Summary Table */}
        {viewMode === "machine" && (
            <table className="rm-data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th style={{ padding: "10px 12px", textAlign: "left" }}>MACHINE NO &amp; TONNAGE</th>
                  <th style={{ padding: "10px 12px", textAlign: "left" }}>PLANT</th>
                  <th style={{ padding: "10px 12px", textAlign: "center" }}>MOLDS RUN</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>RUN HRS</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>OK (PCS)</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>REJ (PCS)</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>PRODUCED</th>
                  <th style={{ padding: "10px 12px", textAlign: "right", color: "#166534" }}>FG WT (KG)</th>
                  <th style={{ padding: "10px 12px", textAlign: "right", color: "#92400e" }}>RUNNER (KG)</th>
                  <th style={{ padding: "10px 12px", textAlign: "right", color: "#991b1b" }}>REJ WT (KG)</th>
                  <th style={{ padding: "10px 12px", textAlign: "right", color: "#1e3a8a", fontWeight: "800" }}>TOTAL RM CONSUMED</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>PLANT SHARE %</th>
                  <th style={{ padding: "10px 12px", textAlign: "center" }}>DRILL DOWN</th>
                </tr>
              </thead>
              <tbody>
                {machineSummary.length === 0 ? (
                  <tr>
                    <td colSpan={14} style={{ padding: "30px", textAlign: "center", color: "#94a3b8" }}>
                      No machine records found for the selected filters.
                    </td>
                  </tr>
                ) : (
                  machineSummary.map((m, idx) => {
                    const share = totals.totalConsumption > 0 ? (m.totalConsumption / totals.totalConsumption) * 100 : 0;
                    const isExpanded = expandedMachineId === m.key;
                    return (
                      <React.Fragment key={m.key}>
                        <tr
                          style={{
                            borderBottom: "1px solid #f1f5f9",
                            background: isExpanded ? "#f8fafc" : idx % 2 === 0 ? "#ffffff" : "#fcfcfd",
                          }}
                        >
                          <td style={{ padding: "10px 12px", color: "#94a3b8" }}>{idx + 1}</td>
                          <td style={{ padding: "10px 12px", fontWeight: "800", color: "#0f172a" }}>
                            {m.machineNo}
                          </td>
                          <td style={{ padding: "10px 12px", color: "#64748b" }}>{m.plantName}</td>
                          <td style={{ padding: "10px 12px", textAlign: "center" }}>
                            <span style={{ padding: "2px 8px", background: "#eff6ff", color: "#1d4ed8", borderRadius: "12px", fontWeight: "700" }}>
                              {m.partsList.length} molds
                            </span>
                          </td>
                          <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "Consolas, monospace", fontWeight: "600" }}>
                            {fmtNum(m.runHours, 1)}h
                          </td>
                          <td style={{ padding: "10px 12px", textAlign: "right", color: "#16a34a", fontWeight: "700" }}>
                            {fmtInt(m.ok)}
                          </td>
                          <td style={{ padding: "10px 12px", textAlign: "right", color: m.rej > 0 ? "#dc2626" : "#94a3b8" }}>
                            {fmtInt(m.rej)}
                          </td>
                          <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: "700" }}>
                            {fmtInt(m.produced)}
                          </td>
                          <td style={{ padding: "10px 12px", textAlign: "right", color: "#166534", fontWeight: "600" }}>
                            {fmtInt(m.fgWeight)}
                          </td>
                          <td style={{ padding: "10px 12px", textAlign: "right", color: "#92400e", fontWeight: "600" }}>
                            {fmtInt(m.runnerScrap)}
                          </td>
                          <td style={{ padding: "10px 12px", textAlign: "right", color: "#991b1b", fontWeight: "600" }}>
                            {fmtInt(m.rejWeight)}
                          </td>
                          <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: "800", color: "#1e3a8a", fontSize: "13px" }}>
                            {fmtInt(m.totalConsumption)} kg
                            <div style={{ fontSize: "10px", color: "#64748b", fontWeight: "500" }}>
                              ≈ {(m.totalConsumption / 1000).toFixed(1)} MT
                            </div>
                          </td>
                          <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: "700", color: "#475569" }}>
                            {Math.round(share)}%
                          </td>
                          <td style={{ padding: "10px 12px", textAlign: "center" }}>
                            <button
                              onClick={() => setExpandedMachineId(isExpanded ? null : m.key)}
                              style={{
                                padding: "4px 8px",
                                fontSize: "11px",
                                fontWeight: "700",
                                border: "1px solid #cbd5e1",
                                borderRadius: "4px",
                                background: isExpanded ? "#2563eb" : "#ffffff",
                                color: isExpanded ? "#ffffff" : "#475569",
                                cursor: "pointer",
                              }}
                            >
                              {isExpanded ? "▲ Hide Parts" : "▼ View Parts"}
                            </button>
                          </td>
                        </tr>

                        {/* Expanded Drill-down: Parts Run on this Machine */}
                        {isExpanded && (
                          <tr style={{ background: "#f8fafc" }}>
                            <td colSpan={14} style={{ padding: "12px 18px 18px 40px", borderBottom: "2px solid #e2e8f0" }}>
                              <div style={{ fontSize: "12px", fontWeight: "700", color: "#1e3a8a", marginBottom: "8px" }}>
                                🔍 Parts Molds Run on {m.machineNo} ({m.partsList.length} distinct products):
                              </div>
                              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px", background: "#ffffff", borderRadius: "6px", overflow: "hidden", border: "1px solid #e2e8f0" }}>
                                <thead>
                                  <tr style={{ background: "#f1f5f9", color: "#475569" }}>
                                    <th style={{ padding: "6px 10px", textAlign: "left" }}>SAP Code</th>
                                    <th style={{ padding: "6px 10px", textAlign: "left" }}>Material Description</th>
                                    <th style={{ padding: "6px 10px", textAlign: "center" }}>Cavity</th>
                                    <th style={{ padding: "6px 10px", textAlign: "right" }}>Part Wt</th>
                                    <th style={{ padding: "6px 10px", textAlign: "right" }}>Run Wt</th>
                                    <th style={{ padding: "6px 10px", textAlign: "right" }}>OK Pcs</th>
                                    <th style={{ padding: "6px 10px", textAlign: "right" }}>Rej Pcs</th>
                                    <th style={{ padding: "6px 10px", textAlign: "right" }}>Produced</th>
                                    <th style={{ padding: "6px 10px", textAlign: "right", color: "#166534" }}>FG Wt (kg)</th>
                                    <th style={{ padding: "6px 10px", textAlign: "right", color: "#92400e" }}>Runner (kg)</th>
                                    <th style={{ padding: "6px 10px", textAlign: "right", color: "#991b1b" }}>Rej (kg)</th>
                                    <th style={{ padding: "6px 10px", textAlign: "right", color: "#1e3a8a", fontWeight: "800" }}>RM Consumed (kg)</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {m.partsList.map((pt) => (
                                    <tr key={pt.sapCode} style={{ borderBottom: "1px solid #f1f5f9" }}>
                                      <td style={{ padding: "6px 10px", fontFamily: "Consolas, monospace", fontWeight: "700", color: "#0284c7" }}>{pt.sapCode}</td>
                                      <td style={{ padding: "6px 10px", fontWeight: "600" }}>{pt.description}</td>
                                      <td style={{ padding: "6px 10px", textAlign: "center" }}>{pt.moldCombo}</td>
                                      <td style={{ padding: "6px 10px", textAlign: "right", fontFamily: "Consolas, monospace" }}>{fmtNum(pt.partWt, 4)}</td>
                                      <td style={{ padding: "6px 10px", textAlign: "right", fontFamily: "Consolas, monospace" }}>{fmtNum(pt.runWt, 4)}</td>
                                      <td style={{ padding: "6px 10px", textAlign: "right", color: "#16a34a", fontWeight: "700" }}>{fmtInt(pt.ok)}</td>
                                      <td style={{ padding: "6px 10px", textAlign: "right", color: pt.rej > 0 ? "#dc2626" : "#94a3b8" }}>{fmtInt(pt.rej)}</td>
                                      <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: "700" }}>{fmtInt(pt.produced)}</td>
                                      <td style={{ padding: "6px 10px", textAlign: "right", color: "#166534" }}>{fmtInt(pt.fgWeight)}</td>
                                      <td style={{ padding: "6px 10px", textAlign: "right", color: "#92400e" }}>{fmtInt(pt.runnerScrap)}</td>
                                      <td style={{ padding: "6px 10px", textAlign: "right", color: "#991b1b" }}>{fmtInt(pt.rejWeight)}</td>
                                      <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: "800", color: "#1e3a8a" }}>{fmtInt(pt.totalConsumption)} kg</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
              {machineSummary.length > 0 && (
                <tfoot>
                  <tr style={{ background: "#f8fafc", borderTop: "2px solid #cbd5e1", fontWeight: "800" }}>
                    <td colSpan={5} style={{ padding: "12px", textAlign: "right", color: "#0f172a" }}>
                      GRAND TOTAL:
                    </td>
                    <td style={{ padding: "12px", textAlign: "right", color: "#16a34a" }}>{fmtInt(totals.ok)}</td>
                    <td style={{ padding: "12px", textAlign: "right", color: "#dc2626" }}>{fmtInt(totals.rej)}</td>
                    <td style={{ padding: "12px", textAlign: "right" }}>{fmtInt(totals.produced)}</td>
                    <td style={{ padding: "12px", textAlign: "right", color: "#166534" }}>{fmtInt(totals.fgWeight)} kg</td>
                    <td style={{ padding: "12px", textAlign: "right", color: "#d97706" }}>{fmtInt(totals.runnerScrap)} kg</td>
                    <td style={{ padding: "12px", textAlign: "right", color: "#dc2626" }}>{fmtInt(totals.rejWeight)} kg</td>
                    <td style={{ padding: "12px", textAlign: "right", color: "#1e3a8a", fontSize: "14px" }}>
                      {fmtInt(totals.totalConsumption)} kg
                    </td>
                    <td style={{ padding: "12px", textAlign: "right" }}>100%</td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
        )}

        {/* View 2: Part-Wise Summary Table */}
        {viewMode === "summary" && (
            <table className="rm-data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>SAP CODE</th>
                  <th>MATERIAL DESCRIPTION</th>
                  <th style={{ textAlign: "center" }}>CAV</th>
                  <th style={{ textAlign: "right" }}>PART WT (KG)</th>
                  <th style={{ textAlign: "right" }}>RUN WT (KG)</th>
                  <th style={{ textAlign: "right" }}>NET WT/PC</th>
                  <th style={{ textAlign: "right" }}>OK (PCS)</th>
                  <th style={{ textAlign: "right" }}>REJ (PCS)</th>
                  <th style={{ textAlign: "right" }}>PRODUCED</th>
                  <th style={{ textAlign: "right", color: "#166534" }}>FG WT (KG)</th>
                  <th style={{ textAlign: "right", color: "#92400e" }}>RUNNER (KG)</th>
                  <th style={{ textAlign: "right", color: "#991b1b" }}>REJ WT (KG)</th>
                  <th style={{ textAlign: "right", color: "#1e3a8a" }}>TOTAL RM CONSUMED</th>
                  <th style={{ textAlign: "right" }}>SHARE %</th>
                </tr>
              </thead>
              <tbody>
                {partSummary.length === 0 ? (
                  <tr>
                    <td colSpan={15} style={{ padding: "30px", textAlign: "center", color: "#94a3b8" }}>
                      No production records found for the selected filters.
                    </td>
                  </tr>
                ) : (
                  partSummary.map((p, idx) => {
                    const share = totals.totalConsumption > 0 ? (p.totalConsumption / totals.totalConsumption) * 100 : 0;
                    return (
                      <tr
                        key={p.key}
                        onClick={() => setSelectedExampleSap(p.sapCode)}
                        style={{
                          borderBottom: "1px solid #f1f5f9",
                          cursor: "pointer",
                          background: selectedExampleSap === p.sapCode ? "#f0fdf4" : idx % 2 === 0 ? "#ffffff" : "#fcfcfd",
                        }}
                      >
                        <td style={{ padding: "9px 12px", color: "#94a3b8" }}>{idx + 1}</td>
                        <td style={{ padding: "9px 12px", fontFamily: "Consolas, monospace", fontWeight: "700", color: "#0284c7" }}>
                          {p.sapCode}
                        </td>
                        <td style={{ padding: "9px 12px", fontWeight: "600", maxWidth: "260px" }}>
                          <div>{p.description}</div>
                          {p.partNo && p.partNo !== "—" && (
                            <div style={{ fontSize: "10px", color: "#64748b" }}>Part: {p.partNo}</div>
                          )}
                        </td>
                        <td style={{ padding: "9px 12px", textAlign: "center", fontWeight: "700" }}>
                          <span style={{ padding: "2px 6px", background: "#f1f5f9", borderRadius: "4px" }}>
                            {p.moldCombo}
                          </span>
                        </td>
                        <td style={{ padding: "9px 12px", textAlign: "right", fontFamily: "Consolas, monospace" }}>
                          {fmtNum(p.partWt, 4)}
                        </td>
                        <td style={{ padding: "9px 12px", textAlign: "right", fontFamily: "Consolas, monospace" }}>
                          {fmtNum(p.runWt, 4)}
                        </td>
                        <td style={{ padding: "9px 12px", textAlign: "right", fontFamily: "Consolas, monospace", color: "#475569" }}>
                          {fmtNum(p.netWt, 4)}
                        </td>
                        <td style={{ padding: "9px 12px", textAlign: "right", color: "#16a34a", fontWeight: "700" }}>
                          {fmtInt(p.ok)}
                        </td>
                        <td style={{ padding: "9px 12px", textAlign: "right", color: p.rej > 0 ? "#dc2626" : "#94a3b8" }}>
                          {fmtInt(p.rej)}
                        </td>
                        <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: "700" }}>
                          {fmtInt(p.produced)}
                        </td>
                        <td style={{ padding: "9px 12px", textAlign: "right", color: "#166534", fontWeight: "600" }}>
                          {fmtInt(p.fgWeight)}
                        </td>
                        <td style={{ padding: "9px 12px", textAlign: "right", color: "#92400e", fontWeight: "600" }}>
                          {fmtInt(p.runnerScrap)}
                        </td>
                        <td style={{ padding: "9px 12px", textAlign: "right", color: "#991b1b", fontWeight: "600" }}>
                          {fmtInt(p.rejWeight)}
                        </td>
                        <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: "800", color: "#1e3a8a", fontSize: "13px" }}>
                          {fmtInt(p.totalConsumption)} kg
                        </td>
                        <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: "600", color: "#64748b" }}>
                          {Math.round(share)}%
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {partSummary.length > 0 && (
                <tfoot>
                  <tr style={{ background: "#f8fafc", borderTop: "2px solid #cbd5e1", fontWeight: "800" }}>
                    <td colSpan={7} style={{ padding: "12px", textAlign: "right", color: "#0f172a" }}>
                      GRAND TOTAL:
                    </td>
                    <td style={{ padding: "12px", textAlign: "right", color: "#16a34a" }}>{fmtInt(totals.ok)}</td>
                    <td style={{ padding: "12px", textAlign: "right", color: "#dc2626" }}>{fmtInt(totals.rej)}</td>
                    <td style={{ padding: "12px", textAlign: "right" }}>{fmtInt(totals.produced)}</td>
                    <td style={{ padding: "12px", textAlign: "right", color: "#166534" }}>{fmtInt(totals.fgWeight)} kg</td>
                    <td style={{ padding: "12px", textAlign: "right", color: "#d97706" }}>{fmtInt(totals.runnerScrap)} kg</td>
                    <td style={{ padding: "12px", textAlign: "right", color: "#dc2626" }}>{fmtInt(totals.rejWeight)} kg</td>
                    <td style={{ padding: "12px", textAlign: "right", color: "#1e3a8a", fontSize: "14px" }}>
                      {fmtInt(totals.totalConsumption)} kg
                    </td>
                    <td style={{ padding: "12px", textAlign: "right" }}>100%</td>
                  </tr>
                </tfoot>
              )}
            </table>
        )}

        {/* View 3: Shift-Wise Detailed Log Table */}
        {viewMode === "detailed" && (
            <table className="rm-data-table">
              <thead>
                <tr>
                  <th>DATE</th>
                  <th>SHIFT</th>
                  <th>PLANT</th>
                  <th>MACHINE</th>
                  <th>SAP CODE</th>
                  <th>PART DESCRIPTION</th>
                  <th style={{ textAlign: "center" }}>CAV</th>
                  <th style={{ textAlign: "right" }}>OK</th>
                  <th style={{ textAlign: "right" }}>REJ</th>
                  <th style={{ textAlign: "right" }}>PRODUCED</th>
                  <th style={{ textAlign: "right" }}>PART WT (KG)</th>
                  <th style={{ textAlign: "right" }}>RUN WT (KG)</th>
                  <th style={{ textAlign: "right", color: "#166534" }}>FG WT (KG)</th>
                  <th style={{ textAlign: "right", color: "#92400e" }}>RUNNER (KG)</th>
                  <th style={{ textAlign: "right", color: "#991b1b" }}>REJ (KG)</th>
                  <th style={{ textAlign: "right", color: "#1e3a8a" }}>TOTAL RM CONSUMED</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={16} style={{ padding: "30px", textAlign: "center", color: "#94a3b8" }}>
                      No shift records found for the selected filters.
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((r, idx) => (
                    <tr
                      key={r.id}
                      style={{
                        borderBottom: "1px solid #f1f5f9",
                        background: idx % 2 === 0 ? "#ffffff" : "#fcfcfd",
                      }}
                    >
                      <td style={{ padding: "9px 12px", fontWeight: "600" }}>{r.date}</td>
                      <td style={{ padding: "9px 12px", color: "#64748b" }}>{r.shiftName}</td>
                      <td style={{ padding: "9px 12px", color: "#475569" }}>{r.plantName}</td>
                      <td style={{ padding: "9px 12px", fontWeight: "700" }}>{r.machineNo}</td>
                      <td style={{ padding: "9px 12px", fontFamily: "Consolas, monospace", fontWeight: "700", color: "#0284c7" }}>
                        {r.sapCode}
                      </td>
                      <td style={{ padding: "9px 12px", maxWidth: "220px", fontWeight: "500" }}>{r.description}</td>
                      <td style={{ padding: "9px 12px", textAlign: "center", fontWeight: "700" }}>{r.moldCombo}</td>
                      <td style={{ padding: "9px 12px", textAlign: "right", color: "#16a34a", fontWeight: "700" }}>{fmtInt(r.ok)}</td>
                      <td style={{ padding: "9px 12px", textAlign: "right", color: r.rej > 0 ? "#dc2626" : "#94a3b8" }}>{fmtInt(r.rej)}</td>
                      <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: "700" }}>{fmtInt(r.produced)}</td>
                      <td style={{ padding: "9px 12px", textAlign: "right", fontFamily: "Consolas, monospace" }}>{fmtNum(r.partWt, 4)}</td>
                      <td style={{ padding: "9px 12px", textAlign: "right", fontFamily: "Consolas, monospace" }}>{fmtNum(r.runWt, 4)}</td>
                      <td style={{ padding: "9px 12px", textAlign: "right", color: "#166534", fontWeight: "600" }}>{fmtInt(r.fgWeight)}</td>
                      <td style={{ padding: "9px 12px", textAlign: "right", color: "#92400e", fontWeight: "600" }}>{fmtInt(r.runnerScrap)}</td>
                      <td style={{ padding: "9px 12px", textAlign: "right", color: "#991b1b", fontWeight: "600" }}>{fmtInt(r.rejWeight)}</td>
                      <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: "800", color: "#1e3a8a", fontSize: "13px" }}>
                        {fmtInt(r.totalConsumption)} kg
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
        )}

        {/* Formula help — bottom of scroll (embedded + standalone) */}
        <details className="rm-formula-help">
          <summary>
            How RM is calculated · Net Wt = Part Wt + (Runner ÷ Cavities) · Total = (OK+Rej) × Net Wt · click to expand
          </summary>
          <div style={{ marginTop: "10px" }}>
          <p style={{ margin: "0 0 10px 0", fontSize: "12px", color: "#64748b", lineHeight: "1.5" }}>
            Shop-floor reconciliation: RM on OK + rejection + runner scrap.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(310px, 1fr))", gap: "16px", marginBottom: "22px" }}>
            <div style={{ background: "#ffffff", borderRadius: "8px", padding: "16px", border: "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#2563eb" }}></span>
                <strong style={{ fontSize: "13px", color: "#1e3a8a" }}>1. Net Weight Per Piece</strong>
              </div>
              <div style={{ background: "#eff6ff", padding: "10px 12px", borderRadius: "6px", fontFamily: "Consolas, monospace", fontSize: "12px", color: "#1e40af", marginBottom: "8px" }}>
                Net Wt/Pc = Part Wt + (Runner Wt ÷ Active Cavities)
              </div>
              <div style={{ fontSize: "12px", color: "#64748b", lineHeight: "1.5" }}>
                Har 1 finished part banane me uska apna plastic weight lagta hai, plus runner/sprue ka uske hisse ka plastic share lagta hai.
              </div>
            </div>

            <div style={{ background: "#ffffff", borderRadius: "8px", padding: "16px", border: "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#16a34a" }}></span>
                <strong style={{ fontSize: "13px", color: "#166534" }}>2. Total RM Consumed</strong>
              </div>
              <div style={{ background: "#f0fdf4", padding: "10px 12px", borderRadius: "6px", fontFamily: "Consolas, monospace", fontSize: "12px", color: "#15803d", marginBottom: "8px" }}>
                Total RM Consumed (kg) = (OK + Rejection) × Net Wt/Pc
              </div>
              <div style={{ fontSize: "12px", color: "#64748b", lineHeight: "1.5" }}>
                RM (Plastic) OK part me bhi lagta hai aur Rejection part me bhi lagta hai. Isliye Total Produced Pieces (OK + Rej) se multiply hota hai.
              </div>
            </div>

            <div style={{ background: "#ffffff", borderRadius: "8px", padding: "16px", border: "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#7c3aed" }}></span>
                <strong style={{ fontSize: "13px", color: "#5b21b6" }}>3. Store &amp; Scrap Reconciliation</strong>
              </div>
              <div style={{ background: "#f5f3ff", padding: "10px 12px", borderRadius: "6px", fontFamily: "Consolas, monospace", fontSize: "12px", color: "#6d28d9", marginBottom: "8px" }}>
                Total = FG Net Wt + Rejection Scrap + Runner Scrap
              </div>
              <div style={{ fontSize: "12px", color: "#64748b", lineHeight: "1.5" }}>
                • FG Wt = OK × Part Wt<br />
                • Rej Wt = Rejection × Part Wt<br />
                • Runner Scrap = Total Shots × Runner Wt
              </div>
            </div>
          </div>

          {examplePart && (
            <div
              style={{
                background: "#ffffff",
                borderRadius: "10px",
                padding: "18px 22px",
                border: "1.5px solid #93c5fd",
                boxShadow: "0 2px 4px rgba(37,99,235,0.06)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
                <div style={{ fontSize: "13px", fontWeight: "700", color: "#1e3a8a" }}>
                  Live Example Breakdown: <span style={{ color: "#0284c7", fontFamily: "Consolas, monospace" }}>{examplePart.sapCode}</span> — {examplePart.description}
                </div>
                <div style={{ fontSize: "11px", color: "#64748b" }}>
                  (Click any row in Part-Wise table above to test with that part)
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "12px",
                  padding: "12px 14px",
                  background: "#f8fafc",
                  borderRadius: "8px",
                  fontSize: "12px",
                  marginBottom: "14px",
                }}
              >
                <div><strong>Part Weight:</strong> {fmtNum(examplePart.partWt, 4)} kg ({Number((examplePart.partWt * 1000).toFixed(1))}g)</div>
                <div><strong>Runner Weight:</strong> {fmtNum(examplePart.runWt, 4)} kg ({Number((examplePart.runWt * 1000).toFixed(1))}g)</div>
                <div><strong>Cavity:</strong> {examplePart.moldCombo} (Factor: {examplePart.cavityFactor})</div>
                <div><strong>OK Produced:</strong> {fmtInt(examplePart.ok)} pcs</div>
                <div><strong>Rejections:</strong> {fmtInt(examplePart.rej)} pcs</div>
                <div><strong>Total Produced:</strong> {fmtInt(examplePart.produced)} pcs</div>
              </div>

              <div style={{ fontSize: "12px", color: "#334155", lineHeight: "1.8", fontFamily: "Consolas, monospace", background: "#f1f5f9", padding: "14px", borderRadius: "8px" }}>
                <div><strong>Step 1:</strong> Net Wt/Piece = {fmtNum(examplePart.partWt, 4)} + ({fmtNum(examplePart.runWt, 4)} ÷ {examplePart.cavityFactor}) = <strong style={{ color: "#0284c7" }}>{fmtNum(examplePart.netWt, 4)} kg/pc</strong></div>
                <div><strong>Step 2:</strong> Total RM Consumed = {fmtInt(examplePart.produced)} pcs × {fmtNum(examplePart.netWt, 4)} kg/pc ≈ <strong style={{ color: "#1e3a8a", fontSize: "13px" }}>{fmtInt(examplePart.totalConsumption)} kg</strong></div>
                <div style={{ marginTop: "6px", paddingTop: "6px", borderTop: "1px dashed #cbd5e1", color: "#475569" }}>
                  <strong>Verification Breakup (Rounded):</strong><br />
                  • Finished Goods (FG) Weight = {fmtInt(examplePart.ok)} × {fmtNum(examplePart.partWt, 4)} ≈ <strong style={{ color: "#166534" }}>{fmtInt(examplePart.fgWeight)} kg</strong><br />
                  • Rejection Scrap Weight = {fmtInt(examplePart.rej)} × {fmtNum(examplePart.partWt, 4)} ≈ <strong style={{ color: "#991b1b" }}>{fmtInt(examplePart.rejWeight)} kg</strong><br />
                  • Runner Scrap Weight = {fmtInt(examplePart.shots)} shots × {fmtNum(examplePart.runWt, 4)} ≈ <strong style={{ color: "#92400e" }}>{fmtInt(examplePart.runnerScrap)} kg</strong><br />
                  • <strong>Sum Total = {fmtInt(examplePart.fgWeight)} + {fmtInt(examplePart.rejWeight)} + {fmtInt(examplePart.runnerScrap)} = <span style={{ color: "#1e3a8a" }}>{fmtInt(examplePart.totalConsumption)} kg</span> (Exact Rounded Match)</strong>
                </div>
              </div>
            </div>
          )}

          <div style={{ marginTop: "10px", display: "flex", gap: "16px", flexWrap: "wrap", fontSize: "11px", color: "#64748b" }}>
            <div>
              <strong>Hot runner:</strong> Runner Wt = 0 → Consumption = Produced × Part Wt
            </div>
            <div>
              <strong>Cold runner:</strong> Runner Wt add karna zaroori hai, warna store deficit dikhega
            </div>
          </div>
          </div>
        </details>
      </div>
      </div>
    </div>
  );
}
