import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;
if (!user || !pass) {
  console.error("Set SMTP_USER and SMTP_PASS in the environment. No password is stored in this file.");
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.office365.com",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: { user, pass },
  tls: { minVersion: "TLSv1.2" },
});

const verified = await transporter.verify();
console.log("SMTP connected:", verified);
