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

    // Verify webhook signature if secret exists
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
