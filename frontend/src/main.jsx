import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  ClipboardCheck,
  Eye,
  EyeOff,
  Factory,
  Gauge,
  HeartPulse,
  LockKeyhole,
  MapPin,
  RadioTower,
  RefreshCw,
  ShieldCheck,
  Wind
} from "lucide-react";
import "./styles.css";

const API_URL = import.meta.env.VITE_API_URL || "/api";
const pollutantKeys = ["aqi", "pm25", "pm10", "no2", "so2"];
const cleanAirStations = [
  { name: "Parklands Greenbelt", zone: "Western Green Corridor", aqi: 38, pm25: 8, pm10: 19, updated: "08:30" },
  { name: "Riverside Botanical Reserve", zone: "Riverfront Conservation Zone", aqi: 46, pm25: 11, pm10: 24, updated: "08:25" },
  { name: "North Lake Ecological Park", zone: "Northern Lakes District", aqi: 34, pm25: 7, pm10: 18, updated: "08:20" },
  { name: "University Arboretum", zone: "South Campus Green Belt", aqi: 43, pm25: 10, pm10: 22, updated: "08:15" }
];

function formatDate(value) {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short" }).format(new Date(value));
}

function metricLabel(key) {
  const labels = { aqi: "AQI", pm25: "PM2.5", pm10: "PM10", no2: "NO2", so2: "SO2" };
  return labels[key] || key;
}

function MiniLineChart({ data, metric }) {
  const values = data.map((item) => item[metric]);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 1);
  const points = values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * 100;
      const y = 88 - ((value - min) / range) * 68;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="chart-wrap">
      <svg viewBox="0 0 100 100" role="img" aria-label={`${metricLabel(metric)} trend chart`}>
        <defs>
          <linearGradient id={`line-${metric}`} x1="0" x2="1" y1="0" y2="0">
            <stop stopColor="#14866d" />
            <stop offset="1" stopColor="#e67700" />
          </linearGradient>
          <linearGradient id={`area-${metric}`} x1="0" x2="0" y1="0" y2="1">
            <stop stopColor="#5965df" stopOpacity=".24" />
            <stop offset="1" stopColor="#5965df" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M0 88 H100 M0 65 H100 M0 42 H100 M0 19 H100" className="chart-grid" />
        <polygon points={`0,100 ${points} 100,100`} fill={`url(#area-${metric})`} />
        <polyline points={points} className="chart-line" stroke={`url(#line-${metric})`} />
        {values.map((value, index) => {
          const x = (index / Math.max(values.length - 1, 1)) * 100;
          const y = 88 - ((value - min) / range) * 68;
          return <circle key={`${value}-${index}`} cx={x} cy={y} r="2.4" className="chart-dot" />;
        })}
      </svg>
      <div className="chart-axis">
        {data.map((item) => (
          <span key={item.date}>{formatDate(item.date)}</span>
        ))}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tone }) {
  return (
    <article className={`stat-card ${tone || ""}`}>
      <Icon size={21} />
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </article>
  );
}

function PasswordInput({ id, value, onChange, autoComplete, required = false, placeholder }) {
  const [visible, setVisible] = useState(false);
  return <div className="password-input-wrap">
    <input id={id} name={id} type={visible ? "text" : "password"} value={value} onChange={onChange} autoComplete={autoComplete} required={required} placeholder={placeholder} />
    <button type="button" className="password-toggle" onClick={() => setVisible((current) => !current)} aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible}>
      {visible ? <EyeOff size={16} /> : <Eye size={16} />}<span>{visible ? "Hide" : "Show"}</span>
    </button>
  </div>;
}

