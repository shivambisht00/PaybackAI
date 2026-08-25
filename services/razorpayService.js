/**
 * Task 13 & Section 25: Razorpay Test Mode Service & Internal Demo Fallback Handler
 */
const Razorpay = require('razorpay');
const crypto = require('crypto');

function getRazorpayInstance() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (keyId && keySecret && keyId.trim() !== '' && keySecret.trim() !== '') {
    return new Razorpay({
      key_id: keyId,
      key_secret: keySecret
    });
  }
  return null;
}

async function createPaymentLink(transaction, retryToken, baseUrl = 'http://localhost:3000') {
  const rzp = getRazorpayInstance();
  const internalRetryLink = `${baseUrl}/retry.html?token=${retryToken}`;

  if (!rzp) {
    console.log('ℹ️ Razorpay keys not configured. Falling back to internal PayBack AI retry link.');
    return {
      razorpay_link_id: null,
      razorpay_short_url: null,
      retryLink: internalRetryLink,
      isRazorpayActive: false
    };
  }

  try {
    // Amount in Razorpay is in paise (₹1 = 100 paise)
    const amountInPaise = Math.round(parseFloat(transaction.amount) * 100);

    const paymentLinkData = {
      amount: amountInPaise,
      currency: 'INR',
      accept_partial: false,
      description: `PayBack AI Payment Recovery for #${transaction.id} (${transaction.customer_name})`,
      customer: {
        name: transaction.customer_name,
        contact: '+919876543210',
        email: `${transaction.customer_name.toLowerCase().replace(/\s+/g, '')}@example.com`
      },
      notify: {
        sms: false,
        email: false
      },
      reminder_enable: true,
      notes: {
        transaction_id: transaction.id.toString(),
        retry_token: retryToken,
        payback_system: 'PayBack AI'
      },
      callback_url: `${baseUrl}/api/webhook/razorpay-redirect?token=${retryToken}`,
      callback_method: 'get'
    };

    const link = await rzp.paymentLink.create(paymentLinkData);

    console.log(`✅ Razorpay Test Payment Link Created! ID: ${link.id}, URL: ${link.short_url}`);

    return {
      razorpay_link_id: link.id,
      razorpay_short_url: link.short_url,
      retryLink: link.short_url || internalRetryLink,
      isRazorpayActive: true
    };
  } catch (err) {
    console.warn(`⚠️ Razorpay Link creation failed (${err.message}). Using internal retry link fallback.`);
    return {
      razorpay_link_id: null,
      razorpay_short_url: null,
      retryLink: internalRetryLink,
      isRazorpayActive: false
    };
  }
}

function verifyWebhookSignature(rawBody, signature, secret) {
  if (!secret) return false;
  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');
    return expectedSignature === signature;
  } catch (err) {
    return false;
  }
}

module.exports = {
  createPaymentLink,
  verifyWebhookSignature,
  getRazorpayInstance
};
