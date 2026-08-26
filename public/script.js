/**
 * PayBack AI — Main Dashboard Client Script
 */

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const searchInput = document.getElementById('search-input');
  const statusFilter = document.getElementById('status-filter');
  const reasonFilter = document.getElementById('reason-filter');
  const sortFilter = document.getElementById('sort-filter');
  const tableBody = document.getElementById('transaction-table-body');

  const kpiFailedCount = document.getElementById('kpi-failed-count');
  const kpiFailedAmount = document.getElementById('kpi-failed-amount');
  const kpiRecoveredCount = document.getElementById('kpi-recovered-count');
  const kpiRecoveredAmount = document.getElementById('kpi-recovered-amount');
  const kpiRecoveryRate = document.getElementById('kpi-recovery-rate');
  const kpiTotalTx = document.getElementById('kpi-total-tx');
  const reasonsContainer = document.getElementById('reasons-distribution-container');

  // Modal Elements
  const modal = document.getElementById('analyze-modal');
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const modalCustomerName = document.getElementById('modal-customer-name');
  const modalTxId = document.getElementById('modal-tx-id');
  const modalScoreCircle = document.getElementById('modal-score-circle');
  const modalScoreSummary = document.getElementById('modal-score-summary');
  const modalBreakdownContainer = document.getElementById('modal-breakdown-container');
  const modalStrategyChannel = document.getElementById('modal-strategy-channel');
  const modalStrategyTime = document.getElementById('modal-strategy-time');
  const modalMessagePreview = document.getElementById('modal-message-preview');
  const modalRetryLinkInput = document.getElementById('modal-retry-link-input');
  const modalExpiryTimer = document.getElementById('modal-expiry-timer');
  const btnCopyLink = document.getElementById('btn-copy-link');
  const btnOpenRetry = document.getElementById('btn-open-retry');

  let countdownInterval = null;

  // 1. Fetch & Render Stats
  async function loadStats() {
    try {
      const res = await fetch('/api/stats');
      const json = await res.json();
      if (!json.success) return;

      const s = json.stats;
      kpiFailedCount.textContent = s.total_failed;
      kpiFailedAmount.textContent = `₹${parseFloat(s.total_failed_amount).toLocaleString('en-IN')} Lost`;
      kpiRecoveredCount.textContent = s.total_recovered;
      kpiRecoveredAmount.textContent = `₹${parseFloat(s.total_recovered_amount).toLocaleString('en-IN')} Recovered`;
      kpiRecoveryRate.textContent = s.recovery_rate;
      kpiTotalTx.textContent = s.total_transactions;

      // Render Failure Reason Distribution Bars
      const dist = s.failure_reason_distribution;
      const maxCount = Math.max(...Object.values(dist).map(d => d.count), 1);

      reasonsContainer.innerHTML = Object.entries(dist).map(([reason, data]) => {
        const pct = ((data.count / maxCount) * 100).toFixed(0);
        const formattedReason = reason.replace(/_/g, ' ').toUpperCase();
        return `
          <div class="reason-row">
            <span style="font-weight: 500;">${formattedReason}</span>
            <div class="bar-track">
              <div class="bar-fill" style="width: ${pct}%;"></div>
            </div>
            <span style="font-family: var(--font-mono); text-align: right; font-size: 0.85rem;">
              ${data.count} txs (₹${parseFloat(data.amount).toLocaleString('en-IN')})
            </span>
          </div>
        `;
      }).join('');
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  }

  // Helper: Format Age / Timestamp
  function formatAge(timestampISO) {
    const hours = (Date.now() - new Date(timestampISO).getTime()) / (1000 * 60 * 60);
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours.toFixed(0)}h ago`;
    const days = (hours / 24).toFixed(0);
    return `${days}d ago`;
  }

  // Helper: Get Score Chip CSS Class
  function getScoreClass(score) {
    if (score === null || score === undefined) return '';
    if (score >= 80) return 'score-high';
    if (score >= 60) return 'score-med';
    return 'score-low';
  }

  // 2. Fetch & Render Transactions Table
  async function loadTransactions() {
    const status = statusFilter.value;
    const reason = reasonFilter.value;
    const sort = sortFilter.value;
    const search = searchInput.value;

    const query = new URLSearchParams({ status, failure_reason: reason, sort, search }).toString();

    try {
      const res = await fetch(`/api/transactions?${query}`);
      const json = await res.json();
      if (!json.success) return;

      if (json.data.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--text-muted); padding: 32px;">No matching transactions found.</td></tr>`;
        return;
      }

      tableBody.innerHTML = json.data.map(tx => {
        const scoreDisplay = tx.recovery_score !== null 
          ? `<span class="score-chip ${getScoreClass(tx.recovery_score)}">${tx.recovery_score}</span>`
          : `<span style="color: var(--text-muted); font-size: 0.8rem;">--</span>`;

        const statusClass = `status-${tx.status}`;

        return `
          <tr>
            <td><code style="font-family: var(--font-mono); color: var(--cyan);">#${tx.id}</code></td>
            <td><strong>${tx.customer_name}</strong></td>
            <td>₹${parseFloat(tx.amount).toLocaleString('en-IN')}</td>
            <td>${tx.payment_method}</td>
            <td><code>${tx.failure_reason.replace(/_/g, ' ')}</code></td>
            <td style="color: var(--text-muted); font-size: 0.85rem;">${formatAge(tx.timestamp)}</td>
            <td>${scoreDisplay}</td>
            <td><span class="status-badge ${statusClass}">${tx.status}</span></td>
            <td>
              <button class="btn btn-primary" style="padding: 6px 14px; font-size: 0.8rem;" onclick="analyzeTransaction(${tx.id})">
                Analyze
              </button>
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      console.error('Failed to load transactions:', err);
      tableBody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--red); padding: 32px;">Failed to load transactions.</td></tr>`;
    }
  }

  // 3. Core Analyze Function & Modal Launcher
  window.analyzeTransaction = async function(id) {
    modal.classList.add('active');
    modalCustomerName.textContent = 'Analyzing...';
    modalTxId.textContent = `Transaction #${id}`;
    modalScoreCircle.textContent = '...';
    modalScoreSummary.textContent = 'Calculating transparent recovery score, strategy, and AI message...';
    modalBreakdownContainer.innerHTML = '<div style="color: var(--text-muted);">Running recovery classifier...</div>';
    modalMessagePreview.textContent = 'Generating personalized AI recovery message via Gemini...';

    try {
      const res = await fetch(`/api/analyze/${id}`, { method: 'POST' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      // Render Modal Content
      modalCustomerName.textContent = data.transaction.customer_name;
      modalTxId.textContent = `Transaction #${data.transaction.id} • ₹${parseFloat(data.transaction.amount).toLocaleString('en-IN')} (${data.transaction.payment_method})`;
      
      modalScoreCircle.textContent = data.score;
      modalScoreSummary.textContent = `Score of ${data.score}/100 calculated using amount, failure reason (${data.transaction.failure_reason}), and transaction recency.`;

      // Render Breakdown Bars
      modalBreakdownContainer.innerHTML = data.breakdown.map(b => {
        const factorName = b.factor.replace('_', ' ').toUpperCase();
        return `
          <div class="breakdown-item">
            <div class="breakdown-header">
              <span>${factorName} (${(b.weight * 100).toFixed(0)}% weight)</span>
              <span style="color: var(--cyan); font-family: var(--font-mono);">${b.points} pts</span>
            </div>
            <div class="bar-track" style="margin-bottom: 6px;">
              <div class="bar-fill" style="width: ${b.points}%;"></div>
            </div>
            <div class="breakdown-explanation">${b.explanation}</div>
          </div>
        `;
      }).join('');

      // Strategy
      modalStrategyChannel.textContent = data.strategy.suggested_channel;
      modalStrategyTime.textContent = new Date(data.strategy.suggested_retry_time).toLocaleString('en-IN');

      // AI Message & Link
      modalMessagePreview.textContent = data.message;
      modalRetryLinkInput.value = data.retryLink;
      btnOpenRetry.href = data.retryLink;

      // Start Countdown Timer
      startCountdown(data.expiry);

      // Reload Dashboard background stats
      loadStats();
      loadTransactions();

    } catch (err) {
      modalCustomerName.textContent = 'Analysis Failed';
      modalScoreSummary.textContent = err.message;
    }
  };

  // Helper: Live Countdown Timer
  function startCountdown(expiryISO) {
    if (countdownInterval) clearInterval(countdownInterval);

    function updateTimer() {
      const remainingMs = new Date(expiryISO).getTime() - Date.now();
      if (remainingMs <= 0) {
        modalExpiryTimer.textContent = 'EXPIRED';
        modalExpiryTimer.style.color = 'var(--red)';
        clearInterval(countdownInterval);
        return;
      }
      const mins = Math.floor(remainingMs / 60000);
      const secs = Math.floor((remainingMs % 60000) / 1000);
      modalExpiryTimer.textContent = `Expires in ${mins}:${secs < 10 ? '0' : ''}${secs}`;
      modalExpiryTimer.style.color = 'var(--gold)';
    }

    updateTimer();
    countdownInterval = setInterval(updateTimer, 1000);
  }

  // Copy Link Handler
  btnCopyLink.addEventListener('click', () => {
    modalRetryLinkInput.select();
    navigator.clipboard.writeText(modalRetryLinkInput.value);
    btnCopyLink.textContent = 'Copied! ✓';
    setTimeout(() => { btnCopyLink.textContent = 'Copy Retry Link'; }, 2000);
  });

  // Modal Close
  modalCloseBtn.addEventListener('click', () => {
    modal.classList.remove('active');
    if (countdownInterval) clearInterval(countdownInterval);
  });
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('active');
      if (countdownInterval) clearInterval(countdownInterval);
    }
  });

  // Event Listeners for Filters
  searchInput.addEventListener('input', loadTransactions);
  statusFilter.addEventListener('change', loadTransactions);
  reasonFilter.addEventListener('change', loadTransactions);
  sortFilter.addEventListener('change', loadTransactions);

  // Initial Load
  loadStats();
  loadTransactions();
});
