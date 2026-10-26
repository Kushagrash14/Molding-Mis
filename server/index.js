import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import dotenv from "dotenv";
import { testConnection } from "./db.js";
import { cloudStorage } from "./storage.js";
import { sendLoginOtp } from "./mail.js";
import {
  securityHeaders,
  rejectCrossSite,
  rateLimit,
  requireAuth,
  requireRole,
  findRegisteredUser,
  issueOtp,
  checkOtp,
  startSession,
  endSession,
  maskRegisteredEmail,
  assertCanWriteEntry,
  assertPlant,
  scopeBootstrap,
  accessiblePlantIds,
} from "./security.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });
dotenv.config({ path: path.join(__dirname, ".env") });
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use(securityHeaders);
app.use(rejectCrossSite);
app.use(express.json({ limit: "2mb" }));
const limitWrites = rateLimit("write", 300, 60 * 1000);

function sendError(res, err) {
  const status = err.status || 400;
  res.status(status).json({ success: false, error: err.message || "Request failed." });
}

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/auth/send-otp", rateLimit("send-otp", 5, 15 * 60 * 1000), async (req, res) => {
  try {
    const user = findRegisteredUser(req.body?.identifier);
    if (!user || !user.email) {
      return res.status(400).json({ success: false, error: "No registered account was found for that email or employee code." });
    }
    const otp = issueOtp(user);
    await sendLoginOtp({
      to: user.email,
      name: user.name,
      employeeCode: user.employee_code,
      otp,
    });
    return res.json({
      success: true,
      name: user.name,
      employee_code: user.employee_code || "",
      maskedEmail: maskRegisteredEmail(user),
    });
  } catch (err) {
    console.error("[AUTH] OTP email failed:", err.message);
    return res.status(err.status || 503).json({
      success: false,
      error: "Could not send the verification email. Try again in a minute.",
    });
  }
});

app.post("/api/auth/verify-otp", rateLimit("verify-otp", 10, 15 * 60 * 1000), (req, res) => {
  const user = findRegisteredUser(req.body?.identifier);
  if (!user) {
    return res.status(400).json({ success: false, error: "Invalid or expired verification code." });
  }
  const result = checkOtp(user, req.body?.otp);
  if (result !== "ok") {
    const error = result === "expired"
      ? "The verification code has expired. Request a new code."
      : "Invalid or expired verification code.";
    return res.status(400).json({ success: false, error });
  }
  const sessionUser = startSession(req, res, user);
  return res.json({ success: true, user: sessionUser });
});

app.post("/api/auth/logout", (req, res) => {
  endSession(req, res);
  res.json({ success: true });
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({ success: true, user: req.user });
});

app.get("/api/bootstrap", requireAuth, (req, res) => {
  try {
    res.json(scopeBootstrap(req.user));
  } catch (err) {
    sendError(res, err);
  }
});

app.get("/api/users", requireAuth, requireRole("admin"), (_req, res) => {
  res.json({ success: true, users: cloudStorage.getUsers() });
});

app.post("/api/users", requireAuth, requireRole("admin"), (req, res) => {
  try {
    const role = ["operator", "supervisor", "plant_head", "admin"].includes(req.body?.role)
      ? req.body.role
      : "operator";
    const user = cloudStorage.saveUser({ ...req.body, role });
    res.json({ success: true, user });
  } catch (err) {
    sendError(res, err);
  }
});

app.delete("/api/users/:id", requireAuth, requireRole("admin"), (req, res) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ success: false, error: "You cannot delete the account you are logged in with." });
    }
    const ok = cloudStorage.deleteUser(req.params.id);
    res.json({ success: ok });
  } catch (err) {
    sendError(res, err);
  }
});

app.get("/api/entries", requireAuth, (req, res) => {
  const data = cloudStorage.getBootstrap();
  const allowed = new Set(accessiblePlantIds(req.user, data.plants));
  let entries = data.entries.filter((e) => allowed.has(String(e.plant_id)));
  const since = req.query.since;
  if (since) {
    const sinceDate = new Date(since);
    if (!Number.isNaN(sinceDate.getTime())) {
      entries = entries.filter((e) => e.updated_at && new Date(e.updated_at) > sinceDate);
    }
  }
  res.json({ success: true, entries });
});