function LoginPage({ onLogin }) {
  const [accessStatus, setAccessStatus] = useState(() => {
    try { return JSON.parse(localStorage.getItem("urban-air-access-request") || "null"); } catch { return null; }
  });
  const [mode, setMode] = useState(() => accessStatus ? "request" : "signin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [request, setRequest] = useState({ fullName: "", email: "", organization: "", reason: "" });
  const [idProofImage, setIdProofImage] = useState(null);
  const [idProofInputKey, setIdProofInputKey] = useState(0);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (!accessStatus?.requestId || !accessStatus?.trackingToken || accessStatus.status === "approved") return undefined;
    let active = true;
    const refreshStatus = async () => {
      try {
        const response = await fetch(`${API_URL}/auth/request-status`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestId: accessStatus.requestId, trackingToken: accessStatus.trackingToken })
        });
        if (!response.ok) return;
        const result = await response.json();
        if (!active) return;
        const updated = { ...accessStatus, ...result };
        setAccessStatus(updated);
        localStorage.setItem("urban-air-access-request", JSON.stringify(updated));
      } catch { /* Keep the last known status and retry on the next poll. */ }
    };
    refreshStatus();
    const timer = window.setInterval(refreshStatus, 15000);
    return () => { active = false; window.clearInterval(timer); };
  }, [accessStatus?.requestId, accessStatus?.trackingToken, accessStatus?.status]);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      if (mode === "request") {
        if (!idProofImage) throw new Error("Upload a clear image of your government staff ID before sending the request.");
        const idProofDataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(new Error("Could not read the selected ID image."));
          reader.readAsDataURL(idProofImage);
        });
        const response = await fetch(`${API_URL}/auth/request`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...request, idProofImage: idProofDataUrl }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Unable to submit your access request.");
        const tracking = { requestId: data.requestId, trackingToken: data.trackingToken, status: "pending" };
        localStorage.setItem("urban-air-access-request", JSON.stringify(tracking));
        setAccessStatus(tracking);
        setSuccess(data.message || "Access request sent. The authority administrator will review it in the app.");
        setRequest({ fullName: "", email: "", organization: "", reason: "" });
        setIdProofImage(null);
        setIdProofInputKey((key) => key + 1);
        return;
      }
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to sign in.");
      onLogin(data.user);
    } catch (err) {
      setError(err.message || "Unable to reach the sign-in service.");
    } finally {
      setBusy(false);
    }
  }

  async function completePasswordSetup(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      if (newPassword !== confirmPassword) throw new Error("The passwords do not match.");
      const response = await fetch(`${API_URL}/auth/complete-setup`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: accessStatus.requestId, trackingToken: accessStatus.trackingToken, password: newPassword })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to create your password.");
      onLogin(data.user);
    } catch (err) {
      setError(err.message || "Unable to create your password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-brand"><span className="login-brand-mark"><Wind size={20} /></span><span>Urban Air Monitor<small>AUTHORITY PORTAL</small></span></div>
        <div className="login-heading">
          <span className="login-secure"><LockKeyhole size={15} /> Secure access</span>
          <h1 id="login-title">{mode === "signin" ? "Welcome back." : "Request authority access."}</h1>
          <p>{mode === "signin" ? "Sign in with your authority user ID and password." : "Submit your details for review. If approved, your administrator will issue a User ID and you can set your own password here."}</p>
        </div>
        <div className="auth-tabs" role="tablist" aria-label="Account access">
          <button role="tab" aria-selected={mode === "signin"} className={mode === "signin" ? "selected" : ""} onClick={() => { setMode("signin"); setError(""); setSuccess(""); }}>Sign in</button>
          <button role="tab" aria-selected={mode === "request"} className={mode === "request" ? "selected" : ""} onClick={() => { setMode("request"); setError(""); setSuccess(""); }}>Request access</button>
        </div>
        {mode === "signin" ? <form className="login-form" onSubmit={submit}>
          <label htmlFor="authority-user">User ID</label>
          <input id="authority-user" name="username" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" autoCapitalize="none" spellCheck="false" required autoFocus />
          <label htmlFor="authority-password">Password</label>
          <PasswordInput id="authority-password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
          <button type="submit" disabled={busy}>{busy ? "Verifying access…" : "Sign in securely"}</button>
        </form> : <form className="login-form request-form" onSubmit={submit}>
          <label htmlFor="request-name">Full name</label><input id="request-name" autoComplete="name" value={request.fullName} onChange={(event) => setRequest({ ...request, fullName: event.target.value })} maxLength={100} required />
          <label htmlFor="request-email">Work email</label><input id="request-email" type="email" autoComplete="email" value={request.email} onChange={(event) => setRequest({ ...request, email: event.target.value })} maxLength={254} required />
          <label htmlFor="request-organization">Department or organization</label><input id="request-organization" value={request.organization} onChange={(event) => setRequest({ ...request, organization: event.target.value })} maxLength={120} required />
          <label htmlFor="request-government-staff-id-proof">Upload government staff ID proof</label><input key={idProofInputKey} id="request-government-staff-id-proof" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event) => { const file = event.target.files?.[0] || null; if (file && file.size > 3 * 1024 * 1024) { setIdProofImage(null); setError("ID image must be no larger than 3 MB."); event.target.value = ""; return; } setError(""); setIdProofImage(file); }} required /><small className="field-help">Upload a clear JPG, PNG, or WebP image, up to 3 MB. The administrator will review it before approving access.</small>
          <label htmlFor="request-reason">Reason for access</label><textarea id="request-reason" value={request.reason} onChange={(event) => setRequest({ ...request, reason: event.target.value })} maxLength={500} rows={3} required />
          <button type="submit" disabled={busy}>{busy ? "Sending request…" : "Send access request"}</button>
        </form>}
        {mode === "request" && accessStatus && <section className={`access-status-card ${accessStatus.status === "approved" ? "approved" : "pending"}`} aria-live="polite">
          <strong>{accessStatus.status === "approved" ? "Access approved" : "Request status: awaiting review"}</strong>
          <p>{accessStatus.status !== "approved" ? "This device checks for updates automatically. Keep this browser's site data so you can continue tracking the request." : accessStatus.passwordSetupRequired ? "Your administrator issued your User ID. Create your personal password below to activate your account." : "Your administrator approved this account. Use your issued credentials to sign in."}</p>
          {accessStatus.status === "approved" && <><div className="issued-user-id"><span>Your User ID</span><strong>{accessStatus.userId}</strong></div>{accessStatus.passwordSetupRequired && <form className="password-setup-form" onSubmit={completePasswordSetup}>
            <label htmlFor="new-authority-password">Create password</label>
            <PasswordInput id="new-authority-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" required />
            <label htmlFor="confirm-authority-password">Confirm password</label>
            <PasswordInput id="confirm-authority-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" required />
            <small>Use at least 12 characters, including uppercase, lowercase, a number, and a symbol.</small>
            <button type="submit" disabled={busy}>{busy ? "Activating account…" : "Create password &amp; continue"}</button>
          </form>}{!accessStatus.passwordSetupRequired && <button type="button" className="status-signin-button" onClick={() => { setUsername(accessStatus.userId || ""); setMode("signin"); setError(""); setSuccess(""); }}>Continue to sign in</button>}</>}
        </section>}
        {success && <p className="login-success" role="status">{success}</p>}
        {error && <p className="login-error" role="alert">{error}</p>}
        <p className="login-help">Access is limited to personnel approved by the authority administrator.</p>
        <div className="login-foot"><LockKeyhole size={14} /> Protected authority access</div>
      </section>
      <aside className="login-aside">
        <div className="login-orbit orbit-one" /><div className="login-orbit orbit-two" />
        <div className="login-aside-copy"><span>ENVIRONMENTAL INTELLIGENCE</span><h2>Clearer air starts with better decisions.</h2><p>One secure workspace for city-wide monitoring, station risk, and public health response.</p></div>
        <div className="login-aside-metric"><span className="live-dot" /> LIVE MONITORING <b>·</b> CITY-WIDE VIEW</div>
      </aside>
    </main>
  );
}

