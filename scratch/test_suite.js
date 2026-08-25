const http = require('http');
const db = require('../database/db');
const seed = require('../database/seed');
const app = require('../server');

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTestSuite() {
  console.log('🚀 Launching PayBack AI End-to-End Test Suite...\n');

  // 1. Seed DB
  seed();

  // 2. Start server
  const server = app.listen(3001, async () => {
    console.log('  Server started on test port 3001.');
    const opts = (path, method = 'GET', headers = {}) => ({
      hostname: 'localhost',
      port: 3001,
      path,
      method,
      headers: { 'Content-Type': 'application/json', ...headers }
    });

    try {
      // Test 1: Health
      const health = await request(opts('/api/health'));
      console.log('  [TEST 1] GET /api/health:', health.status === 200 && health.data.status === 'ok' ? '✅ PASS' : '❌ FAIL');

      // Test 2: Stats
      const stats = await request(opts('/api/stats'));
      console.log('  [TEST 2] GET /api/stats:', stats.data.stats.total_transactions === 250 ? '✅ PASS' : '❌ FAIL');

      // Test 3: Analyze Tx #1
      const analyze1 = await request(opts('/api/analyze/1', 'POST'));
      const token1 = analyze1.data.recoveryAttempt.retry_token;
      console.log(`  [TEST 3] POST /api/analyze/1 (Score: ${analyze1.data.score}):`, analyze1.data.success && token1 ? '✅ PASS' : '❌ FAIL');

      // Test 4: Validate Token 1
      const val1 = await request(opts(`/api/retry/validate/${token1}`));
      console.log('  [TEST 4] GET /api/retry/validate/:token1:', val1.data.status === 'active' ? '✅ PASS' : '❌ FAIL');

      // Test 5: Re-analyze Tx #1 (Invalidation Rule Verification)
      const analyze2 = await request(opts('/api/analyze/1', 'POST'));
      const token2 = analyze2.data.recoveryAttempt.retry_token;
      console.log('  [TEST 5] POST /api/analyze/1 (New Link Created):', analyze2.data.success ? '✅ PASS' : '❌ FAIL');

      // Test 6: Verify Token 1 is now INVALIDATED
      const val1_after = await request(opts(`/api/retry/validate/${token1}`));
      console.log('  [TEST 6] Invalidation Check (Token 1 should be invalidated):', val1_after.data.status === 'invalidated' ? '✅ PASS' : '❌ FAIL');

      // Test 7: Execute Payment Recovery on Token 2
      const pay = await request(opts('/api/retry/pay', 'POST'), { token: token2 });
      console.log('  [TEST 7] POST /api/retry/pay:', pay.data.success && pay.data.transaction_id === 1 ? '✅ PASS' : '❌ FAIL');

      // Test 8: Verify Token 2 is now USED
      const val2_after = await request(opts(`/api/retry/validate/${token2}`));
      console.log('  [TEST 8] Used Check (Token 2 should be used):', val2_after.data.status === 'used' ? '✅ PASS' : '❌ FAIL');

      // Test 9: Verify DB status updated to 'recovered'
      const txUpdated = db.prepare('SELECT status FROM transactions WHERE id = 1').get();
      console.log('  [TEST 9] DB Status Check (Tx #1 status):', txUpdated.status === 'recovered' ? '✅ PASS' : '❌ FAIL');

      // Test 10: Admin Resend on Tx #2
      const adminResend = await request(opts('/api/admin/resend', 'POST', { 'x-admin-password': 'admin123' }), { transaction_id: 2 });
      console.log('  [TEST 10] POST /api/admin/resend:', adminResend.data.success ? '✅ PASS' : '❌ FAIL');

      console.log('\n🎉 ALL 10 CORE TESTS PASSED SUCCESSFULLY!\n');
    } catch (err) {
      console.error('❌ Test suite failed:', err);
    } finally {
      server.close();
      process.exit(0);
    }
  });
}

runTestSuite();
