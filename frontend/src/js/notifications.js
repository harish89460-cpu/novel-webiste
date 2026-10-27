// Rudhra Prarthana Novels — Real-Time Notification System & Native Chrome Integration
// In-Website Notifications + Real-Time SSE + Respects Browser's Existing Notification Permission State

import { t } from './i18n.js';
import {
  getNotifications,
  getUnreadNotificationsCount,
  markNotificationRead,
  markAllNotificationsRead,
  getVapidPublicKey,
  subscribePush
} from './content-service.js';

let notificationsCache = [];
let activeFilter = 'all'; // 'all' | 'unread'
let sseSource = null;
let reconnectTimer = null;
let pollTimer = null;
let notifChannel = null;

// Initialize cross-tab BroadcastChannel
if (typeof BroadcastChannel !== 'undefined') {
  try {
    notifChannel = new BroadcastChannel('rp_notifications_sync');
    notifChannel.onmessage = (event) => {
      const data = event.data;
      if (!data) return;
      if (data.type === 'COUNT_UPDATE') {
        updateBadgeDisplay(data.count);
      } else if (data.type === 'REFRESH_LIST') {
        refreshNotificationsSilently();
      }
    };
  } catch (err) {
    console.warn('[Notifications] BroadcastChannel error:', err);
  }
}

/**
 * Standard utility: Convert Base64 URL to Uint8Array for PushManager
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Initialize Notification System
 */
export function initNotifications() {
  // Global handlers for UI triggers
  window.toggleNotificationsDropdown = async (event) => {
    if (event) event.stopPropagation();
    const dropdown = document.getElementById('notifications-dropdown');
    if (!dropdown) return;

    const isOpen = dropdown.classList.contains('open');
    if (isOpen) {
      dropdown.classList.remove('open');
    } else {
      dropdown.classList.add('open');
      await renderNotificationsDropdown();
    }
  };

  window.closeNotificationsDropdown = () => {
    const dropdown = document.getElementById('notifications-dropdown');
    if (dropdown) dropdown.classList.remove('open');
  };

  window.markAllNotificationsRead = async () => {
    notificationsCache.forEach(n => {
      n.unread = false;
      n.isRead = true;
    });
    updateBadgeDisplay(0);
    broadcastSync({ type: 'COUNT_UPDATE', count: 0 });
    await renderNotificationsDropdown();
    await markAllNotificationsRead();
  };

  window.markSingleNotificationRead = async (event, notifId) => {
    if (event) event.stopPropagation();
    const item = notificationsCache.find(n => n.id === notifId);
    if (item) {
      item.unread = false;
      item.isRead = true;
    }
    const unreadCount = notificationsCache.filter(n => n.unread).length;
    updateBadgeDisplay(unreadCount);
    broadcastSync({ type: 'COUNT_UPDATE', count: unreadCount });
    await renderNotificationsDropdown();
    await markNotificationRead(notifId);
  };

  window.handleNotificationClick = async (notifId, link, el) => {
    if (el) el.classList.remove('unread');
    const item = notificationsCache.find(n => n.id === notifId);
    if (item) {
      item.unread = false;
      item.isRead = true;
    }
    const unreadCount = notificationsCache.filter(n => n.unread).length;
    updateBadgeDisplay(unreadCount);
    broadcastSync({ type: 'COUNT_UPDATE', count: unreadCount });

    // Mark as read in MySQL
    markNotificationRead(notifId).catch(() => {});

    // Close dropdown
    window.closeNotificationsDropdown();

    // Deep navigation
    if (link) {
      if (link.startsWith('#')) {
        window.location.hash = link;
        if (window.renderAppView) window.renderAppView();
      } else {
        window.location.href = link;
      }
    }
  };

  window.setNotifFilter = (filter) => {
    activeFilter = filter;
    renderNotificationsDropdown();
  };

  // Close dropdown on outside click
  document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('notifications-dropdown');
    const bellBtn = document.getElementById('notification-bell-btn');
    if (dropdown && dropdown.classList.contains('open')) {
      if (!dropdown.contains(e.target) && (!bellBtn || !bellBtn.contains(e.target))) {
        dropdown.classList.remove('open');
      }
    }
  });

  // Register service worker quietly in background if supported
  registerServiceWorker();

  // Connect SSE real-time stream if user is logged in
  if (window.IS_LOGGED_IN) {
    connectRealtimeNotificationStream();
  }

  // Initial badge update
  window.updateNotificationBadge = updateNotificationBadge;
  updateNotificationBadge();

  // Setup background polling fallback (every 30s)
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(() => {
    if (window.IS_LOGGED_IN && (!sseSource || sseSource.readyState !== EventSource.OPEN)) {
      updateNotificationBadge();
    }
  }, 30000);
}

