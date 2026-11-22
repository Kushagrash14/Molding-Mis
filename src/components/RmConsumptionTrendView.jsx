import React, { useMemo, useState, useRef, useLayoutEffect } from "react";
import { computeMetrics, findProduct } from "../lib/calculations.js";
import { familyInPlant } from "../data/familyMolds.js";

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

function runsOf(entry) {
  if (Array.isArray(entry.runs) && entry.runs.length > 1) {
    return entry.runs.map((r) => ({ ...r, plant_id: r.plant_id || entry.plant_id }));
  }
  return [
    {
      ...entry,
      sap_code: entry.primary_sap_code || entry.runs?.[0]?.sap_code || entry.sap_code,
    },
  ];
}

function fmtInt(n) {
  return Math.round(Number(n) || 0).toLocaleString("en-IN");
}

function KpiCard({ color, label, value, sub }) {
  return (
    <div className="ms-kpi-card" style={{ borderTopColor: color }}>
      <span className="ms-kpi-deco" style={{ backgroundColor: color }} />
      <div className="ms-kpi-val">{value}</div>
      <div className="ms-kpi-lbl">{label}</div>
      {sub ? <div className="ms-kpi-sub">{sub}</div> : null}
    </div>
  );
}

function AreaChart({
  title,
  color,
  data = [],
  dataKey,
  defaultYMax = 20,
  defaultYTicks = [0, 5, 10, 15, 20],
  yMin = 0,
  isPercent = false,
  unit = "",
  decimals = 1,
  showLabelThreshold = 0,
  emptyMessage = "No RM data for this month",
}) {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const [wrapRef, { width, height }] = useElementSize();
  const padLeft = 40;
  const padRight = 14;
  const padTop = 20;
  const padBottom = 34;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const { yMax, yTicks, minY } = useMemo(() => {
    const vals = data.map((d) => d[dataKey]).filter((v) => v !== null && v !== undefined).map(Number);
    const maxVal = vals.length ? Math.max(...vals) : 0;
    const minVal = vals.length ? Math.min(...vals) : 0;
    let floor = Number(yMin) || 0;
    if (isPercent && floor > 0) {
      floor = Math.min(floor, Math.max(0, Math.floor(minVal - 5)));
    }
    let ceiling;
    if (maxVal <= defaultYMax && !(isPercent && floor > 0)) {
      ceiling = defaultYMax;
    } else {
      ceiling = Math.max(maxVal * 1.12, floor + 1);
      if (isPercent) ceiling = Math.min(100, Math.ceil(ceiling));
      else if (ceiling <= 10) ceiling = Math.ceil(ceiling);
      else if (ceiling <= 50) ceiling = Math.ceil(ceiling / 5) * 5;
      else if (ceiling <= 100) ceiling = Math.ceil(ceiling / 10) * 10;
      else if (ceiling <= 500) ceiling = Math.ceil(ceiling / 50) * 50;
      else if (ceiling <= 5000) ceiling = Math.ceil(ceiling / 100) * 100;
      else ceiling = Math.ceil(ceiling / 1000) * 1000;
    }
    if (isPercent && floor > 0 && maxVal <= defaultYMax) {
      ceiling = Math.min(100, Math.max(defaultYMax, Math.ceil(maxVal + 2)));
    }
    const steps = 4;
    const span = ceiling - floor || 1;
    const ticks = Array.from({ length: steps + 1 }, (_, i) => {
      const v = floor + (span * i) / steps;
      return isPercent ? Number(v.toFixed(1)) : Math.round(v);
    });
    return { yMax: ceiling, yTicks: ticks, minY: floor };
  }, [data, dataKey, defaultYMax, defaultYTicks, isPercent, yMin]);

  const points = useMemo(() => {
    if (!data.length) return [];
    const span = yMax - minY || 1;
    return data.map((d, i) => {
      const x = padLeft + (i / Math.max(1, data.length - 1)) * chartW;
      const raw = d[dataKey];
      const hasValue = raw !== null && raw !== undefined;
      const val = hasValue ? Number(raw) : null;
      const normY = hasValue ? Math.min(1, Math.max(0, (val - minY) / span)) : 0;
      return {
        x,
        y: padTop + chartH - normY * chartH,
        val,
        label: d.label || String(d.day).padStart(2, "0"),
      };
    });
  }, [data, dataKey, yMax, minY, chartW, chartH]);

  const plotted = useMemo(() => points.filter((p) => p.val !== null), [points]);
  const linePath = useMemo(() => createSmoothPath(plotted), [plotted]);
  const areaPath = useMemo(() => {
    if (plotted.length === 0) return "";
    const first = plotted[0];
    const last = plotted[plotted.length - 1];
    const bottomY = padTop + chartH;
    return `${linePath} L ${last.x.toFixed(1)} ${bottomY} L ${first.x.toFixed(1)} ${bottomY} Z`;
  }, [linePath, plotted, chartH]);

  const gradId = `rmt_${dataKey}_${color.replace("#", "")}`;
  const labelEvery = Math.max(1, Math.ceil(26 / (chartW / Math.max(1, points.length))));
  const hovered = hoveredIdx !== null ? points[hoveredIdx] : null;

  return (
    <div className="ms-graph-card">
      <div className="ms-graph-header">
        <span className="ms-graph-dot" style={{ backgroundColor: color }} />
        <span className="ms-graph-title">{title}</span>
      </div>
      <div className="ms-graph-svg-wrap" ref={wrapRef}>
        <svg viewBox={`0 0 ${width} ${height}`} className="ms-graph-svg">
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.22" />
              <stop offset="100%" stopColor={color} stopOpacity="0.0" />
            </linearGradient>
          </defs>
          {yTicks.map((tickVal) => {
            const span = yMax - minY || 1;
            const y = padTop + chartH - ((tickVal - minY) / span) * chartH;
            return (
              <g key={tickVal}>
                <line x1={padLeft} y1={y} x2={width - padRight} y2={y} stroke="#f1f5f9" strokeWidth="1" />
                <text x={padLeft - 6} y={y + 3.5} textAnchor="end" className="ms-axis-tick">
                  {isPercent ? tickVal.toFixed(tickVal % 1 ? 1 : 0) : tickVal}
                  {isPercent ? "%" : ""}
                </text>
              </g>
            );
          })}
          {plotted.length === 0 && (
            <text x={width / 2} y={padTop + chartH / 2} textAnchor="middle" fill="#94a3b8" fontSize="11" fontWeight="600">
              {emptyMessage}
            </text>
          )}
          {plotted.length > 1 && <path d={areaPath} fill={`url(#${gradId})`} />}
          {plotted.length > 1 && (
            <path d={linePath} fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          )}
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
                {isSignificant && !isPercent && (
                  <text x={p.x} y={p.y - 7} textAnchor="middle" fill="#334155" fontSize="9.5" fontWeight="600">
                    {p.val.toFixed(decimals)}
                  </text>
                )}
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
          {points.map((p, idx) =>
            idx % labelEvery !== 0 ? null : (
              <text
                key={`x-${idx}`}
                x={p.x}
                y={height - 12}
                textAnchor="middle"
                className="ms-axis-tick x-tick"
                transform={`rotate(-25, ${p.x}, ${height - 12})`}
              >
                {p.label}
              </text>
            )
          )}
        </svg>
        {hovered && (
          <div
            className="ms-tooltip"
            style={{ left: `${(hovered.x / width) * 100}%`, top: `${(hovered.y / height) * 100}%` }}
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
    </div>
  );
}

/** Professional grouped bars: FG / Runner / Rej on the same actual kg scale */
function GroupedComparisonBarChart({ title, data = [] }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const [wrapRef, { width, height }] = useElementSize();
  const padLeft = 44;
  const padRight = 14;
  const padTop = 28;
  const padBottom = 38;
  const chartW = Math.max(1, width - padLeft - padRight);
  const chartH = Math.max(1, height - padTop - padBottom);

  const series = [
    { key: "fgKg", color: "#16a34a", label: "FG" },
    { key: "runnerKg", color: "#d97706", label: "Runner" },
    { key: "rejKg", color: "#dc2626", label: "Rej" },
  ];

  const yMax = useMemo(() => {
    const vals = data
      .flatMap((d) => [d.fgKg, d.runnerKg, d.rejKg])
      .filter((v) => v !== null && v !== undefined)
      .map(Number);
    const peak = vals.length ? Math.max(...vals) : 0;
    if (peak <= 0) return 100;
    let ceiling = peak * 1.15;
    if (ceiling <= 500) return Math.ceil(ceiling / 50) * 50;
    if (ceiling <= 2000) return Math.ceil(ceiling / 100) * 100;
    if (ceiling <= 10000) return Math.ceil(ceiling / 500) * 500;
    return Math.ceil(ceiling / 1000) * 1000;
  }, [data]);

  const yTicks = useMemo(
    () => [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(yMax * f)),
    [yMax]
  );
  const slotW = chartW / Math.max(1, data.length);
  const groupW = Math.min(slotW * 0.78, 28);
  const barGap = Math.min(2, groupW * 0.08);
  const barW = Math.max(2, (groupW - barGap * 2) / 3);
  const dateEvery = Math.max(1, Math.ceil(data.length / 10));
  const valueEvery = Math.max(1, Math.ceil(data.length / 8));
  const hovered = hoveredIdx !== null ? data[hoveredIdx] : null;
  const hoverX =
    hoveredIdx !== null ? padLeft + (hoveredIdx + 0.5) * slotW : null;

  const shortValue = (value) => {
    const n = Number(value) || 0;
    if (n >= 10000) return `${(n / 1000).toFixed(1)}k`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return Math.round(n).toLocaleString("en-IN");
  };

  return (
    <div className="ms-graph-card">
      <div className="ms-graph-header">
        <span className="ms-graph-dot" style={{ backgroundColor: "#16a34a" }} />
        <span className="ms-graph-title">{title}</span>
        <div className="rmt-legend">
          {series.map((s) => (
            <span key={s.key}><i style={{ background: s.color }} /> {s.label}</span>
          ))}
        </div>
      </div>
      <div className="ms-graph-svg-wrap" ref={wrapRef}>
        <svg viewBox={`0 0 ${width} ${height}`} className="ms-graph-svg">
          <defs>
            {series.map((s) => (
              <linearGradient
                key={s.key}
                id={`compare_${s.key}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor={s.color} stopOpacity="1" />
                <stop offset="100%" stopColor={s.color} stopOpacity="0.62" />
              </linearGradient>
            ))}
          </defs>
          {yTicks.map((tick) => {
            const y = padTop + chartH - (tick / yMax) * chartH;
            return (
              <g key={tick}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke="#e8eef5"
                  strokeWidth="1"
                />
                <text
                  x={padLeft - 6}
                  y={y + 3.5}
                  textAnchor="end"
                  className="ms-axis-tick"
                >
                  {tick >= 1000
                    ? `${(tick / 1000).toFixed(tick % 1000 ? 1 : 0)}k`
                    : tick}
                </text>
              </g>
            );
          })}
          {data.every((d) => d.fgKg == null) && (
            <text x={width / 2} y={padTop + chartH / 2} textAnchor="middle" fill="#94a3b8" fontSize="11" fontWeight="600">
              No RM data for this month
            </text>
          )}
          {data.map((d, idx) => {
            const centerX = padLeft + (idx + 0.5) * slotW;
            const startX = centerX - groupW / 2;
            const showValues = idx % valueEvery === 0 || hoveredIdx === idx;
            return (
              <g key={idx}>
                {series.map((s, si) => {
                  const raw = d[s.key];
                  if (raw === null || raw === undefined) return null;
                  const value = Number(raw) || 0;
                  const visualH = Math.max(value > 0 ? 2 : 0, (value / yMax) * chartH);
                  const x = startX + si * (barW + barGap);
                  const y = padTop + chartH - visualH;
                  return (
                    <g key={s.key}>
                      <rect
                        x={x}
                        y={y}
                        width={barW}
                        height={visualH}
                        rx={Math.min(2.5, barW / 2)}
                        fill={`url(#compare_${s.key})`}
                        opacity={hoveredIdx === null || hoveredIdx === idx ? 1 : 0.78}
                      />
                      {showValues && value > 0 && (
                        <text
                          x={x + barW / 2}
                          y={Math.max(10, y - 4)}
                          textAnchor="middle"
                          fontSize={hoveredIdx === idx ? "8.5" : "7.5"}
                          fontWeight="700"
                          fill={s.color}
                        >
                          {shortValue(value)}
                        </text>
                      )}
                    </g>
                  );
                })}
                <rect
                  x={centerX - slotW / 2}
                  y={padTop}
                  width={slotW}
                  height={chartH}
                  fill="transparent"
                  style={{ cursor: "pointer" }}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                />
              </g>
            );
          })}
          {data.map((d, idx) =>
            idx % dateEvery !== 0 ? null : (
              <text
                key={`x-${idx}`}
                x={padLeft + (idx + 0.5) * slotW}
                y={height - 12}
                textAnchor="middle"
                className="ms-axis-tick x-tick"
                transform={`rotate(-25, ${padLeft + (idx + 0.5) * slotW}, ${height - 12})`}
              >
                {d.label}
              </text>
            )
          )}
        </svg>
        {hovered && hoverX != null && hovered.fgKg != null && (
          <div
            className="ms-tooltip"
            style={{ left: `${(hoverX / width) * 100}%`, top: "12%" }}
          >
            <div className="ms-tooltip-date">{hovered.label}</div>
            <div className="ms-tooltip-val"><span className="dot" style={{ background: "#16a34a" }} /> FG {fmtInt(hovered.fgKg)} kg</div>
            <div className="ms-tooltip-val"><span className="dot" style={{ background: "#d97706" }} /> Runner {fmtInt(hovered.runnerKg)} kg</div>
            <div className="ms-tooltip-val"><span className="dot" style={{ background: "#dc2626" }} /> Rej {fmtInt(hovered.rejKg)} kg</div>
          </div>
        )}
      </div>
    </div>
  );
}

