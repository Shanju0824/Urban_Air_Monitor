import cors from "cors";
import crypto from "node:crypto";
import dotenv from "dotenv";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { connectDb } from "./db.js";
import { buildDashboard } from "./analytics.js";
import { Station } from "./models/Station.js";
import { Authority } from "./models/Authority.js";
import { AccessRequest } from "./models/AccessRequest.js";
import { policyActions, stations as sampleStations } from "./sampleData.js";

dotenv.config();

const PORT = process.env.PORT || 5000;
const app = express();
let usingMongo = false;
const scrypt = promisify(crypto.scrypt);
const sessionSecret = process.env.SESSION_SECRET || (process.env.VERCEL ? "" : crypto.randomBytes(32).toString("hex"));
if ((process.env.VERCEL || process.env.RENDER) && sessionSecret.length < 32) throw new Error("Set SESSION_SECRET to a random value of at least 32 characters in deployment environment variables.");
const sessionCookie = "air_monitor_session";
const loginAttempts = new Map();
const accessRequestAttempts = new Map();
const SESSION_MS = 8 * 60 * 60 * 1000;
const trustedOrigins = new Set(
  (process.env.CLIENT_ORIGIN || "http://127.0.0.1:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
);

app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    callback(null, !origin || trustedOrigins.has(origin));
  },
  credentials: true
}));
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));
app.use("/api", (req, res, next) => {
  const origin = req.get("origin");
  const deploymentHost = req.get("x-forwarded-host") || req.get("host");
  const deploymentProtocol = req.get("x-forwarded-proto") || req.protocol;
  const sameDeploymentOrigin = (process.env.VERCEL || process.env.RENDER) && origin && origin === `${deploymentProtocol}://${deploymentHost}`;
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method) && !trustedOrigins.has(origin) && !sameDeploymentOrigin) {
    return res.status(403).json({ message: "Request origin is not allowed." });
  }
  next();
});

function signSession(userId, expiresAt) {
  const payload = `${userId}.${expiresAt}`;
  const signature = crypto.createHmac("sha256", sessionSecret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function readSession(value = "") {
  const [userId, expiresAt, signature, extra] = value.split(".");
  if (!userId || !expiresAt || !signature || extra || Number(expiresAt) <= Date.now()) return null;
  const expected = crypto.createHmac("sha256", sessionSecret).update(`${userId}.${expiresAt}`).digest();
  let actual;
  try { actual = Buffer.from(signature, "base64url"); } catch { return null; }
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected) ? userId : null;
}

function setSessionCookie(res, userId) {
  res.cookie(sessionCookie, signSession(userId, Date.now() + SESSION_MS), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: SESSION_MS,
    path: "/api"
  });
}