/**
 * Register Service Worker for Web Push API
 */
async function registerServiceWorker() {
  if ('serviceWorker' in navigator && 'PushManager' in window) {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      // If notification permission was already granted previously, quietly sync Web Push
      syncBrowserPushIfPermitted(reg);
      return reg;
    } catch (err) {
      console.warn('[SW] Service Worker registration failed:', err.message);
      return null;
    }
  }
  return null;
}

/**
 * If Chrome browser notification permission is ALREADY granted, quietly sync Web Push subscription.
 * Does NOT prompt the user or request permission.
 */
async function syncBrowserPushIfPermitted(reg) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
    return;
  }
  if (!window.IS_LOGGED_IN) {
    return;
  }

  try {
    const swReg = reg || await navigator.serviceWorker.ready;
    if (!swReg || !swReg.pushManager) return;

    const vapidKey = await getVapidPublicKey();
    if (!vapidKey) return;

    const applicationServerKey = urlBase64ToUint8Array(vapidKey);
    let subscription = await swReg.pushManager.getSubscription();
    if (!subscription) {
      // Subscribes quietly without prompting because permission is already 'granted'
      subscription = await swReg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey
      });
    }

    if (subscription) {
      await subscribePush(subscription.toJSON());
    }
  } catch (err) {
    console.warn('[WebPush] Silent sync error:', err.message);
  }
}

/**
 * Connect to backend Server-Sent Events (SSE) notification stream
 */
export function connectRealtimeNotificationStream() {
  if (!window.IS_LOGGED_IN) return;

  const token = localStorage.getItem('rp_auth_token');
  if (!token) return;

  if (sseSource) {
    try { sseSource.close(); } catch {}
    sseSource = null;
  }

  try {
    const sseUrl = `/api/notifications/stream?token=${encodeURIComponent(token)}`;
    sseSource = new EventSource(sseUrl);

    sseSource.addEventListener('init', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.unreadCount !== undefined) {
          updateBadgeDisplay(Number(data.unreadCount));
        }
      } catch {}
    });

    sseSource.addEventListener('unread_count', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.unreadCount !== undefined) {
          updateBadgeDisplay(Number(data.unreadCount));
        }
      } catch {}
    });

    sseSource.addEventListener('notification', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.notification) {
          handleIncomingRealtimeNotification(data.notification, data.unreadCount);
        }
      } catch (err) {
        console.warn('[SSE] Error handling notification event:', err);
      }
    });

    // Real-Time Private Chat SSE Event Dispatchers
    ['chat:message', 'chat:message_sent', 'chat:read', 'chat:lock_change', 'chat:settings'].forEach((evtName) => {
      sseSource.addEventListener(evtName, (e) => {
        try {
          const data = JSON.parse(e.data);
          window.dispatchEvent(new CustomEvent(evtName, { detail: data }));
        } catch (err) {
          console.warn(`[SSE] Error handling ${evtName}:`, err);
        }
      });
    });

    sseSource.onerror = () => {
      if (sseSource) {
        sseSource.close();
        sseSource = null;
      }
      // Reconnect after 8 seconds
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(() => {
        if (window.IS_LOGGED_IN) {
          connectRealtimeNotificationStream();
        }
      }, 8000);
    };
  } catch (err) {
    console.warn('[SSE] EventSource connection failed:', err);
  }
}

/**
 * Handle incoming real-time notification from SSE stream
 */
