import { computeMetrics, findProduct } from "../src/lib/calculations.js";
import { familyInPlant } from "../src/data/familyMolds.js";

const SLOW_LIMIT = 70;

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

function round(n, d = 0) {
  if (n === null || n === undefined || !isFinite(n)) return null;
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

function fmt(n, d = 0) {
  const v = round(n, d);
  return v === null ? "—" : v.toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function getIstDateStr(offsetDays = 0) {
  const d = new Date();
  if (offsetDays !== 0) d.setDate(d.getDate() + offsetDays);
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

export function getIstMonthStr() {
  return getIstDateStr(0).slice(0, 7);
}

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

export function statusFor(pct, threshold = 110) {
  if (pct === null) return { key: "na", label: "Not in master", color: "#64748b", bg: "#f1f5f9", badgeColor: "#475569" };
  if (pct >= threshold) return { key: "over", label: "CT wrong · faster", color: "#b91c1c", bg: "#fee2e2", badgeColor: "#dc2626" };
  if (pct < SLOW_LIMIT) return { key: "slow", label: "Running slow", color: "#b45309", bg: "#fef3c7", badgeColor: "#d97706" };
  return { key: "ok", label: "OK", color: "#15803d", bg: "#dcfce7", badgeColor: "#16a34a" };
}

/**
 * Filter entries based on period option
 */
export function filterEntriesByPeriod(entries, period = "yesterday", customDate = null) {
  if (!Array.isArray(entries)) return [];
  const today = getIstDateStr(0);
  const yesterday = getIstDateStr(-1);
  const currentMonth = getIstMonthStr();

  if (customDate) {
    return entries.filter((e) => e.shift_date === customDate);
  }

  if (period === "today") {
    const list = entries.filter((e) => e.shift_date === today);
    if (list.length > 0) return list;
  }

  if (period === "yesterday") {
    const list = entries.filter((e) => e.shift_date === yesterday);
    // If no entries for yesterday (e.g. testing or holiday), fallback to latest date available
    if (list.length > 0) return list;
    const sorted = [...entries].filter((e) => e.shift_date).sort((a, b) => (b.shift_date > a.shift_date ? 1 : -1));
    if (sorted.length > 0) {
      const latestDate = sorted[0].shift_date;
      return entries.filter((e) => e.shift_date === latestDate);
    }
    return [];
  }

  if (period === "mtd") {
    const list = entries.filter((e) => e.shift_date && e.shift_date.startsWith(currentMonth));
    if (list.length > 0) return list;
    // Fallback if current month has no data yet
    const sorted = [...entries].filter((e) => e.shift_date).sort((a, b) => (b.shift_date > a.shift_date ? 1 : -1));
    if (sorted.length > 0) {
      const latestMonth = sorted[0].shift_date.slice(0, 7);
      return entries.filter((e) => e.shift_date && e.shift_date.startsWith(latestMonth));
    }
    return [];
  }

  if (period === "last7days") {
    const d7 = getIstDateStr(-7);
    return entries.filter((e) => e.shift_date && e.shift_date >= d7 && e.shift_date <= today);
  }

  return entries;
}

/**
 * Compute cycle time data for a specific plant
 */
export function computePlantCycleTime(entries, master, reasonCodes, plantId, options = {}) {
  const threshold = Number(options.threshold) || 110;
  const minHours = options.minHours !== undefined ? Number(options.minHours) : 2;
  const period = options.period || "yesterday";
  const customDate = options.date || null;

  const relevantEntries = filterEntriesByPeriod(entries, period, customDate);

  const bySap = new Map();
  const dates = new Set();

  relevantEntries.forEach((entry) => {
    const ePlant = String(entry.plant_id || "1040");
    if (plantId && plantId !== "all" && ePlant !== String(plantId)) return;
    if (entry.shift_date) dates.add(entry.shift_date);

    runsOf(entry).forEach((run) => {
      const sap = run.sap_code;
      if (!sap || sap === "DOWN_12H" || sap.startsWith("MULTI")) return;
      const m = computeMetrics(run, master, reasonCodes);
      const hrs = Number(m.net_run_time) || 0;
      const tgtHrs = Number(m.available_hours) || 0;
      const ok = Number(m.ok_prod) || 0;
      const rej = Number(m.total_rej) || 0;
      const produced = ok + rej;
      if (hrs <= 0 || tgtHrs <= 0 || produced <= 0) return;

      const runPlant = String(run.plant_id || entry.plant_id || "1040");
      const key = `${runPlant}_${sap}`;

      if (!bySap.has(key)) {
        const product = findProduct(master, sap, runPlant);
        const family = familyInPlant(master, sap, runPlant);
        bySap.set(key, {
          key,
          sap,
          plantId: runPlant,
          partNo: product?.part_no || run.part_no || "",
          description: product?.material_description || run.material_description || "",
          cavity: family ? family.pieceFactor : Number(product?.cavity) || Number(run.std_cavity) || 1,
          combo: family?.combo || "",
          shots: Number(product?.shots_per_hour) || 0,
          hrs: 0,
          tgtHrs: 0,
          target: 0,
          produced: 0,
          machines: new Set(),
          runs: [],
        });
      }

      const rec = bySap.get(key);
      const target = Number(m.tgt) || 0;
      const rate = produced / tgtHrs;
      const pct = rec.shots > 0 && target > 0 ? (produced / target) * 100 : null;
      const shotRate = pct !== null ? (rec.shots * pct) / 100 : rate / (rec.cavity || 1);

      rec.hrs += hrs;
      rec.tgtHrs += tgtHrs;
      rec.target += target;
      rec.produced += produced;
      rec.machines.add(entry.machine_id);
      rec.runs.push({
        id: `${entry.id || entry.shift_date}_${entry.machine_id}_${rec.runs.length}`,
        date: entry.shift_date,
        shift: entry.shift_id,
        machine: entry.machine_id,
        hrs,
        tgtHrs,
        ok,
        rej,
        produced,
        target,
        rate,
        shotRate,
        pct,
      });
    });
  });

  const parts = [...bySap.values()].map((rec) => {
    const actual = rec.tgtHrs > 0 ? rec.produced / rec.tgtHrs : 0;
    const pct = rec.shots > 0 && rec.target > 0 ? (rec.produced / rec.target) * 100 : null;
    const actualShots = pct !== null ? (rec.shots * pct) / 100 : actual / (rec.cavity || 1);
    const declaredCt = rec.shots > 0 ? 3600 / rec.shots : null;
    const actualCt = actualShots > 0 ? 3600 / actualShots : null;
    const diffCt = declaredCt && actualCt ? actualCt - declaredCt : null;
    const diffPct = pct !== null ? pct - 100 : null;
    const st = statusFor(pct, threshold);

    return {
      ...rec,
      machines: [...rec.machines],
      actual,
      actualShots,
      pct,
      declaredCt,
      actualCt,
      diffCt,
      diffPct,
      status: st,
      overRuns: rec.runs.filter((r) => r.pct !== null && r.pct >= threshold).length,
    };
  });

  const eligibleParts = parts.filter((p) => p.hrs >= minHours);
  const overParts = eligibleParts.filter((p) => p.status.key === "over").sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0));
  const slowParts = eligibleParts.filter((p) => p.status.key === "slow").sort((a, b) => (a.pct ?? 0) - (b.pct ?? 0));
  const okParts = eligibleParts.filter((p) => p.status.key === "ok");
  const worstPart = overParts[0] || null;
  const totalOverShifts = eligibleParts.reduce((s, p) => s + p.overRuns, 0);

  const sortedDates = [...dates].sort();
  const dateRangeLabel =
    sortedDates.length === 0
      ? "No records"
      : sortedDates.length === 1
      ? sortedDates[0]
      : `${sortedDates[0]} to ${sortedDates[sortedDates.length - 1]}`;

  return {
    plantId,
    dateRangeLabel,
    totalRecords: relevantEntries.length,
    kpis: {
      analysed: eligibleParts.length,
      over: overParts.length,
      slow: slowParts.length,
      ok: okParts.length,
      worst: worstPart,
      overShifts: totalOverShifts,
    },
    parts: eligibleParts.sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1)),
    overParts,
    slowParts,
  };
}

