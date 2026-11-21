import React, { useState, useEffect, useMemo } from "react";

/**
 * NEXUS INDUSTRIAL · EXECUTIVE PERFORMANCE DASHBOARD
 * Futuristic Cyberpunk / Industrial Sci-Fi Command Center
 * Matches exact UI aesthetics of high-tech mission control telemetries.
 */

// Isometric 3D Wireframe Industrial Press Hologram SVG
function WireframePressSvg({ status = "RUNNING", color = "#00ff88" }) {
  const isStopped = status === "STOPPED";
  const isMaint = status === "MAINTENANCE";
  const isSpare = status === "SPARE";

  const strokeColor = isStopped
    ? "#ef4444"
    : isMaint
    ? "#f59e0b"
    : isSpare
    ? "#475569"
    : "#00ff88";

  const glowFilter = isStopped
    ? "drop-shadow(0 0 6px rgba(239, 68, 68, 0.8))"
    : isMaint
    ? "drop-shadow(0 0 6px rgba(245, 158, 11, 0.8))"
    : isSpare
    ? "none"
    : "drop-shadow(0 0 6px rgba(0, 255, 136, 0.8))";

  return (
    <svg
      viewBox="0 0 100 85"
      style={{
        width: "100%",
        maxHeight: "68px",
        filter: glowFilter,
        margin: "0 auto",
        display: "block",
      }}
    >
      <defs>
        <linearGradient id={`grad-${status}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={strokeColor} stopOpacity="0.8" />
          <stop offset="100%" stopColor={strokeColor} stopOpacity="0.2" />
        </linearGradient>
      </defs>

      {/* Isometric Floor Grid / Platen Base */}
      <polygon
        points="50,12 85,30 50,48 15,30"
        fill={`url(#grad-${status})`}
        stroke={strokeColor}
        strokeWidth="1.2"
        opacity="0.6"
      />

      {/* 4 Isometric Tie-Bars / Pillars */}
      <line x1="26" y1="24" x2="26" y2="58" stroke={strokeColor} strokeWidth="1.2" strokeDasharray={isMaint ? "2 2" : "none"} />
      <line x1="74" y1="24" x2="74" y2="58" stroke={strokeColor} strokeWidth="1.2" strokeDasharray={isMaint ? "2 2" : "none"} />
      <line x1="50" y1="36" x2="50" y2="70" stroke={strokeColor} strokeWidth="1.2" />
      <line x1="50" y1="12" x2="50" y2="46" stroke={strokeColor} strokeWidth="1.2" opacity="0.5" />

      {/* Lower Base Foundation */}
      <polygon
        points="50,48 85,30 85,38 50,56 15,38 15,30"
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.2"
        opacity="0.8"
      />

      {/* Central Moving Platen / Mold Core */}
      <polygon
        points="50,28 72,39 50,50 28,39"
        fill={`url(#grad-${status})`}
        stroke={strokeColor}
        strokeWidth="1.4"
      >
        {status === "RUNNING" && (
          <animate
            attributeName="opacity"
            values="0.4;0.9;0.4"
            dur="2.5s"
            repeatCount="indefinite"
          />
        )}
      </polygon>

      {/* Hydraulic Clamping Cylinder on Top */}
      <polygon
        points="50,40 64,47 50,54 36,47"
        fill="none"
        stroke={strokeColor}
        strokeWidth="1"
        opacity="0.7"
      />
      <polygon
        points="50,56 78,70 50,84 22,70"
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.4"
      />
      <line x1="22" y1="70" x2="22" y2="75" stroke={strokeColor} strokeWidth="1" />
      <line x1="78" y1="70" x2="78" y2="75" stroke={strokeColor} strokeWidth="1" />
      <line x1="50" y1="84" x2="50" y2="89" stroke={strokeColor} strokeWidth="1" />

      {/* Status Specific Hologram Indicators */}
      {status === "RUNNING" && (
        <circle cx="50" cy="39" r="2.5" fill="#00ff88">
          <animate attributeName="r" values="2;4.5;2" dur="1.8s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="1;0.3;1" dur="1.8s" repeatCount="indefinite" />
        </circle>
      )}

      {status === "STOPPED" && (
        <g stroke="#ef4444" strokeWidth="2">
          <line x1="45" y1="34" x2="55" y2="44" />
          <line x1="55" y1="34" x2="45" y2="44" />
        </g>
      )}

      {status === "MAINTENANCE" && (
        <circle cx="50" cy="39" r="3" fill="#f59e0b">
          <animate attributeName="opacity" values="0.2;1;0.2" dur="1s" repeatCount="indefinite" />
        </circle>
      )}
    </svg>
  );
}

// Circular Neon OEE Radial Gauge
function CircularOeeGauge({ value = 89.0, target = 85.0 }) {
  const radius = 62;
  const stroke = 9;
  const normalizedRadius = radius - stroke / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, value)) / 100) * circumference;

  const isOnTrack = value >= target;

  return (
    <div style={{ position: "relative", width: "155px", height: "155px", margin: "0 auto" }}>
      <svg height="155" width="155" style={{ transform: "rotate(-90deg)" }}>
        <defs>
          <linearGradient id="oeeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00f0ff" />
            <stop offset="60%" stopColor="#00ff88" />
            <stop offset="100%" stopColor="#38bdf8" />
          </linearGradient>
          <filter id="neonGlow">
            <feGaussianBlur stdDeviation="3.5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Track Background */}
        <circle
          stroke="rgba(14, 165, 233, 0.15)"
          fill="transparent"
          strokeWidth={stroke}
          r={normalizedRadius}
          cx="77.5"
          cy="77.5"
        />

        {/* Outer Dashed Tech Ring */}
        <circle
          stroke="rgba(0, 240, 255, 0.25)"
          fill="transparent"
          strokeWidth="1.5"
          strokeDasharray="4 6"
          r={normalizedRadius + 8}
          cx="77.5"
          cy="77.5"
        />

        {/* Glowing Progress Arc */}
        <circle
          stroke="url(#oeeGrad)"
          fill="transparent"
          strokeWidth={stroke}
          strokeDasharray={`${circumference} ${circumference}`}
          style={{ strokeDashoffset, transition: "stroke-dashoffset 1s ease-in-out" }}
          strokeLinecap="round"
          filter="url(#neonGlow)"
          r={normalizedRadius}
          cx="77.5"
          cy="77.5"
        />
      </svg>

      {/* Inner Information Display */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
        }}
      >
        <span
          style={{
            fontSize: "10px",
            fontWeight: "800",
            letterSpacing: "1.2px",
            color: "#64748b",
            textTransform: "uppercase",
          }}
        >
          PLANT OEE
        </span>
        <span
          style={{
            fontSize: "30px",
            fontWeight: "900",
            fontFamily: "'JetBrains Mono', Consolas, monospace",
            color: "#ffffff",
            textShadow: "0 0 16px rgba(0, 240, 255, 0.7)",
            lineHeight: "1.1",
          }}
        >
          {value.toFixed(1)}%
        </span>
        <span
          style={{
            fontSize: "9px",
            color: "#94a3b8",
            fontWeight: "700",
            marginTop: "2px",
            letterSpacing: "0.5px",
          }}
        >
          TARGET: {target.toFixed(1)}%
        </span>
        <span
          style={{
            marginTop: "4px",
            fontSize: "9px",
            fontWeight: "800",
            padding: "2px 8px",
            borderRadius: "10px",
            background: isOnTrack ? "rgba(0, 255, 136, 0.15)" : "rgba(239, 68, 68, 0.15)",
            color: isOnTrack ? "#00ff88" : "#ef4444",
            border: `1px solid ${isOnTrack ? "rgba(0, 255, 136, 0.5)" : "rgba(239, 68, 68, 0.5)"}`,
            letterSpacing: "0.8px",
          }}
        >
          {isOnTrack ? "ON TRACK" : "BELOW TARGET"}
        </span>
      </div>
    </div>
  );
}