app.post("/api/entries", requireAuth, limitWrites, (req, res) => {
  try {
    const entry = { ...req.body };
    const existing = entry.entry_id
      ? cloudStorage.getEntries().find((e) => e.entry_id === entry.entry_id)
      : null;
    if (existing) {
      assertPlant(req.user, existing.plant_id);
      entry.plant_id = existing.plant_id;
      entry.entered_by = existing.entered_by || req.user.id;
      entry.entered_by_name = existing.entered_by_name || req.user.name;
    } else if (req.user.role === "operator") {
      entry.entered_by = req.user.id;
      entry.entered_by_name = req.user.name;
    }
    assertCanWriteEntry(req.user, entry);
    const saved = cloudStorage.saveEntry(entry);
    res.json({ success: true, entry: saved });
  } catch (err) {
    sendError(res, err);
  }
});

app.post("/api/entries/batch", requireAuth, limitWrites, (req, res) => {
  try {
    const list = Array.isArray(req.body) ? req.body : (req.body?.entries || []);
    if (list.length > 200) {
      return res.status(400).json({ success: false, error: "Too many entries in one request." });
    }
    const prepared = list.map((raw) => {
      const entry = { ...raw };
      const existing = entry.entry_id
        ? cloudStorage.getEntries().find((e) => e.entry_id === entry.entry_id)
        : null;
      if (existing) {
        assertPlant(req.user, existing.plant_id);
        entry.plant_id = existing.plant_id;
        entry.entered_by = existing.entered_by || req.user.id;
        entry.entered_by_name = existing.entered_by_name || req.user.name;
      } else if (req.user.role === "operator") {
        entry.entered_by = req.user.id;
        entry.entered_by_name = req.user.name;
      }
      assertCanWriteEntry(req.user, entry);
      return entry;
    });
    const processed = cloudStorage.saveEntriesBatch(prepared);
    res.json({ success: true, entries: processed, count: processed.length });
  } catch (err) {
    sendError(res, err);
  }
});

app.put("/api/entries/:id", requireAuth, limitWrites, (req, res) => {
  try {
    const existing = cloudStorage.getEntries().find((e) => e.entry_id === req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "Entry not found." });
    assertPlant(req.user, existing.plant_id);
    const entry = { ...existing, ...req.body, entry_id: req.params.id, plant_id: existing.plant_id };
    entry.entered_by = existing.entered_by;
    entry.entered_by_name = existing.entered_by_name;
    assertCanWriteEntry(req.user, entry);
    const updated = cloudStorage.saveEntry(entry);
    if (req.user.role === "admin" && req.body?.auditEntry) {
      cloudStorage.addAuditLog({
        ...req.body.auditEntry,
        changed_by: req.user.id,
        changed_by_name: req.user.name,
      });
    }
    res.json({ success: true, entry: updated });
  } catch (err) {
    sendError(res, err);
  }
});

app.delete("/api/entries/:id", requireAuth, requireRole("admin"), (req, res) => {
  try {
    const existing = cloudStorage.getEntries().find((e) => e.entry_id === req.params.id);
    if (existing) assertPlant(req.user, existing.plant_id);
    const ok = cloudStorage.deleteEntry(req.params.id);
    res.json({ success: ok });
  } catch (err) {
    sendError(res, err);
  }
});

app.post("/api/master/products", requireAuth, requireRole("admin"), (req, res) => {
  try {
    assertPlant(req.user, req.body?.plant_id);
    const product = cloudStorage.saveProduct(req.body);
    res.json({ success: true, product });
  } catch (err) {
    sendError(res, err);
  }
});

app.delete("/api/master/products/:sap_code", requireAuth, requireRole("admin"), (req, res) => {
  try {
    const plantId = String(req.query.plant_id || "");
    if (!plantId) return res.status(400).json({ success: false, error: "Plant is required." });
    assertPlant(req.user, plantId);
    const ok = cloudStorage.deleteProduct(req.params.sap_code, plantId);
    res.json({ success: ok });
  } catch (err) {
    sendError(res, err);
  }
});

app.post("/api/master/machines", requireAuth, requireRole("admin"), (req, res) => {
  try {
    const existing = cloudStorage.getBootstrap().machines.find(
      (m) => m.machine_id === String(req.body?.machine_id || "").trim().toUpperCase()
    );
    if (existing) assertPlant(req.user, existing.plant_id);
    assertPlant(req.user, req.body?.plant_id);
    const machine = cloudStorage.saveMachine(req.body);
    res.json({ success: true, machine });
  } catch (err) {
    sendError(res, err);
  }
});

