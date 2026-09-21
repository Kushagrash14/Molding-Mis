import { useState } from "react";
import { computeMetrics, isEntryPastTwelveHours } from "../lib/calculations.js";
import MetricsPreview from "./MetricsPreview.jsx";
import SearchableMachineSelect from "./SearchableMachineSelect.jsx";

export default function EditModal({
  entry,
  master = [],
  machines = [],
  shifts = [],
  reasonCodes = [],
  locations = [],
  plants = [],
  onClose,
  onSave,
  currentUser,
}) {
  const [form, setForm] = useState({ ...entry });
  const [reasonVals, setReasonVals] = useState(() => {
    const obj = {};
    (entry.reasons || []).forEach((r) => {
      obj[r.reason_id] = r.value;
    });
    return obj;
  });
  const [otherDtRemark, setOtherDtRemark] = useState(() => {
    const otherR = (entry.reasons || []).find((r) => r.reason_id === "udt_others");
    return otherR?.remark || entry.other_dt_remark || "";
  });

  const isEntryLocked = entry.status === "locked" || isEntryPastTwelveHours(entry, shifts);
  const isReadOnly = currentUser?.role !== "admin" && isEntryLocked;

  const m = master.find((x) => x.sap_code === entry.sap_code) || master[0] || {};
  const draft = {
    ...form,
    reasons: Object.entries(reasonVals)
      .filter(([, v]) => Number(v) > 0)
      .map(([reason_id, value]) => ({
        reason_id,
        value,
        remark: reason_id === "udt_others" ? otherDtRemark.trim() : undefined,
      })),
    other_dt_remark: Number(reasonVals["udt_others"]) > 0 ? otherDtRemark.trim() : "",
  };
  const metrics = computeMetrics(draft, m, reasonCodes);

  function update(field, val) {
    setForm((prev) => ({ ...prev, [field]: val }));
  }

  function handleReasonChange(id, val) {
    const clean = val === "" ? "" : Math.max(0, Number(val));
    setReasonVals((prev) => ({ ...prev, [id]: clean }));
  }

  function save() {
    if (!form.run_hour || Number(form.run_hour) <= 0) {
      alert("Run hour must be greater than 0.");
      return;
    }
    if (form.ok_prod === "" || Number(form.ok_prod) < 0) {
      alert("OK production quantity cannot be negative.");
      return;
    }
    if (Number(reasonVals["udt_others"]) > 0 && (!otherDtRemark || !otherDtRemark.trim())) {
      alert("Please specify the mandatory reason description for 'OTHERS' downtime.");
      return;
    }

    const updated = {
      ...form,
      plant_id: form.plant_id || entry.plant_id || plants[0]?.plant_id || "1040",
      ok_prod: Number(form.ok_prod),
      run_hour: Number(form.run_hour),
      running_cavity: Number(form.running_cavity),
      hr_mp_declare: Number(form.hr_mp_declare),
      reasons: draft.reasons,
      other_dt_remark: Number(reasonVals["udt_others"]) > 0 ? otherDtRemark.trim() : null,
      last_edited_by: currentUser.id,
      last_edited_at: new Date().toISOString(),
    };
    onSave(entry, updated);
  }

  const rejectionReasons = reasonCodes.filter((r) => r.category === "rejection");
  const downtimeReasons = reasonCodes.filter(
    (r) => r.category === "planned_dt" || r.category === "unplanned_dt"
  );
  const totalDowntimeHrs = (metrics?.planned_dt || 0) + (metrics?.unplanned_dt || 0);
  const totalDowntimeMins = Math.round(totalDowntimeHrs * 60);

  const plantObj = plants.find((p) => p.plant_id === (form.plant_id || entry.plant_id)) || {};

  return (
    <div className="modal-back" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: "90vh", overflowY: "auto", maxWidth: "780px" }}
      >
        <div className="modal-head">
          <div>
            <h3>Edit Shift Entry — {entry.entry_id}</h3>
            <p style={{ fontSize: "12px", color: "var(--ink-faint)", margin: "4px 0 0" }}>
              {plantObj.name ? `${plantObj.name} · ` : ""}
              {entry.shift_date} · Shift {entry.shift_id} · {entry.sap_code} · Entered by{" "}
              {entry.entered_by_name}
            </p>
          </div>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        {isReadOnly && (
          <div
            style={{
              marginBottom: "14px",
              background: "#fef2f2",
              border: "1px solid #f87171",
              padding: "10px 14px",
              borderRadius: "6px",
              fontSize: "13px",
              color: "#991b1b",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span>🔒</span>
            <span>This entry is locked (past shift cutoff). Viewed in read-only mode.</span>
          </div>
        )}

        {!isReadOnly && isEntryLocked && currentUser?.role === "admin" && (
          <div
            className="admin-flag"
            style={{
              marginBottom: "14px",
              background: "#fef3c7",
              border: "1px solid #f59e0b",
              padding: "8px 12px",
              borderRadius: "4px",
              fontSize: "13px",
            }}
          >
            ⚠️ This entry is locked. As Admin, your changes will be tracked in the silent audit log.
          </div>
        )}

        {/* Plant, Shift Date, Shift, Machine in Row 1 */}
        <div className="grid4" style={{ marginBottom: "14px" }}>
          <div className="form-row">
            <label>Plant / Unit</label>
            <select
              value={form.plant_id || entry.plant_id || plants[0]?.plant_id || "1040"}
              disabled={currentUser.role !== "admin"}
              onChange={(e) => update("plant_id", e.target.value)}
            >
              {plants.map((p) => {
                const loc = locations.find((l) => l.location_id === p.location_id);
                return (
                  <option key={p.plant_id} value={p.plant_id}>
                    {p.name} {loc ? `(${loc.name})` : ""}
                  </option>
                );
              })}
            </select>
          </div>
          <div className="form-row">
            <label>Shift Date</label>
            <input
              type="date"
              value={form.shift_date}
              disabled={currentUser.role !== "admin"}
              onChange={(e) => update("shift_date", e.target.value)}
            />
          </div>
          <div className="form-row">
            <label>Shift</label>
            <select
              value={form.shift_id}
              disabled={currentUser.role !== "admin"}
              onChange={(e) => update("shift_id", e.target.value)}
            >
              {shifts.map((s) => (
                <option key={s.shift_id} value={s.shift_id}>
                  {s.shift_id} — {s.code}
                </option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label>Machine</label>
            <SearchableMachineSelect
              value={form.machine_id}
              disabled={currentUser.role !== "admin"}
              onChange={(val) => update("machine_id", val)}
              machines={machines}
            />
          </div>
        </div>

        {/* Cavity, Run Hours, OK Prod, Manpower in Row 2 */}
        <div className="grid4" style={{ marginBottom: "14px" }}>
          <div className="form-row">
            <label>Running Cavity</label>
            <input
              type="number"
              min="1"
              disabled={isReadOnly}
              value={form.running_cavity}
              onChange={(e) => update("running_cavity", Math.max(1, Number(e.target.value)))}
            />
          </div>
          <div className="form-row">
            <label>Run Hours</label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              max="24"
              disabled={isReadOnly}
              value={form.run_hour}
              onChange={(e) => update("run_hour", Math.max(0, Number(e.target.value)))}
            />
          </div>
          <div className="form-row">
            <label>OK Production (qty)</label>
            <input
              type="number"
              min="0"
              disabled={isReadOnly}
              value={form.ok_prod}
              onChange={(e) => update("ok_prod", Math.max(0, Number(e.target.value)))}
            />
          </div>
          <div className="form-row">
            <label>Manpower Declared</label>
            <input
              type="number"
              min="1"
              disabled={isReadOnly}
              value={form.hr_mp_declare}
              onChange={(e) => update("hr_mp_declare", Math.max(1, Number(e.target.value)))}
            />
          </div>
        </div>

        {/* Rejection Section */}
        <fieldset style={{ marginBottom: "12px" }}>
          <legend style={{ fontWeight: 600, color: "var(--danger, #dc2626)" }}>
            REJECTIONS ({rejectionReasons.length} DEFECTS) · Total: {metrics.total_rej} pcs
          </legend>
          <div className="reason-grid">
            {rejectionReasons.map((r) => (
              <div className="reason-row" key={r.reason_id}>
                <span className="rname">{r.name}</span>
                <input
                  type="number"
                  min="0"
                  disabled={isReadOnly}
                  value={reasonVals[r.reason_id] || ""}
                  onChange={(e) => handleReasonChange(r.reason_id, e.target.value)}
                  placeholder="0"
                />
              </div>
            ))}
          </div>
        </fieldset>

        {/* Unified Downtime Section */}
        <fieldset style={{ marginBottom: "16px" }}>
          <legend style={{ fontWeight: 600, color: "var(--brand-primary, #0284c7)" }}>
            DOWNTIME ({downtimeReasons.length} REASONS) · Total: {totalDowntimeMins} mins ({totalDowntimeHrs.toFixed(2)} hrs)
          </legend>
          <div className="reason-grid">
            {downtimeReasons.map((r) => {
              const hasVal = Number(reasonVals[r.reason_id]) > 0;
              const isOthers = r.reason_id === "udt_others";
              return (
                <div
                  className="reason-row"
                  key={r.reason_id}
                  style={
                    isOthers && hasVal
                      ? {
                          gridColumn: "1 / -1",
                          flexDirection: "column",
                          alignItems: "stretch",
                          gap: "6px",
                        }
                      : undefined
                  }
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      width: "100%",
                      gap: "8px",
                    }}
                  >
                    <span className="rname">{r.name}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <input
                        type="number"
                        min="0"
                        disabled={isReadOnly}
                        value={reasonVals[r.reason_id] || ""}
                        onChange={(e) => handleReasonChange(r.reason_id, e.target.value)}
                        placeholder="0"
                      />
                      <span style={{ fontSize: "11px", color: "#64748b" }}>min</span>
                    </div>
                  </div>

                  {isOthers && hasVal && (
                    <div style={{ width: "100%", marginTop: "4px" }}>
                      <input
                        type="text"
                        disabled={isReadOnly}
                        value={otherDtRemark}
                        onChange={(e) => setOtherDtRemark(e.target.value)}
                        placeholder="Specify reason for Others downtime (Mandatory)..."
                        style={{
                          width: "100%",
                          height: "36px",
                          fontSize: "12.5px",
                          padding: "6px 10px",
                          borderRadius: "6px",
                          border: !otherDtRemark.trim()
                            ? "1.5px solid #ef4444"
                            : "1.5px solid #cbd5e1",
                          background: isReadOnly
                            ? "#f8fafc"
                            : !otherDtRemark.trim()
                            ? "#fff5f5"
                            : "#ffffff",
                          color: "#0f172a",
                          boxSizing: "border-box",
                        }}
                      />
                      {!isReadOnly && !otherDtRemark.trim() && (
                        <span
                          style={{
                            fontSize: "11px",
                            color: "#ef4444",
                            fontWeight: 700,
                            marginTop: "2px",
                            display: "block",
                          }}
                        >
                          * Mandatory: Please type the reason for Others downtime.
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </fieldset>

        <MetricsPreview m={metrics} showTargetAndLoss={currentUser?.role !== "operator"} />

        <div
          style={{
            marginTop: "18px",
            display: "flex",
            gap: "10px",
            justifyContent: "flex-end",
          }}
        >
          <button className="btn secondary" onClick={onClose}>
            {isReadOnly ? "Close" : "Cancel"}
          </button>
          {!isReadOnly && (
            <button className="btn" onClick={save}>
              Save Changes
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
