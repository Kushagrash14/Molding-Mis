import nodemailer from "nodemailer";

function smtpConfig() {
  const host = (process.env.SMTP_HOST || "smtp.office365.com").trim();
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = (process.env.SMTP_USER || "").trim().replace(/^["']|["']$/g, "").replace(/\r/g, "");
  const pass = (process.env.SMTP_PASS || "").trim().replace(/^["']|["']$/g, "").replace(/\r/g, "");
  if (!user || !pass) return null;
  return { host, port, user, pass };
}

function transporter(cfg) {
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: false,
    auth: { user: cfg.user, pass: cfg.pass },
    tls: { minVersion: "TLSv1.2" },
    connectionTimeout: 12000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

export async function sendLoginOtp({ to, name, employeeCode, otp }) {
  const cfg = smtpConfig();
  if (!cfg) {
    const err = new Error("Email login is not configured on the server.");
    err.status = 503;
    throw err;
  }
  const safeName = esc(name || "Colleague");
  const safeCode = esc(employeeCode || "PGEL");
  const safeOtp = esc(otp);
  await transporter(cfg).sendMail({
    from: `"PGEL Production Portal" <${cfg.user}>`,
    to,
    subject: "PGEL Portal verification code",
    text: `Hello ${name || "Colleague"},\n\nYour PGEL Portal verification code is: ${otp}\n\nThis code is valid for 10 minutes. Do not share it.\n`,
    html: `
      <div style="font-family:Segoe UI,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px;">
        <p>Hello <strong>${safeName}</strong> (${safeCode}),</p>
        <p>Your verification code is:</p>
        <div style="font-size:32px;font-weight:800;letter-spacing:6px;">${safeOtp}</div>
        <p>Valid for 10 minutes. Do not share this code.</p>
      </div>`,
  });
}
