import { useState } from "react";

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
      alert("Please enter a valid rejection quantity greater than 0.");
      return;
    }
    const currentVal = Number(reasons[selectedReasonId] || 0);
    onUpdateReason(selectedReasonId, currentVal + num);
    setQty("");
  }

  function handleRemove(reasonId) {
    onUpdateReason(reasonId, 0);
  }

  function handleUpdateDirect(reasonId, val) {
    const clean = val === "" ? "" : Math.max(0, Number(val));
    onUpdateReason(reasonId, clean);
  }

  return (
    <div className="modal-back" onClick={onClose} style={{ zIndex: 1050 }}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "580px",
          width: "92%",
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
                Mold #{idx + 1} Rejections
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
                fontSize: "12px",
                fontWeight: 700,
                color: "#991b1b",
                marginBottom: "8px",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              + Add Defect Entry
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 110px auto",
                gap: "10px",
                alignItems: "end",
              }}
            >
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
                  Defect Type
                </label>
                <select
                  value={selectedReasonId}
                  onChange={(e) => setSelectedReasonId(e.target.value)}
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
                  {rejectionReasons.map((r) => (
                    <option key={r.reason_id} value={r.reason_id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

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
                  type="number"
                  min="1"
                  step="1"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
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
                    padding: "0 14px",
                    fontSize: "13px",
                    fontWeight: 700,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <span>+</span> Add
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
            }}
          >
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
            <span
              style={{
                fontSize: "12px",
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
              No rejections recorded yet for Mold #{idx + 1}.
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
                      <th style={{ padding: "8px 12px", width: "45px", textAlign: "center" }}></th>
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
                          <button
                            type="button"
                            onClick={() => handleRemove(r.reason_id)}
                            title="Remove this defect"
                            style={{
                              background: "#fee2e2",
                              border: "none",
                              borderRadius: "4px",
                              width: "26px",
                              height: "26px",
                              color: "#dc2626",
                              cursor: "pointer",
                              fontSize: "13px",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            ✕
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
              padding: "8px 20px",
              fontSize: "13px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
