import { pct, inr } from "../lib/calculations.js";

export default function MetricsPreview({
  m,
  okProd,
  target,
  hasProduct = true,
  isLocked = false,
  showTargetAndLoss = true,
}) {
  if (!hasProduct || !m || (!m.tgt && !okProd && isLocked)) {
    return (
      <div
        className="oee-cockpit-panel"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "28px",
          color: "#64748b",
          fontSize: "13px",
          fontWeight: 600,
          background: "#f8fafc",
          border: "1.5px dashed #cbd5e1",
          borderRadius: "8px",
          letterSpacing: "0.2px",
        }}
      >
        <span>
          {isLocked
            ? "🔒 No production entry was recorded for this machine on this shift."
            : "📊 Select Machine & SAP Product Code to begin data entry and live OEE calculation."}
        </span>
      </div>
    );
  }

  // OEE rating
  const oeeVal = m.oee * 100;
  let oeeGrade = { label: "WORLD CLASS", color: "#10b981", bg: "#ecfdf5", border: "#a7f3d0" };
  if (oeeVal < 65) {
    oeeGrade = { label: "CRITICAL ACTION", color: "#ef4444", bg: "#fef2f2", border: "#fecaca" };
  } else if (oeeVal < 85) {
    oeeGrade = { label: "OPERATIONAL", color: "#0284c7", bg: "#f0f9ff", border: "#bae6fd" };
  }

  const targetCompletion = m.tgt > 0 ? Math.min(100, ((Number(okProd) || 0) / m.tgt) * 100) : 0;

  return (
    <div className="oee-cockpit-panel">
      {/* Top Cockpit Header: The OEE Multiplier Formula */}
      <div className="cockpit-top-grid">
        {/* Main OEE Hero */}
        <div className="oee-hero-card">
          <div className="oee-header-line">
            <span className="oee-title-text">OVERALL EQUIPMENT EFFECTIVENESS</span>
            <span
              className="oee-grade-tag"
              style={{
                background: oeeGrade.bg,
                color: oeeGrade.color,
                border: `1px solid ${oeeGrade.border}`,
              }}
            >
              {oeeGrade.label}
            </span>
          </div>
          <div className="oee-hero-value">{pct(m.oee)}</div>
          <div className="oee-formula-badge">
            OEE = {pct(m.availability)} (A) × {pct(m.productivity)} (P) × {pct(m.quality_rate)} (Q)
          </div>
        </div>

        {/* Pillar 1: Availability */}
        <div className="oee-pillar-box">
          <div className="pillar-header">
            <span className="pillar-dot blue"></span>
            <span className="pillar-name">AVAILABILITY (BA)</span>
          </div>
          <div className="pillar-val">{pct(m.availability)}</div>
          <div className="pillar-sub">
            DT: {((m.planned_dt + m.unplanned_dt) * 60).toFixed(0)}m loss
          </div>
        </div>

        {/* Pillar 2: Performance */}
        <div className="oee-pillar-box">
          <div className="pillar-header">
            <span className="pillar-dot purple"></span>
            <span className="pillar-name">PERFORMANCE (BB)</span>
          </div>
          <div className="pillar-val">{pct(m.productivity)}</div>
          <div className="pillar-sub">Speed &amp; Cavity rate</div>
        </div>

        {/* Pillar 3: Quality Rate */}
        <div className="oee-pillar-box">
          <div className="pillar-header">
            <span className="pillar-dot green"></span>
            <span className="pillar-name">QUALITY RATE (AZ)</span>
          </div>
          <div className="pillar-val">{pct(m.quality_rate)}</div>
          <div className="pillar-sub">
            {m.total_rej} rejections
          </div>
        </div>
      </div>

      {/* Target & Financial Line */}
      <div className="cockpit-stats-bar">
        {showTargetAndLoss && (
          <div className="c-stat">
            <span className="cs-label">TARGET (TGT)</span>
            <span className="cs-val">{m.tgt.toLocaleString()} pcs</span>
            <span style={{ fontSize: "11px", color: "#64748b", marginTop: "1px" }}>
              Actual: <strong style={{ color: "#16a34a" }}>{(Number(okProd) || m.ok_prod || 0).toLocaleString()} pcs</strong>
            </span>
          </div>
        )}
        <div className="c-stat">
          <span className="cs-label">ACTUAL OK PROD</span>
          <span className="cs-val text-green">
            {(Number(okProd) || m.ok_prod || 0).toLocaleString()} pcs
          </span>
          {showTargetAndLoss && (
            <span style={{ fontSize: "11px", color: "#64748b", marginTop: "1px" }}>
              {targetCompletion.toFixed(1)}% achieved
            </span>
          )}
        </div>
        <div className="c-stat">
          <span className="cs-label">OK PROD AMOUNT</span>
          <span className="cs-val text-green">{inr(m.ok_prod_price)}</span>
        </div>
        {showTargetAndLoss && (
          <div className="c-stat">
            <span className="cs-label">SHORTFALL LOSS</span>
            <span className="cs-val text-warn">
              {m.shortfall_loss > 0 ? inr(m.shortfall_loss) : "₹0"}
            </span>
          </div>
        )}
        <div className="c-stat">
          <span className="cs-label">REJECTION SCRAP</span>
          <span className="cs-val text-danger">
            {m.rej_price > 0 ? inr(m.rej_price) : "₹0"}
          </span>
        </div>
        <div className="c-stat">
          <span className="cs-label">MATERIAL CONSUMED</span>
          <span className="cs-val">{(m.total_consumption || 0).toFixed(1)} kg</span>
        </div>
      </div>
    </div>
  );
}

