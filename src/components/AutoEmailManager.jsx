import { useEffect, useState, useMemo } from "react";

const PRESET_TIMES = [
  { label: "07:00 (Shift 1 End)", value: "07:00" },
  { label: "08:00 (Shift A / Morning)", value: "08:00" },
  { label: "19:00 (Shift 2 End)", value: "19:00" },
  { label: "20:00 (Shift B / Evening)", value: "20:00" },
  { label: "09:00 (Management)", value: "09:00" },
];

const PERIOD_OPTIONS = [
  { value: "yesterday", label: "Yesterday (Previous Day · Both Shifts 1 & 2)" },
  { value: "latest_day", label: "Latest Production Day (Most Recent · Both Shifts 1 & 2)" },
  { value: "specific", label: "Specific Date (Pick Exact Date · Both Shifts 1 & 2)" },
  { value: "today", label: "Today (Current Shifts 1 & 2)" },
  { value: "mtd", label: "Current Month to Date (Full Cumulative Month)" },
  { value: "last7days", label: "Last 7 Days (Rolling Summary)" },
];

function getIstToday() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function getIstYesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

const PLANT_ORDER = {
  "2020": 1, // PGTL Pune
  "4010": 2, // NGM Pune
  "1040": 3, // PGEL Pune
  "2060": 4, // DMIC Noida
  "PLANT-U04": 5,
  "4020": 6,
};

