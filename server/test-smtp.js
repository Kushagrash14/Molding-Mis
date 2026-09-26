import nodemailer from "nodemailer";

async function main() {
  console.log("--------------------------------------------------");
  console.log("Testing Office 365 SMTP connectivity from this machine...");
  console.log("Host: smtp.office365.com:587");
  console.log("User: verify.software2040@pgel.in");
  console.log("--------------------------------------------------");

  const transporter = nodemailer.createTransport({
    host: "smtp.office365.com",
    port: 587,
    family: 4,
    secure: false,
    requireTLS: true,
    auth: {
      user: "verify.software2040@pgel.in",
      pass: "fmdrdczrxkpjrbsv",
    },
    tls: {
      servername: "smtp.office365.com",
      rejectUnauthorized: false,
    },
    connectionTimeout: 15000,
    greetingTimeout: 10000,
  });

  try {
    const verified = await transporter.verify();
    console.log(">>> SUCCESS: Office 365 SMTP Authenticated and Connected successfully!", verified);

    console.log("Attempting test email dispatch to software.2040@pgel.in...");
    const info = await transporter.sendMail({
      from: '"PGEL Production Portal" <verify.software2040@pgel.in>',
      to: "software.2040@pgel.in",
      subject: "PGEL Portal SMTP Verification Test",
      text: "This is a confirmation that automated email delivery from the production server is operational.",
    });
    console.log(">>> EMAIL DISPATCHED SUCCESSFULLY! Message ID:", info.messageId);
    console.log("Please check software.2040@pgel.in inbox or spam folder.");
  } catch (err) {
    console.error(">>> SMTP ERROR:", err.message);
    if (err.code) console.error("Error Code:", err.code);
    if (err.response) console.error("Server Response:", err.response);
  }
}

main();
