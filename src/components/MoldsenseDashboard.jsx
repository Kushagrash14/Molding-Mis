import React, { useState, useMemo, useRef, useLayoutEffect } from "react";
import { computeMetrics, normalizeReasonsMap } from "../lib/calculations.js";

/**
 * Creates smooth cubic bezier curve SVG path from array of points [{x, y}]
 */
function createSmoothPath(points) {
  if (!points || points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = i > 0 ? points[i - 1] : points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = i < points.length - 2 ? points[i + 2] : p2;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

/**
 * Month calendar info for "YYYY-MM": number of days, short month name, and the last
 * day that can have production (today for the running month, none for future months).
 */
function getMonthInfo(selectedMonth) {
  const [y, m] = (selectedMonth || "").split("-").map(Number);
  const now = new Date();
  const year = y || now.getFullYear();
  const month = m || now.getMonth() + 1;
  const daysInMonth = new Date(year, month, 0).getDate();
  const monthName = new Date(year, month - 1, 1).toLocaleString("en-US", { month: "short" });

  const monthIdx = year * 12 + month;
  const nowIdx = now.getFullYear() * 12 + now.getMonth() + 1;
  let lastProductionDay = daysInMonth;
  if (monthIdx === nowIdx) lastProductionDay = now.getDate();
  else if (monthIdx > nowIdx) lastProductionDay = 0;

  const todayDay = monthIdx === nowIdx ? now.getDate() : null;

  return { year, month, daysInMonth, monthName, lastProductionDay, todayDay };
}

function emptyAgg() {
  return { ok: 0, rej: 0, tgt: 0, netRun: 0, available: 0, plannedDt: 0, unplannedDt: 0 };
}

function addToAgg(agg, m) {
  agg.ok += Number(m.ok_prod) || 0;
  agg.rej += Number(m.total_rej) || 0;
  agg.tgt += Number(m.tgt) || 0;
  agg.netRun += Number(m.net_run_time) || 0;
  agg.available += Number(m.available_hours) || 0;
  agg.plannedDt += Number(m.planned_dt) || 0;
  agg.unplannedDt += Number(m.unplanned_dt) || 0;
}

/**
 * OEE for a group of shift entries, computed from summed quantities and hours
 * (not an average of per-entry percentages) so longer / bigger runs weigh correctly.
 * Returns null when the group had no available hours (e.g. full-shift "No Plan").
 */
function oeeFromAgg(agg) {
  if (agg.available <= 0) return null;
  const produced = agg.ok + agg.rej;
  const quality = produced > 0 ? agg.ok / produced : 0;
  const availability = Math.min(1, agg.netRun / agg.available);
  const performance = agg.tgt > 0 ? produced / agg.tgt : 0;
  return {
    quality: quality * 100,
    availability: availability * 100,
    performance: performance * 100,
    oee: quality * availability * performance * 100,
  };
}

const round1 = (v) => (v === null || v === undefined ? null : Number(Number(v).toFixed(1)));

const formatCount = (v) => Math.round(Number(v) || 0).toLocaleString("en-IN");
const formatPct = (v) => (v === null || v === undefined ? "—" : `${Number(v).toFixed(1)}%`);

function KpiCard({ color, label, value }) {
  return (
    <div className="ms-kpi-card" style={{ borderTopColor: color }}>
      <span className="ms-kpi-deco" style={{ backgroundColor: color }} />
      <div className="ms-kpi-val">{value}</div>
      <div className="ms-kpi-lbl">{label}</div>
    </div>
  );
}

/**
 * Tracks the rendered pixel size of an element so SVG charts can draw at 1:1 scale
 * (a stretched viewBox would distort text and point markers).
 */
function useElementSize(fallback = { width: 500, height: 210 }) {
  const ref = useRef(null);
  const [size, setSize] = useState(fallback);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const update = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width > 0 && height > 0) {
        setSize((prev) =>
          prev.width === Math.round(width) && prev.height === Math.round(height)
            ? prev
            : { width: Math.round(width), height: Math.round(height) }
        );
      }
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, size];
}

/**
 * Reusable Responsive SVG Area Chart with Adaptive Dynamic Scaling.
 * Days whose value is null (no entries logged) are skipped instead of plotted as zero.
 */