const PLANT_SHORT_NAMES = {
  "2020": "PGTL",
  "4010": "NGM",
  "1040": "PGEL",
  "2060": "DMIC",
  "PLANT-U04": "Unit-04",
  "4020": "NGM Bhiwadi",
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

  // Rules state: array of notification channels
  const [rules, setRules] = useState([]);
  const [activeRuleId, setActiveRuleId] = useState(null);

  // String representations for textareas (synced with activeRule)
  const [toInput, setToInput] = useState("");
  const [ccInput, setCcInput] = useState("");
  const [bccInput, setBccInput] = useState("");

  // Test modal state
  const [showTestModal, setShowTestModal] = useState(false);
  const [testEmailTo, setTestEmailTo] = useState("");
  const [testDate, setTestDate] = useState("");
  const [testSendResult, setTestSendResult] = useState(null);

  // Preview state
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [activePreviewPlant, setActivePreviewPlant] = useState(null);

  // Logs state
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Resolve currently active rule
  const activeRule = useMemo(() => {
    if (!rules || rules.length === 0) return null;
    return rules.find((r) => r.id === activeRuleId) || rules[0];
  }, [rules, activeRuleId]);

  // Load config on mount
  useEffect(() => {
    loadConfig();
    loadLogs();
  }, []);

  // Sync inputs when activeRule changes
  useEffect(() => {
    if (activeRule) {
      setToInput((activeRule.recipientsTo || []).join(", "));
      setCcInput((activeRule.recipientsCc || []).join(", "));
      setBccInput((activeRule.recipientsBcc || []).join(", "));
    }
  }, [activeRuleId]);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auto-email/config");
      const data = await res.json();
      if (data?.success && data.config) {
        let loadedRules = [];
        if (Array.isArray(data.config.rules) && data.config.rules.length > 0) {
          loadedRules = data.config.rules;
        } else {
          // Initialize default rules: Rule 1 (PGTL & NGM) and Rule 2 (PGEL)
          loadedRules = [
            {
              id: "rule_1",
              name: "PGTL & NGM Molding Daily Alert",
              enabled: data.config.enabled ?? true,
              scheduleTime: data.config.scheduleTime || "07:00",
              selectedPlants: ["2020", "4010"],
              recipientsTo: data.config.recipientsTo || [],
              recipientsCc: data.config.recipientsCc || [],
              recipientsBcc: data.config.recipientsBcc || [],
              subject: "Daily Cycle Time Tracker Report - [DATE] (PGTL & NGM)",
              bodyIntro: "Dear Team,\n\nPlease find the automated Cycle Time Tracker suspicious runs report for PGTL and NGM molding units.",
              period: data.config.period || "yesterday",
              dateMode: data.config.dateMode || "yesterday",
              specificDate: data.config.specificDate || "",
              threshold: 110,
              minHours: 2,
              lastSentAt: data.config.lastSentAt || null,
              lastStatus: data.config.lastStatus || null,
              lastError: data.config.lastError || null,
            },
            {
              id: "rule_2",
              name: "PGEL Pune Molding Daily Alert",
              enabled: true,
              scheduleTime: "07:00",
              selectedPlants: ["1040"],
              recipientsTo: [],
              recipientsCc: [],
              recipientsBcc: [],
              subject: "PGEL Pune Cycle Time Tracker Report - [DATE]",
              bodyIntro: "Dear Team,\n\nPlease find the automated Cycle Time Tracker suspicious runs report for PGEL Pune molding unit.",
              period: "yesterday",
              dateMode: "yesterday",
              specificDate: "",
              threshold: 110,
              minHours: 2,
              lastSentAt: null,
              lastStatus: null,
              lastError: null,
            },
          ];
        }

        setRules(loadedRules);
        setActiveRuleId(loadedRules[0].id);
        setToInput((loadedRules[0].recipientsTo || []).join(", "));
        setCcInput((loadedRules[0].recipientsCc || []).join(", "));
        setBccInput((loadedRules[0].recipientsBcc || []).join(", "));

        if (currentUser?.email && !testEmailTo) {
          setTestEmailTo(currentUser.email);
        }
      }
    } catch (err) {
      console.error("Failed to load auto-email config:", err);
      setMessage({ type: "error", text: "Failed to load notification settings from server." });
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

  const loadPreview = async (overrideRule = null) => {
    setPreviewLoading(true);
    try {
      const targetRule = overrideRule || activeRule;
      const plantList = (targetRule?.selectedPlants || []).join(",");
      const query = new URLSearchParams({
        ruleId: targetRule?.id || "",
        period: targetRule?.dateMode || targetRule?.period || "yesterday",
        date: targetRule?.dateMode === "specific" && targetRule?.specificDate ? targetRule.specificDate : "",
        threshold: String(targetRule?.threshold || 110),
        minHours: String(targetRule?.minHours ?? 2),
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
  }, [activeSubTab, activeRuleId]);

  const updateActiveRule = (patch) => {
    setRules((prev) =>
      prev.map((r) => (r.id === activeRule?.id ? { ...r, ...patch } : r))
    );
  };

  const handleAddRule = () => {
    // Sync current inputs first
    const currentTo = parseEmails(toInput);
    const currentCc = parseEmails(ccInput);
    const currentBcc = parseEmails(bccInput);

    const updatedCurrent = rules.map((r) =>
      r.id === activeRule?.id
        ? { ...r, recipientsTo: currentTo, recipientsCc: currentCc, recipientsBcc: currentBcc }
        : r
    );

    const newRuleId = `rule_${Date.now()}`;
    const newRule = {
      id: newRuleId,
      name: `Notification Channel ${rules.length + 1}`,
      enabled: true,
      scheduleTime: "07:00",
      selectedPlants: ["2060"],
      recipientsTo: [],
      recipientsCc: [],
      recipientsBcc: [],
      subject: "Daily Cycle Time Tracker Report - [DATE]",
      bodyIntro: "Dear Team,\n\nPlease find the automated Cycle Time Tracker report below.",
      period: "yesterday",
      dateMode: "yesterday",
      specificDate: "",
      threshold: 110,
      minHours: 2,
      lastSentAt: null,
      lastStatus: null,
      lastError: null,
    };

    const nextRules = [...updatedCurrent, newRule];
    setRules(nextRules);
    setActiveRuleId(newRuleId);
    setToInput("");
    setCcInput("");
    setBccInput("");
    setMessage({ type: "success", text: `New rule "${newRule.name}" created! Configure recipients and plants below.` });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleDeleteRule = (idToDelete) => {
    if (rules.length <= 1) {
      alert("At least one notification rule must be maintained.");
      return;
    }
    const target = rules.find((r) => r.id === idToDelete);
    if (!confirm(`Are you sure you want to delete notification rule "${target?.name || idToDelete}"?`)) {
      return;
    }
    const remaining = rules.filter((r) => r.id !== idToDelete);
    setRules(remaining);
    if (activeRuleId === idToDelete) {
      setActiveRuleId(remaining[0].id);
      setToInput((remaining[0].recipientsTo || []).join(", "));
      setCcInput((remaining[0].recipientsCc || []).join(", "));
      setBccInput((remaining[0].recipientsBcc || []).join(", "));
    }
  };

  const handleSave = async (extraPatch = {}) => {
    setSaving(true);
    setMessage(null);
    try {
      const recipientsTo = parseEmails(toInput);
      const recipientsCc = parseEmails(ccInput);
      const recipientsBcc = parseEmails(bccInput);

      const updatedRules = rules.map((r) => {
        if (r.id === activeRule?.id) {
          return {
            ...r,
            recipientsTo,
            recipientsCc,
            recipientsBcc,
            ...extraPatch,
          };
        }
        return r;
      });

      const currentActive = updatedRules.find((r) => r.id === activeRule?.id) || updatedRules[0];

      const payload = {
        rules: updatedRules,
        ...currentActive,
      };

      const res = await fetch("/api/auto-email/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to save configuration.");
      }
      if (Array.isArray(data.config?.rules)) {
        setRules(data.config.rules);
      }
      setMessage({ type: "success", text: "All notification rules and schedules saved successfully!" });
      setTimeout(() => setMessage(null), 4000);
    } catch (err) {
      setMessage({ type: "error", text: err.message || "Failed to save." });
    } finally {
      setSaving(false);
    }
  };

  const toggleActiveRuleStatus = async () => {
    if (!activeRule) return;
    const nextEnabled = !activeRule.enabled;
    updateActiveRule({ enabled: nextEnabled });
    await handleSave({ enabled: nextEnabled });
  };

  const togglePlantForActiveRule = (plantId) => {
    if (!activeRule) return;
    const current = activeRule.selectedPlants || [];
    const exists = current.includes(plantId);
    const next = exists ? current.filter((id) => id !== plantId) : [...current, plantId];
    updateActiveRule({ selectedPlants: next });
  };

  const selectAllPlantsForActiveRule = () => {
    const allIds = plants.map((p) => String(p.plant_id));
    updateActiveRule({ selectedPlants: allIds });
  };

  const clearAllPlantsForActiveRule = () => {
    updateActiveRule({ selectedPlants: [] });
  };

  const handleSendTestEmail = async () => {
    if (!activeRule) return;
    setTesting(true);
    setTestSendResult(null);
    try {
      const currentTo = parseEmails(toInput);
      const currentCc = parseEmails(ccInput);
      const targetTo = testEmailTo ? [testEmailTo] : currentTo;

      if (targetTo.length === 0) {
        throw new Error("Please provide at least one recipient email address to send the test email.");
      }

      const targetDate = testDate || (activeRule.dateMode === "specific" ? activeRule.specificDate : null);

      const res = await fetch("/api/auto-email/send-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ruleId: activeRule.id,
          testTo: targetTo,
          testCc: testEmailTo ? [] : currentCc,
          testDate: targetDate,
          configOverride: {
            ...activeRule,
            recipientsTo: currentTo,
            recipientsCc: currentCc,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to send test email.");
      }

      setTestSendResult({
        type: "success",
        text: `✓ Test email for "${activeRule.name}" successfully sent to ${targetTo.join(", ")}! Check your inbox.`,
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
        <div style={{ fontSize: "16px", fontWeight: "600" }}>Loading Auto Email Notification Center...</div>
      </div>
    );
  }

  const anyRuleActive = rules.some((r) => r.enabled);

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
            Cycle Time Tracker · Auto Email Notification
          </h1>
          <p style={{ margin: "6px 0 0 0", color: "#e0f2fe", fontSize: "14px" }}>
            Configure separate notification rules for different plants, individual recipient lists, custom body content, and independent timings.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          {/* Active Rules Counter Badge */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: anyRuleActive ? "rgba(16, 185, 129, 0.2)" : "rgba(245, 158, 11, 0.25)",
              border: `1.5px solid ${anyRuleActive ? "#34d399" : "#fbbf24"}`,
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
                background: anyRuleActive ? "#10b981" : "#f59e0b",
                boxShadow: anyRuleActive ? "0 0 8px #10b981" : "none",
              }}
            />
            {rules.filter((r) => r.enabled).length} of {rules.length} RULES ACTIVE
          </div>

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
              border: "none",
              cursor: "pointer",
            }}
          >
            ✈ Send Test Notification Now
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
            style={{ background: "transparent", border: "none", color: "inherit", fontWeight: "bold", fontSize: "16px", cursor: "pointer" }}
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
          ⚙ Notification Rules &amp; Setup ({rules.length})
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
          👁 Live Email Preview
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
          📜 Notification Logs &amp; History ({logs.length})
        </button>
      </div>

      {/* SUB-TAB 1: SETTINGS & RULES */}
      {activeSubTab === "settings" && (
        <div>
          {/* SECTION: Notification Rules Selector */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: "14px",
              padding: "20px 24px",
              border: "1px solid #e2e8f0",
              boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
              marginBottom: "24px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#0f172a" }}>
                  📬 Notification Channels &amp; Plant Rules ({rules.length})
                </h3>
                <p style={{ margin: "3px 0 0 0", fontSize: "12px", color: "var(--ink-faint)" }}>
                  Select a rule below to edit its plants, timing, recipients, and content, or add a new channel.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddRule}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "9px 16px",
                  borderRadius: "8px",
                  background: "#0284c7",
                  color: "#ffffff",
                  fontWeight: "700",
                  fontSize: "13px",
                  border: "none",
                  cursor: "pointer",
                  boxShadow: "0 2px 6px rgba(2, 132, 199, 0.25)",
                }}
              >
                <span>+</span> Add Notification Rule
              </button>
            </div>

            {/* Rules Cards Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: "12px" }}>
              {rules.map((rule, idx) => {
                const isSelected = rule.id === activeRule?.id;
                const plantLabels = (rule.selectedPlants || [])
                  .map((pid) => PLANT_SHORT_NAMES[pid] || pid)
                  .join(" + ") || "None";

                return (
                  <div
                    key={rule.id}
                    onClick={() => {
                      // Save current inputs to active rule
                      const currentTo = parseEmails(toInput);
                      const currentCc = parseEmails(ccInput);
                      const currentBcc = parseEmails(bccInput);
                      setRules((prev) =>
                        prev.map((r) =>
                          r.id === activeRule?.id
                            ? { ...r, recipientsTo: currentTo, recipientsCc: currentCc, recipientsBcc: currentBcc }
                            : r
                        )
                      );
                      setActiveRuleId(rule.id);
                      setToInput((rule.recipientsTo || []).join(", "));
                      setCcInput((rule.recipientsCc || []).join(", "));
                      setBccInput((rule.recipientsBcc || []).join(", "));
                    }}
                    style={{
                      cursor: "pointer",
                      border: isSelected ? "2.5px solid #0284c7" : "1px solid #cbd5e1",
                      background: isSelected ? "#f0f9ff" : "#f8fafc",
                      borderRadius: "12px",
                      padding: "14px 16px",
                      transition: "all 0.15s ease",
                      position: "relative",
                      boxShadow: isSelected ? "0 4px 14px rgba(2, 132, 199, 0.18)" : "0 1px 3px rgba(0,0,0,0.03)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span
                          style={{
                            display: "inline-block",
                            width: "10px",
                            height: "10px",
                            borderRadius: "50%",
                            background: rule.enabled ? "#16a34a" : "#94a3b8",
                            boxShadow: rule.enabled ? "0 0 6px #16a34a" : "none",
                          }}
                        />
                        <span style={{ fontSize: "14px", fontWeight: "800", color: isSelected ? "#0369a1" : "#0f172a" }}>
                          {rule.name || `Rule ${idx + 1}`}
                        </span>
                      </div>
                      {rules.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteRule(rule.id);
                          }}
                          title="Delete this rule"
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "#94a3b8",
                            cursor: "pointer",
                            fontSize: "14px",
                            padding: "0 4px",
                            lineHeight: "1",
                          }}
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    <div style={{ fontSize: "12px", color: "#334155", marginBottom: "8px" }}>
                      <strong style={{ color: "#0284c7" }}>Plants:</strong> {plantLabels}
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px", color: "#64748b" }}>
                      <span style={{ fontWeight: "700" }}>⏰ {rule.scheduleTime || "07:00"} IST</span>
                      <span>
                        👥 {(rule.recipientsTo || []).length} TO · {(rule.recipientsCc || []).length} CC
                      </span>
                      <span
                        style={{
                          background: rule.enabled ? "#dcfce7" : "#f1f5f9",
                          color: rule.enabled ? "#15803d" : "#64748b",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          fontWeight: "700",
                        }}
                      >
                        {rule.enabled ? "ACTIVE" : "PAUSED"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ACTIVE RULE CONFIGURATION */}
          {activeRule && (
            <div>
              {/* Active Rule Top Bar Banner */}
              <div
                style={{
                  background: "#0f172a",
                  borderRadius: "14px 14px 0 0",
                  padding: "16px 24px",
                  color: "#ffffff",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "12px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "14px", flex: 1, minWidth: "260px" }}>
                  <span style={{ color: "#38bdf8", fontSize: "12px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "1px" }}>
                    EDITING RULE:
                  </span>
                  <input
                    type="text"
                    value={activeRule.name || ""}
                    onChange={(e) => updateActiveRule({ name: e.target.value })}
                    placeholder="Enter Rule Name (e.g. PGTL & NGM Daily Alert)"
                    style={{
                      background: "#1e293b",
                      border: "1px solid #334155",
                      color: "#ffffff",
                      fontSize: "15px",
                      fontWeight: "700",
                      padding: "6px 14px",
                      borderRadius: "8px",
                      flex: 1,
                      maxWidth: "400px",
                    }}
                  />
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <button
                    type="button"
                    onClick={toggleActiveRuleStatus}
                    style={{
                      background: activeRule.enabled ? "#dc2626" : "#16a34a",
                      color: "#ffffff",
                      border: "none",
                      padding: "7px 16px",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: "700",
                      cursor: "pointer",
                    }}
                  >
                    {activeRule.enabled ? "⏸ Pause This Rule" : "▶ Activate This Rule"}
                  </button>

                  {rules.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleDeleteRule(activeRule.id)}
                      style={{
                        background: "#ef444420",
                        color: "#f87171",
                        border: "1px solid #ef444460",
                        padding: "7px 12px",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: "700",
                        cursor: "pointer",
                      }}
                    >
                      Delete Rule
                    </button>
                  )}
                </div>
              </div>

              {/* Grid of Rule Setting Cards */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(460px, 1fr))",
                  gap: "24px",
                  background: "#f8fafc",
                  padding: "24px",
                  border: "1px solid #cbd5e1",
                  borderTop: "none",
                  borderRadius: "0 0 14px 14px",
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
                      <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#0f172a", margin: 0 }}>
                        Notification Time &amp; Period
                      </h3>
                      <div style={{ fontSize: "12px", color: "var(--ink-faint)" }}>
                        Configure the exact time in Indian Standard Time (IST) for this rule.
                      </div>
                    </div>
                  </div>

                  {/* Schedule Time Input */}
                  <div style={{ marginBottom: "18px" }}>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>
                      Daily Notification Time (24h IST)
                    </label>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <input
                        type="time"
                        value={activeRule.scheduleTime || "07:00"}
                        onChange={(e) => updateActiveRule({ scheduleTime: e.target.value })}
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
                          onClick={() => updateActiveRule({ scheduleTime: preset.value })}
                          style={{
                            padding: "4px 10px",
                            borderRadius: "14px",
                            fontSize: "12px",
                            fontWeight: "600",
                            background: activeRule.scheduleTime === preset.value ? "#0284c7" : "#f1f5f9",
                            color: activeRule.scheduleTime === preset.value ? "#ffffff" : "#475569",
                            border: "none",
                            cursor: "pointer",
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
                      Production Shift Range &amp; Date Mode
                    </label>
                    <select
                      value={activeRule.dateMode || activeRule.period || "yesterday"}
                      onChange={(e) => {
                        const nextVal = e.target.value;
                        const nextSpecific = nextVal === "specific" && !activeRule.specificDate ? "2026-11-05" : activeRule.specificDate;
                        updateActiveRule({ dateMode: nextVal, period: nextVal, specificDate: nextSpecific });
                      }}
                      style={{
                        width: "100%",
                        padding: "9px 12px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        fontSize: "13px",
                        background: "#ffffff",
                      }}
                    >
                      {PERIOD_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>

                    {/* Specific Date Picker */}
                    {(activeRule.dateMode === "specific" || activeRule.period === "specific") && (
                      <div
                        style={{
                          marginTop: "12px",
                          padding: "12px 14px",
                          background: "#f0f9ff",
                          border: "1.5px solid #0284c7",
                          borderRadius: "10px",
                        }}
                      >
                        <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#0369a1", marginBottom: "6px" }}>
                          📅 Select Exact Date for Notification (Both Shift 1 &amp; Shift 2 Included):
                        </label>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                          <input
                            type="date"
                            value={activeRule.specificDate || "2026-11-05"}
                            onChange={(e) => updateActiveRule({ specificDate: e.target.value })}
                            style={{
                              padding: "6px 10px",
                              borderRadius: "6px",
                              border: "1px solid #0284c7",
                              fontSize: "14px",
                              fontWeight: "700",
                              background: "#ffffff",
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => updateActiveRule({ specificDate: "2026-11-05" })}
                            style={{
                              padding: "5px 10px",
                              borderRadius: "6px",
                              fontSize: "12px",
                              fontWeight: "700",
                              background: activeRule.specificDate === "2026-11-05" ? "#0284c7" : "#e0f2fe",
                              color: activeRule.specificDate === "2026-11-05" ? "#ffffff" : "#0369a1",
                              border: "none",
                              cursor: "pointer",
                            }}
                          >
                            05 Nov 2026
                          </button>
                          <button
                            type="button"
                            onClick={() => updateActiveRule({ specificDate: "2026-11-04" })}
                            style={{
                              padding: "5px 10px",
                              borderRadius: "6px",
                              fontSize: "12px",
                              fontWeight: "700",
                              background: activeRule.specificDate === "2026-11-04" ? "#0284c7" : "#e0f2fe",
                              color: activeRule.specificDate === "2026-11-04" ? "#ffffff" : "#0369a1",
                              border: "none",
                              cursor: "pointer",
                            }}
                          >
                            04 Nov 2026
                          </button>
                          <button
                            type="button"
                            onClick={() => updateActiveRule({ specificDate: getIstYesterday() })}
                            style={{
                              padding: "5px 10px",
                              borderRadius: "6px",
                              fontSize: "12px",
                              fontWeight: "700",
                              background: activeRule.specificDate === getIstYesterday() ? "#0284c7" : "#e0f2fe",
                              color: activeRule.specificDate === getIstYesterday() ? "#ffffff" : "#0369a1",
                              border: "none",
                              cursor: "pointer",
                            }}
                          >
                            Yesterday
                          </button>
                        </div>
                        <div style={{ fontSize: "11px", color: "#0369a1", marginTop: "6px" }}>
                          ✓ Both Shift 1 (Day) and Shift 2 (Night) records are aggregated and displayed together.
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card 2: Plant Selection */}
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
                        background: "#ede9fe",
                        color: "#7c3aed",
                        borderRadius: "8px",
                        width: "36px",
                        height: "36px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "18px",
                      }}
                    >
                      🏢
                    </div>
                    <div>
                      <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#0f172a", margin: 0 }}>
                        Plants Assigned to this Rule
                      </h3>
                      <div style={{ fontSize: "12px", color: "var(--ink-faint)" }}>
                        Select which plants will be included in this specific email notification.
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
                    <button
                      type="button"
                      onClick={selectAllPlantsForActiveRule}
                      style={{ background: "#f1f5f9", padding: "5px 12px", borderRadius: "6px", fontSize: "12px", fontWeight: "600", border: "none", cursor: "pointer" }}
                    >
                      Select All Plants
                    </button>
                    <button
                      type="button"
                      onClick={clearAllPlantsForActiveRule}
                      style={{ background: "#f1f5f9", padding: "5px 12px", borderRadius: "6px", fontSize: "12px", fontWeight: "600", border: "none", cursor: "pointer" }}
                    >
                      Clear Selection
                    </button>
                  </div>

                  {/* Plant Checkboxes Grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    {availablePlants.map((p) => {
                      const isChecked = activeRule.selectedPlants?.includes(String(p.plant_id));
                      return (
                        <div
                          key={p.plant_id}
                          onClick={() => togglePlantForActiveRule(String(p.plant_id))}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            padding: "10px 12px",
                            borderRadius: "8px",
                            border: `1.5px solid ${isChecked ? "#7c3aed" : "#e2e8f0"}`,
                            background: isChecked ? "#faf5ff" : "#ffffff",
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}} // Handled by container onClick
                            style={{ width: "16px", height: "16px", accentColor: "#7c3aed", cursor: "pointer" }}
                          />
                          <div>
                            <div style={{ fontSize: "13px", fontWeight: "700", color: "#0f172a" }}>
                              {p.name}
                            </div>
                            <div style={{ fontSize: "11px", color: "#64748b" }}>ID: {p.plant_id}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ fontSize: "11px", color: "#64748b", marginTop: "12px" }}>
                    ✓ Order priority: PGTL (2020) → NGM (4010) → PGEL (1040) → DMIC (2060).
                  </div>
                </div>

                {/* Card 3: Recipients (TO, CC, BCC) */}
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
                        background: "#dcfce7",
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
                      👥
                    </div>
                    <div>
                      <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#0f172a", margin: 0 }}>
                        Recipients for this Rule
                      </h3>
                      <div style={{ fontSize: "12px", color: "var(--ink-faint)" }}>
                        Enter comma or newline separated email addresses specifically for this notification.
                      </div>
                    </div>
                  </div>

                  {/* TO Field */}
                  <div style={{ marginBottom: "16px" }}>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>
                      Primary Recipients (TO) <span style={{ color: "#dc2626" }}>*</span>
                    </label>
                    <textarea
                      rows={2}
                      value={toInput}
                      onChange={(e) => setToInput(e.target.value)}
                      placeholder="e.g. director@pgel.in, planthead@pgel.in"
                      style={{
                        width: "100%",
                        padding: "9px 12px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        fontSize: "13px",
                        fontFamily: "inherit",
                        resize: "vertical",
                        boxSizing: "border-box",
                      }}
                    />
                    <div style={{ fontSize: "11px", color: "#64748b", marginTop: "3px" }}>
                      Current parsed count: <strong>{parseEmails(toInput).length}</strong> recipient(s)
                    </div>
                  </div>

                  {/* CC Field */}
                  <div style={{ marginBottom: "16px" }}>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>
                      Copy Recipients (CC)
                    </label>
                    <textarea
                      rows={2}
                      value={ccInput}
                      onChange={(e) => setCcInput(e.target.value)}
                      placeholder="e.g. shift.incharge@pgel.in, quality@pgel.in"
                      style={{
                        width: "100%",
                        padding: "9px 12px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        fontSize: "13px",
                        fontFamily: "inherit",
                        resize: "vertical",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  {/* BCC Field */}
                  <div>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>
                      Blind Copy (BCC)
                    </label>
                    <input
                      type="text"
                      value={bccInput}
                      onChange={(e) => setBccInput(e.target.value)}
                      placeholder="e.g. audit.log@pgel.in"
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        fontSize: "13px",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                </div>

                {/* Card 4: Subject Line & Custom Mail Content */}
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
                        background: "#fef3c7",
                        color: "#d97706",
                        borderRadius: "8px",
                        width: "36px",
                        height: "36px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "18px",
                      }}
                    >
                      ✉
                    </div>
                    <div>
                      <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#0f172a", margin: 0 }}>
                        Subject &amp; Custom Mail Content
                      </h3>
                      <div style={{ fontSize: "12px", color: "var(--ink-faint)" }}>
                        Customize subject line and email body remarks for this notification.
                      </div>
                    </div>
                  </div>

                  {/* Subject Line */}
                  <div style={{ marginBottom: "16px" }}>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>
                      Email Subject Line
                    </label>
                    <input
                      type="text"
                      value={activeRule.subject || ""}
                      onChange={(e) => updateActiveRule({ subject: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "9px 12px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        fontSize: "13px",
                        boxSizing: "border-box",
                      }}
                    />
                    <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>
                      Tokens available: <code>[DATE]</code>, <code>[PERIOD]</code>, <code>[PLANTS]</code>
                    </div>
                  </div>

                  {/* Custom Mail Content / Body Intro */}
                  <div>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>
                      Mail Content (Body Text / Remarks)
                    </label>
                    <textarea
                      rows={4}
                      value={activeRule.bodyIntro || ""}
                      onChange={(e) => updateActiveRule({ bodyIntro: e.target.value })}
                      placeholder="Write custom instructions or note for recipients. If left empty, no boilerplate will be added."
                      style={{
                        width: "100%",
                        padding: "9px 12px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        fontSize: "13px",
                        fontFamily: "inherit",
                        resize: "vertical",
                        boxSizing: "border-box",
                      }}
                    />
                    <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>
                      Appears cleanly at the top of the email, followed directly by the Plant suspicious tables.
                    </div>
                  </div>
                </div>

                {/* Card 5: Deviation & Run Filter Parameters */}
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
                        background: "#fee2e2",
                        color: "#dc2626",
                        borderRadius: "8px",
                        width: "36px",
                        height: "36px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "18px",
                      }}
                    >
                      ⚡
                    </div>
                    <div>
                      <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#0f172a", margin: 0 }}>
                        Analysis Thresholds
                      </h3>
                      <div style={{ fontSize: "12px", color: "var(--ink-faint)" }}>
                        Filters for highlighting over-cycle and suspicious mold runs.
                      </div>
                    </div>
                  </div>

                  <div style={{ marginBottom: "16px" }}>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>
                      Over-Speed Alert Threshold (%)
                    </label>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      {THRESHOLDS.map((th) => (
                        <button
                          key={th}
                          type="button"
                          onClick={() => updateActiveRule({ threshold: th })}
                          style={{
                            padding: "6px 14px",
                            borderRadius: "8px",
                            fontSize: "13px",
                            fontWeight: "700",
                            background: (activeRule.threshold || 110) === th ? "#dc2626" : "#f1f5f9",
                            color: (activeRule.threshold || 110) === th ? "#ffffff" : "#475569",
                            border: "none",
                            cursor: "pointer",
                          }}
                        >
                          &gt; {th}%
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>
                      Minimum Shift Run Hours
                    </label>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      {MIN_HOURS.map((h) => (
                        <button
                          key={h}
                          type="button"
                          onClick={() => updateActiveRule({ minHours: h })}
                          style={{
                            padding: "6px 14px",
                            borderRadius: "8px",
                            fontSize: "13px",
                            fontWeight: "700",
                            background: (activeRule.minHours ?? 2) === h ? "#0284c7" : "#f1f5f9",
                            color: (activeRule.minHours ?? 2) === h ? "#ffffff" : "#475569",
                            border: "none",
                            cursor: "pointer",
                          }}
                        >
                          {h === 0 ? "All Runs (0h)" : `≥ ${h} Hours`}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Card 6: Delivery Format Notice */}
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
                        background: "#e0e7ff",
                        color: "#4338ca",
                        borderRadius: "8px",
                        width: "36px",
                        height: "36px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "18px",
                      }}
                    >
                      🛡️
                    </div>
                    <div>
                      <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#0f172a", margin: 0 }}>
                        Executive HTML Format
                      </h3>
                      <div style={{ fontSize: "12px", color: "var(--ink-faint)" }}>
                        100% Outlook, Gmail &amp; Mobile Compatible
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize: "13px", lineHeight: "1.6", color: "#334155" }}>
                    <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                      <span style={{ color: "#16a34a", fontWeight: "bold" }}>✓</span>
                      <span><strong>Zero Broken Images:</strong> Delivered as clean native HTML tables. No external SVG files or broken <code>[x]</code> icons in Outlook.</span>
                    </div>
                    <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                      <span style={{ color: "#16a34a", fontWeight: "bold" }}>✓</span>
                      <span><strong>Both Shifts Guaranteed:</strong> Shift 1 (Day) and Shift 2 (Night) records are computed together for the target date.</span>
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <span style={{ color: "#16a34a", fontWeight: "bold" }}>✓</span>
                      <span><strong>Strict Plant Order:</strong> PGTL first, NGM second, PGEL third, DMIC fourth.</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Action Save Bar */}
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
                  flexWrap: "wrap",
                  gap: "12px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
                }}
              >
                <div style={{ fontSize: "13px", color: "var(--ink-faint)" }}>
                  {activeRule.lastSentAt ? (
                    <span>
                      Last sent for this rule: <strong>{fmtDate(activeRule.lastSentAt)}</strong> · Status:{" "}
                      <strong style={{ color: activeRule.lastStatus === "success" ? "#16a34a" : "#dc2626" }}>
                        {activeRule.lastStatus || "none"}
                      </strong>
                    </span>
                  ) : (
                    "No notifications sent yet for this rule."
                  )}
                </div>

                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => loadConfig()}
                    style={{
                      background: "#f1f5f9",
                      color: "#334155",
                      fontWeight: "600",
                      padding: "10px 20px",
                      borderRadius: "8px",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    Reset Changes
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (currentUser?.email && !testEmailTo) setTestEmailTo(currentUser.email);
                      setShowTestModal(true);
                    }}
                    style={{
                      background: "#f0f9ff",
                      color: "#0369a1",
                      border: "1.5px solid #0284c7",
                      fontWeight: "700",
                      padding: "10px 20px",
                      borderRadius: "8px",
                      cursor: "pointer",
                    }}
                  >
                    ✈ Test &quot;{activeRule.name}&quot;
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSave()}
                    disabled={saving}
                    style={{
                      background: "#0284c7",
                      color: "#ffffff",
                      fontWeight: "700",
                      padding: "10px 24px",
                      borderRadius: "8px",
                      boxShadow: "0 2px 6px rgba(2, 132, 199, 0.3)",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    {saving ? "Saving All Rules..." : "💾 Save All Notification Rules"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: LIVE EMAIL PREVIEW */}
      {activeSubTab === "preview" && (
        <div style={{ background: "#ffffff", borderRadius: "14px", padding: "24px", border: "1px solid #e2e8f0" }}>
          {/* Header Controls */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <h3 style={{ fontSize: "18px", fontWeight: "700", color: "#0f172a", margin: 0 }}>
                Live Email Preview
              </h3>
              <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "var(--ink-faint)" }}>
                Rendered preview of the exact email delivered for the selected notification rule.
              </p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              {/* Rule Selector Dropdown */}
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ fontSize: "13px", fontWeight: "600", color: "#475569" }}>Preview Rule:</span>
                <select
                  value={activeRule?.id || ""}
                  onChange={(e) => {
                    const found = rules.find((r) => r.id === e.target.value);
                    if (found) {
                      setActiveRuleId(found.id);
                      loadPreview(found);
                    }
                  }}
                  style={{
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "13px",
                    fontWeight: "700",
                    color: "#0369a1",
                    background: "#f0f9ff",
                  }}
                >
                  {rules.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => loadPreview()}
                disabled={previewLoading}
                style={{
                  background: "#f1f5f9",
                  color: "#0f172a",
                  fontWeight: "600",
                  padding: "8px 16px",
                  borderRadius: "8px",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                {previewLoading ? "Refreshing..." : "🔄 Refresh Preview"}
              </button>
            </div>
          </div>

          {previewLoading ? (
            <div style={{ padding: "60px 20px", textAlign: "center", color: "var(--ink-faint)" }}>
              <div style={{ fontSize: "28px", marginBottom: "10px" }}>⏳</div>
              Generating email preview for {activeRule?.name}...
            </div>
          ) : !previewData ? (
            <div style={{ padding: "40px", textAlign: "center", color: "var(--ink-faint)" }}>
              No preview data available.
            </div>
          ) : (
            <div>
              {/* Meta Pill Box */}
              <div
                style={{
                  background: "#f8fafc",
                  borderRadius: "10px",
                  padding: "14px 18px",
                  marginBottom: "20px",
                  fontSize: "13px",
                  color: "#475569",
                  border: "1px solid #e2e8f0",
                }}
              >
                <div style={{ marginBottom: "6px" }}>
                  <strong>Subject:</strong> {previewData.subject}
                </div>
                <div style={{ marginBottom: "6px" }}>
                  <strong>Period:</strong> {previewData.periodLabel}
                </div>
                <div>
                  <strong>Target Plants:</strong> {previewData.plantReports?.map((p) => p.plantDisplayName).join(" · ") || "None"}
                </div>
              </div>

              {/* Rendered HTML Preview */}
              <div
                style={{
                  border: "1px solid #cbd5e1",
                  borderRadius: "12px",
                  overflow: "hidden",
                  boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
                }}
              >
                <div
                  style={{
                    background: "#0f172a",
                    padding: "10px 16px",
                    color: "#94a3b8",
                    fontSize: "12px",
                    fontWeight: "600",
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                >
                  <span>EMAIL BODY RENDERED VIEW</span>
                  <span>100% NATIVE HTML TABLE</span>
                </div>
                <div
                  style={{
                    padding: "20px",
                    background: "#f1f5f9",
                    maxHeight: "700px",
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <h3 style={{ fontSize: "18px", fontWeight: "700", color: "#0f172a", margin: 0 }}>
                Notification Delivery &amp; Execution History
              </h3>
              <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "var(--ink-faint)" }}>
                Audit trail of recent automated schedules and manual test deliveries.
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
                border: "none",
                cursor: "pointer",
              }}
            >
              {logsLoading ? "Refreshing..." : "🔄 Refresh Logs"}
            </button>
          </div>

          {logs.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "var(--ink-faint)" }}>
              No execution history recorded yet. Use &quot;Send Test Notification Now&quot; to test your setup.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ background: "#0f172a", color: "#ffffff", textAlign: "left", fontSize: "11px", textTransform: "uppercase" }}>
                    <th style={{ padding: "10px 14px" }}>Timestamp (IST)</th>
                    <th style={{ padding: "10px 14px" }}>Rule Name</th>
                    <th style={{ padding: "10px 14px" }}>Trigger Type</th>
                    <th style={{ padding: "10px 14px" }}>Status</th>
                    <th style={{ padding: "10px 14px" }}>Plants Covered</th>
                    <th style={{ padding: "10px 14px" }}>Recipients</th>
                    <th style={{ padding: "10px 14px" }}>Summary</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log, idx) => (
                    <tr
                      key={log.id || idx}
                      style={{
                        borderBottom: "1px solid #e2e8f0",
                        background: idx % 2 === 0 ? "#ffffff" : "#f8fafc",
                      }}
                    >
                      <td style={{ padding: "10px 14px", fontWeight: "600", whiteSpace: "nowrap" }}>
                        {fmtDate(log.timestamp)}
                      </td>
                      <td style={{ padding: "10px 14px", fontWeight: "700", color: "#0369a1" }}>
                        {log.ruleName || "Default Notification"}
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <span
                          style={{
                            padding: "3px 8px",
                            borderRadius: "10px",
                            fontSize: "11px",
                            fontWeight: "700",
                            background: log.type === "test" ? "#e0f2fe" : "#f1f5f9",
                            color: log.type === "test" ? "#0284c7" : "#475569",
                          }}
                        >
                          {log.type === "test" ? "TEST" : "SCHEDULED"}
                        </span>
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <span
                          style={{
                            padding: "3px 8px",
                            borderRadius: "10px",
                            fontSize: "11px",
                            fontWeight: "700",
                            background: log.status === "success" ? "#dcfce7" : "#fee2e2",
                            color: log.status === "success" ? "#16a34a" : "#dc2626",
                          }}
                        >
                          {log.status === "success" ? "SUCCESS" : "FAILED"}
                        </span>
                      </td>
                      <td style={{ padding: "10px 14px", fontSize: "12px", color: "#475569" }}>
                        {Array.isArray(log.plants) ? log.plants.join(", ") : log.plants || "-"}
                      </td>
                      <td style={{ padding: "10px 14px", fontSize: "12px" }}>
                        {Array.isArray(log.recipients) ? (
                          <span>
                            {log.recipients.slice(0, 2).join(", ")}
                            {log.recipients.length > 2 && (
                              <span style={{ color: "#64748b" }}> +{log.recipients.length - 2} more</span>
                            )}
                          </span>
                        ) : (
                          log.recipients || "-"
                        )}
                      </td>
                      <td style={{ padding: "10px 14px", fontSize: "12px", color: log.status === "success" ? "#334155" : "#dc2626" }}>
                        {log.error || log.message || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL: SEND TEST NOTIFICATION */}
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
              maxWidth: "540px",
              width: "100%",
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div>
                <span style={{ fontSize: "11px", fontWeight: "800", color: "#0284c7", textTransform: "uppercase" }}>
                  TEST NOTIFICATION CHANNEL
                </span>
                <h3 style={{ fontSize: "18px", fontWeight: "800", color: "#0f172a", margin: "2px 0 0 0" }}>
                  ✈ Send Test Notification
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowTestModal(false);
                  setTestSendResult(null);
                }}
                style={{ background: "transparent", border: "none", fontSize: "18px", color: "#64748b", fontWeight: "bold", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: "13px", color: "var(--ink-faint)", marginTop: 0, marginBottom: "16px" }}>
              Testing notification channel: <strong>&quot;{activeRule?.name}&quot;</strong>. Trigger an instant email to verify SMTP delivery and shift tables.
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

            {/* Test Target Rule Selector */}
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "700", marginBottom: "6px", color: "#0f172a" }}>
                Select Notification Rule to Test:
              </label>
              <select
                value={activeRule?.id || ""}
                onChange={(e) => {
                  const target = rules.find((r) => r.id === e.target.value);
                  if (target) {
                    setActiveRuleId(target.id);
                  }
                }}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "1.5px solid #0284c7",
                  fontSize: "14px",
                  fontWeight: "700",
                  background: "#f0f9ff",
                  color: "#0369a1",
                }}
              >
                {rules.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} (Plants: {r.selectedPlants?.map((pid) => PLANT_SHORT_NAMES[pid] || pid).join(", ") || "None"})
                  </option>
                ))}
              </select>
            </div>

            {/* Date Selector */}
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "700", marginBottom: "6px", color: "#0f172a" }}>
                📅 Select Date for Test Email:
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <input
                  type="date"
                  value={testDate || activeRule?.specificDate || "2026-11-05"}
                  onChange={(e) => setTestDate(e.target.value)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1.5px solid #0284c7",
                    fontSize: "14px",
                    fontWeight: "700",
                    background: "#f0f9ff",
                    color: "#0369a1",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setTestDate("2026-11-05")}
                  style={{
                    padding: "6px 10px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    background: (testDate || activeRule?.specificDate) === "2026-11-05" ? "#0284c7" : "#f8fafc",
                    color: (testDate || activeRule?.specificDate) === "2026-11-05" ? "#ffffff" : "#334155",
                    fontSize: "12px",
                    fontWeight: "700",
                    cursor: "pointer",
                  }}
                >
                  05 Nov 2026
                </button>
                <button
                  type="button"
                  onClick={() => setTestDate("2026-11-04")}
                  style={{
                    padding: "6px 10px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    background: testDate === "2026-11-04" ? "#0284c7" : "#f8fafc",
                    color: testDate === "2026-11-04" ? "#ffffff" : "#334155",
                    fontSize: "12px",
                    fontWeight: "700",
                    cursor: "pointer",
                  }}
                >
                  04 Nov 2026
                </button>
                <button
                  type="button"
                  onClick={() => setTestDate(getIstYesterday())}
                  style={{
                    padding: "6px 10px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    background: testDate === getIstYesterday() ? "#0284c7" : "#f8fafc",
                    color: testDate === getIstYesterday() ? "#ffffff" : "#334155",
                    fontSize: "12px",
                    fontWeight: "700",
                    cursor: "pointer",
                  }}
                >
                  Yesterday
                </button>
              </div>
              <span style={{ fontSize: "11px", color: "#047857", marginTop: "4px", display: "block", fontWeight: "600" }}>
                ✓ Includes both Shift 1 (Day) and Shift 2 (Night) for this date.
              </span>
            </div>

            {/* Recipient Input */}
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
                  boxSizing: "border-box",
                }}
              />
              <span style={{ fontSize: "11px", color: "#64748b", marginTop: "4px", display: "block" }}>
                Default is your logged in email. Leave blank to send to all configured TO recipients.
              </span>
            </div>

            {/* Summary Box */}
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
              <div><strong>Selected Rule:</strong> {activeRule?.name}</div>
              <div><strong>Selected Plants:</strong> {activeRule?.selectedPlants?.map((pid) => PLANT_SHORT_NAMES[pid] || pid).join(", ") || "None"}</div>
              <div><strong>Target Date:</strong> {testDate || (activeRule?.dateMode === "specific" ? activeRule?.specificDate : activeRule?.dateMode || activeRule?.period)} (Both Shift 1 &amp; 2)</div>
              <div><strong>Format:</strong> Native Executive HTML Dashboard (No broken image icons, zero raw attachments)</div>
            </div>

            {/* Modal Actions */}
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
                  border: "none",
                  cursor: "pointer",
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
                  border: "none",
                  cursor: "pointer",
                }}
              >
                {testing ? "Sending Email..." : "Send Test Now"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