async function requireAuthority(req, res, next) {
  try {
    if (!usingMongo) return res.status(503).json({ message: "Authority sign-in is unavailable until MongoDB is connected." });
    const userId = readSession(req.cookies?.[sessionCookie]);
    if (!userId) return res.status(401).json({ message: "Sign in to continue." });
    const user = await Authority.findById(userId).select("username role active").lean();
    if (!user || !user.active) return res.status(401).json({ message: "This account is inactive. Contact your administrator." });
    req.authority = user;
    next();
  } catch (error) { next(error); }
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

async function verifyPassword(password, stored) {
  if (!stored || !stored.includes(":")) return false;
  const [saltHex, hashHex] = stored.split(":");
  const expected = Buffer.from(hashHex, "hex");
  const actual = await scrypt(password, Buffer.from(saltHex, "hex"), expected.length, { N: 16384, r: 8, p: 1 });
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function strongPassword(password) {
  return typeof password === "string" && password.length >= 12 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password);
}

app.use((req, res, next) => {
  const cookie = req.headers.cookie || "";
  req.cookies = {};
  for (const item of cookie.split(";")) {
    const separator = item.indexOf("=");
    if (separator < 1) continue;
    try { req.cookies[item.slice(0, separator).trim()] = decodeURIComponent(item.slice(separator + 1).trim()); } catch { /* Ignore malformed cookies. */ }
  }
  next();
});

app.post("/api/auth/login", async (req, res, next) => {
  try {
    if (!usingMongo) return res.status(503).json({ message: "Sign-in requires a connected MongoDB database." });
    const ip = req.ip || "unknown";
    const now = Date.now();
    const attempt = loginAttempts.get(ip) || { count: 0, since: now };
    if (now - attempt.since > 15 * 60 * 1000) { attempt.count = 0; attempt.since = now; }
    if (attempt.count >= 5) return res.status(429).json({ message: "Too many sign-in attempts. Wait 15 minutes and try again." });
    const username = String(req.body.username || "").trim().toLowerCase().slice(0, 41);
    const password = String(req.body.password || "").slice(0, 1025);
    const user = await Authority.findOne({ username }).select("+passwordHash");
    if (!user || !user.active || !(await verifyPassword(password, user.passwordHash))) {
      attempt.count += 1;
      if (loginAttempts.size > 5000) {
        for (const [key, value] of loginAttempts) if (now - value.since > 15 * 60 * 1000) loginAttempts.delete(key);
      }
      loginAttempts.set(ip, attempt);
      return res.status(401).json({ message: "User ID or password is incorrect." });
    }
    loginAttempts.delete(ip);
    setSessionCookie(res, user.id);
    res.json({ user: { username: user.username, role: user.role } });
  } catch (error) { next(error); }
});

app.post("/api/auth/request", async (req, res, next) => {
  try {
    if (!usingMongo) return res.status(503).json({ message: "Access requests require a connected MongoDB database." });
    const ip = req.ip || "unknown";
    const now = Date.now();
    const attempt = accessRequestAttempts.get(ip) || { count: 0, since: now };
    if (now - attempt.since > 60 * 60 * 1000) { attempt.count = 0; attempt.since = now; }
    if (attempt.count >= 5) return res.status(429).json({ message: "Too many access requests. Try again later." });
    attempt.count += 1;
    accessRequestAttempts.set(ip, attempt);

    const fullName = String(req.body.fullName || "").trim().slice(0, 100);
    const email = String(req.body.email || "").trim().toLowerCase().slice(0, 254);
    const organization = String(req.body.organization || "").trim().slice(0, 120);
    const governmentStaffId = String(req.body.governmentStaffId || "").trim().slice(0, 60);
    const reason = String(req.body.reason || "").trim().slice(0, 500);
    if (fullName.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || organization.length < 2 || governmentStaffId.length < 2 || reason.length < 8) {
      return res.status(400).json({ message: "Enter your name, valid work email, organization, government staff ID, and a reason of at least 8 characters." });
    }
    if (await Authority.exists({ email })) return res.status(409).json({ message: "An account already exists for this email. Contact the authority administrator for your User ID." });
    if (await AccessRequest.exists({ email, status: "pending" })) return res.status(409).json({ message: "An access request for this email is already awaiting review." });
    if (await Authority.exists({ governmentStaffId })) return res.status(409).json({ message: "An account already exists for this government staff ID. Contact the authority administrator." });
    if (await AccessRequest.exists({ governmentStaffId, status: "pending" })) return res.status(409).json({ message: "An access request for this government staff ID is already awaiting review." });

    const trackingToken = crypto.randomBytes(32).toString("hex");
    const trackingTokenHash = crypto.createHash("sha256").update(trackingToken).digest("hex");
    const accessRequest = await AccessRequest.create({ fullName, email, organization, governmentStaffId, reason, trackingTokenHash });
    res.status(201).json({ requestId: accessRequest.id, trackingToken, message: "Access request sent. This device will show the approval status and your User ID when the administrator approves it." });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "An account or access request already exists for this email or government staff ID." });
    next(error);
  }
});