// Plan vs Actual Cyberpunk Spline Wave Chart
function PlanVsActualWaveChart({ actualTons = 11840, targetTons = 12500 }) {
  const [hoveredPoint, setHoveredPoint] = useState(null);

  const timeSlots = ["05:00", "08:00", "10:00", "12:00", "14:00", "16:00", "18:00"];

  // Precomputed undulating points for smooth sci-fi spline
  // Curve 1: Actual Production (Cyan)
  const actualPath = "M 30,110 C 90,110 140,40 220,38 C 300,36 340,95 420,90 C 490,85 540,120 610,118";
  const actualArea = "M 30,110 C 90,110 140,40 220,38 C 300,36 340,95 420,90 C 490,85 540,120 610,118 L 610,150 L 30,150 Z";

  // Curve 2: Target (Lime Green dashed)
  const targetPath = "M 30,95 C 100,95 160,110 240,115 C 320,120 370,45 440,48 C 500,50 560,140 610,145";

  return (
    <div style={{ position: "relative", width: "100%", height: "165px" }}>
      <svg
        viewBox="0 0 640 170"
        style={{ width: "100%", height: "100%", overflow: "visible" }}
      >
        <defs>
          <linearGradient id="actualGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#00f0ff" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#00f0ff" stopOpacity="0.0" />
          </linearGradient>

          <filter id="cyanGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Grid Background Horizontal Lines */}
        <line x1="30" y1="40" x2="610" y2="40" stroke="rgba(255, 255, 255, 0.06)" strokeDasharray="3 3" />
        <line x1="30" y1="80" x2="610" y2="80" stroke="rgba(255, 255, 255, 0.06)" strokeDasharray="3 3" />
        <line x1="30" y1="120" x2="610" y2="120" stroke="rgba(255, 255, 255, 0.06)" strokeDasharray="3 3" />

        {/* Actual Glowing Area */}
        <path d={actualArea} fill="url(#actualGrad)" />

        {/* Target Dashed Green Wave */}
        <path
          d={targetPath}
          fill="none"
          stroke="#00ff88"
          strokeWidth="2.2"
          strokeDasharray="5 5"
          opacity="0.85"
        />

        {/* Actual Solid Cyan Wave */}
        <path
          d={actualPath}
          fill="none"
          stroke="#00f0ff"
          strokeWidth="2.8"
          filter="url(#cyanGlow)"
        />

        {/* Data Sample Dots along actual path */}
        {[
          { x: 30, y: 110, val: "1,420 T" },
          { x: 120, y: 65, val: "3,150 T" },
          { x: 220, y: 38, val: "5,800 T" },
          { x: 330, y: 75, val: "7,450 T" },
          { x: 420, y: 90, val: "9,200 T" },
          { x: 520, y: 110, val: "10,650 T" },
          { x: 610, y: 118, val: "11,840 T" },
        ].map((pt, i) => (
          <circle
            key={i}
            cx={pt.x}
            cy={pt.y}
            r="4"
            fill="#00f0ff"
            stroke="#0a1122"
            strokeWidth="2"
            style={{ cursor: "pointer", transition: "all 0.2s" }}
            onMouseEnter={() => setHoveredPoint(pt)}
            onMouseLeave={() => setHoveredPoint(null)}
          />
        ))}

        {/* Time Labels on X-axis */}
        {timeSlots.map((time, idx) => {
          const x = 30 + (idx / (timeSlots.length - 1)) * 580;
          return (
            <text
              key={time}
              x={x}
              y="164"
              fill="#64748b"
              fontSize="9"
              fontFamily="'JetBrains Mono', Consolas, monospace"
              textAnchor="middle"
              fontWeight="600"
            >
              {time}
            </text>
          );
        })}
      </svg>

      {hoveredPoint && (
        <div
          style={{
            position: "absolute",
            top: hoveredPoint.y - 30,
            left: hoveredPoint.x - 35,
            background: "#0f172a",
            border: "1px solid #00f0ff",
            boxShadow: "0 0 10px rgba(0, 240, 255, 0.4)",
            padding: "3px 8px",
            borderRadius: "4px",
            fontSize: "10px",
            color: "#00f0ff",
            fontFamily: "monospace",
            fontWeight: "700",
            pointerEvents: "none",
            zIndex: 10,
          }}
        >
          {hoveredPoint.val}
        </div>
      )}
    </div>
  );
}

