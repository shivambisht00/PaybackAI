/**
 * Task 6: Gemini AI Agent for Personalized Recovery Communications & Fallback Generator
 */
const { GoogleGenerativeAI } = require('@google/generative-ai');

function getFallbackMessage(transaction, channel, retryLink, expiryMinutes) {
  const amountStr = `₹${parseFloat(transaction.amount).toLocaleString('en-IN')}`;
  const name = transaction.customer_name;

  // temp for checking mail
  // if (channel === 'sms') {
  //   return `Hi ${name}, your payment of ${amountStr} for ${transaction.payment_method} failed due to ${transaction.failure_reason.replace('_', ' ')}. Retry securely in 1-click before link expires in ${expiryMinutes}m: ${retryLink}`;
  // }

  if (channel === 'email') {
    return `Dear ${name},\n\nWe noticed your recent payment of ${amountStr} via ${transaction.payment_method} could not be processed due to a temporary issue (${transaction.failure_reason.replace('_', ' ')}).\n\nTo ensure your access remains uninterrupted, please complete your payment using your secure recovery link below:\n\n👉 Complete Payment: ${retryLink}\n\nNote: This link will expire in ${expiryMinutes} minutes for security.\n\nWarm regards,\nCustomer Support Team`;
  }

  // Default WhatsApp fallback
  return `Hi ${name}! 👋 We noticed your payment of ${amountStr} via ${transaction.payment_method} was interrupted (${transaction.failure_reason.replace('_', ' ')}).\n\nNo worries! You can complete your transaction safely in 1 click using this link: ${retryLink}\n\n⏳ Link expires in ${expiryMinutes} minutes. Let us know if you need any help!`;
}

// async function generateRecoveryMessage(transaction, strategy, retryLink, expiryMinutes = 30) {
//   // ✨ Force channel to email for direct testing
//   const channel = 'email';

//   console.log('ℹ️ Bypassing Gemini API for direct Email test. Using pre-formatted recovery fallback message.');
//   return { message: getFallbackMessage(transaction, channel, retryLink, expiryMinutes) };
// }


// checking mail 
async function generateRecoveryMessage(transaction, strategy, retryLink, expiryMinutes = 30) {
  const apiKey = process.env.GEMINI_API_KEY;

  const channel = strategy.suggested_channel || 'whatsapp';
 
  if (!apiKey || apiKey.trim() === '' || apiKey.includes('your_gemini_api_key')) {
    console.log('ℹ️ Gemini API key not configured. Using pre-formatted recovery fallback message.');
    return { message: getFallbackMessage(transaction, channel, retryLink, expiryMinutes) };
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    const prompt = `You are PayBack AI, an intelligent revenue recovery agent for fintech and SaaS payments.
Write a personalized payment recovery notification message for a customer whose transaction failed.

CUSTOMER & TRANSACTION DETAILS:
- Customer Name: ${transaction.customer_name}
- Failed Amount: ₹${parseFloat(transaction.amount).toLocaleString('en-IN')}
- Payment Method: ${transaction.payment_method}
- Failure Reason: ${transaction.failure_reason.replace('_', ' ')}
- Target Communication Channel: ${channel}
- Secure 1-Click Retry Link: ${retryLink}
- Link Expiry Window: ${expiryMinutes} minutes

TONE GUIDELINES BY CHANNEL:
- If channel is 'sms': Very short, concise, direct, under 160 characters. Must contain link.
- If channel is 'whatsapp': Friendly, conversational, empathetic, uses 1-2 tasteful emojis. Must contain link.
- If channel is 'email': Slightly formal, professional, reassuring, clear call to action button/link.

CRITICAL CONSTRAINTS:
1. Do NOT include markdown code blocks (no \`\`\` text).
2. The message MUST naturally include the exact payment retry link: ${retryLink}
3. The message MUST state that the link expires in ${expiryMinutes} minutes.
4. Output ONLY the raw text message content to send to the customer. Do not add conversational prefixes like "Here is your message:".`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const generatedText = response.text().trim();

    if (generatedText && generatedText.length > 10) {
      return { message: generatedText };
    }

    return { message: getFallbackMessage(transaction, channel, retryLink, expiryMinutes) };
  } catch (err) {
    console.error('⚠️ Gemini API call failed or timed out:', err.message);
    return { message: getFallbackMessage(transaction, channel, retryLink, expiryMinutes) };
  }
}

function generateSuccessMessage(transaction) {
  const amountStr = `₹${parseFloat(transaction.amount).toLocaleString('en-IN')}`;
  return `Payment Received! 🎉 Dear ${transaction.customer_name}, your payment of ${amountStr} has been successfully recovered and processed. Thank you for your prompt response!`;
}

module.exports = {
  generateRecoveryMessage,
  generateSuccessMessage,
  getFallbackMessage
};
