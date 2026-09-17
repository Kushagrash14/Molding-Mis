import { useEffect, useMemo, useState } from "react";
import {
  calculateHoursBetween,
  computeMetrics,
  formatShiftDateDisplay,
  getActiveShift,
  getPreviousShiftInfo,
  getProductionShiftDate,
  getShiftOffsetMinutes,
  isEntryPastTwelveHours,
  isShiftStartedYet,
  minutesToTime,
  pct,
  timeToMinutes,
  todayStr,
} from "../lib/calculations.js";
import MoldRunCard from "./MoldRunCard.jsx";
import SearchableMachineSelect from "./SearchableMachineSelect.jsx";

/**
 * Creates an initial single run covering the full planned shift hours.
 */
function createDefaultRun(shiftObj, id = "run-1") {
  const start = shiftObj?.start_time || "07:00";
  const end = shiftObj?.end_time || "19:00";
  const hrs = Number(shiftObj?.planned_hours || 12.0);
  return {
    run_id: id,
    start_time: start,
    end_time: end,
    planned_hours: hrs,
    run_hour: "",
    sap_code: "",
    material_description: "",
    part_no: "",
    running_cavity: "",
    hr_mp_declare: "",
    prod_mp_declare: "",
    ok_prod: "",
    reasons: {},
    other_dt_remark: "",
    is_continued: false,
  };
}

/**
 * Generates selectable start times for Mold #(curIdx) between startTime and endTime in 30-min increments.
 */
function getStartTimeOptions(startTimeStr, endTimeStr, shiftStartStr, prevIdx = 1, curIdx = 2) {
  if (!startTimeStr || !endTimeStr || !shiftStartStr) return [];
  const startOffset = getShiftOffsetMinutes(startTimeStr, shiftStartStr);
  let endOffset = getShiftOffsetMinutes(endTimeStr, shiftStartStr);
  if (endOffset === 0) endOffset = 1440;
  const totalShiftStartMin = timeToMinutes(shiftStartStr);

  const options = [];
  // Step in 30-min intervals strictly between startOffset + 30 and endOffset - 30
  for (let m = startOffset + 30; m <= endOffset - 30; m += 30) {
    const timeStr = minutesToTime(totalShiftStartMin + m);
    const dur1 = ((m - startOffset) / 60).toFixed(1);
    const dur2 = ((endOffset - m) / 60).toFixed(1);
    options.push({
      time: timeStr,
      durPrev: dur1,
      durCur: dur2,
      label: `${timeStr} (Mold #${prevIdx}: ${dur1}h · Mold #${curIdx}: ${dur2}h)`,
    });
  }
  return options;
}

const getShiftHandoverOptions = getStartTimeOptions;

/**
 * Converts a saved database entry (which may have `runs` array or single legacy fields)
 * into a standard runs array for the form state.
 */
function convertExistingEntryToRuns(entry, shiftObj) {
  const shiftStart = shiftObj?.start_time || "07:00";
  if (entry.runs && Array.isArray(entry.runs) && entry.runs.length > 0) {
    return entry.runs.map((r, idx) => {
      const p = calculateHoursBetween(r.start_time || shiftStart, r.end_time || shiftObj?.end_time || "19:00", shiftStart);
      return {
        run_id: r.run_id || `run-${idx + 1}`,
        start_time: r.start_time || shiftStart,
        end_time: r.end_time || shiftObj?.end_time || "19:00",
        planned_hours: r.planned_hours || p || 12.0,
        run_hour: r.run_hour != null && r.run_hour !== "" ? Number(r.run_hour) : "",
        sap_code: r.sap_code || "",
        material_description: r.material_description || "",
        part_no: r.part_no || "",
        running_cavity: r.running_cavity != null ? r.running_cavity : "",
        hr_mp_declare: r.hr_mp_declare != null ? r.hr_mp_declare : "",
        prod_mp_declare: r.prod_mp_declare != null ? r.prod_mp_declare : "",
        ok_prod: r.ok_prod != null ? String(r.ok_prod) : "",
        reasons: Array.isArray(r.reasons)
          ? r.reasons.reduce((acc, item) => ({ ...acc, [item.reason_id]: item.value }), {})
          : r.reasons || {},
        other_dt_remark:
          r.other_dt_remark ||
          (Array.isArray(r.reasons)
            ? r.reasons.find((item) => item.reason_id === "udt_others")?.remark
            : "") ||
          "",
        is_continued: Boolean(r.is_continued),
      };
    });
  }

  // Single legacy entry fallback
  const reasonMap = {};
  (entry.reasons || []).forEach((r) => {
    reasonMap[r.reason_id] = r.value;
  });
  const otherR = (entry.reasons || []).find((r) => r.reason_id === "udt_others");
  const pSingle = Number(shiftObj?.planned_hours || 12.0);

  return [
    {
      run_id: "run-1",
      start_time: shiftObj?.start_time || "07:00",
      end_time: shiftObj?.end_time || "19:00",
      planned_hours: pSingle,
      run_hour: entry.run_hour != null && entry.run_hour !== "" ? Number(entry.run_hour) : "",
      sap_code: entry.primary_sap_code || entry.sap_code || "",
      material_description: "",
      part_no: "",
      running_cavity: entry.running_cavity != null ? entry.running_cavity : "",
      hr_mp_declare: entry.hr_mp_declare != null ? entry.hr_mp_declare : "",
      prod_mp_declare: entry.prod_mp_declare != null ? entry.prod_mp_declare : "",
      ok_prod: entry.ok_prod != null ? String(entry.ok_prod) : "",
      reasons: reasonMap,
      other_dt_remark: otherR?.remark || entry.other_dt_remark || "",
      is_continued: false,
    },
  ];
}

