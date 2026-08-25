/**
 * PayBack AI — Customer Retry Portal Client Script
 */

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('portal-status-container');
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');

  let countdownInterval = null;

  if (!token) {
    renderError('Invalid Link', 'No security recovery token was provided in the URL.');
    return;
  }

  // 1. Validate Token & Status
  async function validateToken() {
    try {
      const res = await fetch(`/api/retry/validate/${token}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        renderError(data.status ? data.status.toUpperCase() : 'LINK UNAVAILABLE', data.message || 'This recovery link cannot be processed.');
        return;
      }

      // Valid Active Token: Render Checkout Card
      renderPaymentCard(data.transaction, data.attempt);
    } catch (err) {
      renderError('SYSTEM ERROR', 'Unable to connect to payment server. Please try again later.');
    }
  }

  // Render Error / Invalid State
  function renderError(title, message) {
    container.innerHTML = `
      <div style="text-align: center; padding: 20px 0;">
        <div style="width: 60px; height: 60px; border-radius: 50%; background: rgba(255, 51, 102, 0.15); border: 2px solid var(--red); color: var(--red); display: flex; align-items: center; justify-content: center; font-size: 1.8rem; margin: 0 auto 16px auto;">!</div>
        <h3 style="font-family: var(--font-display); font-size: 1.3rem; color: var(--red); margin-bottom: 8px;">${title}</h3>
        <p style="color: var(--text-muted); font-size: 0.92rem; line-height: 1.5; margin-bottom: 24px;">${message}</p>
        <a href="/" class="btn btn-outline" style="width: 100%; justify-content: center;">Return to Home</a>
      </div>
    `;
  }

  // Render Active Checkout Card
  function renderPaymentCard(tx, attempt) {
    const amountStr = `₹${parseFloat(tx.amount).toLocaleString('en-IN')}`;

    container.innerHTML = `
      <div class="timer-badge" id="retry-timer-badge">
        ⏳ Link expires in 30:00
      </div>

      <div style="background: var(--bg-card); padding: 20px; border-radius: 12px; margin-bottom: 24px; border: 1px solid var(--border);">
        <div class="payment-row">
          <span style="color: var(--text-muted);">Customer:</span>
          <strong>${tx.customer_name}</strong>
        </div>
        <div class="payment-row">
          <span style="color: var(--text-muted);">Amount Due:</span>
          <strong style="color: var(--cyan); font-size: 1.1rem;">${amountStr}</strong>
        </div>
        <div class="payment-row">
          <span style="color: var(--text-muted);">Payment Method:</span>
          <span>${tx.payment_method}</span>
        </div>
        <div class="payment-row" style="border: none;">
          <span style="color: var(--text-muted);">Previous Decline:</span>
          <code style="color: var(--gold);">${tx.failure_reason.replace(/_/g, ' ')}</code>
        </div>
      </div>

      <button class="btn btn-primary" id="btn-pay-now" style="width: 100%; padding: 14px; font-size: 1.05rem; justify-content: center;">
        Pay ${amountStr} Now (Demo Mode)
      </button>
      
      <p style="text-align: center; font-size: 0.78rem; color: var(--text-muted); margin-top: 16px;">
        🔒 Encrypted 256-bit SSL transaction via PayBack AI Gateway
      </p>
    `;

    // Start Expiry Timer
    startCountdown(attempt.expires_at);

    // Pay Now Click Handler
    document.getElementById('btn-pay-now').addEventListener('click', async () => {
      const btn = document.getElementById('btn-pay-now');
      btn.disabled = true;
      btn.textContent = 'Processing Payment...';

      try {
        const res = await fetch('/api/retry/pay', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        });
        const payData = await res.json();

        if (payData.success) {
          renderSuccess(tx, amountStr);
        } else {
          alert('Payment Failed: ' + payData.error);
          btn.disabled = false;
          btn.textContent = `Pay ${amountStr} Now (Demo Mode)`;
        }
      } catch (err) {
        alert('Network Error: Unable to complete payment.');
        btn.disabled = false;
        btn.textContent = `Pay ${amountStr} Now (Demo Mode)`;
      }
    });
  }

  // Render Success Screen
  function renderSuccess(tx, amountStr) {
    if (countdownInterval) clearInterval(countdownInterval);

    container.innerHTML = `
      <div style="text-align: center; padding: 20px 0;">
        <div style="width: 70px; height: 70px; border-radius: 50%; background: rgba(0, 230, 118, 0.15); border: 2px solid var(--green); color: var(--green); display: flex; align-items: center; justify-content: center; font-size: 2rem; margin: 0 auto 16px auto;">✓</div>
        <h3 style="font-family: var(--font-display); font-size: 1.5rem; color: var(--green); margin-bottom: 8px;">Payment Recovered!</h3>
        <p style="color: var(--text-muted); font-size: 0.95rem; margin-bottom: 24px;">Thank you, ${tx.customer_name}. Your payment of <strong>${amountStr}</strong> has been successfully processed.</p>

        <div style="background: var(--bg-card); padding: 16px; border-radius: 10px; text-align: left; font-size: 0.88rem; margin-bottom: 24px; border: 1px solid var(--border);">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span style="color: var(--text-muted);">Status:</span>
            <span style="color: var(--green); font-weight: bold;">RECOVERED</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span style="color: var(--text-muted);">Transaction ID:</span>
            <code>#${tx.id}</code>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--text-muted);">Timestamp:</span>
            <span>${new Date().toLocaleString('en-IN')}</span>
          </div>
        </div>

        <a href="/" class="btn btn-primary" style="width: 100%; justify-content: center;">Return to Main Dashboard</a>
      </div>
    `;
  }

  // Countdown Helper
  function startCountdown(expiryISO) {
    if (countdownInterval) clearInterval(countdownInterval);
    const badge = document.getElementById('retry-timer-badge');

    function update() {
      const remainingMs = new Date(expiryISO).getTime() - Date.now();
      if (remainingMs <= 0) {
        if (badge) badge.textContent = '⛔ Link Expired';
        clearInterval(countdownInterval);
        renderError('LINK EXPIRED', 'This payment recovery link has expired (30-minute window exceeded).');
        return;
      }
      const mins = Math.floor(remainingMs / 60000);
      const secs = Math.floor((remainingMs % 60000) / 1000);
      if (badge) badge.textContent = `⏳ Link expires in ${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }

    update();
    countdownInterval = setInterval(update, 1000);
  }

  validateToken();
});
