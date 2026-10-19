import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { cloudStorage } from "./storage.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SESSION_FILE = path.join(__dirname, "data", "sessions.json");
const COOKIE = "mis_session";
const SESSION_MS = 14 * 60 * 60 * 1000;
const OTP_MS = 10 * 60 * 1000;

const sessions = new Map();
const pendingOtps = new Map();
const hits = new Map();

function loadSessions() {
  try {
    const raw = fs.readFileSync(SESSION_FILE, "utf8");
    const parsed = JSON.parse(raw);
    const now = Date.now();
    for (const row of parsed) {
      if (row?.token && row.expiresAt > now) sessions.set(row.token, row);
    }
  } catch {
    // no session file yet
  }
}

function persistSessions() {
  try {
    fs.mkdirSync(path.dirname(SESSION_FILE), { recursive: true });
    const now = Date.now();
    const rows = [...sessions.values()].filter((s) => s.expiresAt > now);
    fs.writeFileSync(SESSION_FILE, JSON.stringify(rows), "utf8");
  } catch (err) {
    console.error("[AUTH] Could not persist sessions:", err.message);
  }
}

loadSessions();

function asIdList(value) {
  if (Array.isArray(value)) return value.map(String);
  if (value == null || value === "") return [];
  return [String(value)];
}

export function publicUser(user) {
  if (!user) return null;
  const rawRole = String(user.role || "operator").trim().toLowerCase();
  const role = rawRole === "it_admin" ? "admin" : rawRole;
  const plantIds = asIdList(user.assigned_plant_ids);
  const locationIds = asIdList(user.assigned_location_ids || user.assigned_location_id);
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    employee_code: user.employee_code || "",
    name: user.name || user.username,
    role,
    department: user.department || "",
    assigned_location_id: locationIds[0] || user.assigned_location_id || "all",
    assigned_location_ids: locationIds.length ? locationIds : ["all"],
    assigned_plant_ids: plantIds.length ? plantIds : ["1040"],
  };
}

export function accessiblePlantIds(user, plants = []) {
  const safe = publicUser(user);
  const all =
    !safe.assigned_plant_ids ||
    safe.assigned_plant_ids.includes("all") ||
    safe.assigned_location_id === "all" ||
    (Array.isArray(safe.assigned_location_ids) && safe.assigned_location_ids.includes("all"));
  if (all) return plants.map((p) => String(p.plant_id));
  const plantSet = new Set((safe.assigned_plant_ids || []).map(String));
  const locSet = new Set(
    (Array.isArray(safe.assigned_location_ids)
      ? safe.assigned_location_ids
      : safe.assigned_location_id
        ? [safe.assigned_location_id]
        : []
    ).map(String)
  );
  return plants
    .filter((p) => plantSet.has(String(p.plant_id)) || locSet.has(String(p.location_id)))
    .map((p) => String(p.plant_id));
}

export function findRegisteredUser(identifier) {
  const q = String(identifier || "").trim().toLowerCase();
  if (!q || q.length > 120) return null;
  return cloudStorage.getUsers().find((u) => {
    const email = String(u.email || "").toLowerCase();
    return (
      email === q ||
      String(u.employee_code || "").toLowerCase() === q ||
      String(u.username || "").toLowerCase() === q ||
      String(u.id || "").toLowerCase() === q ||
      (email && email.split("@")[0] === q)
    );
  });
}

function maskEmail(email = "") {
  if (!email.includes("@")) return "registered email";
  const [local, domain] = email.split("@");
  if (local.length <= 2) return `${local[0] || "*"}*@${domain}`;
  return `${local[0]}${"•".repeat(Math.max(3, local.length - 3))}${local.slice(-2)}@${domain}`;
}

function clientIp(req) {
  const fwd = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return fwd || req.socket?.remoteAddress || "unknown";
}

export function rateLimit(name, limit, windowMs) {
  return (req, res, next) => {
    const key = `${name}:${clientIp(req)}`;
    const now = Date.now();
    const row = hits.get(key) || { count: 0, reset: now + windowMs };
    if (now > row.reset) {
      row.count = 0;
      row.reset = now + windowMs;
    }
    row.count += 1;
    hits.set(key, row);
    if (row.count > limit) {
      return res.status(429).json({ success: false, error: "Too many attempts. Wait a few minutes and try again." });
    }
    next();
  };
}

