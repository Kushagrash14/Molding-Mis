import dotenv from "dotenv";

dotenv.config();

if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
  console.error("Set SMTP_USER and SMTP_PASS in the environment. No password is stored in this file.");
  process.exit(1);
}

console.log("Use server/test-smtp.js to verify the configured mailbox.");
