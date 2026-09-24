import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import dns from "dns";

dotenv.config();

async function createMailTransporter() {
  const host = process.env.SMTP_HOST || "smtp.office365.com";
  let targetHost = host;
  try {
    targetHost = await new Promise((resolve, reject) => {
      dns.lookup(host, { family: 4 }, (err, address) => {
        if (err) reject(err);
        else resolve(address);
      });
    });
  } catch (err) {
    console.warn("[OTP] DNS lookup fallback, using host:", host);
  }

  return nodemailer.createTransport({
    host: targetHost,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      servername: host,
      rejectUnauthorized: false,
    },
  });
}

function otpApiPlugin() {
  const activeOtps = new Map();

  return {
    name: "otp-api-plugin",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url === "/api/send-otp" && req.method === "POST") {
          let body = "";
          req.on("data", (chunk) => {
            body += chunk;
          });
          req.on("end", async () => {
            try {
              const { email, name, employee_code } = JSON.parse(body || "{}");
              if (!email) {
                res.writeHead(400, { "Content-Type": "application/json" });
                return res.end(
                  JSON.stringify({ success: false, error: "Email address is required." })
                );
              }

              const otp = Math.floor(100000 + Math.random() * 900000).toString();
              const expiresAt = Date.now() + 10 * 60 * 1000;
              activeOtps.set(email.toLowerCase(), { otp, expiresAt, name, employee_code });

              // Send real email via Office 365
              const mailOptions = {
                from: `"PGEL Production Portal" <${process.env.SMTP_USER}>`,
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

              console.log(`\n========================================\n🔐 [PGEL OTP] Generated code for ${email}: ${otp}\n========================================\n`);

              let sent = false;
              let sendError = null;
              try {
                const transporter = await createMailTransporter();
                await transporter.sendMail(mailOptions);
                sent = true;
                console.log(`[OTP] Real security email delivered to ${email}`);
              } catch (mailErr) {
                console.error("[OTP] SMTP Send Error:", mailErr.message);
                sendError = mailErr.message;
              }

              if (!sent) {
                res.writeHead(502, { "Content-Type": "application/json" });
                return res.end(
                  JSON.stringify({
                    success: false,
                    error: `Mail delivery failed (${sendError || "SMTP connection error"}). Please contact Plant IT.`,
                  })
                );
              }

              res.writeHead(200, { "Content-Type": "application/json" });
              return res.end(
                JSON.stringify({
                  success: true,
                  message: `A 6-digit security code has been dispatched to your registered email address.`,
                })
              );
            } catch (err) {
              res.writeHead(500, { "Content-Type": "application/json" });
              return res.end(JSON.stringify({ success: false, error: err.message }));
            }
          });
          return;
        }

        if (req.url === "/api/verify-otp" && req.method === "POST") {
          let body = "";
          req.on("data", (chunk) => {
            body += chunk;
          });
          req.on("end", async () => {
            try {
              const { email, otp } = JSON.parse(body || "{}");
              const cleanEmail = (email || "").toLowerCase().trim();
              const cleanOtp = (otp || "").toString().trim();
              const record = activeOtps.get(cleanEmail);

              if (!record) {
                res.writeHead(400, { "Content-Type": "application/json" });
                return res.end(
                  JSON.stringify({
                    success: false,
                    error: "No active verification code found for this user. Please request a new OTP.",
                  })
                );
              }

              if (Date.now() >= record.expiresAt) {
                activeOtps.delete(cleanEmail);
                res.writeHead(400, { "Content-Type": "application/json" });
                return res.end(
                  JSON.stringify({
                    success: false,
                    error: "The verification code has expired (10-minute limit). Please request a new code.",
                  })
                );
              }

              if (record.otp !== cleanOtp) {
                res.writeHead(400, { "Content-Type": "application/json" });
                return res.end(
                  JSON.stringify({
                    success: false,
                    error: "Invalid security code. Please check the 6-digit code in your email and try again.",
                  })
                );
              }

              // Verification successful
              activeOtps.delete(cleanEmail);
              res.writeHead(200, { "Content-Type": "application/json" });
              return res.end(JSON.stringify({ success: true }));
            } catch (err) {
              res.writeHead(500, { "Content-Type": "application/json" });
              return res.end(JSON.stringify({ success: false, error: err.message }));
            }
          });
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), otpApiPlugin()],
  server: {
    port: 5173,
    open: true,
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${process.env.PORT || 5000}`,
        changeOrigin: true,
      },
    },
  },
});