app.post("/api/auth/request-status", async (req, res, next) => {
  try {
    if (!usingMongo) return res.status(503).json({ message: "Access status requires a connected MongoDB database." });
    const requestId = String(req.body.requestId || "");
    const trackingToken = String(req.body.trackingToken || "");
    if (!/^[a-f\d]{24}$/i.test(requestId) || !/^[a-f\d]{64}$/i.test(trackingToken)) {
      return res.status(400).json({ message: "Invalid request tracking details." });
    }
    const trackingTokenHash = crypto.createHash("sha256").update(trackingToken).digest("hex");
    const request = await AccessRequest.findOne({ _id: requestId, trackingTokenHash }).select("status authorityId").lean();
    if (!request) return res.status(404).json({ message: "Access request was not found for this device." });
    if (request.status !== "approved" || !request.authorityId) return res.json({ status: "pending" });
    const authority = await Authority.findById(request.authorityId).select("username").lean();
    if (!authority) return res.json({ status: "pending" });
    res.json({ status: "approved", userId: authority.username, passwordSetupRequired: !authority.active });
  } catch (error) { next(error); }
});

app.post("/api/auth/complete-setup", async (req, res, next) => {
  try {
    if (!usingMongo) return res.status(503).json({ message: "Password setup requires a connected MongoDB database." });
    const requestId = String(req.body.requestId || "");
    const trackingToken = String(req.body.trackingToken || "");
    const password = String(req.body.password || "");
    if (!/^[a-f\d]{24}$/i.test(requestId) || !/^[a-f\d]{64}$/i.test(trackingToken)) {
      return res.status(400).json({ message: "This device does not have valid access request details." });
    }
    if (!strongPassword(password)) return res.status(400).json({ message: "Password must be 12+ characters with uppercase, lowercase, a number, and a symbol." });
    const trackingTokenHash = crypto.createHash("sha256").update(trackingToken).digest("hex");
    const request = await AccessRequest.findOne({ _id: requestId, trackingTokenHash, status: "approved" }).select("authorityId").lean();
    if (!request?.authorityId) return res.status(403).json({ message: "This access request has not been approved for password setup." });
    const passwordHash = await hashPassword(password);
    const user = await Authority.findOneAndUpdate(
      { _id: request.authorityId, active: false, passwordHash: { $exists: false } },
      { $set: { passwordHash, active: true } },
      { new: true }
    ).select("username role").lean();
    if (!user) return res.status(409).json({ message: "Password setup was already completed or this account is no longer eligible." });
    setSessionCookie(res, user._id);
    res.json({ user: { username: user.username, role: user.role } });
  } catch (error) { next(error); }
});

app.get("/api/auth/me", requireAuthority, (req, res) => res.json({ user: { username: req.authority.username, role: req.authority.role } }));
app.post("/api/auth/logout", (_req, res) => {
  res.clearCookie(sessionCookie, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/api" });
  res.status(204).end();
});

app.post("/api/auth/users", requireAuthority, async (req, res, next) => {
  try {
    if (req.authority.role !== "admin") return res.status(403).json({ message: "Administrator access is required." });
    const username = String(req.body.username || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    if (!/^[a-z0-9._-]{3,40}$/.test(username)) return res.status(400).json({ message: "User ID must be 3–40 letters, numbers, dots, underscores, or hyphens." });
    if (!strongPassword(password)) return res.status(400).json({ message: "Password must be 12+ characters with uppercase, lowercase, a number, and a symbol." });
    const user = await Authority.create({ username, passwordHash: await hashPassword(password), role: "authority", active: true });
    res.status(201).json({ user: { username: user.username, role: user.role } });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "That user ID is already in use." });
    next(error);
  }
});

app.get("/api/auth/pending", requireAuthority, async (req, res, next) => {
  try {
    if (req.authority.role !== "admin") return res.status(403).json({ message: "Administrator access is required." });
    const requests = await AccessRequest.find({ status: "pending" }).select("fullName email organization governmentStaffId reason createdAt").sort({ createdAt: 1 }).lean();
    res.json({ requests });
  } catch (error) { next(error); }
});

