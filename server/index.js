import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import dotenv from "dotenv";
import { testConnection } from "./db.js";
import { cloudStorage } from "./storage.js";
import { sendLoginOtp } from "./mail.js";
import { autoEmailRouter, initAutoEmailScheduler } from "./autoEmail.js";
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
    const role = ["operator", "supervisor", "plant_head", "dashboard_viewer", "viewer", "admin"].includes(req.body?.role)
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

  // Optional filters for Level-2 paged Plant Entries
  const plantId = req.query.plant_id && req.query.plant_id !== "all" ? String(req.query.plant_id) : null;
  if (plantId) {
    if (!allowed.has(plantId)) {
      return res.status(403).json({ success: false, error: "Plant not accessible." });
    }
    entries = entries.filter((e) => String(e.plant_id) === plantId);
  }

  const enteredBy = req.query.entered_by ? String(req.query.entered_by) : null;
  if (enteredBy) {
    entries = entries.filter((e) => String(e.entered_by) === enteredBy);
  }

  const q = String(req.query.q || "").trim().toLowerCase();
  if (q) {
    const machineMap = new Map((data.machines || []).map((m) => [String(m.machine_id), m]));
    const plantMap = new Map((data.plants || []).map((p) => [String(p.plant_id), p]));
    entries = entries.filter((e) => {
      const mc = machineMap.get(String(e.machine_id));
      const mcText = `${mc?.machine_no || ""} ${e.machine_id || ""}`.toLowerCase();
      const pObj = plantMap.get(String(e.plant_id));
      const plantText = `${pObj?.name || ""} ${e.plant_id || ""}`.toLowerCase();
      const runsMatch = (e.runs || []).some(
        (r) =>
          String(r.sap_code || "").toLowerCase().includes(q) ||
          String(r.part_no || "").toLowerCase().includes(q) ||
          String(r.material_description || "").toLowerCase().includes(q) ||
          (r.cavity_parts || []).some(
            (cp) =>
              String(cp.sap_code || "").toLowerCase().includes(q) ||
              String(cp.material_description || "").toLowerCase().includes(q) ||
              String(cp.part_no || "").toLowerCase().includes(q)
          )
      );
      return (
        String(e.sap_code || "").toLowerCase().includes(q) ||
        String(e.primary_sap_code || "").toLowerCase().includes(q) ||
        String(e.shift_date || "").toLowerCase().includes(q) ||
        String(e.shift_id || "").toLowerCase().includes(q) ||
        String(e.entered_by_name || "").toLowerCase().includes(q) ||
        mcText.includes(q) ||
        plantText.includes(q) ||
        runsMatch
      );
    });
  }

  // Newest first (created_at, fallback shift_date)
  entries = [...entries].sort((a, b) => {
    const ta = new Date(a.created_at || a.shift_date || 0).getTime();
    const tb = new Date(b.created_at || b.shift_date || 0).getTime();
    return tb - ta;
  });

  const total = entries.length;
  const hasPaging = req.query.limit != null && String(req.query.limit).length > 0;
  if (hasPaging) {
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    const page = entries.slice(offset, offset + limit);
    return res.json({
      success: true,
      entries: page,
      total,
      limit,
      offset,
      hasMore: offset + page.length < total,
    });
  }

  res.json({ success: true, entries, total });
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
    const ok = cloudStorage.deleteProduct(req.params.sap_code, plantId);
    res.json({ success: ok });
  } catch (err) {
    sendError(res, err);
  }
});

app.post("/api/master/machines", requireAuth, requireRole("admin"), (req, res) => {
  try {
    const machine = cloudStorage.saveMachine(req.body);
    res.json({ success: true, machine });
  } catch (err) {
    sendError(res, err);
  }
});

app.delete("/api/master/machines/:id", requireAuth, requireRole("admin"), (req, res) => {
  try {
    const ok = cloudStorage.deleteMachine(req.params.id);
    res.json({ success: ok });
  } catch (err) {
    sendError(res, err);
  }
});