function App() {
  const [authority, setAuthority] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [dashboard, setDashboard] = useState(null);
  const [metric, setMetric] = useState("aqi");
  const [selectedZone, setSelectedZone] = useState("All zones");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [hoveredStation, setHoveredStation] = useState(null);
  const [showAccessRequests, setShowAccessRequests] = useState(false);
  const [pendingAccounts, setPendingAccounts] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [approvalCredentials, setApprovalCredentials] = useState({});
  const [accessNotice, setAccessNotice] = useState("");
  const [fieldStatuses, setFieldStatuses] = useState(() => {
    try { return JSON.parse(localStorage.getItem("urban-air-field-statuses") || "{}"); } catch { return {}; }
  });
  const [activeModule, setActiveModule] = useState("overview");

  function updateFieldStatus(title, status) {
    setFieldStatuses((current) => {
      const next = { ...current, [title]: status };
      localStorage.setItem("urban-air-field-statuses", JSON.stringify(next));
      return next;
    });
  }

  function exportCsv() {
    const rows = [["Record type", "Date", "Station", "Zone", "AQI", "PM2.5", "PM10", "NO2", "SO2", "AQI category"]];
    dashboard.stations.forEach((station) => rows.push(["Current station reading", station.latest.recordedAt || dashboard.generatedAt, station.name, station.zone, station.latest.aqi, station.latest.pm25, station.latest.pm10, station.latest.no2, station.latest.so2, station.band.label]));
    cleanAirStations.forEach((station) => rows.push(["Clean-air site reading", dashboard.generatedAt, station.name, station.zone, station.aqi, station.pm25, station.pm10, "", "", "Good"]));
    dashboard.trends.forEach((reading) => rows.push(["City average trend", reading.date, "City average", "All zones", reading.aqi, reading.pm25, reading.pm10, reading.no2, reading.so2, ""]));
    const csv = rows.map((row) => row.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `urban-air-monitor-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function loadDashboard() {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/dashboard`, { credentials: "include", cache: "no-store" });
      if (response.status === 401) {
        setAuthority(null);
        setDashboard(null);
        return;
      }
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to load the monitoring dashboard.");
      setDashboard(data);
      setNotice("");
    } catch (error) {
      setNotice(error.message || "Backend is not reachable. Start the API server and refresh.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetch(`${API_URL}/auth/me`, { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()).user;
      })
      .then((user) => {
        if (user) {
          setAuthority(user);
          loadDashboard();
        }
      })
      .catch(() => {})
      .finally(() => setCheckingAuth(false));
  }, []);

  useEffect(() => {
    if (authority?.role !== "admin") { setPendingCount(0); return undefined; }
    let mounted = true;
    const refreshCount = async () => {
      try {
        const response = await fetch(`${API_URL}/auth/pending`, { credentials: "include" });
        if (!response.ok) return;
        const data = await response.json();
        if (mounted) setPendingCount(data.requests?.length || 0);
      } catch { /* The dashboard remains usable if notification polling is temporarily unavailable. */ }
    };
    refreshCount();
    const timer = window.setInterval(refreshCount, 30000);
    return () => { mounted = false; window.clearInterval(timer); };
  }, [authority]);

  async function signOut() {
    await fetch(`${API_URL}/auth/logout`, { method: "POST", credentials: "include" }).catch(() => {});
    setAuthority(null);
    setDashboard(null);
  }

  async function loadAccessRequests() {
    setActiveModule("access-requests");
    setShowAccessRequests(true);
    try {
      const response = await fetch(`${API_URL}/auth/pending`, { credentials: "include" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not load access requests.");
      setPendingAccounts(data.requests);
      setPendingCount(data.requests.length);
      setAccessNotice("");
    } catch (error) { setAccessNotice(error.message); }
  }

  async function approveAccount(id) {
    const credentials = { username: approvalCredentials[id]?.username || "" };
    try {
      const response = await fetch(`${API_URL}/auth/pending/${id}/approve`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(credentials) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not approve this account.");
      setPendingAccounts((users) => users.filter((user) => user._id !== id));
      setPendingCount((count) => Math.max(0, count - 1));
      setApprovalCredentials((current) => { const next = { ...current }; delete next[id]; return next; });
      setAccessNotice(`Access approved. User ID “${data.user.username}” is ready. The user can now create their password on their device.`);
    } catch (error) { setAccessNotice(error.message); }
  }

  const zones = useMemo(() => {
    if (!dashboard) return ["All zones"];
    return ["All zones", ...new Set(dashboard.stations.map((station) => station.zone))];
  }, [dashboard]);

  const visibleStations = useMemo(() => {
    if (!dashboard) return [];
    if (selectedZone === "All zones") return dashboard.stations;
    return dashboard.stations.filter((station) => station.zone === selectedZone);
  }, [dashboard, selectedZone]);

  if (checkingAuth) {
    return <main className="loading">Checking secure authority access…</main>;
  }

  if (!authority) return <LoginPage onLogin={(user) => { setAuthority(user); loadDashboard(); }} />;

  if (loading && !dashboard) {
    return <main className="loading">Loading environmental intelligence...</main>;
  }

  if (!dashboard) {
    return <main className="loading"><div className="dashboard-unavailable"><p>{notice || "Monitoring data is temporarily unavailable."}</p><button className="signout-button" onClick={loadDashboard}>Try again</button><button className="signout-button" onClick={signOut}>Sign out</button></div></main>;
  }

  return (
    <main className="app-dashboard">
      <div className="dashboard-layout">
      <aside className="dashboard-sidebar">
        <a className="sidebar-brand" href="#overview"><span><Wind size={18} /> Urban Air Monitor</span><small>CITY OPERATIONS</small></a>
        <span className="sidebar-label">WORKSPACE</span>
        <nav className="dashboard-nav" aria-label="Dashboard sections">{[["overview", "Overview"], ["trends", "Trends"], ["stations", "Stations"], ["clean-air", "Clean air sites"], ["alerts", "Alerts"], ["operations", "Field response"], ...(authority.role === "admin" ? [["access-requests", "Access requests"]] : [])].map(([id, label]) => <button type="button" key={id} className={activeModule === id ? "current" : ""} aria-current={activeModule === id ? "page" : undefined} onClick={() => { if (id === "access-requests") loadAccessRequests(); else { setActiveModule(id); setShowAccessRequests(false); setHoveredStation(null); } }}><span>{label}</span>{id === "access-requests" && pendingCount > 0 && <b className="request-badge">{pendingCount > 9 ? "9+" : pendingCount}</b>}</button>)}</nav>
        <div className="sidebar-tools"><button className="sidebar-export" onClick={exportCsv}><BarChart3 size={16} /> Export CSV</button></div>
        <div className="sidebar-user"><span className="user-avatar">{authority.username.slice(0, 1).toUpperCase()}</span><div><b>{authority.username}</b><small>{authority.role}</small></div><button className="sidebar-logout" onClick={signOut}>Log out</button></div>
      </aside>
      <div className="dashboard-content">
      <header className="topbar">
        <div className="brand">
          <span><Wind size={19} /> Urban Air Monitor</span>
          <strong>Centralized pollution command system</strong>
        </div>
        <div className="topbar-actions"><span className="authority-label">{authority.username} · {authority.role}</span><button type="button" className={`icon-button refresh-button${loading ? " is-refreshing" : ""}`} onClick={loadDashboard} disabled={loading} aria-label={loading ? "Refreshing dashboard" : "Refresh dashboard"} title={loading ? "Refreshing dashboard…" : "Refresh dashboard"} aria-busy={loading}><RefreshCw size={18} /></button></div>
      </header>

      {showAccessRequests && activeModule === "access-requests" && authority.role === "admin" && <section className="access-requests access-requests-module"><div className="access-requests-title"><div><span className="eyebrow">ADMINISTRATION</span><h2>New authority requests</h2><p className="access-requests-subtitle">Review the government staff ID proof, then issue a private User ID. The approved user creates their own password.</p></div><button className="icon-button" onClick={() => { setShowAccessRequests(false); setActiveModule("overview"); }} aria-label="Close access requests">×</button></div>{accessNotice && <p className={accessNotice.startsWith("Access approved") ? "login-success" : "login-error"} role="status">{accessNotice}</p>}{pendingAccounts.length ? pendingAccounts.map((account) => <article className="pending-account request-card" key={account._id}><div className="request-person"><strong>{account.fullName}</strong><span>{account.email}</span><small>{account.organization} · Requested {formatDate(account.createdAt)}</small>{account.idProofImage?.contentType ? <a className="proof-image-link" href={`${API_URL}/auth/pending/${account._id}/staff-id-proof`} target="_blank" rel="noreferrer">View government staff ID image</a> : <p className="staff-id-review"><strong>ID proof:</strong> No image attached; approval is disabled.</p>}<p>{account.reason}</p></div><div className="provision-fields"><label>User ID<input value={approvalCredentials[account._id]?.username || ""} onChange={(event) => setApprovalCredentials((current) => ({ ...current, [account._id]: { ...current[account._id], username: event.target.value } }))} autoComplete="off" placeholder="Create a private ID" /></label><button className="approve-button" onClick={() => approveAccount(account._id)} disabled={!account.idProofImage?.contentType}>Approve &amp; issue User ID</button></div></article>) : !accessNotice && <p className="muted-note">There are no pending requests.</p>}</section>}

      {notice && <button className="notice" onClick={() => setNotice("")}>{notice}</button>}

      <div className="module-view" hidden={activeModule !== "overview"}>
      <section className="hero" id="overview">
        <div className="hero-copy">
          <p className="eyebrow">AQI / PM2.5 / PM10 / NO2 / SO2</p>
          <h1>Live pollution trends for public health and policy response.</h1>
        </div>
        <div className="hero-visual" onMouseLeave={() => setHoveredStation(null)}>
          <div className="air-map">
            {dashboard?.stations.map((station, index) => (
              <button
                key={station.id}
                className="map-point"
                type="button"
                aria-label={`${station.name}, ${station.zone}, AQI ${station.latest.aqi}, ${station.band.label}. Show reading.`}
                aria-pressed={hoveredStation === station.id}
                title={`${station.name} · AQI ${station.latest.aqi} · ${station.band.label}`}
                onMouseEnter={() => setHoveredStation(station.id)}
                onFocus={() => setHoveredStation(station.id)}
                onBlur={() => setHoveredStation(null)}
                onClick={() => setHoveredStation((current) => current === station.id ? null : station.id)}
                style={{
                  "--x": `${18 + index * 22}%`,
                  "--y": `${62 - index * 12}%`,
                  "--color": station.band.color
                }}
              />
            ))}
          </div>
          {hoveredStation && (() => {
            const station = dashboard.stations.find((item) => item.id === hoveredStation);
            if (!station) return null;
            return <div className="map-tooltip" role="status" style={{ "--tip-color": station.band.color }}><div className="tooltip-heading"><span className="tooltip-kicker">{station.zone}</span><strong>{station.name}</strong></div><div className="tooltip-aqi"><b>{station.latest.aqi}</b><span>AQI</span><em>{station.band.label} intensity</em></div><div className="tooltip-readings"><span>PM2.5 <b>{station.latest.pm25} µg/m³</b></span><span>PM10 <b>{station.latest.pm10} µg/m³</b></span><span>NO₂ <b>{station.latest.no2} ppb</b></span><span>SO₂ <b>{station.latest.so2} ppb</b></span></div></div>;
          })()}
          <div className="map-caption"><span><i /> Monitoring locations</span><span>Hover or tap a point for readings</span></div>
        </div>
      </section>

      <section className="stats-grid">
        <StatCard icon={RadioTower} label="Stations" value={dashboard.summary.monitoredStations} />
        <StatCard icon={Gauge} label="Average AQI" value={dashboard.summary.averageAqi} tone="amber" />
        <StatCard icon={AlertTriangle} label="Active alerts" value={dashboard.summary.activeAlerts} tone="red" />
        <StatCard icon={HeartPulse} label="Public health" value={dashboard.summary.publicHealthStatus} tone="green" />
      </section>
      </div>

      <div className="module-view" hidden={activeModule !== "trends"}>
      <section className="workspace" id="trends">
        <div className="primary-panel">
          <div className="panel-heading">
            <div className="trend-title">
              <p className="eyebrow">Pollution trends</p>
              <h2>{metricLabel(metric)} city average</h2>
              <span className="trend-context">Daily readings · {dashboard.trends.length} reporting periods</span>
            </div>
            <div className="segmented">
              {pollutantKeys.map((key) => (
                <button key={key} className={metric === key ? "active" : ""} onClick={() => setMetric(key)}>
                  {metricLabel(key)}
                </button>
              ))}
            </div>
          </div>
          <div className="chart-legend"><span><i /> City average</span><span>Lower values indicate cleaner air</span></div><MiniLineChart data={dashboard.trends} metric={metric} />
        </div>

        <aside className="side-panel">
          <div className="panel-heading compact">
            <div>
              <p className="eyebrow">Policy queue</p>
              <h2>Priority actions</h2>
            </div>
            <ShieldCheck size={22} />
          </div>
          <div className="action-list">
            {dashboard.policyActions.map((action) => (
              <article className="action-item" key={action.title}>
                <div>
                  <strong>{action.title}</strong>
                  <span>{action.zone}</span>
                </div>
                <p>{action.impact}</p>
                <small className={action.priority.toLowerCase()}>{action.priority} · {action.status}</small>
              </article>
            ))}
          </div>
        </aside>
      </section>

      <section className="comparison-panel" aria-label="Station comparison chart">
        <div className="panel-heading"><div><p className="eyebrow">Station comparison</p><h2>Current AQI by location</h2></div><span className="trend-context">Latest recorded readings</span></div>
        <div className="station-bars">{dashboard.stations.map((station) => <div className="station-bar-row" key={station.id}><span title={station.zone}>{station.name}</span><div className="station-bar-track"><i style={{ width: `${Math.min(100, Math.max(4, station.latest.aqi / 3))}%`, background: station.band.color }} /></div><b style={{ color: station.band.color }}>{station.latest.aqi}</b></div>)}</div>
        <div className="aqi-scale"><span>Good</span><span>Satisfactory</span><span>Moderate</span><span>Poor</span><span>Very poor</span></div>
      </section>
      </div>

      <div className="module-view" hidden={activeModule !== "stations"}>
      <section className="station-section" id="stations">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Monitoring stations</p>
            <h2>Zone risk register</h2>
          </div>
          <label className="zone-filter">
            <MapPin size={17} />
            <select value={selectedZone} onChange={(event) => setSelectedZone(event.target.value)}>
              {zones.map((zone) => (
                <option key={zone}>{zone}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="station-grid">
          {visibleStations.map((station) => (
            <article className="station-card" key={station.id}>
              <div className="station-top">
                <div>
                  <h3>{station.name}</h3>
                  <span>{station.zone}</span>
                </div>
                <strong style={{ color: station.band.color }}>{station.latest.aqi}</strong>
              </div>
              <div className="pollutants">
                <span>PM2.5 <b>{station.latest.pm25}</b></span>
                <span>PM10 <b>{station.latest.pm10}</b></span>
                <span>NO2 <b>{station.latest.no2}</b></span>
                <span>SO2 <b>{station.latest.so2}</b></span>
              </div>
              <div className="station-foot">
                <small>{station.band.label}</small>
                <small>{station.aqiChange >= 0 ? "+" : ""}{station.aqiChange} AQI since last reading</small>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="network-status-section">
        <div className="panel-heading"><div><p className="eyebrow">Network operations</p><h2>Latest station readings</h2></div><span className="network-online"><i /> {dashboard.stations.length} stations reporting</span></div>
        <div className="station-table-wrap"><table className="station-table"><thead><tr><th>Station</th><th>Zone</th><th>Latest AQI</th><th>PM2.5</th><th>PM10</th><th>Reading date</th><th>Condition</th></tr></thead><tbody>{visibleStations.map((station) => <tr key={station.id}><td><strong>{station.name}</strong></td><td>{station.zone}</td><td><b className="table-aqi" style={{ color: station.band.color }}>{station.latest.aqi}</b></td><td>{station.latest.pm25} µg/m³</td><td>{station.latest.pm10} µg/m³</td><td>{formatDate(station.latest.recordedAt)}</td><td><span className="table-condition"><i />Reporting</span></td></tr>)}</tbody></table></div>
      </section>
      </div>

      <div className="module-view" hidden={activeModule !== "clean-air"}>
      <section className="clean-air-section" id="clean-air">
        <div className="panel-heading"><div><p className="eyebrow">Good air locations</p><h2>Clean-air monitoring sites</h2></div><span className="good-air-badge">AQI under 50</span></div>
        <div className="clean-air-grid">{cleanAirStations.map((station) => <article className="clean-air-card" key={station.name}><div className="clean-air-card-top"><span className="leaf-mark">✳</span><span className="good-air-status">Good air</span></div><h3>{station.name}</h3><p>{station.zone}</p><div className="clean-air-reading"><strong>{station.aqi}</strong><span>AQI</span><i style={{ width: `${station.aqi}%` }} /></div><div className="clean-air-pollutants"><span>PM2.5 <b>{station.pm25} µg/m³</b></span><span>PM10 <b>{station.pm10} µg/m³</b></span></div><small className="reading-time">Updated today at {station.updated}</small></article>)}</div>
      </section>
      </div>

      <div className="module-view" hidden={activeModule !== "alerts"}>
      <section className="alerts-band" id="alerts">
        <div>
          <p className="eyebrow">Public health alerts</p>
          <h2>Escalation triggers</h2>
        </div>
        <div className="alert-list">
          {dashboard.alerts.map((alert) => (
            <article key={`${alert.station}-${alert.message}`}>
              <Activity size={18} />
              <div>
                <strong>{alert.severity}: {alert.station}</strong>
                <span>{alert.message} in {alert.zone}</span>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="response-guide-section">
        <div className="panel-heading"><div><p className="eyebrow">Decision support</p><h2>Air-quality response guide</h2></div><span className="guide-note">Operational reference</span></div>
        <div className="response-guide-grid"><article><span className="guide-range good">0–50</span><div><b>Good</b><p>Continue routine monitoring and preserve clean-air corridors.</p></div></article><article><span className="guide-range satisfactory">51–100</span><div><b>Satisfactory</b><p>Review station patterns and monitor sensitive locations.</p></div></article><article><span className="guide-range moderate">101–200</span><div><b>Moderate</b><p>Prioritize source checks and issue targeted health guidance.</p></div></article><article><span className="guide-range poor">201–300</span><div><b>Poor or higher</b><p>Escalate field inspection and coordinate response teams.</p></div></article></div>
      </section>
      </div>

      <div className="module-view" hidden={activeModule !== "operations"}>
      <section className="operations-section" id="operations">
        <div className="panel-heading"><div><p className="eyebrow">Operational workflow</p><h2>Field response and inspections</h2></div><ClipboardCheck size={23} /></div>
        <p className="operations-intro">Coordinate field teams against current priority actions and track dispatch status.</p>
        <div className="field-task-list">{dashboard.policyActions.map((action, index) => {
          const status = fieldStatuses[action.title] || "Queued";
          const nextStatus = status === "Queued" ? "Dispatched" : status === "Dispatched" ? "Resolved" : "Queued";
          return <article className="field-task" key={action.title}><span className={`task-number ${action.priority.toLowerCase()}`}>0{index + 1}</span><div className="field-task-info"><b>{action.title}</b><span>{action.zone} · {action.impact}</span></div><span className={`field-status ${status.toLowerCase()}`}>{status}</span><button onClick={() => updateFieldStatus(action.title, nextStatus)}>{status === "Queued" ? "Dispatch team" : status === "Dispatched" ? "Mark resolved" : "Reopen"}</button></article>;
        })}</div>
        <div className="field-checklist-heading"><div><p className="eyebrow">Standard operating procedure</p><h3>Field visit checklist</h3></div><span>Complete each step during site response</span></div>
        <div className="field-checklist"><article><span>01</span><div><b>Verify station and alert</b><small>Confirm station ID, zone, and latest reading.</small></div></article><article><span>02</span><div><b>Record site conditions</b><small>Capture weather, nearby activity, and visible sources.</small></div></article><article><span>03</span><div><b>Document corrective action</b><small>Attach notes and the responsible field unit.</small></div></article><article><span>04</span><div><b>Close the response</b><small>Review follow-up readings before resolving the action.</small></div></article></div>
      </section>
      </div>

      {activeModule !== "access-requests" && <footer>
        <Factory size={17} />
        Built for centralized environmental monitoring and evidence-led urban response.
      </footer>}
      </div>
      </div>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
