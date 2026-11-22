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

  const { yMax, yTicks } = useMemo(() => {
    const maxVal = Math.max(...data.map((d) => Number(d[dataKey]) || 0), 0);
    if (maxVal <= defaultYMax) return { yMax: defaultYMax, yTicks: defaultYTicks };
    let ceiling = maxVal * 1.15;
    if (ceiling <= 10) ceiling = Math.ceil(ceiling);
    else if (ceiling <= 50) ceiling = Math.ceil(ceiling / 5) * 5;
    else if (ceiling <= 100) ceiling = Math.ceil(ceiling / 10) * 10;
    else if (ceiling <= 500) ceiling = Math.ceil(ceiling / 50) * 50;
    else if (ceiling <= 5000) ceiling = Math.ceil(ceiling / 100) * 100;
    else ceiling = Math.ceil(ceiling / 1000) * 1000;
    const steps = 4;
    const step = ceiling / steps;
    const ticks = Array.from({ length: steps + 1 }, (_, i) => {
      const v = i * step;
      return isPercent ? Number(v.toFixed(1)) : Math.round(v);
    });
    return { yMax: ceiling, yTicks: ticks };
  }, [data, dataKey, defaultYMax, defaultYTicks, isPercent]);

  const points = useMemo(() => {
    if (!data.length) return [];
    return data.map((d, i) => {
      const x = padLeft + (i / Math.max(1, data.length - 1)) * chartW;
      const raw = d[dataKey];
      const hasValue = raw !== null && raw !== undefined;
      const val = hasValue ? Number(raw) : null;
      const normY = hasValue ? Math.min(1, Math.max(0, val / (yMax || 1))) : 0;
      return {
        x,
        y: padTop + chartH - normY * chartH,
        val,
        label: d.label || String(d.day).padStart(2, "0"),
      };
    });
  }, [data, dataKey, yMax, chartW, chartH]);

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
            const y = padTop + chartH - (tickVal / yMax) * chartH;
            return (
              <g key={tickVal}>
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
                {isSignificant && (
                  <text x={p.x} y={p.y - 7} textAnchor="middle" fill="#334155" fontSize="9.5" fontWeight="600">
                    {p.val.toFixed(decimals)}
                    {isPercent ? "%" : ""}
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

function StackedRmChart({ title, data = [] }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const [wrapRef, { width, height }] = useElementSize();
  const padLeft = 40;
  const padRight = 14;
  const padTop = 18;
  const padBottom = 34;
  const chartW = Math.max(1, width - padLeft - padRight);
  const chartH = Math.max(1, height - padTop - padBottom);

  const yMax = useMemo(() => {
    const maxVal = Math.max(...data.map((d) => (Number(d.fgKg) || 0) + (Number(d.runnerKg) || 0) + (Number(d.rejKg) || 0)), 0);
    if (maxVal <= 100) return 100;
    if (maxVal <= 500) return Math.ceil(maxVal / 50) * 50;
    if (maxVal <= 2000) return Math.ceil(maxVal / 100) * 100;
    return Math.ceil(maxVal * 1.1 / 500) * 500;
  }, [data]);

  const yTicks = [0, yMax * 0.25, yMax * 0.5, yMax * 0.75, yMax].map((v) => Math.round(v));
  const slot = chartW / Math.max(1, data.length);
  const barW = Math.min(18, slot * 0.55);
  const hovered = hoveredIdx !== null ? data[hoveredIdx] : null;
  const labelEvery = Math.max(1, Math.ceil(data.length / 12));

  return (
    <div className="ms-graph-card">
      <div className="ms-graph-header">
        <span className="ms-graph-dot" style={{ backgroundColor: "#16a34a" }} />
        <span className="ms-graph-title">{title}</span>
        <div className="rmt-legend">
          <span><i style={{ background: "#16a34a" }} /> FG</span>
          <span><i style={{ background: "#d97706" }} /> Runner</span>
          <span><i style={{ background: "#dc2626" }} /> Rej</span>
        </div>
      </div>
      <div className="ms-graph-svg-wrap" ref={wrapRef}>
        <svg viewBox={`0 0 ${width} ${height}`} className="ms-graph-svg">
          {yTicks.map((tick) => {
            const y = padTop + chartH - (tick / yMax) * chartH;
            return (
              <g key={tick}>
                <line x1={padLeft} y1={y} x2={width - padRight} y2={y} stroke="#f1f5f9" strokeWidth="1" />
                <text x={padLeft - 6} y={y + 3.5} textAnchor="end" className="ms-axis-tick">{tick}</text>
              </g>
            );
          })}
          {data.length === 0 && (
            <text x={width / 2} y={padTop + chartH / 2} textAnchor="middle" fill="#94a3b8" fontSize="11" fontWeight="600">
              No RM data for this month
            </text>
          )}
          {data.map((d, idx) => {
            const cx = padLeft + (idx + 0.5) * slot;
            const x = cx - barW / 2;
            const fg = Number(d.fgKg) || 0;
            const runner = Number(d.runnerKg) || 0;
            const rej = Number(d.rejKg) || 0;
            const total = fg + runner + rej;
            if (total <= 0) return null;
            const hFg = (fg / yMax) * chartH;
            const hRunner = (runner / yMax) * chartH;
            const hRej = (rej / yMax) * chartH;
            let y = padTop + chartH;
            y -= hFg;
            const yFg = y;
            y -= hRunner;
            const yRunner = y;
            y -= hRej;
            const yRej = y;
            return (
              <g key={idx}>
                <rect x={x} y={yFg} width={barW} height={hFg} fill="#16a34a" rx="2" />
                <rect x={x} y={yRunner} width={barW} height={hRunner} fill="#d97706" />
                <rect x={x} y={yRej} width={barW} height={hRej} fill="#dc2626" rx="2" />
                <rect
                  x={cx - slot / 2}
                  y={padTop}
                  width={slot}
                  height={chartH}
                  fill="transparent"
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                />
              </g>
            );
          })}
          {data.map((d, idx) =>
            idx % labelEvery !== 0 ? null : (
              <text
                key={`lx-${idx}`}
                x={padLeft + (idx + 0.5) * slot}
                y={height - 12}
                textAnchor="middle"
                className="ms-axis-tick x-tick"
                transform={`rotate(-25, ${padLeft + (idx + 0.5) * slot}, ${height - 12})`}
              >
                {d.label}
              </text>
            )
          )}
        </svg>
        {hovered && (
          <div className="ms-tooltip" style={{ left: "50%", top: "18%" }}>
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

function DualLineChart({ title, data = [], keyA, keyB, colorA, colorB, labelA, labelB }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const [wrapRef, { width, height }] = useElementSize();
  const padLeft = 40;
  const padRight = 14;
  const padTop = 20;
  const padBottom = 34;
  const chartW = Math.max(1, width - padLeft - padRight);
  const chartH = Math.max(1, height - padTop - padBottom);
  const yMax = 100;
  const yTicks = [0, 25, 50, 75, 100];

  const buildPoints = (key) =>
    data.map((d, i) => {
      const x = padLeft + (i / Math.max(1, data.length - 1)) * chartW;
      const raw = d[key];
      const hasValue = raw !== null && raw !== undefined;
      const val = hasValue ? Number(raw) : null;
      const y = hasValue ? padTop + chartH - Math.min(1, Math.max(0, val / yMax)) * chartH : null;
      return { x, y, val, label: d.label };
    });

  const ptsA = useMemo(() => buildPoints(keyA), [data, keyA, chartW, chartH]);
  const ptsB = useMemo(() => buildPoints(keyB), [data, keyB, chartW, chartH]);
  const pathA = useMemo(() => createSmoothPath(ptsA.filter((p) => p.val !== null)), [ptsA]);
  const pathB = useMemo(() => createSmoothPath(ptsB.filter((p) => p.val !== null)), [ptsB]);
  const labelEvery = Math.max(1, Math.ceil(26 / (chartW / Math.max(1, data.length))));
  const hovered = hoveredIdx !== null ? data[hoveredIdx] : null;

  return (
    <div className="ms-graph-card">
      <div className="ms-graph-header">
        <span className="ms-graph-dot" style={{ backgroundColor: colorA }} />
        <span className="ms-graph-title">{title}</span>
        <div className="rmt-legend">
          <span><i style={{ background: colorA }} /> {labelA}</span>
          <span><i style={{ background: colorB }} /> {labelB}</span>
        </div>
      </div>
      <div className="ms-graph-svg-wrap" ref={wrapRef}>
        <svg viewBox={`0 0 ${width} ${height}`} className="ms-graph-svg">
          {yTicks.map((tick) => {
            const y = padTop + chartH - (tick / yMax) * chartH;
            return (
              <g key={tick}>
                <line x1={padLeft} y1={y} x2={width - padRight} y2={y} stroke="#f1f5f9" strokeWidth="1" />
                <text x={padLeft - 6} y={y + 3.5} textAnchor="end" className="ms-axis-tick">{tick}%</text>
              </g>
            );
          })}
          {data.every((d) => d[keyA] == null && d[keyB] == null) && (
            <text x={width / 2} y={padTop + chartH / 2} textAnchor="middle" fill="#94a3b8" fontSize="11" fontWeight="600">
              No RM data for this month
            </text>
          )}
          {pathA && <path d={pathA} fill="none" stroke={colorA} strokeWidth="2.4" strokeLinecap="round" />}
          {pathB && <path d={pathB} fill="none" stroke={colorB} strokeWidth="2.4" strokeLinecap="round" />}
          {data.map((d, idx) => {
            const x = padLeft + (idx / Math.max(1, data.length - 1)) * chartW;
            return (
              <rect
                key={idx}
                x={x - 7}
                y={padTop}
                width="14"
                height={chartH}
                fill="transparent"
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              />
            );
          })}
          {data.map((d, idx) =>
            idx % labelEvery !== 0 ? null : (
              <text
                key={`x-${idx}`}
                x={padLeft + (idx / Math.max(1, data.length - 1)) * chartW}
                y={height - 12}
                textAnchor="middle"
                className="ms-axis-tick x-tick"
                transform={`rotate(-25, ${padLeft + (idx / Math.max(1, data.length - 1)) * chartW}, ${height - 12})`}
              >
                {d.label}
              </text>
            )
          )}
        </svg>
        {hovered && (
          <div className="ms-tooltip" style={{ left: "50%", top: "20%" }}>
            <div className="ms-tooltip-date">{hovered.label}</div>
            <div className="ms-tooltip-val">
              <span className="dot" style={{ background: colorA }} />
              {labelA} {hovered[keyA] == null ? "—" : `${Number(hovered[keyA]).toFixed(1)}%`}
            </div>
            <div className="ms-tooltip-val">
              <span className="dot" style={{ background: colorB }} />
              {labelB} {hovered[keyB] == null ? "—" : `${Number(hovered[keyB]).toFixed(1)}%`}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function HorizontalBarChart({ title, color, items = [], unit = "kg", emptyMessage = "No data" }) {
  const [wrapRef, { width, height }] = useElementSize({ width: 500, height: 220 });
  const padLeft = 108;
  const padRight = 56;
  const padTop = 12;
  const padBottom = 12;
  const chartW = Math.max(1, width - padLeft - padRight);
  const chartH = Math.max(1, height - padTop - padBottom);
  const maxVal = Math.max(...items.map((i) => Number(i.value) || 0), 1);
  const rowH = chartH / Math.max(1, items.length);

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
            {items.map((item, idx) => {
              const y = padTop + idx * rowH + rowH * 0.18;
              const barH = rowH * 0.58;
              const w = ((Number(item.value) || 0) / maxVal) * chartW;
              return (
                <g key={item.id || idx}>
                  <text
                    x={padLeft - 8}
                    y={y + barH / 2 + 3.5}
                    textAnchor="end"
                    className="ms-axis-tick"
                    fontSize="10"
                    fontWeight="700"
                  >
                    {item.label.length > 14 ? `${item.label.slice(0, 13)}…` : item.label}
                  </text>
                  <rect x={padLeft} y={y} width={Math.max(2, w)} height={barH} fill={color} rx="3" opacity="0.88" />
                  <text
                    x={padLeft + Math.max(2, w) + 6}
                    y={y + barH / 2 + 3.5}
                    className="ms-axis-tick"
                    fontSize="10"
                    fontWeight="700"
                    fill="#334155"
                  >
                    {fmtInt(item.value)} {unit}
                  </text>
                </g>
              );
            })}
          </svg>
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
      .slice(0, 10)
      .map((x) => ({ ...x, value: Math.round(x.value) }));
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
      .slice(0, 10)
      .map((x) => ({ ...x, value: Math.round(x.value) }));
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
          title="DAILY RM CONSUMED (KG)"
          color="#1e3a8a"
          data={dailySeries}
          dataKey="rmKg"
          defaultYMax={500}
          defaultYTicks={[0, 125, 250, 375, 500]}
          decimals={0}
          unit=" kg"
          showLabelThreshold={80}
        />
        <StackedRmChart title="FG vs RUNNER vs REJ (KG)" data={dailySeries} />
        <AreaChart
          title="YIELD % (FG / RM)"
          color="#16a34a"
          data={dailySeries}
          dataKey="yieldPct"
          defaultYMax={100}
          defaultYTicks={[0, 25, 50, 75, 100]}
          isPercent
          decimals={1}
          unit="%"
          showLabelThreshold={50}
        />
        <HorizontalBarChart title="TOP MACHINES BY RM" color="#2563eb" items={topMachines} />
        <HorizontalBarChart title="TOP PARTS BY RM" color="#7c3aed" items={topParts} />
        <DualLineChart
          title="SCRAP SPLIT %"
          data={dailySeries}
          keyA="runnerPct"
          keyB="rejPct"
          colorA="#d97706"
          colorB="#dc2626"
          labelA="Runner %"
          labelB="Rej %"
        />
      </div>
    </div>
  );
}
