/**
 * Task 11 & Section 20: Admin Backend APIs with Password Protection
 */
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../database/db');
const classifier = require('../services/classifier');
const aiAgent = require('../services/aiAgent');
const notifier = require('../services/notifier');
const razorpayService = require('../services/razorpayService');

// Admin Password Middleware
function requireAdminAuth(req, res, next) {
  const adminPass = process.env.ADMIN_PASSWORD || 'admin123';
  const providedPass = req.headers['x-admin-password'] || req.body.admin_password || req.query.admin_password;

  if (providedPass && providedPass === adminPass) {
    return next();
  }
  return res.status(401).json({ success: false, error: 'Unauthorized: Invalid Admin Password' });
}

// POST /api/admin/auth — Verify Admin Credentials
router.post('/admin/auth', (req, res) => {
  const adminPass = process.env.ADMIN_PASSWORD || 'admin123';
  const { password } = req.body;

  if (password === adminPass) {
    return res.json({ success: true, message: 'Admin authenticated' });
  }
  return res.status(401).json({ success: false, error: 'Incorrect Admin Password' });
});

// Protect all remaining admin endpoints
router.use('/admin', requireAdminAuth);

// GET /api/admin/overview — Full System Overview for Admin Portal
router.get('/admin/overview', (req, res) => {
  try {
    const attempts = db.prepare(`
      SELECT r.*, t.customer_name, t.amount, t.payment_method, t.failure_reason, t.status as tx_status
      FROM recovery_attempts r
      JOIN transactions t ON r.transaction_id = t.id
      ORDER BY r.id DESC
      LIMIT 100
    `).all();

    const activeLinksCount = db.prepare("SELECT COUNT(*) as count FROM recovery_attempts WHERE link_status = 'active'").get().count;
    const invalidatedCount = db.prepare("SELECT COUNT(*) as count FROM recovery_attempts WHERE link_status = 'invalidated'").get().count;

    res.json({
      success: true,
      data: {
        attempts,
        active_links_count: activeLinksCount,
        invalidated_links_count: invalidatedCount
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/admin/resend — Resend Link (Invalidates Old Active Link, Creates New Link)
router.post('/admin/resend', async (req, res) => {
  try {
    const { transaction_id } = req.body;
    if (!transaction_id) {
      return res.status(400).json({ success: false, error: 'transaction_id is required' });
    }

    const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(transaction_id);
    if (!tx) {
      return res.status(404).json({ success: false, error: 'Transaction not found' });
    }

    // Invalidation Rule: Mark previous active links as invalidated
    db.prepare(`
      UPDATE recovery_attempts 
      SET link_status = 'invalidated' 
      WHERE transaction_id = ? AND link_status = 'active'
    `).run(transaction_id);

    // Generate new token & expiry
    const newRetryToken = crypto.randomBytes(16).toString('hex');
    const expiryMinutes = parseInt(process.env.LINK_EXPIRY_MINUTES || '30', 10);
    const now = new Date();
    const expiryDate = new Date(now.getTime() + expiryMinutes * 60 * 1000).toISOString();

    const host = req.get('host') || 'localhost:3000';
    const protocol = req.protocol || 'http';
    const baseUrl = `${protocol}://${host}`;

    const rzpResult = await razorpayService.createPaymentLink(tx, newRetryToken, baseUrl);
    const finalRetryLink = rzpResult.retryLink;

    const strategy = classifier.suggestRetryStrategy(tx);

    const insertAttempt = db.prepare(`
      INSERT INTO recovery_attempts (
        transaction_id, message_sent, channel, suggested_retry_time,
        outcome, created_at, retry_token, link_expires_at, link_status,
        razorpay_link_id, razorpay_short_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const attemptResult = insertAttempt.run(
      transaction_id,
      'Generating fresh AI message...',
      strategy.suggested_channel,
      strategy.suggested_retry_time,
      'pending',
      now.toISOString(),
      newRetryToken,
      expiryDate,
      'active',
      rzpResult.razorpay_link_id,
      rzpResult.razorpay_short_url
    );

    const attemptId = attemptResult.lastInsertRowid;

    // AI Message
    const aiResult = await aiAgent.generateRecoveryMessage(tx, strategy, finalRetryLink, expiryMinutes);
    const finalMessage = aiResult.message;

    db.prepare('UPDATE recovery_attempts SET message_sent = ? WHERE id = ?').run(finalMessage, attemptId);

    // Send notification
    await notifier.sendNotification({
      to: `${tx.customer_name.toLowerCase().replace(/\s+/g, '')}@example.com`,
      subject: `Resent: PayBack AI Payment Recovery Link for ₹${tx.amount}`,
      message: finalMessage,
      channel: strategy.suggested_channel
    });

    res.json({
      success: true,
      message: 'New recovery link generated and sent. Old active links invalidated.',
      new_token: newRetryToken,
      retry_link: finalRetryLink,
      expires_at: expiryDate
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/admin/expire — Force Expire Link
router.post('/admin/expire', (req, res) => {
  try {
    const { attempt_id } = req.body;
    if (!attempt_id) {
      return res.status(400).json({ success: false, error: 'attempt_id is required' });
    }

    const result = db.prepare(`
      UPDATE recovery_attempts 
      SET link_status = 'expired', outcome = 'expired' 
      WHERE id = ?
    `).run(attempt_id);

    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Recovery attempt not found' });
    }

    res.json({
      success: true,
      message: 'Link expired successfully'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
