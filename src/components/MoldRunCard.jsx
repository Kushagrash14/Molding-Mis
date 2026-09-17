import { useMemo } from "react";
import { computeMetrics, calculateHoursBetween, pct } from "../lib/calculations.js";
import SearchableSapSelect from "./SearchableSapSelect.jsx";

/**
 * Generates selectable start times for Mold #(idx+1) between prevRun.startTime and thisRun.endTime in 30-min increments.
 */
function getStartTimeOptions(prevStartStr, curEndStr, shiftStartStr, prevIdx = 1, curIdx = 2) {
  if (!prevStartStr || !curEndStr || !shiftStartStr) return [];
  function t2m(t) {
    const [h, m] = t.split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  }
  function m2t(m) {
    let norm = ((m % 1440) + 1440) % 1440;
    const h = Math.floor(norm / 60);
    const min = norm % 60;
    return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  }
  function getOffset(t, start) {
    let diff = t2m(t) - t2m(start);
    if (diff < 0) diff += 1440;
    return diff;
  }

  const prevStartOffset = getOffset(prevStartStr, shiftStartStr);
  let curEndOffset = getOffset(curEndStr, shiftStartStr);
  if (curEndOffset === 0) curEndOffset = 1440;
  const totalShiftStartMin = t2m(shiftStartStr);

  const options = [];
  for (let m = prevStartOffset + 30; m <= curEndOffset - 30; m += 30) {
    const timeStr = m2t(totalShiftStartMin + m);
    const durPrev = ((m - prevStartOffset) / 60).toFixed(1);
    const durCur = ((curEndOffset - m) / 60).toFixed(1);
    options.push({
      time: timeStr,
      durPrev,
      durCur,
      label: `${timeStr} (Mold #${prevIdx}: ${durPrev}h · Mold #${curIdx}: ${durCur}h)`,
    });
  }
  return options;
}

