require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database/db');

// Import Route Handlers
const transactionsRouter = require('./routes/transactions');
const recoveryRouter = require('./routes/recovery');
const retryRouter = require('./routes/retry');
const adminRouter = require('./routes/admin');
const webhookRouter = require('./routes/webhook');

const app = express();
const PORT = process.env.PORT || 3000;

// Express Middleware
app.use(cors());
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString(); // Store raw body for webhook signature verification
  }
}));
app.use(express.urlencoded({ extended: true }));

// Serve static frontend assets from public/ directory
app.use(express.static(path.join(__dirname, 'public')));

// API Base Endpoints
app.use('/api', transactionsRouter);
app.use('/api', recoveryRouter);
app.use('/api', retryRouter);
app.use('/api', adminRouter);
app.use('/api', webhookRouter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'PayBack AI — Intelligent Revenue Recovery Agent',
    timestamp: new Date().toISOString()
  });
});

// Explicit Route Fallbacks for Frontend Pages
app.get('/retry', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'retry.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Application Error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal Server Error',
    message: err.message
  });
});

// Start Server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`⚡ PayBack AI Server running at http://localhost:${PORT}`);
    console.log(`📊 Main Dashboard:  http://localhost:${PORT}`);
    console.log(`🔐 Admin Portal:   http://localhost:${PORT}/admin.html`);
    console.log(`======================================================\n`);
  });
}

module.exports = app;