function cookieSecure(req) {
  if (process.env.COOKIE_SECURE === "0") return false;
  if (process.env.COOKIE_SECURE === "1") return true;
  const proto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  return proto === "https" || req.secure === true;
}

function readCookie(req, name) {
  const raw = req.headers.cookie || "";
  for (const part of raw.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return "";
}

function writeSessionCookie(req, res, token) {
  const bits = [
    `${COOKIE}=${encodeURIComponent(token)}`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/",
    `Max-Age=${Math.floor(SESSION_MS / 1000)}`,
  ];
  if (cookieSecure(req)) bits.push("Secure");
  res.setHeader("Set-Cookie", bits.join("; "));
}

function clearSessionCookie(req, res) {
  const bits = [`${COOKIE}=`, "HttpOnly", "SameSite=Lax", "Path=/", "Max-Age=0"];
  if (cookieSecure(req)) bits.push("Secure");
  res.setHeader("Set-Cookie", bits.join("; "));
}

export function securityHeaders(_req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
  );
  next();
}

export function rejectCrossSite(req, res, next) {
  const origin = req.headers.origin;
  if (!origin) return next();
  let originHost = "";
  try {
    originHost = new URL(origin).host;
  } catch {
    return res.status(403).json({ success: false, error: "Blocked cross-site request." });
  }
  const forwarded = String(req.headers["x-forwarded-host"] || "").split(",")[0].trim();
  const allowed = new Set([req.headers.host, forwarded].filter(Boolean));
  if (process.env.APP_ORIGIN) {
    try { allowed.add(new URL(process.env.APP_ORIGIN).host); } catch { /* ignore bad env */ }
  }
  if (!allowed.has(originHost)) {
    return res.status(403).json({ success: false, error: "Blocked cross-site request." });
  }
  next();
}

function sessionUser(req) {
  const token = readCookie(req, COOKIE);
  if (!token) return null;
  const row = sessions.get(token);
  if (!row || row.expiresAt < Date.now()) {
    if (row) {
      sessions.delete(token);
      persistSessions();
    }
    return null;
  }
  const user = cloudStorage.getUsers().find((u) => u.id === row.userId);
  if (!user) return null;
  return publicUser(user);
}

export function requireAuth(req, res, next) {
  const user = sessionUser(req);
  if (!user) return res.status(401).json({ success: false, error: "Login required." });
  req.user = user;
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, error: "You do not have access to this." });
    }
    next();
  };
}

function hashOtp(otp) {
  return crypto.createHash("sha256").update(String(otp)).digest();
}

function otpMatches(storedHash, otp) {
  const nextHash = hashOtp(otp);
  if (!storedHash || storedHash.length !== nextHash.length) return false;
  return crypto.timingSafeEqual(storedHash, nextHash);
}

export function issueOtp(user) {
  const otp = String(crypto.randomInt(100000, 1000000));
  pendingOtps.set(user.id, {
    hash: hashOtp(otp),
    expiresAt: Date.now() + OTP_MS,
    attempts: 0,
  });
  return otp;
}

export function checkOtp(user, otp) {
  const row = pendingOtps.get(user.id);
  if (!row) return "missing";
  if (Date.now() >= row.expiresAt) {
    pendingOtps.delete(user.id);
    return "expired";
  }
  row.attempts += 1;
  if (row.attempts > 5) {
    pendingOtps.delete(user.id);
    return "expired";
  }
  if (!otpMatches(row.hash, String(otp || "").trim())) return "invalid";
  pendingOtps.delete(user.id);
  return "ok";
}

export function startSession(req, res, user) {
  const mine = [...sessions.values()]
    .filter((s) => s.userId === user.id)
    .sort((a, b) => a.expiresAt - b.expiresAt);
  while (mine.length >= 5) {
    const oldest = mine.shift();
    sessions.delete(oldest.token);
  }
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, { token, userId: user.id, expiresAt: Date.now() + SESSION_MS });
  persistSessions();
  writeSessionCookie(req, res, token);
  return publicUser(user);
}