function handleIncomingRealtimeNotification(notif, unreadCount) {
  // 1. Add to cache (avoiding duplicates)
  if (!notificationsCache.some(n => n.id === notif.id)) {
    notificationsCache.unshift(notif);
  }

  // 2. Update Badge
  const finalCount = unreadCount !== undefined ? unreadCount : notificationsCache.filter(n => n.unread).length;
  updateBadgeDisplay(finalCount);
  broadcastSync({ type: 'COUNT_UPDATE', count: finalCount });

  // 3. Re-render dropdown if open
  const dropdown = document.getElementById('notifications-dropdown');
  if (dropdown && dropdown.classList.contains('open')) {
    renderNotificationsDropdown();
  }

  // 4. Trigger in-page toast alert
  if (typeof window.showToast === 'function') {
    window.showToast(`🔔 ${notif.title}: ${notif.message}`);
  }

  // 5. Trigger Native Chrome Browser Notification ONLY IF permission is already granted
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try {
      const nativeNotif = new Notification(notif.title, {
        body: notif.message,
        icon: notif.actor?.avatar || '/profile.png',
        badge: '/images/logo.png',
        tag: `rp-notif-${notif.id}`
      });

      nativeNotif.onclick = () => {
        window.focus();
        nativeNotif.close();
        if (notif.link) {
          window.location.hash = notif.link;
          if (window.renderAppView) window.renderAppView();
        }
      };
    } catch (err) {
      console.warn('[Native Notification Error]:', err);
    }
  }
}

/**
 * Update the header bell badge
 */
export async function updateNotificationBadge(overrideCount = null) {
  const badge = document.getElementById('notification-badge');
  if (!badge) return;

  if (!window.IS_LOGGED_IN) {
    badge.innerText = '';
    badge.style.display = 'none';
    return;
  }

  if (overrideCount !== null) {
    updateBadgeDisplay(overrideCount);
    return;
  }

  try {
    const count = await getUnreadNotificationsCount();
    updateBadgeDisplay(count);
  } catch {
    updateBadgeDisplay(0);
  }
}

function updateBadgeDisplay(count) {
  const badge = document.getElementById('notification-badge');
  if (!badge) return;

  if (count > 0) {
    badge.innerText = count > 99 ? '99+' : String(count);
    badge.style.display = 'flex';
  } else {
    badge.innerText = '';
    badge.style.display = 'none';
  }
}

function broadcastSync(msg) {
  if (notifChannel) {
    try {
      notifChannel.postMessage(msg);
    } catch {}
  }
}

async function refreshNotificationsSilently() {
  if (!window.IS_LOGGED_IN) return;
  try {
    const list = await getNotifications();
    notificationsCache = list || [];
    const count = notificationsCache.filter(n => n.unread).length;
    updateBadgeDisplay(count);
  } catch {}
}

/**
 * Render the complete Notification Dropdown Panel
 */
