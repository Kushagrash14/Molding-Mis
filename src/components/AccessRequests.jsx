import { useMemo, useState } from "react";
import { datesBetween } from "../lib/accessGrants.js";

function fmtWhen(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function getTodayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getOffsetDateStr(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function AccessRequests({
  requests = [],
  plants = [],
  currentUser,
  onDecide,
  onSpecialApproval,
  onRevoke,
}) {
  const [busy, setBusy] = useState(null);
  const [activeTab, setActiveTab] = useState("all"); // "all" | "pending" | "special" | "active"
  const [showSpecialModal, setShowSpecialModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const plantName = (id) => plants.find((p) => String(p.plant_id) === String(id))?.name || `Plant ${id}`;

  // Plants accessible to current user
  const userAllowedPlantIds = useMemo(() => {
    if (currentUser?.role === "admin") return plants.map((p) => String(p.plant_id));
    const assigned = (currentUser?.assigned_plant_ids || []).map(String);
    if (assigned.length === 0) return plants.map((p) => String(p.plant_id));
    return assigned;
  }, [currentUser, plants]);

  const userPlants = useMemo(() => {
    const allowed = new Set(userAllowedPlantIds);
    return plants.filter((p) => allowed.has(String(p.plant_id)));
  }, [plants, userAllowedPlantIds]);

  // Filter requests visible to this plant head / admin
  const visible = useMemo(() => {
    const allowed = new Set(userAllowedPlantIds);
    const mine =
      currentUser?.role === "admin"
        ? requests
        : requests.filter((r) => allowed.size === 0 || allowed.has(String(r.plant_id)));
    return [...mine].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  }, [requests, currentUser, userAllowedPlantIds]);

  const pendingCount = useMemo(() => visible.filter((r) => r.status === "pending").length, [visible]);

  const specialCount = useMemo(() => visible.filter((r) => r.is_special).length, [visible]);

  const activeCount = useMemo(
    () =>
      visible.filter(
        (r) => r.status === "approved" && r.unlock_until && new Date(r.unlock_until).getTime() > Date.now()
      ).length,
    [visible]
  );

  const filteredRequests = useMemo(() => {
    let list = visible;
    const now = Date.now();

    if (activeTab === "pending") {
      list = list.filter((r) => r.status === "pending");
    } else if (activeTab === "special") {
      list = list.filter((r) => r.is_special);
    } else if (activeTab === "active") {
      list = list.filter((r) => r.status === "approved" && r.unlock_until && new Date(r.unlock_until).getTime() > now);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (r) =>
          (r.requested_by_name || "").toLowerCase().includes(q) ||
          plantName(r.plant_id).toLowerCase().includes(q) ||
          (r.dates || []).some((d) => d.toLowerCase().includes(q)) ||
          (r.note || "").toLowerCase().includes(q) ||
          (r.decided_by_name || "").toLowerCase().includes(q)
      );
    }

    return list;
  }, [visible, activeTab, searchQuery, plants]);

  async function decide(id, approve) {
    setBusy(id + (approve ? "y" : "n"));
    try {
      await onDecide(id, approve);
    } finally {
      setBusy(null);
    }
  }

  async function revoke(id) {
    if (!window.confirm("Are you sure you want to lock this shift now? Operators will no longer be able to edit it.")) {
      return;
    }
    setBusy(id + "revoke");
    try {
      await onRevoke?.(id);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="ar-page">
      {/* Top Header */}
      <div className="ar-head">
        <div>
          <h2>Entry access requests &amp; Approvals</h2>
          <p>Review operator unlock requests or grant proactive Special Approvals to unlock shifts directly.</p>
        </div>
        {pendingCount > 0 && <span className="ar-count">{pendingCount} pending</span>}
      </div>

      {/* Filter and Search Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", marginTop: "4px" }}>
        <div className="ar-filter-tabs">
          <button
            type="button"
            className={`ar-tab-btn ${activeTab === "all" ? "active" : ""}`}
            onClick={() => setActiveTab("all")}
          >
            All ({visible.length})
          </button>
          <button
            type="button"
            className={`ar-tab-btn ${activeTab === "pending" ? "active" : ""}`}
            onClick={() => setActiveTab("pending")}
          >
            Pending ({pendingCount})
          </button>
          <button
            type="button"
            className={`ar-tab-btn ${activeTab === "special" ? "active" : ""}`}
            onClick={() => setActiveTab("special")}
          >
            ✨ Special Approvals ({specialCount})
          </button>
          <button
            type="button"
            className={`ar-tab-btn ${activeTab === "active" ? "active" : ""}`}
            onClick={() => setActiveTab("active")}
          >
            🟢 Unlocked / Active ({activeCount})
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ position: "relative" }}>
            <input
              type="text"
              placeholder="Search by operator, plant, date..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: "6px 12px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                fontSize: "12px",
                width: "210px",
                height: "31px",
                boxSizing: "border-box",
                background: "#ffffff",
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                style={{
                  position: "absolute",
                  right: "8px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  color: "#94a3b8",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                ×
              </button>
            )}
          </div>

          <button
            type="button"
            className="ar-special-btn"
            onClick={() => setShowSpecialModal(true)}
            title="Directly unlock past dates & shifts for selected plants"
          >
            ✨ Special Approval
          </button>
        </div>
      </div>

      {/* Requests Table */}
      <div className="ct-table-wrap">
        <table className="ct-table">
          <thead>
            <tr>
              <th className="left">Requester / Type</th>
              <th>Plant</th>
              <th className="left">Dates</th>
              <th className="left">Note &amp; Duration</th>
              <th>Created</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredRequests.length === 0 && (
              <tr>
                <td colSpan={7} className="ct-empty" style={{ padding: "36px 16px" }}>
                  <div style={{ fontSize: "24px", marginBottom: "6px" }}>📋</div>
                  <div style={{ fontWeight: 700, color: "#334155" }}>No requests found</div>
                  <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>
                    {activeTab === "pending"
                      ? "All operator requests have been processed."
                      : activeTab === "special"
                      ? "No Special Approvals granted yet. Click '✨ Special Approval' above to create one."
                      : "No access requests match the selected filter."}
                  </div>
                </td>
              </tr>
            )}
            {filteredRequests.map((r) => {
              const open =
                r.status === "approved" && r.unlock_until && new Date(r.unlock_until).getTime() > Date.now();

              return (
                <tr key={r.id} style={{ background: r.is_special ? "#faf5ff" : undefined }}>
                  <td className="left">
                    {r.is_special ? (
                      <div>
                        <span className="ar-special-tag">✨ Special Approval</span>
                        <div className="ar-by-sub">Granted by {r.decided_by_name || "Plant Head"}</div>
                      </div>
                    ) : (
                      <div>
                        <span className="strong">{r.requested_by_name}</span>
                        <div className="ar-by-sub">Operator Request</div>
                      </div>
                    )}
                  </td>
                  <td>
                    <span style={{ fontWeight: 700, color: "#0f172a" }}>{plantName(r.plant_id)}</span>
                  </td>
                  <td className="left">
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                      {(r.dates || []).map((d) => (
                        <span
                          key={d}
                          style={{
                            display: "inline-block",
                            background: "#eff6ff",
                            color: "#1d4ed8",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            fontSize: "11px",
                            fontWeight: 700,
                            fontFamily: "monospace",
                          }}
                        >
                          {d}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="left">
                    <div>{r.note || "—"}</div>
                    {r.duration_hours && (
                      <span className="ar-dur-badge">⏱ {r.duration_hours}h duration</span>
                    )}
                  </td>
                  <td style={{ fontSize: "12px", whiteSpace: "nowrap" }}>{fmtWhen(r.created_at)}</td>
                  <td>
                    {r.status === "pending" && <span className="ar-pill wait">⏳ Pending</span>}
                    {r.status === "approved" && open && (
                      <span
                        className="ar-pill ok"
                        style={{
                          background: "#ecfdf5",
                          color: "#047857",
                          border: "1px solid #a7f3d0",
                          display: "inline-block",
                          whiteSpace: "nowrap",
                        }}
                      >
                        🟢 Open till {fmtWhen(r.unlock_until)}
                      </span>
                    )}
                    {r.status === "approved" && !open && (
                      <span className="ar-pill" style={{ background: "#f1f5f9", color: "#64748b" }}>
                        Expired ({fmtWhen(r.unlock_until)})
                      </span>
                    )}
                    {r.status === "revoked" && (
                      <span className="ar-pill no" style={{ background: "#fef2f2", color: "#b91c1c" }}>
                        🔒 Locked Early
                      </span>
                    )}
                    {r.status === "rejected" && <span className="ar-pill no">Rejected</span>}
                  </td>
                  <td>
                    {r.status === "pending" ? (
                      <div className="ar-actions">
                        <button
                          type="button"
                          className="ar-yes"
                          disabled={Boolean(busy)}
                          onClick={() => decide(r.id, true)}
                          title="Approve operator access for 24 hours"
                        >
                          Approve 24h
                        </button>
                        <button
                          type="button"
                          className="ar-no"
                          disabled={Boolean(busy)}
                          onClick={() => decide(r.id, false)}
                          title="Reject request"
                        >
                          Reject
                        </button>
                      </div>
                    ) : open ? (
                      <button
                        type="button"
                        className="ar-revoke-btn"
                        disabled={Boolean(busy)}
                        onClick={() => revoke(r.id)}
                        title="Immediately lock this shift (end unlock window early)"
                      >
                        🔒 Lock Now
                      </button>
                    ) : (
                      <span className="ar-by">{r.decided_by_name || "—"}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Special Approval Modal */}
      {showSpecialModal && (
        <SpecialApprovalModal
          plants={userPlants}
          onClose={() => setShowSpecialModal(false)}
          onSubmit={async (payload) => {
            await onSpecialApproval?.(payload);
            setShowSpecialModal(false);
          }}
        />
      )}
    </div>
  );
}

function SpecialApprovalModal({ plants = [], onClose, onSubmit }) {
  const [selectedPlantIds, setSelectedPlantIds] = useState(() => new Set(plants.map((p) => String(p.plant_id))));
  const [selectedDates, setSelectedDates] = useState(() => [getOffsetDateStr(-1)]); // Yesterday default
  const [durationHours, setDurationHours] = useState(24);
  const [customHours, setCustomHours] = useState("4");
  const [isCustomDuration, setIsCustomDuration] = useState(false);
  const [note, setNote] = useState("");
  const [manualDate, setManualDate] = useState("");
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const togglePlant = (id) => {
    setSelectedPlantIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAllPlants = () => {
    setSelectedPlantIds(new Set(plants.map((p) => String(p.plant_id))));
  };

  const clearAllPlants = () => {
    setSelectedPlantIds(new Set());
  };

  const addDate = (dStr) => {
    if (!dStr) return;
    if (!selectedDates.includes(dStr)) {
      setSelectedDates((prev) => [...prev, dStr].sort());
    }
  };

  const removeDate = (dStr) => {
    setSelectedDates((prev) => prev.filter((d) => d !== dStr));
  };

  const handleAddManualDate = () => {
    if (manualDate) {
      addDate(manualDate);
      setManualDate("");
    }
  };

  const handleAddRange = () => {
    if (!rangeFrom || !rangeTo) {
      setErrorMsg("Please select both From and To dates.");
      return;
    }
    const days = datesBetween(rangeFrom, rangeTo);
    if (days.length === 0) {
      setErrorMsg("Invalid date range.");
      return;
    }
    setSelectedDates((prev) => [...new Set([...prev, ...days])].sort());
    setRangeFrom("");
    setRangeTo("");
    setErrorMsg("");
  };

  const effectiveDuration = isCustomDuration ? Math.max(0.5, Number(customHours) || 1) : durationHours;

  const expiryTimePreview = useMemo(() => {
    const d = new Date(Date.now() + effectiveDuration * 60 * 60 * 1000);
    return d.toLocaleString("en-IN", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  }, [effectiveDuration]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selectedPlantIds.size === 0) {
      setErrorMsg("Please select at least one plant.");
      return;
    }
    if (selectedDates.length === 0) {
      setErrorMsg("Please select at least one date.");
      return;
    }
    setErrorMsg("");
    setSubmitting(true);
    try {
      await onSubmit({
        plant_ids: [...selectedPlantIds],
        dates: selectedDates,
        duration_hours: effectiveDuration,
        note: note.trim() || "Special Approval granted by Plant Head",
      });
    } catch (err) {
      setErrorMsg(err.message || "Failed to grant special approval.");
      setSubmitting(false);
    }
  };

  return (
    <div className="ar-modal-back" onClick={onClose}>
      <div className="ar-special-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="ar-modal-header">
          <div>
            <h3>✨ Special Approval — Proactive Lock Unlock</h3>
            <p>Directly unlock past dates for selected plants without requiring an operator request.</p>
          </div>
          <button type="button" className="ar-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        {errorMsg && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", padding: "8px 12px", borderRadius: "8px", fontSize: "12px", fontWeight: 600 }}>
            ⚠️ {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* 1. Plant Selection */}
          <div>
            <div className="ar-section-label">
              <span>1. Select Plant(s) ({selectedPlantIds.size} of {plants.length})</span>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  onClick={selectAllPlants}
                  style={{ background: "none", border: "none", color: "#7c3aed", fontSize: "11px", fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={clearAllPlants}
                  style={{ background: "none", border: "none", color: "#64748b", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="ar-plant-grid">
              {plants.map((p) => {
                const id = String(p.plant_id);
                const isChecked = selectedPlantIds.has(id);
                return (
                  <label key={id} className={`ar-plant-card ${isChecked ? "selected" : ""}`}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => togglePlant(id)}
                    />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "12px", color: "#0f172a" }}>{p.name}</div>
                      <div style={{ fontSize: "11px", color: "#64748b" }}>Plant Code: {id}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* 2. Date Selection */}
          <div>
            <div className="ar-section-label">
              <span>2. Select Date(s) to Unlock ({selectedDates.length} selected)</span>
              {selectedDates.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedDates([])}
                  style={{ background: "none", border: "none", color: "#64748b", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}
                >
                  Clear dates
                </button>
              )}
            </div>

            {/* Quick date presets */}
            <div className="ar-quick-pills">
              <button
                type="button"
                className={`ar-quick-pill ${selectedDates.includes(getOffsetDateStr(-1)) ? "active" : ""}`}
                onClick={() => addDate(getOffsetDateStr(-1))}
              >
                + Yesterday ({getOffsetDateStr(-1)})
              </button>
              <button
                type="button"
                className={`ar-quick-pill ${selectedDates.includes(getOffsetDateStr(-2)) ? "active" : ""}`}
                onClick={() => addDate(getOffsetDateStr(-2))}
              >
                + Day Before ({getOffsetDateStr(-2)})
              </button>
              <button
                type="button"
                className={`ar-quick-pill ${selectedDates.includes(getTodayStr()) ? "active" : ""}`}
                onClick={() => addDate(getTodayStr())}
              >
                + Today ({getTodayStr()})
              </button>
              <button
                type="button"
                className="ar-quick-pill"
                onClick={() => {
                  addDate(getOffsetDateStr(-3));
                  addDate(getOffsetDateStr(-2));
                  addDate(getOffsetDateStr(-1));
                }}
              >
                + Last 3 Days
              </button>
            </div>

            {/* Manual Date and Range pickers */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: "8px", marginBottom: "8px" }}>
              <div style={{ display: "flex", gap: "4px" }}>
                <input
                  type="date"
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                  style={{ border: "1px solid #cbd5e1", borderRadius: "6px", padding: "6px 8px", fontSize: "12px", width: "100%" }}
                />
                <button
                  type="button"
                  onClick={handleAddManualDate}
                  disabled={!manualDate}
                  style={{ background: "#7c3aed", color: "#fff", border: "none", borderRadius: "6px", padding: "0 10px", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}
                >
                  Add
                </button>
              </div>

              <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                <input
                  type="date"
                  value={rangeFrom}
                  onChange={(e) => setRangeFrom(e.target.value)}
                  style={{ border: "1px solid #cbd5e1", borderRadius: "6px", padding: "6px 6px", fontSize: "11px", width: "100%" }}
                  placeholder="From"
                />
                <span style={{ fontSize: "11px", color: "#64748b" }}>to</span>
                <input
                  type="date"
                  value={rangeTo}
                  onChange={(e) => setRangeTo(e.target.value)}
                  style={{ border: "1px solid #cbd5e1", borderRadius: "6px", padding: "6px 6px", fontSize: "11px", width: "100%" }}
                  placeholder="To"
                />
                <button
                  type="button"
                  onClick={handleAddRange}
                  disabled={!rangeFrom || !rangeTo}
                  style={{ background: "#6366f1", color: "#fff", border: "none", borderRadius: "6px", padding: "0 8px", fontSize: "11px", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
                >
                  Range
                </button>
              </div>
            </div>

            {/* Selected Dates Display */}
            <div className="ar-date-tags">
              {selectedDates.length === 0 ? (
                <span style={{ color: "#94a3b8", fontSize: "12px", fontStyle: "italic", padding: "4px" }}>
                  No dates selected yet. Choose from quick presets above or pick specific dates.
                </span>
              ) : (
                selectedDates.map((d) => (
                  <span key={d} className="ar-date-tag">
                    📅 {d}
                    <button type="button" onClick={() => removeDate(d)}>
                      ×
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>

          {/* 3. Unlock Duration */}
          <div>
            <div className="ar-section-label">
              <span>3. Unlock Time Duration (Keep open for)</span>
            </div>

            <div className="ar-duration-grid">
              {[1, 2, 4, 8, 12, 24, 48].map((hrs) => (
                <button
                  key={hrs}
                  type="button"
                  className={`ar-dur-btn ${!isCustomDuration && durationHours === hrs ? "active" : ""}`}
                  onClick={() => {
                    setDurationHours(hrs);
                    setIsCustomDuration(false);
                  }}
                >
                  {hrs} {hrs === 1 ? "Hour" : "Hours"}
                </button>
              ))}
              <button
                type="button"
                className={`ar-dur-btn ${isCustomDuration ? "active" : ""}`}
                onClick={() => setIsCustomDuration(true)}
              >
                Custom Hours
              </button>
            </div>

            {isCustomDuration && (
              <div style={{ marginTop: "8px", display: "flex", alignItems: "center", gap: "8px" }}>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "#475569" }}>
                  Custom duration (in hours):
                </label>
                <input
                  type="number"
                  min="0.5"
                  max="168"
                  step="0.5"
                  value={customHours}
                  onChange={(e) => setCustomHours(e.target.value)}
                  style={{ border: "1px solid #cbd5e1", borderRadius: "6px", padding: "5px 8px", width: "90px", fontSize: "12px", fontWeight: 700 }}
                />
                <span style={{ fontSize: "12px", color: "#64748b" }}>hours (up to 7 days)</span>
              </div>
            )}

            {/* Live Expiry Preview Box */}
            <div className="ar-expiry-box" style={{ marginTop: "10px" }}>
              <span style={{ fontSize: "18px" }}>⏰</span>
              <div>
                <div style={{ fontWeight: 800 }}>
                  Lock will remain unlocked until: {expiryTimePreview}
                </div>
                <div style={{ fontSize: "11px", color: "#15803d", marginTop: "2px" }}>
                  Selected plants and dates will immediately become editable for all operators for {effectiveDuration} hours.
                </div>
              </div>
            </div>
          </div>

          {/* 4. Reason / Remarks */}
          <div>
            <label style={{ fontSize: "12px", fontWeight: 700, color: "#475569", display: "block", marginBottom: "4px" }}>
              4. Reason / Remarks (Optional audit note):
            </label>
            <input
              type="text"
              placeholder="e.g. Special unlock for historical entry audit / month-end backlog entry"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              style={{
                width: "100%",
                border: "1px solid #cbd5e1",
                borderRadius: "8px",
                padding: "8px 12px",
                fontSize: "12px",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Modal Actions */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", borderTop: "1px solid #f1f5f9", paddingTop: "14px" }}>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                color: "#475569",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || selectedPlantIds.size === 0 || selectedDates.length === 0}
              className="ar-special-btn"
              style={{
                padding: "8px 18px",
                fontSize: "13px",
                opacity: submitting || selectedPlantIds.size === 0 || selectedDates.length === 0 ? 0.6 : 1,
                cursor: submitting || selectedPlantIds.size === 0 || selectedDates.length === 0 ? "not-allowed" : "pointer",
              }}
            >
              {submitting ? "Unlocking..." : `✨ Unlock ${selectedPlantIds.size} Plant(s) Now`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