export default function MoldRunCard({
  run,
  idx,
  totalRuns,
  nextRun = null,
  prevRun = null,
  selectedShift,
  master = [],
  rejectionReasons = [],
  downtimeReasons = [],
  reasonCodes = [],
  isFormReadOnly = false,
  machine = "",
  isLocked = false,
  prevShiftInfo = null,
  prevMaster = null,
  hasDecidedPrevMold = false,
  openSearchableDropdown = false,
  setOpenSearchableDropdown = null,
  onSapTriggerClick = null,
  onOpenPrevMoldModal = null,
  updateRun,
  handleRunSapChange,
  handleRunReasonChange,
  handleRunOtherRemark,
  handleStartTimeChange,
  handleRemoveMoldRun,
}) {
  const runMaster = useMemo(() => {
    if (!run.sap_code) return null;
    return master.find((m) => m.sap_code === run.sap_code) || null;
  }, [master, run.sap_code]);

  const shiftStart = selectedShift?.start_time || "07:00";
  const shiftEnd = selectedShift?.end_time || "19:00";
  const maxHours = calculateHoursBetween(run.start_time || shiftStart, run.end_time || shiftEnd, shiftStart);
  const effectiveRunHour = run.run_hour === "" || run.run_hour == null ? 0 : Number(run.run_hour);

  // Compute metrics for this specific mold run
  const runDraft = useMemo(
    () => ({
      ...run,
      planned_hours: maxHours,
      running_cavity: run.running_cavity === "" ? 0 : Number(run.running_cavity),
      run_hour: effectiveRunHour,
      hr_mp_declare: run.hr_mp_declare === "" ? 0 : Number(run.hr_mp_declare),
      prod_mp_declare: run.prod_mp_declare === "" ? 0 : Number(run.prod_mp_declare),
      ok_prod: run.ok_prod === "" ? 0 : Number(run.ok_prod),
      reasons: Object.entries(run.reasons || {})
        .filter(([, v]) => Number(v) > 0)
        .map(([reason_id, value]) => ({
          reason_id,
          value,
          remark: reason_id === "udt_others" ? (run.other_dt_remark || "").trim() : undefined,
        })),
    }),
    [run, maxHours, effectiveRunHour]
  );

  const runMetrics = useMemo(
    () => computeMetrics(runDraft, runMaster, reasonCodes),
    [runDraft, runMaster, reasonCodes]
  );

  const totalDowntimeHrs = (runMetrics?.planned_dt || 0) + (runMetrics?.unplanned_dt || 0);
  const totalDowntimeMins = Math.round(totalDowntimeHrs * 60);

  // Selectable start time options for Mold #2+
  const startTimeOpts = useMemo(() => {
    if (idx === 0 || !prevRun) return [];
    const opts = getStartTimeOptions(
      prevRun.start_time,
      run.end_time,
      shiftStart,
      idx,
      idx + 1
    );
    if (run.start_time && !opts.some((o) => o.time === run.start_time)) {
      return [{ time: run.start_time, label: `${run.start_time} (Current)` }, ...opts];
    }
    return opts;
  }, [idx, prevRun, run.end_time, run.start_time, shiftStart]);

  return (
    <div
      id={`mold-run-card-${idx + 1}`}
      style={{
        background: "#ffffff",
        border: "1.5px solid #cbd5e1",
        borderRadius: "10px",
        marginBottom: "22px",
        boxShadow: "0 2px 5px rgba(0, 0, 0, 0.04)",
        overflow: "hidden",
      }}
    >
      {/* Mold Card Header Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 18px",
          background: "#f8fafc",
          borderBottom: "1.5px solid #e2e8f0",
          flexWrap: "wrap",
          gap: "10px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <span
            style={{
              padding: "4px 10px",
              background: idx === 0 ? "#2563eb" : "#0284c7",
              color: "#ffffff",
              borderRadius: "6px",
              fontWeight: 800,
              fontSize: "12px",
              letterSpacing: "0.5px",
            }}
          >
            MOLD #{idx + 1}
          </span>

          {totalRuns === 1 ? (
            <span
              style={{
                padding: "3px 10px",
                background: "#f0fdf4",
                border: "1.5px solid #86efac",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: 800,
                color: "#166534",
              }}
            >
              ⚡ Full Shift ({Number(selectedShift?.planned_hours || 12).toFixed(1)}h Shift)
            </span>
          ) : (
            <>
              <span
                className="mono"
                style={{
                  padding: "3px 8px",
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: 700,
                  color: "#0f172a",
                }}
              >
                ⏱️ {run.start_time} – {run.end_time}
              </span>

              <span
                style={{
                  padding: "3px 8px",
                  background: "#eff6ff",
                  border: "1px solid #bfdbfe",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: 700,
                  color: "#1d4ed8",
                }}
              >
                {maxHours.toFixed(1)}h window
              </span>
            </>
          )}

          {run.is_continued && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <span
                style={{
                  padding: "3px 8px",
                  background: "#ecfdf5",
                  border: "1px solid #a7f3d0",
                  borderRadius: "6px",
                  fontSize: "11.5px",
                  fontWeight: 700,
                  color: "#15803d",
                }}
              >
                ✓ Continued from Previous Shift
              </span>
              {idx === 0 && prevShiftInfo && onOpenPrevMoldModal && !isFormReadOnly && (
                <button
                  type="button"
                  onClick={onOpenPrevMoldModal}
                  style={{
                    background: "#eff6ff",
                    border: "1px solid #bfdbfe",
                    color: "#2563eb",
                    padding: "2px 8px",
                    borderRadius: "5px",
                    fontSize: "11px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  ⚙️ Options
                </button>
              )}
            </div>
          )}

          {!run.is_continued && idx === 0 && prevShiftInfo && prevMaster && !isFormReadOnly && (
            <button
              type="button"
              onClick={onOpenPrevMoldModal || (() => handleRunSapChange(prevShiftInfo.sap_code))}
              style={{
                background: !hasDecidedPrevMold ? "#fef3c7" : "#eff6ff",
                border: !hasDecidedPrevMold ? "1.5px solid #f59e0b" : "1px solid #93c5fd",
                color: !hasDecidedPrevMold ? "#92400e" : "#1d4ed8",
                padding: "3px 10px",
                borderRadius: "6px",
                fontSize: "11.5px",
                fontWeight: 800,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                boxShadow: !hasDecidedPrevMold
                  ? "0 1px 3px rgba(245,158,11,0.2)"
                  : "0 1px 2px rgba(37,99,235,0.1)",
              }}
            >
              <span>{!hasDecidedPrevMold ? "⚠️" : "⚡"}</span>
              <span>
                {!hasDecidedPrevMold
                  ? `Specify Mold Status (${prevShiftInfo.sap_code})`
                  : `Previous Mold Options (${prevShiftInfo.sap_code})`}
              </span>
            </button>
          )}
        </div>

        {/* Delete button (for Mold 2, 3, 4) */}
        {idx > 0 && !isFormReadOnly && (
          <button
            type="button"
            onClick={handleRemoveMoldRun}
            style={{
              padding: "5px 12px",
              fontSize: "12px",
              fontWeight: 700,
              background: "#fef2f2",
              border: "1.5px solid #fecaca",
              borderRadius: "6px",
              color: "#dc2626",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <span>🗑️</span>
            <span>Remove Mold #{idx + 1}</span>
          </button>
        )}
      </div>

      {/* Mold Card Body */}
      <div style={{ padding: "18px 20px" }}>
        {/* Compact Single-Row: SAP Code & Auto-Filled Specifications */}
        <div className="sap-specs-compact-row">
          {/* 1. SAP Product Code */}
          <div className="form-row">
            <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 700 }}>
                SAP Code <strong style={{ color: "#2563eb" }}>(Mold #{idx + 1})</strong>
              </span>
            </label>

            <SearchableSapSelect
              value={run.sap_code || ""}
              onChange={handleRunSapChange}
              master={master}
              disabled={isFormReadOnly || !machine}
              isLockedToContinuedMold={Boolean(run.is_continued && run.sap_code)}
              placeholder={
                isLocked
                  ? run.sap_code || "-- No Record --"
                  : !machine
                  ? "-- Select Machine --"
                  : idx === 0 && prevShiftInfo && !hasDecidedPrevMold && !run.sap_code
                  ? `⚠️ Click to Decide Mold (${prevShiftInfo.sap_code})`
                  : `-- Select SAP Code --`
              }
              prevShiftSap={idx === 0 ? prevShiftInfo?.sap_code : null}
              prevMaster={idx === 0 ? prevMaster : null}
              forceOpen={openSearchableDropdown}
              onCloseForceOpen={() => setOpenSearchableDropdown && setOpenSearchableDropdown(false)}
              onTriggerClick={onSapTriggerClick}
            />
          </div>

          {/* 2. Auto-filled Material Description */}
          <div className="form-row">
            <label>Material Description</label>
            <div
              className="readonly-field"
              title={runMaster?.material_description || run.material_description || ""}
              style={{
                fontWeight: 600,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                display: "block",
                lineHeight: "28px",
              }}
            >
              {runMaster?.material_description || run.material_description || "—"}
            </div>
          </div>

          {/* 3. Auto-filled Std Mold Cavity */}
          <div className="form-row">
            <label>Std Cavity</label>
            <div
              className="readonly-field"
              title={runMaster ? `${runMaster.cavity || 1} Cavity · ${runMaster.shots_per_hour || 60} Shots/hr` : ""}
              style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", justifyContent: "center", fontWeight: 700 }}
            >
              {runMaster ? runMaster.cavity || 1 : "—"}
            </div>
          </div>

          {/* 4. Auto-filled Part Weight & Price */}
          <div className="form-row">
            <label>Part Wt · Price</label>
            <div
              className="readonly-field"
              style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
            >
              {runMaster
                ? `${runMaster.part_wt || 0} kg · ₹${runMaster.price || 0}`
                : "—"}
            </div>
          </div>

          {/* 5. Live Availability */}
          <div className="form-row">
            <label>Avail (A)</label>
            <div
              className="oee-metric-box"
              title="Availability = (Actual Run Hours - Unplanned DT) / (Planned Base - Planned DT)"
            >
              {pct(runMetrics?.availability)}
            </div>
          </div>

          {/* 6. Live Performance */}
          <div className="form-row">
            <label>Perf (P)</label>
            <div
              className="oee-metric-box"
              title="Performance = (Actual OK Prod + Total Rej) / Target"
            >
              {pct(runMetrics?.productivity)}
            </div>
          </div>

          {/* 7. Live Quality Rate */}
          <div className="form-row">
            <label>Quality (Q)</label>
            <div
              className="oee-metric-box"
              title="Quality Rate = OK Prod / (OK Prod + Total Rejections)"
            >
              {pct(runMetrics?.quality_rate)}
            </div>
          </div>

          {/* 8. Live OEE */}
          <div className="form-row">
            <label>OEE %</label>
            <div
              className="oee-metric-box"
              title={`OEE = ${pct(runMetrics?.availability)} (A) × ${pct(runMetrics?.productivity)} (P) × ${pct(runMetrics?.quality_rate)} (Q)`}
            >
              {pct(runMetrics?.oee)}
            </div>
          </div>
        </div>

        {/* Mid-Shift Timing Switch Section (ONLY shown when 2+ molds exist!) */}
        {totalRuns > 1 && (
          idx === 0 ? (
            /* Mold #1 in multi-mold mode: Clean informative banner (End time automatically driven by Mold #2) */
            <div
              style={{
                background: "#eff6ff",
                border: "1.5px solid #bfdbfe",
                borderRadius: "8px",
                padding: "10px 14px",
                marginBottom: "16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "8px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "16px" }}>⏱️</span>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "#1e40af" }}>
                  Mold #1 Timing: <strong>{run.start_time}</strong> – <strong>{run.end_time}</strong> (
                  <strong>{maxHours.toFixed(1)}h window</strong>)
                </span>
              </div>
              <span
                style={{
                  fontSize: "11.5px",
                  fontWeight: 700,
                  color: "#2563eb",
                  background: "#dbeafe",
                  padding: "3px 8px",
                  borderRadius: "5px",
                }}
              >
                Auto-ended when Mold #2 started at {run.end_time}
              </span>
            </div>
          ) : (
            /* Mold #2+ in multi-mold mode: The Single Handover / Switch-Time Selector! */
            <div
              style={{
                background: "#f0fdf4",
                border: "2px solid #86efac",
                borderRadius: "8px",
                padding: "12px 16px",
                marginBottom: "16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "12px",
              }}
            >
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "13px",
                    fontWeight: 800,
                    color: "#166534",
                    marginBottom: "3px",
                  }}
                >
                  ⏱️ What time did Mold #{idx + 1} START running? (Mold #{idx} ended at this time)
                </label>
                <div style={{ fontSize: "11.5px", color: "#15803d" }}>
                  This start time automatically sets Mold #{idx}&apos;s end time.
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <select
                  value={run.start_time}
                  onChange={(e) =>
                    handleStartTimeChange && handleStartTimeChange(idx, e.target.value)
                  }
                  disabled={isFormReadOnly}
                  style={{
                    height: "40px",
                    fontSize: "13.5px",
                    fontWeight: 800,
                    color: "#166534",
                    background: "#ffffff",
                    border: "2px solid #22c55e",
                    borderRadius: "6px",
                    padding: "0 12px",
                    cursor: isFormReadOnly ? "not-allowed" : "pointer",
                  }}
                >
                  {startTimeOpts.map((opt) => (
                    <option key={opt.time} value={opt.time}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <span
                  style={{
                    fontSize: "12.5px",
                    fontWeight: 800,
                    color: "#166534",
                    whiteSpace: "nowrap",
                  }}
                >
                  {maxHours.toFixed(1)}h window
                </span>
              </div>
            </div>
          )
        )}

        {/* Operational Inputs (Run Hours, Cavity, Manpower, OK Production) */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: "14px",
            marginBottom: "18px",
          }}
        >
          {/* Machine Run Hours (Actual Run Hours) */}
          <div className="form-row">
            <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 700, color: "#1e40af" }}>Run Hours</span>
              <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 700 }}>
                Max: {maxHours.toFixed(1)}h
              </span>
            </label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              max={maxHours}
              disabled={isFormReadOnly || !machine || !run.sap_code}
              value={run.run_hour !== undefined && run.run_hour !== null ? run.run_hour : ""}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "") {
                  updateRun("run_hour", "");
                } else {
                  const num = Number(val);
                  const clamped = Math.min(maxHours, Math.max(0, num));
                  updateRun("run_hour", clamped);
                }
              }}
              placeholder=""
              style={{
                height: "38px",
                fontWeight: 800,
                color: "#1e40af",
                background: "#f0fdf4",
                borderColor: "#3b82f6",
              }}
            />
          </div>

          {/* Running Cavity */}
          <div className="form-row">
            <label>Running Cavity</label>
            <input
              type="number"
              min="1"
              max={runMaster?.cavity ? runMaster.cavity * 2 : 32}
              disabled={isFormReadOnly || !machine || !run.sap_code}
              value={run.running_cavity}
              onChange={(e) =>
                updateRun(
                  "running_cavity",
                  e.target.value === "" ? "" : Math.max(1, Number(e.target.value))
                )
              }
              placeholder={isFormReadOnly || !machine || !run.sap_code ? "—" : "e.g. 2"}
              style={{ height: "38px" }}
            />
          </div>

          {/* Manpower Declared */}
          <div className="form-row">
            <label>Manpower Declared</label>
            <input
              type="number"
              min="1"
              disabled={isFormReadOnly || !machine || !run.sap_code}
              value={run.hr_mp_declare}
              onChange={(e) =>
                updateRun(
                  "hr_mp_declare",
                  e.target.value === "" ? "" : Math.max(1, Number(e.target.value))
                )
              }
              placeholder={isFormReadOnly || !machine || !run.sap_code ? "—" : "e.g. 2"}
              style={{ height: "38px" }}
            />
          </div>

          {/* OK Production */}
          <div className="form-row">
            <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: 700, color: "#166534" }}>
              <span>OK Production (qty)</span>
              {runMetrics?.tgt > 0 && (
                <span style={{ fontSize: "11px", color: "#1d4ed8", fontWeight: 800 }}>
                  🎯 Target: {runMetrics.tgt.toLocaleString()} pcs
                </span>
              )}
            </label>
            <input
              type="number"
              min="0"
              disabled={isFormReadOnly || !machine || !run.sap_code}
              value={run.ok_prod}
              onChange={(e) => updateRun("ok_prod", e.target.value)}
              placeholder={isFormReadOnly || !machine || !run.sap_code ? "—" : ""}
              style={{
                height: "38px",
                fontWeight: 800,
                fontSize: "14px",
                borderColor: run.ok_prod ? "#16a34a" : undefined,
              }}
            />
          </div>
        </div>

        {/* Rejections for this mold */}
        <fieldset style={{ marginTop: "18px" }}>
          <legend
            style={{
              fontWeight: 700,
              color: "var(--danger, #ef4444)",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span>
              🔴 REJECTIONS FOR MOLD #{idx + 1} ({rejectionReasons.length} DEFECT TYPES)
            </span>
            {runMetrics.total_rej > 0 && (
              <span className="badge-count red">{runMetrics.total_rej} PCS LOGGED</span>
            )}
          </legend>
          <div className="reason-grid">
            {rejectionReasons.map((r) => {
              const hasVal = Number((run.reasons || {})[r.reason_id]) > 0;
              return (
                <div
                  className={`reason-row ${hasVal ? "has-val rej-active" : ""}`}
                  key={r.reason_id}
                >
                  <div className="rname-wrap">
                    <span className="rname">{r.name}</span>
                  </div>
                  <div className="r-input-wrap">
                    <input
                      type="number"
                      min="0"
                      disabled={isFormReadOnly || !machine || !run.sap_code}
                      value={(run.reasons || {})[r.reason_id] || ""}
                      onChange={(e) => handleRunReasonChange(r.reason_id, e.target.value)}
                      placeholder={isFormReadOnly || !machine || !run.sap_code ? "—" : "0"}
                    />
                    <span className="unit-label">pcs</span>
                  </div>
                </div>
              );
            })}
          </div>
        </fieldset>

        {/* Downtime for this mold */}
        <fieldset style={{ marginTop: "18px" }}>
          <legend
            style={{
              fontWeight: 700,
              color: "var(--brand-primary, #0284c7)",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span>
              ⏱️ DOWNTIME FOR MOLD #{idx + 1} ({downtimeReasons.length} REASONS)
            </span>
            {totalDowntimeMins > 0 && (
              <span className="badge-count blue">
                {totalDowntimeMins} MINS ({totalDowntimeHrs.toFixed(2)} HRS)
              </span>
            )}
          </legend>
          <div className="reason-grid">
            {downtimeReasons.map((r) => {
              const hasVal = Number((run.reasons || {})[r.reason_id]) > 0;
              const isOthers = r.reason_id === "udt_others";
              return (
                <div
                  className={`reason-row ${hasVal ? "has-val pdt-active" : ""}`}
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
                    <div className="rname-wrap">
                      <span className="rname">{r.name}</span>
                    </div>
                    <div className="r-input-wrap">
                      <input
                        type="number"
                        min="0"
                        disabled={isFormReadOnly || !machine || !run.sap_code}
                        value={(run.reasons || {})[r.reason_id] || ""}
                        onChange={(e) => handleRunReasonChange(r.reason_id, e.target.value)}
                        placeholder={isFormReadOnly || !machine || !run.sap_code ? "—" : "0"}
                      />
                      <span className="unit-label">min</span>
                    </div>
                  </div>

                  {isOthers && hasVal && (
                    <div style={{ width: "100%", marginTop: "4px" }}>
                      <input
                        type="text"
                        disabled={isFormReadOnly || !machine || !run.sap_code}
                        value={run.other_dt_remark || ""}
                        onChange={(e) => handleRunOtherRemark(e.target.value)}
                        placeholder="Specify reason for Others downtime (Mandatory)..."
                        style={{
                          width: "100%",
                          height: "36px",
                          fontSize: "12.5px",
                          padding: "6px 10px",
                          borderRadius: "6px",
                          border: !(run.other_dt_remark || "").trim()
                            ? "1.5px solid #ef4444"
                            : "1.5px solid #cbd5e1",
                          background: isFormReadOnly
                            ? "#f8fafc"
                            : !(run.other_dt_remark || "").trim()
                            ? "#fff5f5"
                            : "#ffffff",
                          color: "#0f172a",
                          boxSizing: "border-box",
                        }}
                      />
                      {!isFormReadOnly && !(run.other_dt_remark || "").trim() && (
                        <span
                          style={{
                            fontSize: "11px",
                            color: "#ef4444",
                            fontWeight: 700,
                            marginTop: "2px",
                            display: "block",
                          }}
                        >
                          * Mandatory: Please type the reason for Others downtime on Mold #{idx + 1}.
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </fieldset>

        {/* Compact Production & Financial Summary Strip */}
        {Boolean(machine && run.sap_code && runMaster) && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              padding: "10px 16px",
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              marginTop: "16px",
              flexWrap: "wrap",
              fontSize: "12.5px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
              <span>
                Target: <strong>{runMetrics.tgt.toLocaleString()} pcs</strong>
              </span>
              <span>
                Actual: <strong style={{ color: "#16a34a" }}>{Number(run.ok_prod || 0).toLocaleString()} pcs</strong>
              </span>
              <span
                style={{
                  padding: "2px 8px",
                  borderRadius: "4px",
                  fontSize: "11px",
                  fontWeight: 800,
                  background: Number(run.ok_prod || 0) >= runMetrics.tgt && runMetrics.tgt > 0 ? "#dcfce7" : "#f1f5f9",
                  color: Number(run.ok_prod || 0) >= runMetrics.tgt && runMetrics.tgt > 0 ? "#15803d" : "#475569",
                  border: Number(run.ok_prod || 0) >= runMetrics.tgt && runMetrics.tgt > 0 ? "1px solid #86efac" : "1px solid #cbd5e1",
                }}
              >
                {runMetrics.tgt > 0
                  ? `${Math.min(100, Math.round(((Number(run.ok_prod) || 0) / runMetrics.tgt) * 100))}% achieved`
                  : "0% achieved"}
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "14px", color: "#475569", flexWrap: "wrap" }}>
              <span>
                Value: <strong style={{ color: "#15803d" }}>₹{Math.round(runMetrics.ok_prod_price || 0).toLocaleString()}</strong>
              </span>
              {runMetrics.shortfall_loss > 0 && (
                <span>
                  Loss: <strong style={{ color: "#dc2626" }}>₹{Math.round(runMetrics.shortfall_loss || 0).toLocaleString()}</strong>
                </span>
              )}
              {runMetrics.rej_price > 0 && (
                <span>
                  Scrap: <strong style={{ color: "#d97706" }}>₹{Math.round(runMetrics.rej_price || 0).toLocaleString()}</strong>
                </span>
              )}
              <span>
                Material: <strong>{(runMetrics.total_consumption || 0).toFixed(1)} kg</strong>
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
