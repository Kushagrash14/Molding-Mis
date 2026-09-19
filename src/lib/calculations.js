import { REASON_CODES } from "../data/seedData.js";

/**
 * Calculation engine strictly aligned with M2 DEMO.xlsx and plant MIS.
 * Formulas extracted directly from Excel row 2:
 * - Target: Col M = G2 * (I2 - P2 - Q2) * F2
 * - Quality Rate: Col AZ = N2 / (N2 + O2)
 * - Availability: Col BA = (I2 - (P2 + Q2)) / (I2 - P2)
 * - Productivity: Col BB = (N2 + O2) / M2
 * - OEE: Col BC = AZ2 * BA2 * BB2
 * - Prices & Weights: Cols BE, BF, BG, BH, BI, BJ, BK, BL, BM, BN, CW
 */
export function computeMetrics(entry, master, reasonCodes = REASON_CODES) {
  if (!entry) return {};

  const currentReasons = reasonCodes || REASON_CODES;

  // If this entry has multiple mold runs defined:
  if (entry.runs && Array.isArray(entry.runs) && entry.runs.length > 1) {
    let total_rej = 0;
    let planned_dt = 0;
    let unplanned_dt = 0;
    let tgt = 0;
    let ok_prod_price = 0;
    let rej_price = 0;
    let prod_plan_amt = 0;
    let shortfall_loss = 0;
    let ok_prod_wt = 0;
    let rej_wt = 0;
    let total_consumption = 0;
    let tool_change_count = 0;
    let total_ok = 0;
    let total_run_hour = 0;

    let total_planned_hours = 0;
    entry.runs.forEach((r) => {
      let rMaster = null;
      if (Array.isArray(master)) {
        rMaster = master.find((x) => x.sap_code === r.sap_code);
      } else if (master && master.sap_code === r.sap_code) {
        rMaster = master;
      }
      if (!rMaster && r.shots_per_hour) {
        rMaster = r;
      }
      const rm = computeMetrics(r, rMaster, currentReasons);
      total_rej += rm.total_rej || 0;
      planned_dt += rm.planned_dt || 0;
      unplanned_dt += rm.unplanned_dt || 0;
      tgt += rm.tgt || 0;
      ok_prod_price += rm.ok_prod_price || 0;
      rej_price += rm.rej_price || 0;
      prod_plan_amt += rm.prod_plan_amt || 0;
      shortfall_loss += rm.shortfall_loss || 0;
      ok_prod_wt += rm.ok_prod_wt || 0;
      rej_wt += rm.rej_wt || 0;
      total_consumption += rm.total_consumption || 0;
      tool_change_count += rm.tool_change_count || 0;
      total_ok += Number(r.ok_prod) || 0;
      total_run_hour += Number(r.run_hour) || 0;
      total_planned_hours += Number(r.planned_hours) || Number(r.run_hour) || 0;
    });

    const planned_base = total_planned_hours || Number(entry.planned_hours) || 12;
    const run_hour = entry.run_hour !== undefined && entry.run_hour !== "" ? Number(entry.run_hour) : total_run_hour;
    const total_produced = total_ok + total_rej;
    const quality_rate = total_produced > 0 ? total_ok / total_produced : 0;
    const denomAvail = Math.max(0, planned_base - planned_dt);
    const numAvail = Math.max(0, Math.min(run_hour, planned_base) - unplanned_dt);
    const availability = denomAvail > 0 ? Math.min(1, Math.max(0, numAvail / denomAvail)) : 0;
    const productivity = tgt > 0 ? total_produced / tgt : 0;
    const oee = quality_rate * availability * productivity;

    return {
      total_rej,
      ok_prod: total_ok,
      planned_dt,
      unplanned_dt,
      tgt,
      quality_rate,
      availability,
      productivity,
      oee,
      net_wt: 0,
      ok_prod_price,
      rej_price,
      prod_plan_amt,
      shortfall_loss,
      ok_prod_wt,
      rej_wt,
      total_consumption,
      tool_change_count,
      manpower_variance: 0,
    };
  }

  // Resolve product master if master is an array
  let itemMaster = master;
  if (Array.isArray(master)) {
    const sap =
      entry.sap_code ||
      entry.primary_sap_code ||
      (entry.runs && entry.runs[0] && entry.runs[0].sap_code);
    itemMaster = master.find((x) => x.sap_code === sap) || null;
  }

  // Single run calculation
  let total_rej = 0;
  let planned_dt = 0;
  let unplanned_dt = 0;

  const reasonsList = Array.isArray(entry.reasons)
    ? entry.reasons
    : entry.reasons && typeof entry.reasons === "object"
    ? Object.entries(entry.reasons).map(([reason_id, value]) => ({ reason_id, value }))
    : [];

  reasonsList.forEach((r) => {
    const rc = currentReasons.find((x) => x.reason_id === r.reason_id);
    if (!rc) return;
    const val = Number(r.value) || 0;
    if (rc.category === "rejection") total_rej += val;
    // Downtime values in form are minutes, Excel divides by 60 for hours
    if (rc.category === "planned_dt") planned_dt += val / 60;
    if (rc.category === "unplanned_dt") unplanned_dt += val / 60;
  });

  const planned_base = Number(entry.planned_hours) || 12;
  const run_hour = entry.run_hour !== undefined && entry.run_hour !== "" ? Number(entry.run_hour) : 0;
  const running_cavity = Number(entry.running_cavity) || 0;
  const ok_prod = Number(entry.ok_prod) || 0;

  // Col M: TGT = Shots/hr * (Run Hour - Planned DT - Unplanned DT) * Running Cavity
  const net_run_time = Math.max(0, run_hour - planned_dt - unplanned_dt);
  const shotsPerHour = Number(itemMaster?.shots_per_hour || entry.shots_per_hour || 0);
  const rawTgt = Math.round(shotsPerHour * net_run_time * running_cavity);
  const tgt = isNaN(rawTgt) ? 0 : rawTgt;

  // Col AZ: Quality Rate = OK Prod / (OK Prod + Total Rej)
  const total_produced = ok_prod + total_rej;
  const quality_rate = total_produced > 0 ? ok_prod / total_produced : 0;

  // Col BA: Availability = (Actual Run Hours - Unplanned DT) / (Planned Base Hours - Planned DT)
  const denomAvail = Math.max(0, planned_base - planned_dt);
  const numAvail = Math.max(0, Math.min(run_hour, planned_base) - unplanned_dt);
  const availability = denomAvail > 0 ? Math.min(1, Math.max(0, numAvail / denomAvail)) : 0;

  // Col BB: Productivity (Performance) = (OK Prod + Total Rej) / TGT
  const productivity = tgt > 0 ? total_produced / tgt : 0;

  // Col BC: OEE = Quality Rate * Availability * Productivity
  const oee = quality_rate * availability * productivity;

  // Col BD & BE & BF: Values (INR)
  const price = Number(itemMaster?.price || entry.price || 0);
  const ok_prod_price = price * ok_prod;
  const rej_price = price * total_rej;
  const prod_plan_amt = price * tgt;
  // Col CW: Shortfall Loss = MAX(0, TGT - OK Prod) * Price
  const shortfall_loss = Math.max(0, tgt - ok_prod) * price;

  // Col BG, BH, BI, BJ, BK, BL: Weights (in KG)
  const part_wt = Number(itemMaster?.part_wt || entry.part_wt || 0);
  const run_wt = Number(itemMaster?.run_wt || entry.run_wt || 0);
  const net_wt = part_wt + (running_cavity > 0 ? run_wt / running_cavity : 0);
  const ok_prod_wt = part_wt * ok_prod;
  const rej_wt = part_wt * total_rej;
  const total_consumption = net_wt * total_produced;

  // Col BM: Tool Change Count
  const tool_change_count = reasonsList.some(
    (r) => r.reason_id === "pdt_mould_change" && Number(r.value) > 0
  )
    ? 1
    : 0;

  // Manpower Variance
  const stdManpower = Number(itemMaster?.manpower || 2);
  const manpower_variance = (Number(entry.hr_mp_declare) || 0) - stdManpower;

  return {
    total_rej,
    ok_prod,
    planned_dt,
    unplanned_dt,
    tgt,
    quality_rate,
    availability,
    productivity,
    oee,
    net_wt,
    ok_prod_price,
    rej_price,
    prod_plan_amt,
    shortfall_loss,
    ok_prod_wt,
    rej_wt,
    total_consumption,
    tool_change_count,
    manpower_variance,
  };
}

