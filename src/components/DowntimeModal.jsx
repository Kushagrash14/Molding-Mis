import { useState, useMemo } from "react";

export default function DowntimeModal({
  isOpen,
  onClose,
  idx = 0,
  sapCode = "",
  materialDescription = "",
  downtimeReasons = [],
  reasons = {},
  otherDtRemark = "",
  onUpdateReason,
  onUpdateOtherRemark,
  isReadOnly = false,
}) {
  const [categoryTab, setCategoryTab] = useState("planned_dt"); // "planned_dt" | "unplanned_dt"

  // Filter available reasons by category
  const filteredReasons = useMemo(
    () => downtimeReasons.filter((r) => r.category === categoryTab),
    [downtimeReasons, categoryTab]
  );

  const [selectedReasonId, setSelectedReasonId] = useState(
    () => filteredReasons[0]?.reason_id || "pdt_lunch"
  );
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");
  const [remark, setRemark] = useState(otherDtRemark || "");

  // Update selectedReasonId when categoryTab changes if current selected reason is not in this category
  const activeReasonInList = filteredReasons.some((r) => r.reason_id === selectedReasonId);
  const currentReasonId = activeReasonInList ? selectedReasonId : filteredReasons[0]?.reason_id;

  if (!isOpen) return null;

  // Calculate totals from currently logged reasons
  const loggedDowntimes = downtimeReasons
    .map((r) => ({
      ...r,
      minutes: Number(reasons[r.reason_id] || 0),
    }))
    .filter((r) => r.minutes > 0);

  const plannedMins = loggedDowntimes
    .filter((r) => r.category === "planned_dt")
    .reduce((sum, r) => sum + r.minutes, 0);
  const unplannedMins = loggedDowntimes
    .filter((r) => r.category === "unplanned_dt")
    .reduce((sum, r) => sum + r.minutes, 0);
  const totalMins = plannedMins + unplannedMins;

  const inputHoursNum = Number(hours || 0);
  const inputMinutesNum = Number(minutes || 0);
  const entryTotalMins = inputHoursNum * 60 + inputMinutesNum;

  function handleAdd() {
    if (!currentReasonId) return;
    if (entryTotalMins <= 0) {
      alert("Please enter a valid downtime duration (hours or minutes greater than 0).");
      return;
    }
    if (currentReasonId === "udt_others" && !remark.trim()) {
      alert("Please specify the mandatory reason description for 'OTHERS' downtime.");
      return;
    }

    const currentVal = Number(reasons[currentReasonId] || 0);
    onUpdateReason(currentReasonId, currentVal + entryTotalMins);
    if (currentReasonId === "udt_others") {
      onUpdateOtherRemark(remark.trim());
    }

    setHours("");
    setMinutes("");
    if (currentReasonId === "udt_others") {
      setRemark("");
    }
  }

  function handleRemove(reasonId) {
    onUpdateReason(reasonId, 0);
    if (reasonId === "udt_others") {
      onUpdateOtherRemark("");
    }
  }

  function handleUpdateMins(reasonId, val) {
    const clean = val === "" ? "" : Math.max(0, Number(val));
    onUpdateReason(reasonId, clean);
  }

  function formatDuration(mins) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0 && m > 0) return `${h}h ${m}m (${mins} min)`;
    if (h > 0) return `${h}h (${mins} min)`;
    return `${m} mins`;
  }

  return (
    <div className="modal-back" onClick={onClose} style={{ zIndex: 1050 }}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "680px",
          width: "94%",
          padding: "22px",
          borderRadius: "14px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          maxHeight: "92vh",
          overflowY: "auto",
        }}
      >
        {/* Header */}
        <div className="modal-head" style={{ marginBottom: "16px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "20px" }}>⏱️</span>
              <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 800, color: "#0369a1" }}>
                Mold #{idx + 1} Downtime Management
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

        {/* Category Question / Tabs */}
        {!isReadOnly && (
          <div
            style={{
              background: "#f8fafc",
              border: "1.5px solid #e2e8f0",
              borderRadius: "10px",
              padding: "14px",
              marginBottom: "18px",
            }}
          >
            <div
              style={{
                fontSize: "12px",
                fontWeight: 700,
                color: "#475569",
                marginBottom: "10px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span>❓</span>
              <span>What type of downtime do you want to add?</span>
            </div>

            {/* PDT vs UDT Toggle Buttons */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "14px" }}>
              <button
                type="button"
                onClick={() => {
                  setCategoryTab("planned_dt");
                  const pdtFirst = downtimeReasons.find((r) => r.category === "planned_dt");
                  if (pdtFirst) setSelectedReasonId(pdtFirst.reason_id);
                }}
                style={{
                  padding: "10px 14px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  transition: "all 0.15s ease",
                  border: categoryTab === "planned_dt" ? "2px solid #0284c7" : "1.5px solid #cbd5e1",
                  background: categoryTab === "planned_dt" ? "#e0f2fe" : "#ffffff",
                  color: categoryTab === "planned_dt" ? "#0369a1" : "#64748b",
                }}
              >
                <span>📅</span>
                <span>Planned Downtime (PDT)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCategoryTab("unplanned_dt");
                  const udtFirst = downtimeReasons.find((r) => r.category === "unplanned_dt");
                  if (udtFirst) setSelectedReasonId(udtFirst.reason_id);
                }}
                style={{
                  padding: "10px 14px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  transition: "all 0.15s ease",
                  border: categoryTab === "unplanned_dt" ? "2px solid #ea580c" : "1.5px solid #cbd5e1",
                  background: categoryTab === "unplanned_dt" ? "#ffedd5" : "#ffffff",
                  color: categoryTab === "unplanned_dt" ? "#c2410c" : "#64748b",
                }}
              >
                <span>⚠️</span>
                <span>Unplanned Downtime (UDT)</span>
              </button>
            </div>

            {/* Time Input & Reason Section */}
            <div
              style={{
                background: "#ffffff",
                border: categoryTab === "planned_dt" ? "1.5px solid #bae6fd" : "1.5px solid #fed7aa",
                borderRadius: "8px",
                padding: "12px",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.2fr 85px 85px auto",
                  gap: "10px",
                  alignItems: "end",
                }}
              >
                {/* Reason Dropdown */}
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "11.5px",
                      fontWeight: 700,
                      color: categoryTab === "planned_dt" ? "#0369a1" : "#c2410c",
                      marginBottom: "4px",
                    }}
                  >
                    Reason ({categoryTab === "planned_dt" ? "Planned" : "Unplanned"})
                  </label>
                  <select
                    value={currentReasonId}
                    onChange={(e) => setSelectedReasonId(e.target.value)}
                    style={{
                      width: "100%",
                      height: "38px",
                      fontSize: "13px",
                      fontWeight: 600,
                      borderRadius: "6px",
                      border: "1.5px solid #cbd5e1",
                      padding: "0 8px",
                      background: "#ffffff",
                      color: "#0f172a",
                    }}
                  >
                    {filteredReasons.map((r) => (
                      <option key={r.reason_id} value={r.reason_id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Hours Input */}
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "11.5px",
                      fontWeight: 700,
                      color: "#475569",
                      marginBottom: "4px",
                    }}
                  >
                    Hours
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={hours}
                      onChange={(e) => setHours(e.target.value)}
                      placeholder="0"
                      style={{
                        width: "100%",
                        height: "38px",
                        fontSize: "14px",
                        fontWeight: 700,
                        borderRadius: "6px",
                        border: "1.5px solid #cbd5e1",
                        padding: "0 26px 0 8px",
                        boxSizing: "border-box",
                        textAlign: "right",
                      }}
                    />
                    <span
                      style={{
                        position: "absolute",
                        right: "6px",
                        top: "10px",
                        fontSize: "11px",
                        color: "#94a3b8",
                        fontWeight: 700,
                      }}
                    >
                      h
                    </span>
                  </div>
                </div>

                {/* Minutes Input */}
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "11.5px",
                      fontWeight: 700,
                      color: "#475569",
                      marginBottom: "4px",
                    }}
                  >
                    Minutes
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      step="1"
                      value={minutes}
                      onChange={(e) => setMinutes(e.target.value)}
                      placeholder="0"
                      style={{
                        width: "100%",
                        height: "38px",
                        fontSize: "14px",
                        fontWeight: 700,
                        borderRadius: "6px",
                        border: "1.5px solid #cbd5e1",
                        padding: "0 28px 0 8px",
                        boxSizing: "border-box",
                        textAlign: "right",
                      }}
                    />
                    <span
                      style={{
                        position: "absolute",
                        right: "6px",
                        top: "10px",
                        fontSize: "11px",
                        color: "#94a3b8",
                        fontWeight: 700,
                      }}
                    >
                      m
                    </span>
                  </div>
                </div>

                {/* Add Button */}
                <div>
                  <button
                    type="button"
                    onClick={handleAdd}
                    style={{
                      height: "38px",
                      background: categoryTab === "planned_dt" ? "#0284c7" : "#ea580c",
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

              {/* Total preview pill */}
              {entryTotalMins > 0 && (
                <div
                  style={{
                    marginTop: "8px",
                    fontSize: "12px",
                    color: "#0369a1",
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <span>⏱️ Duration to add:</span>
                  <span
                    style={{
                      background: "#e0f2fe",
                      padding: "2px 8px",
                      borderRadius: "4px",
                      color: "#0369a1",
                    }}
                  >
                    {inputHoursNum > 0 ? `${inputHoursNum}h ` : ""}
                    {inputMinutesNum > 0 ? `${inputMinutesNum}m ` : ""}
                    (= {entryTotalMins} minutes)
                  </span>
                </div>
              )}

              {/* Mandatory Remark for Others */}
              {currentReasonId === "udt_others" && (
                <div style={{ marginTop: "10px" }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: "11.5px",
                      fontWeight: 700,
                      color: "#dc2626",
                      marginBottom: "4px",
                    }}
                  >
                    * Mandatory Reason for Others Downtime:
                  </label>
                  <input
                    type="text"
                    value={remark}
                    onChange={(e) => setRemark(e.target.value)}
                    placeholder="Enter reason description for Others downtime..."
                    style={{
                      width: "100%",
                      height: "36px",
                      fontSize: "12.5px",
                      borderRadius: "6px",
                      border: "1.5px solid #f87171",
                      padding: "0 10px",
                      boxSizing: "border-box",
                      background: "#fff5f5",
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Logged Downtimes List */}
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
              Logged Downtimes ({loggedDowntimes.length})
            </span>
            <span
              style={{
                fontSize: "12px",
                fontWeight: 800,
                color: totalMins > 0 ? "#0369a1" : "#64748b",
              }}
            >
              Total: {formatDuration(totalMins)}
            </span>
          </div>

          {loggedDowntimes.length === 0 ? (
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
              No downtime recorded yet for Mold #{idx + 1}.
            </div>
          ) : (
            <div
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                overflow: "hidden",
                maxHeight: "240px",
                overflowY: "auto",
              }}
            >
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ background: "#f1f5f9", textAlign: "left", color: "#475569" }}>
                    <th style={{ padding: "8px 12px", fontWeight: 700, width: "80px" }}>Type</th>
                    <th style={{ padding: "8px 12px", fontWeight: 700 }}>Reason / Description</th>
                    <th style={{ padding: "8px 12px", fontWeight: 700, width: "130px", textAlign: "right" }}>
                      Duration
                    </th>
                    {!isReadOnly && (
                      <th style={{ padding: "8px 12px", width: "45px", textAlign: "center" }}></th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {loggedDowntimes.map((r, i) => {
                    const isPDT = r.category === "planned_dt";
                    const isOthers = r.reason_id === "udt_others";
                    return (
                      <tr
                        key={r.reason_id}
                        style={{
                          borderTop: "1px solid #f1f5f9",
                          background: i % 2 === 0 ? "#ffffff" : "#fbfcfd",
                        }}
                      >
                        {/* Type Badge */}
                        <td style={{ padding: "8px 12px" }}>
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: 800,
                              padding: "2px 6px",
                              borderRadius: "4px",
                              background: isPDT ? "#e0f2fe" : "#ffedd5",
                              color: isPDT ? "#0369a1" : "#c2410c",
                              border: isPDT ? "1px solid #bae6fd" : "1px solid #fed7aa",
                            }}
                          >
                            {isPDT ? "PDT" : "UDT"}
                          </span>
                        </td>

                        {/* Reason name and remark */}
                        <td style={{ padding: "8px 12px" }}>
                          <div style={{ fontWeight: 600, color: "#1e293b" }}>{r.name}</div>
                          {isOthers && otherDtRemark && (
                            <div
                              style={{
                                fontSize: "11.5px",
                                color: "#b91c1c",
                                marginTop: "2px",
                                fontStyle: "italic",
                              }}
                            >
                              Remark: {otherDtRemark}
                            </div>
                          )}
                        </td>

                        {/* Duration with inline minutes edit */}
                        <td style={{ padding: "8px 12px", textAlign: "right" }}>
                          {isReadOnly ? (
                            <span style={{ fontWeight: 800, color: isPDT ? "#0369a1" : "#ea580c" }}>
                              {formatDuration(r.minutes)}
                            </span>
                          ) : (
                            <div style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                              <input
                                type="number"
                                min="0"
                                value={r.minutes}
                                onChange={(e) => handleUpdateMins(r.reason_id, e.target.value)}
                                style={{
                                  width: "60px",
                                  height: "28px",
                                  textAlign: "right",
                                  fontWeight: 700,
                                  fontSize: "13px",
                                  border: "1px solid #cbd5e1",
                                  borderRadius: "4px",
                                  padding: "0 4px",
                                }}
                              />
                              <span style={{ fontSize: "11px", color: "#64748b" }}>min</span>
                            </div>
                          )}
                        </td>

                        {/* Delete Action */}
                        {!isReadOnly && (
                          <td style={{ padding: "8px 12px", textAlign: "center" }}>
                            <button
                              type="button"
                              onClick={() => handleRemove(r.reason_id)}
                              title="Remove this downtime"
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
                                justifyItems: "center",
                              }}
                            >
                              ✕
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Summary Breakdown & Footer */}
        <div
          style={{
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: "8px",
            padding: "10px 14px",
            marginBottom: "16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "10px",
            fontSize: "12.5px",
          }}
        >
          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
            <span>
              📅 Planned (PDT):{" "}
              <strong style={{ color: "#0369a1" }}>
                {(plannedMins / 60).toFixed(2)}h ({plannedMins}m)
              </strong>
            </span>
            <span>
              ⚠️ Unplanned (UDT):{" "}
              <strong style={{ color: "#ea580c" }}>
                {(unplannedMins / 60).toFixed(2)}h ({unplannedMins}m)
              </strong>
            </span>
          </div>
          <div>
            Total DT:{" "}
            <strong style={{ color: "#0f172a", fontSize: "13.5px" }}>
              {(totalMins / 60).toFixed(2)} hrs ({totalMins} mins)
            </strong>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "10px",
            paddingTop: "10px",
            borderTop: "1px solid #e2e8f0",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "#0f172a",
              color: "#ffffff",
              border: "none",
              borderRadius: "6px",
              padding: "8px 24px",
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
