import { computeMetrics, findProduct } from "../src/lib/calculations.js";
import { familyInPlant } from "../src/data/familyMolds.js";

const SLOW_LIMIT = 70;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const PLANT_PRIORITY = {
  "2020": 1, // PGTL Pune (First)
  "4010": 2, // NGM Pune (Second)
  "1040": 3, // PGEL Pune (Third)
  "2060": 4, // DMIC Noida
  "PLANT-U04": 5, // Unit-04 Bhiwadi
  "4020": 6, // NGM Bhiwadi
};

export function sortPlantIds(plantIds = []) {
  return [...plantIds].sort((a, b) => {
    const pA = PLANT_PRIORITY[String(a)] || 99;
    const pB = PLANT_PRIORITY[String(b)] || 99;
    return pA - pB;
  });
}

export function getPlantDisplayName(plantId, plantObj = null) {
  const pid = String(plantId || "");
  if (pid === "2020") return "PGTL MOLDING (2020 - PGTL Pune)";
  if (pid === "4010") return "NGM MOLDING (4010 - NGM Pune)";
  if (pid === "1040") return "PGEL MOLDING (1040 - PGEL Pune)";
  if (pid === "2060") return "DMIC MOLDING (2060 - DMIC Noida)";
  if (plantObj?.name) return plantObj.name;
  return `Plant ${pid}`;
}

export function getPlantShortCode(plantId) {
  const pid = String(plantId || "");
  if (pid === "2020") return "PGTL";
  if (pid === "4010") return "NGM";
  if (pid === "1040") return "PGEL";
  if (pid === "2060") return "DMIC";
  return pid;
}

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

export function fmtDateShort(iso) {
  if (!iso) return "—";
  const parts = String(iso).slice(0, 10).split("-");
  if (parts.length !== 3) return iso;
  const [y, m, d] = parts;
  const mName = MONTHS[Number(m) - 1] || m;
  return `${d} ${mName} ${y.slice(2)}`;
}

export function formatMachineName(id, machines = []) {
  if (!id) return "—";
  const m = machines.find((mc) => mc.machine_id === id);
  if (!m) return id;
  return m.machine_no ? m.machine_no.split(" (")[0] : id;
}

export function formatShiftName(id, shifts = []) {
  if (!id) return "—";
  const s = shifts.find((sh) => String(sh.shift_id) === String(id) || sh.code === id);
  const name = s?.name;
  const tag = name?.match(/\(([^)]+)\)/)?.[1];
  return tag ? `S${id} ${tag}` : name || `S${id}`;
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
 * Filter entries based on period option or specific custom date.
 * Guarantees both Shift 1 and Shift 2 for that date are returned.
 */
