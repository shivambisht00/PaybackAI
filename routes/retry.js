/**
 * Task 10: Retry Portal Validation & Real Razorpay Payment APIs
 */
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Razorpay = require('razorpay');
const db = require('../database/db'); // (Aapka path alag ho sakta hai, ise same rehne dena)

const notifier = require('../services/notifier');
const aiAgent = require('../services/aiAgent');

// Initialize Razorpay (Environment variables se keys uthayega)
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_dummy_key',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'rzp_test_dummy_secret',
});

function buildReceipt(attempt) {
  const paidAt = attempt.recovered_at || attempt.created_at || new Date().toISOString();

  return {
    receipt_number: `PBAI-${String(attempt.transaction_id).padStart(6, '0')}-${String(attempt.id).padStart(6, '0')}`,
    transaction_id: `TXN-${String(attempt.transaction_id).padStart(6, '0')}`,
    attempt_id: attempt.id,
    customer_name: attempt.customer_name,
    customer_email: attempt.customer_email,
    customer_phone: attempt.customer_phone,
    amount: attempt.amount,
    currency: 'INR',
    payment_method: attempt.payment_method,
    failure_reason: attempt.failure_reason,
    status: 'recovered',
    paid_at: paidAt,
    razorpay_payment_id: attempt.razorpay_payment_id || null,
    razorpay_order_id: attempt.razorpay_order_id || null
  };
}

