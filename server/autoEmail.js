import express from "express";
import { cloudStorage } from "./storage.js";
import { sendCycleTimeEmail } from "./mail.js";
import {
  computePlantCycleTime,
  generatePlantSvgCard,
  generateCycleTimeEmailHtml,
  generateCycleTimeEmailText,
  getIstDateStr,
  fmtDateShort,
  sortPlantIds,
  getPlantDisplayName,
  getPlantShortCode,
} from "./cycleTimeReport.js";

export const autoEmailRouter = express.Router();

function getIstTimeStr() {
  return new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata", hour12: false }).slice(0, 5);
}

/**
 * Execute email generation and delivery for a specific notification rule or global config
 */
export async function executeCycleTimeEmailJob({
  ruleId = null,
  isTest = false,
  testTo = null,
  testCc = null,
  testDate = null,
  configOverride = null,
} = {}) {
  const baseConfig = cloudStorage.getAutoEmailConfig();
  let matchedRule = null;
  if (ruleId && Array.isArray(baseConfig.rules)) {
    matchedRule = baseConfig.rules.find((r) => r.id === ruleId);
  } else if (!ruleId && Array.isArray(baseConfig.rules) && baseConfig.rules.length > 0) {
    matchedRule = baseConfig.rules[0];
  }

  const config = { ...baseConfig, ...(matchedRule || {}), ...(configOverride || {}) };
  const effectiveRuleId = ruleId || (matchedRule ? matchedRule.id : null);
  const ruleName = config.name || (matchedRule ? matchedRule.name : "Default Notification");

  const recipientsTo = isTest && testTo ? testTo : config.recipientsTo || [];
  const recipientsCc = isTest && testCc ? testCc : config.recipientsCc || [];
  const recipientsBcc = config.recipientsBcc || [];

  const toList = Array.isArray(recipientsTo) ? recipientsTo : String(recipientsTo).split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
  const ccList = Array.isArray(recipientsCc) ? recipientsCc : String(recipientsCc).split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
  const bccList = Array.isArray(recipientsBcc) ? recipientsBcc : String(recipientsBcc).split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);

  if (toList.length === 0 && ccList.length === 0) {
    const msg = `No recipient email addresses found for "${ruleName}" (both To and Cc are empty).`;
    if (isTest) throw new Error(msg);
    cloudStorage.addEmailLog({
      type: "scheduled",
      status: "failed",
      ruleId: effectiveRuleId,
      ruleName,
      recipients: [],
      plants: config.selectedPlants || [],
      error: msg,
    });
    return { success: false, error: msg };
  }

  const entries = cloudStorage.getEntries();
  const bootstrap = cloudStorage.getBootstrap();
  const master = bootstrap.master || [];
  const reasonCodes = bootstrap.reasonCodes || [];
  const allPlants = bootstrap.plants || [];
  const machines = bootstrap.machines || [];
  const shifts = bootstrap.shifts || [];

  const rawSelectedIds = Array.isArray(config.selectedPlants) && config.selectedPlants.length > 0
    ? config.selectedPlants
    : allPlants.map((p) => p.plant_id);

  // Strictly order plants: PGTL (2020) -> NGM (4010) -> PGEL (1040) -> others
  const selectedPlantIds = sortPlantIds(rawSelectedIds);

  const plantReports = [];

  // Determine date filtering: Specific date or automated period
  const customDate = testDate || (config.dateMode === "specific" && config.specificDate ? config.specificDate : null);
  const period = config.dateMode || config.period || "yesterday";

  let periodLabel = "";
  if (customDate) {
    periodLabel = `${fmtDateShort(customDate)} (Shift 1 & Shift 2)`;
  } else if (period === "yesterday") {
    periodLabel = `Yesterday · ${fmtDateShort(getIstDateStr(-1))} (Shift 1 & Shift 2)`;
  } else if (period === "today") {
    periodLabel = `Today · ${fmtDateShort(getIstDateStr(0))} (Shift 1 & Shift 2)`;
  } else if (period === "latest_day") {
    periodLabel = `Latest Production Day (Shift 1 & Shift 2)`;
  } else if (period === "mtd") {
    periodLabel = `Month to Date (${getIstDateStr(0).slice(0, 7)})`;
  } else if (period === "last7days") {
    periodLabel = `Last 7 Days`;
  } else {
    periodLabel = period;
  }

  for (const plantId of selectedPlantIds) {
    const plantObj = allPlants.find((p) => String(p.plant_id) === String(plantId));
    const plantDisplayName = getPlantDisplayName(plantId, plantObj);
    const shortCode = getPlantShortCode(plantId);

    const report = computePlantCycleTime(entries, master, reasonCodes, plantId, {
      threshold: config.threshold || 110,
      minHours: config.minHours !== undefined ? config.minHours : 2,
      period,
      date: customDate,
      machines,
      shifts,
    });

    report.plantDisplayName = plantDisplayName;
    report.plantShortCode = shortCode;
    plantReports.push(report);
  }

  // Generate subject line with placeholders
  const displayDateStr = customDate ? fmtDateShort(customDate) : fmtDateShort(getIstDateStr(period === "yesterday" ? -1 : 0));
  const rawSubject = config.subject || "Daily Cycle Time Tracker Report - [DATE]";
  const subject = (isTest ? "[TEST EMAIL] " : "") +
    rawSubject
      .replace(/\[DATE\]/gi, displayDateStr)
      .replace(/\[PERIOD\]/gi, periodLabel)
      .replace(/\[PLANTS\]/gi, `${selectedPlantIds.length} Plants`);

  // HTML email body: renders the full executive dashboard and suspicious tables directly in HTML!
  // No external SVG attachments and no broken <img src="cid:...">
  const html = generateCycleTimeEmailHtml({
    plantReports,
    subject,
    introText: config.bodyIntro,
    periodLabel,
    dateStr: displayDateStr,
  });

  const text = generateCycleTimeEmailText({
    plantReports,
    subject,
    introText: config.bodyIntro,
    periodLabel,
  });

  try {
    // Deliver email with ZERO separate SVG file attachments so Outlook displays clean inline report
    const sendResult = await sendCycleTimeEmail({
      to: toList,
      cc: ccList,
      bcc: bccList,
      subject,
      html,
      text,
      attachments: [],
    });

    const sentTimestamp = new Date().toISOString();
    const curDateStr = getIstDateStr(0);

    if (effectiveRuleId) {
      cloudStorage.updateAutoEmailRule(effectiveRuleId, {
        lastSentAt: sentTimestamp,
        lastSentDateStr: curDateStr,
        lastStatus: "success",
        lastError: null,
      });
    }

    cloudStorage.saveAutoEmailConfig({
      lastSentAt: sentTimestamp,
      lastSentDateStr: curDateStr,
      lastStatus: "success",
      lastError: null,
    });

    cloudStorage.addEmailLog({
      type: isTest ? "test" : "scheduled",
      status: "success",
      ruleId: effectiveRuleId,
      ruleName,
      recipients: [...toList, ...ccList],
      plants: plantReports.map((p) => p.plantDisplayName || p.plantId),
      subject,
      message: `[${ruleName}] Successfully delivered for ${periodLabel} to ${toList.length + ccList.length} recipients.`,
      error: null,
    });

    return {
      success: true,
      message: `[${ruleName}] Email successfully delivered to ${toList.length + ccList.length} recipients for ${periodLabel}.`,
      info: sendResult,
    };
  } catch (err) {
    console.error(`[AUTO EMAIL] Delivery failed for "${ruleName}":`, err.message);

    if (effectiveRuleId) {
      cloudStorage.updateAutoEmailRule(effectiveRuleId, {
        lastStatus: "failed",
        lastError: err.message,
      });
    }

    cloudStorage.saveAutoEmailConfig({
      lastStatus: "failed",
      lastError: err.message,
    });

    cloudStorage.addEmailLog({
      type: isTest ? "test" : "scheduled",
      status: "failed",
      ruleId: effectiveRuleId,
      ruleName,
      recipients: [...toList, ...ccList],
      plants: plantReports.map((p) => p.plantDisplayName || p.plantId),
      subject,
      error: err.message,
    });

    if (isTest) throw err;
    return { success: false, error: err.message };
  }
}