export function pct(n) {
  return (n * 100).toFixed(1) + "%";
}

export function inr(val) {
  return "₹" + Number(val || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Calculates net shift operating hours, gross duration, and overnight status.
 * @param {string} startTime - HH:mm format, e.g. "06:00" or "22:00"
 * @param {string} endTime - HH:mm format, e.g. "14:00" or "06:00"
 * @param {number} breakMins - Unpaid break minutes, default 0
 * @returns {{ grossHours: number, netHours: number, totalMinutes: number, netMinutes: number, isOvernight: boolean }}
 */
export function calculateShiftDuration(startTime, endTime, breakMins = 0) {
  if (!startTime || !endTime) {
    return { grossHours: 8.0, netHours: 8.0, totalMinutes: 480, netMinutes: 480, isOvernight: false };
  }
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  const startMin = (sh || 0) * 60 + (sm || 0);
  let endMin = (eh || 0) * 60 + (em || 0);

  let isOvernight = false;
  if (endMin <= startMin) {
    // Crosses midnight, e.g. 22:00 to 06:00
    endMin += 24 * 60;
    isOvernight = true;
  }

  const grossMinutes = endMin - startMin;
  const breakVal = Math.max(0, Number(breakMins) || 0);
  const netMinutes = Math.max(0, grossMinutes - breakVal);

  const grossHours = Math.round((grossMinutes / 60) * 10) / 10;
  const netHours = Math.round((netMinutes / 60) * 10) / 10;

  return {
    grossHours,
    netHours,
    totalMinutes: grossMinutes,
    netMinutes,
    isOvernight,
  };
}

/**
 * Returns currently active shift based on local date/time.
 * @param {Array} shifts - Array of shift objects
 * @param {Date} date - Local date to check against
 * @returns {Object|null}
 */
export function getActiveShift(shifts = [], date = new Date()) {
  if (!shifts || shifts.length === 0) return null;

  const currentMinutes = date.getHours() * 60 + date.getMinutes();

  for (const s of shifts) {
    if (!s.start_time || !s.end_time) continue;
    const [sh, sm] = s.start_time.split(":").map(Number);
    const [eh, em] = s.end_time.split(":").map(Number);
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;

    if (endMin > startMin) {
      // Normal same-day shift (e.g. 06:00 - 14:00)
      if (currentMinutes >= startMin && currentMinutes < endMin) {
        return s;
      }
    } else {
      // Overnight shift crossing midnight (e.g. 22:00 - 06:00)
      if (currentMinutes >= startMin || currentMinutes < endMin) {
        return s;
      }
    }
  }

  // Fallback to first shift if none matched
  return shifts[0];
}

/**
 * Returns the industrial production shift date (YYYY-MM-DD).
 * In manufacturing plants, night shifts crossing midnight belong to the date
 * on which the shift commenced (e.g. before 07:00 AM, shift belongs to yesterday).
 * @param {Array} shifts - Configured shifts
 * @param {Date} date - Current date/time (defaults to now)
 * @returns {string} YYYY-MM-DD
 */
export function getProductionShiftDate(shifts = [], date = new Date()) {
  const activeShift = getActiveShift(shifts, date);
  if (!activeShift || !activeShift.start_time || !activeShift.end_time) {
    return date.toISOString().slice(0, 10);
  }

  const [sh, sm] = activeShift.start_time.split(":").map(Number);
  const [eh, em] = activeShift.end_time.split(":").map(Number);
  const startMin = (sh || 0) * 60 + (sm || 0);
  const endMin = (eh || 0) * 60 + (em || 0);
  const currentMinutes = date.getHours() * 60 + date.getMinutes();

  // If this shift crosses midnight (e.g. 19:00 to 07:00) and current time is past midnight but before endMin (e.g. 00:00 - 06:59)
  if (endMin <= startMin && currentMinutes < endMin) {
    // The shift commenced yesterday
    const targetDate = new Date(date.getTime() - 24 * 60 * 60 * 1000);
    const yyyy = targetDate.getFullYear();
    const mm = String(targetDate.getMonth() + 1).padStart(2, "0");
    const dd = String(targetDate.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  // Same-day production shift
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Formats a YYYY-MM-DD date into a friendly readable label: e.g. "17 Sep 2026"
 */
export function formatShiftDateDisplay(dateStr) {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Adjusts a YYYY-MM-DD date string by a given number of days (+/-).
 */
export function addDaysToDateStr(dateStr, days = 0) {
  if (!dateStr) return dateStr;
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Returns the list of eligible shift windows for production entry.
 * Industry Standard (PGEL MIS Logic):
 * An operator can log data for:
 * 1. The currently active shift (Live in-progress shift)
 * 2. The immediate previous shift, until the NEXT shift ends (12-hour grace period).
 * Any older shifts are locked and cannot be entered.
 *
 * @param {Array} shifts - Configured shift list
 * @param {Date} now - Current wall clock time
 * @returns {Array<Object>} List of eligible slots
 */
export function getEligibleShiftSlots(shifts = [], now = new Date()) {
  if (!shifts || shifts.length === 0) return [];

  const activeShift = getActiveShift(shifts, now) || shifts[0];
  const currentProdDate = getProductionShiftDate(shifts, now);

  const activeIdx = shifts.findIndex((s) => s.shift_id === activeShift.shift_id);
  const safeActiveIdx = activeIdx >= 0 ? activeIdx : 0;

  // Slot 1: Current Live Shift
  const currentSlot = {
    key: `${currentProdDate}_${activeShift.shift_id}`,
    shift_id: activeShift.shift_id,
    shift_date: currentProdDate,
    shift: activeShift,
    is_current: true,
    planned_hours: activeShift.planned_hours || 12,
    label: `${activeShift.name || `Shift ${activeShift.shift_id}`} (${activeShift.start_time}–${activeShift.end_time}) — Current Shift`,
    badge: "Current Shift",
  };

  // Slot 2: Previous Shift with 12h Grace Window
  const prevIdx = (safeActiveIdx - 1 + shifts.length) % shifts.length;
  const prevShift = shifts[prevIdx];

  // If active shift is the first shift of the day (e.g. Shift 1 starting at 07:00),
  // the previous shift (Shift 2) started on the previous calendar production date.
  // If active shift is Shift 2 (or later), previous shift (Shift 1) started on the SAME production date.
  const prevProdDate =
    safeActiveIdx === 0 ? addDaysToDateStr(currentProdDate, -1) : currentProdDate;

  const prevSlot = {
    key: `${prevProdDate}_${prevShift.shift_id}`,
    shift_id: prevShift.shift_id,
    shift_date: prevProdDate,
    shift: prevShift,
    is_current: false,
    planned_hours: prevShift.planned_hours || 12,
    label: `${prevShift.name || `Shift ${prevShift.shift_id}`} (${prevShift.start_time}–${prevShift.end_time}) — Previous Shift (12h Grace)`,
    badge: "12h Grace Window",
  };

  return [currentSlot, prevSlot];
}

/**
 * Returns the exact cutoff Date when a shift's 12-hour grace period ends.
 * (12 hours after the shift's scheduled end time).
 */
export function getShiftLockDeadline(shiftDateStr, shiftObj) {
  if (!shiftDateStr || !shiftObj || !shiftObj.start_time || !shiftObj.end_time) {
    return null;
  }
  const parts = shiftDateStr.split("-").map(Number);
  if (parts.length !== 3) return null;
  const [sY, sM, sD] = parts;
  const [sh, sm] = shiftObj.start_time.split(":").map(Number);
  const [eh, em] = shiftObj.end_time.split(":").map(Number);

  const startMin = (sh || 0) * 60 + (sm || 0);
  const endMin = (eh || 0) * 60 + (em || 0);

  let endDate;
  if (endMin > startMin) {
    // Same-day shift (e.g. 07:00 to 19:00)
    endDate = new Date(sY, sM - 1, sD, eh || 0, em || 0, 0, 0);
  } else {
    // Overnight shift crossing midnight (e.g. 19:00 to 07:00)
    endDate = new Date(sY, sM - 1, sD + 1, eh || 0, em || 0, 0, 0);
  }

  return new Date(endDate.getTime() + 12 * 60 * 60 * 1000);
}

/**
 * Checks whether an entry is past its 12-hour grace period after shift ended.
 */
export function isEntryPastTwelveHours(entry, shifts = [], now = new Date()) {
  if (!entry) return true;
  if (entry.status === "locked") return true;
  const shiftObj = shifts.find((s) => s.shift_id === entry.shift_id) || shifts[0];
  if (!shiftObj) return false;

  const deadline = getShiftLockDeadline(entry.shift_date, shiftObj);
  if (!deadline) return false;

  return now.getTime() > deadline.getTime();
}

/**
 * Checks whether a shift on a specific date has already started.
 */
export function isShiftStartedYet(shiftDateStr, shiftObj, now = new Date()) {
  if (!shiftDateStr || !shiftObj || !shiftObj.start_time) return true;
  const parts = shiftDateStr.split("-").map(Number);
  if (parts.length !== 3) return true;
  const [sY, sM, sD] = parts;
  const [sh, sm] = shiftObj.start_time.split(":").map(Number);
  const startTime = new Date(sY, sM - 1, sD, sh || 0, sm || 0, 0, 0);
  return now.getTime() >= startTime.getTime();
}

/**
 * Checks whether a shift entry is locked based on the 12-hour grace period window.
 */
export function isShiftEntryLocked(entry, shifts = [], now = new Date()) {
  return isEntryPastTwelveHours(entry, shifts, now);
}

/**
 * Timeline synchronization and multi-run helpers
 */
export function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function minutesToTime(totalMinutes) {
  const norm = ((totalMinutes % 1440) + 1440) % 1440;
  const h = String(Math.floor(norm / 60)).padStart(2, "0");
  const m = String(norm % 60).padStart(2, "0");
  return `${h}:${m}`;
}

export function getShiftOffsetMinutes(timeStr, shiftStartStr) {
  const t = timeToMinutes(timeStr);
  const s = timeToMinutes(shiftStartStr);
  return ((t - s) % 1440 + 1440) % 1440;
}

export function calculateHoursBetween(startStr, endStr, shiftStartStr) {
  if (!startStr || !endStr) return 0;
  const m1 = getShiftOffsetMinutes(startStr, shiftStartStr);
  const m2 = getShiftOffsetMinutes(endStr, shiftStartStr);
  let diff = m2 - m1;
  if (diff <= 0) diff += 1440;
  return Number((diff / 60).toFixed(2));
}

/**
 * Finds the immediately preceding shift record for a machine to detect previous mold
 */
export function getPreviousShiftInfo(machineId, shiftDate, shiftId, entries = [], shifts = []) {
  if (!machineId || !shiftDate || !shiftId || !entries || entries.length === 0) return null;

  let prevShiftId = "1";
  let prevShiftDate = shiftDate;

  if (String(shiftId) === "2" || String(shiftId).toUpperCase() === "B") {
    prevShiftId = "1";
    prevShiftDate = shiftDate;
  } else {
    prevShiftId = "2";
    prevShiftDate = addDaysToDateStr(shiftDate, -1);
  }

  const prevEntry = entries.find(
    (e) =>
      e.machine_id === machineId &&
      e.shift_date === prevShiftDate &&
      String(e.shift_id) === String(prevShiftId)
  );

  if (!prevEntry) return null;

  if (prevEntry.runs && Array.isArray(prevEntry.runs) && prevEntry.runs.length > 0) {
    const lastRun = prevEntry.runs[prevEntry.runs.length - 1];
    return {
      sap_code: lastRun.sap_code,
      prev_shift_id: prevShiftId,
      prev_shift_date: prevShiftDate,
      run_hour: lastRun.run_hour,
    };
  }

  if (prevEntry.sap_code) {
    return {
      sap_code: prevEntry.sap_code,
      prev_shift_id: prevShiftId,
      prev_shift_date: prevShiftDate,
      run_hour: prevEntry.run_hour,
    };
  }

  return null;
}

/**
 * Generates selectable handover / start time intervals between two mold runs.
 */
export function getStartTimeOptions(prevStartStr, curEndStr, shiftStartStr, prevIdx = 1, curIdx = 2) {
  if (!prevStartStr || !curEndStr || !shiftStartStr) return [];
  function t2m(t) {
    const [h, m] = (t || "07:00").split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  }
  function m2t(m) {
    let norm = ((m % 1440) + 1440) % 1440;
    const h = Math.floor(norm / 60);
    const min = norm % 60;
    return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  }
  function getOffset(t, start) {
    let diff = t2m(t) - t2m(start);
    if (diff < 0) diff += 1440;
    return diff;
  }

  const prevStartOffset = getOffset(prevStartStr, shiftStartStr);
  let curEndOffset = getOffset(curEndStr, shiftStartStr);
  if (curEndOffset === 0) curEndOffset = 1440;
  const totalShiftStartMin = t2m(shiftStartStr);

  const options = [];
  for (let m = prevStartOffset + 30; m <= curEndOffset - 30; m += 30) {
    const timeStr = m2t(totalShiftStartMin + m);
    const durPrev = ((m - prevStartOffset) / 60).toFixed(1);
    const durCur = ((curEndOffset - m) / 60).toFixed(1);
    options.push({
      time: timeStr,
      durPrev,
      durCur,
      label: `${timeStr} (Mold #${prevIdx}: ${durPrev}h · Mold #${curIdx}: ${durCur}h)`,
    });
  }
  return options;
}

