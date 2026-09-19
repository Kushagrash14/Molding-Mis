import React, { useMemo } from "react";
import SearchableSapSelect from "./SearchableSapSelect.jsx";
import { computeMetrics, calculateHoursBetween, getStartTimeOptions } from "../lib/calculations.js";

function getMachineParts(machineNo = "") {
  // Parses "INJ-01 (180 TON · BAY-1)" or "BM-1 (20L · BAY-3)"
  const match = machineNo.match(/^(.*?)\s*\((.*?)\)$/);
  if (match) {
    return { name: match[1].trim(), details: match[2].trim() };
  }
  return { name: machineNo, details: "" };
}

export default function MachineSheetRow({
  machine,
  runs = [],
  onUpdateRun,
  onUpdateStartTime,
  onAddMold,
  onRemoveMold,
  onOpenRejectionModal,
  onOpenDowntimeModal,
  prevShiftInfo = null,
  onOpenPrevMoldModal = null,
  master = [],
  reasonCodes = [],
  isReadOnly = false,
  selectedShift,
  onSaveRow,
  isSaved = false,
  isModified = false,
}) {
  const machineMeta = useMemo(() => getMachineParts(machine.machine_no), [machine.machine_no]);
  const shiftStart = selectedShift?.start_time || "07:00";
  const shiftEnd = selectedShift?.end_time || "19:00";
  const shiftPlannedHours = Number(selectedShift?.planned_hours || 12.0);

  // Compute metrics for each mold run
  const runMetrics = useMemo(() => {
    return runs.map((r) => {
      const rMaster = master.find((m) => m.sap_code === r.sap_code);
      return computeMetrics(
        {
          ...r,
          planned_hours: Number(r.planned_hours) || shiftPlannedHours,
          reasons: Object.entries(r.reasons || {}).map(([reason_id, value]) => ({
            reason_id,
            value,
          })),
        },
        rMaster,
        reasonCodes
      );
    });
  }, [runs, master, reasonCodes, shiftPlannedHours]);

  return (
    <>
      {runs.map((r, runIdx) => {
        const isSubRun = runIdx > 0;
        const m = runMetrics[runIdx] || {};
        const rejPcs = Object.values(r.reasons || {}).reduce((sum, v) => sum + Number(v || 0), 0);
        const dtMins = Math.round((m.planned_dt || 0) * 60 + (m.unplanned_dt || 0) * 60);
        const rMaster = master.find((item) => item.sap_code === r.sap_code);

        // Start time options for sub-runs
        let startOptions = isSubRun
          ? getStartTimeOptions(
              runs[runIdx - 1]?.start_time || shiftStart,
              r.end_time || shiftEnd,
              shiftStart,
              runIdx,
              runIdx + 1
            )
          : [];

        if (isSubRun && r.start_time && !startOptions.some((o) => o.time === r.start_time)) {
          startOptions = [
            ...startOptions,
            {
              time: r.start_time,
              durPrev: String(runs[runIdx - 1]?.planned_hours || ""),
              durCur: String(r.planned_hours || ""),
              label: `${r.start_time} (Mold #${runIdx}: ${runs[runIdx - 1]?.planned_hours || ""}h · Mold #${runIdx + 1}: ${r.planned_hours || ""}h)`,
            },
          ].sort((a, b) => a.time.localeCompare(b.time));
        }

        return (
          <tr
            key={`${machine.machine_id}-${r.run_id || runIdx}`}
            className={`sheet-row ${isSubRun ? "sheet-sub-row" : "sheet-primary-row"} ${
              isModified ? "row-modified" : isSaved ? "row-saved" : ""
            }`}
          >
            {/* 1. Machine Identification */}
            <td className="cell-machine">
              {!isSubRun ? (
                <div className="machine-badge-wrap">
                  <span className="machine-tag-bold">{machineMeta.name}</span>
                  {machineMeta.details && (
                    <span className="machine-spec-sub">{machineMeta.details}</span>
                  )}
                </div>
              ) : (
                <div className="sub-row-indicator">
                  <span className="sub-tree-pipe">└─</span>
                  <span className="sub-mold-tag">MOLD #{runIdx + 1}</span>
                </div>
              )}
            </td>

            {/* 2. Mold Tag & Timing */}
            <td className="cell-mold-timing">
              {!isSubRun ? (
                <div className="mold-timing-block">
                  <span className="mold-badge primary">
                    {runs.length > 1
                      ? `Mold #1 (${r.start_time}–${r.end_time})`
                      : "Full Shift"}
                  </span>
                  {runs.length > 1 && (
                    <span className="mold-timing-sub">{r.planned_hours}h planned</span>
                  )}
                </div>
              ) : (
                <div className="sub-timing-wrap">
                  <div className="sub-timing-picker">
                    <span className="sub-timing-label">Start:</span>
                    <select
                      className="sub-mold-time-select"
                      value={r.start_time}
                      onChange={(e) =>
                        onUpdateStartTime && onUpdateStartTime(runIdx, e.target.value)
                      }
                      disabled={isReadOnly}
                      title="Select when Mold #2 started running"
                    >
                      {startOptions.map((opt) => (
                        <option key={opt.time} value={opt.time}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <span className="sub-timing-hrs">
                    ({r.start_time}–{r.end_time} · {r.planned_hours}h)
                  </span>
                </div>
              )}
            </td>

            {/* 3. Searchable SAP Product Code */}
            <td className="cell-sap">
              <div className="sheet-sap-wrapper">
                {!isSubRun && !r.sap_code && prevShiftInfo?.sap_code && (
                  <button
                    type="button"
                    className="prev-mold-cell-badge"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onOpenPrevMoldModal) onOpenPrevMoldModal(machine.machine_id);
                    }}
                    title={`Previous shift ran ${prevShiftInfo.sap_code}. Click to choose continue or mid-shift split.`}
                  >
                    <span className="badge-bolt">⚡</span>
                    <span className="badge-txt">Prev: {prevShiftInfo.sap_code}</span>
                  </button>
                )}
                <SearchableSapSelect
                  value={r.sap_code}
                  onChange={(newSap) => {
                    const found = master.find((x) => x.sap_code === newSap);
                    onUpdateRun(runIdx, {
                      sap_code: newSap,
                      material_description: found?.material_description || "",
                      part_no: found?.part_no || "",
                      std_cavity: found?.cavity || 1,
                      running_cavity: r.running_cavity || found?.cavity || 1,
                      manpower: r.manpower || found?.manpower || 1,
                      shots_per_hour: found?.shots_per_hour || 60,
                      price: found?.price || 1,
                      part_wt: found?.part_wt || 0,
                      run_wt: found?.run_wt || 0,
                    });
                  }}
                  master={master}
                  disabled={isReadOnly}
                  placeholder="-- Select SAP --"
                  prevShiftSap={prevShiftInfo?.sap_code}
                  prevMaster={prevShiftInfo?.master}
                  onTriggerClick={() => {
                    if (!isSubRun && !r.sap_code && prevShiftInfo?.sap_code && !r.declared_fresh) {
                      if (onOpenPrevMoldModal) {
                        onOpenPrevMoldModal(machine.machine_id);
                        return true;
                      }
                    }
                    return false;
                  }}
                />
              </div>
            </td>

            {/* 4. Material Description & Cavity */}
            <td className="cell-part-desc">
              {r.sap_code ? (
                <div className="part-info-block" title={r.material_description || rMaster?.material_description}>
                  <div className="part-name-text">
                    {r.material_description || rMaster?.material_description || "—"}
                  </div>
                  <div className="part-cavity-text">
                    Part: <strong>{r.part_no || rMaster?.part_no || "—"}</strong> · Std Cav:{" "}
                    <strong>{rMaster?.cavity || 1}</strong>
                  </div>
                </div>
              ) : (
                <span className="empty-dash">—</span>
              )}
            </td>

            {/* 5. Run Hours */}
            <td className="cell-num">
              <input
                type="number"
                step="0.1"
                min="0"
                max={r.planned_hours || shiftPlannedHours}
                value={r.run_hour !== undefined ? r.run_hour : ""}
                onChange={(e) => onUpdateRun(runIdx, "run_hour", e.target.value)}
                disabled={isReadOnly || !r.sap_code}
                placeholder={String(r.planned_hours || shiftPlannedHours)}
                className="sheet-input-number"
              />
            </td>

            {/* 6. Running Cavity */}
            <td className="cell-num">
              <input
                type="number"
                step="1"
                min="1"
                value={r.running_cavity !== undefined ? r.running_cavity : ""}
                onChange={(e) => onUpdateRun(runIdx, "running_cavity", e.target.value)}
                disabled={isReadOnly || !r.sap_code}
                placeholder={String(rMaster?.cavity || 1)}
                className="sheet-input-number"
              />
            </td>

            {/* 7. Manpower */}
            <td className="cell-num">
              <input
                type="number"
                step="1"
                min="1"
                value={r.manpower !== undefined ? r.manpower : ""}
                onChange={(e) => onUpdateRun(runIdx, "manpower", e.target.value)}
                disabled={isReadOnly || !r.sap_code}
                placeholder={String(rMaster?.manpower || 1)}
                className="sheet-input-number"
              />
            </td>

            {/* 8. OK Production (Qty) */}
            <td className="cell-num cell-ok-prod">
              <input
                type="number"
                min="0"
                value={r.ok_prod !== undefined ? r.ok_prod : ""}
                onChange={(e) => onUpdateRun(runIdx, "ok_prod", e.target.value)}
                disabled={isReadOnly || !r.sap_code}
                placeholder="0"
                className="sheet-input-number ok-input"
              />
            </td>

            {/* 9. Rejections Button */}
            <td className="cell-btn">
              <button
                type="button"
                className={`sheet-badge-btn rej-btn ${rejPcs > 0 ? "has-val" : ""}`}
                onClick={() => onOpenRejectionModal(runIdx)}
                disabled={isReadOnly || !r.sap_code}
                title="Log Rejections / Defect Reasons"
              >
                <span className="dot rej" />
                <span>{rejPcs > 0 ? `${rejPcs} pcs` : "+ Rej"}</span>
              </button>
            </td>

            {/* 10. Downtime Button */}
            <td className="cell-btn">
              <button
                type="button"
                className={`sheet-badge-btn dt-btn ${dtMins > 0 ? "has-val" : ""}`}
                onClick={() => onOpenDowntimeModal(runIdx)}
                disabled={isReadOnly || !r.sap_code}
                title="Log Planned & Unplanned Downtime"
              >
                <span className="dot dt" />
                <span>{dtMins > 0 ? `${dtMins}m` : "+ DT"}</span>
              </button>
            </td>

            {/* 11. OEE % / Metrics */}
            <td className="cell-oee">
              {r.sap_code && Number(r.ok_prod) > 0 ? (
                <div className="sheet-oee-badge">
                  <span className="oee-val">{(m.oee * 100 || 0).toFixed(0)}%</span>
                  <span className="oee-sub">A:{(m.a * 100 || 0).toFixed(0)}% · P:{(m.p * 100 || 0).toFixed(0)}%</span>
                </div>
              ) : (
                <span className="empty-dash">—</span>
              )}
            </td>

            {/* 12. Actions & Sub-mold */}
            <td className="cell-actions">
              {!isSubRun ? (
                <div className="actions-cluster">
                  {runs.length < 4 && !isReadOnly && (
                    <button
                      type="button"
                      className="btn-sheet-add-mold"
                      onClick={onAddMold}
                      disabled={!r.sap_code}
                      title="Add another mold run (mid-shift mold change)"
                    >
                      ➕ Mold
                    </button>
                  )}
                  {onSaveRow && (
                    <button
                      type="button"
                      className={`btn-sheet-save ${isModified ? "is-dirty" : isSaved ? "is-saved" : ""}`}
                      onClick={onSaveRow}
                      disabled={!r.sap_code || isReadOnly}
                      title="Save entry for this machine"
                    >
                      {isSaved && !isModified ? "✓ Saved" : "💾 Save"}
                    </button>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  className="btn-sheet-remove-mold"
                  onClick={() => onRemoveMold(runIdx)}
                  disabled={isReadOnly}
                  title="Remove this sub-mold run"
                >
                  🗑️
                </button>
              )}
            </td>
          </tr>
        );
      })}
    </>
  );
}
