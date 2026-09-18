import { useState, useRef } from "react";
import { createPortal } from "react-dom";

export default function RejectionModal({
  isOpen,
  onClose,
  idx = 0,
  sapCode = "",
  materialDescription = "",
  rejectionReasons = [],
  reasons = {},
  onUpdateReason,
  isReadOnly = false,
}) {
  const [selectedReasonId, setSelectedReasonId] = useState(
    rejectionReasons[0]?.reason_id || "rej_startup"
  );
  const [qty, setQty] = useState("");
  const [justAddedMsg, setJustAddedMsg] = useState(null);
  const qtyInputRef = useRef(null);

  if (!isOpen) return null;

  // Get list of currently logged rejections
  const loggedRejections = rejectionReasons
    .map((r) => ({
      ...r,
      value: Number(reasons[r.reason_id] || 0),
    }))
    .filter((r) => r.value > 0);

  const totalPcs = loggedRejections.reduce((sum, r) => sum + r.value, 0);

  function handleAdd() {
    if (!selectedReasonId) return;
    const num = Number(qty);
    if (!qty || isNaN(num) || num <= 0) {
      alert("Please enter a valid rejection quantity (greater than 0).");
      return;
    }
    const currentVal = Number(reasons[selectedReasonId] || 0);
    const targetReason = rejectionReasons.find((r) => r.reason_id === selectedReasonId);
    const reasonName = targetReason?.name || "Defect";

    onUpdateReason(selectedReasonId, currentVal + num);
    setJustAddedMsg(`Added ${num} pcs for "${reasonName}"!`);
    setQty("");

    // Automatically focus back on quantity input
    setTimeout(() => {
      if (qtyInputRef.current) {
        qtyInputRef.current.focus();
      }
    }, 50);
  }

  function handleRemove(reasonId) {
    onUpdateReason(reasonId, 0);
    setJustAddedMsg(null);
  }

  function handleClearAll() {
    if (window.confirm(`Are you sure you want to remove all logged rejections for Mold #${idx + 1}?`)) {
      loggedRejections.forEach((r) => {
        onUpdateReason(r.reason_id, 0);
      });
      setJustAddedMsg(null);
    }
  }

  function handleUpdateDirect(reasonId, val) {
    const clean = val === "" ? "" : Math.max(0, Number(val));
    onUpdateReason(reasonId, clean);
  }

  return createPortal(
    <div className="modal-back" onClick={onClose} style={{ zIndex: 1050 }}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "600px",
          width: "94%",
          padding: "22px",
          borderRadius: "14px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
        }}
      >
        {/* Header */}
        <div className="modal-head" style={{ marginBottom: "16px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "20px" }}>🔴</span>
              <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 800, color: "#991b1b" }}>
                Mold #{idx + 1} Rejection Management
              </h3>
            </div>
            <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#64748b" }}>
              {sapCode ? `SAP: ${sapCode}` : "No SAP selected"}{" "}
              {materialDescription ? `· ${materialDescription}` : ""}
            </p>
          </div>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Just Added Success Banner */}
        {justAddedMsg && (
          <div
            style={{
              background: "#f0fdf4",
              border: "1px solid #86efac",
              color: "#166534",
              padding: "8px 12px",
              borderRadius: "8px",
              fontSize: "12.5px",
              fontWeight: 700,
              marginBottom: "14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span>✓</span>
              <span>{justAddedMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setJustAddedMsg(null)}
              style={{
                background: "none",
                border: "none",
                color: "#166534",
                cursor: "pointer",
                fontWeight: 800,
                fontSize: "13px",
              }}
              title="Dismiss"
            >
              ✕
            </button>
          </div>
        )}

        {/* Add Rejection Form Box */}
        {!isReadOnly && (
          <div
            style={{
              background: "#fef2f2",
              border: "1.5px solid #fecaca",
              borderRadius: "10px",
              padding: "14px",
              marginBottom: "18px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "8px",
              }}
            >
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 800,
                  color: "#991b1b",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                {loggedRejections.length > 0 ? "➕ Add Another Rejection Defect" : "➕ Add Rejection Defect"}
              </span>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 110px auto",
                gap: "10px",
                alignItems: "end",
              }}
            >
              {/* Defect Type Dropdown */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "11.5px",
                    fontWeight: 700,
                    color: "#7f1d1d",
                    marginBottom: "4px",
                  }}
                >
                  Select Defect Type
                </label>
                <select
                  value={selectedReasonId}
                  onChange={(e) => {
                    setSelectedReasonId(e.target.value);
                    setJustAddedMsg(null);
                  }}
                  style={{
                    width: "100%",
                    height: "38px",
                    fontSize: "13px",
                    fontWeight: 600,
                    borderRadius: "6px",
                    border: "1.5px solid #f87171",
                    padding: "0 8px",
                    background: "#ffffff",
                    color: "#0f172a",
                  }}
                >
                  {rejectionReasons.map((r) => {
                    const existingVal = Number(reasons[r.reason_id] || 0);
                    return (
                      <option key={r.reason_id} value={r.reason_id}>
                        {r.name} {existingVal > 0 ? `(${existingVal} pcs logged)` : ""}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Quantity Input */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "11.5px",
                    fontWeight: 700,
                    color: "#7f1d1d",
                    marginBottom: "4px",
                  }}
                >
                  Qty (pcs)
                </label>
                <input
                  ref={qtyInputRef}
                  type="number"
                  min="1"
                  step="1"
                  value={qty}
                  onChange={(e) => {
                    setQty(e.target.value);
                    setJustAddedMsg(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAdd();
                    }
                  }}
                  placeholder="0"
                  style={{
                    width: "100%",
                    height: "38px",
                    fontSize: "14px",
                    fontWeight: 700,
                    borderRadius: "6px",
                    border: "1.5px solid #f87171",
                    padding: "0 8px",
                    boxSizing: "border-box",
                    background: "#ffffff",
                    textAlign: "right",
                  }}
                />
              </div>

              {/* Add / Add Another Button */}
              <div>
                <button
                  type="button"
                  onClick={handleAdd}
                  style={{
                    height: "38px",
                    background: "#dc2626",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "6px",
                    padding: "0 16px",
                    fontSize: "13px",
                    fontWeight: 700,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    boxShadow: "0 1px 3px rgba(220, 38, 38, 0.3)",
                  }}
                >
                  <span>+</span>
                  <span>{loggedRejections.length > 0 ? "Add Another" : "Add Defect"}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Logged Rejections List / Table */}
        <div style={{ marginBottom: "18px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "8px",
              flexWrap: "wrap",
              gap: "6px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 700,
                  color: "#475569",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                Logged Defects ({loggedRejections.length})
              </span>
              {loggedRejections.length > 0 && !isReadOnly && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  style={{
                    background: "#fee2e2",
                    border: "1px solid #fca5a5",
                    color: "#dc2626",
                    borderRadius: "4px",
                    padding: "2px 8px",
                    fontSize: "11px",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                  title="Remove all defects"
                >
                  <span>✕</span> Remove All
                </button>
              )}
            </div>

            <span
              style={{
                fontSize: "12.5px",
                fontWeight: 800,
                color: totalPcs > 0 ? "#dc2626" : "#64748b",
              }}
            >
              Total: {totalPcs.toLocaleString()} pcs
            </span>
          </div>

          {loggedRejections.length === 0 ? (
            <div
              style={{
                padding: "24px",
                textAlign: "center",
                background: "#f8fafc",
                borderRadius: "8px",
                border: "1px dashed #cbd5e1",
                color: "#64748b",
                fontSize: "13px",
              }}
            >
              No rejections recorded yet for Mold #{idx + 1}. Select defect and enter quantity above.
            </div>
          ) : (
            <div
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                overflow: "hidden",
                maxHeight: "220px",
                overflowY: "auto",
              }}
            >
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ background: "#f1f5f9", textAlign: "left", color: "#475569" }}>
                    <th style={{ padding: "8px 12px", fontWeight: 700 }}>Defect Type</th>
                    <th style={{ padding: "8px 12px", fontWeight: 700, width: "110px", textAlign: "right" }}>
                      Pieces
                    </th>
                    {!isReadOnly && (
                      <th style={{ padding: "8px 12px", width: "95px", textAlign: "center" }}>
                        Action
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {loggedRejections.map((r, i) => (
                    <tr
                      key={r.reason_id}
                      style={{
                        borderTop: "1px solid #f1f5f9",
                        background: i % 2 === 0 ? "#ffffff" : "#fbfcfd",
                      }}
                    >
                      <td style={{ padding: "8px 12px", fontWeight: 600, color: "#1e293b" }}>
                        {r.name}
                      </td>
                      <td style={{ padding: "8px 12px", textAlign: "right" }}>
                        {isReadOnly ? (
                          <span style={{ fontWeight: 800, color: "#dc2626" }}>
                            {r.value} pcs
                          </span>
                        ) : (
                          <div style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <input
                              type="number"
                              min="0"
                              value={r.value}
                              onChange={(e) => handleUpdateDirect(r.reason_id, e.target.value)}
                              style={{
                                width: "65px",
                                height: "28px",
                                textAlign: "right",
                                fontWeight: 700,
                                fontSize: "13px",
                                border: "1px solid #cbd5e1",
                                borderRadius: "4px",
                                padding: "0 6px",
                              }}
                            />
                            <span style={{ fontSize: "11px", color: "#64748b" }}>pcs</span>
                          </div>
                        )}
                      </td>
                      {!isReadOnly && (
                        <td style={{ padding: "8px 12px", textAlign: "center" }}>
                          {/* Dedicated, prominent Remove Cross Button */}
                          <button
                            type="button"
                            onClick={() => handleRemove(r.reason_id)}
                            title={`Remove ${r.name}`}
                            style={{
                              background: "#fee2e2",
                              border: "1px solid #fca5a5",
                              borderRadius: "6px",
                              padding: "3px 10px",
                              color: "#b91c1c",
                              cursor: "pointer",
                              fontSize: "12px",
                              fontWeight: 700,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              transition: "all 0.15s ease",
                            }}
                          >
                            <span style={{ fontWeight: 900 }}>✕</span>
                            <span>Remove</span>
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: "14px",
            borderTop: "1px solid #e2e8f0",
          }}
        >
          <span style={{ fontSize: "12.5px", color: "#475569" }}>
            Total Recorded:{" "}
            <strong style={{ color: totalPcs > 0 ? "#dc2626" : "#0f172a" }}>
              {totalPcs} pcs
            </strong>
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "#0f172a",
              color: "#ffffff",
              border: "none",
              borderRadius: "6px",
              padding: "8px 22px",
              fontSize: "13px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
