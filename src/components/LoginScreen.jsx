import { useState, useEffect } from "react";

// Mask email like Gate Pass (e.g. software.2040@pgel.in -> s••••••40@pgel.in)
function maskEmail(email = "") {
  if (!email || !email.includes("@")) return "•••••••@pgel.in";
  const [local, domain] = email.split("@");
  if (local.length <= 2) {
    return `${local[0]}*@${domain}`;
  }
  const first = local[0];
  const last = local.slice(-2);
  const stars = "•".repeat(Math.max(3, local.length - 3));
  return `${first}${stars}${last}@${domain}`;
}

export default function LoginScreen({ onLogin, users = [] }) {
  const [step, setStep] = useState("input"); // 'input' | 'otp'
  const [identifier, setIdentifier] = useState("");
  const [targetUser, setTargetUser] = useState(null);
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [resendTimer, setResendTimer] = useState(0);

  // Resend cooldown timer
  useEffect(() => {
    let interval = null;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  // Strictly match registered PGEL personnel
  function findRegisteredUser(cleanStr) {
    const q = cleanStr.trim().toLowerCase();
    if (!q) return null;
    return (
      users.find(
        (u) =>
          u.email?.toLowerCase() === q ||
          u.employee_code?.toLowerCase() === q ||
          u.username?.toLowerCase() === q ||
          u.id?.toLowerCase() === q ||
          (q === "software.2040@pgel.in" && u.username === "admin") ||
          (q === "verify.software2040@pgel.in" && u.username === "admin")
      ) || null
    );
  }

  // Step 1: Identify & Dispatch OTP
  async function handleIdentify(e) {
    if (e) e.preventDefault();
    setError("");
    setSuccessMsg("");

    const clean = identifier.trim();
    if (!clean) {
      setError("Please enter your registered corporate email.");
      return;
    }

    const matched = findRegisteredUser(clean);
    if (!matched) {
      setError(`No registered employee account found for "${clean}". Please contact Plant Administrator.`);
      return;
    }

    const emailToSend = matched.email;

    setBusy(true);
    try {
      const res = await fetch("/api/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: emailToSend,
          name: matched.name,
          employee_code: matched.employee_code || "PGEL",
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setTargetUser(matched);
        setStep("otp");
        setOtp("");
        setResendTimer(30); // 30-second cooldown
        setSuccessMsg(`OTP sent to your registered email (${maskEmail(emailToSend)})`);
      } else {
        setError(data.error || "Failed to dispatch verification email. Please try again.");
      }
    } catch (err) {
      setError(`Unable to reach authentication service (${err.message}).`);
    } finally {
      setBusy(false);
    }
  }

  // Step 2: Verify OTP
  async function handleVerifyOtp(e) {
    if (e) e.preventDefault();
    setError("");

    const cleanOtp = otp.trim();
    if (!cleanOtp || cleanOtp.length < 4) {
      setError("Please enter 6-digit OTP");
      return;
    }

    setBusy(true);
    try {
      const email = targetUser?.email || identifier.trim();
      const res = await fetch("/api/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email,
          otp: cleanOtp,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        onLogin(targetUser || users[0]);
      } else {
        setError(data.error || "Invalid or expired OTP code.");
      }
    } catch (err) {
      setError(`Verification error (${err.message}).`);
    } finally {
      setBusy(false);
    }
  }

  const handleBack = () => {
    setStep("input");
    setOtp("");
    setError("");
    setSuccessMsg("");
  };

  const handleResendOtp = async () => {
    if (busy || resendTimer > 0) return;
    setBusy(true);
    setError("");
    try {
      const emailToSend = targetUser?.email || identifier.trim();
      const res = await fetch("/api/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: emailToSend,
          name: targetUser?.name || "Colleague",
          employee_code: targetUser?.employee_code || "PGEL",
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setResendTimer(30);
        setSuccessMsg(`OTP resent to your registered email (${maskEmail(emailToSend)})`);
      } else {
        setError(data.error || "Failed to resend OTP");
      }
    } catch (err) {
      setError("Failed to resend OTP");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="gp-login-container">
      {/* LEFT — Live Video Presentation (Exact Gatepass Architecture) */}
      <section className="gp-hero-section">
        {/* Real Industrial Background Video from Gatepass */}
        <video
          className="gp-hero-video"
          src="/intro.mp4"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
        />

        {/* Soft frosted gradient overlay */}
        <div className="gp-hero-gradient-overlay" />
        <div className="gp-hero-grid-pattern" />
        <div className="gp-scanline" />

        <div className="gp-hero-inner">
          <div className="gp-hero-content">
            <p className="gp-hero-tag">Live Plant Access</p>
            <h1 className="gp-hero-title">
              OEE Production
              <span>Tracking System</span>
            </h1>
            <p className="gp-hero-desc">
              Industrial movement control — machines, shifts, downtime reasons, and real-time OEE telemetry monitored across all PGEL plants.
            </p>

            <div className="gp-hero-pills">
              <span className="gp-hero-pill">Secure OTP</span>
              <span className="gp-hero-pill">Plant Ready</span>
              <span className="gp-hero-pill">Real-time OEE</span>
              <span className="gp-hero-pill">Audit Trail</span>
            </div>

            <div className="gp-hero-status">
              <span className="gp-status-ping">
                <span className="ping-ring" />
                <span className="ping-dot" />
              </span>
              <p className="gp-status-text">System Online</p>
            </div>
          </div>

          <div className="gp-hero-footer">
            <span>from</span>
            <span>PGEL AUTOMATION</span>
          </div>
        </div>
      </section>

      {/* RIGHT — Light Premium Auth Card */}
      <section className="gp-auth-section">
        <div className="gp-auth-card">
          <div>
            {/* PGEL Brand Logo Centered */}
            <div className="gp-logo-box">
              <img
                src="/pg-logo.png"
                alt="PGEL"
                className="gp-logo-img"
                onError={(e) => {
                  e.currentTarget.src = "/logo.png";
                }}
              />
            </div>

            {/* Corporate Identity Pill */}
            <div style={{ textAlign: "center", marginBottom: "8px" }}>
              <span className="gp-portal-pill">PG ELECTROPLAST LIMITED</span>
            </div>

            {/* Header Title & Subtitle */}
            <div className="gp-auth-header">
              {step === "input" ? (
                <>
                  <h2 className="gp-auth-title">Sign in</h2>
                  <p className="gp-auth-subtitle">
                    Shop-floor Production &amp; OEE Telemetry Portal
                  </p>
                </>
              ) : (
                <>
                  <div className="gp-auth-title-row">
                    <button
                      type="button"
                      onClick={handleBack}
                      className="gp-back-btn"
                      title="Back"
                    >
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="15 18 9 12 15 6" />
                      </svg>
                    </button>
                    <h2 className="gp-auth-title">Enter OTP</h2>
                  </div>
                  <p className="gp-auth-subtitle">
                    Authorization code dispatched to{" "}
                    <strong style={{ color: "#0f172a" }}>
                      {maskEmail(targetUser?.email || identifier)}
                    </strong>
                  </p>
                </>
              )}
            </div>

            {/* Passwordless Security Callout Banner (Enriches the card layout) */}
            {step === "input" && (
              <div className="gp-security-callout">
                <div style={{ fontSize: "20px", lineHeight: 1 }}>🛡️</div>
                <div>
                  <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: "2px" }}>
                    Passwordless Enterprise SSO
                  </div>
                  <div style={{ color: "#64748b", fontSize: "12px", lineHeight: 1.4 }}>
                    Single-use cryptographic OTP dispatched directly to your registered PGEL corporate inbox.
                  </div>
                </div>
              </div>
            )}

            {/* Alerts */}
            {error && (
              <div className="gp-error-box">
                <span>⚠️</span>
                <div>{error}</div>
              </div>
            )}
            {successMsg && (
              <div className="gp-success-box">
                <span>✓</span>
                <div>{successMsg}</div>
              </div>
            )}

            {/* STEP 1: Corporate Email Input */}
            {step === "input" && (
              <form onSubmit={handleIdentify}>
                <div style={{ marginBottom: "20px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <label className="gp-input-label" style={{ margin: 0 }}>OFFICIAL WORK EMAIL</label>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "#0284c7", background: "#f0f9ff", border: "1px solid #bae6fd", padding: "2px 8px", borderRadius: "6px", letterSpacing: "0.04em" }}>
                      @pgel.in
                    </span>
                  </div>
                  <div style={{ position: "relative" }}>
                    <input
                      type="email"
                      required
                      autoFocus
                      value={identifier}
                      onChange={(e) => {
                        setIdentifier(e.target.value);
                        setError("");
                      }}
                      placeholder=""
                      className="gp-text-input"
                      style={{ paddingLeft: "46px" }}
                    />
                    <span
                      style={{
                        position: "absolute",
                        left: "15px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        color: "#94a3b8",
                        display: "flex",
                        alignItems: "center",
                        pointerEvents: "none",
                      }}
                    >
                      <svg
                        width="19"
                        height="19"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                        <polyline points="22,6 12,13 2,6" />
                      </svg>
                    </span>
                  </div>
                  <p style={{ margin: "8px 0 0", fontSize: "12px", color: "#64748b", textAlign: "left" }}>
                    Enter your authorized PGEL email address to receive an authentication code.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={busy || !identifier.trim()}
                  className="gp-submit-btn"
                >
                  {busy ? (
                    <>
                      <svg
                        className="gp-spinner"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                      >
                        <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                        <path d="M12 2a10 10 0 0 1 10 10" />
                      </svg>
                      DISPATCHING OTP…
                    </>
                  ) : (
                    <>
                      SEND VERIFICATION CODE
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                      </svg>
                    </>
                  )}
                </button>
              </form>
            )}

            {/* STEP 2: OTP Code Verification */}
            {step === "otp" && (
              <form onSubmit={handleVerifyOtp}>
                {/* Recipient summary bar with Change button */}
                <div className="gp-recipient-card">
                  <div className="gp-recipient-info">
                    <span className="gp-recipient-name">
                      {targetUser?.name || "System Administrator"} {targetUser?.employee_code ? `(${targetUser.employee_code})` : ""}
                    </span>
                    <span className="gp-recipient-email">
                      {targetUser?.email || identifier}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleBack}
                    className="gp-change-btn"
                  >
                    Change
                  </button>
                </div>

                <div style={{ marginBottom: "18px" }}>
                  <label className="gp-input-label">ENTER 6-DIGIT OTP CODE</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    autoFocus
                    maxLength={6}
                    value={otp}
                    onChange={(e) => {
                      setOtp(e.target.value.replace(/\D/g, "").slice(0, 6));
                      setError("");
                    }}
                    placeholder=""
                    className="gp-otp-input"
                  />
                  <p style={{ margin: "8px 0 0", fontSize: "12px", color: "#64748b", textAlign: "center" }}>
                    Please check your Outlook inbox or spam folder. Never share this code.
                  </p>
                </div>

                <div className="gp-auth-links-row">
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={busy || resendTimer > 0}
                    className="gp-link-btn"
                  >
                    {resendTimer > 0 ? `Resend code in ${resendTimer}s` : "Resend OTP Code"}
                  </button>
                  <button
                    type="button"
                    onClick={handleBack}
                    className="gp-link-btn"
                  >
                    Use different email
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={busy || otp.length < 4}
                  className="gp-submit-btn"
                >
                  {busy ? (
                    <>
                      <svg
                        className="gp-spinner"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                      >
                        <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                        <path d="M12 2a10 10 0 0 1 10 10" />
                      </svg>
                      VERIFYING CODE…
                    </>
                  ) : (
                    <>
                      VERIFY &amp; ACCESS SYSTEM
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                      </svg>
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Industrial Shopfloor Status Badges */}
            <div className="gp-system-badges">
              <div className="gp-sys-badge">
                <span className="gp-badge-dot green" />
                <span>Live OEE Telemetry</span>
              </div>
              <div className="gp-sys-badge">
                <span className="gp-badge-dot blue" />
                <span>Moulding &amp; Assembly</span>
              </div>
              <div className="gp-sys-badge">
                <span className="gp-badge-dot red" />
                <span>Shift 1/2/3 Synchronized</span>
              </div>
            </div>
          </div>

          {/* Footer Branding */}
          <div className="gp-auth-footer">
            <div style={{ fontSize: "11.5px", fontWeight: 700, letterSpacing: "0.03em", color: "#0f172a", marginBottom: "6px" }}>
              Authorized PGEL Personnel Only
            </div>
            <div className="gp-footer-sub">
              <span>from</span>
              <strong style={{ color: "#0f172a" }}>PGEL AUTOMATION</strong>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