/**
 * Generate a standalone high-resolution SVG visual snapshot card ("Photo")
 */
export function generatePlantSvgCard(plantReport, { plantName = "", periodLabel = "" } = {}) {
  const width = 1000;
  const kpis = plantReport?.kpis || { analysed: 0, over: 0, slow: 0, overShifts: 0 };
  const parts = (plantReport?.parts || []).slice(0, 12); // Show top 12 relevant parts on image card

  const rowHeight = 40;
  const tableTop = 270;
  const tableHeight = 44 + (parts.length > 0 ? parts.length * rowHeight : 50);
  const totalHeight = Math.max(480, tableTop + tableHeight + 60);

  // Rows generator
  let rowsSvg = "";
  if (parts.length === 0) {
    rowsSvg = `
      <rect x="30" y="${tableTop + 44}" width="940" height="50" fill="#ffffff" />
      <text x="500" y="${tableTop + 75}" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif" font-size="14" fill="#64748b" font-weight="500">
        No active molds met the criteria (${plantReport.dateRangeLabel})
      </text>
    `;
  } else {
    parts.forEach((p, idx) => {
      const y = tableTop + 44 + idx * rowHeight;
      const bg = idx % 2 === 0 ? "#ffffff" : "#f8fafc";
      const statusBg = p.status?.bg || "#f1f5f9";
      const statusColor = p.status?.color || "#475569";
      const statusText = p.status?.label || "OK";

      const partDisplay = esc((p.partNo || p.sap).slice(0, 26));
      const descDisplay = esc((p.description || "—").slice(0, 32));
      const speedup = p.pct !== null ? `${round(p.pct, 1)}%` : "—";
      const speedColor = p.status?.key === "over" ? "#b91c1c" : p.status?.key === "slow" ? "#b45309" : "#15803d";
      const masterCt = p.declaredCt !== null ? `${round(p.declaredCt, 1)}s` : "—";
      const actualCt = p.actualCt !== null ? `${round(p.actualCt, 1)}s` : "—";
      const produced = fmt(p.produced, 0);
      const target = fmt(p.target, 0);

      rowsSvg += `
        <rect x="30" y="${y}" width="940" height="${rowHeight}" fill="${bg}" />
        <line x1="30" y1="${y + rowHeight}" x2="970" y2="${y + rowHeight}" stroke="#e2e8f0" stroke-width="1" />
        <text x="45" y="${y + 25}" font-family="'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="600" fill="#0f172a">${partDisplay}</text>
        <text x="210" y="${y + 25}" font-family="'Segoe UI', Roboto, sans-serif" font-size="12" fill="#475569">${descDisplay}</text>
        <text x="450" y="${y + 25}" font-family="'Segoe UI', Roboto, sans-serif" font-size="12" fill="#334155" text-anchor="middle">${fmt(p.hrs, 1)}h</text>
        <text x="545" y="${y + 25}" font-family="'Segoe UI', Roboto, sans-serif" font-size="12" fill="#334155" text-anchor="middle">${produced} / ${target}</text>
        <text x="655" y="${y + 25}" font-family="'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="700" fill="${speedColor}" text-anchor="middle">${speedup}</text>
        <text x="755" y="${y + 25}" font-family="'Segoe UI', Roboto, sans-serif" font-size="12" fill="#475569" text-anchor="middle">${masterCt} → ${actualCt}</text>
        <g transform="translate(835, ${y + 9})">
          <rect width="120" height="22" rx="11" fill="${statusBg}" />
          <text x="60" y="15" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="700" fill="${statusColor}" text-anchor="middle">${statusText}</text>
        </g>
      `;
    });
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${totalHeight}" viewBox="0 0 ${width} ${totalHeight}">
  <defs>
    <linearGradient id="headerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0369a1" />
      <stop offset="100%" stop-color="#0284c7" />
    </linearGradient>
    <filter id="cardShadow" x="-5%" y="-5%" width="110%" height="115%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.08" flood-color="#0f172a" />
    </filter>
  </defs>

  <!-- Background -->
  <rect width="${width}" height="${totalHeight}" fill="#f1f5f9" />

  <!-- Header Banner -->
  <rect x="20" y="20" width="960" height="100" rx="12" fill="url(#headerGrad)" filter="url(#cardShadow)" />
  <text x="45" y="58" font-family="'Segoe UI', Roboto, sans-serif" font-size="22" font-weight="800" fill="#ffffff" letter-spacing="0.5">
    PG ELECTROPLAST — CYCLE TIME TRACKER
  </text>
  <text x="45" y="88" font-family="'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="500" fill="#e0f2fe">
    Plant: <tspan font-weight="700" fill="#ffffff">${esc(plantName || plantReport.plantId)}</tspan>  ·  Period: <tspan font-weight="700" fill="#ffffff">${esc(periodLabel || plantReport.dateRangeLabel)}</tspan>
  </text>
  <g transform="translate(810, 42)">
    <rect width="150" height="36" rx="18" fill="rgba(255, 255, 255, 0.2)" />
    <text x="75" y="23" font-family="'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="700" fill="#ffffff" text-anchor="middle">
      AUTOMATED SNAPSHOT
    </text>
  </g>

  <!-- KPI Cards -->
  <!-- Card 1: Analysed -->
  <g transform="translate(20, 135)" filter="url(#cardShadow)">
    <rect width="225" height="105" rx="10" fill="#ffffff" stroke="#e2e8f0" stroke-width="1" />
    <text x="20" y="32" font-family="'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="600" fill="#64748b" text-transform="uppercase">Molds Analysed</text>
    <text x="20" y="78" font-family="'Segoe UI', Roboto, sans-serif" font-size="34" font-weight="800" fill="#0f172a">${kpis.analysed}</text>
    <circle cx="190" cy="52" r="18" fill="#e0f2fe" />
    <text x="190" y="58" font-family="'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="700" fill="#0284c7" text-anchor="middle">⚙</text>
  </g>

  <!-- Card 2: Over Cycle (Faster) -->
  <g transform="translate(265, 135)" filter="url(#cardShadow)">
    <rect width="225" height="105" rx="10" fill="#ffffff" stroke="#fecaca" stroke-width="1.5" />
    <text x="20" y="32" font-family="'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="600" fill="#b91c1c" text-transform="uppercase">Faster than CT (Over)</text>
    <text x="20" y="78" font-family="'Segoe UI', Roboto, sans-serif" font-size="34" font-weight="800" fill="#dc2626">${kpis.over}</text>
    <circle cx="190" cy="52" r="18" fill="#fee2e2" />
    <text x="190" y="58" font-family="'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="700" fill="#dc2626" text-anchor="middle">⚡</text>
  </g>

  <!-- Card 3: Slow Running -->
  <g transform="translate(510, 135)" filter="url(#cardShadow)">
    <rect width="225" height="105" rx="10" fill="#ffffff" stroke="#fde68a" stroke-width="1.5" />
    <text x="20" y="32" font-family="'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="600" fill="#b45309" text-transform="uppercase">Running Slow (&lt;70%)</text>
    <text x="20" y="78" font-family="'Segoe UI', Roboto, sans-serif" font-size="34" font-weight="800" fill="#d97706">${kpis.slow}</text>
    <circle cx="190" cy="52" r="18" fill="#fef3c7" />
    <text x="190" y="58" font-family="'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="700" fill="#d97706" text-anchor="middle">⚠️</text>
  </g>

  <!-- Card 4: Over Shifts -->
  <g transform="translate(755, 135)" filter="url(#cardShadow)">
    <rect width="225" height="105" rx="10" fill="#ffffff" stroke="#e2e8f0" stroke-width="1" />
    <text x="20" y="32" font-family="'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="600" fill="#64748b" text-transform="uppercase">Over-Speed Shifts</text>
    <text x="20" y="78" font-family="'Segoe UI', Roboto, sans-serif" font-size="34" font-weight="800" fill="#4338ca">${kpis.overShifts}</text>
    <circle cx="190" cy="52" r="18" fill="#e0e7ff" />
    <text x="190" y="58" font-family="'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="700" fill="#4338ca" text-anchor="middle">⏱</text>
  </g>

  <!-- Table Container -->
  <g filter="url(#cardShadow)">
    <rect x="20" y="255" width="960" height="${tableHeight + 20}" rx="10" fill="#ffffff" stroke="#e2e8f0" stroke-width="1" />
    
    <!-- Table Header -->
    <rect x="30" y="265" width="940" height="40" rx="6" fill="#0f172a" />
    <text x="45" y="290" font-family="'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="700" fill="#f8fafc">PART / SAP</text>
    <text x="210" y="290" font-family="'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="700" fill="#f8fafc">DESCRIPTION</text>
    <text x="450" y="290" font-family="'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="700" fill="#f8fafc" text-anchor="middle">RUN HRS</text>
    <text x="545" y="290" font-family="'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="700" fill="#f8fafc" text-anchor="middle">ACT / TGT</text>
    <text x="655" y="290" font-family="'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="700" fill="#f8fafc" text-anchor="middle">SPEED %</text>
    <text x="755" y="290" font-family="'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="700" fill="#f8fafc" text-anchor="middle">MASTER → ACT CT</text>
    <text x="895" y="290" font-family="'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="700" fill="#f8fafc" text-anchor="middle">STATUS</text>

    <!-- Table Rows -->
    ${rowsSvg}
  </g>

  <!-- Footer Timestamp -->
  <text x="30" y="${totalHeight - 15}" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" fill="#94a3b8">
    PGEL Molding MIS · Automated Snapshot generated at ${new Date().toISOString().replace('T', ' ').slice(0, 19)} IST
  </text>
</svg>`;
}

/**
 * Generate full HTML email with plant snapshots and data tables
 */
export function generateCycleTimeEmailHtml({
  plantReports = [],
  subject = "Daily Cycle Time Tracker Report",
  introText = "",
  periodLabel = "",
  dateStr = "",
  includePhotoAttachment = true,
}) {
  const safeIntro = esc(introText || "Please find the automated Cycle Time Tracker daily report and visual snapshots for the selected production plants below.")
    .replace(/\n/g, "<br/>");

  let totalAnalysed = 0;
  let totalOver = 0;
  let totalSlow = 0;
  let totalOverShifts = 0;

  plantReports.forEach((pr) => {
    totalAnalysed += pr.kpis.analysed || 0;
    totalOver += pr.kpis.over || 0;
    totalSlow += pr.kpis.slow || 0;
    totalOverShifts += pr.kpis.overShifts || 0;
  });

  const plantsSectionsHtml = plantReports
    .map((pr) => {
      const pName = pr.plantName || `Plant ${pr.plantId}`;
      const overList = pr.overParts || [];
      const slowList = pr.slowParts || [];
      const topParts = [...overList, ...slowList].slice(0, 8);

      let tableRows = "";
      if (topParts.length === 0) {
        tableRows = `
          <tr>
            <td colspan="6" style="padding:16px;text-align:center;color:#64748b;font-size:13px;background:#f8fafc;">
              No significant deviations recorded for ${esc(pName)} in this period (${esc(pr.dateRangeLabel)}).
            </td>
          </tr>
        `;
      } else {
        tableRows = topParts
          .map((p, i) => {
            const bg = i % 2 === 0 ? "#ffffff" : "#f8fafc";
            const speedColor = p.status.key === "over" ? "#b91c1c" : p.status.key === "slow" ? "#b45309" : "#15803d";
            const speedBg = p.status.key === "over" ? "#fee2e2" : p.status.key === "slow" ? "#fef3c7" : "#dcfce7";
            return `
              <tr style="background:${bg};border-bottom:1px solid #e2e8f0;">
                <td style="padding:10px 12px;font-weight:600;color:#0f172a;font-size:13px;">${esc(p.partNo || p.sap)}</td>
                <td style="padding:10px 12px;color:#475569;font-size:12px;">${esc((p.description || "—").slice(0, 30))}</td>
                <td style="padding:10px 12px;text-align:center;color:#334155;font-size:12px;">${fmt(p.hrs, 1)}h</td>
                <td style="padding:10px 12px;text-align:center;color:#334155;font-size:12px;">${fmt(p.produced, 0)} / ${fmt(p.target, 0)}</td>
                <td style="padding:10px 12px;text-align:center;font-weight:700;color:${speedColor};font-size:13px;">
                  <span style="background:${speedBg};padding:2px 8px;border-radius:10px;">${round(p.pct, 1)}%</span>
                </td>
                <td style="padding:10px 12px;text-align:center;color:#475569;font-size:12px;">
                  ${round(p.declaredCt, 1)}s → <strong style="color:${speedColor};">${round(p.actualCt, 1)}s</strong>
                </td>
              </tr>
            `;
          })
          .join("");
      }

      return `
        <div style="margin-top:24px;border:1px solid #e2e8f0;border-radius:12px;background:#ffffff;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
          <!-- Plant Header -->
          <div style="background:#0f172a;padding:14px 20px;display:flex;justify-content:space-between;align-items:center;">
            <div>
              <span style="color:#38bdf8;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">PLANT TRACKER SNAPSHOT</span>
              <h3 style="margin:2px 0 0 0;color:#ffffff;font-size:17px;font-weight:700;">${esc(pName)}</h3>
            </div>
            <div style="text-align:right;">
              <span style="display:inline-block;background:#1e293b;color:#cbd5e1;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:600;">
                ${esc(pr.dateRangeLabel)}
              </span>
            </div>
          </div>

          <!-- Plant Mini KPIs -->
          <div style="display:table;width:100%;border-bottom:1px solid #e2e8f0;background:#f8fafc;padding:12px 0;">
            <div style="display:table-cell;width:25%;text-align:center;border-right:1px solid #e2e8f0;">
              <div style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;">Analysed</div>
              <div style="font-size:20px;font-weight:800;color:#0f172a;margin-top:2px;">${pr.kpis.analysed}</div>
            </div>
            <div style="display:table-cell;width:25%;text-align:center;border-right:1px solid #e2e8f0;">
              <div style="font-size:11px;font-weight:600;color:#dc2626;text-transform:uppercase;">Faster (Over)</div>
              <div style="font-size:20px;font-weight:800;color:#dc2626;margin-top:2px;">${pr.kpis.over}</div>
            </div>
            <div style="display:table-cell;width:25%;text-align:center;border-right:1px solid #e2e8f0;">
              <div style="font-size:11px;font-weight:600;color:#d97706;text-transform:uppercase;">Slow (&lt;70%)</div>
              <div style="font-size:20px;font-weight:800;color:#d97706;margin-top:2px;">${pr.kpis.slow}</div>
            </div>
            <div style="display:table-cell;width:25%;text-align:center;">
              <div style="font-size:11px;font-weight:600;color:#4338ca;text-transform:uppercase;">Over Shifts</div>
              <div style="font-size:20px;font-weight:800;color:#4338ca;margin-top:2px;">${pr.kpis.overShifts}</div>
            </div>
          </div>

          ${
            includePhotoAttachment
              ? `
          <!-- Embedded Visual Photo Snapshot Banner -->
          <div style="padding:14px 20px 8px;background:#f1f5f9;text-align:center;">
            <div style="font-size:12px;font-weight:600;color:#475569;margin-bottom:8px;">
              📷 Visual Photo Snapshot Card (Attached: <em>${esc(pName.replace(/\s+/g, "_"))}_Cycle_Time.svg</em>)
            </div>
            <a href="cid:photo_${esc(pr.plantId)}" style="display:inline-block;border:1px solid #cbd5e1;border-radius:8px;overflow:hidden;box-shadow:0 2px 4px rgba(0,0,0,0.06);">
              <img src="cid:photo_${esc(pr.plantId)}" alt="${esc(pName)} Cycle Time Snapshot" style="display:block;max-width:100%;height:auto;border:0;" />
            </a>
          </div>
          `
              : ""
          }

          <!-- Deviation Table -->
          <div style="padding:16px 20px;">
            <div style="font-size:13px;font-weight:700;color:#0f172a;margin-bottom:8px;">
              Top Cycle Time Deviations &amp; Variances:
            </div>
            <table style="width:100%;border-collapse:collapse;font-family:Segoe UI,Arial,sans-serif;">
              <thead>
                <tr style="background:#0f172a;color:#ffffff;font-size:11px;text-transform:uppercase;">
                  <th style="padding:8px 12px;text-align:left;">Part / Mold</th>
                  <th style="padding:8px 12px;text-align:left;">Description</th>
                  <th style="padding:8px 12px;text-align:center;">Run Hrs</th>
                  <th style="padding:8px 12px;text-align:center;">Act / Tgt</th>
                  <th style="padding:8px 12px;text-align:center;">Speed %</th>
                  <th style="padding:8px 12px;text-align:center;">Master → Act CT</th>
                </tr>
              </thead>
              <tbody>
                ${tableRows}
              </tbody>
            </table>
          </div>
        </div>
      `;
    })
    .join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(subject)}</title>
</head>
<body style="margin:0;padding:20px;background-color:#f1f5f9;font-family:Segoe UI,Arial,-apple-system,BlinkMacSystemFont,Roboto,sans-serif;color:#0f172a;">
  <div style="max-width:760px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 12px rgba(15,23,42,0.08);border:1px solid #e2e8f0;">
    
    <!-- Top Header -->
    <div style="background:linear-gradient(135deg, #0369a1 0%, #0284c7 100%);padding:28px 24px;color:#ffffff;text-align:left;">
      <div style="display:inline-block;background:rgba(255,255,255,0.2);padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;">
        PG ELECTROPLAST LIMITED · MOLDING MIS
      </div>
      <h1 style="margin:0;font-size:24px;font-weight:800;line-height:1.2;color:#ffffff;">${esc(subject)}</h1>
      <p style="margin:6px 0 0 0;font-size:14px;color:#e0f2fe;font-weight:500;">
        Automated Daily Cycle Time Tracking &amp; Efficiency Report · Period: <strong>${esc(periodLabel || dateStr)}</strong>
      </p>
    </div>

    <!-- Intro / Remarks -->
    <div style="padding:24px 24px 16px;background:#ffffff;border-bottom:1px solid #f1f5f9;">
      <div style="font-size:14px;line-height:1.6;color:#334155;">
        ${safeIntro}
      </div>
    </div>

    <!-- Overall KPI Cards Summary -->
    <div style="padding:16px 24px;background:#f8fafc;border-bottom:1px solid #e2e8f0;">
      <div style="font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px;">
        Total Across All ${plantReports.length} Selected Plants:
      </div>
      <div style="display:table;width:100%;">
        <div style="display:table-cell;width:25%;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:12px;text-align:center;">
          <div style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;">Molds Analysed</div>
          <div style="font-size:22px;font-weight:800;color:#0f172a;margin-top:4px;">${totalAnalysed}</div>
        </div>
        <div style="display:table-cell;width:4%;"></div>
        <div style="display:table-cell;width:25%;background:#ffffff;border:1px solid #fecaca;border-radius:8px;padding:12px;text-align:center;">
          <div style="font-size:11px;font-weight:600;color:#dc2626;text-transform:uppercase;">Faster (Over CT)</div>
          <div style="font-size:22px;font-weight:800;color:#dc2626;margin-top:4px;">${totalOver}</div>
        </div>
        <div style="display:table-cell;width:4%;"></div>
        <div style="display:table-cell;width:25%;background:#ffffff;border:1px solid #fde68a;border-radius:8px;padding:12px;text-align:center;">
          <div style="font-size:11px;font-weight:600;color:#d97706;text-transform:uppercase;">Slow (&lt;70%)</div>
          <div style="font-size:22px;font-weight:800;color:#d97706;margin-top:4px;">${totalSlow}</div>
        </div>
        <div style="display:table-cell;width:4%;"></div>
        <div style="display:table-cell;width:25%;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:12px;text-align:center;">
          <div style="font-size:11px;font-weight:600;color:#4338ca;text-transform:uppercase;">Over Shifts</div>
          <div style="font-size:22px;font-weight:800;color:#4338ca;margin-top:4px;">${totalOverShifts}</div>
        </div>
      </div>
    </div>

    <!-- Plants Content -->
    <div style="padding:12px 24px 28px;">
      ${plantsSectionsHtml}
    </div>

    <!-- Email Footer -->
    <div style="background:#0f172a;padding:20px 24px;text-align:center;color:#94a3b8;font-size:12px;border-top:1px solid #1e293b;">
      <p style="margin:0 0 6px 0;color:#cbd5e1;font-weight:600;">
        This is an automated notification managed by PGEL Super Admin via Auto Email Manager.
      </p>
      <p style="margin:0;color:#64748b;">
        PG Electroplast Limited · Molding MIS &amp; OEE Tracker System · Generated on ${new Date().toISOString().replace('T', ' ').slice(0, 19)} IST
      </p>
    </div>

  </div>
</body>
</html>
  `.trim();
}

/**
 * Text version fallback
 */
export function generateCycleTimeEmailText({
  plantReports = [],
  subject = "Daily Cycle Time Tracker Report",
  introText = "",
  periodLabel = "",
}) {
  let lines = [
    `PG ELECTROPLAST LIMITED — CYCLE TIME TRACKER REPORT`,
    `Subject: ${subject}`,
    `Period: ${periodLabel}`,
    `Generated: ${new Date().toISOString()}`,
    `------------------------------------------------------------`,
    introText || "Automated Cycle Time Tracker report for selected plants.",
    `------------------------------------------------------------`,
  ];

  plantReports.forEach((pr) => {
    lines.push(`\n=== Plant: ${pr.plantName || pr.plantId} (${pr.dateRangeLabel}) ===`);
    lines.push(`Molds Analysed: ${pr.kpis.analysed} | Faster than CT: ${pr.kpis.over} | Slow: ${pr.kpis.slow} | Over Shifts: ${pr.kpis.overShifts}`);
    if (pr.overParts && pr.overParts.length > 0) {
      lines.push(`Top Faster Parts:`);
      pr.overParts.slice(0, 5).forEach((p) => {
        lines.push(` - ${p.partNo || p.sap} (${p.description}): ${round(p.pct, 1)}% vs Master CT (${round(p.declaredCt, 1)}s -> ${round(p.actualCt, 1)}s)`);
      });
    }
  });

  return lines.join("\n");
}
