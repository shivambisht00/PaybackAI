/**
 * Task 3, 4, 5: Transparent Rule-Based Recovery Scoring Engine & Strategy Generator
 */

function calculateRecoveryScore(transaction) {
  const { amount, failure_reason, timestamp } = transaction;

  // 1. Amount Factor (Weight: 0.25)
  const amountWeight = 0.25;
  let amountPoints = 50;
  let amountExplanation = '';

  if (amount <= 1000) {
    amountPoints = 95;
    amountExplanation = `Amount ₹${amount.toLocaleString('en-IN')} is small with minimal friction for immediate retry.`;
  } else if (amount <= 5000) {
    amountPoints = 80;
    amountExplanation = `Amount ₹${amount.toLocaleString('en-IN')} is moderate with high customer willingness to re-pay.`;
  } else if (amount <= 20000) {
    amountPoints = 65;
    amountExplanation = `Amount ₹${amount.toLocaleString('en-IN')} is substantial; customer may require a gentle reminder nudge.`;
  } else {
    amountPoints = 50;
    amountExplanation = `Amount ₹${amount.toLocaleString('en-IN')} is high value; critical for revenue recovery despite higher hesitation.`;
  }

  // 2. Failure Reason Factor (Weight: 0.45)
  const failureWeight = 0.45;
  let failurePoints = 50;
  let failureExplanation = '';

  switch (failure_reason) {
    case 'network_error':
      failurePoints = 95;
      failureExplanation = `Network connection timed out during checkout; extremely high recovery probability on immediate retry.`;
      break;
    case 'bank_server_down':
      failurePoints = 90;
      failureExplanation = `Issuing bank gateway was temporarily unavailable; high recovery probability once bank server recovers.`;
      break;
    case 'wrong_cvv':
      failurePoints = 80;
      failureExplanation = `Customer made a minor typo in card details; quick fix with high intent.`;
      break;
    case 'otp_failed':
      failurePoints = 75;
      failureExplanation = `SMS OTP expired or entered incorrectly; customer is active and ready to re-verify.`;
      break;
    case 'insufficient_funds':
      failurePoints = 70;
      failureExplanation = `Temporary balance constraint; recoverable if retried after salary/account credit window.`;
      break;
    case 'card_expired':
      failurePoints = 35;
      failureExplanation = `Card has expired; requires customer to update payment details via secure magic link.`;
      break;
    default:
      failurePoints = 60;
      failureExplanation = `Unspecified payment processing error; standard retry workflow recommended.`;
  }

  // 3. Recency Factor (Weight: 0.30)
  const recencyWeight = 0.30;
  let recencyPoints = 40;
  let recencyExplanation = '';

  const failureTime = new Date(timestamp).getTime();
  const now = Date.now();
  const hoursAgo = isNaN(failureTime) ? 1 : Math.max(0, (now - failureTime) / (1000 * 60 * 60));

  if (hoursAgo <= 2) {
    recencyPoints = 95;
    recencyExplanation = `Failed just ${hoursAgo < 1 ? 'minutes ago' : hoursAgo.toFixed(1) + ' hours ago'}; customer is actively at device.`;
  } else if (hoursAgo <= 24) {
    recencyPoints = 85;
    recencyExplanation = `Failed ${hoursAgo.toFixed(1)} hours ago; same-day follow-up catches active buyer interest.`;
  } else if (hoursAgo <= 168) { // 7 days
    const daysAgo = (hoursAgo / 24).toFixed(1);
    recencyPoints = 60;
    recencyExplanation = `Failed ${daysAgo} days ago; medium customer intent remaining.`;
  } else {
    const daysAgo = (hoursAgo / 24).toFixed(0);
    recencyPoints = 35;
    recencyExplanation = `Failed ${daysAgo} days ago; cold transaction requiring high-urgency recovery message.`;
  }

  // Exact Mathematical Calculation (Task 4)
  const rawScore = (amountPoints * amountWeight) + (failurePoints * failureWeight) + (recencyPoints * recencyWeight);
  const score = Math.min(100, Math.max(0, Math.round(rawScore)));

  const breakdown = [
    {
      factor: 'amount',
      weight: amountWeight,
      points: amountPoints,
      explanation: amountExplanation
    },
    {
      factor: 'failure_reason',
      weight: failureWeight,
      points: failurePoints,
      explanation: failureExplanation
    },
    {
      factor: 'recency',
      weight: recencyWeight,
      points: recencyPoints,
      explanation: recencyExplanation
    }
  ];

  return { score, breakdown };
}

function suggestRetryStrategy(transaction) {
  const { failure_reason, timestamp } = transaction;
  const failureTime = new Date(timestamp).getTime();
  const now = Date.now();

  let suggested_channel = 'whatsapp';
  let delayMinutes = 30;

  switch (failure_reason) {
    case 'network_error':
    case 'bank_server_down':
      suggested_channel = 'whatsapp';
      delayMinutes = 15; // Quick technical retry
      break;
    case 'otp_failed':
    case 'wrong_cvv':
      suggested_channel = 'sms';
      delayMinutes = 30; // Quick customer input fix
      break;
    case 'insufficient_funds':
      suggested_channel = 'whatsapp';
      delayMinutes = 240; // 4 hours later for fund transfer
      break;
    case 'card_expired':
      suggested_channel = 'email';
      delayMinutes = 60; // Clean email notification with magic link
      break;
    default:
      suggested_channel = 'whatsapp';
      delayMinutes = 45;
  }

  const retryTime = new Date(Math.max(now, failureTime) + delayMinutes * 60 * 1000);

  return {
    suggested_channel,
    suggested_retry_time: retryTime.toISOString()
  };
}

module.exports = {
  calculateRecoveryScore,
  suggestRetryStrategy
};
