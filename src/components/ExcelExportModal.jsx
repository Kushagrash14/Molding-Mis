import React, { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { exportProductionToExcel, exportProductionToCSV } from "../lib/excelExport.js";
import { todayStr } from "../lib/calculations.js";

export default function ExcelExportModal({
  isOpen,
  onClose,
  entries = [],
  master = [],
  machines = [],
  plants = [],
  locations = [],
  reasonCodes = [],
  viewerRole = "admin",
  defaultPlantId = "all",
}) {
  // 1. Plant Selection State
  // If only 1 plant is accessible, auto-select it. Otherwise use defaultPlantId or "all".
  const isSinglePlant = plants.length === 1;
  const initialPlant = isSinglePlant
    ? plants[0].plant_id
    : defaultPlantId && defaultPlantId !== "all"
    ? defaultPlantId
    : "all";

  const [selectedPlant, setSelectedPlant] = useState(initialPlant);

  // Sync when defaultPlantId changes or modal opens
  useEffect(() => {
    if (isSinglePlant) {
      setSelectedPlant(plants[0].plant_id);
    } else if (defaultPlantId) {
      setSelectedPlant(defaultPlantId);
    }
  }, [defaultPlantId, isSinglePlant, plants]);

  // 2. Date Range State & Presets
  const today = useMemo(() => todayStr(), []);
  
  // Calculate default month start: YYYY-MM-01
  const defaultMonthStart = useMemo(() => {
    const parts = today.split("-");
    return `${parts[0]}-${parts[1]}-01`;
  }, [today]);

  const [datePreset, setDatePreset] = useState("this_month");
  const [startDate, setStartDate] = useState(defaultMonthStart);
  const [endDate, setEndDate] = useState(today);

  // 3. Export Format: "xlsx" (default) or "csv"
  const [exportFormat, setExportFormat] = useState("xlsx");
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  // Handle Preset changes
  function applyPreset(presetKey) {
    setDatePreset(presetKey);
    const now = new Date();

    if (presetKey === "today") {
      setStartDate(today);
      setEndDate(today);
    } else if (presetKey === "yesterday") {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const yStr = y.toISOString().slice(0, 10);
      setStartDate(yStr);
      setEndDate(yStr);
    } else if (presetKey === "last_7_days") {
      const d7 = new Date();
      d7.setDate(d7.getDate() - 6);
      setStartDate(d7.toISOString().slice(0, 10));
      setEndDate(today);
    } else if (presetKey === "this_month") {
      setStartDate(defaultMonthStart);
      setEndDate(today);
    } else if (presetKey === "unlocked_sep2026") {
      setStartDate("2026-09-01");
      setEndDate("2026-09-24");
    } else if (presetKey === "all") {
      setStartDate("");
      setEndDate("");
    }
  }

  // 4. Calculate Matched Records in real-time
  const matchedEntries = useMemo(() => {
    return entries.filter((e) => {
      // Plant filter
      if (selectedPlant !== "all" && e.plant_id !== selectedPlant) {
        return false;
      }
      // Date range filter
      if (startDate && e.shift_date && e.shift_date < startDate) {
        return false;
      }
      if (endDate && e.shift_date && e.shift_date > endDate) {
        return false;
      }
      return true;
    });
  }, [entries, selectedPlant, startDate, endDate]);

  const totalRuns = useMemo(() => {
    return matchedEntries.reduce((sum, e) => sum + (e.runs ? e.runs.length : 1), 0);
  }, [matchedEntries]);

  // 5. Handle Export Action
  function handleExecuteExport() {
    if (matchedEntries.length === 0) {
      alert("No records found for the selected plant and date filter.");
      return;
    }

    setIsExporting(true);

    setTimeout(() => {
      try {
        const pObj = plants.find((p) => p.plant_id === selectedPlant);
        const plantLabel = selectedPlant !== "all" ? (pObj ? pObj.name : selectedPlant) : "All_Plants";
        const dateLabel = startDate && endDate
          ? `${startDate}_to_${endDate}`
          : startDate
          ? `From_${startDate}`
          : endDate
          ? `Until_${endDate}`
          : "All_Dates";
        const scopeLabel = `${plantLabel}_${dateLabel}`;

        if (exportFormat === "xlsx") {
          exportProductionToExcel({
            entries: matchedEntries,
            master,
            machines,
            plants,
            locations,
            reasonCodes,
            filterInfo: scopeLabel,
            viewerRole,
          });
        } else {
          exportProductionToCSV({
            entries: matchedEntries,
            master,
            machines,
            plants,
            reasonCodes,
            viewerRole,
          });
        }

        setExportSuccess(true);
        setTimeout(() => {
          setExportSuccess(false);
          setIsExporting(false);
          onClose();
        }, 1200);
      } catch (err) {
        console.error("Export error:", err);
        alert("Failed to export: " + err.message);
        setIsExporting(false);
      }
    }, 120);
  }

  if (!isOpen) return null;

  return createPortal(
    <div className="modal-back" onClick={onClose} style={{ zIndex: 1100 }}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "600px", width: "95%", borderRadius: "16px", padding: "28px" }}
      >
        {/* Header */}
        <div className="modal-head" style={{ marginBottom: "20px" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "20px", display: "flex", alignItems: "center", gap: "8px", color: "#0f172a" }}>
              <span>📊</span>
              <span>Export Production &amp; OEE Data</span>
            </h3>
            <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748b" }}>
              Filter by manufacturing plant and date range to generate a tailored report.
            </p>
          </div>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            title="Close dialog"
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* SECTION 1: PLANT SELECTION */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <label style={{ fontSize: "12px", fontWeight: 800, color: "#334155", letterSpacing: "0.5px" }}>
                1. MANUFACTURING PLANT
              </label>
              {isSinglePlant && (
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    background: "#ecfdf5",
                    color: "#059669",
                    padding: "2px 8px",
                    borderRadius: "12px",
                    border: "1px solid #a7f3d0",
                  }}
                >
                  🔒 Auto-Selected
                </span>
              )}
            </div>

            {isSinglePlant ? (
              // If user only has 1 plant: Display clean, fixed locked badge
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "#f8fafc",
                  border: "1.5px solid #cbd5e1",
                  borderRadius: "10px",
                  padding: "12px 16px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "20px" }}>🏭</span>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: "14px", color: "#0f172a" }}>
                      {plants[0].name}
                    </div>
                    <div style={{ fontSize: "11.5px", color: "#64748b" }}>
                      Plant Code: <strong>{plants[0].plant_id}</strong>
                    </div>
                  </div>
                </div>
                <span style={{ fontSize: "12px", fontWeight: 600, color: "#475569" }}>
                  Your Assigned Unit
                </span>
              </div>
            ) : (
              // If multiple plants: Display high-usability dropdown
              <select
                value={selectedPlant}
                onChange={(e) => setSelectedPlant(e.target.value)}
                style={{
                  width: "100%",
                  height: "44px",
                  padding: "0 14px",
                  fontSize: "14px",
                  fontWeight: 600,
                  borderRadius: "10px",
                  border: "1.5px solid #cbd5e1",
                  background: "#ffffff",
                  color: "#0f172a",
                  outline: "none",
                  cursor: "pointer",
                }}
              >
                <option value="all">🏭 All Accessible Plants ({plants.length} Total Units)</option>
                {plants.map((p) => (
                  <option key={p.plant_id} value={p.plant_id}>
                    🏭 {p.name} ({p.plant_id})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* SECTION 2: DATE RANGE FILTER */}
          <div>
            <label style={{ fontSize: "12px", fontWeight: 800, color: "#334155", letterSpacing: "0.5px", display: "block", marginBottom: "8px" }}>
              2. DATE RANGE
            </label>

            {/* Quick Presets Pills */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "12px" }}>
              {[
                { id: "today", label: "Today" },
                { id: "yesterday", label: "Yesterday" },
                { id: "last_7_days", label: "Last 7 Days" },
                { id: "this_month", label: "This Month" },
                { id: "unlocked_sep2026", label: "1–22 Sep Window" },
                { id: "all", label: "All Dates" },
              ].map((p) => {
                const isActive = datePreset === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyPreset(p.id)}
                    style={{
                      padding: "6px 12px",
                      fontSize: "12px",
                      fontWeight: 700,
                      borderRadius: "8px",
                      border: isActive ? "1.5px solid #0284c7" : "1.5px solid #e2e8f0",
                      background: isActive ? "#f0f9ff" : "#ffffff",
                      color: isActive ? "#0284c7" : "#475569",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>

            {/* Custom From & To Inputs */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", display: "block", marginBottom: "4px" }}>
                  FROM DATE
                </span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setDatePreset("custom");
                  }}
                  style={{
                    width: "100%",
                    height: "40px",
                    padding: "0 10px",
                    fontSize: "13px",
                    borderRadius: "8px",
                    border: "1.5px solid #cbd5e1",
                    background: "#ffffff",
                    color: "#0f172a",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", display: "block", marginBottom: "4px" }}>
                  TO DATE
                </span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setDatePreset("custom");
                  }}
                  style={{
                    width: "100%",
                    height: "40px",
                    padding: "0 10px",
                    fontSize: "13px",
                    borderRadius: "8px",
                    border: "1.5px solid #cbd5e1",
                    background: "#ffffff",
                    color: "#0f172a",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>
          </div>

          {/* SECTION 3: EXPORT FORMAT SELECTION */}
          <div>
            <label style={{ fontSize: "12px", fontWeight: 800, color: "#334155", letterSpacing: "0.5px", display: "block", marginBottom: "8px" }}>
              3. FILE FORMAT
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <button
                type="button"
                onClick={() => setExportFormat("xlsx")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px 14px",
                  borderRadius: "10px",
                  border: exportFormat === "xlsx" ? "2px solid #16a34a" : "1.5px solid #cbd5e1",
                  background: exportFormat === "xlsx" ? "#f0fdf4" : "#ffffff",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <span style={{ fontSize: "22px" }}>📊</span>
                <div>
                  <div style={{ fontWeight: 800, fontSize: "13px", color: "#0f172a" }}>
                    Excel Workbook (.xlsx)
                  </div>
                  <div style={{ fontSize: "11px", color: "#64748b" }}>
                    3 Sheets: Register, Pareto &amp; KPI Rollup
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setExportFormat("csv")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px 14px",
                  borderRadius: "10px",
                  border: exportFormat === "csv" ? "2px solid #0284c7" : "1.5px solid #cbd5e1",
                  background: exportFormat === "csv" ? "#f0f9ff" : "#ffffff",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <span style={{ fontSize: "22px" }}>📄</span>
                <div>
                  <div style={{ fontWeight: 800, fontSize: "13px", color: "#0f172a" }}>
                    CSV Data File (.csv)
                  </div>
                  <div style={{ fontSize: "11px", color: "#64748b" }}>
                    Single raw comma-separated table
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* SECTION 4: LIVE RECORD MATCH PREVIEW BADGE */}
          <div
            style={{
              padding: "12px 16px",
              borderRadius: "10px",
              background: matchedEntries.length > 0 ? "#f8fafc" : "#fff5f5",
              border: matchedEntries.length > 0 ? "1px solid #e2e8f0" : "1px solid #fed7d7",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "16px" }}>{matchedEntries.length > 0 ? "📋" : "⚠️"}</span>
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: 700,
                  color: matchedEntries.length > 0 ? "#334155" : "#e53e3e",
                }}
              >
                {matchedEntries.length > 0
                  ? `${matchedEntries.length} Shift Entries (${totalRuns} Mold Runs) selected`
                  : "No records found matching this plant and date range."}
              </span>
            </div>
            {matchedEntries.length > 0 && (
              <span style={{ fontSize: "11.5px", fontWeight: 600, color: "#64748b" }}>
                Ready to download
              </span>
            )}
          </div>
        </div>

        {/* Modal Action Buttons */}
        <div
          style={{
            marginTop: "24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: "10px",
          }}
        >
          <button
            type="button"
            className="btn secondary"
            onClick={onClose}
            disabled={isExporting}
            style={{ padding: "10px 18px", fontSize: "13.5px" }}
          >
            Cancel
          </button>

          <button
            type="button"
            className="btn-excel-export"
            onClick={handleExecuteExport}
            disabled={isExporting || matchedEntries.length === 0}
            style={{
              padding: "10px 22px",
              fontSize: "14px",
              fontWeight: 800,
              minWidth: "180px",
              justifyContent: "center",
              background: exportSuccess
                ? "#15803d"
                : exportFormat === "xlsx"
                ? "#16a34a"
                : "#0284c7",
            }}
          >
            <span>{exportSuccess ? "✓" : isExporting ? "⏳" : exportFormat === "xlsx" ? "📊" : "📄"}</span>
            <span>
              {exportSuccess
                ? "Downloaded Successfully!"
                : isExporting
                ? "Generating..."
                : `Download ${exportFormat.toUpperCase()}`}
            </span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