function MetricAreaChart({
  title,
  color,
  data = [],
  dataKey,
  defaultYMax = 20,
  defaultYTicks = [0, 5, 10, 15, 20],
  isPercent = false,
  unit = "",
  decimals = 1,
  showLabelThreshold = 0,
}) {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const [wrapRef, { width, height }] = useElementSize();
  const padLeft = 40;
  const padRight = 14;
  const padTop = 20;
  const padBottom = 34;

  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  // Adaptive scaling so test entries or peaks cleanly scale without clipping
  const { yMax, yTicks } = useMemo(() => {
    const maxVal = Math.max(...data.map((d) => Number(d[dataKey]) || 0), 0);
    if (maxVal <= defaultYMax) {
      return { yMax: defaultYMax, yTicks: defaultYTicks };
    }
    let ceiling = maxVal * 1.15;
    if (ceiling <= 10) ceiling = Math.ceil(ceiling);
    else if (ceiling <= 50) ceiling = Math.ceil(ceiling / 5) * 5;
    else if (ceiling <= 100) ceiling = Math.ceil(ceiling / 10) * 10;
    else if (ceiling <= 500) ceiling = Math.ceil(ceiling / 50) * 50;
    else ceiling = Math.ceil(ceiling / 100) * 100;

    const steps = 4;
    const step = ceiling / steps;
    const ticks = Array.from({ length: steps + 1 }, (_, i) => {
      const v = i * step;
      return isPercent ? Number(v.toFixed(1)) : Math.round(v);
    });
    return { yMax: ceiling, yTicks: ticks };
  }, [data, dataKey, defaultYMax, defaultYTicks, isPercent]);

  const points = useMemo(() => {
    if (!data || data.length === 0) return [];
    return data.map((d, i) => {
      const x = padLeft + (i / Math.max(1, data.length - 1)) * chartW;
      const raw = d[dataKey];
      const hasValue = raw !== null && raw !== undefined;
      const val = hasValue ? Number(raw) : null;
      const normY = hasValue ? Math.min(1, Math.max(0, val / (yMax || 1))) : 0;
      const y = padTop + chartH - normY * chartH;
      return {
        x,
        y,
        val,
        day: d.day,
        label: d.label || String(d.day).padStart(2, "0"),
      };
    });
  }, [data, dataKey, yMax, chartW, chartH, padLeft, padTop]);

  const plotted = useMemo(() => points.filter((p) => p.val !== null), [points]);

  const linePath = useMemo(() => createSmoothPath(plotted), [plotted]);

  const areaPath = useMemo(() => {
    if (plotted.length === 0) return "";
    const first = plotted[0];
    const last = plotted[plotted.length - 1];
    const bottomY = padTop + chartH;
    return `${linePath} L ${last.x.toFixed(1)} ${bottomY} L ${first.x.toFixed(1)} ${bottomY} Z`;
  }, [linePath, plotted, padTop, chartH]);

  const gradId = `grad_${dataKey}_${color.replace("#", "")}`;
  const labelEvery = Math.max(1, Math.ceil(26 / (chartW / Math.max(1, points.length))));
  const hovered = hoveredIdx !== null ? points[hoveredIdx] : null;

  const body = (
    <div className="ms-graph-svg-wrap" ref={wrapRef}>
      <svg viewBox={`0 0 ${width} ${height}`} className="ms-graph-svg">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Grid lines and Y axis ticks */}
        {yTicks.map((tickVal) => {
          const y = padTop + chartH - (tickVal / yMax) * chartH;
          return (
            <g key={tickVal} className="ms-grid-group">
              <line x1={padLeft} y1={y} x2={width - padRight} y2={y} stroke="#f1f5f9" strokeWidth="1" />
              <text x={padLeft - 6} y={y + 3.5} textAnchor="end" className="ms-axis-tick">
                {isPercent && yMax <= 5 ? tickVal.toFixed(1) : tickVal}
                {isPercent ? "%" : ""}
              </text>
            </g>
          );
        })}

        {plotted.length === 0 && (
          <text x={width / 2} y={padTop + chartH / 2} textAnchor="middle" fill="#94a3b8" fontSize="11" fontWeight="600">
            No entries logged for this month
          </text>
        )}

        {/* Filled Area */}
        {plotted.length > 1 && <path d={areaPath} fill={`url(#${gradId})`} />}

        {/* Curve Line */}
        {plotted.length > 1 && (
          <path d={linePath} fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        )}

        {/* Points & Data Labels */}
        {points.map((p, idx) => {
          const isHovered = hoveredIdx === idx;
          const hasValue = p.val !== null;
          const isSignificant = hasValue && p.val > showLabelThreshold;
          return (
            <g key={idx}>
              {hasValue && (
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isHovered ? 4.5 : isSignificant ? 3 : 2}
                  fill="#ffffff"
                  stroke={color}
                  strokeWidth={isHovered ? 2.5 : 1.8}
                />
              )}

              {isSignificant && (
                <text
                  x={p.x}
                  y={p.y - 7}
                  textAnchor="middle"
                  fill="#334155"
                  fontSize="9.5"
                  fontWeight="600"
                  className="ms-point-label"
                >
                  {p.val.toFixed(decimals)}
                  {isPercent ? "%" : ""}
                </text>
              )}

              {/* Invisible hover hotspot */}
              <rect
                x={p.x - 7}
                y={padTop}
                width="14"
                height={chartH + 10}
                fill="transparent"
                style={{ cursor: "pointer" }}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              />
            </g>
          );
        })}

        {/* X Axis bottom labels */}
        {points.map((p, idx) => {
          if (idx % labelEvery !== 0) return null;
          return (
            <text
              key={idx}
              x={p.x}
              y={height - 12}
              textAnchor="middle"
              className="ms-axis-tick x-tick"
              transform={`rotate(-25, ${p.x}, ${height - 12})`}
            >
              {p.label}
            </text>
          );
        })}
      </svg>

      {/* Hover Tooltip */}
      {hovered && (
        <div
          className="ms-tooltip"
          style={{
            left: `${(hovered.x / width) * 100}%`,
            top: `${(hovered.y / height) * 100}%`,
          }}
        >
          <div className="ms-tooltip-date">{hovered.label}</div>
          <div className="ms-tooltip-val">
            <span className="dot" style={{ backgroundColor: color }} />
            {hovered.val === null ? (
              <span>No entry</span>
            ) : (
              <>
                <strong>{hovered.val.toFixed(decimals)}</strong>
                {unit || (isPercent ? "%" : "")}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="ms-graph-card">
      <div className="ms-graph-header">
        <span className="ms-graph-dot" style={{ backgroundColor: color }} />
        <span className="ms-graph-title">{title}</span>
      </div>
      {body}
    </div>
  );
}

/**
 * Defects Pareto: rejection reasons sorted by count with cumulative % line
 */
function DefectsParetoChart({ paretoData = [] }) {
  const items = paretoData || [];

  // Compute dynamic maxCount for Y axis scaling in Pareto
  const maxCount = useMemo(() => {
    if (!items || items.length === 0) return 50;
    const maxVal = Math.max(...items.map((i) => i.count), 0);
    if (maxVal <= 25) return 25;
    if (maxVal <= 50) return 50;
    if (maxVal <= 100) return 100;
    if (maxVal <= 250) return 250;
    if (maxVal <= 500) return 500;
    if (maxVal <= 1000) return 1000;
    return Math.ceil(maxVal * 1.15);
  }, [items]);

  const yTicks = [0, Math.round(maxCount * 0.33), Math.round(maxCount * 0.67), maxCount];

  const [wrapRef, { width, height }] = useElementSize();
  const padLeft = 40;
  const padRight = 36;
  const padTop = 20;
  const padBottom = 26;
  const plotW = Math.max(1, width - padLeft - padRight);
  const plotH = Math.max(1, height - padTop - padBottom);
  const baseY = padTop + plotH;
  const slotW = plotW / Math.max(1, items.length);

  return (
    <div className="ms-graph-card">
      <div className="ms-graph-header">
        <span className="ms-graph-dot" style={{ backgroundColor: "#64748b" }} />
        <span className="ms-graph-title">DEFECTS PARETO</span>
      </div>

      <div className="ms-graph-svg-wrap" ref={wrapRef}>
        {items.length === 0 ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#94a3b8",
              fontSize: "11px",
              fontWeight: 600,
            }}
          >
            No rejections logged for this month
          </div>
        ) : (
          <svg viewBox={`0 0 ${width} ${height}`} className="ms-graph-svg">
            {yTicks.map((tick) => {
              const y = baseY - (tick / maxCount) * plotH;
              return (
                <g key={tick}>
                  <line x1={padLeft} y1={y} x2={width - padRight + 4} y2={y} stroke="#f1f5f9" strokeWidth="1" />
                  <text x={padLeft - 6} y={y + 3.5} textAnchor="end" className="ms-axis-tick">
                    {tick}
                  </text>
                  <text x={width - padRight + 8} y={y + 3.5} textAnchor="start" className="ms-axis-tick">
                    {Math.round((tick / maxCount) * 100)}%
                  </text>
                </g>
              );
            })}
            {items.map((item, idx) => {
              const barW = Math.min(44, slotW * 0.55);
              const dotX = padLeft + (idx + 0.5) * slotW;
              const x = dotX - barW / 2;
              const barH = Math.min(plotH, (item.count / maxCount) * plotH);
              const y = baseY - barH;
              const dotY = baseY - (item.cumPct / 100) * plotH;

              return (
                <g key={item.defect || idx}>
                  <rect x={x} y={y} width={barW} height={barH} fill="#cbd5e1" rx="3" />
                  <text
                    x={dotX}
                    y={height - 8}
                    textAnchor="middle"
                    className="ms-axis-tick"
                    fontSize="8.5"
                    fontWeight="600"
                  >
                    {item.defect}
                  </text>
                  <text
                    x={dotX}
                    y={y - 5}
                    textAnchor="middle"
                    fontSize="9"
                    fontWeight="700"
                    fill="#475569"
                  >
                    {item.count}
                  </text>
                  <circle cx={dotX} cy={dotY} r="3.5" fill="#1e3a8a" stroke="#ffffff" strokeWidth="1.5" />
                </g>
              );
            })}

            {/* Connecting line between cumulative percentage dots */}
            {items.length > 1 && (
              <polyline
                fill="none"
                stroke="#1e3a8a"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={items
                  .map((item, idx) => {
                    const dotX = padLeft + (idx + 0.5) * slotW;
                    const dotY = baseY - (item.cumPct / 100) * plotH;
                    return `${dotX.toFixed(1)},${dotY.toFixed(1)}`;
                  })
                  .join(" ")}
              />
            )}
          </svg>
        )}
      </div>
    </div>
  );
}