export async function renderNotificationsDropdown() {
  const dropdown = document.getElementById('notifications-dropdown');
  if (!dropdown) return;

  const isGuest = !window.IS_LOGGED_IN;

  if (isGuest) {
    dropdown.innerHTML = `
      <div class="notif-header">
        <span style="font-weight:700; color:var(--color-navy-deep); font-size:13px;">Notifications</span>
      </div>
      <div style="padding: 28px 20px; text-align: center;">
        <div style="font-size: 32px; margin-bottom: 10px;">🔔</div>
        <div style="font-weight: 700; font-size: 14px; color: var(--color-navy-deep); margin-bottom: 6px;">
          ${t('notif_guest_greeting') || 'Stay Updated'}
        </div>
        <p style="font-size: 12px; color: var(--color-text-muted); margin-bottom: 16px; line-height: 1.5;">
          ${t('notif_guest_msg') || 'Log in to view notifications when someone replies to your comment, reacts, or publishes a new chapter.'}
        </p>
        <button class="btn btn-gold btn-sm" onclick="openAuthModal('login'); window.closeNotificationsDropdown();">
          ${t('btn_login') || 'Log In'}
        </button>
      </div>
    `;
    return;
  }

  // Load notifications from MySQL
  try {
    const list = await getNotifications();
    notificationsCache = list || [];
  } catch {}

  const unreadCount = notificationsCache.filter(n => n.unread).length;
  updateBadgeDisplay(unreadCount);

  // Filter items
  const displayItems = activeFilter === 'unread'
    ? notificationsCache.filter(n => n.unread)
    : notificationsCache;

  dropdown.innerHTML = `
    <!-- Notification Header -->
    <div class="notif-header">
      <div style="display:flex; align-items:center; gap:8px;">
        <span style="font-weight:700; color:var(--color-navy-deep); font-size:14px;">Notifications</span>
        ${unreadCount > 0 ? `<span class="notif-count-pill">${unreadCount}</span>` : ''}
      </div>
      <div style="display:flex; align-items:center; gap:6px;">
        ${unreadCount > 0 ? `
          <button onclick="markAllNotificationsRead()" class="notif-header-btn" title="Mark all as read">
            Mark all read
          </button>
        ` : ''}
      </div>
    </div>

    <!-- Filter Tabs -->
    <div class="notif-tabs-bar">
      <button class="notif-tab ${activeFilter === 'all' ? 'active' : ''}" onclick="setNotifFilter('all')">
        All (${notificationsCache.length})
      </button>
      <button class="notif-tab ${activeFilter === 'unread' ? 'active' : ''}" onclick="setNotifFilter('unread')">
        Unread (${unreadCount})
      </button>
    </div>

    <!-- Notifications List Container -->
    <div class="notif-list" id="notifications-list-container">
      ${displayItems.length === 0 ? `
        <div class="notif-empty-state">
          <div style="font-size:26px; margin-bottom:6px;">📭</div>
          <div style="font-weight:600; font-size:13px; color:var(--color-navy-deep); margin-bottom:4px;">
            ${activeFilter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
          </div>
          <div style="font-size:11px; color:var(--color-text-muted); line-height:1.4;">
            ${activeFilter === 'unread' ? 'You have read all recent notifications.' : 'Notifications will appear here when members comment, reply, or react.'}
          </div>
        </div>
      ` : displayItems.map(n => renderNotificationItem(n)).join('')}
    </div>
  `;
}

/**
 * Render single notification item
 */
function renderNotificationItem(n) {
  const actorAvatar = n.actor?.avatar || '/profile.png';
  const actorName = n.actor?.displayName || n.actor?.username || '';
  const eventIcon = getEventIcon(n.type);
  const badgeLabel = getEventLabel(n.type);

  return `
    <div class="notif-item ${n.unread ? 'unread' : ''}" 
         onclick="window.handleNotificationClick(${n.id}, '${escapeQuote(n.link || '#forms')}', this)">
      
      <!-- Avatar with event badge overlay -->
      <div class="notif-avatar-box">
        <img src="${actorAvatar}" class="notif-avatar" alt="${escapeQuote(actorName)}" onerror="this.src='/profile.png'">
        <span class="notif-event-icon" title="${badgeLabel}">${eventIcon}</span>
      </div>

      <!-- Main content text -->
      <div class="notif-content-area">
        <div class="notif-title-row">
          <span class="notif-title">${n.title}</span>
          <span class="notif-badge-tag">${badgeLabel}</span>
        </div>
        <div class="notif-text">${n.message || n.text}</div>
        <div class="notif-footer-row">
          <span class="notif-time">${n.time || 'Recently'}</span>
          ${n.unread ? `
            <button class="notif-mark-single-btn" onclick="window.markSingleNotificationRead(event, ${n.id})" title="Mark as read">
              Mark read
            </button>
          ` : ''}
        </div>
      </div>
    </div>
  `;
}

function getEventIcon(type) {
  switch (type) {
    case 'comment_reply': return '↩️';
    case 'novel_comment': return '💬';
    case 'comment_reaction': return '❤️';
    case 'comment_like': return '👍';
    case 'forum_reply': return '🗨️';
    case 'forum_mention': return '🏷️';
    case 'chapter_release': return '📖';
    case 'account_event': return '👑';
    default: return '🔔';
  }
}

function getEventLabel(type) {
  switch (type) {
    case 'comment_reply': return 'Reply';
    case 'novel_comment': return 'Comment';
    case 'comment_reaction': return 'Reaction';
    case 'comment_like': return 'Like';
    case 'forum_reply': return 'Forum';
    case 'forum_mention': return 'Mention';
    case 'chapter_release': return 'Chapter';
    case 'account_event': return 'Account';
    default: return 'Notice';
  }
}

function escapeQuote(str) {
  if (!str) return '';
  return String(str).replace(/'/g, "\\'").replace(/"/g, '&quot;');
}
