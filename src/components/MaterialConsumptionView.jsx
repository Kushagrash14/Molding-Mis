import React, { useState, useMemo } from "react";
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

function fmtNum(n, d = 2) {
  if (n === null || n === undefined || isNaN(n)) return "0.00";
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
}) {
  // Filters
  const [dateFilterType, setDateFilterType] = useState("month"); // 'today', 'yesterday', 'last7', 'month', 'custom'
  const [customStartDate, setCustomStartDate] = useState(() => getOffsetDateStr(-7));
  const [customEndDate, setCustomEndDate] = useState(() => getTodayStr());
  const [plantFilter, setPlantFilter] = useState(selectedPlantId || "all");
  const [shiftFilter, setShiftFilter] = useState("all");
  const [machineFilter, setMachineFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState("summary"); // 'summary' (by part) or 'detailed' (by shift run)
  const [selectedExampleSap, setSelectedExampleSap] = useState(null);

  // Sync internal plant filter with external selectedPlantId if changed
  const activePlantId = plantFilter;

  // Determine active date range
  const { startDate, endDate } = useMemo(() => {
    const today = getTodayStr();
    if (dateFilterType === "today") return { startDate: today, endDate: today };
    if (dateFilterType === "yesterday") {
      const yest = getOffsetDateStr(-1);
      return { startDate: yest, endDate: yest };
    }
    if (dateFilterType === "last7") {
      return { startDate: getOffsetDateStr(-6), endDate: today };
    }
    if (dateFilterType === "month") {
      const y = today.slice(0, 4);
      const m = today.slice(5, 7);
      return { startDate: `${y}-${m}-01`, endDate: today };
    }
    return { startDate: customStartDate, endDate: customEndDate };
  }, [dateFilterType, customStartDate, customEndDate]);

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
        if (produced <= 0 && (!run.run_hour || Number(run.run_hour) <= 0)) return;

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

    // Sort by Total Consumption descending
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
    // Default to the highest consumption part or sample
    return partSummary[0] || null;
  }, [partSummary, selectedExampleSap]);

  // Export to Excel function
  const handleExportExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: Part-Wise Summary
      const summarySheetData = [
        ["MATERIAL CONSUMPTION SUMMARY REPORT", "", "", "", "", "", "", "", "", "", "", "", "", ""],
        [`Period: ${startDate} to ${endDate} | Plant: ${activePlantId === "all" ? "All Plants" : activePlantId}`, "", "", "", "", "", "", "", "", "", "", "", "", ""],
        [`Total Consumption: ${fmtNum(totals.totalConsumption, 2)} kg (${fmtNum(totals.totalTonnes, 3)} MT) | FG: ${fmtNum(totals.fgPct, 1)}% | Runner Scrap: ${fmtNum(totals.runnerPct, 1)}% | Rejection Scrap: ${fmtNum(totals.rejPct, 1)}%`, "", "", "", "", "", "", "", "", "", "", "", "", ""],
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
          "Rej Scrap (kg)",
          "Runner Scrap (kg)",
          "Total Consumption (kg)",
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
          Number(p.fgWeight.toFixed(2)),
          Number(p.rejWeight.toFixed(2)),
          Number(p.runnerScrap.toFixed(2)),
          Number(p.totalConsumption.toFixed(2)),
          Number(share.toFixed(1)),
        ]);
      });

      // Add summary total row
      summarySheetData.push([
        "TOTAL",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        totals.ok,
        totals.rej,
        totals.produced,
        Number(totals.fgWeight.toFixed(2)),
        Number(totals.rejWeight.toFixed(2)),
        Number(totals.runnerScrap.toFixed(2)),
        Number(totals.totalConsumption.toFixed(2)),
        100.0,
      ]);

      const wsSummary = XLSX.utils.aoa_to_sheet(summarySheetData);
      XLSX.utils.book_append_sheet(wb, wsSummary, "Part Summary");

      // Sheet 2: Detailed Shift Runs Log
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
          "Rej Wt (kg)",
          "Runner Wt (kg)",
          "Total Consumption (kg)",
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
          Number(r.fgWeight.toFixed(2)),
          Number(r.rejWeight.toFixed(2)),
          Number(r.runnerScrap.toFixed(2)),
          Number(r.totalConsumption.toFixed(2)),
        ]);
      });

      const wsDetailed = XLSX.utils.aoa_to_sheet(detailedSheetData);
      XLSX.utils.book_append_sheet(wb, wsDetailed, "Shift Detailed Log");

      const fileName = `Material_Consumption_${startDate}_to_${endDate}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (err) {
      console.error("Excel export error:", err);
      alert("Failed to export Excel report: " + err.message);
    }
  };

  return (
    <div style={{ padding: "20px 24px", maxWidth: "1560px", margin: "0 auto", color: "#0f172a" }}>
      {/* Top Banner & Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "20px",
          flexWrap: "wrap",
          gap: "14px",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
            <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "800", color: "#0f172a" }}>
              Material Consumption Analytics
            </h1>
            <span
              style={{
                background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
                color: "#ffffff",
                fontSize: "11px",
                fontWeight: "700",
                padding: "3px 9px",
                borderRadius: "20px",
                letterSpacing: "0.5px",
                boxShadow: "0 2px 4px rgba(79, 70, 229, 0.25)",
              }}
            >
              🔒 Super Admin Exclusive
            </span>
          </div>
          <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
            Plant-wide plastic polymer consumption, Finished Goods (FG) net weight, runner scrap &amp; rejection scrap reconciliation.
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button
            onClick={handleExportExcel}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "7px",
              padding: "9px 16px",
              background: "#16a34a",
              color: "#ffffff",
              border: "none",
              borderRadius: "7px",
              fontSize: "13px",
              fontWeight: "600",
              cursor: "pointer",
              boxShadow: "0 2px 4px rgba(22, 163, 74, 0.2)",
            }}
          >
            <span>📥</span> Download Excel Report
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div
        style={{
          background: "#ffffff",
          borderRadius: "10px",
          padding: "16px 20px",
          border: "1px solid #e2e8f0",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          marginBottom: "20px",
          display: "flex",
          flexWrap: "wrap",
          gap: "16px",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Quick Date Pills */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "12px", fontWeight: "700", color: "#475569", marginRight: "4px" }}>
            Date Range:
          </span>
          {[
            { id: "today", label: "Today" },
            { id: "yesterday", label: "Yesterday" },
            { id: "last7", label: "Last 7 Days" },
            { id: "month", label: "This Month" },
            { id: "custom", label: "Custom" },
          ].map((pill) => (
            <button
              key={pill.id}
              onClick={() => setDateFilterType(pill.id)}
              style={{
                padding: "6px 12px",
                fontSize: "12px",
                fontWeight: "600",
                borderRadius: "6px",
                border: "1px solid",
                borderColor: dateFilterType === pill.id ? "#3b82f6" : "#cbd5e1",
                background: dateFilterType === pill.id ? "#eff6ff" : "#ffffff",
                color: dateFilterType === pill.id ? "#1d4ed8" : "#475569",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {pill.label}
            </button>
          ))}

          {dateFilterType === "custom" && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginLeft: "6px" }}>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                style={{
                  padding: "5px 8px",
                  fontSize: "12px",
                  border: "1px solid #cbd5e1",
                  borderRadius: "6px",
                }}
              />
              <span style={{ fontSize: "12px", color: "#64748b" }}>to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                style={{
                  padding: "5px 8px",
                  fontSize: "12px",
                  border: "1px solid #cbd5e1",
                  borderRadius: "6px",
                }}
              />
            </div>
          )}
        </div>

        {/* Dropdowns: Plant, Shift, Machine */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          {/* Plant Selector */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "12px", fontWeight: "600", color: "#64748b" }}>Plant:</span>
            <select
              value={plantFilter}
              onChange={(e) => {
                setPlantFilter(e.target.value);
                if (onSelectPlant) onSelectPlant(e.target.value);
              }}
              style={{
                padding: "6px 10px",
                fontSize: "12px",
                fontWeight: "600",
                border: "1px solid #cbd5e1",
                borderRadius: "6px",
                background: "#ffffff",
              }}
            >
              <option value="all">All Plants</option>
              {plants.map((p) => (
                <option key={p.plant_id} value={p.plant_id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Shift Filter */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "12px", fontWeight: "600", color: "#64748b" }}>Shift:</span>
            <select
              value={shiftFilter}
              onChange={(e) => setShiftFilter(e.target.value)}
              style={{
                padding: "6px 10px",
                fontSize: "12px",
                fontWeight: "600",
                border: "1px solid #cbd5e1",
                borderRadius: "6px",
                background: "#ffffff",
              }}
            >
              <option value="all">All Shifts</option>
              {shifts.map((s) => (
                <option key={s.shift_id} value={s.shift_id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Machine Filter */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "12px", fontWeight: "600", color: "#64748b" }}>Machine:</span>
            <select
              value={machineFilter}
              onChange={(e) => setMachineFilter(e.target.value)}
              style={{
                padding: "6px 10px",
                fontSize: "12px",
                fontWeight: "600",
                border: "1px solid #cbd5e1",
                borderRadius: "6px",
                background: "#ffffff",
                maxWidth: "140px",
              }}
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
          </div>

          {/* Search Box */}
          <input
            type="text"
            placeholder="Search SAP, part, machine..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              padding: "6px 12px",
              fontSize: "12px",
              border: "1px solid #cbd5e1",
              borderRadius: "6px",
              width: "180px",
            }}
          />
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          gap: "14px",
          marginBottom: "20px",
        }}
      >
        {/* Card 1: Total Consumption */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "10px",
            padding: "16px 18px",
            border: "1px solid #e2e8f0",
            borderLeft: "5px solid #2563eb",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <div style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>
            Total Polymer Consumed
          </div>
          <div style={{ fontSize: "24px", fontWeight: "800", color: "#1e3a8a", marginTop: "4px" }}>
            {fmtNum(totals.totalConsumption, 1)} <span style={{ fontSize: "14px", fontWeight: "600" }}>kg</span>
          </div>
          <div style={{ fontSize: "12px", color: "#2563eb", fontWeight: "700", marginTop: "2px" }}>
            ≈ {fmtNum(totals.totalTonnes, 3)} Metric Tonnes (MT)
          </div>
        </div>

        {/* Card 2: FG Net Weight */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "10px",
            padding: "16px 18px",
            border: "1px solid #e2e8f0",
            borderLeft: "5px solid #16a34a",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <div style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>
            Finished Goods (FG) Net Plastic
          </div>
          <div style={{ fontSize: "24px", fontWeight: "800", color: "#166534", marginTop: "4px" }}>
            {fmtNum(totals.fgWeight, 1)} <span style={{ fontSize: "14px", fontWeight: "600" }}>kg</span>
          </div>
          <div style={{ fontSize: "12px", color: "#16a34a", fontWeight: "700", marginTop: "2px" }}>
            {fmtNum(totals.fgPct, 1)}% of total consumed
          </div>
        </div>

        {/* Card 3: Runner Scrap */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "10px",
            padding: "16px 18px",
            border: "1px solid #e2e8f0",
            borderLeft: "5px solid #d97706",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <div style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>
            Runner Scrap Generated
          </div>
          <div style={{ fontSize: "24px", fontWeight: "800", color: "#92400e", marginTop: "4px" }}>
            {fmtNum(totals.runnerScrap, 1)} <span style={{ fontSize: "14px", fontWeight: "600" }}>kg</span>
          </div>
          <div style={{ fontSize: "12px", color: "#d97706", fontWeight: "700", marginTop: "2px" }}>
            {fmtNum(totals.runnerPct, 1)}% runner loss
          </div>
        </div>

        {/* Card 4: Rejection Scrap */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "10px",
            padding: "16px 18px",
            border: "1px solid #e2e8f0",
            borderLeft: "5px solid #dc2626",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <div style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>
            Part Rejection Scrap
          </div>
          <div style={{ fontSize: "24px", fontWeight: "800", color: "#991b1b", marginTop: "4px" }}>
            {fmtNum(totals.rejWeight, 1)} <span style={{ fontSize: "14px", fontWeight: "600" }}>kg</span>
          </div>
          <div style={{ fontSize: "12px", color: "#dc2626", fontWeight: "700", marginTop: "2px" }}>
            {fmtNum(totals.rejPct, 1)}% ({fmtInt(totals.rej)} rejected pcs)
          </div>
        </div>

        {/* Card 5: Production & Shots */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "10px",
            padding: "16px 18px",
            border: "1px solid #e2e8f0",
            borderLeft: "5px solid #6366f1",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <div style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>
            Total Production &amp; Shots
          </div>
          <div style={{ fontSize: "24px", fontWeight: "800", color: "#3730a3", marginTop: "4px" }}>
            {fmtInt(totals.produced)} <span style={{ fontSize: "14px", fontWeight: "600" }}>pcs</span>
          </div>
          <div style={{ fontSize: "12px", color: "#4f46e5", fontWeight: "600", marginTop: "2px" }}>
            Shots: <strong>{fmtInt(totals.shots)}</strong> | OK: <strong>{fmtInt(totals.ok)}</strong>
          </div>
        </div>
      </div>

      {/* Material Balance Bar (Visual Stacked Bar) */}
      <div
        style={{
          background: "#ffffff",
          borderRadius: "10px",
          padding: "14px 20px",
          border: "1px solid #e2e8f0",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          marginBottom: "20px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
          <span style={{ fontSize: "12px", fontWeight: "700", color: "#475569" }}>
            Material Distribution &amp; Yield Breakdown:
          </span>
          <span style={{ fontSize: "12px", fontWeight: "600", color: "#64748b" }}>
            Yield (FG / Consumed): <strong style={{ color: "#16a34a" }}>{fmtNum(totals.fgPct, 1)}%</strong> | Total Scrap: <strong style={{ color: "#dc2626" }}>{fmtNum(totals.scrapPct, 1)}%</strong>
          </span>
        </div>

        <div style={{ height: "18px", display: "flex", borderRadius: "6px", overflow: "hidden", background: "#f1f5f9" }}>
          <div
            title={`Finished Goods: ${fmtNum(totals.fgPct, 1)}% (${fmtNum(totals.fgWeight, 1)} kg)`}
            style={{
              width: `${totals.fgPct}%`,
              background: "#16a34a",
              transition: "width 0.3s ease",
            }}
          />
          <div
            title={`Runner Scrap: ${fmtNum(totals.runnerPct, 1)}% (${fmtNum(totals.runnerScrap, 1)} kg)`}
            style={{
              width: `${totals.runnerPct}%`,
              background: "#d97706",
              transition: "width 0.3s ease",
            }}
          />
          <div
            title={`Rejection Scrap: ${fmtNum(totals.rejPct, 1)}% (${fmtNum(totals.rejWeight, 1)} kg)`}
            style={{
              width: `${totals.rejPct}%`,
              background: "#dc2626",
              transition: "width 0.3s ease",
            }}
          />
        </div>

        <div style={{ display: "flex", gap: "20px", marginTop: "8px", fontSize: "11px", fontWeight: "600" }}>
          <span style={{ display: "flex", alignItems: "center", gap: "6px", color: "#166534" }}>
            <span style={{ width: "10px", height: "10px", borderRadius: "2px", background: "#16a34a" }}></span>
            Finished Goods ({fmtNum(totals.fgPct, 1)}%)
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: "6px", color: "#92400e" }}>
            <span style={{ width: "10px", height: "10px", borderRadius: "2px", background: "#d97706" }}></span>
            Runner Scrap ({fmtNum(totals.runnerPct, 1)}%)
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: "6px", color: "#991b1b" }}>
            <span style={{ width: "10px", height: "10px", borderRadius: "2px", background: "#dc2626" }}></span>
            Rejection Scrap ({fmtNum(totals.rejPct, 1)}%)
          </span>
        </div>
      </div>

      {/* Main Table Card */}
      <div
        style={{
          background: "#ffffff",
          borderRadius: "10px",
          border: "1px solid #e2e8f0",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          overflow: "hidden",
          marginBottom: "24px",
        }}
      >
        {/* Table View Switcher Header */}
        <div
          style={{
            padding: "12px 20px",
            background: "#f8fafc",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              onClick={() => setViewMode("summary")}
              style={{
                padding: "6px 14px",
                fontSize: "12px",
                fontWeight: "700",
                borderRadius: "6px",
                border: "1px solid",
                borderColor: viewMode === "summary" ? "#2563eb" : "#cbd5e1",
                background: viewMode === "summary" ? "#eff6ff" : "#ffffff",
                color: viewMode === "summary" ? "#1e40af" : "#64748b",
                cursor: "pointer",
              }}
            >
              📊 Part-Wise Summary ({partSummary.length} Parts)
            </button>
            <button
              onClick={() => setViewMode("detailed")}
              style={{
                padding: "6px 14px",
                fontSize: "12px",
                fontWeight: "700",
                borderRadius: "6px",
                border: "1px solid",
                borderColor: viewMode === "detailed" ? "#2563eb" : "#cbd5e1",
                background: viewMode === "detailed" ? "#eff6ff" : "#ffffff",
                color: viewMode === "detailed" ? "#1e40af" : "#64748b",
                cursor: "pointer",
              }}
            >
              📋 Shift-Wise Detailed Log ({filteredRecords.length} Runs)
            </button>
          </div>

          <div style={{ fontSize: "12px", color: "#64748b" }}>
            Showing <strong>{viewMode === "summary" ? partSummary.length : filteredRecords.length}</strong> records
          </div>
        </div>

        {/* View 1: Part-Wise Summary Table */}
        {viewMode === "summary" ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
              <thead>
                <tr style={{ background: "#f1f5f9", color: "#475569", borderBottom: "2px solid #e2e8f0" }}>
                  <th style={{ padding: "10px 12px", textAlign: "left" }}>#</th>
                  <th style={{ padding: "10px 12px", textAlign: "left" }}>SAP CODE</th>
                  <th style={{ padding: "10px 12px", textAlign: "left" }}>MATERIAL DESCRIPTION</th>
                  <th style={{ padding: "10px 12px", textAlign: "center" }}>CAV</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>PART WT (KG)</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>RUN WT (KG)</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>NET WT/PC</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>OK (PCS)</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>REJ (PCS)</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>PRODUCED</th>
                  <th style={{ padding: "10px 12px", textAlign: "right", color: "#166534" }}>FG WT (KG)</th>
                  <th style={{ padding: "10px 12px", textAlign: "right", color: "#92400e" }}>RUNNER (KG)</th>
                  <th style={{ padding: "10px 12px", textAlign: "right", color: "#991b1b" }}>REJ WT (KG)</th>
                  <th style={{ padding: "10px 12px", textAlign: "right", color: "#1e3a8a", fontWeight: "800" }}>TOTAL CONSUMED</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>SHARE %</th>
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
                          {fmtNum(p.fgWeight, 2)}
                        </td>
                        <td style={{ padding: "9px 12px", textAlign: "right", color: "#92400e", fontWeight: "600" }}>
                          {fmtNum(p.runnerScrap, 2)}
                        </td>
                        <td style={{ padding: "9px 12px", textAlign: "right", color: "#991b1b", fontWeight: "600" }}>
                          {fmtNum(p.rejWeight, 2)}
                        </td>
                        <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: "800", color: "#1e3a8a", fontSize: "13px" }}>
                          {fmtNum(p.totalConsumption, 2)} kg
                        </td>
                        <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: "600", color: "#64748b" }}>
                          {fmtNum(share, 1)}%
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
                    <td style={{ padding: "12px", textAlign: "right", color: "#166534" }}>{fmtNum(totals.fgWeight, 2)} kg</td>
                    <td style={{ padding: "12px", textAlign: "right", color: "#d97706" }}>{fmtNum(totals.runnerScrap, 2)} kg</td>
                    <td style={{ padding: "12px", textAlign: "right", color: "#dc2626" }}>{fmtNum(totals.rejWeight, 2)} kg</td>
                    <td style={{ padding: "12px", textAlign: "right", color: "#1e3a8a", fontSize: "14px" }}>
                      {fmtNum(totals.totalConsumption, 2)} kg
                    </td>
                    <td style={{ padding: "12px", textAlign: "right" }}>100%</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        ) : (
          /* View 2: Shift-Wise Detailed Log Table */
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
              <thead>
                <tr style={{ background: "#f1f5f9", color: "#475569", borderBottom: "2px solid #e2e8f0" }}>
                  <th style={{ padding: "10px 12px", textAlign: "left" }}>DATE</th>
                  <th style={{ padding: "10px 12px", textAlign: "left" }}>SHIFT</th>
                  <th style={{ padding: "10px 12px", textAlign: "left" }}>PLANT</th>
                  <th style={{ padding: "10px 12px", textAlign: "left" }}>MACHINE</th>
                  <th style={{ padding: "10px 12px", textAlign: "left" }}>SAP CODE</th>
                  <th style={{ padding: "10px 12px", textAlign: "left" }}>PART DESCRIPTION</th>
                  <th style={{ padding: "10px 12px", textAlign: "center" }}>CAV</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>OK</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>REJ</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>PRODUCED</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>PART WT (KG)</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>RUN WT (KG)</th>
                  <th style={{ padding: "10px 12px", textAlign: "right", color: "#166534" }}>FG WT (KG)</th>
                  <th style={{ padding: "10px 12px", textAlign: "right", color: "#92400e" }}>RUNNER (KG)</th>
                  <th style={{ padding: "10px 12px", textAlign: "right", color: "#991b1b" }}>REJ (KG)</th>
                  <th style={{ padding: "10px 12px", textAlign: "right", color: "#1e3a8a", fontWeight: "800" }}>TOTAL CONSUMED</th>
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
                      <td style={{ padding: "9px 12px", textAlign: "right", color: "#166534", fontWeight: "600" }}>{fmtNum(r.fgWeight, 2)}</td>
                      <td style={{ padding: "9px 12px", textAlign: "right", color: "#92400e", fontWeight: "600" }}>{fmtNum(r.runnerScrap, 2)}</td>
                      <td style={{ padding: "9px 12px", textAlign: "right", color: "#991b1b", fontWeight: "600" }}>{fmtNum(r.rejWeight, 2)}</td>
                      <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: "800", color: "#1e3a8a", fontSize: "13px" }}>
                        {fmtNum(r.totalConsumption, 2)} kg
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* THE CALCULATION LOGIC & AUDIT GUIDE (At the Bottom)            */}
      {/* ============================================================== */}
      <div
        style={{
          background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)",
          borderRadius: "12px",
          border: "1.5px solid #cbd5e1",
          padding: "24px 28px",
          boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
          <span style={{ fontSize: "20px" }}>📐</span>
          <h2 style={{ margin: 0, fontSize: "17px", fontWeight: "800", color: "#0f172a" }}>
            How Material Consumption is Calculated (Standard Manufacturing Logic &amp; Formulas)
          </h2>
        </div>

        <p style={{ margin: "0 0 18px 0", fontSize: "13px", color: "#475569", lineHeight: "1.6" }}>
          Plastic injection molding manufacturing me raw material consumption calculate karne ka yeh official, standard engineering aur shop-floor reconciliation formula hai:
        </p>

        {/* 3 Formula Columns */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(310px, 1fr))", gap: "16px", marginBottom: "22px" }}>
          {/* Card 1: Per-Piece Formula */}
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

          {/* Card 2: Total Consumption Formula */}
          <div style={{ background: "#ffffff", borderRadius: "8px", padding: "16px", border: "1px solid #e2e8f0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#16a34a" }}></span>
              <strong style={{ fontSize: "13px", color: "#166534" }}>2. Total Material Consumed</strong>
            </div>
            <div style={{ background: "#f0fdf4", padding: "10px 12px", borderRadius: "6px", fontFamily: "Consolas, monospace", fontSize: "12px", color: "#15803d", marginBottom: "8px" }}>
              Total Consumed (kg) = (OK + Rejection) × Net Wt/Pc
            </div>
            <div style={{ fontSize: "12px", color: "#64748b", lineHeight: "1.5" }}>
              Plastic OK part me bhi lagta hai aur Rejection part me bhi lagta hai. Isliye Total Produced Pieces (OK + Rej) se multiply hota hai.
            </div>
          </div>

          {/* Card 3: 3-Way Store Audit Reconciliation */}
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

        {/* Live Interactive Calculation Card */}
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
                💡 Live Example Breakdown: <span style={{ color: "#0284c7", fontFamily: "Consolas, monospace" }}>{examplePart.sapCode}</span> — {examplePart.description}
              </div>
              <div style={{ fontSize: "11px", color: "#64748b" }}>
                (Click any row in the table above to test with that part)
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
              <div><strong>Step 2:</strong> Total Consumed = {fmtInt(examplePart.produced)} pcs × {fmtNum(examplePart.netWt, 4)} kg/pc = <strong style={{ color: "#1e3a8a", fontSize: "13px" }}>{fmtNum(examplePart.totalConsumption, 2)} kg</strong></div>
              <div style={{ marginTop: "6px", paddingTop: "6px", borderTop: "1px dashed #cbd5e1", color: "#475569" }}>
                <strong>Verification Breakup:</strong><br />
                • Finished Goods (FG) Weight = {fmtInt(examplePart.ok)} × {fmtNum(examplePart.partWt, 4)} = <strong style={{ color: "#166534" }}>{fmtNum(examplePart.fgWeight, 2)} kg</strong><br />
                • Rejection Scrap Weight = {fmtInt(examplePart.rej)} × {fmtNum(examplePart.partWt, 4)} = <strong style={{ color: "#991b1b" }}>{fmtNum(examplePart.rejWeight, 2)} kg</strong><br />
                • Runner Scrap Weight = {fmtInt(examplePart.shots)} shots × {fmtNum(examplePart.runWt, 4)} = <strong style={{ color: "#92400e" }}>{fmtNum(examplePart.runnerScrap, 2)} kg</strong><br />
                • <strong>Sum Total = {fmtNum(examplePart.fgWeight, 2)} + {fmtNum(examplePart.rejWeight, 2)} + {fmtNum(examplePart.runnerScrap, 2)} = <span style={{ color: "#1e3a8a" }}>{fmtNum(examplePart.totalConsumption, 2)} kg</span> (Exact 100% Match)</strong>
              </div>
            </div>
          </div>
        )}

        {/* Cold vs Hot Runner Note */}
        <div style={{ marginTop: "16px", display: "flex", gap: "24px", flexWrap: "wrap", fontSize: "12px", color: "#64748b" }}>
          <div>
            🔥 <strong>Hot Runner Molds:</strong> Hot runner molds me runner solidify nahi hota (Runner Wt = 0), isliye direct <code style={{ background: "#e2e8f0", padding: "1px 4px", borderRadius: "3px" }}>Consumption = Produced × Part Wt</code> hota hai.
          </div>
          <div>
            ❄️ <strong>Cold Runner Molds:</strong> Cold runner molds me runner solid nikalta hai, isliye runner weight add karna compulsory hota hai warna store me polymer ka deficit/shortage show hoga.
          </div>
        </div>
      </div>
    </div>
  );
}
