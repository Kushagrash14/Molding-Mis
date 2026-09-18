import * as XLSX from "xlsx";
import { computeMetrics, pct } from "./calculations.js";

/**
 * Enterprise multi-sheet Excel (.xlsx) generator for PG Electroplast
 */
export function exportProductionToExcel({
  entries = [],
  master = [],
  machines = [],
  plants = [],
  locations = [],
  reasonCodes = [],
  filterInfo = "All Records",
  viewerRole = "admin",
}) {
  if (entries.length === 0) {
    alert("No records available to export.");
    return false;
  }

  const wb = XLSX.utils.book_new();

  // =========================================================================
  // SHEET 1: PRODUCTION REGISTER
  // =========================================================================
  const sheet1Data = [
    // Header Banner
    ["PG ELECTROPLAST LIMITED - SHOP FLOOR PRODUCTION & OEE REGISTER"],
    [`Generated: ${new Date().toLocaleString("en-IN")} | Scope: ${filterInfo} | Total Records: ${entries.length}`],
    [], // Empty row separator
    // Column Headers
    [
      "Entry ID",
      "Plant Name",
      "Location Hub",
      "Shift Date",
      "Shift",
      "Machine ID",
      "Machine No",
      "SAP Code",
      "Material Description",
      "Running Cavity",
      "Run Hours (Hrs)",
      "Target Qty (Pcs)",
      "OK Production (Pcs)",
      "Total Rejection (Pcs)",
      "Total Produced (Pcs)",
      "Planned DT (Mins)",
      "Unplanned DT (Mins)",
      "Availability (%)",
      "Performance (%)",
      "Quality Rate (%)",
      "Overall OEE (%)",
      "Part Price (₹)",
      "OK Value (₹)",
      "Rejection Loss (₹)",
      "Shortfall Loss (₹)",
      "Raw Mat Consumed (Kg)",
      "Tool Change (Pcs)",
      "Manpower (Alloc/Std)",
      "Status",
      "Entered By",
      "Submission Timestamp",
    ],
  ];

  let sumTgt = 0;
  let sumOk = 0;
  let sumRej = 0;
  let sumPdtMin = 0;
  let sumUdtMin = 0;
  let sumOkVal = 0;
  let sumRejVal = 0;
  let sumShortfall = 0;
  let sumMatKg = 0;
  let sumOee = 0;

  entries.forEach((e) => {
    const m = master.find((x) => x.sap_code === e.sap_code);
    const metrics = computeMetrics(e, m, reasonCodes);
    const mcObj = machines.find((x) => x.machine_id === e.machine_id) || {};
    const plantObj = plants.find((p) => p.plant_id === e.plant_id) || {};
    const locObj = locations.find((l) => l.location_id === plantObj.location_id) || {};

    const pdtMins = Math.round(metrics.planned_dt * 60);
    const udtMins = Math.round(metrics.unplanned_dt * 60);
    const totalProd = e.ok_prod + metrics.total_rej;
    const availPct = Number((metrics.availability * 100).toFixed(1));
    const prodPct = Number((metrics.productivity * 100).toFixed(1));
    const qualPct = Number((metrics.quality_rate * 100).toFixed(1));
    const oeePct = Number((metrics.oee * 100).toFixed(1));

    sumTgt += metrics.tgt;
    sumOk += e.ok_prod;
    sumRej += metrics.total_rej;
    sumPdtMin += pdtMins;
    sumUdtMin += udtMins;
    sumOkVal += metrics.ok_prod_price;
    sumRejVal += metrics.rej_price;
    sumShortfall += metrics.shortfall_loss;
    sumMatKg += metrics.total_consumption;
    sumOee += metrics.oee;

    sheet1Data.push([
      e.entry_id,
      plantObj.name || e.plant_id || "Unit-02",
      locObj.name || "Greater Noida",
      e.shift_date,
      `Shift ${e.shift_id}`,
      e.machine_id,
      mcObj.machine_no || e.machine_id,
      e.sap_code,
      m ? m.material_description : "—",
      Number(e.running_cavity) || 0,
      Number(e.run_hour) || 0,
      viewerRole === "operator" ? "—" : metrics.tgt,
      Number(e.ok_prod) || 0,
      metrics.total_rej,
      totalProd,
      pdtMins,
      udtMins,
      availPct,
      prodPct,
      qualPct,
      oeePct,
      m ? m.price : 0,
      Math.round(metrics.ok_prod_price),
      Math.round(metrics.rej_price),
      viewerRole === "operator" ? "—" : Math.round(metrics.shortfall_loss),
      Number(metrics.total_consumption.toFixed(2)),
      metrics.tool_change_count,
      `${e.hr_mp_declare || 0} / ${m ? m.manpower : 0}`,
      e.status.toUpperCase(),
      e.entered_by_name || e.entered_by,
      e.created_at ? new Date(e.created_at).toLocaleString("en-IN") : "—",
    ]);
  });

  // Summary row at bottom of Sheet 1
  const avgOeePct = entries.length > 0 ? Number(((sumOee / entries.length) * 100).toFixed(1)) : 0;
  sheet1Data.push([
    "TOTAL / SUMMARY",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    viewerRole === "operator" ? "—" : sumTgt,
    sumOk,
    sumRej,
    sumOk + sumRej,
    sumPdtMin,
    sumUdtMin,
    "",
    "",
    "",
    avgOeePct,
    "",
    sumOkVal,
    sumRejVal,
    viewerRole === "operator" ? "—" : sumShortfall,
    Number(sumMatKg.toFixed(2)),
    "",
    "",
    "",
    "",
    "",
  ]);

  const ws1 = XLSX.utils.aoa_to_sheet(sheet1Data);

  // Column width calculations so Excel never displays ### or clips
  ws1["!cols"] = [
    { wch: 18 }, // Entry ID
    { wch: 14 }, // Plant
    { wch: 16 }, // Location
    { wch: 12 }, // Date
    { wch: 10 }, // Shift
    { wch: 12 }, // Machine ID
    { wch: 15 }, // Machine No
    { wch: 14 }, // SAP Code
    { wch: 30 }, // Material Description
    { wch: 14 }, // Cavity
    { wch: 14 }, // Run Hours
    { wch: 16 }, // Target Qty
    { wch: 18 }, // OK Prod
    { wch: 18 }, // Total Rej
    { wch: 18 }, // Total Prod
    { wch: 16 }, // Planned DT
    { wch: 18 }, // Unplanned DT
    { wch: 16 }, // Availability %
    { wch: 16 }, // Performance %
    { wch: 16 }, // Quality %
    { wch: 16 }, // OEE %
    { wch: 14 }, // Price
    { wch: 18 }, // OK Value
    { wch: 18 }, // Rej Loss
    { wch: 18 }, // Shortfall Loss
    { wch: 20 }, // Mat Consumed
    { wch: 16 }, // Tool Change
    { wch: 18 }, // Manpower
    { wch: 12 }, // Status
    { wch: 20 }, // Entered By
    { wch: 22 }, // Created At
  ];

  XLSX.utils.book_append_sheet(wb, ws1, "Production Register");

  // =========================================================================
  // SHEET 2: REJECTIONS & DOWNTIME BREAKDOWN
  // =========================================================================
  const sheet2Data = [
    ["PG ELECTROPLAST LIMITED - REJECTIONS & DOWNTIME EVENT LOG"],
    [`Generated: ${new Date().toLocaleString("en-IN")} | Detailed breakdown of shift losses`],
    [],
    [
      "Entry ID",
      "Plant Name",
      "Shift Date",
      "Shift",
      "Machine",
      "SAP Code",
      "Loss Classification",
      "Reason Code",
      "Reason Description",
      "Recorded Value",
      "Unit",
      "Estimated Cost Loss (₹)",
    ],
  ];

  let hasReasons = false;
  entries.forEach((e) => {
    const m = master.find((x) => x.sap_code === e.sap_code);
    const mcObj = machines.find((x) => x.machine_id === e.machine_id) || {};
    const plantObj = plants.find((p) => p.plant_id === e.plant_id) || {};
    const price = m ? m.price : 0;

    (e.reasons || []).forEach((r) => {
      if (!r.value || Number(r.value) <= 0) return;
      hasReasons = true;
      const rObj = reasonCodes.find((rc) => rc.reason_id === r.reason_id) || {};
      const catLabel =
        rObj.category === "rejection"
          ? "🔴 Rejection Defect"
          : rObj.category === "planned_dt"
          ? "🔵 Planned Downtime"
          : "🟠 Unplanned Downtime";
      
      const unit = rObj.unit === "qty" ? "Pieces" : "Minutes";
      const costLoss = rObj.category === "rejection" ? Math.round(Number(r.value) * price) : "—";

      sheet2Data.push([
        e.entry_id,
        plantObj.name || e.plant_id || "Unit-02",
        e.shift_date,
        `Shift ${e.shift_id}`,
        mcObj.machine_no || e.machine_id,
        e.sap_code,
        catLabel,
        r.reason_id,
        r.remark ? `${rObj.name || r.reason_id} — "${r.remark}"` : (rObj.name || r.reason_id),
        Number(r.value),
        unit,
        costLoss,
      ]);
    });
  });

  if (!hasReasons) {
    sheet2Data.push(["No downtime or rejection events recorded in selected entries."]);
  }

  const ws2 = XLSX.utils.aoa_to_sheet(sheet2Data);
  ws2["!cols"] = [
    { wch: 18 },
    { wch: 14 },
    { wch: 12 },
    { wch: 10 },
    { wch: 16 },
    { wch: 14 },
    { wch: 24 },
    { wch: 18 },
    { wch: 24 },
    { wch: 16 },
    { wch: 12 },
    { wch: 22 },
  ];
  XLSX.utils.book_append_sheet(wb, ws2, "Downtimes & Rejections");

  // =========================================================================
  // SHEET 3: EXECUTIVE KPI ROLLUP
  // =========================================================================
  const totalProduced = sumOk + sumRej;
  const overallQuality = totalProduced > 0 ? Number(((sumOk / totalProduced) * 100).toFixed(2)) : 0;
  const overallRejectionRate = totalProduced > 0 ? Number(((sumRej / totalProduced) * 100).toFixed(2)) : 0;
  const overallPerformance = sumTgt > 0 ? Number(((totalProduced / sumTgt) * 100).toFixed(2)) : 0;

  const sheet3Data = [
    ["PG ELECTROPLAST LIMITED - SHOP FLOOR EXECUTIVE KPI ROLLUP"],
    [`Generated: ${new Date().toLocaleString("en-IN")}`],
    [],
    ["METRIC / KPI INDICATOR", "CONSOLIDATED VALUE", "UNIT / BENCHMARK"],
    ["Total Shift Entries Logged", entries.length, "Batches / Shifts"],
    ["Total Target Quantity (TGT)", sumTgt, "Pieces"],
    ["Total OK Production Accepted", sumOk, "Pieces"],
    ["Total Rejection Quantity", sumRej, "Pieces"],
    ["Total Defect / Rejection Rate", `${overallRejectionRate}%`, "< 2.0% World Class"],
    ["Consolidated Quality Rate", `${overallQuality}%`, "> 98.0% World Class"],
    ["Consolidated Performance Rate", `${overallPerformance}%`, "> 95.0% Benchmark"],
    ["Average Overall OEE", `${avgOeePct}%`, "> 85.0% World Class"],
    ["Total Planned Downtime (PDT)", `${sumPdtMin} mins (${(sumPdtMin / 60).toFixed(1)} hrs)`, "Preventive / Meal / Setup"],
    ["Total Unplanned Downtime (UDT)", `${sumUdtMin} mins (${(sumUdtMin / 60).toFixed(1)} hrs)`, "Breakdowns / Starvation"],
    ["Net Production Value Realized", `₹${sumOkVal.toLocaleString("en-IN")}`, "Finished Goods Valuation"],
    ["Rejection Scrap Cost Loss", `₹${sumRejVal.toLocaleString("en-IN")}`, "Direct Material Loss"],
    ["Target Shortfall Financial Loss", `₹${sumShortfall.toLocaleString("en-IN")}`, "Opportunity Loss vs TGT"],
    ["Total Raw Material Consumed", `${sumMatKg.toFixed(2)} Kg`, "Net Plastic Granules Consumed"],
  ];

  const ws3 = XLSX.utils.aoa_to_sheet(sheet3Data);
  ws3["!cols"] = [
    { wch: 36 },
    { wch: 28 },
    { wch: 28 },
  ];
  XLSX.utils.book_append_sheet(wb, ws3, "Executive KPI Rollup");

  // Trigger browser download of genuine .xlsx binary file
  const dateTag = new Date().toISOString().slice(0, 10);
  const cleanFilterTag = filterInfo.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 20);
  const fileName = `PGEL_OEE_Register_${dateTag}_${cleanFilterTag}.xlsx`;

  XLSX.writeFile(wb, fileName);
  return true;
}

