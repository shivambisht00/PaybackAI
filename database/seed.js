const db = require('./db');

const FIRST_NAMES = [
  'Shivam','Aarav', 'Ananya', 'Rajesh', 'Priya', 'Vikram', 'Neha', 'Suresh', 'Kavita',
  'Rohan', 'Sneha', 'Aditya', 'Meera', 'Rahul', 'Pooja', 'Amit', 'Sunita',
  'Deepak', 'Swati', 'Karan', 'Ritu', 'Arjun', 'Isha', 'Manish', 'Divya',
  'Siddharth', 'Bhavna', 'Gaurav', 'Nisha', 'Varun', 'Shweta', 'Alok', 'Tanya'
];

const LAST_NAMES = [
  'Bisht','Sharma', 'Verma', 'Patel', 'Malhotra', 'Nair', 'Kumar', 'Singh', 'Gupta',
  'Joshi', 'Deshmukh', 'Mehta', 'Rao', 'Chowdhury', 'Reddy', 'Agarwal', 'Bhasin',
  'Kapoor', 'Chatterjee', 'Bhat', 'Pillai', 'Iyer', 'Saxena', 'Kulkarni', 'Thakur'
];

// ✨ Predefined Emails Array (Aap yahan apni marzi ki jitni chahein real/testing emails daal sakte hain)
const EMAILS = [
  '8171659929sb@gmail.com',
  'fakeuseonly201@gmail.com',
  'aarav.sharma99@gmail.com',
  'ananya.verma21@gmail.com',
  'rajesh.patel.official@gmail.com',
  'priya.nair.work@gmail.com',
  'vikram.singh.tech@gmail.com',
  'neha.gupta.mail@gmail.com',
  'suresh.joshi.biz@gmail.com',
  'kavita.mehta.123@gmail.com',
  'rohan.deshmukh.dev@gmail.com'
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
    INSERT INTO transactions (customer_name, customer_email, customer_phone, amount, payment_method, failure_reason, status, timestamp, recovery_score)
    VALUES (?, ?, ?, ?, ?, ?, 'failed', ?, NULL)
  `);

  const insertMany = db.transaction((count) => {
    for(let i = 1; i <= count; i++) {
      let firstName, lastName, name, email, phone;

      // ✨ SPECIAL CASE: Pehli transaction par aapki asli details aayengi
      if(i === 1){
        firstName = 'Shivam';
        lastName = 'Bisht';
        name = 'Shivam Bisht';
        email = '8171659929sb@gmail.com'; 
        phone = '8171659929';                    
      } else{
        firstName = getRandomItem(FIRST_NAMES);
        lastName = getRandomItem(LAST_NAMES);
        name = `${firstName} ${lastName}`;
        
        // ✨ Predefined EMAILS array se cyclic order mein mail uthegi
        email = EMAILS[(i - 1) % EMAILS.length];
        
        const prefix = getRandomItem(['9', '8', '7']);
        phone = prefix + Math.floor(100000000 + Math.random() * 900000000).toString();
      }

      const amount = getRandomAmount();
      const method = getRandomItem(PAYMENT_METHODS);
      const reason = getRandomItem(FAILURE_REASONS);
      const timestamp = getRandomTimestampWithinDays(30);

      insertStmt.run(name, email, phone, amount, method, reason, timestamp);
    }
  });

  insertMany(250);

  const result = db.prepare('SELECT COUNT(*) as count FROM transactions').get();
  console.log(`✅ Database successfully seeded with ${result.count} realistic failed transactions using predefined emails!`);
}

if (require.main === module) {
  seedDatabase();
}

module.exports = seedDatabase;