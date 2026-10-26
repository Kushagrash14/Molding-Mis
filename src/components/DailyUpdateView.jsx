import React, { useState, useMemo } from "react";
import * as XLSX from "xlsx";

/**
 * Plant Theme Definitions matching Excel screenshot
 */
const PLANT_THEMES = {
  "2020": {
    headerBg: "#FEF08A", // Golden Yellow
    headerText: "#854D0E",
    border: "#FACC15",
    badgeBg: "#FEF9C3",
    tag: "PGTL- MOLDING",
  },
  "4010": {
    headerBg: "#E0F2FE", // Soft Blue
    headerText: "#0369A1",
    border: "#7DD3FC",
    badgeBg: "#F0F9FF",
    tag: "NGM- MOLDING",
  },
  "1040": {
    headerBg: "#F1F5F9", // Crisp Clean Slate
    headerText: "#1E293B",
    border: "#CBD5E1",
    badgeBg: "#FFFFFF",
    tag: "PGEL- MOLDING",
  },
  "2060": {
    headerBg: "#DCFCE7", // Soft Green
    headerText: "#166534",
    border: "#86EFAC",
    badgeBg: "#F0FDF4",
    tag: "DMIC- MOLDING",
  },
  default: {
    headerBg: "#F1F5F9",
    headerText: "#334155",
    border: "#CBD5E1",
    badgeBg: "#FFFFFF",
    tag: "MOLDING",
  },
};

function getPlantTheme(plantId, plantName = "") {
  const pId = String(plantId || "");
  if (PLANT_THEMES[pId]) return PLANT_THEMES[pId];
  const upper = plantName.toUpperCase();
  if (upper.includes("PGTL")) return PLANT_THEMES["2020"];
  if (upper.includes("NGM")) return PLANT_THEMES["4010"];
  if (upper.includes("PGEL")) return PLANT_THEMES["1040"];
  if (upper.includes("DMIC")) return PLANT_THEMES["2060"];
  return PLANT_THEMES.default;
}

function getPlantDisplayName(plant) {
  const pId = String(plant?.plant_id || "");
  const name = plant?.name || "";
  const upper = name.toUpperCase();
  if (pId === "2020" || upper.includes("PGTL")) return "PGTL- MOLDING";
  if (pId === "4010" || upper.includes("NGM")) return "NGM- MOLDING";
  if (pId === "1040" || upper.includes("PGEL")) return "PGEL- MOLDING";
  if (pId === "2060" || upper.includes("DMIC")) return "DMIC- MOLDING";
  return `${name.replace(/^[\w-]+\s*-\s*/, "")}- MOLDING`;
}

function formatShortDate(dateStr) {
  if (!dateStr) return "";
  const parts = dateStr.slice(0, 10).split("-");
  if (parts.length === 3) {
    const day = parts[2];
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = months[parseInt(parts[1], 10) - 1] || parts[1];
    return `${day}-${month}`;
  }
  return dateStr;
}

function generateDateRange(startStr, endStr) {
  const dates = [];
  let curr = new Date(startStr);
  const end = new Date(endStr);
  if (isNaN(curr.getTime()) || isNaN(end.getTime()) || curr > end) {
    return [];
  }
  while (curr <= end) {
    const yyyy = curr.getFullYear();
    const mm = String(curr.getMonth() + 1).padStart(2, "0");
    const dd = String(curr.getDate()).padStart(2, "0");
    dates.push(`${yyyy}-${mm}-${dd}`);
    curr.setDate(curr.getDate() + 1);
  }
  return dates;
}

/**
 * Checks if a run or entry represents NO PLAN (12 hr downtime or quick fill idle)
 */
function isNoPlanRun(run, entry) {
  if (!run && !entry) return false;
  const target = run || entry;

  const sap = String(target.sap_code || entry?.sap_code || "").trim();
  if (sap === "DOWN_12H" || sap === "NO_PLAN") return true;

  const matDesc = String(target.material_description || entry?.material_description || "").toLowerCase();
  if (matDesc.includes("no plan") || matDesc.includes("no_plan")) return true;

  const reasons = target.reasons || entry?.reasons;
  if (!reasons) return false;

  if (Array.isArray(reasons)) {
    return reasons.some((r) => {
      const id = String(r?.reason_id || r?.name || "").toLowerCase();
      const val = Number(r?.value || r?.minutes || 0);
      return val > 0 && (id.includes("no_plan") || id.includes("no plan"));
    });
  }

  if (typeof reasons === "object") {
    for (const [k, v] of Object.entries(reasons)) {
      const id = k.toLowerCase();
      const val = typeof v === "object" && v !== null ? Number(v.value || v.minutes || 0) : Number(v || 0);
      if (val > 0 && (id.includes("no_plan") || id.includes("no plan"))) return true;
    }
  }

  return false;
}

