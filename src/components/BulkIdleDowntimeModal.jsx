import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";

export default function BulkIdleDowntimeModal({
  isOpen,
  onClose,
  plantMachines = [],
  sheetData = {},
  savedMachines = new Set(),
  selectedShift,
  reasonCodes = [],
  onApply,
}) {
  const [selectedReasonId, setSelectedReasonId] = useState("pdt_no_plan");
  const [filterMode, setFilterMode] = useState("UNFILLED"); // "UNFILLED" | "ALL"
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMachineIds, setSelectedMachineIds] = useState(new Set());

  // Determine which machines are currently unfilled
  const machineStatusList = useMemo(() => {
    return plantMachines.map((m) => {
      const runs = sheetData[m.machine_id] || [];
      const isSaved = savedMachines.has(m.machine_id);
      const hasProd = runs.some((r) => Number(r.ok_prod) > 0);
      const hasSap = runs.some((r) => r.sap_code && r.sap_code !== "DOWN_12H");
      const hasDt = runs.some((r) => {
        const reasons = r.reasons || {};
        return Object.values(reasons).some((v) => Number(v) > 0);
      });

      const isUnfilled = !isSaved && !hasProd && !hasSap && !hasDt;

      return {
        ...m,
        isSaved,
        hasProd,
        hasSap,
        hasDt,
        isUnfilled,
      };
    });
  }, [plantMachines, sheetData, savedMachines]);

  // Pre-select all unfilled machines when modal opens
  useEffect(() => {
    if (isOpen) {
      const unfilledIds = machineStatusList
        .filter((m) => m.isUnfilled)
        .map((m) => m.machine_id);
      setSelectedMachineIds(new Set(unfilledIds));
      setFilterMode("UNFILLED");
      setSearchTerm("");
    }
  }, [isOpen, machineStatusList]);

  // Filtered list based on tab and search
  const visibleMachines = useMemo(() => {
    return machineStatusList.filter((m) => {
      if (filterMode === "UNFILLED" && !m.isUnfilled) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const mNo = (m.machine_no || "").toLowerCase();
        const mId = (m.machine_id || "").toLowerCase();
        const mModel = (m.model || m.make || "").toLowerCase();
        if (!mNo.includes(q) && !mId.includes(q) && !mModel.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [machineStatusList, filterMode, searchTerm]);

  if (!isOpen) return null;

  const plannedHours = Number(selectedShift?.planned_hours || 12.0);
  const plannedMins = Math.round(plannedHours * 60);

  const toggleMachine = (mId) => {
    setSelectedMachineIds((prev) => {
      const next = new Set(prev);
      if (next.has(mId)) {
        next.delete(mId);
      } else {
        next.add(mId);
      }
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelectedMachineIds((prev) => {
      const next = new Set(prev);
      visibleMachines.forEach((m) => next.add(m.machine_id));
      return next;
    });
  };

  const deselectAllVisible = () => {
    setSelectedMachineIds((prev) => {
      const next = new Set(prev);
      visibleMachines.forEach((m) => next.delete(m.machine_id));
      return next;
    });
  };

  const handleApplyClick = () => {
    if (selectedMachineIds.size === 0) {
      alert("Please select at least one machine to apply downtime.");
      return;
    }
    onApply(Array.from(selectedMachineIds), selectedReasonId);
    onClose();
  };

  const unfilledCount = machineStatusList.filter((m) => m.isUnfilled).length;

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 99999,
        padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "680px",
          maxHeight: "90vh",
          backgroundColor: "#ffffff",
          borderRadius: "14px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          border: "1px solid #e2e8f0",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
            color: "#ffffff",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "22px" }}>⚡</span>
            <div>
              <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 800, letterSpacing: "0.3px", color: "#f8fafc" }}>
                Quick Fill Idle Machine Downtime
              </h2>
              <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#94a3b8" }}>
                Bulk log full {plannedHours}h shift ({plannedMins} mins) for machines that did not operate
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "#94a3b8",
              fontSize: "20px",
              cursor: "pointer",
              padding: "4px 8px",
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: "18px 20px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* STEP 1: Select Downtime Type */}
          <div>
            <label style={{ display: "block", fontSize: "11.5px", fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>
              1. Select Major Downtime Reason
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              {/* Option A: NO PLAN */}
              <div
                onClick={() => setSelectedReasonId("pdt_no_plan")}
                style={{
                  padding: "12px 14px",
                  borderRadius: "10px",
                  border: selectedReasonId === "pdt_no_plan" ? "2px solid #0284c7" : "1.5px solid #cbd5e1",
                  backgroundColor: selectedReasonId === "pdt_no_plan" ? "#f0f9ff" : "#f8fafc",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "10px",
                  transition: "all 0.15s ease",
                }}
              >
                <input
                  type="radio"
                  name="bulk_dt_reason"
                  checked={selectedReasonId === "pdt_no_plan"}
                  onChange={() => setSelectedReasonId("pdt_no_plan")}
                  style={{ marginTop: "3px", cursor: "pointer" }}
                />
                <div>
                  <div style={{ fontSize: "13.5px", fontWeight: 800, color: "#0f172a" }}>
                    📌 NO PLAN
                  </div>
                  <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                    Planned Downtime ({plannedHours}h / {plannedMins}m)
                  </div>
                  <div style={{ fontSize: "10.5px", color: "#0284c7", fontWeight: 600, marginTop: "3px" }}>
                    Machine off · No production scheduled
                  </div>
                </div>
              </div>

              {/* Option B: NO MANPOWER */}
              <div
                onClick={() => setSelectedReasonId("udt_no_manpower")}
                style={{
                  padding: "12px 14px",
                  borderRadius: "10px",
                  border: selectedReasonId === "udt_no_manpower" ? "2px solid #d97706" : "1.5px solid #cbd5e1",
                  backgroundColor: selectedReasonId === "udt_no_manpower" ? "#fffbeb" : "#f8fafc",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "10px",
                  transition: "all 0.15s ease",
                }}
              >
                <input
                  type="radio"
                  name="bulk_dt_reason"
                  checked={selectedReasonId === "udt_no_manpower"}
                  onChange={() => setSelectedReasonId("udt_no_manpower")}
                  style={{ marginTop: "3px", cursor: "pointer" }}
                />
                <div>
                  <div style={{ fontSize: "13.5px", fontWeight: 800, color: "#0f172a" }}>
                    👥 NO MANPOWER
                  </div>
                  <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                    Unplanned Downtime ({plannedHours}h / {plannedMins}m)
                  </div>
                  <div style={{ fontSize: "10.5px", color: "#d97706", fontWeight: 600, marginTop: "3px" }}>
                    Machine idle due to operator shortage
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* STEP 2: Select Machines */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <label style={{ fontSize: "11.5px", fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                2. Select Idle Machines ({selectedMachineIds.size} Selected)
              </label>
              <div style={{ display: "flex", gap: "6px" }}>
                <button
                  type="button"
                  onClick={selectAllVisible}
                  style={{
                    padding: "3px 8px",
                    fontSize: "11px",
                    fontWeight: 700,
                    borderRadius: "5px",
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    color: "#0f172a",
                    cursor: "pointer",
                  }}
                >
                  ✓ Select All
                </button>
                <button
                  type="button"
                  onClick={deselectAllVisible}
                  style={{
                    padding: "3px 8px",
                    fontSize: "11px",
                    fontWeight: 700,
                    borderRadius: "5px",
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    color: "#64748b",
                    cursor: "pointer",
                  }}
                >
                  ✕ Deselect
                </button>
              </div>
            </div>

            {/* Filter toolbar */}
            <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
              <div style={{ display: "flex", background: "#f1f5f9", borderRadius: "8px", padding: "3px" }}>
                <button
                  type="button"
                  onClick={() => setFilterMode("UNFILLED")}
                  style={{
                    padding: "4px 10px",
                    fontSize: "11px",
                    fontWeight: 700,
                    borderRadius: "6px",
                    border: "none",
                    background: filterMode === "UNFILLED" ? "#ffffff" : "transparent",
                    color: filterMode === "UNFILLED" ? "#0f172a" : "#64748b",
                    boxShadow: filterMode === "UNFILLED" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                    cursor: "pointer",
                  }}
                >
                  Unfilled Only ({unfilledCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode("ALL")}
                  style={{
                    padding: "4px 10px",
                    fontSize: "11px",
                    fontWeight: 700,
                    borderRadius: "6px",
                    border: "none",
                    background: filterMode === "ALL" ? "#ffffff" : "transparent",
                    color: filterMode === "ALL" ? "#0f172a" : "#64748b",
                    boxShadow: filterMode === "ALL" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                    cursor: "pointer",
                  }}
                >
                  All Machines ({plantMachines.length})
                </button>
              </div>

              <input
                type="text"
                placeholder="Search machine..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  flex: 1,
                  padding: "6px 12px",
                  fontSize: "12px",
                  borderRadius: "8px",
                  border: "1.5px solid #cbd5e1",
                  outline: "none",
                }}
              />
            </div>

            {/* Machines Checklist Table */}
            <div
              style={{
                maxHeight: "240px",
                overflowY: "auto",
                border: "1.5px solid #e2e8f0",
                borderRadius: "8px",
                backgroundColor: "#ffffff",
              }}
            >
              {visibleMachines.length === 0 ? (
                <div style={{ padding: "24px", textAlign: "center", color: "#94a3b8", fontSize: "12.5px" }}>
                  No machines match the selected filter.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {visibleMachines.map((m) => {
                    const isChecked = selectedMachineIds.has(m.machine_id);
                    return (
                      <div
                        key={m.machine_id}
                        onClick={() => toggleMachine(m.machine_id)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "8px 12px",
                          borderBottom: "1px solid #f1f5f9",
                          backgroundColor: isChecked ? "#f0fdf4" : "transparent",
                          cursor: "pointer",
                          transition: "background-color 0.1s ease",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleMachine(m.machine_id)}
                            onClick={(e) => e.stopPropagation()}
                            style={{ width: "16px", height: "16px", cursor: "pointer", accentColor: "#16a34a" }}
                          />
                          <div>
                            <span style={{ fontWeight: 800, fontSize: "13px", color: "#0f172a" }}>
                              {m.machine_no}
                            </span>
                            <span style={{ fontSize: "11.5px", color: "#64748b", marginLeft: "8px" }}>
                              {m.tonnage ? `${m.tonnage}T` : ""} {m.make || ""}
                            </span>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div>
                          {m.isUnfilled ? (
                            <span
                              style={{
                                fontSize: "10.5px",
                                fontWeight: 700,
                                padding: "2px 8px",
                                borderRadius: "12px",
                                backgroundColor: "#e0f2fe",
                                color: "#0369a1",
                              }}
                            >
                              ⚪ Unfilled
                            </span>
                          ) : m.hasProd ? (
                            <span
                              style={{
                                fontSize: "10.5px",
                                fontWeight: 700,
                                padding: "2px 8px",
                                borderRadius: "12px",
                                backgroundColor: "#fef3c7",
                                color: "#92400e",
                              }}
                              title="Machine already has OK production. Applying will overwrite with 0 production."
                            >
                              ⚠️ Has Production
                            </span>
                          ) : m.isSaved ? (
                            <span
                              style={{
                                fontSize: "10.5px",
                                fontWeight: 700,
                                padding: "2px 8px",
                                borderRadius: "12px",
                                backgroundColor: "#f1f5f9",
                                color: "#475569",
                              }}
                            >
                              Saved
                            </span>
                          ) : (
                            <span
                              style={{
                                fontSize: "10.5px",
                                fontWeight: 700,
                                padding: "2px 8px",
                                borderRadius: "12px",
                                backgroundColor: "#f1f5f9",
                                color: "#475569",
                              }}
                            >
                              In Progress
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Quick Notice */}
          <div
            style={{
              padding: "10px 14px",
              backgroundColor: "#f8fafc",
              border: "1px dashed #cbd5e1",
              borderRadius: "8px",
              fontSize: "11px",
              color: "#64748b",
              lineHeight: 1.4,
            }}
          >
            💡 <strong>How it works:</strong> All selected machines will immediately have <strong>{plannedHours}h ({plannedMins} min)</strong> of downtime logged under <strong>{selectedReasonId === "pdt_no_plan" ? "NO PLAN" : "NO MANPOWER"}</strong>, OK Production set to 0, Run Hours set to 0, and Manpower set to 0. You can review the rows and click <strong>Save All</strong> to submit.
          </div>
        </div>

        {/* Footer Buttons */}
        <div
          style={{
            padding: "12px 20px",
            borderTop: "1px solid #e2e8f0",
            backgroundColor: "#f8fafc",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ fontSize: "12px", fontWeight: 700, color: "#334155" }}>
            Total: <strong>{selectedMachineIds.size} machines</strong> ready to update
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "8px 16px",
                fontSize: "12.5px",
                fontWeight: 600,
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                backgroundColor: "#ffffff",
                color: "#475569",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApplyClick}
              disabled={selectedMachineIds.size === 0}
              style={{
                padding: "8px 20px",
                fontSize: "12.5px",
                fontWeight: 700,
                borderRadius: "8px",
                border: "none",
                backgroundColor: selectedMachineIds.size === 0 ? "#94a3b8" : selectedReasonId === "pdt_no_plan" ? "#0284c7" : "#d97706",
                color: "#ffffff",
                cursor: selectedMachineIds.size === 0 ? "not-allowed" : "pointer",
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span>⚡</span>
              <span>Apply {plannedHours}h Downtime ({selectedMachineIds.size})</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
