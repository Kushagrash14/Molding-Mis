import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import ShiftKpiCards from "./ShiftKpiCards.jsx";
import MachineSheetRow from "./MachineSheetRow.jsx";
import RejectionModal from "./RejectionModal.jsx";
import DowntimeModal from "./DowntimeModal.jsx";
import PreviousShiftMoldModal from "./PreviousShiftMoldModal.jsx";
import {
  getActiveShift,
  getProductionShiftDate,
  calculateHoursBetween,
  getShiftOffsetMinutes,
  timeToMinutes,
  minutesToTime,
  isEntryPastTwelveHours,
  isShiftStartedYet,
  formatShiftDateDisplay,
  computeMetrics,
  getPreviousShiftInfo,
  calculateTotalDowntimeMinutes,
  normalizeReasonsMap,
} from "../lib/calculations.js";

function createDefaultRunForShift(shiftObj, id = "run-1") {
  const start = shiftObj?.start_time || "07:00";
  const end = shiftObj?.end_time || "19:00";
  const hrs = Number(shiftObj?.planned_hours || 12.0);
  return {
    run_id: id,
    start_time: start,
    end_time: end,
    planned_hours: hrs,
    run_hour: hrs,
    sap_code: "",
    material_description: "",
    part_no: "",
    std_cavity: 1,
    running_cavity: "",
    manpower: "",
    ok_prod: "",
    reasons: {},
    other_dt_remark: "",
    is_continued: false,
    change_over_time: null,
    change_over_confirmed: false,
  };
}