app.delete("/api/master/machines/:id", requireAuth, requireRole("admin"), (req, res) => {
  try {
    const existing = cloudStorage.getBootstrap().machines.find((m) => m.machine_id === req.params.id);
    if (existing) assertPlant(req.user, existing.plant_id);
    const ok = cloudStorage.deleteMachine(req.params.id);
    res.json({ success: ok });
  } catch (err) {
    sendError(res, err);
  }
});

app.post("/api/access-requests", requireAuth, requireRole("operator"), (req, res) => {
  try {
    assertPlant(req.user, req.body?.plant_id);
    const request = cloudStorage.createAccessRequest({
      ...req.body,
      plant_id: req.body?.plant_id,
      requested_by: req.user.id,
      requested_by_name: req.user.name,
    });
    res.json({ success: true, request });
  } catch (err) {
    sendError(res, err);
  }
});

app.post("/api/access-requests/:id/decide", requireAuth, requireRole("plant_head", "admin"), (req, res) => {
  try {
    const existing = cloudStorage.listAccessRequests().find((r) => r.id === req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "Request not found." });
    assertPlant(req.user, existing.plant_id);
    const request = cloudStorage.decideAccessRequest(req.params.id, {
      approve: Boolean(req.body?.approve),
      decided_by: req.user.id,
      decided_by_name: req.user.name,
    });
    res.json({ success: true, request });
  } catch (err) {
    sendError(res, err);
  }
});

app.post("/api/lock-cutoff", requireAuth, requireRole("admin"), (_req, res) => {
  try {
    const entries = cloudStorage.getEntries();
    const grants = cloudStorage.listAccessRequests();
    const now = Date.now();
    const coveredByGrant = (e) => {
      const day = String(e.shift_date || "").slice(0, 10);
      return grants.some(
        (g) =>
          g.status === "approved" &&
          g.requested_by === e.entered_by &&
          String(g.plant_id || "1040") === String(e.plant_id || "1040") &&
          g.unlock_until &&
          new Date(g.unlock_until).getTime() > now &&
          (g.dates || []).includes(day)
      );
    };
    let lockedCount = 0;
    for (const e of entries) {
      const shiftDay = String(e.shift_date || "").slice(0, 10);
      if ((shiftDay >= "2026-10-01" && shiftDay <= "2026-10-16") || shiftDay === "2026-10-19" || shiftDay === "2026-10-20" || shiftDay === "2026-10-23") {
        if (e.status === "locked") {
          e.status = "submitted";
          e.locked_at = null;
          cloudStorage.saveEntry(e);
        }
        continue;
      }
      if (coveredByGrant(e)) {
        if (e.status === "locked") {
          e.status = "submitted";
          e.locked_at = null;
          cloudStorage.saveEntry(e);
        }
        continue;
      }
      if (e.status === "submitted") {
        let graceHours = 24;
        if (e.shift_date) {
          const parts = e.shift_date.split("-").map(Number);
          if (parts.length === 3) {
            const shiftDateObj = new Date(parts[0], parts[1] - 1, parts[2]);
            if (shiftDateObj.getDay() === 6) graceHours = 48;
          }
        }
        const cutoff = now - graceHours * 60 * 60 * 1000;
        const entryTime = new Date(e.created_at || e.shift_date || 0).getTime();
        if (entryTime < cutoff) {
          e.status = "locked";
          e.locked_at = new Date().toISOString();
          cloudStorage.saveEntry(e);
          lockedCount++;
        }
      }
    }
    res.json({ success: true, lockedCount });
  } catch (err) {
    sendError(res, err);
  }
});

app.use("/api", (_req, res) => {
  res.status(404).json({ success: false, error: "Not found." });
});

app.use((err, _req, res, _next) => {
  console.error("[API]", err.message);
  res.status(err.status || 400).json({ success: false, error: "Request failed." });
});

app.listen(PORT, async () => {
  console.log(`Molding MIS Backend API running on port ${PORT}`);
  const dbOk = await testConnection().catch(() => false);
  if (!dbOk) console.warn("[DB] Database check did not connect. JSON store is still in use.");
  if (!process.env.SMTP_PASS || !process.env.SMTP_USER) {
    console.warn("[AUTH] SMTP_USER and SMTP_PASS are not set. Login emails will fail until they are added to .env.");
  }
});
