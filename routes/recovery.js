/**
 * Task 9 & Section 15: Core Recovery Workflow API
 */
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../database/db');
const classifier = require('../services/classifier');
const aiAgent = require('../services/aiAgent');
const notifier = require('../services/notifier');
const razorpayService = require('../services/razorpayService');

// POST /api/analyze/:id — Core Recovery Workflow
router.post('/analyze/:id', async (req, res) => {
  try {
    const transactionId = parseInt(req.params.id, 10);

    if (isNaN(transactionId)) {
      return res.status(400).json({ success: false, error: 'Invalid transaction ID' });
    }

    // 1. Fetch transaction
    const transaction = db.prepare('SELECT * FROM transactions WHERE id = ?').get(transactionId);
    if (!transaction) {
      return res.status(404).json({ success: false, error: 'Transaction not found' });
    }

    // 2. Calculate Recovery Score & Breakdown
    const { score, breakdown } = classifier.calculateRecoveryScore(transaction);

    // 3. Save recovery score in database
    db.prepare('UPDATE transactions SET recovery_score = ? WHERE id = ?').run(score, transactionId);
    transaction.recovery_score = score;

    // 4. Generate Retry Strategy
    const strategy = classifier.suggestRetryStrategy(transaction);

    // 5. Invalidation Rule: set all existing 'active' links for this transaction to 'invalidated'
    db.prepare(`
      UPDATE recovery_attempts 
      SET link_status = 'invalidated' 
      WHERE transaction_id = ? AND link_status = 'active'
    `).run(transactionId);

    // 6. Generate Secure Cryptographic Retry Token (Node crypto)
    const retryToken = crypto.randomBytes(16).toString('hex');

    // 7. Calculate Expiry Time (default 30 mins or process.env.LINK_EXPIRY_MINUTES)
    const expiryMinutes = parseInt(process.env.LINK_EXPIRY_MINUTES || '30', 10);
    const now = new Date();
    const expiryDate = new Date(now.getTime() + expiryMinutes * 60 * 1000).toISOString();

    // 8. Create Razorpay Payment Link or Internal Fallback Link
    const host = req.get('host') || 'localhost:3000';
    const protocol = req.protocol || 'http';
    const baseUrl = `${protocol}://${host}`;

    const rzpResult = await razorpayService.createPaymentLink(transaction, retryToken, baseUrl);
    const finalRetryLink = rzpResult.retryLink;

    // 9. Create Recovery Attempt Record in SQLite
    const insertAttempt = db.prepare(`
      INSERT INTO recovery_attempts (
        transaction_id, message_sent, channel, suggested_retry_time,
        outcome, created_at, retry_token, link_expires_at, link_status,
        razorpay_link_id, razorpay_short_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const tempMessage = 'Generating AI Recovery Communication...';
    const attemptResult = insertAttempt.run(
      transactionId,
      tempMessage,
      strategy.suggested_channel,
      strategy.suggested_retry_time,
      'pending',
      now.toISOString(),
      retryToken,
      expiryDate,
      'active',
      rzpResult.razorpay_link_id,
      rzpResult.razorpay_short_url
    );

    const attemptId = attemptResult.lastInsertRowid;

    // 10. Call Gemini AI Agent for Personalized Recovery Message
    const aiResult = await aiAgent.generateRecoveryMessage(
      transaction,
      strategy,
      finalRetryLink,
      expiryMinutes
    );
    const finalMessage = aiResult.message;

    // 11. Update Message in DB
    db.prepare('UPDATE recovery_attempts SET message_sent = ? WHERE id = ?').run(finalMessage, attemptId);

    // 12. Smart Notification Dispatcher (Real Email + Override Support)
    const testOverrideEmail = process.env.TEST_OVERRIDE_EMAIL || '8171659929sb@gmail.com'; 
    const useOverride = process.env.USE_TEST_OVERRIDE === 'true'; 

    // Target recipient logic: Agar override true hai to test mail, warna DB mail ya fallback
    const recipientContact = useOverride 
      ? testOverrideEmail 
      : (transaction.customer_email || testOverrideEmail);

    await notifier.sendNotification({
      to: recipientContact,
      subject: `Action Required: PayBack AI Payment Recovery for ₹${transaction.amount}`,
      message: finalMessage,
      channel: strategy.suggested_channel
    });

    // 13. Fetch Updated Attempt
    const updatedAttempt = db.prepare('SELECT * FROM recovery_attempts WHERE id = ?').get(attemptId);

    // Return complete recovery payload
    res.json({
      success: true,
      transaction,
      score,
      breakdown,
      strategy,
      retryLink: finalRetryLink,
      expiry: expiryDate,
      message: finalMessage,
      recoveryAttempt: updatedAttempt
    });
  } catch (err) {
    console.error('Error in /api/analyze/:id:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;