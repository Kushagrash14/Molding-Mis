import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import SearchableSapSelect from "./SearchableSapSelect.jsx";
import { normalizeReasonsMap } from "../lib/calculations.js";

export default function MultiCavityModal({
  isOpen,
  onClose,
  machine,
  run,
  runIdx = 0,
  master = [],
  reasonCodes = [],
  onSave,
  isReadOnly = false,
}) {
  if (!isOpen || !run) return null;

  const currentTotalCavity = Math.max(2, Number(run.running_cavity || 2));
  const [totalCavity, setTotalCavity] = useState(currentTotalCavity);
  const [parts, setParts] = useState([]);

  // Sub-modal for logging part-specific rejection reasons
  const [rejPartIdx, setRejPartIdx] = useState(null);

  // Initialize or reload parts state whenever modal opens or run changes
  useEffect(() => {
    const totCav = Math.max(2, Number(run.running_cavity || 2));
    setTotalCavity(totCav);

    if (run.cavity_parts && Array.isArray(run.cavity_parts) && run.cavity_parts.length >= 2) {
      setParts(
        run.cavity_parts.map((p, idx) => ({
          cavity_no: idx + 1,
          sap_code: p.sap_code || "",
          material_description: p.material_description || "",
          part_no: p.part_no || "",
          cavity: Number(p.cavity) || 1,
          ok_prod: p.ok_prod !== undefined ? String(p.ok_prod) : "",
          reasons: normalizeReasonsMap(p.reasons || {}),
        }))
      );
    } else {
      // Create default 2-cavity split: Main SAP gets 1 cavity, 2nd part gets remaining
      const rMaster = master.find((m) => m.sap_code === run.sap_code);
      const mainPart = {
        cavity_no: 1,
        sap_code: run.sap_code || "",
        material_description: rMaster?.material_description || run.material_description || "",
        part_no: rMaster?.part_no || run.part_no || "",
        cavity: 1,
        ok_prod: run.ok_prod !== undefined ? String(run.ok_prod) : "",
        reasons: normalizeReasonsMap(run.reasons || {}),
      };

      const secCav = Math.max(1, totCav - 1);
      const secPart = {
        cavity_no: 2,
        sap_code: "",
        material_description: "",
        part_no: "",
        cavity: secCav,
        ok_prod: "",
        reasons: {},
      };

      setParts([mainPart, secPart]);
    }
  }, [isOpen, run, master]);

  // Total allocated cavity count
  const allocatedCavitySum = useMemo(() => {
    return parts.reduce((sum, p) => sum + (Number(p.cavity) || 0), 0);
  }, [parts]);

  const isBalanced = allocatedCavitySum === totalCavity;

  // Rejection reasons list
  const rejectionReasons = useMemo(() => {
    return reasonCodes.filter(
      (r) => r.category === "rejection" || (r.reason_id && r.reason_id.startsWith("rej_"))
    );
  }, [reasonCodes]);

  function handleUpdatePart(index, field, value) {
    setParts((prev) => {
      const next = [...prev];
      const target = { ...next[index] };

      if (field === "sap_code") {
        target.sap_code = value;
        const found = master.find((m) => m.sap_code === value);
        target.material_description = found?.material_description || "";
        target.part_no = found?.part_no || "";
      } else if (field === "cavity") {
        target.cavity = Math.max(1, Number(value) || 1);
      } else if (field === "ok_prod") {
        target.ok_prod = value;
      }

      next[index] = target;
      return next;
    });
  }

  function handleAddPart() {
    if (parts.length >= totalCavity) {
      alert(`Cannot add more parts than total running cavity (${totalCavity}).`);
      return;
    }
    const remainingCav = Math.max(1, totalCavity - allocatedCavitySum);
    setParts((prev) => [
      ...prev,
      {
        cavity_no: prev.length + 1,
        sap_code: "",
        material_description: "",
        part_no: "",
        cavity: remainingCav,
        ok_prod: "",
        reasons: {},
      },
    ]);
  }

  function handleRemovePart(index) {
    if (index === 0) {
      alert("Main SAP Code part cannot be removed.");
      return;
    }
    setParts((prev) => prev.filter((_, idx) => idx !== index));
  }

  function handleSaveMultiCavity() {
    if (!isBalanced) {
      alert(
        `Cavity Mismatch: Total allocated cavities (${allocatedCavitySum}) must equal total running cavity (${totalCavity}).`
      );
      return;
    }

    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (!p.sap_code) {
        alert(`Cavity #${i + 1}: Please select a SAP Code.`);
        return;
      }
      if (p.ok_prod === "" || p.ok_prod === undefined || Number(p.ok_prod) < 0) {
        alert(`Cavity #${i + 1} (${p.sap_code}): Please enter a valid OK production quantity.`);
        return;
      }
    }

    const totalOk = parts.reduce((sum, p) => sum + (Number(p.ok_prod) || 0), 0);

    // Merge rejections from all parts with existing machine downtime
    const machineReasons = normalizeReasonsMap(run.reasons || {});
    const mergedReasons = {};

    // Keep all planned and unplanned downtime from machine level
    Object.entries(machineReasons).forEach(([k, v]) => {
      if (k.startsWith("pdt_") || k.startsWith("udt_")) {
        mergedReasons[k] = v;
      }
    });

    // Sum rejection reasons from individual cavity parts
    parts.forEach((p) => {
      Object.entries(p.reasons || {}).forEach(([k, v]) => {
        if (k.startsWith("rej_") && Number(v) > 0) {
          mergedReasons[k] = (mergedReasons[k] || 0) + Number(v);
        }
      });
    });

    onSave({
      is_multi_cavity: true,
      running_cavity: totalCavity,
      ok_prod: String(totalOk),
      cavity_parts: parts,
      reasons: mergedReasons,
    });

    onClose();
  }

  function handleRemoveSplit() {
    if (
      window.confirm(
        "Are you sure you want to remove the Multi-Cavity split? This will revert this machine run back to single-SAP mode."
      )
    ) {
      // Revert back to single SAP
      const mainPart = parts[0];
      onSave({
        is_multi_cavity: false,
        cavity_parts: null,
        ok_prod: mainPart?.ok_prod ? String(mainPart.ok_prod) : run.ok_prod,
      });
      onClose();
    }
  }

  // Calculate total rejections across a single part
  function getPartRejPcs(part) {
    return Object.entries(part.reasons || {}).reduce((sum, [k, v]) => {
      return k.startsWith("rej_") ? sum + Number(v || 0) : sum;
    }, 0);
  }

  const modalContent = (
    <div className="modal-backdrop-custom" onClick={onClose} style={{ zIndex: 10000 }}>
      <div
        className="modal-box-custom multi-cav-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "680px", width: "95%" }}
      >
        {/* Header */}
        <div className="multi-cav-header">
          <div className="multi-cav-title-group">
            <div className="multi-cav-badge-icon">🔀</div>
            <div>
              <h3 className="multi-cav-title">Multi-Cavity SAP Allocation</h3>
              <p className="multi-cav-sub">
                Machine: <strong>{machine?.machine_no || machine?.machine_id}</strong> · Run #{runIdx + 1}
              </p>
            </div>
          </div>
          <button type="button" className="btn-close-modal" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Total Cavity Selector & Balance Status Bar */}
        <div className="multi-cav-top-bar">
          <div className="total-cav-input-wrap">
            <label>Total Running Cavity:</label>
            <input
              type="number"
              min="2"
              max="16"
              value={totalCavity}
              onChange={(e) => setTotalCavity(Math.max(2, Number(e.target.value) || 2))}
              disabled={isReadOnly}
              className="sheet-input-number cav-number-input"
            />
          </div>

          <div className={`cav-balance-indicator ${isBalanced ? "balanced" : "mismatched"}`}>
            {isBalanced ? (
              <span>✓ Cavities Balanced: {allocatedCavitySum} / {totalCavity}</span>
            ) : (
              <span>⚠️ Mismatch: {allocatedCavitySum} allocated / {totalCavity} total</span>
            )}
          </div>
        </div>

        {/* Parts List */}
        <div className="multi-cav-parts-list">
          {parts.map((p, idx) => {
            const isMain = idx === 0;
            const partRej = getPartRejPcs(p);

            return (
              <div
                key={`part-${idx}`}
                className={`multi-cav-part-card ${isMain ? "main-part" : "sub-part"}`}
              >
                <div className="part-card-header">
                  <div className="part-header-left">
                    <span className={`part-tag ${isMain ? "tag-main" : "tag-sub"}`}>
                      {isMain ? "Cavity #1 (Main SAP)" : `Cavity #${idx + 1}`}
                    </span>
                    <span className="part-desc-preview" title={p.material_description}>
                      {p.material_description || (isMain ? "Main Part" : "—")}
                    </span>
                  </div>

                  {!isMain && !isReadOnly && (
                    <button
                      type="button"
                      className="btn-remove-part"
                      onClick={() => handleRemovePart(idx)}
                      title="Remove this cavity SAP"
                    >
                      ✕ Remove
                    </button>
                  )}
                </div>

                <div className="part-card-body">
                  {/* SAP Code Dropdown */}
                  <div className="part-field-sap">
                    <label>SAP Code:</label>
                    <SearchableSapSelect
                      value={p.sap_code}
                      showCodeOnly={false}
                      onChange={(newSap) => handleUpdatePart(idx, "sap_code", newSap)}
                      master={master}
                      disabled={isReadOnly}
                      placeholder="-- Select SAP Code --"
                    />
                  </div>

                  {/* Cavity Allocation */}
                  <div className="part-field-cav">
                    <label>Cavity:</label>
                    <input
                      type="number"
                      min="1"
                      max={totalCavity - 1}
                      value={p.cavity}
                      onChange={(e) => handleUpdatePart(idx, "cavity", e.target.value)}
                      disabled={isReadOnly}
                      className="sheet-input-number"
                    />
                  </div>

                  {/* OK Production */}
                  <div className="part-field-ok">
                    <label>OK Prod (Qty):</label>
                    <input
                      type="number"
                      min="0"
                      value={p.ok_prod}
                      onChange={(e) => handleUpdatePart(idx, "ok_prod", e.target.value)}
                      disabled={isReadOnly || !p.sap_code}
                      placeholder="0"
                      className="sheet-input-number ok-input"
                    />
                  </div>

                  {/* Rejections Button */}
                  <div className="part-field-rej">
                    <label>Rejections:</label>
                    <button
                      type="button"
                      className={`sheet-badge-btn rej-btn ${partRej > 0 ? "has-val" : ""}`}
                      onClick={() => setRejPartIdx(idx)}
                      disabled={isReadOnly || !p.sap_code}
                      title="Log defect reasons for this cavity part"
                    >
                      <span className="dot rej" />
                      <span>{partRej > 0 ? `${partRej} pcs` : "+ Rej"}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Add Part Button (if cavities remaining) */}
        {!isReadOnly && parts.length < totalCavity && (
          <div className="multi-cav-add-wrap">
            <button type="button" className="btn-add-cavity-part" onClick={handleAddPart}>
              ➕ Add Cavity #{parts.length + 1} SAP Code
            </button>
          </div>
        )}

        {/* Footer Actions */}
        <div className="multi-cav-footer">
          <div>
            {run.is_multi_cavity && !isReadOnly && (
              <button
                type="button"
                className="btn-danger-link"
                onClick={handleRemoveSplit}
              >
                ✕ Revert to Single SAP
              </button>
            )}
          </div>

          <div className="footer-btns-right">
            <button type="button" className="btn-cancel-flat" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-apply-primary"
              onClick={handleSaveMultiCavity}
              disabled={isReadOnly || !isBalanced}
            >
              ✓ Apply Multi-Cavity
            </button>
          </div>
        </div>
      </div>

      {/* Internal Mini Rejection Modal for specific cavity part */}
      {rejPartIdx !== null && (
        <div
          className="modal-backdrop-custom"
          onClick={() => setRejPartIdx(null)}
          style={{ zIndex: 10050 }}
        >
          <div
            className="modal-box-custom rej-submodal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "480px" }}
          >
            <div className="multi-cav-header">
              <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 700 }}>
                Log Rejections · {parts[rejPartIdx]?.sap_code || `Cavity #${rejPartIdx + 1}`}
              </h4>
              <button
                type="button"
                className="btn-close-modal"
                onClick={() => setRejPartIdx(null)}
              >
                ✕
              </button>
            </div>

            <div style={{ maxHeight: "300px", overflowY: "auto", padding: "10px 0" }}>
              {rejectionReasons.map((rc) => {
                const currentVal = parts[rejPartIdx]?.reasons?.[rc.reason_id] || "";
                return (
                  <div
                    key={rc.reason_id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "6px 8px",
                      borderBottom: "1px solid #f1f5f9",
                    }}
                  >
                    <span style={{ fontSize: "12px", color: "#334155" }}>{rc.name}</span>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={currentVal}
                      onChange={(e) => {
                        const val = e.target.value === "" ? 0 : Math.max(0, Number(e.target.value));
                        setParts((prev) => {
                          const next = [...prev];
                          const tgt = { ...next[rejPartIdx] };
                          tgt.reasons = {
                            ...(tgt.reasons || {}),
                            [rc.reason_id]: val,
                          };
                          next[rejPartIdx] = tgt;
                          return next;
                        });
                      }}
                      className="sheet-input-number"
                      style={{ maxWidth: "70px", height: "26px" }}
                    />
                  </div>
                );
              })}
            </div>

            <div style={{ textAlign: "right", marginTop: "12px" }}>
              <button
                type="button"
                className="btn-apply-primary"
                onClick={() => setRejPartIdx(null)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return createPortal(modalContent, document.body);
}