// GET /api/retry/validate/:token — Validate Token, Status, Expiry for Retry Portal
router.get('/retry/validate/:token', (req, res) => {
  try {
    const { token } = req.params;

    if (!token || token.trim() === '') {
      return res.status(400).json({ success: false, status: 'invalid', message: 'Token is required' });
    }

    // ADDED: customer_email, customer_phone in SELECT query
    const stmt = db.prepare(`
      SELECT r.*, t.customer_name, t.customer_email, t.customer_phone, t.amount, t.failure_reason, t.payment_method, t.timestamp as transaction_timestamp
      FROM recovery_attempts r
      JOIN transactions t ON r.transaction_id = t.id
      WHERE r.retry_token = ?
    `);
    const attempt = stmt.get(token);

    if (!attempt) {
      return res.status(404).json({ success: false, status: 'invalid', message: 'Recovery link not found' });
    }

    if (attempt.link_status === 'invalidated') {
      return res.status(410).json({ success: false, status: 'invalidated', message: 'This retry link is no longer active.' });
    }

    if (attempt.link_status === 'used') {
      return res.status(409).json({ success: false, status: 'used', message: 'This payment has already been successfully recovered.' });
    }

    const now = new Date();
    const expiryTime = new Date(attempt.link_expires_at);

    if (now > expiryTime || attempt.link_status === 'expired') {
      db.prepare("UPDATE recovery_attempts SET link_status = 'expired', outcome = 'expired' WHERE id = ?").run(attempt.id);
      return res.status(410).json({ success: false, status: 'expired', message: 'This payment recovery link has expired.' });
    }

    res.json({
      success: true,
      status: 'active',
      transaction: {
        id: attempt.transaction_id,
        customer_name: attempt.customer_name,
        customer_email: attempt.customer_email, // Passed for Razorpay prefill
        customer_phone: attempt.customer_phone, // Passed for Razorpay prefill
        amount: attempt.amount,
        payment_method: attempt.payment_method,
        failure_reason: attempt.failure_reason,
        timestamp: attempt.transaction_timestamp
      },
      attempt: {
        id: attempt.id,
        channel: attempt.channel,
        created_at: attempt.created_at,
        expires_at: attempt.link_expires_at
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/retry/create-order — 1. Generate Real Razorpay Order
router.post('/retry/create-order', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ success: false, error: 'Token is required' });

    // DB fetch with Amount
    const attempt = db.prepare(`
      SELECT r.*, t.amount FROM recovery_attempts r 
      JOIN transactions t ON r.transaction_id = t.id 
      WHERE r.retry_token = ?
    `).get(token);

    if (!attempt) return res.status(404).json({ success: false, error: 'Token not found' });
    if (attempt.link_status !== 'active') return res.status(400).json({ success: false, error: 'Link is not active' });

    // Razorpay accepts amount in paise (1 INR = 100 Paise)
    const amountInPaise = Math.round(attempt.amount * 100);

    const options = {
      amount: amountInPaise,
      currency: 'INR',
      receipt: `receipt_tx_${attempt.transaction_id}`,
      payment_capture: 1 // Auto capture
    };

    const order = await razorpay.orders.create(options);

    res.json({
      success: true,
      order: order,
      key: process.env.RAZORPAY_KEY_ID // Send public key to frontend
    });
  } catch (err) {
    console.error("Razorpay Order Error:", err);
    res.status(500).json({ success: false, error: 'Payment gateway error' });
  }
});

// POST /api/retry/verify-payment — 2. Securely Verify & Update DB
router.post('/retry/verify-payment', async (req, res) => {
  try {
    const { token, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const attempt = db.prepare('SELECT * FROM recovery_attempts WHERE retry_token = ?').get(token);
    if (!attempt) return res.status(404).json({ success: false, error: 'Token not found' });

    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      return res.status(500).json({ success: false, error: 'Razorpay secret is not configured' });
    }

    // Generate Signature manually to compare with Razorpay's signature
    const generated_signature = crypto
      .createHmac('sha256', secret)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest('hex');

    // Verification Logic
    if (generated_signature === razorpay_signature) {
      // Signature is valid! Update DB
      const recoveredAt = new Date().toISOString();
      db.prepare(`
        UPDATE recovery_attempts
        SET link_status = 'used',
            outcome = 'recovered',
            recovered_at = COALESCE(recovered_at, ?),
            razorpay_payment_id = COALESCE(?, razorpay_payment_id),
            razorpay_order_id = COALESCE(?, razorpay_order_id)
        WHERE id = ?
      `).run(recoveredAt, razorpay_payment_id, razorpay_order_id, attempt.id);
      db.prepare("UPDATE transactions SET status = 'recovered' WHERE id = ?").run(attempt.transaction_id);

      // ✨ Success mail ke liye transaction details fetch karo
      const fullDetails = db.prepare(`
        SELECT r.*, t.customer_name, t.customer_email, t.customer_phone, t.amount, t.payment_method, t.failure_reason
        FROM recovery_attempts r 
        JOIN transactions t ON r.transaction_id = t.id 
        WHERE r.id = ?
      `).get(attempt.id);

   // ✨ Thank You / Success Notification Trigger karo
      try {
        const successMsg = aiAgent.generateSuccessMessage(fullDetails);
        
        // Target recipient logic: Customer email ya test override
        const testOverrideEmail = process.env.TEST_OVERRIDE_EMAIL || '8171659929sb@gmail.com'; 
        const useOverride = process.env.USE_TEST_OVERRIDE === 'true'; 
        const recipientEmail = useOverride ? testOverrideEmail : (fullDetails.customer_email || testOverrideEmail);

        await notifier.sendNotification({
          to: recipientEmail, // Customer ki real email (ya test override)
          subject: `Payment Successful! 🎉 Recovery Confirmed for ₹${fullDetails.amount}`,
          message: successMsg,
          channel: 'email'
        });
        console.log(`📧 [SUCCESS EMAIL SENT] Thank you mail dispatched to ${recipientEmail}!`);
      } catch (mailErr) {
        console.error('⚠️ Failed to send success notification:', mailErr.message);
      }

      console.log(`🎉 [PAYMENT RECOVERED - SECURE] Transaction #${attempt.transaction_id} successfully processed via Razorpay!`);

      res.json({
        success: true,
        message: 'Payment authenticated and recovered successfully!',
        receipt: buildReceipt(fullDetails)
      });
    } else {
      console.error(`🚨 [SECURITY ALERT] Invalid payment signature for token ${token}`);
      res.status(400).json({ success: false, error: 'Digital signature validation failed. Potential tampering.' });
    }
    
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/retry/receipt/:token — Stable receipt data for success page/download
router.get('/retry/receipt/:token', (req, res) => {
  try {
    const { token } = req.params;

    const attempt = db.prepare(`
      SELECT r.*, t.customer_name, t.customer_email, t.customer_phone, t.amount, t.payment_method, t.failure_reason, t.status as transaction_status
      FROM recovery_attempts r
      JOIN transactions t ON r.transaction_id = t.id
      WHERE r.retry_token = ?
    `).get(token);

    if (!attempt) {
      return res.status(404).json({ success: false, error: 'Receipt not found' });
    }

    if (attempt.link_status !== 'used' && attempt.transaction_status !== 'recovered') {
      return res.status(409).json({ success: false, error: 'Payment is not recovered yet' });
    }

    res.json({ success: true, receipt: buildReceipt(attempt) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/retry/status/:token — Check if payment was already recovered
router.get('/retry/status/:token', (req, res) => {
  try {
    const { token } = req.params;
    const attempt = db.prepare(`
      SELECT r.link_status, t.status 
      FROM recovery_attempts r 
      JOIN transactions t ON r.transaction_id = t.id 
      WHERE r.retry_token = ?
    `).get(token);

    if (!attempt) return res.json({ recovered: false });

    if (attempt.link_status === 'used' || attempt.status === 'recovered') {
      return res.json({ recovered: true });
    }

    res.json({ recovered: false });
  } catch (err) {
    res.json({ recovered: false });
  }
});

module.exports = router;
