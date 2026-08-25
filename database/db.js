const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'transactions.db');
const db = new Database(dbPath);

// Enable foreign key support and WAL mode for high performance
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

// Initialize database schema based on DB Contract (Section 4)
db.exec(`
  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name TEXT NOT NULL,
    amount REAL NOT NULL,
    payment_method TEXT NOT NULL,
    failure_reason TEXT NOT NULL,
    status TEXT CHECK(status IN ('failed', 'pending', 'recovered')) NOT NULL DEFAULT 'failed',
    timestamp TEXT NOT NULL,
    recovery_score INTEGER NULLABLE
  );

  CREATE TABLE IF NOT EXISTS recovery_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id INTEGER NOT NULL,
    message_sent TEXT NOT NULL,
    channel TEXT CHECK(channel IN ('sms', 'whatsapp', 'email')) NOT NULL,
    suggested_retry_time TEXT,
    outcome TEXT CHECK(outcome IN ('pending', 'recovered', 'failed', 'expired')) NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL,
    retry_token TEXT UNIQUE NOT NULL,
    link_expires_at TEXT NOT NULL,
    link_status TEXT CHECK(link_status IN ('active', 'used', 'expired', 'invalidated')) NOT NULL DEFAULT 'active',
    razorpay_link_id TEXT NULLABLE,
    razorpay_short_url TEXT NULLABLE,
    FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
  );
`);

module.exports = db;