function convertSavedEntryToRuns(entry, shiftObj) {
  const shiftStart = shiftObj?.start_time || "07:00";
  const shiftEnd = shiftObj?.end_time || "19:00";
  const defaultHrs = Number(shiftObj?.planned_hours || 12.0);

  if (entry.runs && Array.isArray(entry.runs) && entry.runs.length > 0) {
    return entry.runs.map((r, idx) => {
      const p = calculateHoursBetween(r.start_time || shiftStart, r.end_time || shiftEnd, shiftStart);
      return {
        run_id: r.run_id || `run-${idx + 1}`,
        start_time: r.start_time || shiftStart,
        end_time: r.end_time || shiftEnd,
        planned_hours: Number(r.planned_hours) || p || defaultHrs,
        run_hour: r.run_hour !== undefined && r.run_hour !== null ? Number(r.run_hour) : defaultHrs,
        sap_code: r.sap_code || "",
        material_description: r.material_description || "",
        part_no: r.part_no || "",
        std_cavity: Number(r.std_cavity || r.running_cavity || 1),
        running_cavity: r.running_cavity !== undefined ? r.running_cavity : "",
        manpower: r.manpower !== undefined ? r.manpower : r.hr_mp_declare || "",
        ok_prod: r.ok_prod !== undefined ? String(r.ok_prod) : "",
        reasons: normalizeReasonsMap(r.reasons),
        other_dt_remark:
          r.other_dt_remark ||
          (Array.isArray(r.reasons)
            ? r.reasons.find((item) => item.reason_id === "udt_others")?.remark
            : "") ||
          "",
        is_continued: Boolean(r.is_continued),
        change_over_time: (r.change_over_time !== undefined && r.change_over_time !== null && r.change_over_time !== "")
          ? Number(r.change_over_time)
          : null,
        change_over_confirmed: Boolean(r.change_over_confirmed || (r.change_over_time !== undefined && r.change_over_time !== null && r.sap_code)),
      };
    });
  }

  // Single legacy entry fallback
  const reasonMap = {};
  (entry.reasons || []).forEach((r) => {
    reasonMap[r.reason_id] = r.value;
  });
  const otherR = (entry.reasons || []).find((r) => r.reason_id === "udt_others");

  return [
    {
      run_id: "run-1",
      start_time: shiftStart,
      end_time: shiftEnd,
      planned_hours: defaultHrs,
      run_hour: entry.run_hour !== undefined && entry.run_hour !== null ? Number(entry.run_hour) : defaultHrs,
      sap_code: entry.primary_sap_code || entry.sap_code || "",
      material_description: "",
      part_no: "",
      std_cavity: Number(entry.running_cavity || 1),
      running_cavity: entry.running_cavity !== undefined ? entry.running_cavity : "",
      manpower: entry.hr_mp_declare !== undefined ? entry.hr_mp_declare : "",
      ok_prod: entry.ok_prod !== undefined ? String(entry.ok_prod) : "",
      reasons: normalizeReasonsMap(entry.reasons),
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
  selectedShiftDate,
  selectedShiftId,
  onSubmit,
  onDirtyChange,
  currentUser,
}) {
  const plant = selectedPlantId || plants[0]?.plant_id || "1040";
  const shiftDate = selectedShiftDate || getProductionShiftDate(shifts);
  const activeShift = useMemo(() => getActiveShift(shifts), [shifts]);
  const shift = selectedShiftId || activeShift?.shift_id || "1";

  const selectedShift = useMemo(() => {
    return shifts.find((s) => s.shift_id === shift) || shifts[0] || {};
  }, [shifts, shift]);

  // Dynamically filter machines by manufacturing plant (strictly for selected plant)
  const plantMachines = useMemo(() => {
    if (!plant) return machines;
    return machines.filter((m) => m.plant_id === plant);
  }, [machines, plant]);

  // Dynamically filter master products by manufacturing plant
  const plantMaster = useMemo(() => {
    if (!plant) return master;
    return master.filter((p) => !p.plant_id || p.plant_id === plant);
  }, [master, plant]);

  // Lock check
  const isPastTwelveHours = useMemo(() => {
    return isEntryPastTwelveHours({ shift_date: shiftDate, shift_id: shift }, shifts);
  }, [shiftDate, shift, shifts]);

  const isNotStartedYet = useMemo(() => {
    return !isShiftStartedYet(shiftDate, selectedShift);
  }, [shiftDate, selectedShift]);

  const isFormLocked = isPastTwelveHours || isNotStartedYet;

  // Search & Filter Toolbar State
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBay, setSelectedBay] = useState("ALL");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("ALL"); // "ALL" | "LOGGED" | "PENDING"

  // Multi-Machine Sheet Matrix Data: { [machine_id]: runs[] }
  const [sheetData, setSheetData] = useState({});
  const [dirtyMachines, setDirtyMachines] = useState(new Set());
  const [savedMachines, setSavedMachines] = useState(new Set());

  // Keep a stable ref to latest entries so the initialization effect can read current
  // entries WITHOUT having entries in its dependency array (prevents sheet reset on sync)
  const entriesRef = useRef(entries);
  useEffect(() => {
    entriesRef.current = entries;
  }); // runs every render but does NOT trigger other effects

  // Report dirty machines to parent App.jsx so sync can protect them
  useEffect(() => {
    onDirtyChange?.(dirtyMachines);
  }, [dirtyMachines, onDirtyChange]);

  // Modals state
  const [activeRejModal, setActiveRejModal] = useState(null); // { machineId, runIdx }
  const [activeDtModal, setActiveDtModal] = useState(null);   // { machineId, runIdx }
  const [prevMoldModalMachineId, setPrevMoldModalMachineId] = useState(null); // machine_id

  // Extract unique Bays from machine numbers (e.g. "BAY-1", "BAY-2")
  const availableBays = useMemo(() => {
    const bays = new Set();
    plantMachines.forEach((m) => {
      const match = (m.machine_no || "").match(/BAY-?(\d+)/i);
      if (match) bays.add(`BAY-${match[1]}`);
    });
    return Array.from(bays).sort();
  }, [plantMachines]);

  // Stable ref to selectedShift so initialization effect can use latest value
  // WITHOUT selectedShift being in the dependency array (prevents reset on sync)
  const selectedShiftRef = useRef(selectedShift);
  useEffect(() => {
    selectedShiftRef.current = selectedShift;
  }); // runs every render, no effect triggered

  // Initialize sheet matrix whenever plant, shift ID, shiftDate, or plantMachines change.
  // CRITICAL: `entries` and `selectedShift` are intentionally NOT in this dependency array.
  //   - entries excluded → cloud sync (setEntries) won't reset sheet mid-entry
  //   - selectedShift excluded → setShifts() during sync won't reset sheet
  //     (shift ID string `shift` already handles "user switched to different shift")
  // We use entriesRef.current and selectedShiftRef.current to read latest values safely.
  useEffect(() => {
    const currentEntries = entriesRef.current;
    const currentShift = selectedShiftRef.current;
    const initialSheet = {};
    const initialSaved = new Set();

    plantMachines.forEach((m) => {
      const existing = currentEntries.find(
        (e) =>
          e.machine_id === m.machine_id &&
          e.shift_date === shiftDate &&
          e.shift_id === shift &&
          (!plant || e.plant_id === plant)
      );

      if (existing) {
        initialSheet[m.machine_id] = convertSavedEntryToRuns(existing, currentShift);
        initialSaved.add(m.machine_id);
      } else {
        initialSheet[m.machine_id] = [createDefaultRunForShift(currentShift)];
      }
    });

    setSheetData(initialSheet);
    setSavedMachines(initialSaved);
    setDirtyMachines(new Set());
  }, [plantMachines, shiftDate, shift, plant]); // ← entries & selectedShift intentionally excluded



  // Update a single run within a machine's runs array
  const handleUpdateRun = useCallback((machineId, runIdx, fieldOrObj, val) => {
    setSheetData((prev) => {
      const curRuns = prev[machineId] || [createDefaultRunForShift(selectedShift)];
      const updatedRuns = curRuns.map((r, idx) => {
        if (idx !== runIdx) return r;
        if (typeof fieldOrObj === "object") {
          const updated = { ...r, ...fieldOrObj };
          if ("reasons" in fieldOrObj && !("run_hour" in fieldOrObj)) {
            const dtMins = calculateTotalDowntimeMinutes(updated.reasons, reasonCodes);
            const plannedHrs = Number(updated.planned_hours) || Number(selectedShift?.planned_hours || 12.0);
            const dtHrs = dtMins / 60;
            updated.run_hour = Math.max(0, Number((plannedHrs - dtHrs).toFixed(1)));
          }
          return updated;
        }

        // When downtime/reasons update, automatically decrement running hours by downtime duration!
        // E.g. 300 min downtime on a 12h shift => 12h - 5h = 7.0h Run Hours
        if (fieldOrObj === "reasons") {
          const nextReasons = val;
          const dtMins = calculateTotalDowntimeMinutes(nextReasons, reasonCodes);
          const plannedHrs = Number(r.planned_hours) || Number(selectedShift?.planned_hours || 12.0);
          const dtHrs = dtMins / 60;
          const autoRunHour = Math.max(0, Number((plannedHrs - dtHrs).toFixed(1)));
          return {
            ...r,
            reasons: nextReasons,
            run_hour: autoRunHour,
          };
        }

        return { ...r, [fieldOrObj]: val };
      });
      return { ...prev, [machineId]: updatedRuns };
    });

    setDirtyMachines((prev) => new Set(prev).add(machineId));
  }, [selectedShift, reasonCodes]);

  // Add Mold #2 or Mold #3 sub-run for a machine
  const handleAddMold = useCallback((machineId) => {
    setSheetData((prev) => {
      const curRuns = prev[machineId] || [createDefaultRunForShift(selectedShift)];
      if (curRuns.length >= 5) return prev;

      const shiftStart = selectedShift?.start_time || "07:00";
      const lastRun = curRuns[curRuns.length - 1];

      const startOffset = getShiftOffsetMinutes(lastRun.start_time, shiftStart);
      let endOffset = getShiftOffsetMinutes(lastRun.end_time, shiftStart);
      if (endOffset === 0) endOffset = 1440;
      const availableMinutes = endOffset - startOffset;

      if (availableMinutes < 60) {
        alert("Remaining duration on the last mold run is less than 1 hour. Cannot split further.");
        return prev;
      }

      // Midpoint split in 30-min increments
      const halfMin = Math.round(availableMinutes / 2 / 30) * 30;
      const splitOffset = startOffset + Math.max(30, Math.min(availableMinutes - 30, halfMin));
      const splitTime = minutesToTime(timeToMinutes(shiftStart) + splitOffset);
      const splitDur1 = calculateHoursBetween(lastRun.start_time, splitTime, shiftStart);
      const splitDur2 = calculateHoursBetween(splitTime, lastRun.end_time, shiftStart);

      const lastRunDtMins = calculateTotalDowntimeMinutes(lastRun.reasons, reasonCodes);
      const updatedLastRun = {
        ...lastRun,
        end_time: splitTime,
        planned_hours: splitDur1,
        run_hour: Math.max(0, Number((splitDur1 - (lastRunDtMins / 60)).toFixed(1))),
      };

      const newRun = {
        run_id: `run-${curRuns.length + 1}-${Date.now()}`,
        start_time: splitTime,
        end_time: lastRun.end_time,
        planned_hours: splitDur2,
        run_hour: splitDur2,
        sap_code: "",
        material_description: "",
        part_no: "",
        std_cavity: 1,
        running_cavity: "",
        manpower: "",
        ok_prod: "",
        reasons: {},
        other_dt_remark: "",
        is_continued: false,
        change_over_time: null,
        change_over_confirmed: false,
      };

      const nextRuns = [...curRuns.slice(0, -1), updatedLastRun, newRun];
      return {
        ...prev,
        [machineId]: nextRuns,
      };
    });

    setDirtyMachines((prev) => new Set(prev).add(machineId));
  }, [selectedShift, reasonCodes]);

  // Update start time of Mold runIdx (where runIdx > 0), linking previous run's end time
  const handleUpdateStartTime = useCallback((machineId, runIdx, newStartTime) => {
    setSheetData((prev) => {
      const curRuns = prev[machineId] || [];
      if (runIdx <= 0 || runIdx >= curRuns.length) return prev;

      const shiftStart = selectedShift?.start_time || "07:00";
      const prevRun = curRuns[runIdx - 1];
      const curRun = curRuns[runIdx];

      const prevPlanned = calculateHoursBetween(prevRun.start_time, newStartTime, shiftStart);
      const curPlanned = calculateHoursBetween(newStartTime, curRun.end_time, shiftStart);
      const prevRunDtMins = calculateTotalDowntimeMinutes(prevRun.reasons, reasonCodes);
      const curRunDtMins = calculateTotalDowntimeMinutes(curRun.reasons, reasonCodes);

      const updated = [...curRuns];
      updated[runIdx - 1] = {
        ...prevRun,
        end_time: newStartTime,
        planned_hours: prevPlanned,
        run_hour: Math.max(0, Number((prevPlanned - (prevRunDtMins / 60)).toFixed(1))),
      };
      updated[runIdx] = {
        ...curRun,
        start_time: newStartTime,
        planned_hours: curPlanned,
        run_hour: Math.max(0, Number((curPlanned - (curRunDtMins / 60)).toFixed(1))),
      };

      return {
        ...prev,
        [machineId]: updated,
      };
    });

    setDirtyMachines((prev) => new Set(prev).add(machineId));
  }, [selectedShift, reasonCodes]);

  // Update change_over_time for a sub-run
  const handleUpdateChangeOver = useCallback((machineId, runIdx, minutes) => {
    setSheetData((prev) => {
      const curRuns = prev[machineId] || [];
      if (runIdx <= 0 || runIdx >= curRuns.length) return prev;
      const updated = [...curRuns];
      updated[runIdx] = {
        ...updated[runIdx],
        change_over_time: Number(minutes) || 0,
        change_over_confirmed: true,
      };
      return { ...prev, [machineId]: updated };
    });
    setDirtyMachines((prev) => new Set(prev).add(machineId));
  }, []);

  // Remove a sub-mold run and re-merge hours
  const handleRemoveMold = useCallback((machineId, runIdx) => {
    setSheetData((prev) => {
      const curRuns = prev[machineId] || [];
      if (curRuns.length <= 1) return prev;

      const shiftStart = selectedShift?.start_time || "07:00";
      const nextRuns = [...curRuns];
      if (runIdx === curRuns.length - 1) {
        // Last run removed: extend previous run's end_time to this run's end_time
        const prevRun = { ...nextRuns[runIdx - 1] };
        prevRun.end_time = nextRuns[runIdx].end_time;
        const newDur = calculateHoursBetween(prevRun.start_time, prevRun.end_time, shiftStart);
        const prevDtMins = calculateTotalDowntimeMinutes(prevRun.reasons, reasonCodes);
        prevRun.planned_hours = newDur;
        prevRun.run_hour = Math.max(0, Number((newDur - (prevDtMins / 60)).toFixed(1)));
        nextRuns[runIdx - 1] = prevRun;
        nextRuns.splice(runIdx, 1);
      } else {
        // Intermediate run removed: extend next run's start_time backward
        const nextRun = { ...nextRuns[runIdx + 1] };
        nextRun.start_time = nextRuns[runIdx].start_time;
        const newDur = calculateHoursBetween(nextRun.start_time, nextRun.end_time, shiftStart);
        const nextDtMins = calculateTotalDowntimeMinutes(nextRun.reasons, reasonCodes);
        nextRun.planned_hours = newDur;
        nextRun.run_hour = Math.max(0, Number((newDur - (nextDtMins / 60)).toFixed(1)));
        nextRuns[runIdx + 1] = nextRun;
        nextRuns.splice(runIdx, 1);
      }

      return {
        ...prev,
        [machineId]: nextRuns,
      };
    });

    setDirtyMachines((prev) => new Set(prev).add(machineId));
  }, [selectedShift, reasonCodes]);

  // Memoized previous shift info lookup for all plant machines
  const prevShiftMap = useMemo(() => {
    const map = {};
    plantMachines.forEach((m) => {
      const info = getPreviousShiftInfo(m.machine_id, shiftDate, shift, entries, shifts);
      if (info && info.sap_code) {
        const masterItem = master.find((p) => p.sap_code === info.sap_code);
        map[m.machine_id] = {
          ...info,
          master: masterItem || null,
        };
      }
    });
    return map;
  }, [plantMachines, shiftDate, shift, entries, shifts, master]);

  // Previous Shift Mold Modal Confirmation Handlers
  const handleConfirmContinueSameMold = useCallback((machineId) => {
    const prevInfo = prevShiftMap[machineId];
    if (!prevInfo) return;
    const pMaster = prevInfo.master;
    const defaultHrs = Number(selectedShift?.planned_hours || 12.0);

    handleUpdateRun(machineId, 0, {
      sap_code: prevInfo.sap_code,
      material_description: pMaster?.material_description || "",
      part_no: pMaster?.part_no || "",
      std_cavity: pMaster?.cavity || 1,
      running_cavity: pMaster?.cavity || 1,
      manpower: pMaster?.manpower || 1,
      shots_per_hour: pMaster?.shots_per_hour || 60,
      price: pMaster?.price || 1,
      part_wt: pMaster?.part_wt || 0,
      run_wt: pMaster?.run_wt || 0,
      planned_hours: defaultHrs,
      run_hour: defaultHrs,
      is_continued: true,
      declared_fresh: false,
    });

    setPrevMoldModalMachineId(null);
  }, [prevShiftMap, selectedShift, handleUpdateRun]);

  const handleConfirmMidShiftChange = useCallback((machineId, handoverTime) => {
    const prevInfo = prevShiftMap[machineId];
    if (!prevInfo) return;
    const pMaster = prevInfo.master;
    const shiftStart = selectedShift?.start_time || "07:00";
    const shiftEnd = selectedShift?.end_time || "19:00";

    const dur1 = calculateHoursBetween(shiftStart, handoverTime, shiftStart);
    const dur2 = calculateHoursBetween(handoverTime, shiftEnd, shiftStart);

    const run1 = {
      run_id: `run-1-${Date.now()}`,
      start_time: shiftStart,
      end_time: handoverTime,
      planned_hours: dur1,
      run_hour: dur1,
      sap_code: prevInfo.sap_code,
      material_description: pMaster?.material_description || "",
      part_no: pMaster?.part_no || "",
      std_cavity: pMaster?.cavity || 1,
      running_cavity: pMaster?.cavity || 1,
      manpower: pMaster?.manpower || 1,
      shots_per_hour: pMaster?.shots_per_hour || 60,
      price: pMaster?.price || 1,
      part_wt: pMaster?.part_wt || 0,
      run_wt: pMaster?.run_wt || 0,
      ok_prod: "",
      reasons: {},
      other_dt_remark: "",
      is_continued: true,
      declared_fresh: false,
    };

    const run2 = {
      run_id: `run-2-${Date.now() + 1}`,
      start_time: handoverTime,
      end_time: shiftEnd,
      planned_hours: dur2,
      run_hour: dur2,
      sap_code: "",
      material_description: "",
      part_no: "",
      std_cavity: 1,
      running_cavity: "",
      manpower: "",
      ok_prod: "",
      reasons: {},
      other_dt_remark: "",
      is_continued: false,
      declared_fresh: true,
    };

    setSheetData((prev) => ({
      ...prev,
      [machineId]: [run1, run2],
    }));
    setDirtyMachines((prev) => new Set(prev).add(machineId));
    setPrevMoldModalMachineId(null);
  }, [prevShiftMap, selectedShift]);

  const handleConfirmNewMold = useCallback((machineId) => {
    handleUpdateRun(machineId, 0, {
      declared_fresh: true,
      is_continued: false,
    });
    setPrevMoldModalMachineId(null);
  }, [handleUpdateRun]);

  const prevMoldMachine = useMemo(() => {
    if (!prevMoldModalMachineId) return null;
    return plantMachines.find((m) => m.machine_id === prevMoldModalMachineId) || null;
  }, [prevMoldModalMachineId, plantMachines]);

  const prevMoldTargetInfo = useMemo(() => {
    if (!prevMoldModalMachineId) return null;
    return prevShiftMap[prevMoldModalMachineId] || null;
  }, [prevMoldModalMachineId, prevShiftMap]);

  // Save a single machine's entry
  const handleSaveMachineEntry = useCallback((machineId) => {
    const runs = sheetData[machineId];
    if (!runs || runs.length === 0) return;

    // Validate that if a sap_code is entered, mandatory fields are populated
    for (let i = 0; i < runs.length; i++) {
      const r = runs[i];
      const moldLabel = `Machine ${machineId} (Mold #${i + 1})`;

      // 1. Calculate total downtime logged for this run
      const runDtMins = calculateTotalDowntimeMinutes(r.reasons, reasonCodes);
      const runPlannedHours = Number(r.planned_hours) || Number(selectedShift?.planned_hours || 12.0);
      const runPlannedMins = Math.round(runPlannedHours * 60);
      const isFullShiftDown = runDtMins >= runPlannedMins || runDtMins >= 720;

      // 2. Validate SAP code
      if (!r.sap_code) {
        if (isFullShiftDown) {
          const prevInfo = prevShiftMap[machineId];
          if (prevInfo?.sap_code) {
            r.sap_code = prevInfo.sap_code;
            r.material_description = prevInfo.master?.material_description || "Previous Shift Mold (12h Breakdown)";
            r.part_no = prevInfo.master?.part_no || "";
          } else {
            r.sap_code = "DOWN_12H";
            r.material_description = "Machine Breakdown / Full Shift Downtime (12h)";
            r.part_no = "N/A";
          }
        } else {
          alert(`${moldLabel}: Please select a SAP Product Code.`);
          return;
        }
      }

      // 3. Validate OK Production
      if (isFullShiftDown) {
        // Machine down for full shift (>= 12 hrs): 0 OK production is permitted and expected!
        if (r.ok_prod === "" || r.ok_prod === undefined || r.ok_prod === null) {
          r.ok_prod = "0";
        }
      } else {
        // Machine operated for part of shift: OK production CANNOT be 0 or empty
        if (r.ok_prod === "" || r.ok_prod === undefined || Number(r.ok_prod) <= 0) {
          alert(
            `${moldLabel}: OK production quantity must be greater than 0 because the machine operated during this shift (downtime logged is ${runDtMins}m, less than shift duration of ${runPlannedMins}m / ${runPlannedHours}h).\n\nIf the machine was not operated at all for the entire shift, please log full shift downtime (${runPlannedMins} mins / ${runPlannedHours} hrs).`
          );
          return;
        }
      }

      if (!r.running_cavity || Number(r.running_cavity) <= 0) {
        if (isFullShiftDown) {
          const rMaster = master.find((m) => m.sap_code === r.sap_code);
          r.running_cavity = rMaster?.cavity || 1;
        } else {
          alert(`${moldLabel}: Enter running cavity.`);
          return;
        }
      }

      if (r.manpower === undefined || r.manpower === "" || Number(r.manpower) < 0) {
        if (isFullShiftDown) {
          r.manpower = 0;
        } else {
          alert(`${moldLabel}: Enter manpower.`);
          return;
        }
      } else if (!isFullShiftDown && Number(r.manpower) <= 0) {
        alert(`${moldLabel}: Enter manpower (must be greater than 0).`);
        return;
      }
    }

    // Format entry object
    const formattedRuns = runs.map((r, idx) => {
      const rMaster = master.find((m) => m.sap_code === r.sap_code);
      const runDtMins = calculateTotalDowntimeMinutes(r.reasons, reasonCodes);
      const isFullShiftDown = runDtMins >= 720 || runDtMins >= Math.round((Number(r.planned_hours) || 12) * 60);
      const runReasonsMap = normalizeReasonsMap(r.reasons);
      return {
        run_id: r.run_id || `run-${idx + 1}-${Date.now()}`,
        order: idx + 1,
        start_time: r.start_time,
        end_time: r.end_time,
        planned_hours: Number(r.planned_hours) || Number(selectedShift.planned_hours || 12.0),
        run_hour:
          r.run_hour !== undefined && r.run_hour !== "" && !isNaN(Number(r.run_hour))
            ? Number(r.run_hour)
            : Math.max(0, Number(((Number(r.planned_hours) || Number(selectedShift.planned_hours || 12.0)) - (runDtMins / 60)).toFixed(1))),
        sap_code: r.sap_code,
        material_description: rMaster?.material_description || r.material_description || "",
        part_no: rMaster?.part_no || r.part_no || "",
        shots_per_hour: rMaster?.shots_per_hour || (isFullShiftDown ? 0 : 60),
        price: rMaster?.price || (isFullShiftDown ? 0 : 1),
        part_wt: rMaster?.part_wt || 0,
        run_wt: rMaster?.run_wt || 0,
        std_cavity: rMaster?.cavity || Number(r.running_cavity) || 1,
        running_cavity: Number(r.running_cavity) || 1,
        hr_mp_declare: Number(r.manpower) || 0,
        prod_mp_declare: Number(r.manpower) || 0,
        ok_prod: Number(r.ok_prod) || 0,
        reasons: Object.entries(runReasonsMap)
          .filter(([, v]) => Number(v) > 0)
          .map(([reason_id, value]) => ({
            reason_id,
            value: Number(value),
          })),
        other_dt_remark: (r.other_dt_remark || "").trim() || null,
        change_over_time: idx > 0 ? (Number(r.change_over_time) || 0) : 0,
      };
    });

    const totalOkProd = formattedRuns.reduce((sum, r) => sum + r.ok_prod, 0);
    const totalRunHours = formattedRuns.reduce((sum, r) => sum + r.run_hour, 0);
    const totalPlannedHours = formattedRuns.reduce((sum, r) => sum + r.planned_hours, 0);
    const avgCavity = Math.round(
      formattedRuns.reduce((sum, r) => sum + r.running_cavity, 0) / formattedRuns.length
    );
    const avgManpower = Math.round(
      formattedRuns.reduce((sum, r) => sum + r.hr_mp_declare, 0) / formattedRuns.length
    );

    // Aggregate reasons across runs
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
          ? formattedRuns.map((r) => r.other_dt_remark).filter(Boolean).join("; ")
          : undefined,
    }));

    const primarySap = formattedRuns[0].sap_code;
    const sapDisplay =
      formattedRuns.length === 1
        ? primarySap
        : `MULTI (${formattedRuns.map((r) => r.sap_code).join(", ")})`;

    const existing = entries.find(
      (e) =>
        e.machine_id === machineId &&
        e.shift_date === shiftDate &&
        e.shift_id === shift &&
        (!plant || e.plant_id === plant)
    );

    const entry = {
      entry_id: existing?.entry_id || `E-${Date.now()}-${machineId}`,
      shift_date: shiftDate,
      shift_id: shift,
      machine_id: machineId,
      plant_id: plant,
      sap_code: sapDisplay,
      primary_sap_code: primarySap,
      runs: formattedRuns,
      running_cavity: avgCavity,
      run_hour: Number(totalRunHours.toFixed(1)),
      planned_hours: Number(totalPlannedHours.toFixed(1)),
      hr_mp_declare: avgManpower,
      prod_mp_declare: avgManpower,
      ok_prod: totalOkProd,
      reasons: aggregatedReasons,
      other_dt_remark:
        Number(aggregatedReasonMap["udt_others"]) > 0
          ? formattedRuns.map((r) => r.other_dt_remark).filter(Boolean).join("; ")
          : null,
      status: isPastTwelveHours ? "locked" : "submitted",
      locked_at: isPastTwelveHours ? new Date().toISOString() : null,
      entered_by: existing?.entered_by || currentUser.id,
      entered_by_name: existing?.entered_by_name || currentUser.name,
      created_at: existing?.created_at || new Date().toISOString(),
      last_edited_by: existing ? currentUser.id : null,
      last_edited_at: existing ? new Date().toISOString() : null,
    };

    onSubmit(entry);

    setDirtyMachines((prev) => {
      const next = new Set(prev);
      next.delete(machineId);
      return next;
    });
    setSavedMachines((prev) => new Set(prev).add(machineId));
  }, [sheetData, master, selectedShift, entries, shiftDate, shift, plant, isPastTwelveHours, currentUser, onSubmit, prevShiftMap, reasonCodes]);

  // Save all modified machines in batch
  const handleSaveAllModified = useCallback(() => {
    const toSave = Array.from(dirtyMachines).filter((mId) => {
      const runs = sheetData[mId] || [];
      return runs.some(
        (r) => Boolean(r.sap_code) || calculateTotalDowntimeMinutes(r.reasons, reasonCodes) >= 720
      );
    });

    if (toSave.length === 0) {
      alert("No modified machine entries to save.");
      return;
    }

    let savedCount = 0;
    toSave.forEach((mId) => {
      handleSaveMachineEntry(mId);
      savedCount++;
    });

    alert(`Successfully saved ${savedCount} machine entries for ${selectedShift.name || `Shift ${shift}`}!`);
  }, [dirtyMachines, sheetData, handleSaveMachineEntry, selectedShift, shift, reasonCodes]);

  // Filter machines for table rendering based on search and status
  const filteredMachines = useMemo(() => {
    return plantMachines.filter((m) => {
      // 1. Search term (machine name, ID, or Bay)
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const matchesName = (m.machine_no || "").toLowerCase().includes(term);
        const matchesId = (m.machine_id || "").toLowerCase().includes(term);
        if (!matchesName && !matchesId) return false;
      }

      // 2. Status Filter
      if (selectedStatusFilter === "LOGGED") {
        const isLogged = savedMachines.has(m.machine_id);
        if (!isLogged) return false;
      } else if (selectedStatusFilter === "PENDING") {
        const isLogged = savedMachines.has(m.machine_id);
        if (isLogged) return false;
      }

      return true;
    });
  }, [plantMachines, searchTerm, selectedStatusFilter, savedMachines]);

  // Rejection & Downtime Modals active run target
  const activeRejRun = useMemo(() => {
    if (!activeRejModal) return null;
    const runs = sheetData[activeRejModal.machineId] || [];
    return runs[activeRejModal.runIdx] || null;
  }, [activeRejModal, sheetData]);

  const activeDtRun = useMemo(() => {
    if (!activeDtModal) return null;
    const runs = sheetData[activeDtModal.machineId] || [];
    return runs[activeDtModal.runIdx] || null;
  }, [activeDtModal, sheetData]);

  const rejectionReasons = useMemo(() => {
    return reasonCodes.filter((r) => r.category === "rejection");
  }, [reasonCodes]);

  const downtimeReasons = useMemo(() => {
    return reasonCodes.filter((r) => r.category === "planned_dt" || r.category === "unplanned_dt");
  }, [reasonCodes]);

  return (
    <div className="sheet-workspace-container">
      {/* 1. 5 KPI Summary Cards matching user screenshot */}
      <ShiftKpiCards
        entries={entries}
        selectedPlantId={plant}
        selectedShiftDate={shiftDate}
        selectedShiftId={shift}
        master={master}
        reasonCodes={reasonCodes}
      />

      {/* Shift Cutoff & Upcoming Shift Status Banners */}
      {isPastTwelveHours && (
        <div className="shift-lock-alert-banner expired">
          <span className="lock-icon">🔒</span>
          <div className="lock-alert-text">
            <strong>Shift Cutoff Expired (Read-Only Mode):</strong> This shift ({shiftDate} · {selectedShift.name || `Shift ${shift}`}) is past the cutoff grace period (24 hours standard / 48 hours for Saturday shifts). Historical shift records are strictly locked against modification or tampering.
          </div>
        </div>
      )}
      {isNotStartedYet && !isPastTwelveHours && (
        <div className="shift-lock-alert-banner upcoming">
          <span className="lock-icon">⏳</span>
          <div className="lock-alert-text">
            <strong>Upcoming Shift (Read-Only Mode):</strong> This shift has not started yet ({shiftDate} · {selectedShift.start_time}). Data entry will automatically unlock when the shift commences.
          </div>
        </div>
      )}

      {/* 2. Interactive Search, Bay Filter, and Action Bar */}
      <div className="sheet-toolbar-card">
        <div className="toolbar-left-group">
          {/* Machine Quick Search */}
          <div className="sheet-search-wrap">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search machine..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="sheet-search-input"
            />
            {searchTerm && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => setSearchTerm("")}
              >
                ✕
              </button>
            )}
          </div>

          {/* Status Filter Toggle */}
          <div className="status-filter-cluster">
            <button
              type="button"
              className={`status-pill-btn ${selectedStatusFilter === "ALL" ? "active" : ""}`}
              onClick={() => setSelectedStatusFilter("ALL")}
            >
              All
            </button>
            <button
              type="button"
              className={`status-pill-btn ${selectedStatusFilter === "LOGGED" ? "active" : ""}`}
              onClick={() => setSelectedStatusFilter("LOGGED")}
            >
              Saved ({savedMachines.size})
            </button>
            <button
              type="button"
              className={`status-pill-btn ${selectedStatusFilter === "PENDING" ? "active" : ""}`}
              onClick={() => setSelectedStatusFilter("PENDING")}
            >
              Pending ({Math.max(0, plantMachines.length - savedMachines.size)})
            </button>
          </div>
        </div>

        {/* Toolbar Right Group: Batch Save & Counter */}
        <div className="toolbar-right-group">
          {isPastTwelveHours && (
            <div className="toolbar-lock-badge expired">
              <span>🔒 Grace Window Ended</span>
            </div>
          )}
          {isNotStartedYet && !isPastTwelveHours && (
            <div className="toolbar-lock-badge upcoming">
              <span>⏳ Upcoming Shift</span>
            </div>
          )}
          <button
            type="button"
            className="btn-batch-save"
            onClick={handleSaveAllModified}
            disabled={isFormLocked || dirtyMachines.size === 0}
            title={isFormLocked ? "Shift is locked in Read-Only mode" : "Save all changed machine entries for this shift"}
          >
            <span>{isFormLocked ? "🔒" : "💾"}</span>
            <span>{isFormLocked ? "Locked" : `Save All (${dirtyMachines.size})`}</span>
          </button>
        </div>
      </div>

      {/* 3. Multi-Machine Production Sheet (Sticky Header Table) */}
      <div className="sheet-table-outer">
        <table className="sheet-matrix-table">
          <thead>
            <tr>
              <th style={{ width: "105px", textAlign: "left", paddingLeft: "10px" }}>MACHINE</th>
              <th style={{ width: "74px" }} title="Mold Start Time">START TIME</th>
              <th style={{ width: "120px" }}>SAP CODE</th>
              <th style={{ width: "165px", maxWidth: "180px", textAlign: "center" }}>MATERIAL DESCRIPTION</th>
              <th style={{ width: "74px" }} title="Mold End Time">END TIME</th>
              <th style={{ width: "62px" }} title="Standard Mold Cavity (from Product Master)">STD CAV</th>
              <th style={{ width: "50px" }} title="Actual Run Hours">RUN (H)</th>
              <th style={{ width: "58px" }} title="Running Cavity">RUN CAV</th>
              <th style={{ width: "54px" }} title="Declared Manpower">MANPOWER</th>
              <th style={{ width: "68px" }} title="Net Accepted Pieces (Qty)">OK PROD</th>
              <th style={{ width: "76px" }} title="Defective Pieces / Rejections">REJECTIONS</th>
              <th style={{ width: "76px" }} title="Total Downtime (PDT + UDT)">DOWNTIME</th>
              <th style={{ width: "52px" }} title="Live Overall Equipment Effectiveness">OEE %</th>
              <th style={{ width: "118px" }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {filteredMachines.length === 0 ? (
              <tr>
                <td colSpan="14" className="sheet-empty-cell">
                  <div style={{ padding: "40px 20px", textAlign: "center", color: "#64748b" }}>
                    <div style={{ fontSize: "28px", marginBottom: "8px" }}>🏭</div>
                    <div style={{ fontWeight: 700, fontSize: "14px", color: "#334155" }}>
                      {plantMachines.length === 0
                        ? `No machines configured for ${plants.find((p) => p.plant_id === plant)?.name || plant}`
                        : "No machines found matching your filter criteria"}
                    </div>
                    <div style={{ fontSize: "12px", marginTop: "4px" }}>
                      {plantMachines.length === 0
                        ? "Configure machines for this plant in Master Data > Machines."
                        : "Try adjusting the search query."}
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              filteredMachines.map((m) => {
                const runs = sheetData[m.machine_id] || [createDefaultRunForShift(selectedShift)];
                const isModified = dirtyMachines.has(m.machine_id);
                const isSaved = savedMachines.has(m.machine_id);

                return (
                  <MachineSheetRow
                    key={m.machine_id}
                    machine={m}
                    runs={runs}
                    onUpdateRun={(runIdx, fieldOrObj, val) =>
                      handleUpdateRun(m.machine_id, runIdx, fieldOrObj, val)
                    }
                    onUpdateStartTime={(runIdx, newStartTime) =>
                      handleUpdateStartTime(m.machine_id, runIdx, newStartTime)
                    }
                    onUpdateChangeOver={(runIdx, minutes) =>
                      handleUpdateChangeOver(m.machine_id, runIdx, minutes)
                    }
                    onAddMold={() => handleAddMold(m.machine_id)}
                    onRemoveMold={(runIdx) => handleRemoveMold(m.machine_id, runIdx)}
                    onOpenRejectionModal={(runIdx) =>
                      setActiveRejModal({ machineId: m.machine_id, runIdx })
                    }
                    onOpenDowntimeModal={(runIdx) =>
                      setActiveDtModal({ machineId: m.machine_id, runIdx })
                    }
                    prevShiftInfo={prevShiftMap[m.machine_id]}
                    onOpenPrevMoldModal={(machineId) => setPrevMoldModalMachineId(machineId)}
                    master={plantMaster}
                    reasonCodes={reasonCodes}
                    isReadOnly={isFormLocked}
                    selectedShift={selectedShift}
                    onSaveRow={() => handleSaveMachineEntry(m.machine_id)}
                    isSaved={isSaved}
                    isModified={isModified}
                  />
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 4. Rejection Modal Instance */}
      {activeRejModal && activeRejRun && (
        <RejectionModal
          isOpen={true}
          onClose={() => setActiveRejModal(null)}
          idx={activeRejModal.runIdx}
          sapCode={activeRejRun.sap_code}
          materialDescription={activeRejRun.material_description}
          rejectionReasons={rejectionReasons}
          reasons={normalizeReasonsMap(activeRejRun.reasons)}
          onUpdateReason={(reasonId, val) => {
            const currentMap = normalizeReasonsMap(activeRejRun.reasons);
            const nextReasons = { ...currentMap, [reasonId]: val };
            handleUpdateRun(activeRejModal.machineId, activeRejModal.runIdx, "reasons", nextReasons);
          }}
          isReadOnly={isFormLocked}
        />
      )}

      {/* 5. Downtime Modal Instance */}
      {activeDtModal && activeDtRun && (
        <DowntimeModal
          isOpen={true}
          onClose={() => setActiveDtModal(null)}
          idx={activeDtModal.runIdx}
          sapCode={activeDtRun.sap_code}
          materialDescription={activeDtRun.material_description}
          downtimeReasons={downtimeReasons}
          reasons={normalizeReasonsMap(activeDtRun.reasons)}
          otherDtRemark={activeDtRun.other_dt_remark || ""}
          plannedHours={Number(activeDtRun.planned_hours) || Number(selectedShift?.planned_hours || 12.0)}
          onUpdateReason={(reasonId, val) => {
            const currentMap = normalizeReasonsMap(activeDtRun.reasons);
            const nextReasons = { ...currentMap, [reasonId]: val };
            handleUpdateRun(activeDtModal.machineId, activeDtModal.runIdx, "reasons", nextReasons);
          }}
          onUpdateOtherRemark={(remark) => {
            handleUpdateRun(activeDtModal.machineId, activeDtModal.runIdx, "other_dt_remark", remark);
          }}
          isReadOnly={isFormLocked}
        />
      )}

      {/* 6. Mandatory Previous Shift Mold Modal */}
      {prevMoldModalMachineId && prevMoldMachine && prevMoldTargetInfo && (
        <PreviousShiftMoldModal
          isOpen={true}
          onClose={() => setPrevMoldModalMachineId(null)}
          machine={prevMoldMachine}
          prevShiftInfo={prevMoldTargetInfo}
          prevMaster={prevMoldTargetInfo.master}
          selectedShift={selectedShift}
          onConfirmContinueSameMold={handleConfirmContinueSameMold}
          onConfirmMidShiftChange={handleConfirmMidShiftChange}
          onConfirmNewMold={handleConfirmNewMold}
        />
      )}
    </div>
  );
}