export function filterEntriesByPeriod(entries, period = "yesterday", customDate = null) {
  if (!Array.isArray(entries) || entries.length === 0) return [];

  // If a specific customDate is provided (e.g. "2026-11-05"), strictly use that date
  if (customDate) {
    const target = String(customDate).trim().slice(0, 10);
    return entries.filter((e) => String(e.shift_date || "").slice(0, 10) === target);
  }

  const today = getIstDateStr(0);
  const yesterday = getIstDateStr(-1);
  const currentMonth = getIstMonthStr();

  if (period === "today") {
    return entries.filter((e) => String(e.shift_date || "").slice(0, 10) === today);
  }

  if (period === "yesterday") {
    const list = entries.filter((e) => String(e.shift_date || "").slice(0, 10) === yesterday);
    if (list.length > 0) return list;
    // Fallback: if yesterday has no entries (e.g. testing or holiday), use the latest available date
    const sorted = [...entries].filter((e) => e.shift_date).sort((a, b) => (b.shift_date > a.shift_date ? 1 : -1));
    if (sorted.length > 0) {
      const latestDate = sorted[0].shift_date.slice(0, 10);
      return entries.filter((e) => String(e.shift_date || "").slice(0, 10) === latestDate);
    }
    return [];
  }

  if (period === "latest_day") {
    const sorted = [...entries].filter((e) => e.shift_date).sort((a, b) => (b.shift_date > a.shift_date ? 1 : -1));
    if (sorted.length > 0) {
      const latestDate = sorted[0].shift_date.slice(0, 10);
      return entries.filter((e) => String(e.shift_date || "").slice(0, 10) === latestDate);
    }
    return [];
  }

  if (period === "mtd") {
    const list = entries.filter((e) => e.shift_date && e.shift_date.startsWith(currentMonth));
    if (list.length > 0) return list;
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
 * Compute cycle time data for a specific plant, returning both part-level and run-level suspicious rows.
 * Both Shift 1 (Day) and Shift 2 (Night) are analyzed.
 */
export function computePlantCycleTime(entries, master, reasonCodes, plantId, options = {}) {
  const threshold = Number(options.threshold) || 110;
  const minHours = options.minHours !== undefined ? Number(options.minHours) : 2;
  const period = options.period || "yesterday";
  const customDate = options.date || null;
  const machines = options.machines || [];
  const shifts = options.shifts || [];

  const relevantEntries = filterEntriesByPeriod(entries, period, customDate);

  const bySap = new Map();
  const dates = new Set();
  const foundShifts = new Set();
  const rawRunsList = [];

  relevantEntries.forEach((entry) => {
    const ePlant = String(entry.plant_id || "1040");
    if (plantId && plantId !== "all" && ePlant !== String(plantId)) return;
    if (entry.shift_date) dates.add(entry.shift_date);
    if (entry.shift_id) foundShifts.add(String(entry.shift_id));

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

      const runRecord = {
        id: `${entry.id || entry.entry_id || entry.shift_date}_${entry.machine_id}_${rec.runs.length}`,
        date: entry.shift_date,
        dateFormatted: fmtDateShort(entry.shift_date),
        shift: entry.shift_id,
        shiftDisplay: formatShiftName(entry.shift_id, shifts),
        machine: entry.machine_id,
        machineDisplay: formatMachineName(entry.machine_id, machines),
        operator: entry.operator_name || entry.created_by_name || "",
        hrs,
        tgtHrs,
        ok,
        rej,
        produced,
        target,
        rate,
        shotRate,
        pct,
      };

      rec.runs.push(runRecord);
      rawRunsList.push({ ...runRecord, partRef: rec });
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

  // Build shift-wise runs matching the CycleTimeTracker.jsx shift mode table
  const allRuns = rawRunsList
    .filter((r) => r.hrs >= minHours)
    .map((r) => {
      const part = r.partRef;
      const runStatus = statusFor(r.pct, threshold);
      const actualShots = r.shotRate;
      const declaredCt = part.shots > 0 ? 3600 / part.shots : null;
      const actualCt = actualShots > 0 ? 3600 / actualShots : null;

      return {
        ...r,
        part,
        sap: part.sap,
        partNo: part.partNo,
        description: part.description,
        cavity: part.combo || part.cavity,
        masterShots: part.shots,
        actualShots,
        declaredCt,
        actualCt,
        status: runStatus,
      };
    });

  // Suspicious runs: All runs where pct >= threshold (CT wrong · faster)
  // Sorted by Date descending, then % descending (matching user screenshot)
  const suspiciousRuns = allRuns
    .filter((r) => r.status.key === "over")
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.pct ?? -1) - (a.pct ?? -1)));

  // Slow runs (< 70%)
  const slowRuns = allRuns
    .filter((r) => r.status.key === "slow")
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (a.pct ?? 0) - (b.pct ?? 0)));

  const sortedDates = [...dates].sort();
  const targetDateFallback = customDate
    ? fmtDateShort(customDate)
    : period === "yesterday"
    ? fmtDateShort(getIstDateStr(-1))
    : period === "today"
    ? fmtDateShort(getIstDateStr(0))
    : "Target Date";

  const hasActiveShift = sortedDates.length > 0 && eligibleParts.length > 0;

  const dateRangeLabel =
    sortedDates.length === 0
      ? targetDateFallback
      : sortedDates.length === 1
      ? fmtDateShort(sortedDates[0])
      : `${fmtDateShort(sortedDates[0])} – ${fmtDateShort(sortedDates[sortedDates.length - 1])}`;

  const shiftsCoveredLabel = !hasActiveShift
    ? "No Active Shift"
    : foundShifts.has("1") && foundShifts.has("2")
    ? "Both Shift 1 (Day) & Shift 2 (Night)"
    : foundShifts.has("1")
    ? "Shift 1 (Day)"
    : foundShifts.has("2")
    ? "Shift 2 (Night)"
    : "All Shifts";

  return {
    plantId,
    plantShortCode: getPlantShortCode(plantId),
    plantDisplayName: getPlantDisplayName(plantId),
    dateRangeLabel,
    shiftsCoveredLabel,
    hasActiveShift,
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
    allRuns,
    suspiciousRuns,
    slowRuns,
  };
}

/**
 * Generate full SVG visual dashboard card matching the UI cycle time snapshot table.
 * Used for admin panel preview and standalone visual export.
 */
