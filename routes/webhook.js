/**
 * Task 14 & Section 26: Razorpay Webhook Handler & Redirect Listener
 */
const express = require('express');
const router = express.Router();
const db = require('../database/db');
const razorpayService = require('../services/razorpayService');

// POST /api/webhook/razorpay — Idempotent Webhook Listener
router.post('/webhook/razorpay', (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (secret && secret.trim() !== '') {
      const isValid = razorpayService.verifyWebhookSignature(req.rawBody || JSON.stringify(req.body), signature, secret);
      if (!isValid) {
        console.warn('⚠️ Invalid Razorpay Webhook Signature!');
        return res.status(400).json({ success: false, error: 'Invalid signature' });
      }
    }

    const event = req.body.event;
    const payload = req.body.payload;

    console.log(`🔔 Received Razorpay Webhook Event: ${event}`);

    // Handle Payment Success Events
    if (event === 'payment.captured' || event === 'payment_link.paid') {
      const notes = (payload.payment && payload.payment.entity && payload.payment.entity.notes) ||
                    (payload.payment_link && payload.payment_link.entity && payload.payment_link.entity.notes) || {};

      const retryToken = notes.retry_token;
      const transactionId = notes.transaction_id;

      if (retryToken) {
        const attempt = db.prepare('SELECT * FROM recovery_attempts WHERE retry_token = ?').get(retryToken);
        if (attempt) {
          db.prepare("UPDATE recovery_attempts SET link_status = 'used', outcome = 'recovered' WHERE id = ?").run(attempt.id);
          db.prepare("UPDATE transactions SET status = 'recovered' WHERE id = ?").run(attempt.transaction_id);
          console.log(`✅ [WEBHOOK RECOVERY SUCCESS] Transaction #${attempt.transaction_id} marked as recovered via Razorpay!`);
        }
      } else if (transactionId) {
        db.prepare("UPDATE transactions SET status = 'recovered' WHERE id = ?").run(transactionId);
        console.log(`✅ [WEBHOOK RECOVERY SUCCESS] Transaction #${transactionId} marked as recovered!`);
      }
    }

    // Handle Payment Failure Events (Automatic Capture)
    if (event === 'payment.failed') {
      const paymentEntity = payload.payment && payload.payment.entity ? payload.payment.entity : {};
      
      const insertTx = db.prepare(`
        INSERT INTO transactions (customer_name, customer_email, customer_phone, amount, payment_method, failure_reason, status)
        VALUES (?, ?, ?, ?, ?, ?, 'failed')
      `);
      
      const txResult = insertTx.run(
        paymentEntity.name || 'Valued Customer',
        paymentEntity.email || 'customer@example.com',
        paymentEntity.contact || '9999999999',
        (paymentEntity.amount || 0) / 100, // paise to INR
        paymentEntity.method || 'card',
        paymentEntity.error_reason || 'gateway_declined'
      );

      console.log(`🚨 [REAL WEBHOOK] Failed transaction captured automatically! ID: ${txResult.lastInsertRowid}`);
    }

    res.json({ success: true, status: 'processed' });
  } catch (err) {
    console.error('Error handling Razorpay webhook:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/webhook/razorpay-redirect — Browser Redirect Handler after Razorpay Checkout
router.get('/webhook/razorpay-redirect', (req, res) => {
  const { token, razorpay_payment_status, razorpay_payment_id } = req.query;

  if (token) {
    const attempt = db.prepare('SELECT * FROM recovery_attempts WHERE retry_token = ?').get(token);
    if (attempt && (razorpay_payment_status === 'paid' || razorpay_payment_id)) {
      db.prepare("UPDATE recovery_attempts SET link_status = 'used', outcome = 'recovered' WHERE id = ?").run(attempt.id);
      db.prepare("UPDATE transactions SET status = 'recovered' WHERE id = ?").run(attempt.transaction_id);
    }
    return res.redirect(`/retry.html?token=${token}`);
  }

  res.redirect('/');
});

module.exports = router;