// Badge color for an OEE cell, matching the matrix legend
function getOeeCellStyle(val) {
  if (val === null || val === undefined || val === "") return null;
  const num = Number(val);
  if (num >= 110) return { bg: "#1e293b", color: "#ffffff" }; // >110% dark navy
  if (num >= 100) return { bg: "#fecdd3", color: "#9f1239" }; // >100% pink
  if (num >= 85) return { bg: "#bbf7d0", color: "#166534" }; // 85-99% green
  if (num >= 75) return { bg: "#fef08a", color: "#854d0e" }; // 75-84% yellow
  return { bg: "#fee2e2", color: "#991b1b" }; // <75% red
}

function OeeBadge({ value }) {
  const style = getOeeCellStyle(value);
  if (!style) return null;
  return (
    <span className="ms-oee-badge" style={{ backgroundColor: style.bg, color: style.color }}>
      {Number(value).toFixed(1)}%
    </span>
  );
}

/**
 * Daily MC OEE — Machine x Day Matrix View
 */
function DailyOeeMatrixView({ matrixData = [], plantRow = null, monthInfo }) {
  const daysList = Array.from({ length: monthInfo.daysInMonth }, (_, i) => {
    const day = i + 1;
    const date = new Date(monthInfo.year, monthInfo.month - 1, day);
    return {
      day,
      weekday: date.toLocaleString("en-US", { weekday: "short" }),
      isSunday: date.getDay() === 0,
      isToday: monthInfo.todayDay === day,
    };
  });
  const dayClass = (d) => `${d.isSunday ? "is-sun" : ""} ${d.isToday ? "is-today" : ""}`;

  return (
    <div className="ms-matrix-container">
      <div className="card ms-matrix-card">
        <div className="ms-matrix-header-row">
          <h3 className="ms-matrix-title">Daily MC OEE — Machine × Day Matrix</h3>
          <div className="ms-matrix-legend">
            <span className="ms-legend-pill p-110">■ &gt;110%</span>
            <span className="ms-legend-pill p-100">■ &gt;100%</span>
            <span className="ms-legend-pill p-85">■ 85–99%</span>
            <span className="ms-legend-pill p-75">■ 75–84%</span>
            <span className="ms-legend-pill p-under75">■ &lt;75%</span>
          </div>
        </div>

        {matrixData.length === 0 ? (
          <div className="ms-matrix-empty">
            No production entries logged for this plant in {monthInfo.monthName}.
          </div>
        ) : (
          <div className="ms-matrix-table-wrap">
            <table className="ms-matrix-table">
              <thead>
                <tr>
                  <th className="th-mc-list">M/C LIST</th>
                  <th className="th-avg-oee">MONTH OEE</th>
                  {daysList.map((d) => (
                    <th key={d.day} className={`th-day ${dayClass(d)}`}>
                      <span className="th-day-num">{String(d.day).padStart(2, "0")}</span>
                      <span className="th-day-wk">{d.weekday}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrixData.map((row) => (
                  <tr key={row.machineId}>
                    <td className="td-mc-name">{row.mc}</td>
                    <td className="td-avg-oee">
                      {row.avg !== null ? <OeeBadge value={row.avg} /> : <span className="ms-oee-empty">—</span>}
                    </td>
                    {daysList.map((d) => (
                      <td key={d.day} className={`td-day-cell ${dayClass(d)}`}>
                        <OeeBadge value={row.days[d.day]} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              {plantRow && (
                <tfoot>
                  <tr>
                    <td className="td-mc-name">PLANT</td>
                    <td className="td-avg-oee">
                      {plantRow.avg !== null ? <OeeBadge value={plantRow.avg} /> : <span className="ms-oee-empty">—</span>}
                    </td>
                    {daysList.map((d) => (
                      <td key={d.day} className={`td-day-cell ${dayClass(d)}`}>
                        <OeeBadge value={plantRow.days[d.day]} />
                      </td>
                    ))}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function machineLabel(machine, machineId) {
  const no = machine?.machine_no;
  if (no) return String(no).startsWith("M/C") ? no : `M/C: ${no}`;
  return `M/C: ${machineId}`;
}

export default function MoldsenseDashboard({
  entries = [],
  master = [],
  machines = [],
  reasonCodes = [],
  selectedPlantId = "1040",
  selectedMonth = "2026-09",
  userRole = "operator",
}) {
  const isOperator = userRole === "operator";
  const [activeTab, setActiveTab] = useState("Monthly MIS");

  // Operator strictly gets ONLY Monthly MIS; Supervisors and Admins get both tabs
  const TABS = isOperator ? ["Monthly MIS"] : ["Monthly MIS", "Daily OEE Matrix"];
  const currentTab = isOperator ? "Monthly MIS" : activeTab;

  const monthInfo = useMemo(() => getMonthInfo(selectedMonth), [selectedMonth]);

  // Entries for the selected month and plant, with metrics computed once per entry
  const monthRows = useMemo(() => {
    return entries
      .filter((e) => {
        if (!e.shift_date || !e.shift_date.startsWith(selectedMonth)) return false;
        if (selectedPlantId && selectedPlantId !== "all" && (e.plant_id || "1040") !== selectedPlantId) return false;
        return true;
      })
      .map((e) => ({
        entry: e,
        day: parseInt(e.shift_date.split("-")[2], 10),
        m: computeMetrics(e, master, reasonCodes),
      }));
  }, [entries, selectedMonth, selectedPlantId, master, reasonCodes]);

  // Daily plant series; days without any entry stay null so charts skip them
  const dailySeries = useMemo(() => {
    const byDay = {};
    let maxDataDay = 0;
    monthRows.forEach((row) => {
      if (!byDay[row.day]) byDay[row.day] = [];
      byDay[row.day].push(row);
      maxDataDay = Math.max(maxDataDay, row.day);
    });

    const lastDay = Math.min(monthInfo.daysInMonth, Math.max(monthInfo.lastProductionDay, maxDataDay));
    const days = [];

    for (let day = 1; day <= lastDay; day++) {
      const label = `${String(day).padStart(2, "0")}-${monthInfo.monthName}`;
      const rows = byDay[day] || [];

      if (rows.length === 0) {
        days.push({
          day,
          label,
          prodK: null,
          rejPct: null,
          mc: null,
          plannedDtHrs: null,
          unplannedDtHrs: null,
          defectPcs: null,
        });
        continue;
      }

      const agg = emptyAgg();
      const runningMcs = new Set();
      rows.forEach(({ entry, m }) => {
        addToAgg(agg, m);
        if ((Number(m.ok_prod) || 0) > 0 || (Number(m.net_run_time) || 0) > 0) {
          runningMcs.add(entry.machine_id);
        }
      });

      const produced = agg.ok + agg.rej;

      days.push({
        day,
        label,
        prodK: round1(agg.ok / 1000),
        rejPct: produced > 0 ? Number(((agg.rej / produced) * 100).toFixed(2)) : 0,
        mc: runningMcs.size,
        plannedDtHrs: round1(agg.plannedDt),
        unplannedDtHrs: round1(agg.unplannedDt),
        defectPcs: agg.rej,
      });
    }

    return days;
  }, [monthRows, monthInfo]);

  // Month summary for the KPI strip
  const monthKpis = useMemo(() => {
    const agg = emptyAgg();
    const runningMcs = new Set();
    monthRows.forEach(({ entry, m }) => {
      addToAgg(agg, m);
      if ((Number(m.ok_prod) || 0) > 0 || (Number(m.net_run_time) || 0) > 0) {
        runningMcs.add(entry.machine_id);
      }
    });
    const produced = agg.ok + agg.rej;
    const k = oeeFromAgg(agg);
    return {
      target: agg.tgt,
      production: agg.ok,
      prodVsPlan: agg.tgt > 0 ? (agg.ok / agg.tgt) * 100 : null,
      oee: k ? k.oee : null,
      rejPct: produced > 0 ? (agg.rej / produced) * 100 : null,
      activeMc: runningMcs.size,
    };
  }, [monthRows]);

  // Rejection reasons, read from the same place computeMetrics reads them so totals match
  const paretoData = useMemo(() => {
    const defectCounts = {};
    let totalDefects = 0;

    const processReasons = (reasonsObj) => {
      if (!reasonsObj) return;
      Object.entries(normalizeReasonsMap(reasonsObj)).forEach(([reason_id, val]) => {
        const num = Number(val) || 0;
        if (num <= 0) return;
        const rc = reasonCodes.find((r) => r.reason_id === reason_id || r.code === reason_id);
        const isRejection = rc ? rc.category === "rejection" : reason_id.startsWith("rej_");
        if (!isRejection) return;
        const name = rc?.name || rc?.reason_name || reason_id.replace(/^rej_/, "").replace(/_/g, " ").toUpperCase();
        defectCounts[name] = (defectCounts[name] || 0) + num;
        totalDefects += num;
      });
    };

    monthRows.forEach(({ entry }) => {
      if (Array.isArray(entry.runs) && entry.runs.length > 1) {
        entry.runs.forEach((r) => processReasons(r.reasons));
      } else {
        processReasons(entry.reasons);
      }
    });

    if (totalDefects === 0) return [];

    let runningSum = 0;
    return Object.entries(defectCounts)
      .map(([defect, count]) => ({ defect, count }))
      .sort((a, b) => b.count - a.count)
      .map((item) => {
        runningSum += item.count;
        return { ...item, cumPct: Math.round((runningSum / totalDefects) * 100) };
      });
  }, [monthRows, reasonCodes]);

  // Machine × Day OEE matrix, combining all shifts of a machine on a day
  const { matrixData, plantRow } = useMemo(() => {
    const perMachine = new Map();
    const plantDays = {};
    const plantMonth = emptyAgg();

    monthRows.forEach(({ entry, day, m }) => {
      const id = entry.machine_id;
      if (!perMachine.has(id)) perMachine.set(id, { month: emptyAgg(), days: {} });
      const rec = perMachine.get(id);
      if (!rec.days[day]) rec.days[day] = emptyAgg();
      addToAgg(rec.days[day], m);
      addToAgg(rec.month, m);

      if (!plantDays[day]) plantDays[day] = emptyAgg();
      addToAgg(plantDays[day], m);
      addToAgg(plantMonth, m);
    });

    const machineOrder = machines.map((mc) => mc.machine_id);
    const ids = [...perMachine.keys()].sort((a, b) => {
      const ia = machineOrder.indexOf(a);
      const ib = machineOrder.indexOf(b);
      if (ia === -1 && ib === -1) return String(a).localeCompare(String(b));
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });

    const rows = ids.map((id) => {
      const rec = perMachine.get(id);
      const days = {};
      Object.entries(rec.days).forEach(([d, agg]) => {
        const k = oeeFromAgg(agg);
        if (k) days[d] = round1(k.oee);
      });
      const monthK = oeeFromAgg(rec.month);
      return {
        machineId: id,
        mc: machineLabel(machines.find((mc) => mc.machine_id === id), id),
        avg: monthK ? round1(monthK.oee) : null,
        days,
      };
    });

    const pDays = {};
    Object.entries(plantDays).forEach(([d, agg]) => {
      const k = oeeFromAgg(agg);
      if (k) pDays[d] = round1(k.oee);
    });
    const pMonth = oeeFromAgg(plantMonth);

    return {
      matrixData: rows,
      plantRow: rows.length > 0 ? { avg: pMonth ? round1(pMonth.oee) : null, days: pDays } : null,
    };
  }, [monthRows, machines]);

  return (
    <div className="mis-dashboard-container">
      {/* Tab Navigation Strip (Only Monthly MIS for Operator, 2 Tabs for Supervisor/Admin) */}
      <div className="ms-tab-bar">
        <div className="ms-tab-group">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              className={`ms-tab-item ${currentTab === t ? "active" : ""}`}
              onClick={() => {
                if (!isOperator) setActiveTab(t);
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Monthly MIS Tab: KPI strip + 3x2 Graphs Grid */}
      {currentTab === "Monthly MIS" && (
        <div className="ms-content-area">
          <div className="ms-kpi-grid">
            <KpiCard color="#2563eb" label="Target" value={formatCount(monthKpis.target)} />
            <KpiCard color="#16a34a" label="Production" value={formatCount(monthKpis.production)} />
            <KpiCard color="#2563eb" label="Prod vs Plan" value={formatPct(monthKpis.prodVsPlan)} />
            <KpiCard color="#16a34a" label="OEE (Average)" value={formatPct(monthKpis.oee)} />
            <KpiCard color="#dc2626" label="Rejection %" value={formatPct(monthKpis.rejPct)} />
            <KpiCard color="#9333ea" label="Active MC" value={monthKpis.activeMc} />
          </div>

          <div className="ms-charts-grid">
            <MetricAreaChart
              title="PROD QTY (K)"
              color="#2563eb"
              data={dailySeries}
              dataKey="prodK"
              defaultYMax={20}
              defaultYTicks={[0, 5, 10, 15, 20]}
              unit=" K pcs"
              showLabelThreshold={0.4}
            />

            <MetricAreaChart
              title="PLANNED DOWNTIME (HRS)"
              color="#0284c7"
              data={dailySeries}
              dataKey="plannedDtHrs"
              defaultYMax={25}
              defaultYTicks={[0, 5, 10, 15, 20, 25]}
              decimals={1}
              unit=" hrs"
              showLabelThreshold={1.0}
            />

            <MetricAreaChart
              title="REJECTION (%)"
              color="#dc2626"
              data={dailySeries}
              dataKey="rejPct"
              defaultYMax={1.0}
              defaultYTicks={[0.0, 0.2, 0.4, 0.6, 0.8, 1.0]}
              isPercent={true}
              decimals={2}
              unit="%"
              showLabelThreshold={0.05}
            />

            <MetricAreaChart
              title="ACTIVE MACHINES"
              color="#9333ea"
              data={dailySeries}
              dataKey="mc"
              defaultYMax={15}
              defaultYTicks={[0, 5, 10, 15]}
              decimals={0}
              unit=" mc"
              showLabelThreshold={0}
            />

            <MetricAreaChart
              title="UNPLANNED DOWNTIME (HRS)"
              color="#ea580c"
              data={dailySeries}
              dataKey="unplannedDtHrs"
              defaultYMax={60}
              defaultYTicks={[0, 15, 30, 45, 60]}
              decimals={1}
              unit=" hrs"
              showLabelThreshold={1.0}
            />

            <DefectsParetoChart paretoData={paretoData} />
          </div>
        </div>
      )}

      {/* Daily OEE Matrix Tab: Machine × Day Heatmap (Strictly blocked for Operator) */}
      {!isOperator && currentTab === "Daily OEE Matrix" && (
        <DailyOeeMatrixView matrixData={matrixData} plantRow={plantRow} monthInfo={monthInfo} />
      )}
    </div>
  );
}