export function generatePlantSvgCard(plantReport, { plantName = "", periodLabel = "" } = {}) {
  const width = 1320;
  const kpis = plantReport?.kpis || { analysed: 0, over: 0, slow: 0, overShifts: 0, worst: null };
  const rows = (plantReport?.suspiciousRuns || []).slice(0, 25); // Show up to top 25 suspicious runs

  const rowHeight = 44;
  const tableTop = 265;
  const tableHeight = 44 + (rows.length > 0 ? rows.length * rowHeight : 60);
  const totalHeight = Math.max(520, tableTop + tableHeight + 55);

  const hasActiveShift = plantReport?.hasActiveShift ?? (plantReport?.totalRecords > 0 && plantReport?.kpis?.analysed > 0);

  let rowsSvg = "";
  if (!hasActiveShift) {
    rowsSvg = `
      <rect x="25" y="${tableTop + 44}" width="1270" height="60" fill="#f8fafc" />
      <circle cx="660" cy="${tableTop + 74}" r="14" fill="#e2e8f0" />
      <text x="660" y="${tableTop + 79}" font-family="'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="700" fill="#475569" text-anchor="middle">ℹ</text>
      <text x="660" y="${tableTop + 95}" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif" font-size="13" fill="#334155" font-weight="800">
        No Active Shift – Cycle Time Not Available (${esc(plantReport?.dateRangeLabel || "")})
      </text>
    `;
  } else if (rows.length === 0) {
    rowsSvg = `
      <rect x="25" y="${tableTop + 44}" width="1270" height="60" fill="#f0fdf4" />
      <circle cx="660" cy="${tableTop + 74}" r="14" fill="#dcfce7" />
      <text x="660" y="${tableTop + 79}" font-family="'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="700" fill="#15803d" text-anchor="middle">✓</text>
      <text x="660" y="${tableTop + 95}" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif" font-size="13" fill="#15803d" font-weight="800">
        Standard Master Cycle Time Maintained (${esc(plantReport?.dateRangeLabel || "")})
      </text>
    `;
  } else {
    rows.forEach((r, idx) => {
      const y = tableTop + 44 + idx * rowHeight;
      const bg = idx % 2 === 0 ? "#ffffff" : "#f8fafc";

      const dateStr = esc(r.dateFormatted || fmtDateShort(r.date));
      const shiftStr = esc(r.shiftDisplay || `S${r.shift}`);
      const machineStr = esc(r.machineDisplay || r.machine);
      const sapStr = esc(r.sap || "");
      const partDescStr = esc((r.partNo ? `${r.partNo} · ${r.description || ""}` : r.description || "—").slice(0, 36));
      const cavStr = esc(String(r.cavity || "1"));
      const hrsStr = fmt(r.hrs, 1);
      const okStr = fmt(r.ok, 0);
      const rejStr = fmt(r.rej, 0);
      const prodStr = fmt(r.produced, 0);
      const tgtStr = fmt(r.target, 0);
      const mShotsStr = r.masterShots ? fmt(r.masterShots, 0) : "—";
      const actShotsStr = fmt(r.actualShots, 0);
      const vsMasterStr = r.pct !== null ? `${round(r.pct, 0)}%` : "—";
      const ctStr = `${round(r.declaredCt, 1)}s → ${round(r.actualCt, 1)}s`;

      rowsSvg += `
        <rect x="25" y="${y}" width="1270" height="${rowHeight}" fill="${bg}" />
        <line x1="25" y1="${y + rowHeight}" x2="1295" y2="${y + rowHeight}" stroke="#e2e8f0" stroke-width="1" />

        <!-- Date -->
        <text x="38" y="${y + 26}" font-family="'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="700" fill="#0f172a">${dateStr}</text>

        <!-- Shift -->
        <text x="125" y="${y + 26}" font-family="'Segoe UI', Roboto, sans-serif" font-size="12" fill="#475569">${shiftStr}</text>

        <!-- Machine -->
        <text x="195" y="${y + 26}" font-family="'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="600" fill="#334155">${machineStr}</text>

        <!-- SAP · Part / Description -->
        <text x="285" y="${y + 19}" font-family="'Consolas', 'Courier New', monospace" font-size="11" font-weight="700" fill="#0369a1">${sapStr}</text>
        <text x="285" y="${y + 34}" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" fill="#64748b">${partDescStr}</text>

        <!-- Cav -->
        <text x="545" y="${y + 26}" font-family="'Segoe UI', Roboto, sans-serif" font-size="12" fill="#334155" text-anchor="middle">${cavStr}</text>

        <!-- Run Hrs -->
        <text x="605" y="${y + 26}" font-family="'Segoe UI', Roboto, sans-serif" font-size="12" fill="#334155" text-anchor="middle">${hrsStr}</text>

        <!-- OK -->
        <text x="665" y="${y + 26}" font-family="'Segoe UI', Roboto, sans-serif" font-size="12" fill="#334155" text-anchor="middle">${okStr}</text>

        <!-- Rej -->
        <text x="720" y="${y + 26}" font-family="'Segoe UI', Roboto, sans-serif" font-size="12" fill="#b91c1c" text-anchor="middle">${rejStr}</text>

        <!-- Produced -->
        <text x="785" y="${y + 26}" font-family="'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="800" fill="#0f172a" text-anchor="middle">${prodStr}</text>

        <!-- Target -->
        <text x="850" y="${y + 26}" font-family="'Segoe UI', Roboto, sans-serif" font-size="12" fill="#475569" text-anchor="middle">${tgtStr}</text>

        <!-- Master Shots -->
        <text x="915" y="${y + 26}" font-family="'Segoe UI', Roboto, sans-serif" font-size="12" fill="#475569" text-anchor="middle">${mShotsStr}</text>

        <!-- Actual Shots -->
        <text x="980" y="${y + 26}" font-family="'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="800" fill="#0f172a" text-anchor="middle">${actShotsStr}</text>

        <!-- Vs Master (Red Badge) -->
        <g transform="translate(1025, ${y + 11})">
          <rect width="65" height="22" rx="11" fill="#fee2e2" />
          <text x="32" y="15" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="800" fill="#b91c1c" text-anchor="middle">${vsMasterStr}</text>
        </g>

        <!-- CT (s) -->
        <text x="1150" y="${y + 26}" font-family="'Consolas', 'Courier New', monospace" font-size="11" font-weight="600" fill="#0f172a" text-anchor="middle">${ctStr}</text>

        <!-- Status -->
        <g transform="translate(1195, ${y + 11})">
          <rect width="90" height="22" rx="11" fill="#fee2e2" />
          <text x="45" y="15" font-family="'Segoe UI', Roboto, sans-serif" font-size="10" font-weight="700" fill="#b91c1c" text-anchor="middle">CT wrong · faster</text>
        </g>
      `;
    });
  }

  const worstStr = kpis.worst ? `${kpis.worst.sap} (${round(kpis.worst.pct, 0)}%)` : "—";
  const displayTitle = esc(plantName || plantReport?.plantDisplayName || `Plant ${plantReport?.plantId}`);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${totalHeight}" viewBox="0 0 ${width} ${totalHeight}">
  <defs>
    <linearGradient id="headerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a" />
      <stop offset="100%" stop-color="#1e293b" />
    </linearGradient>
    <filter id="cardShadow" x="-3%" y="-4%" width="106%" height="110%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.07" flood-color="#0f172a" />
    </filter>
  </defs>

  <!-- Background -->
  <rect width="${width}" height="${totalHeight}" fill="#f1f5f9" />

  <!-- Plant Header Banner -->
  <rect x="25" y="20" width="1270" height="95" rx="12" fill="url(#headerGrad)" filter="url(#cardShadow)" />
  <text x="50" y="55" font-family="'Segoe UI', Roboto, sans-serif" font-size="22" font-weight="800" fill="#ffffff" letter-spacing="0.5">
    ${displayTitle}
  </text>
  <text x="50" y="85" font-family="'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="500" fill="#94a3b8">
    Cycle Time Tracker · Suspicious (CT Wrong · Faster) Shifts Snapshot  ·  Period: <tspan font-weight="700" fill="#38bdf8">${esc(periodLabel || plantReport?.dateRangeLabel || "")}</tspan>
  </text>
  <g transform="translate(1120, 42)">
    <rect width="155" height="32" rx="16" fill="#dc2626" />
    <text x="77" y="21" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="800" fill="#ffffff" text-anchor="middle">
      SUSPICIOUS CT ALERT
    </text>
  </g>

  <!-- KPI Cards (5 Blocks) -->
  <!-- Card 1: Analysed -->
  <g transform="translate(25, 130)" filter="url(#cardShadow)">
    <rect width="240" height="95" rx="10" fill="#ffffff" stroke="#e2e8f0" stroke-width="1" />
    <text x="20" y="30" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="700" fill="#64748b" text-transform="uppercase">Molds Analysed</text>
    <text x="20" y="74" font-family="'Segoe UI', Roboto, sans-serif" font-size="34" font-weight="800" fill="#0f172a">${kpis.analysed}</text>
  </g>

  <!-- Card 2: Faster than CT (Over) -->
  <g transform="translate(282, 130)" filter="url(#cardShadow)">
    <rect width="240" height="95" rx="10" fill="#ffffff" stroke="#fecaca" stroke-width="2" />
    <text x="20" y="30" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="700" fill="#dc2626" text-transform="uppercase">Faster than CT (Over)</text>
    <text x="20" y="74" font-family="'Segoe UI', Roboto, sans-serif" font-size="34" font-weight="800" fill="#dc2626">${kpis.over}</text>
  </g>

  <!-- Card 3: Slow Running (<70%) -->
  <g transform="translate(540, 130)" filter="url(#cardShadow)">
    <rect width="240" height="95" rx="10" fill="#ffffff" stroke="#fde68a" stroke-width="1.5" />
    <text x="20" y="30" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="700" fill="#d97706" text-transform="uppercase">Running Slow (&lt;70%)</text>
    <text x="20" y="74" font-family="'Segoe UI', Roboto, sans-serif" font-size="34" font-weight="800" fill="#d97706">${kpis.slow}</text>
  </g>

  <!-- Card 4: Over Shifts -->
  <g transform="translate(797, 130)" filter="url(#cardShadow)">
    <rect width="240" height="95" rx="10" fill="#ffffff" stroke="#e2e8f0" stroke-width="1" />
    <text x="20" y="30" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="700" fill="#4338ca" text-transform="uppercase">Over-Speed Shifts</text>
    <text x="20" y="74" font-family="'Segoe UI', Roboto, sans-serif" font-size="34" font-weight="800" fill="#4338ca">${kpis.overShifts}</text>
  </g>

  <!-- Card 5: Worst Deviation -->
  <g transform="translate(1055, 130)" filter="url(#cardShadow)">
    <rect width="240" height="95" rx="10" fill="#ffffff" stroke="#e2e8f0" stroke-width="1" />
    <text x="20" y="30" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="700" fill="#64748b" text-transform="uppercase">Worst Part Deviation</text>
    <text x="20" y="68" font-family="'Segoe UI', Roboto, sans-serif" font-size="18" font-weight="800" fill="#b91c1c">${worstStr}</text>
  </g>

  <!-- Table Container -->
  <g filter="url(#cardShadow)">
    <rect x="25" y="245" width="1270" height="${tableHeight + 20}" rx="10" fill="#ffffff" stroke="#e2e8f0" stroke-width="1" />
    
    <!-- Table Header (Matching UI Screenshot) -->
    <rect x="25" y="245" width="1270" height="42" rx="10" fill="#f8fafc" />
    <line x1="25" y1="287" x2="1295" y2="287" stroke="#cbd5e1" stroke-width="1.5" />

    <text x="38" y="271" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="800" fill="#475569">DATE</text>
    <text x="125" y="271" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="800" fill="#475569">SHIFT</text>
    <text x="195" y="271" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="800" fill="#475569">MACHINE</text>
    <text x="285" y="271" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="800" fill="#475569">SAP · PART / DESCRIPTION</text>
    <text x="545" y="271" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="800" fill="#475569" text-anchor="middle">CAV</text>
    <text x="605" y="271" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="800" fill="#475569" text-anchor="middle">RUN HRS</text>
    <text x="665" y="271" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="800" fill="#475569" text-anchor="middle">OK</text>
    <text x="720" y="271" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="800" fill="#475569" text-anchor="middle">REJ</text>
    <text x="785" y="271" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="800" fill="#475569" text-anchor="middle">PRODUCED</text>
    <text x="850" y="271" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="800" fill="#475569" text-anchor="middle">TARGET</text>
    <text x="915" y="271" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="800" fill="#475569" text-anchor="middle">M. SHOTS</text>
    <text x="980" y="271" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="800" fill="#475569" text-anchor="middle">ACT. SHOTS</text>
    <text x="1057" y="271" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="800" fill="#475569" text-anchor="middle">VS MASTER</text>
    <text x="1150" y="271" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="800" fill="#475569" text-anchor="middle">CT (S)</text>
    <text x="1240" y="271" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="800" fill="#475569" text-anchor="middle">STATUS</text>

    <!-- Table Rows -->
    ${rowsSvg}
  </g>

  <!-- Footer Timestamp -->
  <text x="35" y="${totalHeight - 15}" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" fill="#94a3b8">
    PGEL Molding MIS · Automated Snapshot generated at ${new Date().toISOString().replace('T', ' ').slice(0, 19)} IST
  </text>
</svg>`;
}

/**
 * Generate full executive HTML email with plant sections in strict priority order (PGTL -> NGM -> PGEL -> DMIC)
 * and detailed shift-wise suspicious table.
 * NO broken external image tags (<img src="cid:...">), NO separate SVG attachments.
 * Native HTML/CSS dashboard tables render with 100% fidelity directly in Outlook, Gmail, and phones!
 */
export function generateCycleTimeEmailHtml({
  plantReports = [],
  subject = "Daily Cycle Time Tracker Report",
  introText = "",
  periodLabel = "",
  dateStr = "",
}) {
  const safeIntro = introText ? esc(introText).replace(/\n/g, "<br/>") : "";

  // Sort plants by user-requested priority: PGTL (2020) -> NGM (4010) -> PGEL (1040) -> others
  const sortedReports = [...plantReports].sort((a, b) => {
    const pA = PLANT_PRIORITY[String(a.plantId)] || 99;
    const pB = PLANT_PRIORITY[String(b.plantId)] || 99;
    return pA - pB;
  });

  const plantsSectionsHtml = sortedReports
    .map((pr) => {
      const pName = pr.plantDisplayName || `Plant ${pr.plantId}`;
      const suspiciousList = pr.suspiciousRuns || [];
      const hasActiveShift = pr.hasActiveShift ?? (pr.totalRecords > 0 && pr.kpis.analysed > 0);

      let tableRows = "";
      if (!hasActiveShift) {
        tableRows = `
          <tr>
            <td colspan="16" style="padding:28px 20px;text-align:center;background:#f8fafc;border-top:1px solid #e2e8f0;">
              <div style="font-size:24px;margin-bottom:6px;">ℹ️</div>
              <div style="font-size:15px;font-weight:800;color:#334155;letter-spacing:0.3px;">
                No Active Shift – Cycle Time Not Available
              </div>
              <div style="font-size:12px;color:#64748b;margin-top:4px;">
                No production shift or machine entries recorded for ${esc(pName)} on ${esc(pr.dateRangeLabel)}.
              </div>
            </td>
          </tr>
        `;
      } else if (suspiciousList.length === 0) {
        tableRows = `
          <tr>
            <td colspan="16" style="padding:28px 20px;text-align:center;background:#f0fdf4;border-top:1px solid #bbf7d0;">
              <div style="font-size:24px;margin-bottom:6px;">✅</div>
              <div style="font-size:15px;font-weight:800;color:#166534;letter-spacing:0.3px;">
                Standard Master Cycle Time Maintained
              </div>
              <div style="font-size:12px;color:#15803d;margin-top:4px;">
                All active molds in ${esc(pName)} operated within standard master cycle time parameters on ${esc(pr.dateRangeLabel)} (${esc(pr.shiftsCoveredLabel)}).
              </div>
            </td>
          </tr>
        `;
      } else {
        tableRows = suspiciousList
          .map((r, i) => {
            const bg = i % 2 === 0 ? "#ffffff" : "#f8fafc";
            const dateDisplay = esc(r.dateFormatted || fmtDateShort(r.date));
            const shiftDisplay = esc(r.shiftDisplay || `S${r.shift}`);
            const machineDisplay = esc(r.machineDisplay || r.machine);
            const sapDisplay = esc(r.sap || "");
            const partDescDisplay = esc((r.partNo ? `${r.partNo} · ${r.description || ""}` : r.description || "—").slice(0, 36));
            const cavDisplay = esc(String(r.cavity || "1"));
            const vsMasterDisplay = r.pct !== null ? `${round(r.pct, 0)}%` : "—";
            const ctDisplay = `${round(r.declaredCt, 1)}s → ${round(r.actualCt, 1)}s`;

            return `
              <tr style="background:${bg};border-bottom:1px solid #e2e8f0;">
                <td style="padding:10px 8px;font-weight:700;color:#0f172a;font-size:12px;white-space:nowrap;">${dateDisplay}</td>
                <td style="padding:10px 8px;color:#334155;font-size:12px;white-space:nowrap;font-weight:600;">${shiftDisplay}</td>
                <td style="padding:10px 8px;font-weight:700;color:#0f172a;font-size:12px;white-space:nowrap;">${machineDisplay}</td>
                <td style="padding:10px 10px;font-size:12px;">
                  <div style="font-family:Consolas,monospace;font-weight:700;color:#0369a1;font-size:12px;">${sapDisplay}</div>
                  <div style="color:#64748b;font-size:11px;margin-top:2px;">${partDescDisplay}</div>
                </td>
                <td style="padding:10px 6px;text-align:center;color:#334155;font-size:12px;font-weight:600;">${cavDisplay}</td>
                <td style="padding:10px 6px;text-align:center;color:#334155;font-size:12px;">${fmt(r.hrs, 1)}</td>
                <td style="padding:10px 6px;text-align:center;color:#334155;font-size:12px;">${fmt(r.tgtHrs ?? r.hrs, 1)}</td>
                <td style="padding:10px 6px;text-align:center;color:#334155;font-size:12px;">${fmt(r.ok, 0)}</td>
                <td style="padding:10px 6px;text-align:center;color:#b91c1c;font-size:12px;font-weight:600;">${fmt(r.rej, 0)}</td>
                <td style="padding:10px 6px;text-align:center;font-weight:800;color:#0f172a;font-size:12px;">${fmt(r.produced, 0)}</td>
                <td style="padding:10px 6px;text-align:center;color:#475569;font-size:12px;">${fmt(r.target, 0)}</td>
                <td style="padding:10px 6px;text-align:center;color:#475569;font-size:12px;">${r.masterShots ? fmt(r.masterShots, 0) : "—"}</td>
                <td style="padding:10px 6px;text-align:center;font-weight:800;color:#0f172a;font-size:12px;">${fmt(r.actualShots, 0)}</td>
                <td style="padding:10px 6px;text-align:center;white-space:nowrap;">
                  <span style="background:#fee2e2;color:#b91c1c;padding:3px 8px;border-radius:10px;font-weight:800;font-size:11px;display:inline-block;">
                    ${vsMasterDisplay}
                  </span>
                </td>
                <td style="padding:10px 6px;text-align:center;font-family:Consolas,monospace;font-size:11px;color:#0f172a;white-space:nowrap;font-weight:600;">
                  ${ctDisplay}
                </td>
                <td style="padding:10px 8px;text-align:center;white-space:nowrap;">
                  <span style="background:#fee2e2;color:#b91c1c;padding:3px 8px;border-radius:10px;font-weight:700;font-size:10px;display:inline-block;">
                    CT wrong · faster
                  </span>
                </td>
              </tr>
            `;
          })
          .join("");
      }

      return `
        <div style="margin-top:16px;margin-bottom:24px;border:1px solid #cbd5e1;border-radius:14px;background:#ffffff;overflow:hidden;box-shadow:0 3px 8px rgba(0,0,0,0.06);">
          <!-- Plant Header Banner (Table-based for 100% Outlook compatibility) -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0f172a;border-bottom:2px solid #1e293b;width:100%;">
            <tr>
              <td style="padding:16px 20px;vertical-align:middle;text-align:left;">
                <div style="color:#38bdf8;font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;">
                  PLANT CYCLE TIME REPORT
                </div>
                <h2 style="margin:4px 0 0 0;color:#ffffff;font-size:19px;font-weight:800;font-family:Segoe UI,Arial,sans-serif;">${esc(pName)}</h2>
              </td>
              <td style="padding:16px 20px;text-align:right;vertical-align:middle;">
                <span style="display:inline-block;background:#1e293b;color:#f8fafc;padding:6px 14px;border-radius:20px;font-size:12px;font-weight:700;border:1px solid #334155;">
                  📅 ${esc(pr.dateRangeLabel)} · ${esc(pr.shiftsCoveredLabel)}
                </span>
              </td>
            </tr>
          </table>

          <!-- Mini KPIs -->
          <div style="display:table;width:100%;border-bottom:1px solid #e2e8f0;background:#f8fafc;padding:12px 0;">
            <div style="display:table-cell;width:25%;text-align:center;border-right:1px solid #e2e8f0;">
              <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;">Analysed</div>
              <div style="font-size:24px;font-weight:800;color:#0f172a;margin-top:2px;">${pr.kpis.analysed}</div>
            </div>
            <div style="display:table-cell;width:25%;text-align:center;border-right:1px solid #e2e8f0;">
              <div style="font-size:11px;font-weight:700;color:#dc2626;text-transform:uppercase;">Faster (Over CT)</div>
              <div style="font-size:24px;font-weight:800;color:#dc2626;margin-top:2px;">${pr.kpis.over}</div>
            </div>
            <div style="display:table-cell;width:25%;text-align:center;border-right:1px solid #e2e8f0;">
              <div style="font-size:11px;font-weight:700;color:#d97706;text-transform:uppercase;">Slow (&lt;70%)</div>
              <div style="font-size:24px;font-weight:800;color:#d97706;margin-top:2px;">${pr.kpis.slow}</div>
            </div>
            <div style="display:table-cell;width:25%;text-align:center;">
              <div style="font-size:11px;font-weight:700;color:#4338ca;text-transform:uppercase;">Over Shifts</div>
              <div style="font-size:24px;font-weight:800;color:#4338ca;margin-top:2px;">${pr.kpis.overShifts}</div>
            </div>
          </div>

          <!-- Detailed Shifts Table -->
          <div style="padding:16px 20px;overflow-x:auto;">
            <div style="font-size:13px;font-weight:800;margin-bottom:10px;color:${suspiciousList.length > 0 ? '#b91c1c' : '#475569'};">
              ${
                suspiciousList.length > 0
                  ? `⚡ Over-Speed ("CT wrong · faster") Shift Runs (${suspiciousList.length}):`
                  : `Shift Status &amp; Cycle Time Details:`
              }
            </div>
            <table style="width:100%;border-collapse:collapse;font-family:Segoe UI,Arial,sans-serif;font-size:12px;">
              <thead>
                <tr style="background:#f8fafc;color:#475569;font-size:11px;text-transform:uppercase;border-top:1px solid #cbd5e1;border-bottom:2px solid #cbd5e1;">
                  <th style="padding:8px 8px;text-align:left;">Date</th>
                  <th style="padding:8px 8px;text-align:left;">Shift</th>
                  <th style="padding:8px 8px;text-align:left;">Machine</th>
                  <th style="padding:8px 10px;text-align:left;">SAP / Part / Description</th>
                  <th style="padding:8px 6px;text-align:center;">Cav</th>
                  <th style="padding:8px 6px;text-align:center;">Run Hrs</th>
                  <th style="padding:8px 6px;text-align:center;">Target Hrs</th>
                  <th style="padding:8px 6px;text-align:center;">OK</th>
                  <th style="padding:8px 6px;text-align:center;">Rej</th>
                  <th style="padding:8px 6px;text-align:center;">Produced</th>
                  <th style="padding:8px 6px;text-align:center;">Target</th>
                  <th style="padding:8px 6px;text-align:center;">Master Shots/Hr</th>
                  <th style="padding:8px 6px;text-align:center;">Actual Shots/Hr</th>
                  <th style="padding:8px 6px;text-align:center;">vs Master</th>
                  <th style="padding:8px 6px;text-align:center;">CT (s)</th>
                  <th style="padding:8px 8px;text-align:center;">Status</th>
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
  <div style="max-width:1050px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 12px rgba(15,23,42,0.08);border:1px solid #e2e8f0;">
    
    ${safeIntro ? `
    <!-- Intro Remarks -->
    <div style="padding:20px 24px 8px;background:#ffffff;font-size:14px;line-height:1.6;color:#334155;border-bottom:1px solid #f1f5f9;">
      ${safeIntro}
    </div>
    ` : ''}

    <!-- Plants Content (PGTL -> NGM -> PGEL) -->
    <div style="padding:12px 24px 28px;">
      ${plantsSectionsHtml}
    </div>

    <!-- Footer -->
    <div style="background:#0f172a;padding:16px 24px;text-align:center;color:#cbd5e1;font-size:12px;border-top:1px solid #1e293b;">
      <p style="margin:0;color:#cbd5e1;font-weight:700;">
        PG Electroplast Limited · Automated Molding MIS Notification System
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
  const sortedReports = [...plantReports].sort((a, b) => {
    const pA = PLANT_PRIORITY[String(a.plantId)] || 99;
    const pB = PLANT_PRIORITY[String(b.plantId)] || 99;
    return pA - pB;
  });

  let lines = [];
  if (introText) {
    lines.push(introText);
    lines.push(`--------------------------------------------------------------------------------`);
  }

  sortedReports.forEach((pr) => {
    lines.push(`\n=== Plant: ${pr.plantDisplayName || pr.plantId} (${pr.dateRangeLabel} · ${pr.shiftsCoveredLabel}) ===`);
    lines.push(`Molds Analysed: ${pr.kpis.analysed} | Faster than CT: ${pr.kpis.over} | Slow: ${pr.kpis.slow} | Over Shifts: ${pr.kpis.overShifts}`);
    if (pr.suspiciousRuns && pr.suspiciousRuns.length > 0) {
      lines.push(`Over-Speed Shifts ("CT wrong · faster"):`);
      pr.suspiciousRuns.forEach((r) => {
        lines.push(` - [${r.dateFormatted || r.date}] ${r.shiftDisplay || r.shift} | ${r.machineDisplay || r.machine} | ${r.sap} (${r.description}) | Prod: ${r.produced}/${r.target} | ${round(r.pct, 0)}% vs Master | CT: ${round(r.declaredCt, 1)}s -> ${round(r.actualCt, 1)}s`);
      });
    } else if (!pr.hasActiveShift || pr.kpis.analysed === 0) {
      lines.push(`ℹ️ No Active Shift – Cycle Time Not Available`);
    } else {
      lines.push(`✓ Standard master cycle time maintained for all active molds.`);
    }
  });

  return lines.join("\n");
}
