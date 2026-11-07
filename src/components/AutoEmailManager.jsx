import { useEffect, useState, useMemo } from "react";

const PRESET_TIMES = [
  { label: "07:00 (Shift 1 End)", value: "07:00" },
  { label: "08:00 (Shift A / Morning)", value: "08:00" },
  { label: "19:00 (Shift 2 End)", value: "19:00" },
  { label: "20:00 (Shift B / Evening)", value: "20:00" },
  { label: "09:00 (Management)", value: "09:00" },
];

const PERIOD_OPTIONS = [
  { value: "yesterday", label: "Yesterday / Previous Day (Recommended for Morning Digest)" },
  { value: "latest_day", label: "Latest Production Day (Most Recent Shifts)" },
  { value: "mtd", label: "Current Month to Date (Full Cumulative Cycle Time Tracker)" },
  { value: "today", label: "Today (Current In-Progress Shifts)" },
  { value: "last7days", label: "Last 7 Days (Rolling Summary)" },
];

const PLANT_ORDER = {
  "2020": 1, // PGTL
  "4010": 2, // NGM
  "1040": 3, // PGEL
  "2060": 4, // DMIC
  "PLANT-U04": 5,
  "4020": 6,
};

const THRESHOLDS = [105, 110, 120, 150];
const MIN_HOURS = [0, 2, 8, 24];

function parseEmails(str) {
  if (!str) return [];
  if (Array.isArray(str)) return str.filter(Boolean);
  return str
    .split(/[\s,;\n]+/)
    .map((s) => s.trim())
    .filter((s) => s && s.includes("@"));
}

function fmtDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function AutoEmailManager({
  plants = [],
  currentUser = null,
}) {
  const [activeSubTab, setActiveSubTab] = useState("settings"); // "settings" | "preview" | "logs"
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState(null); // { type: 'success' | 'error', text: '' }

  // Configuration state
  const [config, setConfig] = useState({
    enabled: false,
    scheduleTime: "08:00",
    recipientsTo: [],
    recipientsCc: [],
    recipientsBcc: [],
    selectedPlants: ["2020", "4010", "1040", "2060"],
    subject: "Daily Cycle Time Tracker Report - [DATE]",
    bodyIntro:
      "Dear Team,\n\nPlease find the automated Cycle Time Tracker daily report and visual snapshots for the selected production plants attached below.\n\nKindly review any over-cycle deviations and slow molds for process optimization.",
    period: "yesterday",
    threshold: 110,
    minHours: 2,
    includePhotoAttachment: true,
    lastSentAt: null,
    lastStatus: null,
    lastError: null,
  });

  // String representations for textareas
  const [toInput, setToInput] = useState("");
  const [ccInput, setCcInput] = useState("");
  const [bccInput, setBccInput] = useState("");

  // Test send dialog state
  const [showTestModal, setShowTestModal] = useState(false);
  const [testEmailTo, setTestEmailTo] = useState("");
  const [testSendResult, setTestSendResult] = useState(null);

  // Preview state
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [activePreviewPlant, setActivePreviewPlant] = useState(null);

  // Logs state
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Load config on mount
  useEffect(() => {
    loadConfig();
    loadLogs();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auto-email/config");
      const data = await res.json();
      if (data?.success && data.config) {
        setConfig(data.config);
        setToInput((data.config.recipientsTo || []).join(", "));
        setCcInput((data.config.recipientsCc || []).join(", "));
        setBccInput((data.config.recipientsBcc || []).join(", "));
        if (currentUser?.email && !testEmailTo) {
          setTestEmailTo(currentUser.email);
        }
      }
    } catch (err) {
      console.error("Failed to load auto-email config:", err);
      setMessage({ type: "error", text: "Failed to load configuration from server." });
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = async () => {
    setLogsLoading(true);
    try {
      const res = await fetch("/api/auto-email/logs");
      const data = await res.json();
      if (data?.success) {
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.error("Failed to load email logs:", err);
    } finally {
      setLogsLoading(false);
    }
  };

  const loadPreview = async () => {
    setPreviewLoading(true);
    try {
      const plantList = (config.selectedPlants || []).join(",");
      const query = new URLSearchParams({
        period: config.period || "yesterday",
        threshold: String(config.threshold || 110),
        minHours: String(config.minHours ?? 2),
        plants: plantList,
      });
      const res = await fetch(`/api/auto-email/preview?${query.toString()}`);
      const data = await res.json();
      if (data?.success) {
        setPreviewData(data);
        if (data.plantReports?.length > 0 && !activePreviewPlant) {
          setActivePreviewPlant(data.plantReports[0].plantId);
        }
      }
    } catch (err) {
      console.error("Failed to load preview:", err);
    } finally {
      setPreviewLoading(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === "preview") {
      loadPreview();
    } else if (activeSubTab === "logs") {
      loadLogs();
    }
  }, [activeSubTab]);

  const handleSave = async (overrideProps = {}) => {
    setSaving(true);
    setMessage(null);
    try {
      const recipientsTo = parseEmails(toInput);
      const recipientsCc = parseEmails(ccInput);
      const recipientsBcc = parseEmails(bccInput);

      const nextConfig = {
        ...config,
        recipientsTo,
        recipientsCc,
        recipientsBcc,
        ...overrideProps,
      };

      const res = await fetch("/api/auto-email/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextConfig),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to save configuration.");
      }
      setConfig(data.config);
      setMessage({ type: "success", text: "Settings saved successfully!" });
      setTimeout(() => setMessage(null), 4000);
    } catch (err) {
      setMessage({ type: "error", text: err.message || "Failed to save." });
    } finally {
      setSaving(false);
    }
  };

  const toggleMasterStatus = async () => {
    const nextEnabled = !config.enabled;
    setConfig((prev) => ({ ...prev, enabled: nextEnabled }));
    await handleSave({ enabled: nextEnabled });
  };

  const togglePlant = (plantId) => {
    setConfig((prev) => {
      const exists = prev.selectedPlants?.includes(plantId);
      const nextList = exists
        ? prev.selectedPlants.filter((id) => id !== plantId)
        : [...(prev.selectedPlants || []), plantId];
      return { ...prev, selectedPlants: nextList };
    });
  };

  const selectAllPlants = () => {
    const allIds = plants.map((p) => String(p.plant_id));
    setConfig((prev) => ({ ...prev, selectedPlants: allIds }));
  };

  const clearAllPlants = () => {
    setConfig((prev) => ({ ...prev, selectedPlants: [] }));
  };

  const handleSendTestEmail = async () => {
    setTesting(true);
    setTestSendResult(null);
    try {
      const recipientsTo = parseEmails(toInput);
      const recipientsCc = parseEmails(ccInput);
      const targetTo = testEmailTo ? [testEmailTo] : recipientsTo;

      if (targetTo.length === 0) {
        throw new Error("Please provide at least one recipient email address to send the test email.");
      }

      const res = await fetch("/api/auto-email/send-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          testTo: targetTo,
          testCc: testEmailTo ? [] : recipientsCc,
          configOverride: {
            ...config,
            recipientsTo,
            recipientsCc,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to send test email.");
      }

      setTestSendResult({
        type: "success",
        text: `Test email successfully sent to ${targetTo.join(", ")}! Check your inbox.`,
      });
      loadLogs();
      loadConfig();
    } catch (err) {
      setTestSendResult({
        type: "error",
        text: err.message || "Failed to send test email. Please check SMTP configuration in .env.",
      });
    } finally {
      setTesting(false);
    }
  };

  const availablePlants = useMemo(() => {
    const list =
      plants.length > 0
        ? [...plants]
        : [
            { plant_id: "2020", name: "2020 - PGTL Pune" },
            { plant_id: "4010", name: "4010 - NGM Pune" },
            { plant_id: "1040", name: "1040 - PGEL Pune" },
            { plant_id: "2060", name: "2060 - DMIC Noida" },
            { plant_id: "PLANT-U04", name: "Unit-04 - Bhiwadi" },
            { plant_id: "4020", name: "4020 - NGM Bhiwadi" },
          ];
    return list.sort((a, b) => (PLANT_ORDER[String(a.plant_id)] || 99) - (PLANT_ORDER[String(b.plant_id)] || 99));
  }, [plants]);

  if (loading) {
    return (
      <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--ink-faint)" }}>
        <div style={{ fontSize: "28px", marginBottom: "12px" }}>⏳</div>
        <div style={{ fontSize: "16px", fontWeight: "600" }}>Loading Auto Email Control Center...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: "0 0 40px 0", maxWidth: "1280px", margin: "0 auto" }}>
      {/* Page Header */}
      <div
        style={{
          background: "linear-gradient(135deg, #0369a1 0%, #0284c7 100%)",
          padding: "24px 28px",
          borderRadius: "16px",
          color: "#ffffff",
          boxShadow: "0 10px 25px -5px rgba(2, 132, 199, 0.25)",
          marginBottom: "24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div>
          <div
            style={{
              display: "inline-block",
              background: "rgba(255,255,255,0.2)",
              padding: "4px 12px",
              borderRadius: "20px",
              fontSize: "11px",
              fontWeight: "700",
              letterSpacing: "1px",
              textTransform: "uppercase",
              marginBottom: "8px",
            }}
          >
            SUPER ADMIN · AUTOMATION CONTROLS
          </div>
          <h1 style={{ fontSize: "24px", fontWeight: "800", color: "#ffffff", margin: 0 }}>
            Cycle Time Tracker · Auto Email Dispatch
          </h1>
          <p style={{ margin: "6px 0 0 0", color: "#e0f2fe", fontSize: "14px" }}>
            Configure daily dispatch schedules, pause or activate mailings, select recipient plants, and attach visual photo snapshot cards.
          </p>
        </div>

        {/* Master Status and Main Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          {/* Status Badge */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: config.enabled ? "rgba(16, 185, 129, 0.2)" : "rgba(245, 158, 11, 0.25)",
              border: `1.5px solid ${config.enabled ? "#34d399" : "#fbbf24"}`,
              padding: "8px 16px",
              borderRadius: "30px",
              color: "#ffffff",
              fontSize: "13px",
              fontWeight: "700",
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                background: config.enabled ? "#10b981" : "#f59e0b",
                boxShadow: config.enabled ? "0 0 8px #10b981" : "none",
              }}
            />
            {config.enabled ? `ACTIVE (${config.scheduleTime} IST)` : "PAUSED"}
          </div>

          {/* Master Toggle Button */}
          <button
            onClick={toggleMasterStatus}
            disabled={saving}
            style={{
              background: config.enabled ? "#dc2626" : "#10b981",
              color: "#ffffff",
              fontWeight: "700",
              padding: "9px 18px",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              boxShadow: "0 2px 4px rgba(0,0,0,0.15)",
              transition: "all 0.2s",
            }}
          >
            {config.enabled ? "⏸ Pause Auto Email" : "▶ Resume / Activate"}
          </button>

          {/* Send Test Email Button */}
          <button
            onClick={() => {
              if (currentUser?.email && !testEmailTo) setTestEmailTo(currentUser.email);
              setShowTestModal(true);
            }}
            style={{
              background: "#ffffff",
              color: "#0284c7",
              fontWeight: "700",
              padding: "9px 18px",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            }}
          >
            ✈ Send Test Email Now
          </button>
        </div>
      </div>

      {/* Global Alerts / Messages */}
      {message && (
        <div
          style={{
            padding: "12px 18px",
            borderRadius: "10px",
            marginBottom: "20px",
            fontWeight: "600",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: message.type === "success" ? "#ecfdf5" : "#fef2f2",
            color: message.type === "success" ? "#065f46" : "#991b1b",
            border: `1px solid ${message.type === "success" ? "#a7f3d0" : "#fecaca"}`,
          }}
        >
          <span>{message.text}</span>
          <button
            onClick={() => setMessage(null)}
            style={{ background: "transparent", color: "inherit", fontWeight: "bold", fontSize: "16px" }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Sub Tabs Navigation */}
      <div
        style={{
          display: "flex",
          borderBottom: "2px solid #e2e8f0",
          marginBottom: "24px",
          gap: "8px",
        }}
      >
        <button
          onClick={() => setActiveSubTab("settings")}
          style={{
            padding: "10px 20px",
            fontSize: "14px",
            fontWeight: "700",
            background: "none",
            border: "none",
            borderBottom: activeSubTab === "settings" ? "3px solid #0284c7" : "3px solid transparent",
            color: activeSubTab === "settings" ? "#0284c7" : "var(--ink-faint)",
            cursor: "pointer",
            marginBottom: "-2px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          ⚙ Settings &amp; Schedule
        </button>

        <button
          onClick={() => setActiveSubTab("preview")}
          style={{
            padding: "10px 20px",
            fontSize: "14px",
            fontWeight: "700",
            background: "none",
            border: "none",
            borderBottom: activeSubTab === "preview" ? "3px solid #0284c7" : "3px solid transparent",
            color: activeSubTab === "preview" ? "#0284c7" : "var(--ink-faint)",
            cursor: "pointer",
            marginBottom: "-2px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          👁 Live Preview &amp; Photos
        </button>

        <button
          onClick={() => setActiveSubTab("logs")}
          style={{
            padding: "10px 20px",
            fontSize: "14px",
            fontWeight: "700",
            background: "none",
            border: "none",
            borderBottom: activeSubTab === "logs" ? "3px solid #0284c7" : "3px solid transparent",
            color: activeSubTab === "logs" ? "#0284c7" : "var(--ink-faint)",
            cursor: "pointer",
            marginBottom: "-2px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          📜 Dispatch Logs &amp; History ({logs.length})
        </button>
      </div>

      {/* SUB-TAB 1: SETTINGS */}
      {activeSubTab === "settings" && (
        <div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(460px, 1fr))",
              gap: "24px",
            }}
          >
            {/* Card 1: Schedule & Timing */}
            <div
              style={{
                background: "#ffffff",
                borderRadius: "14px",
                padding: "24px",
                border: "1px solid #e2e8f0",
                boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                <div
                  style={{
                    background: "#e0f2fe",
                    color: "#0284c7",
                    borderRadius: "8px",
                    width: "36px",
                    height: "36px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "18px",
                  }}
                >
                  ⏰
                </div>
                <div>
                  <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#0f172a" }}>
                    Automated Schedule &amp; Period
                  </h3>
                  <div style={{ fontSize: "12px", color: "var(--ink-faint)" }}>
                    Configure the exact dispatch time in Indian Standard Time (IST).
                  </div>
                </div>
              </div>

              {/* Schedule Time Input */}
              <div style={{ marginBottom: "18px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>
                  Daily Dispatch Time (24h IST)
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <input
                    type="time"
                    value={config.scheduleTime || "08:00"}
                    onChange={(e) => setConfig({ ...config, scheduleTime: e.target.value })}
                    style={{
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "16px",
                      fontWeight: "700",
                      color: "#0f172a",
                      width: "140px",
                    }}
                  />
                  <span style={{ fontSize: "12px", color: "var(--ink-faint)" }}>Asia/Kolkata (IST)</span>
                </div>

                {/* Quick Presets */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "10px" }}>
                  {PRESET_TIMES.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setConfig({ ...config, scheduleTime: preset.value })}
                      style={{
                        padding: "4px 10px",
                        borderRadius: "14px",
                        fontSize: "12px",
                        fontWeight: "600",
                        background: config.scheduleTime === preset.value ? "#0284c7" : "#f1f5f9",
                        color: config.scheduleTime === preset.value ? "#ffffff" : "#475569",
                        border: "none",
                      }}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reporting Range */}
              <div style={{ marginBottom: "18px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>
                  Production Shift Range
                </label>
                <select
                  value={config.period || "yesterday"}
                  onChange={(e) => setConfig({ ...config, period: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "13px",
                    background: "#ffffff",
                    color: "#0f172a",
                  }}
                >
                  {PERIOD_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Thresholds Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "6px" }}>
                    Faster Than CT Alert Threshold
                  </label>
                  <select
                    value={config.threshold || 110}
                    onChange={(e) => setConfig({ ...config, threshold: Number(e.target.value) })}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "13px",
                    }}
                  >
                    {THRESHOLDS.map((t) => (
                      <option key={t} value={t}>
                        ≥ {t}% Speedup
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "6px" }}>
                    Minimum Run Hours Filter
                  </label>
                  <select
                    value={config.minHours ?? 2}
                    onChange={(e) => setConfig({ ...config, minHours: Number(e.target.value) })}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "13px",
                    }}
                  >
                    {MIN_HOURS.map((h) => (
                      <option key={h} value={h}>
                        {h === 0 ? "All runs (≥ 0h)" : `≥ ${h} hours`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Card 2: Recipients */}
            <div
              style={{
                background: "#ffffff",
                borderRadius: "14px",
                padding: "24px",
                border: "1px solid #e2e8f0",
                boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                <div
                  style={{
                    background: "#f0fdf4",
                    color: "#16a34a",
                    borderRadius: "8px",
                    width: "36px",
                    height: "36px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "18px",
                  }}
                >
                  ✉️
                </div>
                <div>
                  <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#0f172a" }}>
                    Email Recipients (To &amp; Cc)
                  </h3>
                  <div style={{ fontSize: "12px", color: "var(--ink-faint)" }}>
                    Specify recipient addresses separated by commas or newlines.
                  </div>
                </div>
              </div>

              {/* TO Input */}
              <div style={{ marginBottom: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <label style={{ fontSize: "13px", fontWeight: "600" }}>To Recipients (Primary)</label>
                  <span style={{ fontSize: "11px", fontWeight: "600", color: "#0284c7" }}>
                    {parseEmails(toInput).length} addresses configured
                  </span>
                </div>
                <textarea
                  rows={2}
                  value={toInput}
                  onChange={(e) => setToInput(e.target.value)}
                  placeholder="e.g. director@pgel.in, planthead@pgel.in"
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "13px",
                    fontFamily: "var(--font-mono)",
                    resize: "vertical",
                  }}
                />
              </div>

              {/* CC Input */}
              <div style={{ marginBottom: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <label style={{ fontSize: "13px", fontWeight: "600" }}>Cc Recipients (Copy)</label>
                  <span style={{ fontSize: "11px", fontWeight: "600", color: "#16a34a" }}>
                    {parseEmails(ccInput).length} addresses configured
                  </span>
                </div>
                <textarea
                  rows={2}
                  value={ccInput}
                  onChange={(e) => setCcInput(e.target.value)}
                  placeholder="e.g. operations@pgel.in, quality@pgel.in"
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "13px",
                    fontFamily: "var(--font-mono)",
                    resize: "vertical",
                  }}
                />
              </div>

              {/* BCC Input (Optional) */}
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "4px", color: "#64748b" }}>
                  Bcc Recipients (Optional Audit Copy)
                </label>
                <input
                  type="text"
                  value={bccInput}
                  onChange={(e) => setBccInput(e.target.value)}
                  placeholder="e.g. mis-archive@pgel.in"
                  style={{
                    width: "100%",
                    padding: "7px 12px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "12px",
                    fontFamily: "var(--font-mono)",
                  }}
                />
              </div>
            </div>

            {/* Card 3: Plants Selection & Photo Snapshot */}
            <div
              style={{
                background: "#ffffff",
                borderRadius: "14px",
                padding: "24px",
                border: "1px solid #e2e8f0",
                boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div
                    style={{
                      background: "#fef3c7",
                      color: "#b45309",
                      borderRadius: "8px",
                      width: "36px",
                      height: "36px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "18px",
                    }}
                  >
                    🏭
                  </div>
                  <div>
                    <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#0f172a" }}>
                      Selected Plants &amp; Visual Snapshots
                    </h3>
                    <div style={{ fontSize: "12px", color: "var(--ink-faint)" }}>
                      Tick which plants will be included in the automated cycle time email.
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "6px" }}>
                  <button
                    type="button"
                    onClick={selectAllPlants}
                    style={{
                      background: "#f1f5f9",
                      padding: "4px 8px",
                      borderRadius: "6px",
                      fontSize: "11px",
                      fontWeight: "600",
                      color: "#0f172a",
                    }}
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={clearAllPlants}
                    style={{
                      background: "#f1f5f9",
                      padding: "4px 8px",
                      borderRadius: "6px",
                      fontSize: "11px",
                      fontWeight: "600",
                      color: "#64748b",
                    }}
                  >
                    Clear All
                  </button>
                </div>
              </div>

              {/* Plant Checkboxes Grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "10px",
                  marginBottom: "18px",
                }}
              >
                {availablePlants.map((p) => {
                  const isChecked = config.selectedPlants?.includes(String(p.plant_id));
                  return (
                    <div
                      key={p.plant_id}
                      onClick={() => togglePlant(String(p.plant_id))}
                      style={{
                        padding: "10px 14px",
                        borderRadius: "10px",
                        border: `1.5px solid ${isChecked ? "#0284c7" : "#e2e8f0"}`,
                        background: isChecked ? "#f0f9ff" : "#ffffff",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        style={{ cursor: "pointer", width: "16px", height: "16px" }}
                      />
                      <div>
                        <div style={{ fontSize: "13px", fontWeight: isChecked ? "700" : "500", color: "#0f172a" }}>
                          {p.name}
                        </div>
                        <div style={{ fontSize: "11px", color: "#64748b" }}>ID: {p.plant_id}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Visual Photo Snapshot Option */}
              <div
                style={{
                  padding: "14px 16px",
                  borderRadius: "10px",
                  background: "#f8fafc",
                  border: "1px dashed #cbd5e1",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "12px",
                }}
              >
                <input
                  type="checkbox"
                  id="includePhoto"
                  checked={config.includePhotoAttachment !== false}
                  onChange={(e) => setConfig({ ...config, includePhotoAttachment: e.target.checked })}
                  style={{ width: "18px", height: "18px", marginTop: "2px", cursor: "pointer" }}
                />
                <label htmlFor="includePhoto" style={{ cursor: "pointer" }}>
                  <div style={{ fontSize: "13px", fontWeight: "700", color: "#0f172a" }}>
                    📷 Attach High-Resolution Photo Snapshot Cards ("Photo jae")
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--ink-faint)", marginTop: "2px" }}>
                    Generates an image-sharp vector snapshot card for every selected plant showing KPIs, speedup %, and cycle time deviations directly in the email and as attachments.
                  </div>
                </label>
              </div>
            </div>

            {/* Card 4: Email Content */}
            <div
              style={{
                background: "#ffffff",
                borderRadius: "14px",
                padding: "24px",
                border: "1px solid #e2e8f0",
                boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                <div
                  style={{
                    background: "#f3e8ff",
                    color: "#7e22ce",
                    borderRadius: "8px",
                    width: "36px",
                    height: "36px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "18px",
                  }}
                >
                  📝
                </div>
                <div>
                  <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#0f172a" }}>
                    Email Subject &amp; Intro Message
                  </h3>
                  <div style={{ fontSize: "12px", color: "var(--ink-faint)" }}>
                    Customize the subject line and remarks shown in the email body.
                  </div>
                </div>
              </div>

              {/* Subject Line */}
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>
                  Subject Line Template
                </label>
                <input
                  type="text"
                  value={config.subject || ""}
                  onChange={(e) => setConfig({ ...config, subject: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "13px",
                    fontWeight: "600",
                    color: "#0f172a",
                  }}
                />
                <div style={{ display: "flex", gap: "6px", marginTop: "6px" }}>
                  <span style={{ fontSize: "11px", color: "#64748b" }}>Tags:</span>
                  {["[DATE]", "[PERIOD]", "[PLANTS]"].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setConfig({ ...config, subject: `${config.subject} ${tag}` })}
                      style={{
                        padding: "2px 6px",
                        borderRadius: "4px",
                        fontSize: "11px",
                        background: "#f1f5f9",
                        color: "#0369a1",
                        border: "1px solid #cbd5e1",
                      }}
                    >
                      + {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Intro Text */}
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>
                  Remarks / Introduction Body
                </label>
                <textarea
                  rows={4}
                  value={config.bodyIntro || ""}
                  onChange={(e) => setConfig({ ...config, bodyIntro: e.target.value })}
                  placeholder="Custom message to recipients..."
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "13px",
                    lineHeight: "1.5",
                    resize: "vertical",
                  }}
                />
              </div>
            </div>
          </div>

          {/* Bottom Save Bar */}
          <div
            style={{
              marginTop: "24px",
              padding: "16px 24px",
              background: "#ffffff",
              borderRadius: "12px",
              border: "1px solid #e2e8f0",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
            }}
          >
            <div style={{ fontSize: "13px", color: "var(--ink-faint)" }}>
              {config.lastSentAt ? (
                <span>
                  Last dispatched: <strong>{fmtDate(config.lastSentAt)}</strong> · Status:{" "}
                  <strong style={{ color: config.lastStatus === "success" ? "#16a34a" : "#dc2626" }}>
                    {config.lastStatus || "none"}
                  </strong>
                </span>
              ) : (
                "No automated email has run yet."
              )}
            </div>

            <div style={{ display: "flex", gap: "12px" }}>
              <button
                type="button"
                onClick={() => loadConfig()}
                style={{
                  background: "#f1f5f9",
                  color: "#334155",
                  fontWeight: "600",
                  padding: "10px 20px",
                  borderRadius: "8px",
                }}
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => handleSave()}
                disabled={saving}
                style={{
                  background: "linear-gradient(135deg, #0369a1 0%, #0284c7 100%)",
                  color: "#ffffff",
                  fontWeight: "700",
                  padding: "10px 28px",
                  borderRadius: "8px",
                  boxShadow: "0 2px 4px rgba(2, 132, 199, 0.3)",
                }}
              >
                {saving ? "Saving Changes..." : "💾 Save Settings"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: LIVE PREVIEW & PHOTOS */}
      {activeSubTab === "preview" && (
        <div style={{ background: "#ffffff", borderRadius: "14px", padding: "24px", border: "1px solid #e2e8f0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <div>
              <h3 style={{ fontSize: "18px", fontWeight: "700", color: "#0f172a" }}>
                Live Email &amp; Visual Photo Preview
              </h3>
              <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "var(--ink-faint)" }}>
                This is the exact email content and snapshot graphics generated for the selected plants.
              </p>
            </div>
            <button
              onClick={loadPreview}
              disabled={previewLoading}
              style={{
                background: "#0284c7",
                color: "#ffffff",
                fontWeight: "600",
                padding: "8px 16px",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              {previewLoading ? "Refreshing..." : "🔄 Refresh Preview"}
            </button>
          </div>

          {previewLoading ? (
            <div style={{ padding: "60px", textAlign: "center", color: "var(--ink-faint)" }}>
              <div style={{ fontSize: "28px", marginBottom: "8px" }}>⏳</div>
              Generating preview snapshots and tables...
            </div>
          ) : !previewData ? (
            <div style={{ padding: "40px", textAlign: "center", color: "var(--ink-faint)" }}>
              No preview data available.
            </div>
          ) : (
            <div>
              {/* Plant Snapshot Selector */}
              <div style={{ marginBottom: "20px" }}>
                <div style={{ fontSize: "13px", fontWeight: "700", color: "#334155", marginBottom: "8px" }}>
                  Visual Photo Snapshot Card per Plant ("Photo"):
                </div>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {previewData.plantReports?.map((pr) => (
                    <button
                      key={pr.plantId}
                      onClick={() => setActivePreviewPlant(pr.plantId)}
                      style={{
                        padding: "8px 14px",
                        borderRadius: "8px",
                        fontSize: "13px",
                        fontWeight: "700",
                        background: activePreviewPlant === pr.plantId ? "#0284c7" : "#f1f5f9",
                        color: activePreviewPlant === pr.plantId ? "#ffffff" : "#334155",
                        border: "none",
                      }}
                    >
                      {pr.plantName || pr.plantId} ({pr.kpis?.analysed || 0} molds)
                    </button>
                  ))}
                </div>
              </div>

              {/* Active Plant SVG Card */}
              {activePreviewPlant && previewData.svgCards?.[activePreviewPlant] && (
                <div
                  style={{
                    background: "#f8fafc",
                    border: "1px solid #cbd5e1",
                    borderRadius: "12px",
                    padding: "16px",
                    marginBottom: "28px",
                    textAlign: "center",
                    overflowX: "auto",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "12px",
                    }}
                  >
                    <span style={{ fontSize: "12px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>
                      Embedded Image Attachment: {activePreviewPlant}_Cycle_Time.svg
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const blob = new Blob([previewData.svgCards[activePreviewPlant]], { type: "image/svg+xml" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `${activePreviewPlant}_Cycle_Time_Snapshot.svg`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                      style={{
                        background: "#0f172a",
                        color: "#ffffff",
                        padding: "5px 12px",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: "600",
                      }}
                    >
                      ⬇ Download SVG Photo Card
                    </button>
                  </div>
                  <div
                    style={{ maxWidth: "100%", overflowX: "auto" }}
                    dangerouslySetInnerHTML={{ __html: previewData.svgCards[activePreviewPlant] }}
                  />
                </div>
              )}

              {/* HTML Email Body Preview */}
              <div>
                <div style={{ fontSize: "13px", fontWeight: "700", color: "#334155", marginBottom: "8px" }}>
                  Complete Responsive HTML Email View:
                </div>
                <div
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: "12px",
                    overflow: "hidden",
                    background: "#ffffff",
                    maxHeight: "750px",
                    overflowY: "auto",
                  }}
                  dangerouslySetInnerHTML={{ __html: previewData.sampleHtml }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 3: LOGS & HISTORY */}
      {activeSubTab === "logs" && (
        <div style={{ background: "#ffffff", borderRadius: "14px", padding: "24px", border: "1px solid #e2e8f0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <div>
              <h3 style={{ fontSize: "18px", fontWeight: "700", color: "#0f172a" }}>
                Auto-Email Delivery &amp; Execution History
              </h3>
              <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "var(--ink-faint)" }}>
                Audit trail of recent automated schedules and manual test dispatches.
              </p>
            </div>
            <button
              onClick={loadLogs}
              disabled={logsLoading}
              style={{
                background: "#f1f5f9",
                color: "#0f172a",
                fontWeight: "600",
                padding: "8px 16px",
                borderRadius: "8px",
              }}
            >
              {logsLoading ? "Refreshing..." : "🔄 Refresh Logs"}
            </button>
          </div>

          {logs.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "var(--ink-faint)" }}>
              No execution history recorded yet. Use &quot;Send Test Email Now&quot; to test your setup.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ background: "#0f172a", color: "#ffffff", textAlign: "left", fontSize: "11px", textTransform: "uppercase" }}>
                    <th style={{ padding: "10px 14px" }}>Timestamp (IST)</th>
                    <th style={{ padding: "10px 14px" }}>Trigger Type</th>
                    <th style={{ padding: "10px 14px" }}>Status</th>
                    <th style={{ padding: "10px 14px" }}>Recipients</th>
                    <th style={{ padding: "10px 14px" }}>Plants Included</th>
                    <th style={{ padding: "10px 14px" }}>Details / Error</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log, i) => {
                    const isSuccess = log.status === "success";
                    return (
                      <tr
                        key={log.id || i}
                        style={{
                          background: i % 2 === 0 ? "#ffffff" : "#f8fafc",
                          borderBottom: "1px solid #e2e8f0",
                        }}
                      >
                        <td style={{ padding: "10px 14px", fontWeight: "600", color: "#0f172a" }}>
                          {fmtDate(log.timestamp)}
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          <span
                            style={{
                              padding: "2px 8px",
                              borderRadius: "10px",
                              fontSize: "11px",
                              fontWeight: "700",
                              background: log.type === "scheduled" ? "#e0f2fe" : "#f3e8ff",
                              color: log.type === "scheduled" ? "#0369a1" : "#7e22ce",
                            }}
                          >
                            {log.type === "scheduled" ? "⏰ Scheduled" : "🧪 Test Run"}
                          </span>
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          <span
                            style={{
                              padding: "2px 8px",
                              borderRadius: "10px",
                              fontSize: "11px",
                              fontWeight: "700",
                              background: isSuccess ? "#ecfdf5" : "#fee2e2",
                              color: isSuccess ? "#15803d" : "#b91c1c",
                            }}
                          >
                            {isSuccess ? "✓ SUCCESS" : "✕ FAILED"}
                          </span>
                        </td>
                        <td style={{ padding: "10px 14px", color: "#475569" }}>
                          {Array.isArray(log.recipients) ? log.recipients.join(", ") : log.recipients || "—"}
                        </td>
                        <td style={{ padding: "10px 14px", color: "#334155", fontWeight: "500" }}>
                          {Array.isArray(log.plants) ? log.plants.join(", ") : log.plants || "—"}
                        </td>
                        <td style={{ padding: "10px 14px", color: isSuccess ? "#16a34a" : "#dc2626", fontSize: "12px" }}>
                          {log.error || log.message || (isSuccess ? "Delivered successfully" : "Failed")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL: SEND TEST EMAIL */}
      {showTestModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(15, 23, 42, 0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "20px",
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "16px",
              padding: "28px",
              maxWidth: "520px",
              width: "100%",
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ fontSize: "18px", fontWeight: "800", color: "#0f172a", margin: 0 }}>
                ✈ Send Test Cycle Time Email
              </h3>
              <button
                onClick={() => {
                  setShowTestModal(false);
                  setTestSendResult(null);
                }}
                style={{ background: "transparent", fontSize: "18px", color: "#64748b", fontWeight: "bold" }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: "13px", color: "var(--ink-faint)", marginTop: 0, marginBottom: "16px" }}>
              Trigger an instant test email right now to verify SMTP delivery, layout formatting, and photo snapshots.
            </p>

            {testSendResult && (
              <div
                style={{
                  padding: "12px 16px",
                  borderRadius: "8px",
                  marginBottom: "16px",
                  fontSize: "13px",
                  fontWeight: "600",
                  background: testSendResult.type === "success" ? "#ecfdf5" : "#fee2e2",
                  color: testSendResult.type === "success" ? "#065f46" : "#991b1b",
                  border: `1px solid ${testSendResult.type === "success" ? "#a7f3d0" : "#fecaca"}`,
                }}
              >
                {testSendResult.text}
              </div>
            )}

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>
                Send Test Email To:
              </label>
              <input
                type="email"
                value={testEmailTo}
                onChange={(e) => setTestEmailTo(e.target.value)}
                placeholder="your.email@pgel.in"
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  fontSize: "14px",
                }}
              />
              <span style={{ fontSize: "11px", color: "#64748b", marginTop: "4px", display: "block" }}>
                Default is your email. Leave blank to send to all configured TO recipients.
              </span>
            </div>

            <div
              style={{
                background: "#f8fafc",
                borderRadius: "8px",
                padding: "12px",
                fontSize: "12px",
                color: "#475569",
                marginBottom: "20px",
              }}
            >
              <div><strong>Selected Plants:</strong> {config.selectedPlants?.join(", ") || "None"}</div>
              <div><strong>Period:</strong> {config.period}</div>
              <div><strong>Photos Included:</strong> {config.includePhotoAttachment !== false ? "Yes (SVG Cards)" : "No"}</div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                onClick={() => {
                  setShowTestModal(false);
                  setTestSendResult(null);
                }}
                style={{
                  background: "#f1f5f9",
                  color: "#475569",
                  padding: "9px 16px",
                  borderRadius: "8px",
                  fontWeight: "600",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendTestEmail}
                disabled={testing}
                style={{
                  background: "#0284c7",
                  color: "#ffffff",
                  padding: "9px 20px",
                  borderRadius: "8px",
                  fontWeight: "700",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                {testing ? "Dispatching Email..." : "Send Test Now"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
