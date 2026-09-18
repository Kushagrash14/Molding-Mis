import { useEffect, useState, useMemo } from "react";
import { USERS } from "../data/seedData.js";
import { getActiveShift, getProductionShiftDate, formatShiftDateDisplay } from "../lib/calculations.js";

const ICONS = {
  entry: "✍️",
  mine: "📋",
  browse: "🏭",
  all: "📑",
  master: "⚙️",
  dashboard: "📊",
  audit: "🛡️",
};

function getInitials(name = "") {
  if (!name) return "PG";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function TopBar({
  currentUser,
  onLogout,
  role,
  onRunLockJob,
  shifts = [],
  locations = [],
  plants = [],
  selectedPlantId,
  onPlantChange,
  userId,
  tabs = [],
  activeTab = "entry",
  onTabChange = () => {},
}) {
  const activeUser = currentUser || USERS.find((u) => u.id === userId) || USERS[0];
  const userRole = role || activeUser.role;
  const [timeStr, setTimeStr] = useState("");

  const activeShift = useMemo(() => getActiveShift(shifts), [shifts]);
  const prodDate = useMemo(() => getProductionShiftDate(shifts), [shifts]);

  const activePlant = plants.find((p) => p.plant_id === selectedPlantId) || plants[0] || {};
  const activeLocation =
    locations.find((l) => l.location_id === activePlant.location_id) || {};

  useEffect(() => {
    function updateClock() {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        })
      );
    }
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="topbar">
      <div className="brand">
        <div className="logo-container">
          <img
            src="/pg-logo.png"
            alt="PG Logo"
            className="pg-brand-logo"
            onError={(e) => {
              e.currentTarget.src = "/logo.png";
            }}
          />
        </div>
        <div className="brand-divider" />
        <div className="brand-text">
          <div className="brand-header-row">
            <div className="brand-feature-pill title-pill">
              <span className="pill-accent-bar purple" />
              <span className="pill-text-title">MoldSense-Manual MIS</span>
            </div>
          </div>
        </div>

        {/* Vertical Divider line in front of MoldSense MIS */}
        {tabs.length > 0 && <div className="brand-divider" />}

        {/* Top Navigation Tabs */}
        {tabs.length > 0 && (
          <nav className="topbar-nav-tabs">
            {tabs.map(([key, label]) => {
              const icon = ICONS[key] || "📌";
              const isActive = activeTab === key;
              return (
                <button
                  key={key}
                  type="button"
                  className={`topbar-tab-btn ${isActive ? "active" : ""}`}
                  onClick={() => onTabChange(key)}
                >
                  <span className="topbar-tab-icon">{icon}</span>
                  <span className="topbar-tab-label">{label}</span>
                </button>
              );
            })}
          </nav>
        )}
      </div>

      <div className="topbar-controls">
        {/* Plant Badge or Switcher */}
        {plants.length === 1 ? (
          <div
            className="topbar-chip"
            title={`Assigned to ${activePlant.name || "this unit"}`}
          >
            <span className="chip-icon">🏭</span>
            <span className="chip-text">{activePlant.name}</span>
          </div>
        ) : plants.length > 1 && onPlantChange ? (
          <div className="topbar-chip">
            <span className="chip-icon">🏭</span>
            <select
              className="topbar-chip-select"
              value={selectedPlantId}
              onChange={(e) => onPlantChange(e.target.value)}
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
        ) : null}

        {/* Unified Live Shift & Telemetry Cockpit Bar */}
        <div className="topbar-telemetry-bar">
          <div className="telemetry-shift-item">
            <span className="live-dot" />
            <span className="telemetry-shift-name">
              {activeShift?.name || `Shift ${activeShift?.shift_id || "1"}`}
            </span>
            <span className="telemetry-shift-time">
              {activeShift?.start_time && activeShift?.end_time
                ? `${activeShift.start_time}–${activeShift.end_time}`
                : "07:00–19:00"}
            </span>
          </div>

          <span className="telemetry-pipe" />

          <div className="telemetry-date-item">
            <span className="telemetry-date-label">Today</span>
            <span className="telemetry-date-text">{formatShiftDateDisplay(prodDate)}</span>
          </div>

          <span className="telemetry-pipe" />

          <div className="telemetry-clock-item">
            <span className="telemetry-clock-text">{timeStr}</span>
          </div>
        </div>

        {/* Compact User Profile Badge */}
        <div className="topbar-user-group">
          <div
            className="topbar-user-pill"
            title={`${activeUser.name} (${activeUser.email || activeUser.employee_code || ""})`}
          >
            <div className="user-avatar-badge">
              {getInitials(activeUser.name)}
            </div>
            <div className="user-text-block">
              <span className="user-display-name">{activeUser.name}</span>
              <span className={`role-pill role-${userRole}`}>
                {userRole?.toUpperCase()}
              </span>
            </div>
          </div>

          {onLogout && (
            <button
              type="button"
              className="topbar-signout-btn"
              onClick={onLogout}
              title="Sign out"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span>Sign Out</span>
            </button>
          )}
        </div>

        {role === "admin" && (
          <button
            className="btn-lock-job"
            onClick={onRunLockJob}
            title="Simulate shift cutoff auto-locking cron job"
          >
            🔒 Shift Cutoff Lock
          </button>
        )}
      </div>
    </header>
  );
}
