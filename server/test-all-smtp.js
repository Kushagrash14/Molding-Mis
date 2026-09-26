import nodemailer from "nodemailer";

const PASS = "fmdrdczrxkpjrbsv";
const USER = "verify.software2040@pgel.in";

const configs = [
  {
    name: "1. GatePass Original Style (SSLv3 ciphers, no requireTLS, default family)",
    options: {
      host: "smtp.office365.com",
      port: 587,
      secure: false,
      auth: { user: USER, pass: PASS },
      tls: { ciphers: "SSLv3", rejectUnauthorized: false },
    },
  },
  {
    name: "2. Nodemailer Built-in Outlook365 Service",
    options: {
      service: "Outlook365",
      auth: { user: USER, pass: PASS },
      tls: { rejectUnauthorized: false },
    },
  },
  {
    name: "3. Alternative Endpoint (smtp-mail.outlook.com)",
    options: {
      host: "smtp-mail.outlook.com",
      port: 587,
      secure: false,
      auth: { user: USER, pass: PASS },
      tls: { rejectUnauthorized: false },
    },
  },
  {
    name: "4. Outlook Direct (outlook.office365.com)",
    options: {
      host: "outlook.office365.com",
      port: 587,
      secure: false,
      auth: { user: USER, pass: PASS },
      tls: { rejectUnauthorized: false },
    },
  },
];

async function run() {
  console.log("==================================================");
  console.log("Running Multi-Configuration SMTP Diagnostics for PGEL");
  console.log(`Target User: ${USER}`);
  console.log("==================================================\n");

  for (const cfg of configs) {
    console.log(`Testing: ${cfg.name}...`);
    try {
      const transporter = nodemailer.createTransport(cfg.options);
      const ok = await transporter.verify();
      console.log(`>>> SUCCESS WITH [${cfg.name}]! Result:`, ok);

      console.log("Attempting dispatch test...");
      const info = await transporter.sendMail({
        from: `"PGEL Production Portal" <${USER}>`,
        to: "software.2040@pgel.in",
        subject: `PGEL SMTP Success: ${cfg.name}`,
        text: `Email delivery verified using ${cfg.name}`,
      });
      console.log(`>>> EMAIL SENT SUCCESSFULLY! MessageId: ${info.messageId}\n`);
      return; // Stop on first success!
    } catch (err) {
      console.log(`FAILED [${cfg.name}]: ${err.message}\n`);
    }
  }

  console.log("==================================================");
  console.log("All direct SMTP configurations were rejected by Microsoft 365.");
  console.log("==================================================");
}

run();