export default function DailyUpdateView({
  entries = [],
  machines = [],
  plants = [],
  locations = [],
  master = [],
  shifts = [],
  currentUser,
  onRefresh,
}) {
  // Date range defaults: 18-Oct-2026 to 25-Oct-2026 (matching the user's review sheet)
  const [startDate, setStartDate] = useState("2026-10-18");
  const [endDate, setEndDate] = useState("2026-10-25");
  const [activePlantTab, setActivePlantTab] = useState("ALL"); // "ALL" or plant_id
  const [layoutMode, setLayoutMode] = useState("stacked"); // default to "stacked" for direct full view
  const [drillModalData, setDrillModalData] = useState(null);
  const [drillTab, setDrillTab] = useState("filled"); // "filled" | "no_plan" | "pending"
  const [copyFeedback, setCopyFeedback] = useState(false);

  // Generate list of dates between startDate and endDate
  const dateList = useMemo(() => {
    return generateDateRange(startDate, endDate);
  }, [startDate, endDate]);

  // Determine active plants to show (sorted: PGTL 2020, NGM 4010, PGEL 1040, then others)
  const targetPlants = useMemo(() => {
    const list = [...plants];
    const priority = { "2020": 1, "4010": 2, "1040": 3, "2060": 4 };
    return list.sort((a, b) => {
      const pa = priority[a.plant_id] || 99;
      const pb = priority[b.plant_id] || 99;
      return pa - pb;
    });
  }, [plants]);

  // Compute machine counts per plant
  const plantMachinesMap = useMemo(() => {
    const map = new Map();
    for (const p of targetPlants) {
      const pId = p.plant_id;
      const mcs = machines.filter((m) => {
        if (m.plant_id === pId) return true;
        if (pId === "1040" && ["PLANT-U01", "PLANT-U02", "PLANT-U03"].includes(m.plant_id)) return true;
        return false;
      });
      map.set(pId, mcs);
    }
    return map;
  }, [targetPlants, machines]);

  // Fast O(N) pre-index for entries by plant and date
  const entriesLookup = useMemo(() => {
    const map = new Map();
    for (const e of entries) {
      const rawPlant = String(e.plant_id || "");
      const pId = ["PLANT-U01", "PLANT-U02", "PLANT-U03"].includes(rawPlant) ? "1040" : rawPlant;
      const rawDate = String(e.shift_date || "");
      const d = rawDate.slice(0, 10);
      const key = `${pId}__${d}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(e);

      // Also support alternative date format indexing if present
      if (rawDate.includes("-")) {
        const parts = d.split("-");
        if (parts.length === 3) {
          const alt1 = `${pId}__${parts[2]}-${parts[1]}-${parts[0]}`;
          if (!map.has(alt1)) map.set(alt1, []);
          map.get(alt1).push(e);
        }
      }
    }
    return map;
  }, [entries]);

  // Main calculation matrix: plant_id -> dateStr -> { totalProd, totalMc, noPlanMc, filledMc, filledPct, pendingMc, machineDetails }
  const tableMatrix = useMemo(() => {
    const matrix = {};

    for (const p of targetPlants) {
      const pId = p.plant_id;
      const plantMcs = plantMachinesMap.get(pId) || [];
      const totalMc = plantMcs.length;
      matrix[pId] = {
        plant: p,
        totalMc,
        dates: {},
        totals: {
          totalProd: 0,
          noPlanOccurrences: 0,
          filledShifts: 0,
        },
      };

      for (const d of dateList) {
        // Fast O(1) lookup
        const plantDateEntries = entriesLookup.get(`${pId}__${d}`) || [];

        // Group entries by machine_id
        const mcEntriesMap = new Map();
        for (const e of plantDateEntries) {
          if (!e.machine_id) continue;
          if (!mcEntriesMap.has(e.machine_id)) {
            mcEntriesMap.set(e.machine_id, []);
          }
          mcEntriesMap.get(e.machine_id).push(e);
        }

        const filledMcCount = mcEntriesMap.size;
        const pendingMcCount = Math.max(0, totalMc - filledMcCount);
        const filledPct = totalMc > 0 ? Math.round((filledMcCount / totalMc) * 100) : 0;

        let totalProd = 0;
        let noPlanMcCount = 0;
        const filledList = [];
        const noPlanList = [];

        for (const [mId, mcRuns] of mcEntriesMap.entries()) {
          let mcProd = 0;
          let isNoPlan = false;
          let latestRun = null;

          for (const e of mcRuns) {
            if (Array.isArray(e.runs) && e.runs.length > 0) {
              for (const r of e.runs) {
                mcProd += Number(r.ok_prod) || 0;
                if (isNoPlanRun(r, e)) isNoPlan = true;
                latestRun = r;
              }
            } else {
              mcProd += Number(e.ok_prod) || 0;
              if (isNoPlanRun(e, e)) isNoPlan = true;
              latestRun = e;
            }
          }

          totalProd += mcProd;

          const mcObj = plantMcs.find((m) => m.machine_id === mId) || { machine_id: mId };
          const detailItem = {
            machine_id: mId,
            machine_name: mcObj.name || mId,
            tonnage: mcObj.tonnage || "-",
            prod: mcProd,
            isNoPlan: mcProd === 0 && isNoPlan,
            sap_code: latestRun?.sap_code || "-",
            material_description: latestRun?.material_description || "-",
            operator_name: mcRuns[0]?.operator_name || mcRuns[0]?.created_by_name || "-",
            shift_id: mcRuns.map((r) => r.shift_id).filter(Boolean).join(", ") || "1",
          };

          filledList.push(detailItem);

          if (mcProd === 0 && isNoPlan) {
            noPlanMcCount++;
            noPlanList.push(detailItem);
          }
        }

        const pendingList = plantMcs
          .filter((m) => !mcEntriesMap.has(m.machine_id))
          .map((m) => ({
            machine_id: m.machine_id,
            machine_name: m.name || m.machine_id,
            tonnage: m.tonnage || "-",
            location: m.bay_id || m.location_id || "-",
          }));

        matrix[pId].dates[d] = {
          dateStr: d,
          shortDate: formatShortDate(d),
          totalProd,
          totalMc,
          noPlanMcCount,
          filledMcCount,
          pendingMcCount,
          filledPct,
          filledList,
          noPlanList,
          pendingList,
        };

        matrix[pId].totals.totalProd += totalProd;
        matrix[pId].totals.noPlanOccurrences += noPlanMcCount;
        matrix[pId].totals.filledShifts += filledMcCount;
      }
    }

    return matrix;
  }, [targetPlants, plantMachinesMap, dateList, entries]);

  // Overall KPI cards
  const kpis = useMemo(() => {
    let grandProd = 0;
    let totalTrackedMc = 0;
    let grandFilledShifts = 0;
    let grandPossibleShifts = 0;
    let grandNoPlan = 0;

    for (const p of targetPlants) {
      const data = tableMatrix[p.plant_id];
      if (!data) continue;
      grandProd += data.totals.totalProd;
      totalTrackedMc += data.totalMc;
      grandFilledShifts += data.totals.filledShifts;
      grandPossibleShifts += data.totalMc * dateList.length;
      grandNoPlan += data.totals.noPlanOccurrences;
    }

    const avgCoverage =
      grandPossibleShifts > 0 ? Math.round((grandFilledShifts / grandPossibleShifts) * 100) : 0;

    return {
      grandProd,
      totalTrackedMc,
      avgCoverage,
      grandNoPlan,
      activePlantCount: targetPlants.length,
    };
  }, [tableMatrix, targetPlants, dateList]);

  // Export to Excel (.xlsx)
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    for (const p of targetPlants) {
      const data = tableMatrix[p.plant_id];
      if (!data) continue;
      const pName = getPlantDisplayName(p);

      const rows = [];
      // Header matching screenshot: Date | Total Prod | Total M/C | No Plan M/C | Filled M/C | Filled %
      rows.push(["Date", "Total Prod", "Total M/C", "No Plan M/C", "Filled M/C", "Filled %"]);

      for (const d of dateList) {
        const item = data.dates[d];
        if (!item) continue;
        rows.push([
          item.shortDate,
          item.totalProd > 0 ? item.totalProd : "",
          item.totalMc,
          item.noPlanMcCount > 0 ? item.noPlanMcCount : "",
          item.filledMcCount > 0 ? item.filledMcCount : "",
          item.filledMcCount > 0 ? `${item.filledPct}%` : "",
        ]);
      }

      // Summary row
      rows.push([
        "Total",
        data.totals.totalProd,
        data.totalMc,
        data.totals.noPlanOccurrences,
        data.totals.filledShifts,
        "",
      ]);

      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws["!cols"] = [{ wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 12 }];

      const sheetName = pName.slice(0, 31).replace(/[\/\\?*:[\]]/g, "_");
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }

    XLSX.writeFile(wb, `Daily_MIS_Summary_${startDate}_to_${endDate}.xlsx`);
  };

  // Copy TSV to clipboard for direct Excel pasting
  const handleCopyTSV = () => {
    let tsv = "";
    for (const p of targetPlants) {
      const data = tableMatrix[p.plant_id];
      if (!data) continue;
      const pName = getPlantDisplayName(p);

      tsv += `\n${pName} (Total M/C: ${data.totalMc})\n`;
      tsv += "Date\tTotal Prod\tTotal M/C\tNo Plan M/C\tFilled M/C\tFilled %\n";

      for (const d of dateList) {
        const item = data.dates[d];
        if (!item) continue;
        const prod = item.totalProd > 0 ? item.totalProd : "";
        const noPlan = item.noPlanMcCount > 0 ? item.noPlanMcCount : "";
        const filled = item.filledMcCount > 0 ? item.filledMcCount : "";
        const pctStr = item.filledMcCount > 0 ? `${item.filledPct}%` : "";
        tsv += `${item.shortDate}\t${prod}\t${item.totalMc}\t${noPlan}\t${filled}\t${pctStr}\n`;
      }
    }

    navigator.clipboard.writeText(tsv).then(() => {
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2500);
    });
  };

  // Date Presets
  const setPresetRange = (type) => {
    const today = new Date();
    const fmt = (d) => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    };

    if (type === "review") {
      setStartDate("2026-10-18");
      setEndDate("2026-10-25");
    } else if (type === "last7") {
      const s = new Date(today);
      s.setDate(s.getDate() - 6);
      setStartDate(fmt(s));
      setEndDate(fmt(today));
    } else if (type === "last14") {
      const s = new Date(today);
      s.setDate(s.getDate() - 13);
      setStartDate(fmt(s));
      setEndDate(fmt(today));
    } else if (type === "month") {
      const y = today.getFullYear();
      const m = today.getMonth();
      const first = new Date(y, m, 1);
      const last = new Date(y, m + 1, 0);
      setStartDate(fmt(first));
      setEndDate(fmt(last));
    }
  };

  return (
    <div className="daily-update-container" style={{ padding: "8px 0 32px 0" }}>
      {/* 1. Header Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "16px",
          marginBottom: "20px",
          backgroundColor: "#ffffff",
          padding: "20px 24px",
          borderRadius: "14px",
          boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)",
          border: "1px solid #e2e8f0",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
            <span
              style={{
                backgroundColor: "#0284c7",
                color: "#ffffff",
                fontSize: "11px",
                fontWeight: 800,
                padding: "3px 8px",
                borderRadius: "6px",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
              }}
            >
              Super Admin
            </span>
            <span style={{ color: "#64748b", fontSize: "13px", fontWeight: 600 }}>
              Corporate Daily MIS &amp; Compliance Review
            </span>
          </div>
          <h2 style={{ margin: 0, fontSize: "22px", fontWeight: 800, color: "#0f172a" }}>
            Daily Update &amp; Machine Plan Tracking
          </h2>
          <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#64748b" }}>
            Plant-wise daily production, total machine count, 12h no-plan idle machines, filled count,
            and submission coverage %.
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <button
            onClick={handleExportExcel}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              backgroundColor: "#166534",
              color: "#ffffff",
              border: "none",
              padding: "9px 16px",
              borderRadius: "8px",
              fontWeight: 700,
              fontSize: "13px",
              cursor: "pointer",
              boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
              transition: "all 0.15s ease",
            }}
            title="Download Excel Workbook with all plant tables"
          >
            📥 Download Excel (.xlsx)
          </button>

          <button
            onClick={handleCopyTSV}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              backgroundColor: copyFeedback ? "#059669" : "#0284c7",
              color: "#ffffff",
              border: "none",
              padding: "9px 16px",
              borderRadius: "8px",
              fontWeight: 700,
              fontSize: "13px",
              cursor: "pointer",
              boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
              transition: "all 0.15s ease",
            }}
            title="Copy table data directly to paste into your Excel spreadsheet"
          >
            {copyFeedback ? "✅ Copied to Clipboard!" : "📋 Copy Table for Excel"}
          </button>

          {onRefresh && (
            <button
              onClick={onRefresh}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                backgroundColor: "#f1f5f9",
                color: "#334155",
                border: "1px solid #cbd5e1",
                padding: "9px 14px",
                borderRadius: "8px",
                fontWeight: 700,
                fontSize: "13px",
                cursor: "pointer",
              }}
              title="Refresh entries from cloud"
            >
              🔄 Refresh
            </button>
          )}
        </div>
      </div>

      {/* 2. Top KPI Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "16px",
          marginBottom: "20px",
        }}
      >
        <div
          style={{
            backgroundColor: "#ffffff",
            padding: "16px 20px",
            borderRadius: "12px",
            border: "1px solid #e2e8f0",
            boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.03)",
          }}
        >
          <div style={{ fontSize: "12px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
            Total Production (Period)
          </div>
          <div style={{ fontSize: "24px", fontWeight: 800, color: "#0284c7", marginTop: "4px" }}>
            {kpis.grandProd.toLocaleString("en-IN")} <span style={{ fontSize: "14px", fontWeight: 600 }}>pcs</span>
          </div>
          <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "2px" }}>
            Across {kpis.activePlantCount} manufacturing plants
          </div>
        </div>

        <div
          style={{
            backgroundColor: "#ffffff",
            padding: "16px 20px",
            borderRadius: "12px",
            border: "1px solid #e2e8f0",
            boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.03)",
          }}
        >
          <div style={{ fontSize: "12px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
            Total Monitored Machines
          </div>
          <div style={{ fontSize: "24px", fontWeight: 800, color: "#0f172a", marginTop: "4px" }}>
            {kpis.totalTrackedMc} <span style={{ fontSize: "14px", fontWeight: 600 }}>M/C</span>
          </div>
          <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "2px" }}>
            PGTL (53) · NGM (57) · PGEL (85)
          </div>
        </div>

        <div
          style={{
            backgroundColor: "#ffffff",
            padding: "16px 20px",
            borderRadius: "12px",
            border: "1px solid #e2e8f0",
            boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.03)",
          }}
        >
          <div style={{ fontSize: "12px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
            Overall Submission Coverage
          </div>
          <div
            style={{
              fontSize: "24px",
              fontWeight: 800,
              color: kpis.avgCoverage >= 90 ? "#166534" : kpis.avgCoverage >= 70 ? "#854d0e" : "#b91c1c",
              marginTop: "4px",
            }}
          >
            {kpis.avgCoverage}%
          </div>
          <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "2px" }}>
            Filled vs. scheduled machine shifts
          </div>
        </div>

        <div
          style={{
            backgroundColor: "#ffffff",
            padding: "16px 20px",
            borderRadius: "12px",
            border: "1px solid #e2e8f0",
            boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.03)",
          }}
        >
          <div style={{ fontSize: "12px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
            No-Plan Idle Occurrences
          </div>
          <div style={{ fontSize: "24px", fontWeight: 800, color: "#d97706", marginTop: "4px" }}>
            {kpis.grandNoPlan} <span style={{ fontSize: "14px", fontWeight: 600 }}>shifts</span>
          </div>
          <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "2px" }}>
            12H idle downtime / quick-filled
          </div>
        </div>
      </div>

      {/* 3. Date Range Controls & Presets Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          marginBottom: "20px",
          backgroundColor: "#ffffff",
          padding: "14px 20px",
          borderRadius: "12px",
          border: "1px solid #e2e8f0",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "12px", fontWeight: 800, color: "#475569", textTransform: "uppercase" }}>
            📅 Quick Presets:
          </span>
          <button
            onClick={() => setPresetRange("review")}
            style={{
              padding: "6px 12px",
              borderRadius: "6px",
              border: "1px solid #cbd5e1",
              backgroundColor: startDate === "2026-10-18" && endDate === "2026-10-25" ? "#0284c7" : "#f8fafc",
              color: startDate === "2026-10-18" && endDate === "2026-10-25" ? "#ffffff" : "#334155",
              fontWeight: 700,
              fontSize: "12px",
              cursor: "pointer",
            }}
          >
            ⭐ 18-Oct to 25-Oct (Review Sheet)
          </button>
          <button
            onClick={() => setPresetRange("last7")}
            style={{
              padding: "6px 12px",
              borderRadius: "6px",
              border: "1px solid #cbd5e1",
              backgroundColor: "#f8fafc",
              color: "#334155",
              fontWeight: 700,
              fontSize: "12px",
              cursor: "pointer",
            }}
          >
            Last 7 Days
          </button>
          <button
            onClick={() => setPresetRange("last14")}
            style={{
              padding: "6px 12px",
              borderRadius: "6px",
              border: "1px solid #cbd5e1",
              backgroundColor: "#f8fafc",
              color: "#334155",
              fontWeight: 700,
              fontSize: "12px",
              cursor: "pointer",
            }}
          >
            Last 14 Days
          </button>
          <button
            onClick={() => setPresetRange("month")}
            style={{
              padding: "6px 12px",
              borderRadius: "6px",
              border: "1px solid #cbd5e1",
              backgroundColor: "#f8fafc",
              color: "#334155",
              fontWeight: 700,
              fontSize: "12px",
              cursor: "pointer",
            }}
          >
            Current Month
          </button>
        </div>

        {/* Custom Range Picker */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "12px", fontWeight: 700, color: "#64748b" }}>From:</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{
              padding: "6px 10px",
              borderRadius: "6px",
              border: "1px solid #cbd5e1",
              fontSize: "12px",
              fontWeight: 700,
              color: "#0f172a",
            }}
          />
          <span style={{ fontSize: "12px", fontWeight: 700, color: "#64748b" }}>To:</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={{
              padding: "6px 10px",
              borderRadius: "6px",
              border: "1px solid #cbd5e1",
              fontSize: "12px",
              fontWeight: 700,
              color: "#0f172a",
            }}
          />
        </div>
      </div>

      {/* 4. Plant View Tabs & Layout Mode */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          marginBottom: "16px",
        }}
      >
        <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "4px" }}>
          <button
            onClick={() => setActivePlantTab("ALL")}
            style={{
              padding: "7px 14px",
              borderRadius: "8px",
              border: activePlantTab === "ALL" ? "2px solid #0284c7" : "1px solid #cbd5e1",
              backgroundColor: activePlantTab === "ALL" ? "#e0f2fe" : "#ffffff",
              color: activePlantTab === "ALL" ? "#0369a1" : "#475569",
              fontWeight: 800,
              fontSize: "13px",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            🌐 All Plants
          </button>

          {targetPlants.map((p) => {
            const isSelected = activePlantTab === p.plant_id;
            const pName = getPlantDisplayName(p);
            const totalMc = (plantMachinesMap.get(p.plant_id) || []).length;
            return (
              <button
                key={p.plant_id}
                onClick={() => setActivePlantTab(p.plant_id)}
                style={{
                  padding: "7px 14px",
                  borderRadius: "8px",
                  border: isSelected ? "2px solid #0284c7" : "1px solid #cbd5e1",
                  backgroundColor: isSelected ? "#e0f2fe" : "#ffffff",
                  color: isSelected ? "#0369a1" : "#475569",
                  fontWeight: 700,
                  fontSize: "13px",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {pName} ({totalMc} M/C)
              </button>
            );
          })}
        </div>

        {/* Layout Switcher: Side-by-Side Grid vs Direct Full Width */}
        {activePlantTab === "ALL" && (
          <div
            style={{
              display: "inline-flex",
              backgroundColor: "#f1f5f9",
              padding: "3px",
              borderRadius: "8px",
              border: "1px solid #cbd5e1",
            }}
          >
            <button
              type="button"
              onClick={() => setLayoutMode("grid")}
              style={{
                padding: "5px 12px",
                borderRadius: "6px",
                border: "none",
                backgroundColor: layoutMode === "grid" ? "#ffffff" : "transparent",
                color: layoutMode === "grid" ? "#0284c7" : "#64748b",
                fontWeight: 700,
                fontSize: "12px",
                cursor: "pointer",
                boxShadow: layoutMode === "grid" ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
              }}
            >
              📑 2-Column Grid
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode("stacked")}
              style={{
                padding: "5px 12px",
                borderRadius: "6px",
                border: "none",
                backgroundColor: layoutMode === "stacked" ? "#ffffff" : "transparent",
                color: layoutMode === "stacked" ? "#0284c7" : "#64748b",
                fontWeight: 700,
                fontSize: "12px",
                cursor: "pointer",
                boxShadow: layoutMode === "stacked" ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
              }}
            >
              📋 Full Width (Direct View)
            </button>
          </div>
        )}
      </div>

      {/* 5. Plant Tables Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            activePlantTab !== "ALL" || layoutMode === "stacked"
              ? "1fr"
              : "repeat(auto-fit, minmax(540px, 1fr))",
          gap: "24px",
          alignItems: "start",
        }}
      >
        {targetPlants
          .filter((p) => activePlantTab === "ALL" || activePlantTab === p.plant_id)
          .map((plant) => {
            const pId = plant.plant_id;
            const data = tableMatrix[pId];
            if (!data) return null;
            const pName = getPlantDisplayName(plant);
            const theme = getPlantTheme(pId, plant.name);

            return (
              <div
                key={pId}
                style={{
                  backgroundColor: "#ffffff",
                  borderRadius: "10px",
                  border: "2px solid #0f172a",
                  overflow: "hidden",
                  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
                }}
              >
                {/* Table Title Block matching Screenshot */}
                <div
                  style={{
                    backgroundColor: theme.headerBg,
                    borderBottom: "2px solid #0f172a",
                    padding: "9px 14px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{
                      fontSize: "15px",
                      fontWeight: 900,
                      color: "#0f172a",
                      letterSpacing: "0.02em",
                      textTransform: "uppercase",
                    }}
                  >
                    {pName}
                  </span>
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: 800,
                      backgroundColor: "rgba(0, 0, 0, 0.08)",
                      color: "#0f172a",
                      padding: "2px 8px",
                      borderRadius: "6px",
                    }}
                  >
                    Total: {data.totalMc} M/C
                  </span>
                </div>

                {/* Table: ALL 6 COLUMNS DIRECTLY VISIBLE - ZERO SCROLLBAR */}
                <div style={{ width: "100%", overflow: "hidden" }}>
                  <table
                    className="daily-mis-table"
                    style={{
                      width: "100%",
                      minWidth: 0,
                      maxWidth: "100%",
                      tableLayout: "fixed",
                      borderCollapse: "collapse",
                      fontSize: "12px",
                      textAlign: "center",
                    }}
                  >
                    <colgroup>
                      <col style={{ width: "16%" }} />
                      <col style={{ width: "23%" }} />
                      <col style={{ width: "15%" }} />
                      <col style={{ width: "16%" }} />
                      <col style={{ width: "15%" }} />
                      <col style={{ width: "15%" }} />
                    </colgroup>
                    <thead>
                      <tr
                        style={{
                          backgroundColor: theme.headerBg,
                          borderBottom: "2px solid #0f172a",
                        }}
                      >
                        <th
                          style={{
                            padding: "7px 4px",
                            fontWeight: 800,
                            color: "#0f172a",
                            borderRight: "1px solid #0f172a",
                            fontSize: "12px",
                            whiteSpace: "nowrap",
                          }}
                        >
                          Date
                        </th>
                        <th
                          style={{
                            padding: "7px 4px",
                            fontWeight: 800,
                            color: "#0f172a",
                            borderRight: "1px solid #0f172a",
                            fontSize: "12px",
                            whiteSpace: "nowrap",
                          }}
                        >
                          Total Prod
                        </th>
                        <th
                          style={{
                            padding: "7px 4px",
                            fontWeight: 800,
                            color: "#0f172a",
                            borderRight: "1px solid #0f172a",
                            fontSize: "12px",
                            whiteSpace: "nowrap",
                          }}
                        >
                          Total M/C
                        </th>
                        <th
                          style={{
                            padding: "7px 4px",
                            fontWeight: 800,
                            color: "#0f172a",
                            borderRight: "1px solid #0f172a",
                            fontSize: "12px",
                            whiteSpace: "nowrap",
                          }}
                        >
                          No Plan M/C
                        </th>
                        <th
                          style={{
                            padding: "7px 4px",
                            fontWeight: 800,
                            color: "#0f172a",
                            borderRight: "1px solid #0f172a",
                            fontSize: "12px",
                            whiteSpace: "nowrap",
                          }}
                        >
                          Filled M/C
                        </th>
                        <th
                          style={{
                            padding: "7px 4px",
                            fontWeight: 800,
                            color: "#0f172a",
                            fontSize: "12px",
                            whiteSpace: "nowrap",
                          }}
                        >
                          Filled %
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {dateList.map((d) => {
                        const row = data.dates[d] || {
                          shortDate: formatShortDate(d),
                          totalProd: 0,
                          totalMc: data.totalMc,
                          noPlanMcCount: 0,
                          filledMcCount: 0,
                          pendingMcCount: data.totalMc,
                          filledPct: 0,
                          filledList: [],
                          noPlanList: [],
                          pendingList: [],
                        };

                        // Cell color for Filled % matching Excel screenshot
                        let pctBg = "transparent";
                        let pctColor = "#0f172a";
                        if (row.filledMcCount > 0) {
                          if (row.filledPct === 100) {
                            pctBg = "#DCFCE7"; // Light green
                            pctColor = "#166534";
                          } else if (row.filledPct >= 70) {
                            pctBg = "#FEF9C3"; // Light yellow / amber (like 84%, 69%)
                            pctColor = "#854D0E";
                          } else {
                            pctBg = "#FEE2E2"; // Soft red / pink (like 47%)
                            pctColor = "#991B1B";
                          }
                        }

                        const isClickable = row.filledMcCount > 0 || row.pendingMcCount > 0;

                        return (
                          <tr
                            key={d}
                            style={{
                              borderBottom: "1px solid #cbd5e1",
                              transition: "background-color 0.15s ease",
                              cursor: isClickable ? "pointer" : "default",
                            }}
                            onClick={() => {
                              if (isClickable) {
                                setDrillModalData({
                                  plant,
                                  plantName: pName,
                                  date: d,
                                  shortDate: row.shortDate,
                                  ...row,
                                });
                                setDrillTab("filled");
                              }
                            }}
                            title="Click row to inspect machine-level breakdown"
                          >
                            <td
                              style={{
                                padding: "7px 4px",
                                fontWeight: 600,
                                color: "#0f172a",
                                borderRight: "1px solid #cbd5e1",
                                backgroundColor: "#ffffff",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {row.shortDate}
                            </td>
                            <td
                              style={{
                                padding: "7px 6px",
                                fontWeight: 700,
                                color: row.totalProd > 0 ? "#0284c7" : "#64748b",
                                borderRight: "1px solid #cbd5e1",
                                textAlign: "right",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {row.totalProd > 0 ? row.totalProd.toLocaleString("en-IN") : ""}
                            </td>
                            <td
                              style={{
                                padding: "7px 4px",
                                fontWeight: 600,
                                color: "#0f172a",
                                borderRight: "1px solid #cbd5e1",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {row.totalMc}
                            </td>
                            <td
                              style={{
                                padding: "7px 4px",
                                fontWeight: 700,
                                color: row.noPlanMcCount > 0 ? "#d97706" : "#94a3b8",
                                borderRight: "1px solid #cbd5e1",
                                backgroundColor: row.noPlanMcCount > 0 ? "#fffbeb" : "transparent",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {row.noPlanMcCount > 0 ? row.noPlanMcCount : ""}
                            </td>
                            <td
                              style={{
                                padding: "7px 4px",
                                fontWeight: 700,
                                color: "#0f172a",
                                borderRight: "1px solid #cbd5e1",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {row.filledMcCount > 0 ? row.filledMcCount : ""}
                            </td>
                            <td
                              style={{
                                padding: "7px 4px",
                                fontWeight: 800,
                                backgroundColor: pctBg,
                                color: pctColor,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {row.filledMcCount > 0 ? `${row.filledPct}%` : ""}
                            </td>
                          </tr>
                        );
                      })}

                      {/* Total / Summary Row */}
                      <tr
                        style={{
                          backgroundColor: "#f8fafc",
                          borderTop: "2px solid #0f172a",
                          fontWeight: 800,
                        }}
                      >
                        <td
                          style={{
                            padding: "7px 4px",
                            color: "#0f172a",
                            borderRight: "1px solid #0f172a",
                            whiteSpace: "nowrap",
                          }}
                        >
                          Total
                        </td>
                        <td
                          style={{
                            padding: "7px 6px",
                            color: "#0284c7",
                            borderRight: "1px solid #0f172a",
                            textAlign: "right",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {data.totals.totalProd > 0 ? data.totals.totalProd.toLocaleString("en-IN") : "0"}
                        </td>
                        <td
                          style={{
                            padding: "7px 4px",
                            color: "#0f172a",
                            borderRight: "1px solid #0f172a",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {data.totalMc}
                        </td>
                        <td
                          style={{
                            padding: "7px 4px",
                            color: "#d97706",
                            borderRight: "1px solid #0f172a",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {data.totals.noPlanOccurrences}
                        </td>
                        <td
                          style={{
                            padding: "7px 4px",
                            color: "#0f172a",
                            borderRight: "1px solid #0f172a",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {data.totals.filledShifts}
                        </td>
                        <td style={{ padding: "7px 4px", color: "#64748b", whiteSpace: "nowrap" }}>-</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
      </div>

      {/* 6. Drill-down Machine Status Modal */}
      {drillModalData && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 99999,
            padding: "16px",
          }}
          onClick={() => setDrillModalData(null)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "800px",
              maxHeight: "85vh",
              backgroundColor: "#ffffff",
              borderRadius: "14px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              border: "1px solid #cbd5e1",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                backgroundColor: "#f8fafc",
              }}
            >
              <div>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "#64748b" }}>
                  {drillModalData.plantName} · {drillModalData.shortDate} ({drillModalData.date})
                </div>
                <h3 style={{ margin: "2px 0 0 0", fontSize: "18px", fontWeight: 800, color: "#0f172a" }}>
                  Machine Status &amp; Compliance Breakdown
                </h3>
              </div>
              <button
                onClick={() => setDrillModalData(null)}
                style={{
                  border: "none",
                  backgroundColor: "transparent",
                  fontSize: "20px",
                  fontWeight: 700,
                  color: "#64748b",
                  cursor: "pointer",
                  padding: "4px 8px",
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Filter Tabs */}
            <div
              style={{
                display: "flex",
                gap: "8px",
                padding: "12px 20px",
                borderBottom: "1px solid #e2e8f0",
                backgroundColor: "#ffffff",
              }}
            >
              <button
                onClick={() => setDrillTab("filled")}
                style={{
                  padding: "6px 14px",
                  borderRadius: "6px",
                  border: drillTab === "filled" ? "2px solid #0284c7" : "1px solid #cbd5e1",
                  backgroundColor: drillTab === "filled" ? "#e0f2fe" : "#ffffff",
                  color: drillTab === "filled" ? "#0369a1" : "#475569",
                  fontWeight: 700,
                  fontSize: "12px",
                  cursor: "pointer",
                }}
              >
                ✅ Filled Machines ({drillModalData.filledMcCount})
              </button>

              <button
                onClick={() => setDrillTab("no_plan")}
                style={{
                  padding: "6px 14px",
                  borderRadius: "6px",
                  border: drillTab === "no_plan" ? "2px solid #d97706" : "1px solid #cbd5e1",
                  backgroundColor: drillTab === "no_plan" ? "#fef3c7" : "#ffffff",
                  color: drillTab === "no_plan" ? "#92400e" : "#475569",
                  fontWeight: 700,
                  fontSize: "12px",
                  cursor: "pointer",
                }}
              >
                ⏸️ No Plan Machines ({drillModalData.noPlanMcCount})
              </button>

              <button
                onClick={() => setDrillTab("pending")}
                style={{
                  padding: "6px 14px",
                  borderRadius: "6px",
                  border: drillTab === "pending" ? "2px solid #b91c1c" : "1px solid #cbd5e1",
                  backgroundColor: drillTab === "pending" ? "#fee2e2" : "#ffffff",
                  color: drillTab === "pending" ? "#991b1b" : "#475569",
                  fontWeight: 700,
                  fontSize: "12px",
                  cursor: "pointer",
                }}
              >
                ⏳ Pending / Unfilled ({drillModalData.pendingMcCount})
              </button>
            </div>

            {/* Modal Body / Table */}
            <div style={{ padding: "16px 20px", overflowY: "auto", flex: 1 }}>
              {drillTab === "filled" && (
                <div>
                  {drillModalData.filledList.length === 0 ? (
                    <p style={{ color: "#64748b", fontSize: "13px" }}>No machines logged on this date.</p>
                  ) : (
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                      <thead>
                        <tr style={{ backgroundColor: "#f1f5f9", textAlign: "left", color: "#475569" }}>
                          <th style={{ padding: "8px", borderBottom: "1px solid #cbd5e1" }}>Machine</th>
                          <th style={{ padding: "8px", borderBottom: "1px solid #cbd5e1" }}>Tonnage</th>
                          <th style={{ padding: "8px", borderBottom: "1px solid #cbd5e1" }}>SAP Code</th>
                          <th style={{ padding: "8px", borderBottom: "1px solid #cbd5e1" }}>Description</th>
                          <th style={{ padding: "8px", borderBottom: "1px solid #cbd5e1", textAlign: "right" }}>
                            OK Prod
                          </th>
                          <th style={{ padding: "8px", borderBottom: "1px solid #cbd5e1" }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {drillModalData.filledList.map((m) => (
                          <tr key={m.machine_id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                            <td style={{ padding: "8px", fontWeight: 700, color: "#0f172a" }}>
                              {m.machine_name}
                            </td>
                            <td style={{ padding: "8px", color: "#64748b" }}>{m.tonnage}T</td>
                            <td style={{ padding: "8px", fontWeight: 600 }}>{m.sap_code}</td>
                            <td style={{ padding: "8px", color: "#334155" }}>{m.material_description}</td>
                            <td
                              style={{
                                padding: "8px",
                                textAlign: "right",
                                fontWeight: 700,
                                color: m.prod > 0 ? "#0284c7" : "#64748b",
                              }}
                            >
                              {m.prod.toLocaleString("en-IN")}
                            </td>
                            <td style={{ padding: "8px" }}>
                              {m.isNoPlan ? (
                                <span
                                  style={{
                                    backgroundColor: "#fef3c7",
                                    color: "#92400e",
                                    padding: "2px 6px",
                                    borderRadius: "4px",
                                    fontSize: "11px",
                                    fontWeight: 700,
                                  }}
                                >
                                  NO PLAN (12h)
                                </span>
                              ) : (
                                <span
                                  style={{
                                    backgroundColor: "#dcfce7",
                                    color: "#166534",
                                    padding: "2px 6px",
                                    borderRadius: "4px",
                                    fontSize: "11px",
                                    fontWeight: 700,
                                  }}
                                >
                                  RUNNING
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {drillTab === "no_plan" && (
                <div>
                  {drillModalData.noPlanList.length === 0 ? (
                    <p style={{ color: "#64748b", fontSize: "13px" }}>
                      No machines were under No-Plan downtime on this date.
                    </p>
                  ) : (
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                      <thead>
                        <tr style={{ backgroundColor: "#fef3c7", textAlign: "left", color: "#92400e" }}>
                          <th style={{ padding: "8px", borderBottom: "1px solid #fde68a" }}>Machine</th>
                          <th style={{ padding: "8px", borderBottom: "1px solid #fde68a" }}>Tonnage</th>
                          <th style={{ padding: "8px", borderBottom: "1px solid #fde68a" }}>Reason Code</th>
                          <th style={{ padding: "8px", borderBottom: "1px solid #fde68a" }}>Remark / Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {drillModalData.noPlanList.map((m) => (
                          <tr key={m.machine_id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                            <td style={{ padding: "8px", fontWeight: 700, color: "#0f172a" }}>
                              {m.machine_name}
                            </td>
                            <td style={{ padding: "8px", color: "#64748b" }}>{m.tonnage}T</td>
                            <td style={{ padding: "8px", fontWeight: 700, color: "#d97706" }}>
                              PDT - NO PLAN (720 min)
                            </td>
                            <td style={{ padding: "8px", color: "#334155" }}>
                              {m.material_description || "Full shift idle / Quick-filled No Plan"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {drillTab === "pending" && (
                <div>
                  {drillModalData.pendingList.length === 0 ? (
                    <p style={{ color: "#166534", fontSize: "13px", fontWeight: 700 }}>
                      🎉 100% Submission! All machines are filled for this date.
                    </p>
                  ) : (
                    <div>
                      <p style={{ color: "#991b1b", fontSize: "12px", fontWeight: 600, margin: "0 0 10px 0" }}>
                        ⚠️ The following {drillModalData.pendingList.length} machines have NOT submitted any
                        entry for this date:
                      </p>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                          gap: "8px",
                        }}
                      >
                        {drillModalData.pendingList.map((m) => (
                          <div
                            key={m.machine_id}
                            style={{
                              padding: "8px 12px",
                              backgroundColor: "#fff1f2",
                              border: "1px solid #fecdd3",
                              borderRadius: "6px",
                              fontSize: "12px",
                            }}
                          >
                            <div style={{ fontWeight: 800, color: "#9f1239" }}>{m.machine_name}</div>
                            <div style={{ fontSize: "11px", color: "#be123c" }}>
                              Tonnage: {m.tonnage}T · {m.location}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
