/**
 * PayBack AI — Admin Management Portal Script
 */

document.addEventListener('DOMContentLoaded', () => {
  const authOverlay = document.getElementById('admin-auth-overlay');
  const authForm = document.getElementById('admin-auth-form');
  const passInput = document.getElementById('admin-pass-input');
  const authErrorMsg = document.getElementById('auth-error-msg');

  const activeCount = document.getElementById('admin-active-count');
  const invalidatedCount = document.getElementById('admin-invalidated-count');
  const totalAttempts = document.getElementById('admin-total-attempts');
  const tableBody = document.getElementById('admin-table-body');
  const btnRefresh = document.getElementById('btn-refresh-admin');

  let adminPassword = localStorage.getItem('payback_admin_pass') || '';

  // Auth Form Submit
  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pass = passInput.value.trim();
    authErrorMsg.style.display = 'none';

    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pass })
      });
      const data = await res.json();

      if (data.success) {
        adminPassword = pass;
        localStorage.setItem('payback_admin_pass', pass);
        authOverlay.style.display = 'none';
        loadAdminOverview();
      } else {
        authErrorMsg.textContent = data.error || 'Incorrect password';
        authErrorMsg.style.display = 'block';
      }
    } catch (err) {
      authErrorMsg.textContent = 'Server error checking password';
      authErrorMsg.style.display = 'block';
    }
  });

  // Try auto-authenticating if password saved
  if (adminPassword) {
    fetch('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: adminPassword })
    }).then(r => r.json()).then(data => {
      if (data.success) {
        authOverlay.style.display = 'none';
        loadAdminOverview();
      }
    });
  }

  // Load Admin Overview Data
  async function loadAdminOverview() {
    try {
      const res = await fetch('/api/admin/overview', {
        headers: { 'x-admin-password': adminPassword }
      });
      const json = await res.json();

      if (!json.success) {
        if (res.status === 401) {
          authOverlay.style.display = 'flex';
          localStorage.removeItem('payback_admin_pass');
        }
        return;
      }

      const d = json.data;
      activeCount.textContent = d.active_links_count;
      invalidatedCount.textContent = d.invalidated_links_count;
      totalAttempts.textContent = d.attempts.length;

      if (d.attempts.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--text-muted); padding: 32px;">No recovery attempts recorded yet. Click "Analyze" on any transaction in the main dashboard.</td></tr>`;
        return;
      }

      tableBody.innerHTML = d.attempts.map(att => {
        let statusBadgeClass = 'status-pending';
        if (att.link_status === 'active') statusBadgeClass = 'status-pending';
        if (att.link_status === 'used') statusBadgeClass = 'status-recovered';
        if (att.link_status === 'invalidated' || att.link_status === 'expired') statusBadgeClass = 'status-failed';

        const isActionable = att.link_status === 'active';

        return `
          <tr>
            <td><code style="font-family: var(--font-mono);">#${att.id}</code></td>
            <td><code>#${att.transaction_id}</code></td>
            <td><strong>${att.customer_name}</strong></td>
            <td><span class="tag" style="text-transform: uppercase;">${att.channel}</span></td>
            <td><code style="font-family: var(--font-mono); font-size: 0.78rem;">${att.retry_token.substring(0, 10)}...</code></td>
            <td><span class="status-badge ${statusBadgeClass}">${att.link_status}</span></td>
            <td><code>${att.outcome}</code></td>
            <td style="font-size: 0.8rem; color: var(--text-muted);">${new Date(att.link_expires_at).toLocaleTimeString('en-IN')}</td>
            <td>
              <div style="display: flex; gap: 8px;">
                <button class="btn btn-primary" style="padding: 4px 10px; font-size: 0.75rem;" onclick="resendLink(${att.transaction_id})">
                  Resend Link
                </button>
                ${isActionable ? `
                  <button class="btn btn-outline" style="padding: 4px 10px; font-size: 0.75rem; border-color: var(--red); color: var(--red);" onclick="expireLink(${att.id})">
                    Expire
                  </button>
                ` : ''}
              </div>
            </td>
          </tr>
        `;
      }).join('');

    } catch (err) {
      console.error('Failed to load admin overview:', err);
    }
  }

  // Action: Resend Link
  window.resendLink = async function(txId) {
    if (!confirm(`Resend recovery link for Transaction #${txId}? The existing active link will be immediately INVALIDATED.`)) return;

    try {
      const res = await fetch('/api/admin/resend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': adminPassword
        },
        body: JSON.stringify({ transaction_id: txId })
      });
      const data = await res.json();

      if (data.success) {
        alert(`New Recovery Link Generated!\nOld link invalidated.\nNew Link: ${data.retry_link}`);
        loadAdminOverview();
      } else {
        alert('Resend Failed: ' + data.error);
      }
    } catch (err) {
      alert('Error calling admin resend API');
    }
  };

  // Action: Force Expire Link
  window.expireLink = async function(attemptId) {
    if (!confirm(`Force expire recovery link attempt #${attemptId}?`)) return;

    try {
      const res = await fetch('/api/admin/expire', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': adminPassword
        },
        body: JSON.stringify({ attempt_id: attemptId })
      });
      const data = await res.json();

      if (data.success) {
        loadAdminOverview();
      } else {
        alert('Expire Failed: ' + data.error);
      }
    } catch (err) {
      alert('Error calling admin expire API');
    }
  };

  btnRefresh.addEventListener('click', loadAdminOverview);
});
