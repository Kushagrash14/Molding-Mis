import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import { pool, testConnection } from "./db.js";
import { cloudStorage } from "./storage.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });
dotenv.config({ path: path.join(__dirname, ".env") });
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: "15mb" }));

// In-memory OTP storage
const activeOtps = new Map();

// Health check
app.get("/api/health", async (req, res) => {
  const dbOk = await testConnection();
  res.json({ status: "ok", timestamp: new Date().toISOString(), database: dbOk ? "connected" : "disconnected" });
});

// Send OTP
app.post("/api/send-otp", async (req, res) => {
  try {
    const { email, name, employee_code } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: "Email address is required." });
    }

    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.error("[AUTH ERROR] Missing SMTP_USER or SMTP_PASS environment variables");
      return res.status(500).json({
        success: false,
        error: "SMTP credentials not found on server. Please set SMTP_USER and SMTP_PASS in server/.env or /var/www/production-oee-tracker/.env",
      });
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.office365.com",
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: {
        ciphers: "SSLv3",
        rejectUnauthorized: false,
      },
    });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000;
    activeOtps.set(email.toLowerCase().trim(), { otp, expiresAt, name, employee_code });

    console.log(`[AUTH] Generated OTP for ${email}: ${otp}`);

    const mailOptions = {
      from: `"PGEL Production Portal" <${process.env.SMTP_USER || "no-reply@pgel.in"}>`,
      to: email,
      subject: `🔐 PGEL Portal Verification Code: ${otp}`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
          <div style="text-align: center; margin-bottom: 20px;">
            <div style="font-size: 20px; font-weight: 800; color: #0f172a; letter-spacing: 0.5px;">PG ELECTROPLAST LIMITED</div>
            <div style="color: #64748b; font-size: 12.5px; margin-top: 3px;">Shop Floor Production &amp; OEE Operations Portal</div>
          </div>
          <div style="background: #f8fafc; border-radius: 10px; padding: 22px; text-align: center; border: 1.5px solid #e2e8f0; margin-bottom: 20px;">
            <p style="color: #334155; font-size: 14px; margin: 0 0 10px;">Hello <strong>${name || "Colleague"}</strong> (${employee_code || "PGEL"}),</p>
            <p style="color: #475569; font-size: 13.5px; margin: 0 0 16px;">Use this One-Time Password (OTP) to securely log in:</p>
            <div style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #0284c7; background: #ffffff; padding: 14px 24px; border-radius: 8px; border: 2px dashed #0284c7; display: inline-block; font-family: monospace;">
              ${otp}
            </div>
            <p style="color: #dc2626; font-size: 12px; font-weight: 600; margin: 14px 0 0;">⏱️ Valid for 10 minutes. Do not disclose this code.</p>
          </div>
          <p style="font-size: 11.5px; color: #94a3b8; text-align: center; margin: 0;">
            Automated notification from PGEL Industrial Automation System.
          </p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`[AUTH] OTP email successfully dispatched to ${email}`);

    return res.json({
      success: true,
      message: "Verification code sent to your registered email address.",
    });
  } catch (err) {
    console.error("[AUTH] Send OTP error:", err.message);
    return res.status(500).json({ success: false, error: `Email delivery failed (${err.message}). Please check SMTP settings.` });
  }
});

// Verify OTP (Strict: Only genuine 6-digit cryptographic OTP from email)
app.post("/api/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
    const cleanEmail = (email || "").toLowerCase().trim();
    const cleanOtp = (otp || "").toString().trim();

    const record = activeOtps.get(cleanEmail);
    if (!record) {
      return res.status(400).json({
        success: false,
        error: "No active verification code found for this user. Please request a new OTP.",
      });
    }

    if (Date.now() >= record.expiresAt) {
      activeOtps.delete(cleanEmail);
      return res.status(400).json({
        success: false,
        error: "The verification code has expired (10-minute limit). Please request a new code.",
      });
    }

    if (record.otp !== cleanOtp) {
      return res.status(400).json({
        success: false,
        error: "Invalid security code. Please check the 6-digit code in your email and try again.",
      });
    }

    activeOtps.delete(cleanEmail);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Bootstrap initial data for frontend
app.get("/api/bootstrap", (req, res) => {
  try {
    const data = cloudStorage.getBootstrap();
    res.json(data);
  } catch (err) {
    console.error("Bootstrap error:", err);
    res.status(500).json({ error: "Failed to load bootstrap data", details: err.message });
  }
});

// Users API (Cloud-persisted for all PCs)
app.get("/api/users", (req, res) => {
  try {
    res.json({ success: true, users: cloudStorage.getUsers() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/users", (req, res) => {
  try {
    const user = cloudStorage.saveUser(req.body);
    res.json({ success: true, user });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.delete("/api/users/:id", (req, res) => {
  try {
    const ok = cloudStorage.deleteUser(req.params.id);
    res.json({ success: ok });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Entries API (Cloud-persisted for all PCs)
app.get("/api/entries", (req, res) => {
  try {
    let entries = cloudStorage.getEntries();
    // Optional incremental sync: only return entries updated after ?since=ISO_TIMESTAMP
    const { since } = req.query;
    if (since) {
      const sinceDate = new Date(since);
      if (!isNaN(sinceDate)) {
        entries = entries.filter((e) => e.updated_at && new Date(e.updated_at) > sinceDate);
      }
    }
    res.json({ success: true, entries });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/entries", (req, res) => {
  try {
    const saved = cloudStorage.saveEntry(req.body);
    res.json({ success: true, entry: saved });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post("/api/entries/batch", (req, res) => {
  try {
    const list = Array.isArray(req.body) ? req.body : (req.body.entries || []);
    const processed = cloudStorage.saveEntriesBatch(list);
    res.json({ success: true, entries: processed, count: processed.length });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.put("/api/entries/:id", (req, res) => {
  try {
    const updated = cloudStorage.saveEntry({ ...req.body, entry_id: req.params.id });
    if (req.body.auditEntry) {
      cloudStorage.addAuditLog(req.body.auditEntry);
    }
    res.json({ success: true, entry: updated });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.delete("/api/entries/:id", (req, res) => {
  try {
    const ok = cloudStorage.deleteEntry(req.params.id);
    res.json({ success: ok });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Master Products API
app.post("/api/master/products", (req, res) => {
  try {
    const product = cloudStorage.saveProduct(req.body);
    res.json({ success: true, product });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.delete("/api/master/products/:sap_code", (req, res) => {
  try {
    const ok = cloudStorage.deleteProduct(req.params.sap_code);
    res.json({ success: ok });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Master Machines API
app.post("/api/master/machines", (req, res) => {
  try {
    const machine = cloudStorage.saveMachine(req.body);
    res.json({ success: true, machine });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.delete("/api/master/machines/:id", (req, res) => {
  try {
    const ok = cloudStorage.deleteMachine(req.params.id);
    res.json({ success: ok });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Run lock-cutoff
app.post("/api/lock-cutoff", (req, res) => {
  try {
    const entries = cloudStorage.getEntries();
    const cutoff = Date.now() - 12 * 60 * 60 * 1000;
    let lockedCount = 0;
    for (const e of entries) {
      if (e.status === "submitted" && new Date(e.created_at || 0).getTime() < cutoff) {
        e.status = "locked";
        e.locked_at = new Date().toISOString();
        cloudStorage.saveEntry(e);
        lockedCount++;
      }
    }
    res.json({ success: true, lockedCount });
  } catch (err) {
    res.status(500).json({ error: "Lock cutoff error", details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Molding MIS Backend API running on port ${PORT}`);
});
