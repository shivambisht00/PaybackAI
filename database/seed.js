const db = require('./db');

const FIRST_NAMES = [
  'Aarav', 'Ananya', 'Rajesh', 'Priya', 'Vikram', 'Neha', 'Suresh', 'Kavita',
  'Rohan', 'Sneha', 'Aditya', 'Meera', 'Rahul', 'Pooja', 'Amit', 'Sunita',
  'Deepak', 'Swati', 'Karan', 'Ritu', 'Arjun', 'Isha', 'Manish', 'Divya',
  'Siddharth', 'Bhavna', 'Gaurav', 'Nisha', 'Varun', 'Shweta', 'Alok', 'Tanya'
];

const LAST_NAMES = [
  'Sharma', 'Verma', 'Patel', 'Malhotra', 'Nair', 'Kumar', 'Singh', 'Gupta',
  'Joshi', 'Deshmukh', 'Mehta', 'Rao', 'Chowdhury', 'Reddy', 'Agarwal', 'Bhasin',
  'Kapoor', 'Chatterjee', 'Bhat', 'Pillai', 'Iyer', 'Saxena', 'Kulkarni', 'Thakur'
];

const PAYMENT_METHODS = ['UPI', 'Card', 'Netbanking', 'Wallet'];

const FAILURE_REASONS = [
  'insufficient_funds',
  'card_expired',
  'bank_server_down',
  'otp_failed',
  'wrong_cvv',
  'network_error'
];

function getRandomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomAmount() {
  // Realistic transaction amounts between 100 and 50000 INR
  const ranges = [
    { min: 100, max: 1500, weight: 0.4 },
    { min: 1500, max: 8000, weight: 0.4 },
    { min: 8000, max: 50000, weight: 0.2 }
  ];
  const rand = Math.random();
  let cumulative = 0;
  for (const r of ranges) {
    cumulative += r.weight;
    if (rand <= cumulative) {
      return parseFloat((Math.random() * (r.max - r.min) + r.min).toFixed(2));
    }
  }
  return 1250.00;
}

function getRandomTimestampWithinDays(days) {
  const now = Date.now();
  const pastMs = Math.random() * (days * 24 * 60 * 60 * 1000);
  return new Date(now - pastMs).toISOString();
}

function seedDatabase() {
  console.log('🌱 Starting database seed process...');

  // Clear existing transactions and recovery attempts cleanly
  db.exec('DELETE FROM recovery_attempts;');
  db.exec('DELETE FROM transactions;');
  db.exec("DELETE FROM sqlite_sequence WHERE name='transactions' OR name='recovery_attempts';");

  const insertStmt = db.prepare(`
    INSERT INTO transactions (customer_name, amount, payment_method, failure_reason, status, timestamp, recovery_score)
    VALUES (?, ?, ?, ?, 'failed', ?, NULL)
  `);

  const insertMany = db.transaction((count) => {
    for (let i = 0; i < count; i++) {
      const name = `${getRandomItem(FIRST_NAMES)} ${getRandomItem(LAST_NAMES)}`;
      const amount = getRandomAmount();
      const method = getRandomItem(PAYMENT_METHODS);
      const reason = getRandomItem(FAILURE_REASONS);
      const timestamp = getRandomTimestampWithinDays(30);

      insertStmt.run(name, amount, method, reason, timestamp);
    }
  });

  insertMany(250);

  const result = db.prepare('SELECT COUNT(*) as count FROM transactions').get();
  console.log(`✅ Database successfully seeded with ${result.count} realistic failed transactions!`);
}

if (require.main === module) {
  seedDatabase();
}

module.exports = seedDatabase;
