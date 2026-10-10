import { SITE_DATA } from './data.js';
import { t } from './i18n.js';

export function initNotifications() {
  window.toggleNotificationsDropdown = (event) => {
    if (event) event.stopPropagation();
    const dropdown = document.getElementById('notifications-dropdown');
    if (!dropdown) return;
    dropdown.classList.toggle('open');
    renderNotificationsList();
  };

  window.markAllNotificationsRead = () => {
    SITE_DATA.notifications.forEach(n => n.unread = false);
    updateNotificationBadge();
    renderNotificationsList();
  };

  // Close dropdown on outside click
  document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('notifications-dropdown');
    const bellBtn = document.getElementById('notification-bell-btn');
    if (dropdown && dropdown.classList.contains('open')) {
      if (!dropdown.contains(e.target) && !bellBtn.contains(e.target)) {
        dropdown.classList.remove('open');
      }
    }
  });

  window.updateNotificationBadge = updateNotificationBadge;
  updateNotificationBadge();
}

export function updateNotificationBadge() {
  const badge = document.getElementById('notification-badge');
  if (!badge) return;

  const isGuest = !window.IS_LOGGED_IN || window.CURRENT_USER_ROLE === 'Guest';
  if (isGuest) {
    badge.innerText = '';
    badge.style.display = 'none';
    return;
  }

  const count = SITE_DATA.notifications.filter(n => n.unread).length;
  if (count > 0) {
    badge.innerText = count;
    badge.style.display = 'flex';
  } else {
    badge.innerText = '';
    badge.style.display = 'none';
  }
}

function renderNotificationsList() {
  const container = document.getElementById('notifications-list-container');
  const markReadBtn = document.getElementById('mark-all-read-btn');
  if (!container) return;

  const isGuest = !window.IS_LOGGED_IN || window.CURRENT_USER_ROLE === 'Guest';
  if (isGuest) {
    if (markReadBtn) markReadBtn.style.display = 'none';
    container.innerHTML = `
      <div style="padding: 24px 16px; text-align: center;">
        <div style="font-size: 28px; margin-bottom: 8px;">🔔</div>
        <div style="font-weight: 700; font-size: 14px; color: var(--color-navy-deep); margin-bottom: 6px;">
          ${t('notif_guest_greeting')}
        </div>
        <p style="font-size: 12px; color: var(--color-text-muted); margin-bottom: 14px; line-height: 1.5;">
          ${t('notif_guest_msg')}
        </p>
        <button class="btn btn-gold btn-sm" onclick="openAuthModal('login'); toggleNotificationsDropdown();">
          ${t('btn_login')}
        </button>
      </div>
    `;
    return;
  }

  if (markReadBtn) markReadBtn.style.display = 'inline-block';
  if (SITE_DATA.notifications.length === 0) {
    container.innerHTML = `<div style="padding: 24px; text-align:center; font-size:12px; color:var(--color-text-muted);">${t('notif_empty')}</div>`;
    return;
  }

  container.innerHTML = SITE_DATA.notifications.map(n => `
    <div class="notif-item ${n.unread ? 'unread' : ''}" onclick="this.classList.remove('unread');">
      <div class="notif-icon-box">${n.icon}</div>
      <div>
        <div class="notif-text">${n.text}</div>
        <div class="notif-time">${n.time}</div>
      </div>
    </div>
  `).join('');
}
