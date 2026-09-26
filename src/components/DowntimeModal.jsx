import { useState, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { normalizeReasonsMap } from "../lib/calculations.js";

export default function DowntimeModal({
  isOpen,
  onClose,
  idx = 0,
  sapCode = "",
  materialDescription = "",
  downtimeReasons = [],
  reasons = {},
  otherDtRemark = "",
  plannedHours = 12,
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
  const [justAddedMsg, setJustAddedMsg] = useState(null);

  const hoursInputRef = useRef(null);

  // Update selectedReasonId when categoryTab changes if current selected reason is not in this category
  const activeReasonInList = filteredReasons.some((r) => r.reason_id === selectedReasonId);
  const currentReasonId = activeReasonInList ? selectedReasonId : filteredReasons[0]?.reason_id;

  if (!isOpen) return null;

  const normReasons = useMemo(() => normalizeReasonsMap(reasons), [reasons]);

  // Calculate totals from currently logged reasons
  const loggedDowntimes = downtimeReasons
    .map((r) => ({
      ...r,
      minutes: Number(normReasons[r.reason_id] || 0),
    }))
    .filter((r) => r.minutes > 0);

  const plannedLogged = loggedDowntimes.filter((r) => r.category === "planned_dt");
  const unplannedLogged = loggedDowntimes.filter((r) => r.category === "unplanned_dt");

  const plannedMins = plannedLogged.reduce((sum, r) => sum + r.minutes, 0);
  const unplannedMins = unplannedLogged.reduce((sum, r) => sum + r.minutes, 0);
  const totalMins = plannedMins + unplannedMins;

  const inputHoursNum = Number(hours || 0);
  const inputMinutesNum = Number(minutes || 0);
  const entryTotalMins = inputHoursNum * 60 + inputMinutesNum;

  function formatDuration(mins) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0 && m > 0) return `${h}h ${m}m (${mins} min)`;
    if (h > 0) return `${h}h (${mins} min)`;
    return `${m} mins`;
  }

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

    const currentVal = Number(normReasons[currentReasonId] || 0);
    const reasonObj = downtimeReasons.find((r) => r.reason_id === currentReasonId);
    const reasonName = reasonObj?.name || "Downtime";
    const addedFormatted = formatDuration(entryTotalMins);

    onUpdateReason(currentReasonId, currentVal + entryTotalMins);
    if (currentReasonId === "udt_others") {
      onUpdateOtherRemark(remark.trim());
    }

    setJustAddedMsg(`Added ${addedFormatted} for "${reasonName}" (${categoryTab === "planned_dt" ? "Planned" : "Unplanned"})!`);
    setHours("");
    setMinutes("");
    if (currentReasonId === "udt_others") {
      setRemark("");
    }

    // Auto-focus back to hours input
    setTimeout(() => {
      if (hoursInputRef.current) {
        hoursInputRef.current.focus();
      }
    }, 50);
  }

  function handleRemove(reasonId) {
    onUpdateReason(reasonId, 0);
    if (reasonId === "udt_others") {
      onUpdateOtherRemark("");
    }
    setJustAddedMsg(null);
  }

  function handleClearAll() {
    if (window.confirm(`Are you sure you want to remove all logged downtimes for Mold #${idx + 1}?`)) {
      loggedDowntimes.forEach((r) => {
        onUpdateReason(r.reason_id, 0);
      });
      onUpdateOtherRemark("");
      setJustAddedMsg(null);
    }
  }

  function handleUpdateMins(reasonId, val) {
    const clean = val === "" ? "" : Math.max(0, Number(val));
    onUpdateReason(reasonId, clean);
  }

  return createPortal(
    <div className="modal-back" onClick={onClose} style={{ zIndex: 1050 }}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "700px",
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
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span>❓</span>
                <span>Select Downtime Category to Add:</span>
              </div>
              <span style={{ fontSize: "11px", color: "#64748b" }}>
                {categoryTab === "planned_dt" ? "5 Planned Reasons" : "16 Unplanned Reasons"}
              </span>
            </div>

            {/* PDT vs UDT Toggle Buttons */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "14px" }}>
              <button
                type="button"
                onClick={() => {
                  setCategoryTab("planned_dt");
                  setJustAddedMsg(null);
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
                  border: categoryTab === "planned_dt" ? "2.5px solid #0284c7" : "1.5px solid #cbd5e1",
                  background: categoryTab === "planned_dt" ? "#e0f2fe" : "#ffffff",
                  color: categoryTab === "planned_dt" ? "#0369a1" : "#64748b",
                  boxShadow: categoryTab === "planned_dt" ? "0 2px 4px rgba(2, 132, 199, 0.15)" : "none",
                }}
              >
                <span>📅</span>
                <span>Planned Downtime (PDT)</span>
                {plannedLogged.length > 0 && (
                  <span style={{ fontSize: "11px", background: "#0284c7", color: "#fff", padding: "1px 6px", borderRadius: "10px" }}>
                    {plannedLogged.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setCategoryTab("unplanned_dt");
                  setJustAddedMsg(null);
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
                  border: categoryTab === "unplanned_dt" ? "2.5px solid #ea580c" : "1.5px solid #cbd5e1",
                  background: categoryTab === "unplanned_dt" ? "#ffedd5" : "#ffffff",
                  color: categoryTab === "unplanned_dt" ? "#c2410c" : "#64748b",
                  boxShadow: categoryTab === "unplanned_dt" ? "0 2px 4px rgba(234, 88, 12, 0.15)" : "none",
                }}
              >
                <span>⚠️</span>
                <span>Unplanned Downtime (UDT)</span>
                {unplannedLogged.length > 0 && (
                  <span style={{ fontSize: "11px", background: "#ea580c", color: "#fff", padding: "1px 6px", borderRadius: "10px" }}>
                    {unplannedLogged.length}
                  </span>
                )}
              </button>
            </div>

            {/* Time Input & Reason Section */}
            <div
              style={{
                background: "#ffffff",
                border: categoryTab === "planned_dt" ? "1.5px solid #bae6fd" : "1.5px solid #fed7aa",
                borderRadius: "8px",
                padding: "14px",
              }}
            >
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: 800,
                  color: categoryTab === "planned_dt" ? "#0369a1" : "#c2410c",
                  marginBottom: "8px",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                {categoryTab === "planned_dt"
                  ? (plannedMins > 0 ? "➕ Add Another Planned Downtime" : "➕ Add Planned Downtime")
                  : (unplannedMins > 0 ? "➕ Add Another Unplanned Downtime" : "➕ Add Unplanned Downtime")}
              </div>

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
                    Select Reason ({categoryTab === "planned_dt" ? "Planned" : "Unplanned"})
                  </label>
                  <select
                    value={currentReasonId}
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
                      border: "1.5px solid #cbd5e1",
                      padding: "0 8px",
                      background: "#ffffff",
                      color: "#0f172a",
                    }}
                  >
                    {filteredReasons.map((r) => {
                      const existingMins = Number(reasons[r.reason_id] || 0);
                      return (
                        <option key={r.reason_id} value={r.reason_id}>
                          {r.name} {existingMins > 0 ? `(${formatDuration(existingMins)} logged)` : ""}
                        </option>
                      );
                    })}
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
                      ref={hoursInputRef}
                      type="number"
                      min="0"
                      step="1"
                      value={hours}
                      onChange={(e) => {
                        setHours(e.target.value);
                        setJustAddedMsg(null);
                      }}
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
                      onChange={(e) => {
                        setMinutes(e.target.value);
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

                {/* Add / Add Another Button */}
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
                      padding: "0 16px",
                      fontSize: "13px",
                      fontWeight: 700,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      boxShadow:
                        categoryTab === "planned_dt"
                          ? "0 1px 3px rgba(2, 132, 199, 0.3)"
                          : "0 1px 3px rgba(234, 88, 12, 0.3)",
                    }}
                  >
                    <span>+</span>
                    <span>
                      {categoryTab === "planned_dt"
                        ? (plannedMins > 0 ? "Add Another" : "Add PDT")
                        : (unplannedMins > 0 ? "Add Another" : "Add UDT")}
                    </span>
                  </button>
                </div>
              </div>

              {/* Total preview pill */}
              {entryTotalMins > 0 && (
                <div
                  style={{
                    marginTop: "8px",
                    fontSize: "12px",
                    color: categoryTab === "planned_dt" ? "#0369a1" : "#c2410c",
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <span>⏱️ Duration to add:</span>
                  <span
                    style={{
                      background: categoryTab === "planned_dt" ? "#e0f2fe" : "#ffedd5",
                      padding: "2px 8px",
                      borderRadius: "4px",
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
                Logged Downtimes ({loggedDowntimes.length})
              </span>
              {loggedDowntimes.length > 0 && !isReadOnly && (
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
                  title="Remove all downtimes"
                >
                  <span>✕</span> Remove All
                </button>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <span
                style={{
                  fontSize: "12.5px",
                  fontWeight: 800,
                  color: totalMins > 0 ? "#0369a1" : "#64748b",
                }}
              >
                Total Downtime: {formatDuration(totalMins)}
              </span>
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 800,
                  color: "#15803d",
                  background: "#dcfce7",
                  border: "1px solid #86efac",
                  padding: "2px 8px",
                  borderRadius: "6px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
                title="Running hours decrease automatically with downtime"
              >
                ⏱️ Run Hours: {Math.max(0, Number((Number(plannedHours || 12) - totalMins / 60).toFixed(1)))}h / {plannedHours || 12}h
              </span>
            </div>
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
              No downtime recorded yet for Mold #{idx + 1}. Select Planned or Unplanned above to add.
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
                    <th style={{ padding: "8px 12px", fontWeight: 700, width: "120px", textAlign: "right" }}>
                      Duration
                    </th>
                    {!isReadOnly && (
                      <th style={{ padding: "8px 12px", width: "95px", textAlign: "center" }}>
                        Action
                      </th>
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

                        {/* Dedicated, prominent Remove Cross Button */}
                        {!isReadOnly && (
                          <td style={{ padding: "8px 12px", textAlign: "center" }}>
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
    </div>,
    document.body
  );
}