app.post("/api/auth/pending/:id/approve", requireAuthority, async (req, res, next) => {
  try {
    if (req.authority.role !== "admin") return res.status(403).json({ message: "Administrator access is required." });
    const request = await AccessRequest.findOne({ _id: req.params.id, status: "pending" });
    if (!request) return res.status(404).json({ message: "Access request not found or already processed." });
    const username = String(req.body.username || "").trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,40}$/.test(username)) return res.status(400).json({ message: "User ID must be 3–40 letters, numbers, dots, underscores, or hyphens." });
    const user = await Authority.create({ username, email: request.email, governmentStaffId: request.governmentStaffId, role: "authority", active: false });
    request.status = "approved";
    request.approvedBy = req.authority._id;
    request.authorityId = user._id;
    await request.save();
    res.json({ user: { username: user.username, email: user.email, role: user.role } });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "That User ID or email is already in use. Choose a different User ID." });
    next(error);
  }
});

async function getStations() {
  if (!usingMongo) return sampleStations;

  const stations = await Station.find().lean();
  return stations.length ? stations : sampleStations;
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "urban-air-monitor-api",
    database: usingMongo ? "mongodb" : "sample-data"
  });
});

app.get("/api/dashboard", requireAuthority, async (_req, res, next) => {
  try {
    const stations = await getStations();
    res.json(buildDashboard(stations, policyActions));
  } catch (error) {
    next(error);
  }
});

app.get("/api/stations", requireAuthority, async (_req, res, next) => {
  try {
    res.json({ stations: await getStations() });
  } catch (error) {
    next(error);
  }
});

app.post("/api/stations/:id/readings", requireAuthority, async (req, res, next) => {
  try {
    if (!usingMongo) {
      return res.status(503).json({ message: "Connect MongoDB to store new readings." });
    }

    const reading = {
      recordedAt: req.body.recordedAt || new Date(),
      aqi: Number(req.body.aqi),
      pm25: Number(req.body.pm25),
      pm10: Number(req.body.pm10),
      no2: Number(req.body.no2),
      so2: Number(req.body.so2)
    };

    if (Object.entries(reading).some(([key, value]) => key !== "recordedAt" && !Number.isFinite(value))) {
      return res.status(400).json({ message: "AQI, PM2.5, PM10, NO2, and SO2 values are required." });
    }

    const station = await Station.findByIdAndUpdate(
      req.params.id,
      { $push: { readings: reading } },
      { new: true, runValidators: true }
    );

    if (!station) return res.status(404).json({ message: "Station not found." });

    res.status(201).json({ station });
  } catch (error) {
    next(error);
  }
});

if (process.env.SERVE_FRONTEND === "true") {
  const frontendDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../frontend/dist");
  app.use(express.static(frontendDist));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(frontendDist, "index.html"), (error) => {
      if (error) next(error);
    });
  });
}

app.use((error, _req, res, _next) => {
  console.error(error);
  const status = Number.isInteger(error.status) ? error.status : 500;
  res.status(status).json({ message: status < 500 ? error.message : status === 503 ? error.message : "Something went wrong on the server." });
});

usingMongo = await connectDb(process.env.MONGODB_URI);
if (process.env.SERVE_FRONTEND === "true" && !usingMongo) throw new Error("MongoDB must be connected before the deployed service can start.");

if (usingMongo && process.env.INITIAL_ADMIN_USERNAME && process.env.INITIAL_ADMIN_PASSWORD) {
  const username = process.env.INITIAL_ADMIN_USERNAME.trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,40}$/.test(username)) throw new Error("INITIAL_ADMIN_USERNAME must be 3–40 letters, numbers, dots, underscores, or hyphens.");
  if (!strongPassword(process.env.INITIAL_ADMIN_PASSWORD)) throw new Error("INITIAL_ADMIN_PASSWORD must be 12+ characters with uppercase, lowercase, a number, and a symbol.");
  await Authority.updateOne(
    { username },
    { $setOnInsert: { username, email: process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase(), role: "admin", active: true, passwordHash: await hashPassword(process.env.INITIAL_ADMIN_PASSWORD) } },
    { upsert: true }
  );
}

export default app;

if (!process.env.VERCEL) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Urban Air Monitor API running on http://127.0.0.1:${PORT}`);
  });
}


