/**
 * Task 8: Transactions API & Dynamic Statistics Engine
 */
const express = require('express');
const router = express.Router();
const db = require('../database/db');

// GET /api/transactions — List transactions with search, filter, and sorting
router.get('/transactions', (req, res) => {
  try {
    const { status, search, failure_reason, sort, limit = 250, offset = 0 } = req.query;

    let query = `
      SELECT t.*, 
        (SELECT COUNT(*) FROM recovery_attempts r WHERE r.transaction_id = t.id) as attempt_count,
        (SELECT link_status FROM recovery_attempts r WHERE r.transaction_id = t.id ORDER BY r.id DESC LIMIT 1) as latest_link_status,
        (SELECT retry_token FROM recovery_attempts r WHERE r.transaction_id = t.id ORDER BY r.id DESC LIMIT 1) as latest_retry_token
      FROM transactions t
      WHERE 1=1
    `;
    const params = [];

    if (status && status !== 'all') {
      query += ` AND t.status = ?`;
      params.push(status);
    }

    if (failure_reason && failure_reason !== 'all') {
      query += ` AND t.failure_reason = ?`;
      params.push(failure_reason);
    }

    if (search && search.trim() !== '') {
      query += ` AND (t.customer_name LIKE ? OR CAST(t.id AS TEXT) LIKE ?)`;
      const term = `%${search.trim()}%`;
      params.push(term, term);
    }

    // Sorting
    switch (sort) {
      case 'oldest':
        query += ` ORDER BY t.timestamp ASC`;
        break;
      case 'amount_desc':
        query += ` ORDER BY t.amount DESC`;
        break;
      case 'score_desc':
        query += ` ORDER BY t.recovery_score DESC NULLS LAST`;
        break;
      case 'newest':
      default:
        query += ` ORDER BY t.timestamp DESC`;
        break;
    }

    query += ` LIMIT ? OFFSET ?`;
    params.push(parseInt(limit, 10), parseInt(offset, 10));

    const transactions = db.prepare(query).all(...params);
    const totalCountStmt = db.prepare('SELECT COUNT(*) as total FROM transactions').get();

    res.json({
      success: true,
      count: transactions.length,
      total_in_db: totalCountStmt.total,
      data: transactions
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/stats — Dynamic Statistics Engine directly calculated from SQLite
router.get('/stats', (req, res) => {
  try {
    const totalStmt = db.prepare('SELECT COUNT(*) as total FROM transactions').get();
    const failedStmt = db.prepare("SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as amount FROM transactions WHERE status = 'failed'").get();
    const recoveredStmt = db.prepare("SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as amount FROM transactions WHERE status = 'recovered'").get();
    const pendingStmt = db.prepare("SELECT COUNT(*) as count FROM transactions WHERE status = 'pending'").get();

    const totalCount = totalStmt.total || 0;
    const recoveredCount = recoveredStmt.count || 0;
    const recoveryRate = totalCount > 0 ? ((recoveredCount / totalCount) * 100).toFixed(1) : '0.0';

    // Failure reason distribution
    const reasonsRows = db.prepare(`
      SELECT failure_reason, COUNT(*) as count, SUM(amount) as amount 
      FROM transactions 
      GROUP BY failure_reason 
      ORDER BY count DESC
    `).all();

    const failureReasonDistribution = {};
    reasonsRows.forEach(r => {
      failureReasonDistribution[r.failure_reason] = {
        count: r.count,
        amount: r.amount
      };
    });

    // Payment method distribution
    const methodsRows = db.prepare(`
      SELECT payment_method, COUNT(*) as count, SUM(amount) as amount 
      FROM transactions 
      GROUP BY payment_method 
      ORDER BY count DESC
    `).all();

    const paymentMethodDistribution = {};
    methodsRows.forEach(m => {
      paymentMethodDistribution[m.payment_method] = {
        count: m.count,
        amount: m.amount
      };
    });

    res.json({
      success: true,
      stats: {
        total_transactions: totalCount,
        total_failed: failedStmt.count,
        total_recovered: recoveredCount,
        total_pending: pendingStmt.count,
        recovery_rate: `${recoveryRate}%`,
        total_failed_amount: failedStmt.amount,
        total_recovered_amount: recoveredStmt.amount,
        failure_reason_distribution: failureReasonDistribution,
        payment_method_distribution: paymentMethodDistribution
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