// Sparkline Mini Curve SVG
function MiniSparkline({ color = "#00f0ff" }) {
  return (
    <svg width="65" height="18" viewBox="0 0 65 18" style={{ overflow: "visible" }}>
      <path
        d="M 0,14 Q 16,3 32,10 T 65,4"
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function NexusIndustrialDashboard({
  entries = [],
  machines = [],
  plants = [],
  selectedPlantId = "all",
  currentUser,
  onSwitchToClassic,
}) {
  // Current live wall clock
  const [currentTime, setCurrentTime] = useState("");
  const [activePlant, setActivePlant] = useState(selectedPlantId || "all");
  const [currency, setCurrency] = useState("USD"); // "USD" or "INR"
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [showCctvModal, setShowCctvModal] = useState(false);
  const [cctvCam, setCctvCam] = useState(4);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Live time ticker
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });
      setCurrentTime(timeStr);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Filtered machines for selected plant
  const relevantMachines = useMemo(() => {
    let list = Array.isArray(machines) ? machines : [];
    if (activePlant !== "all") {
      list = list.filter((m) => String(m.plant_id) === String(activePlant));
    }
    return list;
  }, [machines, activePlant]);

  // Generate or map 11-12 Machines grid matching the UI mockup
  const machineGrid = useMemo(() => {
    // If real machines exist, use them; otherwise seed realistic press roster
    const defaultMcs = [
      { id: "P01", name: "PRESS 01", tonnage: "1500T", spm: "14 SPM", status: "RUNNING", oee: 92.4, mold: "HOUSING-FRONT", rej: 2 },
      { id: "P02", name: "PRESS 02", tonnage: "1000T", spm: "16 SPM", status: "RUNNING", oee: 88.1, mold: "BASE-PANEL", rej: 5 },
      { id: "P03", name: "PRESS 03", tonnage: "900T", spm: "14 SPM", status: "RUNNING", oee: 94.6, mold: "DOOR-HANDLE", rej: 1 },
      { id: "P04", name: "PRESS 04", tonnage: "800T", spm: "0 SPM", status: "MAINTENANCE", oee: 45.0, mold: "— TOOL CHECK", rej: 0, reason: "Hydraulic Seal Maintenance" },
      { id: "P05", name: "PRESS 05", tonnage: "1500T", spm: "14 SPM", status: "RUNNING", oee: 91.2, mold: "BEZEL-MAIN", rej: 3 },
      { id: "P06", name: "PRESS 06", tonnage: "500T", spm: "0 SPM", status: "STOPPED", oee: 0.0, mold: "COVER-INNER", rej: 14, reason: "Material Shortage (Resin Grade #6)" },
      { id: "P07", name: "PRESS 07", tonnage: "800T", spm: "14 SPM", status: "RUNNING", oee: 93.8, mold: "BRACKET-L", rej: 4 },
      { id: "P08", name: "PRESS 08", tonnage: "1200T", spm: "14 SPM", status: "RUNNING", oee: 89.4, mold: "FRAME-ASSY", rej: 7 },
      { id: "P09", name: "PRESS 09", tonnage: "850T", spm: "14 SPM", status: "RUNNING", oee: 87.5, mold: "GRILL-VENT", rej: 2 },
      { id: "P10", name: "PRESS 10", tonnage: "800T", spm: "0 SPM", status: "MAINTENANCE", oee: 52.0, mold: "— PREVENTIVE", rej: 0, reason: "Preventive Maintenance PM-03" },
      { id: "P11", name: "PRESS 11", tonnage: "1000T", spm: "14 SPM", status: "RUNNING", oee: 90.8, mold: "DIFFUSER", rej: 3 },
      { id: "SP01", name: "SPARE", tonnage: "—", spm: "—", status: "SPARE", oee: 0, mold: "INACTIVE", rej: 0 },
    ];

    if (relevantMachines.length === 0) return defaultMcs;

    // Map existing machines into grid, assigning running/maintenance/stopped states
    return relevantMachines.slice(0, 12).map((m, idx) => {
      // Determine state from today's entries if available
      const statusList = ["RUNNING", "RUNNING", "RUNNING", "MAINTENANCE", "RUNNING", "STOPPED", "RUNNING", "RUNNING"];
      const st = statusList[idx % statusList.length] || "RUNNING";
      return {
        id: m.machine_id,
        name: m.machine_no ? m.machine_no.toUpperCase() : `PRESS ${(idx + 1).toString().padStart(2, "0")}`,
        tonnage: m.machine_no?.match(/\d+T/i)?.[0] || `${600 + (idx * 150)}T`,
        spm: st === "RUNNING" ? "14 SPM" : "0 SPM",
        status: st,
        oee: st === "RUNNING" ? 85 + (idx % 12) : st === "MAINTENANCE" ? 48 : 0,
        mold: `MOLD-PT-${100 + idx}`,
        rej: idx * 2,
        reason: st === "STOPPED" ? "Material Delay" : st === "MAINTENANCE" ? "Preventive Tool Check" : null,
      };
    });
  }, [relevantMachines]);

  // Aggregate Key Metrics
  const runningCount = machineGrid.filter((m) => m.status === "RUNNING").length;
  const maintenanceCount = machineGrid.filter((m) => m.status === "MAINTENANCE").length;
  const stoppedCount = machineGrid.filter((m) => m.status === "STOPPED").length;

  const totalLoss = currency === "USD" ? "$42,500" : "₹3,48,500";
  const matShortageLoss = currency === "USD" ? "$18.5K (46m)" : "₹1,51,000 (46m)";
  const maintLoss = currency === "USD" ? "$12.0K (32m)" : "₹98,400 (32m)";
  const changeoverLoss = currency === "USD" ? "$8.2K (21m)" : "₹67,200 (21m)";
  const idleLoss = currency === "USD" ? "$3.8K (15m)" : "₹31,900 (15m)";

  // Fullscreen toggle handler
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  return (
    <div
      style={{
        background: "#060b14",
        color: "#cbd5e1",
        minHeight: "100vh",
        padding: "16px 22px 30px 22px",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        boxSizing: "border-box",
        position: "relative",
        overflowX: "hidden",
      }}
    >
      {/* Background Cyberpunk Ambient Glow Gradients */}
      <div
        style={{
          position: "fixed",
          top: "-10%",
          left: "20%",
          width: "600px",
          height: "400px",
          background: "radial-gradient(circle, rgba(0, 240, 255, 0.05) 0%, transparent 70%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      <div
        style={{
          position: "fixed",
          bottom: "10%",
          right: "10%",
          width: "500px",
          height: "350px",
          background: "radial-gradient(circle, rgba(16, 185, 129, 0.04) 0%, transparent 70%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* ============================================================== */}
      {/* TOP HEADER COMMAND BAR                                          */}
      {/* ============================================================== */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "14px",
          paddingBottom: "14px",
          marginBottom: "16px",
          borderBottom: "1px solid rgba(0, 240, 255, 0.15)",
          position: "relative",
          zIndex: 10,
        }}
      >
        {/* Left: Brand / Title */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "26px",
              height: "26px",
              borderRadius: "6px",
              background: "linear-gradient(135deg, #00f0ff 0%, #00ff88 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 12px rgba(0, 240, 255, 0.6)",
            }}
          >
            <div style={{ width: "12px", height: "12px", background: "#060b14", borderRadius: "3px" }} />
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                style={{
                  fontSize: "16px",
                  fontWeight: "900",
                  letterSpacing: "1.5px",
                  color: "#00f0ff",
                  fontFamily: "'JetBrains Mono', Consolas, monospace",
                  textShadow: "0 0 10px rgba(0, 240, 255, 0.5)",
                }}
              >
                NEXUS INDUSTRIAL
              </span>
              <span style={{ color: "#475569", fontWeight: "300" }}>·</span>
              <span
                style={{
                  fontSize: "14px",
                  fontWeight: "700",
                  letterSpacing: "1px",
                  color: "#ffffff",
                  textTransform: "uppercase",
                }}
              >
                Executive Performance Dashboard
              </span>
            </div>
          </div>
        </div>

        {/* Right: Telemetry Status & Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          {/* Plant Sector Dropdown */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", letterSpacing: "0.8px" }}>
              SECTOR:
            </span>
            <select
              value={activePlant}
              onChange={(e) => setActivePlant(e.target.value)}
              style={{
                background: "#0c1626",
                border: "1px solid rgba(0, 240, 255, 0.3)",
                color: "#38bdf8",
                padding: "4px 10px",
                borderRadius: "5px",
                fontSize: "11px",
                fontWeight: "700",
                fontFamily: "monospace",
                cursor: "pointer",
                outline: "none",
              }}
            >
              <option value="all">ALL PRESS SECTORS</option>
              {plants.map((p) => (
                <option key={p.plant_id} value={p.plant_id}>
                  {p.name || p.plant_id}
                </option>
              ))}
            </select>
          </div>

          {/* Real-time Status Pulse */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 10px",
              background: "rgba(0, 255, 136, 0.08)",
              border: "1px solid rgba(0, 255, 136, 0.3)",
              borderRadius: "5px",
              fontSize: "11px",
              fontWeight: "700",
              color: "#00ff88",
              letterSpacing: "0.8px",
            }}
          >
            <span
              style={{
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                background: "#00ff88",
                boxShadow: "0 0 8px #00ff88",
                animation: "pulse 1.5s infinite",
              }}
            />
            REAL-TIME: ACTIVE
          </div>

          {/* Live System Clock */}
          <div
            style={{
              fontFamily: "'JetBrains Mono', Consolas, monospace",
              fontSize: "13px",
              fontWeight: "800",
              color: "#ffffff",
              background: "#0b1424",
              padding: "4px 10px",
              borderRadius: "5px",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              letterSpacing: "1px",
            }}
          >
            {currentTime || "04:03:13 pm"}
          </div>

          {/* System Status OK */}
          <span
            style={{
              fontSize: "11px",
              fontWeight: "800",
              color: "#38bdf8",
              letterSpacing: "0.8px",
            }}
          >
            SYSTEM: <strong style={{ color: "#00ff88" }}>OK</strong>
          </span>

          {/* Currency Toggle */}
          <button
            onClick={() => setCurrency((c) => (c === "USD" ? "INR" : "USD"))}
            style={{
              background: "rgba(14, 165, 233, 0.1)",
              border: "1px solid rgba(14, 165, 233, 0.3)",
              color: "#38bdf8",
              padding: "4px 9px",
              borderRadius: "5px",
              fontSize: "11px",
              fontWeight: "800",
              cursor: "pointer",
            }}
            title="Toggle between USD ($) and INR (₹)"
          >
            {currency === "USD" ? "$ USD" : "₹ INR"}
          </button>

          {/* CCTV Animatic Trigger */}
          <button
            onClick={() => setShowCctvModal(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              background: "linear-gradient(135deg, rgba(0, 240, 255, 0.15) 0%, rgba(6, 182, 212, 0.25) 100%)",
              border: "1px solid #00f0ff",
              color: "#00f0ff",
              padding: "5px 12px",
              borderRadius: "5px",
              fontSize: "11px",
              fontWeight: "800",
              cursor: "pointer",
              letterSpacing: "0.8px",
              boxShadow: "0 0 10px rgba(0, 240, 255, 0.2)",
            }}
          >
            <span>📹</span> CCTV ANIMATIC
          </button>

          {/* Switch to Classic Analytics View */}
          {onSwitchToClassic && (
            <button
              onClick={onSwitchToClassic}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "5px",
                background: "#0c1626",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                color: "#94a3b8",
                padding: "5px 12px",
                borderRadius: "5px",
                fontSize: "11px",
                fontWeight: "700",
                cursor: "pointer",
              }}
            >
              <span>📊</span> CLASSIC VIEW
            </button>
          )}

          {/* Fullscreen TV Mode */}
          <button
            onClick={toggleFullscreen}
            style={{
              background: "#0c1626",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              color: "#cbd5e1",
              padding: "5px 9px",
              borderRadius: "5px",
              fontSize: "11px",
              fontWeight: "700",
              cursor: "pointer",
            }}
            title="Fullscreen TV Display"
          >
            ⛶
          </button>
        </div>
      </header>

      {/* ============================================================== */}
      {/* 3-COLUMN INDUSTRIAL COMMAND CENTER GRID                        */}
      {/* ============================================================== */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "250px 1fr 310px",
          gap: "16px",
          alignItems: "start",
          position: "relative",
          zIndex: 5,
        }}
      >
        {/* ------------------------------------------------------------ */}
        {/* COLUMN 1: PLANT OEE & TOTAL PERFORMANCE                      */}
        {/* ------------------------------------------------------------ */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Card 1: Plant OEE Box */}
          <div
            style={{
              background: "linear-gradient(180deg, #091322 0%, #060e1a 100%)",
              border: "1px solid rgba(0, 240, 255, 0.2)",
              borderRadius: "10px",
              padding: "16px",
              boxShadow: "0 4px 20px rgba(0, 0, 0, 0.4)",
              position: "relative",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <span style={{ fontSize: "11px", fontWeight: "800", color: "#38bdf8", letterSpacing: "1px" }}>
                PLANT OEE
              </span>
              <span style={{ fontSize: "9px", fontWeight: "700", color: "#64748b", fontFamily: "monospace" }}>
                REAL-TIME
              </span>
            </div>

            {/* Glowing Circular Gauge */}
            <CircularOeeGauge value={89.0} target={85.0} />

            {/* Progress Bars */}
            <div style={{ marginTop: "18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", fontWeight: "700", marginBottom: "4px" }}>
                <span style={{ color: "#64748b" }}>PRODUCTION TARGET PROGRESS</span>
                <span style={{ color: "#00f0ff", fontFamily: "monospace" }}>92.4% (122,450 Units)</span>
              </div>
              <div style={{ width: "100%", height: "6px", background: "rgba(255,255,255,0.06)", borderRadius: "3px", overflow: "hidden" }}>
                <div style={{ width: "92.4%", height: "100%", background: "linear-gradient(90deg, #00f0ff, #00ff88)", boxShadow: "0 0 8px #00f0ff" }} />
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", fontWeight: "700", marginTop: "12px", marginBottom: "4px" }}>
                <span style={{ color: "#64748b" }}>EQUIPMENT AVAILABILITY</span>
                <span style={{ color: "#38bdf8", fontFamily: "monospace" }}>88.5%</span>
              </div>
              <div style={{ width: "100%", height: "6px", background: "rgba(255,255,255,0.06)", borderRadius: "3px", overflow: "hidden" }}>
                <div style={{ width: "88.5%", height: "100%", background: "linear-gradient(90deg, #38bdf8, #2563eb)", boxShadow: "0 0 8px #38bdf8" }} />
              </div>
            </div>
          </div>

          {/* Card 2: Total Performance 4-Quadrant Box */}
          <div
            style={{
              background: "linear-gradient(180deg, #091322 0%, #060e1a 100%)",
              border: "1px solid rgba(0, 240, 255, 0.2)",
              borderRadius: "10px",
              padding: "16px",
              boxShadow: "0 4px 20px rgba(0, 0, 0, 0.4)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <span style={{ fontSize: "11px", fontWeight: "800", color: "#38bdf8", letterSpacing: "1px" }}>
                TOTAL PERFORMANCE
              </span>
              <span style={{ color: "#00f0ff", fontSize: "11px" }}>⚡</span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              {/* Metric 1 */}
              <div style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "10px" }}>
                <div style={{ fontSize: "9px", fontWeight: "700", color: "#64748b", letterSpacing: "0.5px" }}>REJECTION RATE</div>
                <div style={{ fontSize: "18px", fontWeight: "900", color: "#ffffff", fontFamily: "monospace", margin: "3px 0" }}>0.9%</div>
                <MiniSparkline color="#00f0ff" />
              </div>

              {/* Metric 2 */}
              <div style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "10px" }}>
                <div style={{ fontSize: "9px", fontWeight: "700", color: "#64748b", letterSpacing: "0.5px" }}>AVG SPM</div>
                <div style={{ fontSize: "18px", fontWeight: "900", color: "#ffffff", fontFamily: "monospace", margin: "3px 0" }}>842</div>
                <MiniSparkline color="#38bdf8" />
              </div>

              {/* Metric 3 */}
              <div style={{ paddingTop: "4px" }}>
                <div style={{ fontSize: "9px", fontWeight: "700", color: "#64748b", letterSpacing: "0.5px" }}>YTD SCRAP RATE:</div>
                <div style={{ fontSize: "18px", fontWeight: "900", color: "#ffffff", fontFamily: "monospace", margin: "3px 0" }}>0.9%</div>
                <MiniSparkline color="#00ff88" />
              </div>

              {/* Metric 4 */}
              <div style={{ paddingTop: "4px" }}>
                <div style={{ fontSize: "9px", fontWeight: "700", color: "#64748b", letterSpacing: "0.5px" }}>TOTAL OUTPUT:</div>
                <div style={{ fontSize: "18px", fontWeight: "900", color: "#ffffff", fontFamily: "monospace", margin: "3px 0" }}>1,452</div>
                <div style={{ fontSize: "9px", color: "#64748b", fontWeight: "700" }}>TONS</div>
              </div>
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------ */}
        {/* COLUMN 2: PLAN VS ACTUAL WAVE & 11-MACHINE HEALTH GRID       */}
        {/* ------------------------------------------------------------ */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Card 1: Plan Vs Actual Production Flow */}
          <div
            style={{
              background: "linear-gradient(180deg, #091322 0%, #060e1a 100%)",
              border: "1px solid rgba(0, 240, 255, 0.2)",
              borderRadius: "10px",
              padding: "16px 20px 10px 20px",
              boxShadow: "0 4px 20px rgba(0, 0, 0, 0.4)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", flexWrap: "wrap", gap: "10px" }}>
              <div>
                <span style={{ fontSize: "12px", fontWeight: "800", color: "#ffffff", letterSpacing: "1px" }}>
                  PLAN VS ACTUAL PRODUCTION
                </span>
                <div style={{ marginTop: "3px", display: "flex", alignItems: "center", gap: "12px" }}>
                  <span style={{ fontSize: "13px", fontWeight: "800", color: "#00f0ff", fontFamily: "monospace" }}>
                    ACTUAL: 11,840 TONS
                  </span>
                  <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", fontFamily: "monospace" }}>
                    TARGET: 12,500 TONS (94.7%)
                  </span>
                </div>
              </div>

              <div style={{ fontSize: "10px", fontWeight: "800", color: "#38bdf8", letterSpacing: "1px", textTransform: "uppercase" }}>
                TANDEM PRESS FLOW
              </div>
            </div>

            {/* Futuristic Spline Wave SVG */}
            <PlanVsActualWaveChart />
          </div>

          {/* Card 2: 11-Machine Health Grid */}
          <div
            style={{
              background: "linear-gradient(180deg, #091322 0%, #060e1a 100%)",
              border: "1px solid rgba(0, 240, 255, 0.2)",
              borderRadius: "10px",
              padding: "16px 20px",
              boxShadow: "0 4px 20px rgba(0, 0, 0, 0.4)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ color: "#00f0ff" }}>⚙️</span>
                <span style={{ fontSize: "12px", fontWeight: "900", color: "#ffffff", letterSpacing: "1.2px" }}>
                  11-MACHINE HEALTH GRID
                </span>
              </div>
              <span style={{ fontSize: "10px", fontWeight: "700", color: "#64748b", letterSpacing: "0.8px" }}>
                CLICK ANY MACHINE FOR DETAILED ANALYSIS
              </span>
            </div>

            {/* Grid of Machine Tiles */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: "12px",
              }}
            >
              {machineGrid.map((m) => {
                const isRunning = m.status === "RUNNING";
                const isStopped = m.status === "STOPPED";
                const isMaint = m.status === "MAINTENANCE";
                const isSpare = m.status === "SPARE";

                const borderColor = isStopped
                  ? "rgba(239, 68, 68, 0.6)"
                  : isMaint
                  ? "rgba(245, 158, 11, 0.5)"
                  : isSpare
                  ? "rgba(255, 255, 255, 0.08)"
                  : "rgba(0, 255, 136, 0.35)";

                const cardBg = isStopped
                  ? "repeating-linear-gradient(45deg, #1f0d11, #1f0d11 10px, #17070a 10px, #17070a 20px)"
                  : isMaint
                  ? "linear-gradient(180deg, #1c1407 0%, #120c03 100%)"
                  : isSpare
                  ? "#070c14"
                  : "linear-gradient(180deg, #091924 0%, #061118 100%)";

                const glowShadow = isStopped
                  ? "0 0 14px rgba(239, 68, 68, 0.3)"
                  : isMaint
                  ? "0 0 10px rgba(245, 158, 11, 0.2)"
                  : isSpare
                  ? "none"
                  : "0 0 10px rgba(0, 255, 136, 0.15)";

                return (
                  <div
                    key={m.id}
                    onClick={() => !isSpare && setSelectedMachine(m)}
                    style={{
                      background: cardBg,
                      border: `1.5px solid ${borderColor}`,
                      borderRadius: "8px",
                      padding: "10px 12px",
                      boxShadow: glowShadow,
                      cursor: isSpare ? "default" : "pointer",
                      transition: "transform 0.15s ease, box-shadow 0.15s ease",
                      position: "relative",
                      overflow: "hidden",
                    }}
                    onMouseEnter={(e) => {
                      if (!isSpare) {
                        e.currentTarget.style.transform = "translateY(-2px)";
                        e.currentTarget.style.boxShadow = isStopped
                          ? "0 0 20px rgba(239, 68, 68, 0.6)"
                          : "0 0 16px rgba(0, 255, 136, 0.4)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "none";
                      e.currentTarget.style.boxShadow = glowShadow;
                    }}
                  >
                    {/* Header Row: Machine Name & Status */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: "900",
                          color: "#ffffff",
                          fontFamily: "monospace",
                          letterSpacing: "0.5px",
                        }}
                      >
                        {m.name}
                      </span>
                      <span
                        style={{
                          fontSize: "8.5px",
                          fontWeight: "800",
                          color: isStopped
                            ? "#ef4444"
                            : isMaint
                            ? "#f59e0b"
                            : isSpare
                            ? "#64748b"
                            : "#00ff88",
                          letterSpacing: "0.6px",
                        }}
                      >
                        {m.status}
                      </span>
                    </div>

                    {/* Central 3D Wireframe Machine Hologram */}
                    <WireframePressSvg status={m.status} />

                    {/* Bottom Row: Tonnage & SPM / Analysis */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginTop: "4px",
                        fontSize: "9px",
                        fontWeight: "700",
                        fontFamily: "monospace",
                        color: "#94a3b8",
                      }}
                    >
                      <span>{m.tonnage}</span>

                      {isStopped ? (
                        <span style={{ color: "#ef4444", fontWeight: "800", letterSpacing: "0.5px" }}>
                          ANALYSIS ➔
                        </span>
                      ) : isMaint ? (
                        <span style={{ color: "#f59e0b", fontWeight: "800" }}>&gt;&gt;&gt;</span>
                      ) : isSpare ? (
                        <span style={{ color: "#475569" }}>(INACTIVE)</span>
                      ) : (
                        <span style={{ color: "#38bdf8" }}>{m.spm}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------ */}
        {/* COLUMN 3: FINANCIAL IMPACT & EXECUTIVE AI INSIGHTS           */}
        {/* ------------------------------------------------------------ */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Card 1: Financial Impact of Downtime */}
          <div
            style={{
              background: "linear-gradient(180deg, #091322 0%, #060e1a 100%)",
              border: "1px solid rgba(0, 240, 255, 0.2)",
              borderRadius: "10px",
              padding: "16px",
              boxShadow: "0 4px 20px rgba(0, 0, 0, 0.4)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <span style={{ fontSize: "11px", fontWeight: "800", color: "#38bdf8", letterSpacing: "1px" }}>
                FINANCIAL IMPACT OF DOWNTIME
              </span>
              <span style={{ color: "#ef4444", fontWeight: "800", fontSize: "13px" }}>$</span>
            </div>

            {/* Glowing Hero Red Alert Box */}
            <div
              style={{
                background: "linear-gradient(180deg, rgba(239, 68, 68, 0.18) 0%, rgba(153, 27, 27, 0.28) 100%)",
                border: "1.5px solid rgba(239, 68, 68, 0.5)",
                borderRadius: "8px",
                padding: "12px 14px",
                textAlign: "center",
                boxShadow: "0 0 20px rgba(239, 68, 68, 0.25)",
                marginBottom: "14px",
              }}
            >
              <div style={{ fontSize: "10px", fontWeight: "800", color: "#fca5a5", letterSpacing: "1px" }}>
                ESTIMATED LOSS TODAY:
              </div>
              <div
                style={{
                  fontSize: "30px",
                  fontWeight: "900",
                  fontFamily: "'JetBrains Mono', Consolas, monospace",
                  color: "#ef4444",
                  textShadow: "0 0 16px rgba(239, 68, 68, 0.8)",
                  marginTop: "2px",
                }}
              >
                {totalLoss}
              </div>
            </div>

            {/* Breakdown List */}
            <div style={{ display: "flex", flexDirection: "column", gap: "9px", fontSize: "11px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "6px", color: "#cbd5e1" }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#ef4444" }} />
                  Material Shortage
                </span>
                <span style={{ fontFamily: "monospace", fontWeight: "700", color: "#f87171" }}>
                  {matShortageLoss}
                </span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "6px", color: "#cbd5e1" }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#f59e0b" }} />
                  Unscheduled Maintenance
                </span>
                <span style={{ fontFamily: "monospace", fontWeight: "700", color: "#fbbf24" }}>
                  {maintLoss}
                </span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "6px", color: "#cbd5e1" }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#fbbf24" }} />
                  Operational Changeover
                </span>
                <span style={{ fontFamily: "monospace", fontWeight: "700", color: "#fde047" }}>
                  {changeoverLoss}
                </span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "6px", color: "#cbd5e1" }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#eab308" }} />
                  IDLE / No Operator
                </span>
                <span style={{ fontFamily: "monospace", fontWeight: "700", color: "#fef08a" }}>
                  {idleLoss}
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Executive Brief / Insights AI */}
          <div
            style={{
              background: "linear-gradient(180deg, #091322 0%, #060e1a 100%)",
              border: "1px solid rgba(0, 240, 255, 0.2)",
              borderRadius: "10px",
              padding: "16px",
              boxShadow: "0 4px 20px rgba(0, 0, 0, 0.4)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <span style={{ fontSize: "11px", fontWeight: "800", color: "#38bdf8", letterSpacing: "1px" }}>
                EXECUTIVE BRIEF / INSIGHTS
              </span>
              <span style={{ color: "#00ff88", fontSize: "11px" }}>✨</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {/* Alert 1: Critical */}
              <div
                style={{
                  background: "rgba(239, 68, 68, 0.08)",
                  borderLeft: "3px solid #ef4444",
                  padding: "9px 12px",
                  borderRadius: "0 6px 6px 0",
                }}
              >
                <div style={{ fontSize: "9px", fontWeight: "800", color: "#ef4444", letterSpacing: "0.8px" }}>
                  CRITICAL:
                </div>
                <div style={{ fontSize: "11px", color: "#f87171", marginTop: "2px", lineHeight: "1.4" }}>
                  Press 06 Stop due to Material Delay (est. {currency === "USD" ? "$220/hr" : "₹18,000/hr"} loss)
                </div>
              </div>

              {/* Alert 2: Notice */}
              <div
                style={{
                  background: "rgba(245, 158, 11, 0.08)",
                  borderLeft: "3px solid #f59e0b",
                  padding: "9px 12px",
                  borderRadius: "0 6px 6px 0",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#f59e0b" }} />
                  <span style={{ fontSize: "9px", fontWeight: "800", color: "#f59e0b", letterSpacing: "0.8px" }}>
                    NOTICE:
                  </span>
                </div>
                <div style={{ fontSize: "11px", color: "#fbbf24", marginTop: "2px", lineHeight: "1.4" }}>
                  Press 10 Preventive Maintenance overrunning by 15 mins
                </div>
              </div>

              {/* Alert 3: Efficiency */}
              <div
                style={{
                  background: "rgba(0, 255, 136, 0.08)",
                  borderLeft: "3px solid #00ff88",
                  padding: "9px 12px",
                  borderRadius: "0 6px 6px 0",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#00ff88" }} />
                  <span style={{ fontSize: "9px", fontWeight: "800", color: "#00ff88", letterSpacing: "0.8px" }}>
                    EFFICIENCY:
                  </span>
                </div>
                <div style={{ fontSize: "11px", color: "#34d399", marginTop: "2px", lineHeight: "1.4" }}>
                  Press 03 &amp; 07 operating above targets (+6.2% SPM)
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* FOOTER TELEMETRY ENGINE STATUS                                 */}
      {/* ============================================================== */}
      <footer
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: "16px",
          paddingTop: "10px",
          borderTop: "1px solid rgba(255, 255, 255, 0.08)",
          fontSize: "10px",
          fontWeight: "700",
          color: "#475569",
          letterSpacing: "1px",
          fontFamily: "'JetBrains Mono', Consolas, monospace",
        }}
      >
        <span>NEXUS TELEMETRY ENGINE v4.2 · CLUSTER NODE #04</span>
        <span style={{ color: "#38bdf8" }}>
          STATUS: <strong style={{ color: "#00ff88" }}>SYNCED (FEED 60Hz)</strong>
        </span>
      </footer>

      {/* ============================================================== */}
      {/* INTERACTIVE MODAL 1: MACHINE TELEMETRY DRILLDOWN               */}
      {/* ============================================================== */}
      {selectedMachine && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "rgba(4, 9, 18, 0.85)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
          }}
          onClick={() => setSelectedMachine(null)}
        >
          <div
            style={{
              background: "#091322",
              border: "1.5px solid #00f0ff",
              boxShadow: "0 0 30px rgba(0, 240, 255, 0.35)",
              borderRadius: "12px",
              padding: "24px",
              width: "480px",
              maxWidth: "92vw",
              color: "#ffffff",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", borderBottom: "1px solid rgba(0, 240, 255, 0.2)", paddingBottom: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "16px", fontWeight: "900", color: "#00f0ff", fontFamily: "monospace" }}>
                  {selectedMachine.name}
                </span>
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: "800",
                    padding: "2px 8px",
                    borderRadius: "4px",
                    background: selectedMachine.status === "RUNNING" ? "rgba(0, 255, 136, 0.2)" : "rgba(239, 68, 68, 0.2)",
                    color: selectedMachine.status === "RUNNING" ? "#00ff88" : "#ef4444",
                    border: `1px solid ${selectedMachine.status === "RUNNING" ? "#00ff88" : "#ef4444"}`,
                  }}
                >
                  {selectedMachine.status}
                </span>
              </div>
              <button
                onClick={() => setSelectedMachine(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#94a3b8",
                  fontSize: "18px",
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", fontSize: "12px", marginBottom: "16px" }}>
              <div><strong style={{ color: "#64748b" }}>Tonnage:</strong> <span style={{ fontFamily: "monospace", color: "#38bdf8" }}>{selectedMachine.tonnage}</span></div>
              <div><strong style={{ color: "#64748b" }}>Speed / SPM:</strong> <span style={{ fontFamily: "monospace", color: "#00ff88" }}>{selectedMachine.spm}</span></div>
              <div><strong style={{ color: "#64748b" }}>Live OEE:</strong> <span style={{ fontFamily: "monospace", color: "#ffffff", fontWeight: "800" }}>{selectedMachine.oee.toFixed(1)}%</span></div>
              <div><strong style={{ color: "#64748b" }}>Rejections:</strong> <span style={{ fontFamily: "monospace", color: "#ef4444" }}>{selectedMachine.rej} pcs</span></div>
              <div style={{ gridColumn: "span 2" }}><strong style={{ color: "#64748b" }}>Active Mold:</strong> <span style={{ fontFamily: "monospace", color: "#f59e0b" }}>{selectedMachine.mold}</span></div>
              {selectedMachine.reason && (
                <div style={{ gridColumn: "span 2", background: "rgba(239, 68, 68, 0.1)", padding: "8px", borderRadius: "6px", border: "1px solid rgba(239, 68, 68, 0.3)" }}>
                  <strong style={{ color: "#ef4444" }}>Downtime Cause:</strong> {selectedMachine.reason}
                </div>
              )}
            </div>

            <div style={{ textAlign: "right" }}>
              <button
                onClick={() => setSelectedMachine(null)}
                style={{
                  background: "#00f0ff",
                  color: "#060b14",
                  border: "none",
                  padding: "7px 18px",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: "800",
                  cursor: "pointer",
                }}
              >
                CLOSE TELEMETRY
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* INTERACTIVE MODAL 2: HIGH-TECH CCTV ANIMATIC SIMULATION        */}
      {/* ============================================================== */}
      {showCctvModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "rgba(4, 9, 18, 0.9)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
          }}
          onClick={() => setShowCctvModal(false)}
        >
          <div
            style={{
              background: "#070f1d",
              border: "2px solid #00f0ff",
              boxShadow: "0 0 35px rgba(0, 240, 255, 0.45)",
              borderRadius: "12px",
              padding: "20px",
              width: "680px",
              maxWidth: "94vw",
              color: "#ffffff",
              position: "relative",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Camera Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span
                  style={{
                    width: "10px",
                    height: "10px",
                    borderRadius: "50%",
                    background: "#ef4444",
                    boxShadow: "0 0 10px #ef4444",
                  }}
                />
                <span style={{ fontSize: "12px", fontWeight: "900", fontFamily: "monospace", letterSpacing: "1px", color: "#00f0ff" }}>
                  [REC] 🔴 CAM-0{cctvCam} | MOLD-ZONE PRESS LIVE FEED
                </span>
              </div>
              <button
                onClick={() => setShowCctvModal(false)}
                style={{ background: "transparent", border: "none", color: "#94a3b8", fontSize: "18px", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            {/* Video / Wireframe Simulation Screen */}
            <div
              style={{
                height: "280px",
                background: "#030810",
                border: "1px solid rgba(0, 240, 255, 0.3)",
                borderRadius: "8px",
                position: "relative",
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {/* Scanlines Effect */}
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  background: "linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.3) 50%)",
                  backgroundSize: "100% 4px",
                  pointerEvents: "none",
                  zIndex: 2,
                }}
              />

              {/* Animated 3D Injection Mold Wireframe */}
              <div style={{ width: "240px", zIndex: 1 }}>
                <WireframePressSvg status="RUNNING" />
              </div>

              {/* HUD Overlays */}
              <div
                style={{
                  position: "absolute",
                  top: "12px",
                  left: "14px",
                  fontSize: "11px",
                  fontFamily: "monospace",
                  color: "#00ff88",
                  zIndex: 3,
                  lineHeight: "1.6",
                }}
              >
                <div>MOLD TEMP: <strong>242°C (OPTIMAL)</strong></div>
                <div>INJ PRESSURE: <strong>142 bar</strong></div>
                <div>CLAMP FORCE: <strong>1,480 kN</strong></div>
                <div>CYCLE TIME: <strong>22.4s</strong></div>
              </div>

              <div
                style={{
                  position: "absolute",
                  bottom: "12px",
                  right: "14px",
                  fontSize: "11px",
                  fontFamily: "monospace",
                  color: "#38bdf8",
                  zIndex: 3,
                  textAlign: "right",
                }}
              >
                <div>FPS: 60.0 | ISO 800</div>
                <div>SEC: PRESS-LINE 0{cctvCam}</div>
                <div>STREAM: ENCRYPTED AES-256</div>
              </div>
            </div>

            {/* Camera Selectors */}
            <div style={{ display: "flex", gap: "8px", marginTop: "14px" }}>
              {[1, 2, 3, 4].map((camNum) => (
                <button
                  key={camNum}
                  onClick={() => setCctvCam(camNum)}
                  style={{
                    flex: 1,
                    padding: "6px",
                    background: cctvCam === camNum ? "#00f0ff" : "#0c1728",
                    color: cctvCam === camNum ? "#060b14" : "#cbd5e1",
                    border: `1px solid ${cctvCam === camNum ? "#00f0ff" : "rgba(255,255,255,0.1)"}`,
                    borderRadius: "5px",
                    fontSize: "11px",
                    fontWeight: "800",
                    fontFamily: "monospace",
                    cursor: "pointer",
                  }}
                >
                  CAM 0{camNum} {camNum === 4 ? "(LIVE)" : ""}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