export default function EntryForm({
  entries = [],
  master = [],
  machines = [],
  shifts = [],
  reasonCodes = [],
  locations = [],
  plants = [],
  selectedPlantId,
  onSubmit,
  currentUser,
}) {
  const [plant, setPlant] = useState(selectedPlantId || plants[0]?.plant_id || "PLANT-U01");
  const [shiftDate, setShiftDate] = useState(() => getProductionShiftDate(shifts));

  // Dynamically filter machines by currently selected manufacturing plant
  const plantMachines = useMemo(() => {
    if (!plant) return machines;
    const filtered = machines.filter((m) => !m.plant_id || m.plant_id === plant);
    return filtered.length > 0 ? filtered : machines;
  }, [machines, plant]);

  const [machine, setMachine] = useState("");

  // Auto-detect currently running plant shift based on local wall clock
  const activeShift = useMemo(() => getActiveShift(shifts), [shifts]);
  const [shift, setShift] = useState(() => activeShift?.shift_id || shifts[0]?.shift_id || "1");

  const selectedShift = useMemo(() => {
    return shifts.find((s) => s.shift_id === shift) || shifts[0] || {};
  }, [shifts, shift]);

  // Check if an entry already exists for this machine + shift + date + plant
  const existingEntry = useMemo(() => {
    if (!entries || entries.length === 0 || !machine) return null;
    return entries.find(
      (e) =>
        e.shift_date === shiftDate &&
        e.shift_id === shift &&
        e.machine_id === machine &&
        (!plant || e.plant_id === plant)
    );
  }, [entries, shiftDate, shift, machine, plant]);

  // Track if user explicitly clicked "Edit / Update This Entry"
  const [isEditingExisting, setIsEditingExisting] = useState(false);

  // Multi-mold runs state (default 1 run)
  const [runs, setRuns] = useState(() => [createDefaultRun(selectedShift)]);

  // Control force-open on SearchableSapSelect by index (0, 1, etc.)
  const [openSearchableIdx, setOpenSearchableIdx] = useState(null);

  // Previous Shift Mold Selection Modal State
  const [showSapPrompt, setShowSapPrompt] = useState(false);
  const [modalOption, setModalOption] = useState("continue"); // "continue" | "mid_shift" | "new_mold"
  const [modalHandoverTime, setModalHandoverTime] = useState("");
  // Mandatory decision flag: operator must explicitly declare old vs new mold via popup
  const [hasDecidedPrevMold, setHasDecidedPrevMold] = useState(false);

  // Grace period and cutoff status
  const isPastTwelveHours = useMemo(() => {
    return isEntryPastTwelveHours({ shift_date: shiftDate, shift_id: shift }, shifts);
  }, [shiftDate, shift, shifts]);

  const isNotStartedYet = useMemo(() => {
    return !isShiftStartedYet(shiftDate, selectedShift);
  }, [shiftDate, selectedShift]);

  // A form is locked if past 12h grace window or not started yet
  const isLocked = isPastTwelveHours || isNotStartedYet;

  // Detect mold running in immediately preceding shift on this machine
  const prevShiftInfo = useMemo(() => {
    return getPreviousShiftInfo(machine, shiftDate, shift, entries, shifts);
  }, [machine, shiftDate, shift, entries, shifts]);

  const prevMaster = useMemo(() => {
    if (!prevShiftInfo?.sap_code) return null;
    return master.find((m) => m.sap_code === prevShiftInfo.sap_code) || null;
  }, [master, prevShiftInfo]);

  // Handover timing intervals for mid-shift mold change option
  const handoverOptions = useMemo(() => {
    if (!selectedShift) return [];
    const sStart = selectedShift.start_time || "07:00";
    const sEnd = selectedShift.end_time || "19:00";
    return getShiftHandoverOptions(sStart, sEnd, sStart, 1, 2);
  }, [selectedShift]);

  useEffect(() => {
    if (
      handoverOptions.length > 0 &&
      (!modalHandoverTime || !handoverOptions.some((o) => o.time === modalHandoverTime))
    ) {
      const midIdx = Math.floor(handoverOptions.length / 2);
      setModalHandoverTime(handoverOptions[midIdx]?.time || handoverOptions[0]?.time);
    }
  }, [handoverOptions, modalHandoverTime]);

  // Sync state when machine, shift, shiftDate, or plant changes
  useEffect(() => {
    if (existingEntry) {
      setHasDecidedPrevMold(true);
      if (isLocked) {
        // Locked record: load existing runs automatically for view-only inspection
        setRuns(convertExistingEntryToRuns(existingEntry, selectedShift));
        setIsEditingExisting(false);
      } else {
        // Unlocked record already saved: keep isEditingExisting false until user clicks "Edit"
        setIsEditingExisting(false);
      }
    } else {
      // Clean new record: initialize 1 run covering full shift planned hours
      setHasDecidedPrevMold(false);
      setRuns([createDefaultRun(selectedShift)]);
      setIsEditingExisting(false);
    }
  }, [existingEntry, machine, shiftDate, shift, isLocked, selectedShift]);

  // Re-sync if plant selection changes globally
  useEffect(() => {
    if (selectedPlantId && plants.some((p) => p.plant_id === selectedPlantId)) {
      setPlant(selectedPlantId);
    }
  }, [selectedPlantId, plants]);

  // Re-sync machine selection if plant changes
  useEffect(() => {
    if (machine && !plantMachines.some((m) => m.machine_id === machine)) {
      setMachine("");
    }
  }, [plantMachines, machine]);

  // Handle shift change
  function handleShiftChange(newShiftId) {
    setShift(newShiftId);
    const newShiftObj = shifts.find((s) => s.shift_id === newShiftId) || shifts[0];
    if (!existingEntry && runs.length === 1) {
      setRuns([
        {
          ...runs[0],
          start_time: newShiftObj?.start_time || "07:00",
          end_time: newShiftObj?.end_time || "19:00",
          planned_hours: Number(newShiftObj?.planned_hours || 12.0),
          run_hour:
            runs[0].run_hour !== "" && runs[0].run_hour !== undefined
              ? Math.min(Number(runs[0].run_hour), Number(newShiftObj?.planned_hours || 12.0))
              : "",
        },
      ]);
    }
  }

  // Helper to update a specific run's properties
  function updateRun(runIdx, fieldOrObj, val) {
    setRuns((prev) => {
      const next = [...prev];
      const cur = { ...next[runIdx] };
      if (typeof fieldOrObj === "object") {
        Object.assign(cur, fieldOrObj);
      } else {
        cur[fieldOrObj] = val;
      }
      next[runIdx] = cur;
      return next;
    });
  }

  // Handle SAP product selection for a run
  function handleRunSapChange(runIdx, newSap) {
    if (newSap) {
      const foundMaster = master.find((m) => m.sap_code === newSap);
      if (foundMaster) {
        updateRun(runIdx, {
          sap_code: newSap,
          material_description: foundMaster.material_description || "",
          part_no: foundMaster.part_no || "",
          running_cavity: foundMaster.cavity || 1,
          hr_mp_declare: foundMaster.manpower || 2,
          prod_mp_declare: foundMaster.manpower || 2,
          is_continued: false,
        });
        return;
      }
    }

    // When SAP code is cleared (user clicked ✕ cross button)
    if (runIdx === 0) {
      // If the primary mold is cleared, reset all molds back to 1 full planned shift run!
      // This eliminates loopholes where an operator splits mid-shift and deletes mold 1 to bypass handover accountability.
      const shiftStart = selectedShift?.start_time || "07:00";
      const shiftEnd = selectedShift?.end_time || "19:00";
      const fullHrs = Number(selectedShift?.planned_hours || 12.0);

      setRuns([
        {
          run_id: `run-1-${Date.now()}`,
          start_time: shiftStart,
          end_time: shiftEnd,
          planned_hours: fullHrs,
          run_hour: "",
          sap_code: "",
          material_description: "",
          part_no: "",
          running_cavity: "",
          hr_mp_declare: "",
          prod_mp_declare: "",
          ok_prod: "",
          reasons: {},
          other_dt_remark: "",
          is_continued: false,
        },
      ]);
      setHasDecidedPrevMold(false);
      setOpenSearchableIdx(null);
      return;
    }

    updateRun(runIdx, {
      sap_code: "",
      material_description: "",
      part_no: "",
      running_cavity: "",
      hr_mp_declare: "",
      prod_mp_declare: "",
      is_continued: false,
    });
  }

  // Handle "Continue Previous Shift Mold" quick action (for Run 1)
  function handleContinuePrevShiftMold(prevSap) {
    const foundMaster = master.find((m) => m.sap_code === prevSap);
    if (foundMaster) {
      updateRun(0, {
        sap_code: prevSap,
        material_description: foundMaster.material_description || "",
        part_no: foundMaster.part_no || "",
        running_cavity: foundMaster.cavity || 1,
        hr_mp_declare: foundMaster.manpower || 2,
        prod_mp_declare: foundMaster.manpower || 2,
        is_continued: true,
      });
    }
  }

  // Intercept trigger click on SAP Code field: show modal prompt if previous mold exists and not decided
  function handleSapTriggerClick(idx) {
    if (idx === 0 && !hasDecidedPrevMold && prevShiftInfo && prevMaster && !isFormReadOnly) {
      setShowSapPrompt(true);
      setModalOption("continue");
      return true; // Intercept: DO NOT open searchable dropdown!
    }
    return false; // Proceed to open searchable dropdown normally
  }

  // Modal Option 1: Continue same mold for full shift
  function handleConfirmContinueSameMold() {
    if (!prevShiftInfo?.sap_code || !prevMaster) return;
    const shiftStart = selectedShift?.start_time || "07:00";
    const shiftEnd = selectedShift?.end_time || "19:00";
    const fullHrs = Number(selectedShift?.planned_hours || 12.0);

    setHasDecidedPrevMold(true);
    setRuns([
      {
        run_id: `run-1-${Date.now()}`,
        start_time: shiftStart,
        end_time: shiftEnd,
        planned_hours: fullHrs,
        run_hour: "",
        sap_code: prevShiftInfo.sap_code,
        material_description: prevMaster.material_description || "",
        part_no: prevMaster.part_no || "",
        running_cavity: prevMaster.cavity || 1,
        hr_mp_declare: prevMaster.manpower || 2,
        prod_mp_declare: prevMaster.manpower || 2,
        ok_prod: "",
        reasons: {},
        other_dt_remark: "",
        is_continued: true,
      },
    ]);
    setShowSapPrompt(false);
    setOpenSearchableIdx(null);
  }

  // Modal Option 2: Mold changed mid-shift
  function handleConfirmMidShiftChange() {
    if (!prevShiftInfo?.sap_code || !prevMaster) return;
    const shiftStart = selectedShift?.start_time || "07:00";
    const shiftEnd = selectedShift?.end_time || "19:00";
    const splitTime = modalHandoverTime || handoverOptions[0]?.time;
    if (!splitTime) return;

    const dur1 = calculateHoursBetween(shiftStart, splitTime, shiftStart);
    const dur2 = calculateHoursBetween(splitTime, shiftEnd, shiftStart);

    setHasDecidedPrevMold(true);
    setRuns([
      {
        run_id: `run-1-${Date.now()}`,
        start_time: shiftStart,
        end_time: splitTime,
        planned_hours: dur1,
        run_hour: "",
        sap_code: prevShiftInfo.sap_code,
        material_description: prevMaster.material_description || "",
        part_no: prevMaster.part_no || "",
        running_cavity: prevMaster.cavity || 1,
        hr_mp_declare: prevMaster.manpower || 2,
        prod_mp_declare: prevMaster.manpower || 2,
        ok_prod: "",
        reasons: {},
        other_dt_remark: "",
        is_continued: true,
      },
      {
        run_id: `run-2-${Date.now() + 1}`,
        start_time: splitTime,
        end_time: shiftEnd,
        planned_hours: dur2,
        run_hour: "",
        sap_code: "",
        material_description: "",
        part_no: "",
        running_cavity: "",
        hr_mp_declare: "",
        prod_mp_declare: "",
        ok_prod: "",
        reasons: {},
        other_dt_remark: "",
        is_continued: false,
      },
    ]);
    setShowSapPrompt(false);
    setTimeout(() => {
      setOpenSearchableIdx(1);
    }, 150);
  }

  // Modal Option 3: Changed before shift started
  function handleConfirmNewMoldShiftStart() {
    const shiftStart = selectedShift?.start_time || "07:00";
    const shiftEnd = selectedShift?.end_time || "19:00";
    const fullHrs = Number(selectedShift?.planned_hours || 12.0);

    setHasDecidedPrevMold(true);
    setRuns([
      {
        run_id: `run-1-${Date.now()}`,
        start_time: shiftStart,
        end_time: shiftEnd,
        planned_hours: fullHrs,
        run_hour: "",
        sap_code: "",
        material_description: "",
        part_no: "",
        running_cavity: "",
        hr_mp_declare: "",
        prod_mp_declare: "",
        ok_prod: "",
        reasons: {},
        other_dt_remark: "",
        is_continued: false,
      },
    ]);
    setShowSapPrompt(false);
    setTimeout(() => {
      setOpenSearchableIdx(0);
    }, 150);
  }

  // Close Modal without deciding (Decision remains strictly pending: NO dropdown opens!)
  function handleCloseSapPrompt() {
    setShowSapPrompt(false);
    setOpenSearchableIdx(null);
  }

  // Handle machine selection from unit list (popup opens only when SAP field is clicked)
  function handleMachineSelect(newMachineId) {
    setMachine(newMachineId);
    setHasDecidedPrevMold(false);
  }

  // Update reason codes on a run
  function handleRunReasonChange(runIdx, id, val) {
    const cleanVal = val === "" ? "" : Math.max(0, Number(val));
    setRuns((prev) => {
      const next = [...prev];
      const cur = { ...next[runIdx] };
      cur.reasons = { ...(cur.reasons || {}), [id]: cleanVal };
      next[runIdx] = cur;
      return next;
    });
  }

  function handleRunOtherRemark(runIdx, val) {
    setRuns((prev) => {
      const next = [...prev];
      const cur = { ...next[runIdx] };
      cur.other_dt_remark = val;
      next[runIdx] = cur;
      return next;
    });
  }

  // Adding another mold run (mid-shift mold change)
  function handleAddMoldRun() {
    if (runs.length >= 4) {
      alert("A maximum of 4 mold changes can be recorded per 12-hour shift.");
      return;
    }
    const shiftStart = selectedShift?.start_time || "07:00";
    const lastRun = runs[runs.length - 1];

    const startOffset = getShiftOffsetMinutes(lastRun.start_time, shiftStart);
    let endOffset = getShiftOffsetMinutes(lastRun.end_time, shiftStart);
    if (endOffset === 0) endOffset = 1440;
    const availableMinutes = endOffset - startOffset;

    if (availableMinutes < 60) {
      alert("Remaining duration on the last mold run is less than 1 hour. Cannot split further.");
      return;
    }

    // Split midpoint in 30-min increments
    const halfMin = Math.round(availableMinutes / 2 / 30) * 30;
    const splitOffset = startOffset + Math.max(30, Math.min(availableMinutes - 30, halfMin));
    const splitTime = minutesToTime(timeToMinutes(shiftStart) + splitOffset);
    const splitDur1 = calculateHoursBetween(lastRun.start_time, splitTime, shiftStart);
    const splitDur2 = calculateHoursBetween(splitTime, lastRun.end_time, shiftStart);

    const updatedLastRun = {
      ...lastRun,
      end_time: splitTime,
      planned_hours: splitDur1,
      run_hour:
        lastRun.run_hour !== "" && lastRun.run_hour !== undefined
          ? Math.min(Number(lastRun.run_hour), splitDur1)
          : "",
    };

    const newRun = {
      run_id: "run-" + (runs.length + 1) + "-" + Date.now(),
      start_time: splitTime,
      end_time: lastRun.end_time,
      planned_hours: splitDur2,
      run_hour: "",
      sap_code: "",
      material_description: "",
      part_no: "",
      running_cavity: "",
      hr_mp_declare: "",
      prod_mp_declare: "",
      ok_prod: "",
      reasons: {},
      other_dt_remark: "",
      is_continued: false,
    };

    const nextRuns = [...runs.slice(0, -1), updatedLastRun, newRun];
    setRuns(nextRuns);
    setOpenSearchableIdx(nextRuns.length - 1); // Auto-open search on new mold run

    setTimeout(() => {
      const el = document.getElementById(`mold-run-card-${nextRuns.length}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 100);
  }

  // Removing a mold run
  function handleRemoveMoldRun(removeIdx) {
    if (runs.length <= 1) return;
    const shiftStart = selectedShift?.start_time || "07:00";

    if (
      !confirm(
        `Are you sure you want to remove Mold Run #${removeIdx + 1}? Its run hours will be merged back into the adjacent mold.`
      )
    ) {
      return;
    }

    const nextRuns = [...runs];
    if (removeIdx === runs.length - 1) {
      // Last run removed: extend previous run's end_time to this run's end_time
      const prevRun = { ...nextRuns[removeIdx - 1] };
      prevRun.end_time = nextRuns[removeIdx].end_time;
      const newDur = calculateHoursBetween(prevRun.start_time, prevRun.end_time, shiftStart);
      prevRun.planned_hours = newDur;
      prevRun.run_hour =
        prevRun.run_hour !== "" && prevRun.run_hour !== undefined
          ? Math.min(Number(prevRun.run_hour), newDur)
          : "";
      nextRuns[removeIdx - 1] = prevRun;
      nextRuns.splice(removeIdx, 1);
    } else {
      // Intermediate or first run removed: extend next run's start_time backward
      const nextRun = { ...nextRuns[removeIdx + 1] };
      nextRun.start_time = nextRuns[removeIdx].start_time;
      const newDur = calculateHoursBetween(nextRun.start_time, nextRun.end_time, shiftStart);
      nextRun.planned_hours = newDur;
      nextRun.run_hour =
        nextRun.run_hour !== "" && nextRun.run_hour !== undefined
          ? Math.min(Number(nextRun.run_hour), newDur)
          : "";
      nextRuns[removeIdx + 1] = nextRun;
      nextRuns.splice(removeIdx, 1);
    }

    setRuns(nextRuns);
  }

  // Updating start time of Run idx (where idx > 0), which automatically sets Run idx-1's end time
  function handleStartTimeChange(runIdx, newStartTime) {
    if (runIdx <= 0 || runIdx >= runs.length) return;
    const shiftStart = selectedShift?.start_time || "07:00";
    const prevRun = runs[runIdx - 1];
    const curRun = runs[runIdx];

    const prevStartOffset = getShiftOffsetMinutes(prevRun.start_time, shiftStart);
    let curEndOffset = getShiftOffsetMinutes(curRun.end_time, shiftStart);
    if (curEndOffset === 0) curEndOffset = 1440;
    const newStartOffset = getShiftOffsetMinutes(newStartTime, shiftStart);

    if (newStartOffset <= prevStartOffset || newStartOffset >= curEndOffset) {
      alert(`Start time must be strictly between ${prevRun.start_time} and ${curRun.end_time}.`);
      return;
    }

    const prevPlanned = calculateHoursBetween(prevRun.start_time, newStartTime, shiftStart);
    const curPlanned = calculateHoursBetween(newStartTime, curRun.end_time, shiftStart);

    const updatedPrevRun = {
      ...prevRun,
      end_time: newStartTime,
      planned_hours: prevPlanned,
      run_hour:
        prevRun.run_hour !== "" && prevRun.run_hour !== undefined
          ? Math.min(Number(prevRun.run_hour), prevPlanned)
          : "",
    };

    const updatedCurRun = {
      ...curRun,
      start_time: newStartTime,
      planned_hours: curPlanned,
      run_hour:
        curRun.run_hour !== "" && curRun.run_hour !== undefined
          ? Math.min(Number(curRun.run_hour), curPlanned)
          : "",
    };

    const nextRuns = [...runs];
    nextRuns[runIdx - 1] = updatedPrevRun;
    nextRuns[runIdx] = updatedCurRun;
    setRuns(nextRuns);
  }

  // Overall Shift Draft across all runs (for summary bar)
  const overallShiftDraft = useMemo(() => {
    const shiftStart = selectedShift?.start_time || "07:00";
    const shiftEnd = selectedShift?.end_time || "19:00";
    const formattedRuns = runs.map((r) => {
      const maxAllotted =
        runs.length === 1
          ? Number(selectedShift?.planned_hours || 12.0)
          : calculateHoursBetween(r.start_time || shiftStart, r.end_time || shiftEnd, shiftStart);
      return {
        ...r,
        planned_hours: r.planned_hours || maxAllotted,
        running_cavity: r.running_cavity === "" ? 0 : Number(r.running_cavity),
        run_hour:
          r.run_hour === "" || r.run_hour == null ? 0 : Number(r.run_hour),
        hr_mp_declare: r.hr_mp_declare === "" ? 0 : Number(r.hr_mp_declare),
        prod_mp_declare: r.prod_mp_declare === "" ? 0 : Number(r.prod_mp_declare),
        ok_prod: r.ok_prod === "" ? 0 : Number(r.ok_prod),
        reasons: Object.entries(r.reasons || {})
          .filter(([, v]) => Number(v) > 0)
          .map(([reason_id, value]) => ({
            reason_id,
            value,
            remark:
              reason_id === "udt_others" ? (r.other_dt_remark || "").trim() : undefined,
          })),
      };
    });

    const totalOk = formattedRuns.reduce((sum, r) => sum + r.ok_prod, 0);
    const totalHrs = formattedRuns.reduce((sum, r) => sum + r.run_hour, 0);
    const totalPlannedHrs = formattedRuns.reduce((sum, r) => sum + r.planned_hours, 0);

    return {
      runs: formattedRuns,
      ok_prod: totalOk,
      run_hour: totalHrs,
      planned_hours: totalPlannedHrs,
      shift_date: shiftDate,
      shift_id: shift,
      machine_id: machine,
      plant_id: plant,
    };
  }, [runs, shiftDate, shift, machine, plant, selectedShift]);

  const overallMetrics = useMemo(
    () => computeMetrics(overallShiftDraft, master, reasonCodes),
    [overallShiftDraft, master, reasonCodes]
  );

  // Submit all runs as a unified shift record
  function submit() {
    if (!shiftDate) {
      alert("Please select a valid shift date.");
      return;
    }
    if (!machine) {
      alert("Please select a machine.");
      return;
    }

    // Validate each mold run
    for (let i = 0; i < runs.length; i++) {
      const r = runs[i];
      const moldLabel =
        runs.length > 1
          ? `Mold Run #${i + 1} (${r.start_time}–${r.end_time})`
          : "Production Run";
      const rMaster = master.find((m) => m.sap_code === r.sap_code);

      if (!r.sap_code || !rMaster) {
        alert(`${moldLabel}: Please select a valid SAP product code.`);
        const el = document.getElementById(`mold-run-card-${i + 1}`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      if (!r.running_cavity || Number(r.running_cavity) <= 0) {
        alert(`${moldLabel}: Please enter a valid Running Cavity.`);
        const el = document.getElementById(`mold-run-card-${i + 1}`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      const shiftStart = selectedShift?.start_time || "07:00";
      const shiftEnd = selectedShift?.end_time || "19:00";
      const maxAllotted =
        runs.length === 1
          ? Number(selectedShift?.planned_hours || 12.0)
          : calculateHoursBetween(r.start_time || shiftStart, r.end_time || shiftEnd, shiftStart);

      if (r.run_hour === "" || r.run_hour == null || Number(r.run_hour) <= 0) {
        alert(`${moldLabel}: Please enter Run Hours (must be greater than 0).`);
        const el = document.getElementById(`mold-run-card-${i + 1}`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      if (Number(r.run_hour) > maxAllotted + 0.05) {
        alert(
          `${moldLabel}: Run hours (${Number(r.run_hour)}h) cannot exceed the allotted run window (${maxAllotted.toFixed(1)}h).`
        );
        const el = document.getElementById(`mold-run-card-${i + 1}`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      if (r.ok_prod === "" || Number(r.ok_prod) < 0) {
        alert(`${moldLabel}: Enter a valid OK production quantity (0 or greater).`);
        const el = document.getElementById(`mold-run-card-${i + 1}`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      if (!r.hr_mp_declare || Number(r.hr_mp_declare) <= 0) {
        alert(`${moldLabel}: Please enter Manpower Declared.`);
        const el = document.getElementById(`mold-run-card-${i + 1}`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      if (
        Number((r.reasons || {})["udt_others"]) > 0 &&
        (!r.other_dt_remark || !r.other_dt_remark.trim())
      ) {
        alert(`${moldLabel}: Please specify the mandatory reason description for 'OTHERS' downtime.`);
        const el = document.getElementById(`mold-run-card-${i + 1}`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }

      const runMetrics = computeMetrics(
        {
          ...r,
          planned_hours: maxAllotted,
          reasons: Object.entries(r.reasons || {}).map(([reason_id, value]) => ({
            reason_id,
            value,
          })),
        },
        rMaster,
        reasonCodes
      );

      if (runMetrics.planned_dt + runMetrics.unplanned_dt > Number(r.run_hour)) {
        alert(
          `${moldLabel}: Total downtime (${(
            runMetrics.planned_dt + runMetrics.unplanned_dt
          ).toFixed(1)} hrs) cannot exceed run hours (${r.run_hour} hrs).`
        );
        const el = document.getElementById(`mold-run-card-${i + 1}`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
    }

    if (shiftDate > todayStr()) {
      alert("Future date entries are not allowed.");
      return;
    }

    if (isNotStartedYet) {
      alert(
        "This shift has not commenced yet. You can only record data for in-progress or completed shifts."
      );
      return;
    }

    if (isPastTwelveHours && currentUser?.role !== "admin") {
      alert(
        "This shift ended more than 12 hours ago and is locked. New entries cannot be logged for locked shifts."
      );
      return;
    }

    // Format all runs for storage
    const shiftStart = selectedShift?.start_time || "07:00";
    const shiftEnd = selectedShift?.end_time || "19:00";

    const formattedRuns = runs.map((r, idx) => {
      const rMaster = master.find((m) => m.sap_code === r.sap_code);
      const maxAllotted =
        runs.length === 1
          ? Number(selectedShift?.planned_hours || 12.0)
          : calculateHoursBetween(r.start_time || shiftStart, r.end_time || shiftEnd, shiftStart);

      return {
        run_id: r.run_id || `run-${idx + 1}-${Date.now()}`,
        order: idx + 1,
        start_time: r.start_time,
        end_time: r.end_time,
        planned_hours: Number(r.planned_hours) || maxAllotted,
        run_hour: Number(r.run_hour),
        sap_code: r.sap_code,
        material_description: rMaster?.material_description || r.material_description || "",
        part_no: rMaster?.part_no || r.part_no || "",
        shots_per_hour: rMaster?.shots_per_hour || 60,
        price: rMaster?.price || 0,
        part_wt: rMaster?.part_wt || 0,
        run_wt: rMaster?.run_wt || 0,
        std_cavity: rMaster?.cavity || 1,
        running_cavity: Number(r.running_cavity),
        hr_mp_declare: Number(r.hr_mp_declare),
        prod_mp_declare: Number(r.prod_mp_declare || r.hr_mp_declare),
        ok_prod: Number(r.ok_prod),
        reasons: Object.entries(r.reasons || {})
          .filter(([, v]) => Number(v) > 0)
          .map(([reason_id, value]) => ({
            reason_id,
            value: Number(value),
            remark: reason_id === "udt_others" ? (r.other_dt_remark || "").trim() : undefined,
          })),
        other_dt_remark:
          Number((r.reasons || {})["udt_others"]) > 0 ? (r.other_dt_remark || "").trim() : null,
        is_continued: Boolean(r.is_continued),
      };
    });

    // Aggregate across runs for top-level backward compatibility
    const totalOkProd = formattedRuns.reduce((sum, r) => sum + r.ok_prod, 0);
    const totalRunHours = formattedRuns.reduce((sum, r) => sum + r.run_hour, 0);
    const totalPlannedHours = formattedRuns.reduce((sum, r) => sum + r.planned_hours, 0);
    const avgCavity =
      formattedRuns.length === 1
        ? formattedRuns[0].running_cavity
        : Math.round(
            formattedRuns.reduce((s, r) => s + r.running_cavity, 0) / formattedRuns.length
          );
    const avgHrMp =
      formattedRuns.length === 1
        ? formattedRuns[0].hr_mp_declare
        : Math.round(
            formattedRuns.reduce((s, r) => s + r.hr_mp_declare, 0) / formattedRuns.length
          );
    const avgProdMp =
      formattedRuns.length === 1
        ? formattedRuns[0].prod_mp_declare
        : Math.round(
            formattedRuns.reduce((s, r) => s + r.prod_mp_declare, 0) / formattedRuns.length
          );

    const aggregatedReasonMap = {};
    formattedRuns.forEach((r) => {
      (r.reasons || []).forEach((item) => {
        aggregatedReasonMap[item.reason_id] =
          (aggregatedReasonMap[item.reason_id] || 0) + Number(item.value);
      });
    });
    const aggregatedReasons = Object.entries(aggregatedReasonMap).map(([reason_id, value]) => ({
      reason_id,
      value,
      remark:
        reason_id === "udt_others"
          ? formattedRuns
              .map((r) => r.other_dt_remark)
              .filter(Boolean)
              .join("; ")
          : undefined,
    }));

    const primarySap = formattedRuns[0].sap_code;
    const sapDisplay =
      formattedRuns.length === 1
        ? primarySap
        : `MULTI (${formattedRuns.map((r) => r.sap_code).join(", ")})`;

    const entry = {
      entry_id: existingEntry?.entry_id || "E-" + Date.now(),
      shift_date: shiftDate,
      shift_id: shift || (shifts[0] ? shifts[0].shift_id : "1"),
      machine_id: machine,
      plant_id: plant || (plants[0] ? plants[0].plant_id : "PLANT-U02"),
      sap_code: sapDisplay,
      primary_sap_code: primarySap,
      runs: formattedRuns,
      running_cavity: avgCavity,
      run_hour: Number(totalRunHours.toFixed(1)),
      planned_hours: Number(totalPlannedHours.toFixed(1)),
      hr_mp_declare: avgHrMp,
      prod_mp_declare: avgProdMp,
      ok_prod: totalOkProd,
      reasons: aggregatedReasons,
      other_dt_remark:
        Number(aggregatedReasonMap["udt_others"]) > 0
          ? formattedRuns.map((r) => r.other_dt_remark).filter(Boolean).join("; ")
          : null,
      status: isPastTwelveHours ? "locked" : "submitted",
      locked_at: isPastTwelveHours ? new Date().toISOString() : null,
      entered_by: existingEntry?.entered_by || currentUser.id,
      entered_by_name: existingEntry?.entered_by_name || currentUser.name,
      created_at: existingEntry?.created_at || new Date().toISOString(),
      last_edited_by: existingEntry ? currentUser.id : null,
      last_edited_at: existingEntry ? new Date().toISOString() : null,
    };

    onSubmit(entry);
    setIsEditingExisting(false);
    alert(
      existingEntry
        ? `Shift entry for machine ${machine} successfully updated!`
        : `Shift entry recorded successfully (${formattedRuns.length} Mold Run${
            formattedRuns.length > 1 ? "s" : ""
          }).`
    );
  }

  const rejectionReasons = reasonCodes.filter((r) => r.category === "rejection");
  const downtimeReasons = reasonCodes.filter(
    (r) => r.category === "planned_dt" || r.category === "unplanned_dt"
  );
  const selectedMachineNo =
    machines.find((m) => m.machine_id === machine)?.machine_no || machine;

  const isFormReadOnly = isLocked || (Boolean(existingEntry) && !isEditingExisting);

  return (
    <div className={`card ${isLocked ? "is-locked-form" : ""}`}>
      {/* 1. Location & Shift Workspace Header */}
      <div className="grid4" style={{ marginBottom: "14px" }}>
        <div className="form-row">
          <label>Plant / Unit</label>
          {plants.length === 1 ? (
            <div
              style={{
                height: "36px",
                display: "flex",
                alignItems: "center",
                padding: "0 10px",
                background: "#f1f5f9",
                border: "1px solid #cbd5e1",
                borderRadius: "6px",
                fontSize: "12.5px",
                fontWeight: 700,
                color: "#0f172a",
                gap: "6px",
              }}
            >
              <span>🔒</span>
              <span>
                {plants[0].name}{" "}
                {locations.find((l) => l.location_id === plants[0].location_id)
                  ? `(${locations.find((l) => l.location_id === plants[0].location_id).name})`
                  : ""}
              </span>
            </div>
          ) : (
            <select value={plant} onChange={(e) => setPlant(e.target.value)}>
              {plants.map((p) => {
                const loc = locations.find((l) => l.location_id === p.location_id);
                return (
                  <option key={p.plant_id} value={p.plant_id}>
                    {p.name} {loc ? `(${loc.name})` : ""}
                  </option>
                );
              })}
            </select>
          )}
        </div>
        <div className="form-row">
          <label>Shift Date</label>
          <input
            type="date"
            value={shiftDate}
            max={todayStr()}
            onChange={(e) => setShiftDate(e.target.value)}
          />
        </div>
        <div className="form-row">
          <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Shift</span>
            {selectedShift?.planned_hours && (
              <span style={{ fontSize: "11px", color: "var(--brand-primary)", fontWeight: 700 }}>
                ⏱️ {selectedShift.planned_hours}h planned
              </span>
            )}
          </label>
          <select value={shift} onChange={(e) => handleShiftChange(e.target.value)}>
            {shifts.map((s) => (
              <option key={s.shift_id} value={s.shift_id}>
                {s.name || `Shift ${s.shift_id}`} ({s.start_time}–{s.end_time})
              </option>
            ))}
          </select>
        </div>
        <div className="form-row">
          <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Machine</span>
            <span style={{ fontSize: "11px", color: "var(--ink-faint)", fontWeight: 600 }}>
              {plantMachines.length} at this unit
            </span>
          </label>
          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <SearchableMachineSelect
                value={machine}
                onChange={handleMachineSelect}
                machines={plantMachines}
                disabled={isLocked}
              />
            </div>
            {!isFormReadOnly && (
              <button
                type="button"
                onClick={handleAddMoldRun}
                disabled={!machine || runs.length >= 4}
                title={
                  !machine
                    ? "Please select a machine first to add mold"
                    : runs.length >= 4
                    ? "Maximum 4 molds per shift reached"
                    : "Add another mold run (mid-shift mold change)"
                }
                style={{
                  height: "38px",
                  padding: "0 12px",
                  background: !machine || runs.length >= 4 ? "#f1f5f9" : "#16a34a",
                  color: !machine || runs.length >= 4 ? "#94a3b8" : "#ffffff",
                  border: !machine || runs.length >= 4 ? "1px solid #cbd5e1" : "none",
                  borderRadius: "8px",
                  fontWeight: 700,
                  fontSize: "12px",
                  cursor: !machine || runs.length >= 4 ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                  boxShadow: !machine || runs.length >= 4 ? "none" : "0 1px 3px rgba(22, 163, 74, 0.25)",
                  transition: "all 0.15s ease",
                }}
              >
                <span>➕</span>
                <span>Add Mold</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Existing Entry Notice (Workflow: Already Saved -> Prompt to Edit or Switch) */}
      {existingEntry && !isEditingExisting && !isLocked && (
        <div className="existing-entry-notice">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "22px" }}>📋</span>
            <div>
              <strong>Entry Already Saved for this Machine & Shift!</strong>
              <div style={{ fontSize: "12.5px", marginTop: "2px", opacity: 0.9 }}>
                Record for <strong>{selectedMachineNo}</strong> on{" "}
                <strong>{formatShiftDateDisplay(shiftDate)}</strong> (
                {selectedShift.name || `Shift ${shift}`}) has already been recorded.
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setRuns(convertExistingEntryToRuns(existingEntry, selectedShift));
                setIsEditingExisting(true);
              }}
              style={{ background: "#2563eb", borderColor: "#1d4ed8" }}
            >
              ✏️ Edit / Update This Entry
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setMachine("")}
              style={{ background: "#ffffff", border: "1.5px solid #cbd5e1", color: "#334155" }}
            >
              Select Different Machine
            </button>
          </div>
        </div>
      )}

      {/* 2. Stacked Mold Run Forms (Each Mold displayed directly underneath the other) */}
      {machine ? (
        <div style={{ marginTop: "16px" }}>
          {runs.map((r, idx) => (
            <MoldRunCard
              key={r.run_id || idx}
              run={r}
              idx={idx}
              totalRuns={runs.length}
              nextRun={runs[idx + 1] || null}
              prevRun={runs[idx - 1] || null}
              selectedShift={selectedShift}
              master={master}
              rejectionReasons={rejectionReasons}
              downtimeReasons={downtimeReasons}
              reasonCodes={reasonCodes}
              isFormReadOnly={isFormReadOnly}
              machine={machine}
              isLocked={isLocked}
              prevShiftInfo={idx === 0 ? prevShiftInfo : null}
              prevMaster={idx === 0 ? prevMaster : null}
              hasDecidedPrevMold={hasDecidedPrevMold}
              openSearchableDropdown={openSearchableIdx === idx}
              setOpenSearchableDropdown={(open) => setOpenSearchableIdx(open ? idx : null)}
              onSapTriggerClick={idx === 0 ? () => handleSapTriggerClick(idx) : null}
              onOpenPrevMoldModal={
                idx === 0 && prevShiftInfo && prevMaster
                  ? () => {
                      setShowSapPrompt(true);
                      setModalOption("continue");
                    }
                  : null
              }
              updateRun={(fieldOrObj, val) => updateRun(idx, fieldOrObj, val)}
              handleRunSapChange={(newSap) => handleRunSapChange(idx, newSap)}
              handleRunReasonChange={(reasonId, val) => handleRunReasonChange(idx, reasonId, val)}
              handleRunOtherRemark={(val) => handleRunOtherRemark(idx, val)}
              handleStartTimeChange={handleStartTimeChange}
              handleRemoveMoldRun={() => handleRemoveMoldRun(idx)}
            />
          ))}



          {/* Total Machine Shift Summary Bar (Rendered when > 1 mold run) */}
          {runs.length > 1 && (
            <div
              className="shift-total-summary-bar"
              style={{ marginTop: "10px", marginBottom: "20px" }}
            >
              <div className="summary-stat-box">
                <span className="summary-stat-label">Total Molds Run</span>
                <span className="summary-stat-val">🔄 {runs.length} Molds</span>
              </div>
              <div className="summary-stat-box">
                <span className="summary-stat-label">Total Shift Duration</span>
                <span className="summary-stat-val">⏱️ {overallShiftDraft.run_hour.toFixed(1)}h</span>
              </div>
              <div className="summary-stat-box">
                <span className="summary-stat-label">Total Shift OK Prod</span>
                <span className="summary-stat-val" style={{ color: "#4ade80" }}>
                  ✓ {overallShiftDraft.ok_prod.toLocaleString()} pcs
                </span>
              </div>
              <div className="summary-stat-box">
                <span className="summary-stat-label">Total Rejections</span>
                <span
                  className="summary-stat-val"
                  style={{ color: overallMetrics.total_rej > 0 ? "#f87171" : "#94a3b8" }}
                >
                  {overallMetrics.total_rej.toLocaleString()} pcs
                </span>
              </div>
              <div className="summary-stat-box">
                <span className="summary-stat-label">Total Downtime</span>
                <span className="summary-stat-val" style={{ color: "#38bdf8" }}>
                  {Math.round((overallMetrics.planned_dt + overallMetrics.unplanned_dt) * 60)} mins
                </span>
              </div>
              <div className="summary-stat-box">
                <span className="summary-stat-label">Combined Shift OEE</span>
                <span className="summary-stat-val" style={{ color: "#fbbf24" }}>
                  {pct(overallMetrics.oee)}
                </span>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div
          style={{
            padding: "40px 20px",
            textAlign: "center",
            background: "#f8fafc",
            border: "1.5px dashed #cbd5e1",
            borderRadius: "10px",
            color: "#64748b",
            marginTop: "14px",
            marginBottom: "20px",
          }}
        >
          <div style={{ fontSize: "32px", marginBottom: "8px" }}>🏭</div>
          <div style={{ fontWeight: 700, fontSize: "14px", color: "#334155" }}>
            Please Select a Machine to Begin Production Entry
          </div>
          <div style={{ fontSize: "12px", marginTop: "4px" }}>
            Choose a machine from the unit above to load or record shift production runs.
          </div>
        </div>
      )}

      {/* Submit / Update Bar */}
      <div
        style={{
          marginTop: "24px",
          display: "flex",
          gap: "12px",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <button
          className="btn"
          onClick={submit}
          disabled={isFormReadOnly || !machine || runs.some((r) => !r.sap_code)}
          style={{
            padding: "12px 28px",
            fontSize: "14px",
            background:
              isFormReadOnly || !machine || runs.some((r) => !r.sap_code) ? "#f1f5f9" : undefined,
            color:
              isFormReadOnly || !machine || runs.some((r) => !r.sap_code) ? "#64748b" : undefined,
            border:
              isFormReadOnly || !machine || runs.some((r) => !r.sap_code)
                ? "1.5px solid #cbd5e1"
                : undefined,
            boxShadow:
              isFormReadOnly || !machine || runs.some((r) => !r.sap_code) ? "none" : undefined,
            cursor:
              isFormReadOnly || !machine || runs.some((r) => !r.sap_code)
                ? "not-allowed"
                : "pointer",
            opacity: isFormReadOnly || !machine || runs.some((r) => !r.sap_code) ? 0.9 : 1,
            fontWeight: 700,
          }}
        >
          {isPastTwelveHours
            ? existingEntry
              ? "🔒 Locked Record (View Only)"
              : "🔒 Shift Cutoff Expired"
            : isNotStartedYet
            ? "⏳ Shift Not Started Yet"
            : !machine
            ? "Select Machine"
            : runs.some((r) => !r.sap_code)
            ? "Select SAP Code for All Molds"
            : existingEntry || isEditingExisting
            ? `✓ Update Saved Shift Entry (${selectedMachineNo})`
            : `✓ Submit Shift Entry (${runs.length} Mold Run${runs.length > 1 ? "s" : ""})`}
        </button>
        <span style={{ fontSize: "12px", color: "var(--ink-faint)" }}>
          {isPastTwelveHours
            ? existingEntry
              ? `Viewing historical shift record for ${existingEntry.machine_id}.`
              : "Historical shifts older than 12 hours cannot be edited or submitted."
            : !machine
            ? "Choose machine & SAP code to log shift production."
            : runs.some((r) => !r.sap_code)
            ? "Please select SAP product codes for all mold runs before submitting."
            : existingEntry || isEditingExisting
            ? `Editing existing record for ${selectedMachineNo}. Changes will update the entry in place.`
            : "Entry will be saved to plant register and locked at daily cutoff."}
        </span>
      </div>

      {/* PREVIOUS SHIFT MOLD STATUS POP-UP MODAL */}
      {showSapPrompt && prevShiftInfo && prevMaster && (
        <div className="modal-back" onClick={handleCloseSapPrompt}>
          <div
            className="modal"
            style={{
              maxWidth: "680px",
              padding: "26px",
              border: "1.5px solid #cbd5e1",
              maxHeight: "92vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="modal-head" style={{ marginBottom: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span
                  style={{
                    fontSize: "24px",
                    background: "#eff6ff",
                    border: "1.5px solid #bfdbfe",
                    borderRadius: "10px",
                    padding: "6px 10px",
                    lineHeight: 1,
                  }}
                >
                  🏭
                </span>
                <div>
                  <h3 style={{ margin: 0, fontSize: "17.5px", fontWeight: 800, color: "#0f172a" }}>
                    Machine {selectedMachineNo} — Previous Shift Mold Detected
                  </h3>
                  <p style={{ margin: "3px 0 0", fontSize: "12.5px", color: "#64748b" }}>
                    Identify if this machine continued running the same mold or if a mold change occurred.
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={handleCloseSapPrompt}
                title="Close"
              >
                ✕
              </button>
            </div>

            {/* Previous Mold Info Banner */}
            <div
              style={{
                background: "linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)",
                border: "1.5px solid #86efac",
                borderRadius: "10px",
                padding: "14px 18px",
                marginBottom: "18px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "6px",
                  flexWrap: "wrap",
                  gap: "6px",
                }}
              >
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    color: "#166534",
                    background: "#dcfce7",
                    padding: "2px 8px",
                    borderRadius: "4px",
                  }}
                >
                  ✓ Mold Mounted in Preceding Shift
                </span>
                <span style={{ fontSize: "12px", fontWeight: 600, color: "#15803d" }}>
                  {prevShiftInfo.shift_id === "1" ? "Day Shift" : "Night Shift"} ({formatShiftDateDisplay(prevShiftInfo.shift_date)})
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "8px", flexWrap: "wrap" }}>
                <span className="mono" style={{ fontSize: "17px", fontWeight: 800, color: "#14532d" }}>
                  {prevShiftInfo.sap_code}
                </span>
                {prevMaster.part_no && (
                  <span style={{ fontSize: "14px", fontWeight: 700, color: "#166534" }}>
                    PN: {prevMaster.part_no}
                  </span>
                )}
              </div>
              <div style={{ fontSize: "13.5px", fontWeight: 700, color: "#1f2937", marginTop: "3px" }}>
                {prevMaster.material_description}
              </div>
              <div style={{ fontSize: "12px", color: "#4b5563", marginTop: "5px" }}>
                Standard Cavity: <strong>{prevMaster.cavity || 1}</strong> · Target:{" "}
                <strong>{prevMaster.shots_per_hour || 60} shots/hr</strong> · Declared Manpower:{" "}
                <strong>{prevMaster.manpower || 2}</strong>
              </div>
            </div>

            {/* Prompt Question */}
            <div style={{ fontWeight: 800, fontSize: "13.5px", color: "#1e293b", marginBottom: "12px" }}>
              What happened on Machine {selectedMachineNo} for this shift?
            </div>

            {/* Interactive Options Cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
              {/* Option 1: Continue Same Mold (Full Shift) */}
              <div
                onClick={() => setModalOption("continue")}
                style={{
                  padding: "14px 16px",
                  borderRadius: "10px",
                  border: modalOption === "continue" ? "2px solid #16a34a" : "1.5px solid #e2e8f0",
                  background: modalOption === "continue" ? "#f0fdf4" : "#ffffff",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "12px",
                }}
              >
                <input
                  type="radio"
                  name="prevMoldOption"
                  checked={modalOption === "continue"}
                  onChange={() => setModalOption("continue")}
                  style={{ marginTop: "4px", cursor: "pointer", width: "16px", height: "16px" }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontWeight: 800, fontSize: "14px", color: "#166534" }}>
                      ⚡ Same Mold (Full 12h Shift Run)
                    </span>
                    <span
                      style={{
                        fontSize: "11.5px",
                        fontWeight: 700,
                        color: "#15803d",
                        background: "#dcfce7",
                        padding: "2px 8px",
                        borderRadius: "4px",
                      }}
                    >
                      {selectedShift.planned_hours || 12} hrs
                    </span>
                  </div>
                  <div style={{ fontSize: "12.5px", color: "#374151", marginTop: "3px" }}>
                    Machine continued running <strong>{prevShiftInfo.sap_code}</strong> for the entire shift.
                    Auto-selects this mold and standard specifications instantly.
                  </div>
                </div>
              </div>

              {/* Option 2: Mold Changed Mid-Shift */}
              <div
                onClick={() => setModalOption("mid_shift")}
                style={{
                  padding: "14px 16px",
                  borderRadius: "10px",
                  border: modalOption === "mid_shift" ? "2px solid #2563eb" : "1.5px solid #e2e8f0",
                  background: modalOption === "mid_shift" ? "#eff6ff" : "#ffffff",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "12px",
                }}
              >
                <input
                  type="radio"
                  name="prevMoldOption"
                  checked={modalOption === "mid_shift"}
                  onChange={() => setModalOption("mid_shift")}
                  style={{ marginTop: "4px", cursor: "pointer", width: "16px", height: "16px" }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontWeight: 800, fontSize: "14px", color: "#1d4ed8" }}>
                      🔄 Mold Changed Mid-Shift (Previous Mold Ran First)
                    </span>
                    <span
                      style={{
                        fontSize: "11.5px",
                        fontWeight: 700,
                        color: "#1e40af",
                        background: "#dbeafe",
                        padding: "2px 8px",
                        borderRadius: "4px",
                      }}
                    >
                      2 Molds
                    </span>
                  </div>
                  <div style={{ fontSize: "12.5px", color: "#374151", marginTop: "3px" }}>
                    Previous mold <strong>{prevShiftInfo.sap_code}</strong> ran for the first part of the shift, then changed to a new mold.
                  </div>

                  {/* Sub-section: Handover Time Picker */}
                  {modalOption === "mid_shift" && (
                    <div
                      style={{
                        marginTop: "12px",
                        padding: "12px 14px",
                        background: "#ffffff",
                        border: "1.5px solid #93c5fd",
                        borderRadius: "8px",
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <label
                        style={{
                          display: "block",
                          fontSize: "12.5px",
                          fontWeight: 700,
                          color: "#1e3a8a",
                          marginBottom: "6px",
                        }}
                      >
                        ⏱️ What time did the Previous Mold STOP running? (New Mold started at this time)
                      </label>
                      <select
                        value={modalHandoverTime}
                        onChange={(e) => setModalHandoverTime(e.target.value)}
                        style={{
                          width: "100%",
                          height: "38px",
                          fontSize: "13px",
                          fontWeight: 700,
                          borderRadius: "6px",
                          border: "1.5px solid #3b82f6",
                          padding: "0 10px",
                          background: "#f0fdf4",
                        }}
                      >
                        {handoverOptions.map((opt) => (
                          <option key={opt.time} value={opt.time}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <div
                        style={{
                          fontSize: "12px",
                          color: "#1e40af",
                          marginTop: "8px",
                          lineHeight: "1.5",
                        }}
                      >
                        <div>
                          • <strong>Mold #1 ({prevShiftInfo.sap_code})</strong>:{" "}
                          {selectedShift?.start_time || "07:00"} – {modalHandoverTime} (
                          {calculateHoursBetween(
                            selectedShift?.start_time || "07:00",
                            modalHandoverTime,
                            selectedShift?.start_time || "07:00"
                          ).toFixed(1)}{" "}
                          hrs)
                        </div>
                        <div>
                          • <strong>Mold #2 (New Mold)</strong>: {modalHandoverTime} –{" "}
                          {selectedShift?.end_time || "19:00"} (
                          {calculateHoursBetween(
                            modalHandoverTime,
                            selectedShift?.end_time || "19:00",
                            selectedShift?.start_time || "07:00"
                          ).toFixed(1)}{" "}
                          hrs)
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Option 3: Changed Before Shift Started */}
              <div
                onClick={() => setModalOption("new_mold")}
                style={{
                  padding: "14px 16px",
                  borderRadius: "10px",
                  border: modalOption === "new_mold" ? "2px solid #8b5cf6" : "1.5px solid #e2e8f0",
                  background: modalOption === "new_mold" ? "#f5f3ff" : "#ffffff",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "12px",
                }}
              >
                <input
                  type="radio"
                  name="prevMoldOption"
                  checked={modalOption === "new_mold"}
                  onChange={() => setModalOption("new_mold")}
                  style={{ marginTop: "4px", cursor: "pointer", width: "16px", height: "16px" }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontWeight: 800, fontSize: "14px", color: "#6d28d9" }}>
                      🆕 Changed Before Shift Started (New Mold Ran Full Shift)
                    </span>
                    <span
                      style={{
                        fontSize: "11.5px",
                        fontWeight: 700,
                        color: "#7c3aed",
                        background: "#ede9fe",
                        padding: "2px 8px",
                        borderRadius: "4px",
                      }}
                    >
                      Fresh Run
                    </span>
                  </div>
                  <div style={{ fontSize: "12.5px", color: "#374151", marginTop: "3px" }}>
                    Previous mold was already unmounted before shift started. A completely new mold ran for the entire 12h shift.
                  </div>
                </div>
              </div>
            </div>

            {/* Mandatory Decision Notice */}
            <div
              style={{
                fontSize: "12px",
                color: "#64748b",
                marginBottom: "16px",
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "6px",
                padding: "8px 12px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span>ℹ️</span>
              <span>
                <strong>Mandatory Decision:</strong> Please declare whether the previous mold continued or changed. Closing without selecting keeps the decision pending and will not open the SAP dropdown.
              </span>
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleCloseSapPrompt}
                style={{ padding: "10px 18px", fontWeight: 700 }}
              >
                ✕ Close (Decision Pending)
              </button>

              {modalOption === "continue" && (
                <button
                  type="button"
                  onClick={handleConfirmContinueSameMold}
                  style={{
                    padding: "10px 22px",
                    background: "#16a34a",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "8px",
                    fontWeight: 800,
                    fontSize: "13.5px",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    boxShadow: "0 2px 4px rgba(22, 163, 74, 0.25)",
                  }}
                >
                  <span>⚡</span>
                  <span>Continue Same Mold ({prevShiftInfo.sap_code})</span>
                </button>
              )}

              {modalOption === "mid_shift" && (
                <button
                  type="button"
                  onClick={handleConfirmMidShiftChange}
                  style={{
                    padding: "10px 22px",
                    background: "#2563eb",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "8px",
                    fontWeight: 800,
                    fontSize: "13.5px",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    boxShadow: "0 2px 4px rgba(37, 99, 235, 0.25)",
                  }}
                >
                  <span>✓</span>
                  <span>Confirm Handover & Pick New Mold</span>
                </button>
              )}

              {modalOption === "new_mold" && (
                <button
                  type="button"
                  onClick={handleConfirmNewMoldShiftStart}
                  style={{
                    padding: "10px 22px",
                    background: "#7c3aed",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "8px",
                    fontWeight: 800,
                    fontSize: "13.5px",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    boxShadow: "0 2px 4px rgba(124, 58, 237, 0.25)",
                  }}
                >
                  <span>🔍</span>
                  <span>Select New SAP Code</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