export function endSession(req, res) {
  const token = readCookie(req, COOKIE);
  if (token) sessions.delete(token);
  persistSessions();
  clearSessionCookie(req, res);
}

export function maskRegisteredEmail(user) {
  return maskEmail(user.email || "");
}

function unlockedWindow(shiftDate) {
  const d = String(shiftDate || "").slice(0, 10);
  return d >= "2026-10-01" && d <= "2026-10-16";
}

function shiftPastGrace(shiftDate, shiftId, shifts) {
  if (unlockedWindow(shiftDate)) return false;
  const shift = (shifts || []).find((s) => s.shift_id === shiftId) || shifts?.[0];
  if (!shiftDate || !shift?.start_time || !shift?.end_time) return false;
  const parts = String(shiftDate).slice(0, 10).split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return false;
  const [sY, sM, sD] = parts;
  const [sh, sm] = String(shift.start_time).split(":").map(Number);
  const [eh, em] = String(shift.end_time).split(":").map(Number);
  const startMin = (sh || 0) * 60 + (sm || 0);
  const endMin = (eh || 0) * 60 + (em || 0);
  const endDate = endMin > startMin
    ? new Date(sY, sM - 1, sD, eh || 0, em || 0, 0, 0)
    : new Date(sY, sM - 1, sD + 1, eh || 0, em || 0, 0, 0);
  const graceHours = new Date(sY, sM - 1, sD).getDay() === 6 ? 48 : 24;
  return Date.now() > endDate.getTime() + graceHours * 60 * 60 * 1000;
}

function activeGrant(user, plantId, shiftDate) {
  const day = String(shiftDate || "").slice(0, 10);
  const now = Date.now();
  return cloudStorage.listAccessRequests().some(
    (g) =>
      g.status === "approved" &&
      g.requested_by === user.id &&
      String(g.plant_id || "1040") === String(plantId || "1040") &&
      g.unlock_until &&
      new Date(g.unlock_until).getTime() > now &&
      (g.dates || []).includes(day)
  );
}

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

export function assertPlant(user, plantId) {
  const data = cloudStorage.getBootstrap();
  const allowed = accessiblePlantIds(user, data.plants);
  if (!allowed.includes(String(plantId || ""))) {
    throw httpError(403, "That plant is outside your access.");
  }
  return data;
}

export function assertCanWriteEntry(user, entry) {
  const data = assertPlant(user, entry?.plant_id);
  if (user.role === "admin") return;
  if (user.role !== "operator") throw httpError(403, "Your role cannot edit production entries.");
  if (unlockedWindow(entry.shift_date)) return;
  if (activeGrant(user, entry.plant_id, entry.shift_date)) return;
  if (shiftPastGrace(entry.shift_date, entry.shift_id, data.shifts)) {
    throw httpError(403, "This shift is locked. Ask the Plant Head for access.");
  }
}

export function scopeBootstrap(user) {
  const data = cloudStorage.getBootstrap();
  const allowed = new Set(accessiblePlantIds(user, data.plants));
  const isAdmin = user.role === "admin";
  const requests = (data.accessRequests || []).filter((r) => {
    if (isAdmin) return true;
    if (user.role === "plant_head") return allowed.has(String(r.plant_id));
    return r.requested_by === user.id;
  });
  return {
    currentUser: user,
    users: isAdmin ? data.users.map(publicUser) : [user],
    master: data.master.filter((p) => allowed.has(String(p.plant_id))),
    machines: data.machines.filter((m) => allowed.has(String(m.plant_id))),
    shifts: data.shifts,
    locations: data.locations.filter((l) => data.plants.some((p) => p.location_id === l.location_id && allowed.has(String(p.plant_id)))),
    plants: data.plants.filter((p) => allowed.has(String(p.plant_id))),
    reasonCodes: data.reasonCodes,
    entries: data.entries.filter((e) => allowed.has(String(e.plant_id))),
    auditLog: isAdmin ? data.auditLog : [],
    accessRequests: requests,
  };
}
