/**
 * Task 10: Retry Portal Validation & Payment Resolution APIs
 */
const express = require('express');
const router = express.Router();
const db = require('../database/db');

// GET /api/retry/validate/:token — Validate Token, Status, Expiry for Retry Portal
router.get('/retry/validate/:token', (req, res) => {
  try {
    const { token } = req.params;

    if (!token || token.trim() === '') {
      return res.status(400).json({ success: false, status: 'invalid', message: 'Token is required' });
    }

    const stmt = db.prepare(`
      SELECT r.*, t.customer_name, t.amount, t.failure_reason, t.payment_method, t.timestamp as transaction_timestamp
      FROM recovery_attempts r
      JOIN transactions t ON r.transaction_id = t.id
      WHERE r.retry_token = ?
    `);
    const attempt = stmt.get(token);

    if (!attempt) {
      return res.status(404).json({ success: false, status: 'invalid', message: 'Recovery link not found' });
    }

    // Check invalidation state
    if (attempt.link_status === 'invalidated') {
      return res.status(410).json({
        success: false,
        status: 'invalidated',
        message: 'This retry link is no longer active because a newer link was issued for this payment.'
      });
    }

    // Check used state
    if (attempt.link_status === 'used') {
      return res.status(409).json({
        success: false,
        status: 'used',
        message: 'This payment has already been successfully recovered.'
      });
    }

    // Check expiry timestamp
    const now = new Date();
    const expiryTime = new Date(attempt.link_expires_at);

    if (now > expiryTime || attempt.link_status === 'expired') {
      // Mark as expired in DB
      db.prepare("UPDATE recovery_attempts SET link_status = 'expired', outcome = 'expired' WHERE id = ?").run(attempt.id);
      return res.status(410).json({
        success: false,
        status: 'expired',
        message: 'This payment recovery link has expired (30-minute security limit exceeded).'
      });
    }

    // Active link: return payment metadata for retry page
    res.json({
      success: true,
      status: 'active',
      transaction: {
        id: attempt.transaction_id,
        customer_name: attempt.customer_name,
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

// POST /api/retry/pay — Internal Demo Payment Execution
router.post('/retry/pay', (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ success: false, error: 'Token is required' });
    }

    const attempt = db.prepare('SELECT * FROM recovery_attempts WHERE retry_token = ?').get(token);
    if (!attempt) {
      return res.status(404).json({ success: false, error: 'Token not found' });
    }

    if (attempt.link_status === 'used') {
      return res.status(400).json({ success: false, error: 'This recovery link has already been used' });
    }

    if (attempt.link_status === 'invalidated') {
      return res.status(400).json({ success: false, error: 'This recovery link has been invalidated' });
    }

    const now = new Date();
    const expiryTime = new Date(attempt.link_expires_at);

    if (now > expiryTime || attempt.link_status === 'expired') {
      db.prepare("UPDATE recovery_attempts SET link_status = 'expired', outcome = 'expired' WHERE id = ?").run(attempt.id);
      return res.status(400).json({ success: false, error: 'This recovery link has expired' });
    }

    // Execute Payment Recovery Update
    db.prepare("UPDATE recovery_attempts SET link_status = 'used', outcome = 'recovered' WHERE id = ?").run(attempt.id);
    db.prepare("UPDATE transactions SET status = 'recovered' WHERE id = ?").run(attempt.transaction_id);

    console.log(`🎉 [PAYMENT RECOVERED] Transaction #${attempt.transaction_id} successfully processed!`);

    res.json({
      success: true,
      message: 'Payment successfully recovered!',
      transaction_id: attempt.transaction_id,
      amount: attempt.amount
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