function shortMachineLabel(raw) {
  const s = String(raw || "").replace(/^M\/C:?\s*/i, "").trim();
  const ton = s.match(/^(\d+)\s*[-–]?\s*(\d+)\s*TON/i);
  if (ton) return `${ton[1]}-${ton[2]}T`;
  const m = s.match(/^([A-Za-z0-9_-]{1,10})/);
  return m ? m[1] : s.slice(0, 10);
}

/** Ranked vertical bars — same card language as Daily MIS charts */
function RankBarChart({ title, color, items = [], unit = "kg", emptyMessage = "No data" }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const [wrapRef, { width, height }] = useElementSize({ width: 500, height: 220 });
  const padLeft = 36;
  const padRight = 12;
  const padTop = 28;
  const padBottom = 42;
  const chartW = Math.max(1, width - padLeft - padRight);
  const chartH = Math.max(1, height - padTop - padBottom);
  const maxVal = Math.max(...items.map((i) => Number(i.value) || 0), 1);
  const yMax = Math.ceil(maxVal * 1.12 / (maxVal > 10000 ? 1000 : maxVal > 1000 ? 100 : 10)) * (maxVal > 10000 ? 1000 : maxVal > 1000 ? 100 : 10) || maxVal;
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(yMax * f));
  const slot = chartW / Math.max(1, items.length);
  const barW = Math.min(28, slot * 0.55);
  const gradId = `rmtRank_${color.replace("#", "")}`;
  const hovered = hoveredIdx !== null ? items[hoveredIdx] : null;

  return (
    <div className="ms-graph-card">
      <div className="ms-graph-header">
        <span className="ms-graph-dot" style={{ backgroundColor: color }} />
        <span className="ms-graph-title">{title}</span>
      </div>
      <div className="ms-graph-svg-wrap" ref={wrapRef}>
        {items.length === 0 ? (
          <div className="rmt-empty">{emptyMessage}</div>
        ) : (
          <svg viewBox={`0 0 ${width} ${height}`} className="ms-graph-svg">
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.95" />
                <stop offset="100%" stopColor={color} stopOpacity="0.45" />
              </linearGradient>
            </defs>
            {yTicks.map((tick) => {
              const y = padTop + chartH - (tick / yMax) * chartH;
              return (
                <g key={tick}>
                  <line x1={padLeft} y1={y} x2={width - padRight} y2={y} stroke="#f1f5f9" strokeWidth="1" />
                  <text x={padLeft - 6} y={y + 3.5} textAnchor="end" className="ms-axis-tick">
                    {tick >= 1000 ? `${(tick / 1000).toFixed(tick % 1000 ? 1 : 0)}k` : tick}
                  </text>
                </g>
              );
            })}
            {items.map((item, idx) => {
              const cx = padLeft + (idx + 0.5) * slot;
              const h = ((Number(item.value) || 0) / yMax) * chartH;
              const y = padTop + chartH - h;
              const isHot = hoveredIdx === idx;
              return (
                <g key={item.id || idx}>
                  <rect
                    x={cx - barW / 2}
                    y={y}
                    width={barW}
                    height={Math.max(2, h)}
                    fill={`url(#${gradId})`}
                    rx="4"
                    opacity={isHot ? 1 : 0.92}
                  />
                  <text
                    x={cx}
                    y={y - 6}
                    textAnchor="middle"
                    fontSize="9"
                    fontWeight="700"
                    fill="#334155"
                  >
                    {Number(item.value) >= 1000 ? `${(item.value / 1000).toFixed(1)}k` : fmtInt(item.value)}
                  </text>
                  <text
                    x={cx}
                    y={height - 18}
                    textAnchor="middle"
                    className="ms-axis-tick"
                    fontSize="9"
                    fontWeight="700"
                    transform={`rotate(-28, ${cx}, ${height - 18})`}
                  >
                    {item.shortLabel || item.label}
                  </text>
                  <rect
                    x={cx - slot / 2}
                    y={padTop}
                    width={slot}
                    height={chartH + 20}
                    fill="transparent"
                    onMouseEnter={() => setHoveredIdx(idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                  />
                </g>
              );
            })}
          </svg>
        )}
        {hovered && (
          <div className="ms-tooltip" style={{ left: "50%", top: "16%" }}>
            <div className="ms-tooltip-date">{hovered.label}</div>
            <div className="ms-tooltip-val">
              <span className="dot" style={{ backgroundColor: color }} />
              <strong>{fmtInt(hovered.value)}</strong> {unit}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

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
  return { year, month, daysInMonth, monthName, lastProductionDay };
}

export default function RmConsumptionTrendView({
  entries = [],
  master = [],
  machines = [],
  plants = [],
  reasonCodes = [],
  selectedPlantId = "all",
  selectedMonth = "2026-11",
}) {
  const monthInfo = useMemo(() => getMonthInfo(selectedMonth), [selectedMonth]);

  const records = useMemo(() => {
    const out = [];
    entries.forEach((entry) => {
      if (!entry.shift_date || !entry.shift_date.startsWith(selectedMonth)) return;
      const entryPlant = String(entry.plant_id || "1040");
      if (selectedPlantId && selectedPlantId !== "all" && entryPlant !== String(selectedPlantId)) return;

      runsOf(entry).forEach((run, runIdx) => {
        const sap = String(run.sap_code || "").trim();
        if (!sap || sap === "DOWN_12H") return;
        const runPlant = String(run.plant_id || entryPlant);
        const m = computeMetrics(run, master, reasonCodes);
        const ok = Number(m.ok_prod) || 0;
        const rej = Number(m.total_rej) || 0;
        const produced = ok + rej;
        const runHour = Number(m.net_run_time) || Number(run.run_hour) || 0;
        if (produced <= 0 && runHour <= 0) return;

        const product = findProduct(master, sap, runPlant);
        const family = familyInPlant(master, sap, runPlant);
        const partWt = Number(product?.part_wt || run.part_wt || 0);
        const runWt = Number(product?.run_wt || run.run_wt || 0);
        const ownCavity = Number(product?.cavity) || Number(run.running_cavity) || Number(run.std_cavity) || 1;
        const cavityFactor = family ? family.pieceFactor : ownCavity > 0 ? ownCavity : 1;
        const netWt = partWt + (cavityFactor > 0 ? runWt / cavityFactor : 0);
        const fgWeight = Number(m.ok_prod_wt) || partWt * ok;
        const rejWeight = Number(m.rej_wt) || partWt * rej;
        const totalConsumption = Number(m.total_consumption) || netWt * produced;
        const runnerScrap = Math.max(0, totalConsumption - fgWeight - rejWeight);
        const mcObj = machines.find((mc) => mc.machine_id === entry.machine_id);

        out.push({
          day: parseInt(entry.shift_date.split("-")[2], 10),
          machineId: entry.machine_id,
          machineNo: mcObj?.machine_no || entry.machine_id,
          sapCode: sap,
          partLabel: product?.part_no || sap,
          fgWeight,
          rejWeight,
          runnerScrap,
          totalConsumption,
        });
      });
    });
    return out;
  }, [entries, master, machines, reasonCodes, selectedMonth, selectedPlantId]);

  const dailySeries = useMemo(() => {
    const byDay = {};
    let maxDataDay = 0;
    records.forEach((r) => {
      if (!byDay[r.day]) {
        byDay[r.day] = { fg: 0, runner: 0, rej: 0, total: 0, machines: new Set() };
      }
      byDay[r.day].fg += r.fgWeight;
      byDay[r.day].runner += r.runnerScrap;
      byDay[r.day].rej += r.rejWeight;
      byDay[r.day].total += r.totalConsumption;
      byDay[r.day].machines.add(r.machineId);
      maxDataDay = Math.max(maxDataDay, r.day);
    });

    const lastDay = Math.min(monthInfo.daysInMonth, Math.max(monthInfo.lastProductionDay, maxDataDay));
    const days = [];
    for (let day = 1; day <= lastDay; day++) {
      const label = `${String(day).padStart(2, "0")}-${monthInfo.monthName}`;
      const row = byDay[day];
      if (!row || row.total <= 0) {
        days.push({
          day,
          label,
          rmKg: null,
          rmMt: null,
          fgKg: null,
          runnerKg: null,
          rejKg: null,
          yieldPct: null,
          runnerPct: null,
          rejPct: null,
        });
        continue;
      }
      days.push({
        day,
        label,
        rmKg: Math.round(row.total),
        rmMt: Number((row.total / 1000).toFixed(2)),
        fgKg: Math.round(row.fg),
        runnerKg: Math.round(row.runner),
        rejKg: Math.round(row.rej),
        yieldPct: Number(((row.fg / row.total) * 100).toFixed(1)),
        runnerPct: Number(((row.runner / row.total) * 100).toFixed(1)),
        rejPct: Number(((row.rej / row.total) * 100).toFixed(1)),
      });
    }
    return days;
  }, [records, monthInfo]);

  const kpis = useMemo(() => {
    let fg = 0;
    let runner = 0;
    let rej = 0;
    let total = 0;
    const mcs = new Set();
    records.forEach((r) => {
      fg += r.fgWeight;
      runner += r.runnerScrap;
      rej += r.rejWeight;
      total += r.totalConsumption;
      mcs.add(r.machineId);
    });
    return {
      total,
      fg,
      runner,
      rej,
      yieldPct: total > 0 ? (fg / total) * 100 : null,
      machines: mcs.size,
    };
  }, [records]);

  const topMachines = useMemo(() => {
    const map = new Map();
    records.forEach((r) => {
      if (!map.has(r.machineId)) map.set(r.machineId, { id: r.machineId, label: r.machineNo, value: 0 });
      map.get(r.machineId).value += r.totalConsumption;
    });
    return Array.from(map.values())
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
      .map((x) => ({
        ...x,
        value: Math.round(x.value),
        shortLabel: shortMachineLabel(x.label),
      }));
  }, [records]);

  const topParts = useMemo(() => {
    const map = new Map();
    records.forEach((r) => {
      const key = r.sapCode;
      if (!map.has(key)) map.set(key, { id: key, label: r.partLabel || key, value: 0 });
      map.get(key).value += r.totalConsumption;
    });
    return Array.from(map.values())
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
      .map((x) => ({
        ...x,
        value: Math.round(x.value),
        shortLabel: String(x.label).length > 8 ? String(x.label).slice(-6) : String(x.label),
      }));
  }, [records]);

  return (
    <div className="ms-content-area">
      <div className="ms-kpi-grid">
        <KpiCard color="#1e3a8a" label="Total RM" value={`${fmtInt(kpis.total)} kg`} sub={`≈ ${(kpis.total / 1000).toFixed(1)} MT`} />
        <KpiCard color="#16a34a" label="Finished Goods" value={`${fmtInt(kpis.fg)} kg`} sub={kpis.yieldPct != null ? `${kpis.yieldPct.toFixed(1)}% yield` : "—"} />
        <KpiCard color="#d97706" label="Runner Scrap" value={`${fmtInt(kpis.runner)} kg`} />
        <KpiCard color="#dc2626" label="Rejection Scrap" value={`${fmtInt(kpis.rej)} kg`} />
        <KpiCard color="#2563eb" label="Yield %" value={kpis.yieldPct == null ? "—" : `${kpis.yieldPct.toFixed(1)}%`} />
        <KpiCard color="#6366f1" label="Active MC" value={kpis.machines} />
      </div>

      <div className="ms-charts-grid">
        <AreaChart
          title="DAILY RM CONSUMPTION (KG)"
          color="#1e3a8a"
          data={dailySeries}
          dataKey="rmKg"
          defaultYMax={500}
          defaultYTicks={[0, 125, 250, 375, 500]}
          decimals={0}
          unit=" kg"
          showLabelThreshold={80}
        />
        <AreaChart
          title="DAILY RUNNER SCRAP (KG)"
          color="#d97706"
          data={dailySeries}
          dataKey="runnerKg"
          defaultYMax={200}
          defaultYTicks={[0, 50, 100, 150, 200]}
          decimals={0}
          unit=" kg"
          showLabelThreshold={20}
        />
        <AreaChart
          title="DAILY REJECTION SCRAP (KG)"
          color="#dc2626"
          data={dailySeries}
          dataKey="rejKg"
          defaultYMax={200}
          defaultYTicks={[0, 50, 100, 150, 200]}
          decimals={0}
          unit=" kg"
          showLabelThreshold={20}
        />
        <GroupedComparisonBarChart title="FG vs RUNNER vs REJ (KG)" data={dailySeries} />
        <RankBarChart title="TOP MACHINES BY RM CONSUMPTION" color="#2563eb" items={topMachines} />
        <RankBarChart title="TOP PARTS BY RM CONSUMPTION" color="#7c3aed" items={topParts} />
      </div>
    </div>
  );
}
