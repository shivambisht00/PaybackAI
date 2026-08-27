/**
 * PayBack AI — Customer Retry Portal Client Script (Real Razorpay Integration)
 */

document.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('portal-status-container');
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');
  const successUrl = `/success.html?token=${encodeURIComponent(token || '')}`;

  let countdownInterval = null;

  if (!token) {
    renderError('Invalid Link', 'No security recovery token was provided in the URL.');
    return;
  }

  // 1. Dynamically load Razorpay SDK
  const script = document.createElement('script');
  script.src = 'https://checkout.razorpay.com/v1/checkout.js';
  document.body.appendChild(script);


// 2. Validate Token & Status
  async function validateToken() {
    try {
      // ✨ Sabse pehle backend se status check karo
      const statusRes = await fetch(`/api/retry/status/${token}`);
      const statusData = await statusRes.json();

      if (statusData.recovered) {
        // Agar payment pehle hi recover ho chuki hai, toh seedha receipt page par jao.
        window.location.replace(successUrl);
        return;
      }

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

      <button class="btn btn-primary" id="btn-pay-now" style="width: 100%; padding: 14px; font-size: 1.05rem; justify-content: center; background: #3399cc; border-color: #3399cc;">
        Pay ${amountStr} Now ⚡
      </button>
      
      <p style="text-align: center; font-size: 0.78rem; color: var(--text-muted); margin-top: 16px;">
        🔒 Encrypted 256-bit SSL transaction via PayBack AI Gateway
      </p>
    `;

    startCountdown(attempt.expires_at);

    // REAL RAZORPAY PAY NOW CLICK HANDLER
    document.getElementById('btn-pay-now').addEventListener('click', async () => {
      const btn = document.getElementById('btn-pay-now');
      btn.disabled = true;
      btn.textContent = 'Initiating Secure Payment...';

      try {
        // 1. Backend se asli Razorpay Order ID mangwao
        const res = await fetch('/api/retry/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        });
        const orderData = await res.json();

        if (!orderData.success) {
          alert('Failed to initiate payment: ' + (orderData.error || 'Server error'));
          btn.disabled = false;
          btn.textContent = `Pay ${amountStr} Now ⚡`;
          return;
        }

        // 2. Razorpay Popup open karo
        const options = {
          key: orderData.key, 
          amount: orderData.order.amount,
          currency: orderData.order.currency,
          name: 'PayBack AI',
          description: 'Payment Recovery',
          order_id: orderData.order.id,
          prefill: {
            name: tx.customer_name,
            email: tx.customer_email || 'customer@example.com',
            contact: tx.customer_phone || '9999999999'
          },
          theme: {
            color: '#3399cc'
          },

          
          handler: async function (response) {
            // 3. Payment Success hone par Backend verify karega
            btn.textContent = 'Verifying Payment...';
            await verifyPayment(response, tx, amountStr);
          },
          modal: {
            ondismiss: function() {
              btn.disabled = false;
              btn.textContent = `Pay ${amountStr} Now ⚡`;
            }
          }
        };

        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', function (response){
           alert("Payment Failed. Reason: " + response.error.description);
           btn.disabled = false;
           btn.textContent = `Pay ${amountStr} Now ⚡`;
        });
        rzp.open();

      } catch (err) {
        alert('Network Error: Unable to initiate payment.');
        btn.disabled = false;
        btn.textContent = `Pay ${amountStr} Now ⚡`;
      }
    });
  }

  // Verify Real Payment
  async function verifyPayment(paymentResponse, tx, amountStr) {
    try {
      const res = await fetch('/api/retry/verify-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          razorpay_payment_id: paymentResponse.razorpay_payment_id,
          razorpay_order_id: paymentResponse.razorpay_order_id,
          razorpay_signature: paymentResponse.razorpay_signature
        })
      });
      const data = await res.json();
      
      if (data.success) {
        window.location.assign(successUrl);
      } else {
        alert("Payment verification failed: " + (data.error || 'Invalid signature'));
        document.getElementById('btn-pay-now').disabled = false;
        document.getElementById('btn-pay-now').textContent = `Pay ${amountStr} Now ⚡`;
      }
    } catch(e) {
      alert("Error verifying payment.");
      const btn = document.getElementById('btn-pay-now');
      if (btn) {
        btn.disabled = false;
        btn.textContent = `Pay ${amountStr} Now ⚡`;
      }
    }
  }

// Render Success Screen (Wahi same retry page par success state dikhayega!)
  function renderSuccess(tx, amountStr) {
    if (countdownInterval) clearInterval(countdownInterval);
    // Mark this token as paid in localStorage
    localStorage.setItem(`paid_${token}`, 'true');

    container.innerHTML = `
      <div style="text-align: center; padding: 20px 0;">
        <div style="width: 70px; height: 70px; border-radius: 50%; background: rgba(0, 230, 118, 0.15); border: 2px solid var(--green); color: var(--green); display: flex; align-items: center; justify-content: center; font-size: 2rem; margin: 0 auto 16px auto;">✓</div>
        <h3 style="font-family: var(--font-display); font-size: 1.5rem; color: var(--green); margin-bottom: 8px;">Payment Successful!</h3>
        <p style="color: var(--text-muted); font-size: 0.95rem; margin-bottom: 24px;">Thank you, ${tx.customer_name}. Your payment of <strong>${amountStr}</strong> has been successfully processed and your service is restored.</p>
        
        <div style="background: var(--bg-card); padding: 16px; border-radius: 8px; border: 1px solid var(--border); margin-bottom: 20px; font-size: 0.88rem; color: var(--text-muted);">
          Transaction ID: <code style="color: var(--cyan);">TXN-${String(tx.id || '').padStart(6, '0')}</code>
        </div>

        <a href="${successUrl}" class="btn btn-outline" style="width: 100%; justify-content: center;">
          View Receipt Status 📄
        </a>
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
        renderError('LINK EXPIRED', 'This payment recovery link has expired.');
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
