import React, { useState } from "react";
import NexusIndustrialDashboard from "./NexusIndustrialDashboard.jsx";
import MoldsenseDashboard from "./MoldsenseDashboard.jsx";

export default function Dashboard(props) {
  // Default to the flagship futuristic Nexus Industrial Command Center view
  const [viewMode, setViewMode] = useState("nexus"); // "nexus" | "classic"

  if (viewMode === "nexus") {
    return (
      <NexusIndustrialDashboard
        {...props}
        onSwitchToClassic={() => setViewMode("classic")}
      />
    );
  }

  return (
    <div>
      {/* Switcher Bar on Top of Classic View */}
      <div
        style={{
          background: "#0c1626",
          padding: "8px 16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid rgba(0, 240, 255, 0.2)",
          marginBottom: "12px",
        }}
      >
        <span style={{ fontSize: "12px", fontWeight: "700", color: "#94a3b8" }}>
          Viewing: <strong style={{ color: "#ffffff" }}>Classic Analytics View</strong>
        </span>
        <button
          onClick={() => setViewMode("nexus")}
          style={{
            background: "linear-gradient(135deg, #00f0ff 0%, #00ff88 100%)",
            color: "#060b14",
            border: "none",
            padding: "5px 14px",
            borderRadius: "6px",
            fontSize: "11px",
            fontWeight: "900",
            letterSpacing: "0.8px",
            cursor: "pointer",
            boxShadow: "0 0 12px rgba(0, 240, 255, 0.5)",
          }}
        >
          ⚡ SWITCH TO NEXUS COMMAND CENTER
        </button>
      </div>

      <MoldsenseDashboard {...props} />
    </div>
  );
}
