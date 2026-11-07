import express from "express";
import { cloudStorage } from "./storage.js";
import { sendCycleTimeEmail } from "./mail.js";
import {
  computePlantCycleTime,
  generatePlantSvgCard,
  generateCycleTimeEmailHtml,
  generateCycleTimeEmailText,
  getIstDateStr,
} from "./cycleTimeReport.js";

export const autoEmailRouter = express.Router();

function getIstTimeStr() {
  return new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata", hour12: false }).slice(0, 5);
}

/**
 * Execute email generation and dispatch
 */
export async function executeCycleTimeEmailJob({
  isTest = false,
  testTo = null,
  testCc = null,
  configOverride = null,
} = {}) {
  const baseConfig = cloudStorage.getAutoEmailConfig();
  const config = { ...baseConfig, ...(configOverride || {}) };

  const recipientsTo = isTest && testTo ? testTo : config.recipientsTo || [];
  const recipientsCc = isTest && testCc ? testCc : config.recipientsCc || [];
  const recipientsBcc = config.recipientsBcc || [];

  const toList = Array.isArray(recipientsTo) ? recipientsTo : String(recipientsTo).split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
  const ccList = Array.isArray(recipientsCc) ? recipientsCc : String(recipientsCc).split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
  const bccList = Array.isArray(recipientsBcc) ? recipientsBcc : String(recipientsBcc).split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);

  if (toList.length === 0 && ccList.length === 0) {
    const msg = "No recipient email addresses found (both To and Cc are empty).";
    if (isTest) throw new Error(msg);
    cloudStorage.addEmailLog({
      type: "scheduled",
      status: "failed",
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

  const selectedPlantIds = Array.isArray(config.selectedPlants) && config.selectedPlants.length > 0
    ? config.selectedPlants
    : allPlants.map((p) => p.plant_id);

  const plantReports = [];
  const attachments = [];

  const period = config.period || "yesterday";
  const periodLabel =
    period === "yesterday"
      ? `Yesterday (${getIstDateStr(-1)})`
      : period === "today"
      ? `Today (${getIstDateStr(0)})`
      : period === "mtd"
      ? `Month to Date (${getIstDateStr(0).slice(0, 7)})`
      : period === "last7days"
      ? `Last 7 Days`
      : period;

  for (const plantId of selectedPlantIds) {
    const plantObj = allPlants.find((p) => String(p.plant_id) === String(plantId));
    const plantName = plantObj ? plantObj.name : `Plant ${plantId}`;

    const report = computePlantCycleTime(entries, master, reasonCodes, plantId, {
      threshold: config.threshold || 110,
      minHours: config.minHours !== undefined ? config.minHours : 2,
      period,
    });

    report.plantName = plantName;
    plantReports.push(report);

    // Generate high-resolution SVG visual snapshot card
    const svgContent = generatePlantSvgCard(report, {
      plantName,
      periodLabel,
    });

    const safeFileName = `${plantName.replace(/[^a-zA-Z0-9_-]/g, "_")}_Cycle_Time.svg`;

    attachments.push({
      filename: safeFileName,
      content: Buffer.from(svgContent, "utf-8"),
      contentType: "image/svg+xml",
      cid: `photo_${plantId}`,
    });
  }

  // Generate subject line with placeholders
  const todayStr = getIstDateStr(0);
  const rawSubject = config.subject || "Daily Cycle Time Tracker Report - [DATE]";
  const subject = (isTest ? "[TEST EMAIL] " : "") +
    rawSubject
      .replace(/\[DATE\]/gi, todayStr)
      .replace(/\[PERIOD\]/gi, periodLabel)
      .replace(/\[PLANTS\]/gi, `${selectedPlantIds.length} Plants`);

  const html = generateCycleTimeEmailHtml({
    plantReports,
    subject,
    introText: config.bodyIntro,
    periodLabel,
    dateStr: todayStr,
    includePhotoAttachment: config.includePhotoAttachment !== false,
  });

  const text = generateCycleTimeEmailText({
    plantReports,
    subject,
    introText: config.bodyIntro,
    periodLabel,
  });

  try {
    const sendResult = await sendCycleTimeEmail({
      to: toList,
      cc: ccList,
      bcc: bccList,
      subject,
      html,
      text,
      attachments: config.includePhotoAttachment !== false ? attachments : [],
    });

    const sentTimestamp = new Date().toISOString();
    const curDateStr = getIstDateStr(0);

    cloudStorage.saveAutoEmailConfig({
      lastSentAt: sentTimestamp,
      lastSentDateStr: curDateStr,
      lastStatus: "success",
      lastError: null,
    });

    cloudStorage.addEmailLog({
      type: isTest ? "test" : "scheduled",
      status: "success",
      recipients: [...toList, ...ccList],
      plants: plantReports.map((p) => p.plantName || p.plantId),
      subject,
      message: `Cycle Time Report successfully sent with ${attachments.length} photo snapshots.`,
      error: null,
    });

    return {
      success: true,
      message: `Email successfully delivered to ${toList.length + ccList.length} recipients.`,
      info: sendResult,
    };
  } catch (err) {
    console.error("[AUTO EMAIL] Delivery failed:", err.message);

    cloudStorage.saveAutoEmailConfig({
      lastStatus: "failed",
      lastError: err.message,
    });

    cloudStorage.addEmailLog({
      type: isTest ? "test" : "scheduled",
      status: "failed",
      recipients: [...toList, ...ccList],
      plants: plantReports.map((p) => p.plantName || p.plantId),
      subject,
      error: err.message,
    });

    if (isTest) throw err;
    return { success: false, error: err.message };
  }
}

/**
 * Background Scheduler: Runs every 60s, checks IST time vs config.scheduleTime
 */
let schedulerInterval = null;

export function initAutoEmailScheduler() {
  if (schedulerInterval) return;

  console.log("[AUTO EMAIL] Initializing cycle time tracker background scheduler (checks every 60s in IST)...");

  schedulerInterval = setInterval(async () => {
    try {
      const config = cloudStorage.getAutoEmailConfig();
      if (!config || !config.enabled) return;

      const currentIstTime = getIstTimeStr(); // "HH:mm"
      const targetTime = (config.scheduleTime || "08:00").trim();

      if (currentIstTime !== targetTime) return;

      const currentIstDate = getIstDateStr(0); // "YYYY-MM-DD"
      if (config.lastSentDateStr === currentIstDate) {
        // Already sent today at this scheduled time
        return;
      }

      console.log(`[AUTO EMAIL] Triggering scheduled Cycle Time Email at ${currentIstTime} IST for ${currentIstDate}...`);
      await executeCycleTimeEmailJob({ isTest: false });
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
    const { testTo, testCc, configOverride } = req.body || {};
    const result = await executeCycleTimeEmailJob({
      isTest: true,
      testTo,
      testCc,
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
    const period = req.query.period || baseConfig.period || "yesterday";
    const threshold = Number(req.query.threshold) || baseConfig.threshold || 110;
    const minHours = req.query.minHours !== undefined ? Number(req.query.minHours) : (baseConfig.minHours ?? 2);
    const selectedPlants = req.query.plants ? req.query.plants.split(",") : (baseConfig.selectedPlants || ["1040"]);

    const entries = cloudStorage.getEntries();
    const bootstrap = cloudStorage.getBootstrap();
    const master = bootstrap.master || [];
    const reasonCodes = bootstrap.reasonCodes || [];
    const allPlants = bootstrap.plants || [];

    const periodLabel =
      period === "yesterday"
        ? `Yesterday (${getIstDateStr(-1)})`
        : period === "today"
        ? `Today (${getIstDateStr(0)})`
        : period === "mtd"
        ? `Month to Date (${getIstDateStr(0).slice(0, 7)})`
        : period === "last7days"
        ? `Last 7 Days`
        : period;

    const plantReports = [];
    const svgCards = {};

    for (const plantId of selectedPlants) {
      const plantObj = allPlants.find((p) => String(p.plant_id) === String(plantId));
      const plantName = plantObj ? plantObj.name : `Plant ${plantId}`;

      const report = computePlantCycleTime(entries, master, reasonCodes, plantId, {
        threshold,
        minHours,
        period,
      });
      report.plantName = plantName;
      plantReports.push(report);

      const svg = generatePlantSvgCard(report, {
        plantName,
        periodLabel,
      });
      svgCards[plantId] = svg;
    }

    const todayStr = getIstDateStr(0);
    const subject = (baseConfig.subject || "Daily Cycle Time Tracker Report - [DATE]")
      .replace(/\[DATE\]/gi, todayStr)
      .replace(/\[PERIOD\]/gi, periodLabel)
      .replace(/\[PLANTS\]/gi, `${selectedPlants.length} Plants`);

    const sampleHtml = generateCycleTimeEmailHtml({
      plantReports,
      subject,
      introText: baseConfig.bodyIntro,
      periodLabel,
      dateStr: todayStr,
      includePhotoAttachment: true,
    });

    res.json({
      success: true,
      subject,
      periodLabel,
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