/**
 * Background Scheduler: Runs every 60s, checks IST time vs each rule's scheduleTime
 */
let schedulerInterval = null;

export function initAutoEmailScheduler() {
  if (schedulerInterval) return;

  console.log("[AUTO EMAIL] Initializing cycle time tracker background scheduler (checks rules every 60s in IST)...");

  schedulerInterval = setInterval(async () => {
    try {
      const config = cloudStorage.getAutoEmailConfig();
      if (!config) return;

      const rules = Array.isArray(config.rules) && config.rules.length > 0 ? config.rules : [config];
      const currentIstTime = getIstTimeStr(); // "HH:mm"
      const currentIstDate = getIstDateStr(0); // "YYYY-MM-DD"

      for (const rule of rules) {
        if (!rule || !rule.enabled) continue;
        const targetTime = (rule.scheduleTime || "08:00").trim();
        if (currentIstTime !== targetTime) continue;

        if (rule.lastSentDateStr === currentIstDate) {
          // Already sent today for this rule
          continue;
        }

        console.log(`[AUTO EMAIL] Triggering scheduled notification rule "${rule.name || rule.id}" at ${currentIstTime} IST for ${currentIstDate}...`);
        await executeCycleTimeEmailJob({
          ruleId: rule.id,
          configOverride: rule,
          isTest: false,
        });
      }
    } catch (err) {
      console.error("[AUTO EMAIL SCHEDULER ERROR]:", err.message);
    }
  }, 60 * 1000);
}

