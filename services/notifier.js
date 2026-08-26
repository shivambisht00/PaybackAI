/**
 * Task 7: Notification Service (Email via Nodemailer / Console Demo Fallback)
 */
const nodemailer = require('nodemailer');

async function sendNotification({ to, subject, message, channel = 'email' }) {
  const sentAt = new Date().toISOString();

  // ✨ INTERVIEWER DEMO TRICK: 
  // Chahe channel koi bhi ho (SMS, WhatsApp, ya Email), hum SMTP config hone par 
  // use email ke through hi dispatch karenge taaki real inbox mein deliver ho sake!
  const shouldRouteViaEmail = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.SMTP_HOST.trim() !== '';

  // Check if SMTP is configured for Email
  // --- ORIGINAL CONDITION (Commented out) ---
  // if (
  //   channel === 'email' &&
  //   process.env.SMTP_HOST &&
  //   process.env.SMTP_USER &&
  //   process.env.SMTP_PASS &&
  //   process.env.SMTP_HOST.trim() !== ''
  // ) {
  // ------------------------------------------

  if (shouldRouteViaEmail) {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: parseInt(process.env.SMTP_PORT || '587', 10) === 465,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });

      // Agar channel email ke alawa kuch aur hai, toh subject mein channel tag attach kar do
      const formattedSubject = channel !== 'email' 
        ? `[Via ${channel.toUpperCase()} Simulation] ${subject}` 
        : (subject || 'Action Required: Complete Your Payment');

      const info = await transporter.sendMail({
        from: process.env.EMAIL_FROM || '"PayBack AI Recovery" <no-reply@payback.ai>',
        to: to || 'customer@example.com',
        subject: formattedSubject,
        text: message,
        html: `<div style="font-family: sans-serif; padding: 20px; line-height: 1.6; color: #111;">
          <h2 style="color: #00F0FF; background: #0A0B10; padding: 12px; border-radius: 6px;">PayBack AI Recovery (${channel.toUpperCase()} Channel Gateway)</h2>
          <pre style="white-space: pre-wrap; font-family: inherit;">${message}</pre>
        </div>`
      });

      console.log(`📧 [EMAIL SENT via Nodemailer | Channel: ${channel.toUpperCase()}] Message ID: ${info.messageId}`);
      return { success: true, channel, messageId: info.messageId, sent_at: sentAt };
    } catch (err) {
      console.warn(`⚠️ SMTP Email failed (${err.message}). Falling back to demo console log.`);
    }
  }

  // Demo / Mock Console Notification Fallback for Unconfigured Email
  console.log(`\n======================================================`);
  console.log(`📱 MOCK NOTIFICATION SENT [Channel: ${channel.toUpperCase()}]`);
  console.log(`------------------------------------------------------`);
  console.log(`To: ${to || 'Customer Contact'}`);
  console.log(`Subject: ${subject || 'PayBack AI Payment Recovery'}`);
  console.log(`Time: ${sentAt}`);
  console.log(`Message:\n${message}`);
  console.log(`======================================================\n`);

  return {
    success: true,
    channel,
    sent_at: sentAt,
    delivered_via: 'console_demo'
  };
}

module.exports = {
  sendNotification
};