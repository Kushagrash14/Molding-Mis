import React, { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { getStartTimeOptions, calculateHoursBetween, formatShiftDateDisplay } from "../lib/calculations.js";

export default function PreviousShiftMoldModal({
  isOpen,
  onClose,
  machine,
  prevShiftInfo,
  prevMaster,
  selectedShift,
  onConfirmContinueSameMold,
  onConfirmMidShiftChange,
  onConfirmNewMold,
}) {
  if (!isOpen || !prevShiftInfo || !machine) return null;

  const shiftStart = selectedShift?.start_time || "07:00";
  const shiftEnd = selectedShift?.end_time || "19:00";

  const handoverOptions = useMemo(() => {
    return getStartTimeOptions(shiftStart, shiftEnd, shiftStart, 1, 2);
  }, [shiftStart, shiftEnd]);

  const [modalOption, setModalOption] = useState("continue");
  const [modalHandoverTime, setModalHandoverTime] = useState(
    () => handoverOptions[Math.floor(handoverOptions.length / 2)]?.time || "13:00"
  );

  const prevPartName = prevMaster?.material_description || "—";
  const prevPartNo = prevMaster?.part_no || "—";
  const prevDateLabel = formatShiftDateDisplay(prevShiftInfo.prev_shift_date) || prevShiftInfo.prev_shift_date;

  const dur1 = calculateHoursBetween(shiftStart, modalHandoverTime, shiftStart).toFixed(1);
  const dur2 = calculateHoursBetween(modalHandoverTime, shiftEnd, shiftStart).toFixed(1);

  return createPortal(
    <div className="prev-mold-modal-overlay">
      <div className="prev-mold-modal-container" role="dialog" aria-modal="true">
        {/* Header */}
        <div className="prev-mold-modal-header">
          <div className="prev-mold-header-left">
            <div className="prev-mold-alert-icon">⚡</div>
            <div>
              <div className="prev-mold-title">
                Previous Shift Mold Detected — {machine.machine_no || machine.machine_id}
              </div>
              <div className="prev-mold-subtitle">
                This machine logged SAP <strong>{prevShiftInfo.sap_code}</strong> in Shift {prevShiftInfo.prev_shift_id} ({prevDateLabel})
              </div>
            </div>
          </div>
          <button
            type="button"
            className="prev-mold-close-x"
            onClick={onClose}
            title="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Previous Mold Info Card */}
        <div className="prev-mold-summary-card">
          <div className="prev-mold-info-row">
            <div className="prev-mold-chip">
              <span className="info-lbl">SAP CODE:</span>
              <strong className="info-val code">{prevShiftInfo.sap_code}</strong>
            </div>
            <div className="prev-mold-chip">
              <span className="info-lbl">PART NO:</span>
              <strong className="info-val">{prevPartNo}</strong>
            </div>
            <div className="prev-mold-chip">
              <span className="info-lbl">STD CAVITY:</span>
              <strong className="info-val">{prevMaster?.cavity || 1}</strong>
            </div>
            <div className="prev-mold-chip">
              <span className="info-lbl">STD MANPOWER:</span>
              <strong className="info-val">{prevMaster?.manpower || 1}</strong>
            </div>
          </div>
          <div className="prev-mold-desc">
            <span className="info-lbl">DESCRIPTION:</span>
            <span className="desc-text">{prevPartName}</span>
          </div>
        </div>

        {/* Operational Query Prompt */}
        <div className="prev-mold-prompt-text">
          How did this machine operate during current shift ({selectedShift?.name || "12-Hour Shift"} · {shiftStart}–{shiftEnd})?
        </div>

        {/* Option Cards */}
        <div className="prev-mold-options-stack">
          {/* Option 1: Continue Same Mold */}
          <div
            className={`prev-mold-option-card ${modalOption === "continue" ? "active-green" : ""}`}
            onClick={() => setModalOption("continue")}
          >
            <input
              type="radio"
              name="prevMoldOption"
              id="opt-continue"
              checked={modalOption === "continue"}
              onChange={() => setModalOption("continue")}
              className="prev-mold-radio"
            />
            <div className="prev-mold-opt-content">
              <div className="opt-title-line">
                <span className="opt-title green">⚡ Continue Same Mold (Full 12h Shift)</span>
                <span className="opt-tag tag-green">Full Shift Run</span>
              </div>
              <div className="opt-desc">
                The machine continued running the same mold without any change. All product master parameters (Part No, Cavity, Manpower) will automatically carry forward.
              </div>
            </div>
          </div>

          {/* Option 2: Mid-Shift Mold Change */}
          <div
            className={`prev-mold-option-card ${modalOption === "mid_shift" ? "active-blue" : ""}`}
            onClick={() => setModalOption("mid_shift")}
          >
            <input
              type="radio"
              name="prevMoldOption"
              id="opt-mid-shift"
              checked={modalOption === "mid_shift"}
              onChange={() => setModalOption("mid_shift")}
              className="prev-mold-radio"
            />
            <div className="prev-mold-opt-content">
              <div className="opt-title-line">
                <span className="opt-title blue">🔄 Mid-Shift Mold Change (Split Run)</span>
                <span className="opt-tag tag-blue">Split Shift (2 Molds)</span>
              </div>
              <div className="opt-desc">
                Previous mold ran for part of the shift, was unmounted at handover time, and a new mold was loaded.
              </div>

              {modalOption === "mid_shift" && (
                <div className="mid-shift-picker-box" onClick={(e) => e.stopPropagation()}>
                  <label className="picker-lbl">
                    Handover / Mold Change Time:
                  </label>
                  <select
                    className="mid-shift-select"
                    value={modalHandoverTime}
                    onChange={(e) => setModalHandoverTime(e.target.value)}
                  >
                    {handoverOptions.map((opt) => (
                      <option key={opt.time} value={opt.time}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <div className="split-summary-box">
                    <div>
                      • <strong>Mold #1 ({prevShiftInfo.sap_code})</strong>: {shiftStart} – {modalHandoverTime} ({dur1} hrs)
                    </div>
                    <div>
                      • <strong>Mold #2 (New Mold)</strong>: {modalHandoverTime} – {shiftEnd} ({dur2} hrs)
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Option 3: Fresh Run */}
          <div
            className={`prev-mold-option-card ${modalOption === "new_mold" ? "active-purple" : ""}`}
            onClick={() => setModalOption("new_mold")}
          >
            <input
              type="radio"
              name="prevMoldOption"
              id="opt-new-mold"
              checked={modalOption === "new_mold"}
              onChange={() => setModalOption("new_mold")}
              className="prev-mold-radio"
            />
            <div className="prev-mold-opt-content">
              <div className="opt-title-line">
                <span className="opt-title purple">🆕 Changed Before Shift Started (New Mold Ran Full Shift)</span>
                <span className="opt-tag tag-purple">Fresh Run</span>
              </div>
              <div className="opt-desc">
                Previous mold was unmounted before shift commenced. A completely fresh mold ran for the entire 12h shift.
              </div>
            </div>
          </div>
        </div>

        {/* Footer Warning & Actions */}
        <div className="prev-mold-mandatory-notice">
          <span className="notice-icon">ℹ️</span>
          <span>
            <strong>Mandatory Decision:</strong> Declare whether previous mold continued or changed. Closing keeps decision pending and leaves SAP blank.
          </span>
        </div>

        <div className="prev-mold-actions">
          <button
            type="button"
            className="btn-modal-cancel"
            onClick={onClose}
          >
            ✕ Close (Pending)
          </button>

          {modalOption === "continue" && (
            <button
              type="button"
              className="btn-modal-action action-green"
              onClick={() => onConfirmContinueSameMold(machine.machine_id)}
            >
              <span>⚡</span>
              <span>Continue Same Mold ({prevShiftInfo.sap_code})</span>
            </button>
          )}

          {modalOption === "mid_shift" && (
            <button
              type="button"
              className="btn-modal-action action-blue"
              onClick={() => onConfirmMidShiftChange(machine.machine_id, modalHandoverTime)}
            >
              <span>✓</span>
              <span>Confirm Handover & Pick New Mold</span>
            </button>
          )}

          {modalOption === "new_mold" && (
            <button
              type="button"
              className="btn-modal-action action-purple"
              onClick={() => onConfirmNewMold(machine.machine_id)}
            >
              <span>🔍</span>
              <span>Select New SAP Code</span>
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