// -------------------------------------------------------------
// API Routes
// -------------------------------------------------------------

// GET /api/auto-email/config
autoEmailRouter.get("/config", (_req, res) => {
  try {
    const config = cloudStorage.getAutoEmailConfig();
    res.json({ success: true, config });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/auto-email/config
autoEmailRouter.post("/config", (req, res) => {
  try {
    const updated = cloudStorage.saveAutoEmailConfig(req.body);
    res.json({ success: true, config: updated, message: "Auto-email configuration saved successfully." });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// POST /api/auto-email/send-test
autoEmailRouter.post("/send-test", async (req, res) => {
  try {
    const { testTo, testCc, testDate, ruleId, configOverride } = req.body || {};
    const result = await executeCycleTimeEmailJob({
      isTest: true,
      ruleId,
      testTo,
      testCc,
      testDate,
      configOverride,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message || "Failed to send test email. Check SMTP credentials or recipient addresses.",
    });
  }
});

// GET /api/auto-email/preview
autoEmailRouter.get("/preview", (req, res) => {
  try {
    const baseConfig = cloudStorage.getAutoEmailConfig();
    let rule = null;
    if (req.query.ruleId && Array.isArray(baseConfig.rules)) {
      rule = baseConfig.rules.find((r) => r.id === req.query.ruleId);
    }
    const effectiveConfig = { ...baseConfig, ...(rule || {}) };

    const period = req.query.period || effectiveConfig.dateMode || effectiveConfig.period || "yesterday";
    const customDate = req.query.date || (effectiveConfig.dateMode === "specific" && effectiveConfig.specificDate ? effectiveConfig.specificDate : null);
    const threshold = Number(req.query.threshold) || effectiveConfig.threshold || 110;
    const minHours = req.query.minHours !== undefined ? Number(req.query.minHours) : (effectiveConfig.minHours ?? 2);
    const rawSelected = req.query.plants ? req.query.plants.split(",") : (effectiveConfig.selectedPlants || ["2020", "4010"]);
    const selectedPlants = sortPlantIds(rawSelected);

    const entries = cloudStorage.getEntries();
    const bootstrap = cloudStorage.getBootstrap();
    const master = bootstrap.master || [];
    const reasonCodes = bootstrap.reasonCodes || [];
    const allPlants = bootstrap.plants || [];
    const machines = bootstrap.machines || [];
    const shifts = bootstrap.shifts || [];

    let periodLabel = "";
    if (customDate) {
      periodLabel = `${fmtDateShort(customDate)} (Shift 1 & Shift 2)`;
    } else if (period === "yesterday") {
      periodLabel = `Yesterday · ${fmtDateShort(getIstDateStr(-1))} (Shift 1 & Shift 2)`;
    } else if (period === "today") {
      periodLabel = `Today · ${fmtDateShort(getIstDateStr(0))} (Shift 1 & Shift 2)`;
    } else if (period === "latest_day") {
      periodLabel = `Latest Production Day (Shift 1 & Shift 2)`;
    } else if (period === "mtd") {
      periodLabel = `Month to Date (${getIstDateStr(0).slice(0, 7)})`;
    } else {
      periodLabel = period;
    }

    const plantReports = [];
    const svgCards = {};

    for (const plantId of selectedPlants) {
      const plantObj = allPlants.find((p) => String(p.plant_id) === String(plantId));
      const plantDisplayName = getPlantDisplayName(plantId, plantObj);
      const shortCode = getPlantShortCode(plantId);

      const report = computePlantCycleTime(entries, master, reasonCodes, plantId, {
        threshold,
        minHours,
        period,
        date: customDate,
        machines,
        shifts,
      });
      report.plantDisplayName = plantDisplayName;
      report.plantShortCode = shortCode;
      plantReports.push(report);

      const svg = generatePlantSvgCard(report, {
        plantName: plantDisplayName,
        periodLabel,
      });
      svgCards[plantId] = svg;
    }

    const displayDateStr = customDate ? fmtDateShort(customDate) : fmtDateShort(getIstDateStr(period === "yesterday" ? -1 : 0));
    const subject = (baseConfig.subject || "Daily Cycle Time Tracker Report - [DATE]")
      .replace(/\[DATE\]/gi, displayDateStr)
      .replace(/\[PERIOD\]/gi, periodLabel)
      .replace(/\[PLANTS\]/gi, `${selectedPlants.length} Plants`);

    const sampleHtml = generateCycleTimeEmailHtml({
      plantReports,
      subject,
      introText: baseConfig.bodyIntro,
      periodLabel,
      dateStr: displayDateStr,
    });

    res.json({
      success: true,
      subject,
      periodLabel,
      customDate,
      plantReports,
      svgCards,
      sampleHtml,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/auto-email/logs
autoEmailRouter.get("/logs", (_req, res) => {
  try {
    const logs = cloudStorage.getEmailLogs();
    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