/**
 * Standard CSV export utility using Blob URL (handles large files safely)
 */
export function exportProductionToCSV({
  entries = [],
  master = [],
  machines = [],
  plants = [],
  reasonCodes = [],
  viewerRole = "admin",
}) {
  if (entries.length === 0) {
    alert("No records available to export.");
    return false;
  }

  const headers = [
    "Entry ID",
    "Plant",
    "Date",
    "Shift",
    "Machine",
    "SAP Code",
    "TGT",
    "OK Prod",
    "Total Rej",
    "Availability",
    "Performance",
    "Quality Rate",
    "OEE",
    "OK Prod Value (INR)",
    "Shortfall Loss (INR)",
    "Status",
    "Entered By",
  ];

  const rows = entries.map((e) => {
    const m = master.find((x) => x.sap_code === e.sap_code);
    const res = computeMetrics(e, m, reasonCodes);
    const mc =
      (machines.find((x) => x.machine_id === e.machine_id) || {}).machine_no || e.machine_id;
    const pObj = plants.find((p) => p.plant_id === e.plant_id);
    const plantName = pObj ? pObj.name : e.plant_id || "Unit-02";

    return [
      `"${e.entry_id}"`,
      `"${plantName}"`,
      `"${e.shift_date}"`,
      `"${e.shift_id}"`,
      `"${mc}"`,
      `"${e.sap_code}"`,
      viewerRole === "operator" ? '"—"' : res.tgt,
      e.ok_prod,
      res.total_rej,
      `"${pct(res.availability)}"`,
      `"${pct(res.productivity)}"`,
      `"${pct(res.quality_rate)}"`,
      `"${pct(res.oee)}"`,
      Math.round(res.ok_prod_price),
      viewerRole === "operator" ? '"—"' : Math.round(res.shortfall_loss),
      `"${e.status}"`,
      `"${e.entered_by_name || e.entered_by}"`,
    ];
  });

  const csvText = [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
  const blob = new Blob(["\uFEFF" + csvText], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute(
    "download",
    `PGEL_OEE_Export_${new Date().toISOString().slice(0, 10)}.csv`
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return true;
}
