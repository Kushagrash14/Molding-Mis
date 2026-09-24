import React, { useMemo, useState, useRef } from "react";
import { createPortal } from "react-dom";
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
  onUpdateChangeOver,
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

  // Changeover popup state: { runIdx, coValue } | null
  const [coPopup, setCoPopup] = useState(null);
  const coInputRef = useRef(null);
  // After CO confirmed, this runIdx's SAP dropdown should open (via forceOpen)
  const [pendingSapRunIdx, setPendingSapRunIdx] = useState(null);

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

  function handleCoConfirm() {
    if (!coPopup) return;
    const mins = Math.max(0, Number(coPopup.coValue) || 0);
    onUpdateChangeOver && onUpdateChangeOver(coPopup.runIdx, mins);
    // Trigger that specific SAP dropdown to force-open
    setPendingSapRunIdx(coPopup.runIdx);
    setCoPopup(null);
  }

  function handleCoCancel() {
    setCoPopup(null);
  }

  return (
    <>
      {runs.map((r, runIdx) => {
        const isSubRun = runIdx > 0;
        const m = runMetrics[runIdx] || {};
        const rejPcs =
          Number(m.total_rej || 0) > 0
            ? Number(m.total_rej)
            : Object.entries(r.reasons || {}).reduce((sum, [k, v]) => {
                const rc = reasonCodes.find((x) => x.reason_id === k);
                const isRej = rc ? rc.category === "rejection" : k.startsWith("rej_");
                return isRej ? sum + Number(v || 0) : sum;
              }, 0);
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

            {/* 2. Start Time */}
            <td className="cell-start-time cell-center">
              {!isSubRun ? (
                <div className="start-time-wrap">
                  <span className="time-badge start-badge">
                    {r.start_time || shiftStart}
                  </span>
                </div>
              ) : (
                <div className="sub-start-col-wrap">
                  <select
                    className="sub-start-select"
                    value={r.start_time}
                    onChange={(e) =>
                      onUpdateStartTime && onUpdateStartTime(runIdx, e.target.value)
                    }
                    disabled={isReadOnly}
                    title={`Select start time for Mold #${runIdx + 1}`}
                  >
                    {startOptions.map((opt) => (
                      <option key={opt.time} value={opt.time}>
                        {opt.time}
                      </option>
                    ))}
                  </select>
                  {/* Read-only CO badge — click to view/edit anytime */}
                  <div
                    className={`changeover-badge-wrap${!r.change_over_confirmed && !r.change_over_time ? " co-badge-unset" : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isReadOnly) {
                        setCoPopup({ runIdx, coValue: String(r.change_over_time || 30) });
                        setTimeout(() => coInputRef.current?.select(), 60);
                      }
                    }}
                    title={
                      r.change_over_confirmed || r.change_over_time
                        ? `Change Over: ${r.change_over_time} min (Click to change)`
                        : "Change Over Time not set (Click to set)"
                    }
                  >
                    <span className="changeover-label">C/O</span>
                    <span className="changeover-value">
                      {r.change_over_confirmed || (r.change_over_time !== null && r.change_over_time !== undefined && r.change_over_time !== "")
                        ? `${r.change_over_time}m`
                        : "—"}
                    </span>
                  </div>
                </div>
              )}
            </td>

            {/* 3. Searchable SAP Product Code */}
            <td className="cell-sap cell-center">
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
                  showCodeOnly={true}
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
                  forceOpen={pendingSapRunIdx === runIdx}
                  onCloseForceOpen={() => setPendingSapRunIdx(null)}
                  onTriggerClick={() => {
                    // For sub-runs: MUST have changeover confirmed before selecting SAP!
                    if (isSubRun && (!r.change_over_confirmed || !r.change_over_time)) {
                      setCoPopup({ runIdx, coValue: String(r.change_over_time || 30) });
                      setTimeout(() => coInputRef.current?.select(), 60);
                      return true; // block dropdown!
                    }
                    // For primary runs: check prev shift modal
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

            {/* 4. Compact Material Description */}
            <td className="cell-part-desc">
              {r.sap_code ? (
                <div
                  className="part-info-block"
                  title={`${r.material_description || rMaster?.material_description || ""} (Part No: ${r.part_no || rMaster?.part_no || ""})`}
                >
                  <div className="part-name-text">
                    {r.material_description || rMaster?.material_description || "—"}
                  </div>
                </div>
              ) : (
                <span className="empty-dash">—</span>
              )}
            </td>

            {/* 5. End Time (Auto-adjusted or Shift End) */}
            <td className="cell-end-time">
              <span className="time-badge end-badge">
                {r.end_time || shiftEnd}
              </span>
            </td>

            {/* 6. Standard Cavity (Auto-filled from Product Master) */}
            <td className="cell-num cell-std-cav">
              <span className="std-cav-badge">
                {r.sap_code ? (rMaster?.cavity || r.std_cavity || 1) : "—"}
              </span>
            </td>

            {/* 7. Run Hours */}
            <td className="cell-num cell-run-h cell-center">
              <input
                type="number"
                step="0.1"
                min="0"
                max={r.planned_hours || shiftPlannedHours}
                value={r.run_hour !== undefined ? r.run_hour : ""}
                onChange={(e) => onUpdateRun(runIdx, "run_hour", e.target.value)}
                disabled={isReadOnly || !r.sap_code}
                placeholder={String(r.planned_hours || shiftPlannedHours)}
                className="sheet-input-number run-h-input"
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
            <td className="cell-num cell-manpower">
              <input
                type="number"
                step="1"
                min="1"
                value={r.manpower !== undefined ? r.manpower : ""}
                onChange={(e) => onUpdateRun(runIdx, "manpower", e.target.value)}
                disabled={isReadOnly || !r.sap_code}
                placeholder={String(rMaster?.manpower || 1)}
                className="sheet-input-number manpower-input"
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
              {r.sap_code && (Number(r.ok_prod) > 0 || dtMins >= Math.round((Number(r.planned_hours) || shiftPlannedHours) * 60)) ? (
                <div
                  className="sheet-oee-badge"
                  style={
                    Number(r.ok_prod) === 0
                      ? { background: "#fee2e2", borderColor: "#fca5a5" }
                      : {}
                  }
                >
                  <span
                    className="oee-val"
                    style={Number(r.ok_prod) === 0 ? { color: "#dc2626" } : {}}
                  >
                    {(m.oee * 100 || 0).toFixed(0)}%
                  </span>
                  <span
                    className="oee-sub"
                    style={Number(r.ok_prod) === 0 ? { color: "#b91c1c" } : {}}
                  >
                    {Number(r.ok_prod) === 0
                      ? "Full Shift DT"
                      : `A:${(m.a * 100 || 0).toFixed(0)}% · P:${(m.p * 100 || 0).toFixed(0)}%`}
                  </span>
                </div>
              ) : (
                <span className="empty-dash">—</span>
              )}
            </td>

            {/* 12. Actions & Sub-mold */}
            <td className="cell-actions">
              {!isSubRun ? (
                <div className="actions-cluster">
                  {runs.length < 5 && !isReadOnly && (
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

      {/* Change Over Time popup modal — rendered via portal on document.body */}
      {coPopup && createPortal(
        <div
          className="modal-back"
          style={{ zIndex: 100000 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCoCancel();
          }}
        >
          <div
            className="modal"
            style={{
              maxWidth: "360px",
              padding: "20px",
              borderRadius: "12px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
              border: "1px solid #fde68a",
              background: "#ffffff",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
              <span style={{ fontSize: "24px" }}>🔄</span>
              <div>
                <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: "#92400e" }}>
                  Change Over Time — Mold #{coPopup.runIdx + 1}
                </h3>
                <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#64748b" }}>
                  Set mold change over duration before selecting SAP code
                </p>
              </div>
            </div>

            <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "8px", padding: "14px", textAlign: "center", marginBottom: "16px" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, color: "#78350f", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>
                Change Over Duration (Minutes)
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
                <button
                  type="button"
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "8px",
                    border: "1px solid #d1d5db",
                    background: "#ffffff",
                    fontSize: "18px",
                    fontWeight: "bold",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  onClick={() => setCoPopup((p) => ({ ...p, coValue: String(Math.max(0, (Number(p.coValue) || 0) - 5)) }))}
                >
                  −
                </button>
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <input
                    ref={coInputRef}
                    type="number"
                    min="0"
                    max="480"
                    step="5"
                    value={coPopup.coValue}
                    onChange={(e) => setCoPopup((p) => ({ ...p, coValue: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCoConfirm();
                      if (e.key === "Escape") handleCoCancel();
                    }}
                    style={{
                      width: "80px",
                      height: "40px",
                      fontSize: "22px",
                      fontWeight: 800,
                      textAlign: "center",
                      color: "#92400e",
                      background: "#ffffff",
                      border: "2px solid #f59e0b",
                      borderRadius: "8px",
                      outline: "none",
                      fontFamily: "monospace",
                    }}
                    autoFocus
                  />
                  <span style={{ fontSize: "14px", fontWeight: 700, color: "#92400e" }}>min</span>
                </div>
                <button
                  type="button"
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "8px",
                    border: "1px solid #d1d5db",
                    background: "#ffffff",
                    fontSize: "18px",
                    fontWeight: "bold",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  onClick={() => setCoPopup((p) => ({ ...p, coValue: String(Math.min(480, (Number(p.coValue) || 0) + 5)) }))}
                >
                  +
                </button>
              </div>
              <div style={{ fontSize: "11px", color: "#b45309", marginTop: "8px" }}>
                SAP code selection will open once confirmed.
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: "8px 16px", fontSize: "12px", borderRadius: "6px" }}
                onClick={handleCoCancel}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                style={{
                  padding: "8px 18px",
                  fontSize: "12px",
                  fontWeight: 700,
                  borderRadius: "6px",
                  background: "#d97706",
                  color: "#ffffff",
                  border: "none",
                  cursor: "pointer",
                }}
                onClick={handleCoConfirm}
              >
                Confirm &amp; Select SAP →
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
