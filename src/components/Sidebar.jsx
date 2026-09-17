const ICONS = {
  entry: "✍️",
  mine: "📋",
  browse: "🏭",
  all: "📑",
  master: "⚙️",
  dashboard: "📊",
  audit: "🛡️",
};

export default function Sidebar({ tabs, activeTab, onTabChange, currentUser }) {
  return (
    <aside className="sidebar">
      <div className="nav-group-title">MENU NAVIGATION</div>
      <nav className="tab-list">
        {tabs.map(([key, label]) => {
          const icon = ICONS[key] || "📌";
          const isActive = activeTab === key;
          return (
            <button
              key={key}
              className={`tab-btn ${isActive ? "active" : ""}`}
              onClick={() => onTabChange(key)}
            >
              <span className="tab-icon">{icon}</span>
              <span className="tab-label">{label}</span>
              {isActive && <span className="tab-indicator"></span>}
            </button>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="user-card">
          <div className="user-avatar">
            {currentUser.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </div>
          <div className="user-info">
            <div className="user-name">{currentUser.name}</div>
            <div className="user-role-badge">
              {currentUser.role === "admin" ? "Plant Admin" : currentUser.role === "supervisor" ? "Shift Incharge" : "Machine Operator"}
            </div>
          </div>
        </div>
        <div className="plant-info-box">
          <div><strong>Plant:</strong> PGEL Greater Noida</div>
          <div><strong>Unit:</strong> Plastic Injection Molding</div>
        </div>
      </div>
    </aside>
  );
}