// Locations CRUD
app.post("/api/master/locations", requireAuth, requireRole("admin"), (req, res) => {
  try {
    const location = cloudStorage.saveLocation(req.body);
    res.json({ success: true, location });
  } catch (err) {
    sendError(res, err);
  }
});

app.delete("/api/master/locations/:id", requireAuth, requireRole("admin"), (req, res) => {
  try {
    const ok = cloudStorage.deleteLocation(req.params.id);
    res.json({ success: ok });
  } catch (err) {
    sendError(res, err);
  }
});

// Plants CRUD
app.post("/api/master/plants", requireAuth, requireRole("admin"), (req, res) => {
  try {
    const plant = cloudStorage.savePlant(req.body);
    res.json({ success: true, plant });
  } catch (err) {
    sendError(res, err);
  }
});

app.delete("/api/master/plants/:id", requireAuth, requireRole("admin"), (req, res) => {
  try {
    const ok = cloudStorage.deletePlant(req.params.id);
    res.json({ success: ok });
  } catch (err) {
    sendError(res, err);
  }
});

// Shifts CRUD
app.post("/api/master/shifts", requireAuth, requireRole("admin"), (req, res) => {
  try {
    const shift = cloudStorage.saveShift(req.body);
    res.json({ success: true, shift });
  } catch (err) {
    sendError(res, err);
  }
});

app.post("/api/master/shifts/bulk", requireAuth, requireRole("admin"), (req, res) => {
  try {
    const shifts = cloudStorage.saveAllShifts(req.body?.shifts || []);
    res.json({ success: true, shifts });
  } catch (err) {
    sendError(res, err);
  }
});

app.delete("/api/master/shifts/:id", requireAuth, requireRole("admin"), (req, res) => {
  try {
    const ok = cloudStorage.deleteShift(req.params.id);
    res.json({ success: ok });
  } catch (err) {
    sendError(res, err);
  }
});

// Downtime Reasons CRUD
app.post("/api/master/reasons", requireAuth, requireRole("admin"), (req, res) => {
  try {
    const reason = cloudStorage.saveReason(req.body);
    res.json({ success: true, reason });
  } catch (err) {
    sendError(res, err);
  }
});

app.delete("/api/master/reasons/:id", requireAuth, requireRole("admin"), (req, res) => {
  try {
    const ok = cloudStorage.deleteReason(req.params.id);
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

app.post("/api/access-requests/special", requireAuth, requireRole("plant_head", "admin"), (req, res) => {
  try {
    const { plant_ids, dates, duration_hours, note } = req.body || {};
    if (!Array.isArray(plant_ids) || plant_ids.length === 0) {
      return res.status(400).json({ success: false, error: "Please select at least one plant." });
    }
    if (!Array.isArray(dates) || dates.length === 0) {
      return res.status(400).json({ success: false, error: "Please select at least one date." });
    }
    for (const pid of plant_ids) {
      assertPlant(req.user, pid);
    }
    const requests = cloudStorage.createSpecialApproval({
      plant_ids,
      dates,
      duration_hours: Number(duration_hours) || 24,
      note,
      user: req.user,
    });
    res.json({ success: true, requests });
  } catch (err) {
    sendError(res, err);
  }
});

app.post("/api/access-requests/:id/revoke", requireAuth, requireRole("plant_head", "admin"), (req, res) => {
  try {
    const existing = cloudStorage.listAccessRequests().find((r) => r.id === req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "Request not found." });
    assertPlant(req.user, existing.plant_id);
    const request = cloudStorage.revokeAccessRequest(req.params.id, req.user);
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
          (!g.requested_by || g.requested_by === "*" || g.requested_by === "all" || g.is_special || g.requested_by === e.entered_by) &&
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

app.use("/api/auto-email", requireAuth, requireRole("admin"), autoEmailRouter);

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
  initAutoEmailScheduler();
});
