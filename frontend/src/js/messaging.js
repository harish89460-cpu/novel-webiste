// Rudhra Prarthana Novels — Real-Time Private Messaging Engine
// WhatsApp-like Features: Image Attachments, Voice Notes, Emoji Picker, Edit, Delete, & Lock/Unlock Controls

import { apiFetch } from './errors.js';
import { showToast } from './reader.js';

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

let activeConversationId = null;
let activeConversationData = null;
let conversationsList = [];
let isDrawerOpen = false;
let globalChatAvailable = true;
let userSearchTimer = null;
let chatChannel = null;

// WhatsApp features state
let pendingImageAttachment = null;
let mediaRecorder = null;
let audioChunks = [];
let recordingTimer = null;
let recordingSeconds = 0;
let editingMessageId = null;
let activeAudio = null;
let activeAudioBtn = null;
let activeAudioFill = null;

// Cross-tab broadcast channel for immediate multi-tab synchronization
if (typeof BroadcastChannel !== 'undefined') {
  try {
    chatChannel = new BroadcastChannel('rp_chat_sync');
    chatChannel.onmessage = (event) => {
      const data = event.data;
      if (!data) return;
      if (data.type === 'UNREAD_UPDATE') {
        updateBadgeDisplay(data.count);
      } else if (data.type === 'CONVERSATIONS_REFRESH') {
        loadConversationsSilently();
      }
    };
  } catch (err) {
    console.warn('[Chat] BroadcastChannel initialization failed:', err);
  }
}

/**
 * Safe Chat API helper with auto JSON encoding and error unpacking
 */
async function chatApi(url, options = {}) {
  const opts = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  };
  const res = await apiFetch(url, opts);
  if (!res.ok) {
    let errMessage = 'Request failed';
    try {
      const errData = await res.json();
      errMessage = errData.error || errData.message || errMessage;
    } catch {}
    const err = new Error(errMessage);
    err.status = res.status;
    throw err;
  }
  return await res.json();
}

/**
 * Initialize Messaging System
 */
export function initMessaging() {
  // Expose global controller functions
  window.openMessagesDrawer = openMessagesDrawer;
  window.closeMessagesDrawer = closeMessagesDrawer;
  window.selectConversation = selectConversation;
  window.openDirectChatWithUser = openDirectChatWithUser;
  window.sendChatMessage = sendChatMessage;
  window.toggleChatAvailability = toggleChatAvailability;
  window.toggleChatLock = toggleChatLock;
  window.toggleConversationLockUi = toggleConversationLockUi;
  window.openNewChatModal = openNewChatModal;
  window.closeNewChatModal = closeNewChatModal;
  window.searchEligibleChatUsers = searchEligibleChatUsers;
  window.backToConversationList = backToConversationList;
  window.startChatWithUser = startChatWithUser;
  window.filterLocalConversations = filterLocalConversations;

  // WhatsApp features global handlers
  window.triggerChatAttachment = triggerChatAttachment;
  window.handleChatImageSelect = handleChatImageSelect;
  window.clearChatImageAttachment = clearChatImageAttachment;
  window.toggleEmojiPicker = toggleEmojiPicker;
  window.insertEmoji = insertEmoji;
  window.switchEmojiCategory = switchEmojiCategory;
  window.startVoiceRecording = startVoiceRecording;
  window.cancelVoiceRecording = cancelVoiceRecording;
  window.sendVoiceRecording = sendVoiceRecording;
  window.toggleVoicePlay = toggleVoicePlay;
  window.seekVoiceAudio = seekVoiceAudio;
  window.openChatImageLightbox = openChatImageLightbox;
  window.closeChatImageLightbox = closeChatImageLightbox;
  window.toggleBubbleMenu = toggleBubbleMenu;
  window.startEditChatMessage = startEditChatMessage;
  window.cancelEditChatMessage = cancelEditChatMessage;
  window.unsendChatMessage = unsendChatMessage;

  // Global click outside to dismiss emoji picker and bubble menus
  document.addEventListener('click', handleGlobalClickDismiss);

  // Real-time SSE Custom Event Listeners
  window.addEventListener('chat:message', handleIncomingRealtimeMessage);
  window.addEventListener('chat:message_sent', handleSentRealtimeMessage);
  window.addEventListener('chat:read', handleRealtimeReadReceipt);
  window.addEventListener('chat:lock_change', handleRealtimeLockChange);
  window.addEventListener('chat:settings', handleRealtimeSettingsChange);
  window.addEventListener('chat:message_edited', handleRealtimeMessageEdited);
  window.addEventListener('chat:message_deleted', handleRealtimeMessageDeleted);
  window.addEventListener('chat:conversation_lock', handleRealtimeConversationLock);

  // Initial unread count fetch if logged in
  if (window.IS_LOGGED_IN) {
    updateUnreadMessageBadge();
    loadGlobalChatSettings();
  }
}

/**
 * Open the Private Messages Drawer
 */
export async function openMessagesDrawer(targetParam = null) {
  if (!window.IS_LOGGED_IN) {
    if (typeof window.openAuthModal === 'function') {
      window.openAuthModal('login');
      showToast('Please sign in to access private messaging.');
    }
    return;
  }

  isDrawerOpen = true;
  const drawer = document.getElementById('messages-drawer');
  const backdrop = document.getElementById('messages-backdrop');
  if (drawer) drawer.classList.add('open');
  if (backdrop) backdrop.classList.add('open');

  // Load user's global availability preference
  await loadGlobalChatSettings();

  // If a specific conversation or user was requested
  if (targetParam) {
    if (typeof targetParam === 'number' || !isNaN(targetParam)) {
      await openDirectChatWithUser(targetParam);
      return;
    }
  }

  await loadConversationsList();
}

/**
 * Close the Private Messages Drawer
 */
export function closeMessagesDrawer() {
  isDrawerOpen = false;
  activeConversationId = null;
  activeConversationData = null;
  cancelEditChatMessage();
  clearChatImageAttachment();
  cancelVoiceRecording();
  stopAnyPlayingAudio();

  const drawer = document.getElementById('messages-drawer');
  const backdrop = document.getElementById('messages-backdrop');
  if (drawer) drawer.classList.remove('open');
  if (backdrop) backdrop.classList.remove('open');
}

/**
 * Load User's Global Chat Availability Setting
 */
async function loadGlobalChatSettings() {
  if (!window.IS_LOGGED_IN) return;
  try {
    const res = await chatApi('/api/chat/settings');
    if (res && res.is_chat_available !== undefined) {
      globalChatAvailable = Boolean(res.is_chat_available);
    }
  } catch (err) {
    console.warn('[Chat] Failed to load chat settings:', err);
  }
}

/**
 * Toggle Global Chat Availability
 */
export async function toggleChatAvailability(newStatus) {
  const desired = Boolean(newStatus);
  try {
    const res = await chatApi('/api/chat/settings', {
      method: 'POST',
      body: JSON.stringify({ is_chat_available: desired ? 1 : 0 })
    });
    if (res && res.success) {
      globalChatAvailable = desired;
      showToast(desired ? 'Chat is now ON. Other users can message you.' : 'Chat is now OFF. New incoming messages are paused.');
      renderDrawerStructure();
    } else {
      throw new Error(res?.error || 'Failed to update setting');
    }
  } catch (err) {
    showToast('Error updating chat availability: ' + err.message);
    const toggleInput = document.getElementById('chat-global-toggle-input');
    if (toggleInput) toggleInput.checked = globalChatAvailable;
  }
}

/**
 * Update Header and Mobile Badges with actual total unread count
 */
export async function updateUnreadMessageBadge() {
  if (!window.IS_LOGGED_IN) {
    updateBadgeDisplay(0);
    return;
  }
  try {
    const data = await chatApi('/api/chat/unread-count');
    const count = Number(data?.totalUnread || 0);
    updateBadgeDisplay(count);
    if (chatChannel) {
      chatChannel.postMessage({ type: 'UNREAD_UPDATE', count });
    }
  } catch (err) {
    console.warn('[Chat] Failed to update unread badge:', err);
  }
}

function updateBadgeDisplay(count) {
  const badge = document.getElementById('inbox-badge');
  const drawerBadge = document.getElementById('drawer-inbox-badge');

  [badge, drawerBadge].forEach((el) => {
    if (el) {
      el.textContent = count > 99 ? '99+' : count;
      el.style.display = count > 0 ? 'flex' : 'none';
    }
  });
}

/**
 * Load List of Conversations
 */
async function loadConversationsList() {
  const container = document.getElementById('messages-body-container');
  if (!container) return;

  renderDrawerStructure();
  const listArea = document.getElementById('threads-list-content');
  if (listArea) {
    listArea.innerHTML = `
      <div style="text-align:center; padding:36px 16px; color:var(--color-text-muted);">
        <div style="font-size:24px; margin-bottom:8px;">⏳</div>
        <div>Loading your conversations...</div>
      </div>
    `;
  }

  try {
    const res = await chatApi('/api/chat/conversations');
    conversationsList = res?.conversations || [];
    renderConversationsList(conversationsList);
  } catch (err) {
    if (listArea) {
      listArea.innerHTML = `
        <div style="text-align:center; padding:36px 16px; color:#EF4444;">
          <div style="font-size:24px; margin-bottom:8px;">⚠️</div>
          <div>${escapeHtml(err.message || 'Failed to load conversations.')}</div>
          <button class="btn btn-outline btn-sm" onclick="openMessagesDrawer()" style="margin-top:12px;">Retry</button>
        </div>
      `;
    }
  }
}

async function loadConversationsSilently() {
  if (!isDrawerOpen) return;
  try {
    const res = await chatApi('/api/chat/conversations');
    conversationsList = res?.conversations || [];
    if (!activeConversationId) {
      renderConversationsList(conversationsList);
    }
  } catch {}
}

/**
 * Render Base Structure inside Messages Drawer
 */
function renderDrawerStructure() {
  const container = document.getElementById('messages-body-container');
  if (!container) return;

  container.innerHTML = `
    <!-- Global Chat Availability Bar -->
    <div class="chat-availability-bar">
      <div class="chat-availability-toggle">
        <span>Chat Available</span>
        <label class="chat-switch" title="Toggle your chat availability">
          <input type="checkbox" id="chat-global-toggle-input" ${globalChatAvailable ? 'checked' : ''} 
                 onchange="toggleChatAvailability(this.checked)">
          <span class="chat-slider"></span>
        </label>
        <span class="chat-availability-badge ${globalChatAvailable ? 'on' : 'off'}">
          ${globalChatAvailable ? 'ON' : 'OFF'}
        </span>
      </div>
      <button class="btn-primary-sm" onclick="openNewChatModal()" style="display:flex; align-items:center; gap:4px; font-size:11.5px; padding:4px 10px;">
        <span>✏️</span> New Chat
      </button>
    </div>

    <!-- Main Dynamic Area: Conversation List OR Active Conversation -->
    <div id="messages-main-area" style="flex:1; display:flex; flex-direction:column; overflow:hidden;">
      <!-- Search Filter Bar -->
      <div class="chat-search-wrap">
        <input type="text" class="chat-search-input" id="chat-search-threads" 
               placeholder="Search conversations..." 
               oninput="filterLocalConversations(this.value)">
      </div>

      <!-- Threads List Scrollable Area -->
      <div class="threads-list" id="threads-list-content"></div>
    </div>
  `;
}

/**
 * Filter Conversations in Drawer
 */
export function filterLocalConversations(keyword) {
  const query = (keyword || '').toLowerCase().trim();
  if (!query) {
    renderConversationsList(conversationsList);
    return;
  }
  const filtered = (conversationsList || []).filter((c) => {
    if (!c) return false;
    const user = c.otherUser || c.other_user || {};
    const name = (user.displayName || user.display_name || user.username || '').toLowerCase();
    let lastMsg = '';
    if (typeof c.lastMessage === 'string') lastMsg = c.lastMessage;
    else if (c.lastMessage?.content) lastMsg = c.lastMessage.content;
    else if (typeof c.last_message === 'string') lastMsg = c.last_message;
    return name.includes(query) || lastMsg.toLowerCase().includes(query);
  });
  renderConversationsList(filtered);
}

/**
 * Render the Threads List
 */
function renderConversationsList(list) {
  const listArea = document.getElementById('threads-list-content');
  if (!listArea) return;

  if (!list || list.length === 0) {
    listArea.innerHTML = `
      <div class="chat-empty-state">
        <div class="chat-empty-icon">💬</div>
        <div class="chat-empty-title">No conversations yet</div>
        <div class="chat-empty-desc">
          Connect privately with fellow members, authors, and writers.
        </div>
        <button class="btn btn-gold btn-sm" onclick="openNewChatModal()" style="margin-top:16px;">
          Start a Conversation
        </button>
      </div>
    `;
    return;
  }

  listArea.innerHTML = list.map((c) => {
    if (!c) return '';
    const user = c.otherUser || c.other_user || {};
    const unread = Number(c.unreadCount ?? c.unread_count ?? 0);
    const avatar = user.avatar || '/profile.png';
    const name = escapeHtml(user.displayName || user.display_name || user.username || 'Member');
    const role = (user.role || '').toLowerCase();
    const isOnline = Boolean(user.isOnline ?? user.is_online);

    let snippet = 'Started a conversation';
    if (typeof c.last_message === 'string' && c.last_message) {
      snippet = c.last_message;
    } else if (typeof c.lastMessage === 'string' && c.lastMessage) {
      snippet = c.lastMessage;
    } else if (c.lastMessage && c.lastMessage.content) {
      snippet = c.lastMessage.content;
    }
    snippet = escapeHtml(snippet);

    const time = formatChatTime(c.lastMessageAt || c.last_message_at || c.updatedAt || c.updated_at);
    const convId = c.id ?? c.conversationId;

    let roleBadge = '';
    if (role === 'author' || role === 'admin') {
      roleBadge = '<span class="role-badge-sm author">Author</span>';
    } else if (role === 'writer') {
      roleBadge = '<span class="role-badge-sm writer">Writer</span>';
    }

    return `
      <div class="thread-item ${unread > 0 ? 'unread' : ''}" onclick="selectConversation(${convId})">
        <div class="thread-avatar-wrap">
          <img src="${avatar}" class="thread-avatar" alt="${name}" onerror="this.src='/profile.png'">
          <span class="online-dot ${isOnline ? '' : 'offline'}" title="${isOnline ? 'Online' : 'Offline'}"></span>
        </div>
        <div class="thread-content">
          <div class="thread-user-row">
            <span class="thread-name">
              ${name}
              ${roleBadge}
            </span>
            <span class="thread-time">${time}</span>
          </div>
          <div class="thread-bottom-row">
            <span class="thread-snippet">${snippet}</span>
            ${unread > 0 ? `<span class="thread-unread-badge">${unread}</span>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Open direct conversation with a target user
 */
export async function openDirectChatWithUser(targetUserId) {
  try {
    const res = await chatApi('/api/chat/conversations', {
      method: 'POST',
      body: JSON.stringify({ targetUserId: Number(targetUserId) })
    });
    const convId = res?.conversationId || res?.conversation?.id || res?.id;
    if (convId) {
      await selectConversation(convId);
    } else {
      throw new Error(res?.error || 'Could not open conversation with this user.');
    }
  } catch (err) {
    showToast(err.message || 'Could not open conversation with this user.');
  }
}

/**
 * Select and load a conversation view
 */
export async function selectConversation(conversationId) {
  if (!conversationId) return;
  activeConversationId = Number(conversationId);
  cancelEditChatMessage();
  clearChatImageAttachment();
  cancelVoiceRecording();
  stopAnyPlayingAudio();

  const mainArea = document.getElementById('messages-main-area');
  if (!mainArea) return;

  mainArea.innerHTML = `
    <div style="text-align:center; padding:50px 16px; color:var(--color-text-muted);">
      <div style="font-size:24px; margin-bottom:8px;">⏳</div>
      <div>Loading conversation...</div>
    </div>
  `;

  try {
    const data = await chatApi(`/api/chat/conversations/${conversationId}`);
    if (!data || !data.success) {
      throw new Error(data?.error || 'Failed to open conversation.');
    }
    activeConversationData = data;
    renderActiveConversation(data);

    // Promptly refresh header unread badges
    updateUnreadMessageBadge();
  } catch (err) {
    mainArea.innerHTML = `
      <div style="text-align:center; padding:40px 16px; color:#EF4444;">
        <div style="font-size:24px; margin-bottom:8px;">⚠️</div>
        <div>${escapeHtml(err.message || 'Failed to open conversation.')}</div>
        <button class="btn btn-outline btn-sm" onclick="backToConversationList()" style="margin-top:16px;">
          ← Back to Conversations
        </button>
      </div>
    `;
  }
}

/**
 * Render Active Conversation View with WhatsApp-like features
 */
function renderActiveConversation(data) {
  const mainArea = document.getElementById('messages-main-area');
  if (!mainArea) return;

  if (!data) {
    mainArea.innerHTML = `
      <div class="chat-empty-state">
        <div class="chat-empty-icon">⚠️</div>
        <div class="chat-empty-title">Conversation Not Available</div>
        <div class="chat-empty-desc">Could not load the requested conversation data.</div>
        <button class="btn btn-outline btn-sm" onclick="backToConversationList()" style="margin-top:12px;">Back to Conversations</button>
      </div>
    `;
    return;
  }

  const conv = data.conversation || {};
  const messages = Array.isArray(data.messages) ? data.messages : (Array.isArray(conv.messages) ? conv.messages : []);
  const lock = data.lockStatus || conv.lockStatus || { locked: false, isLockedByMe: false, isLockedByThem: false };
  const other = data.otherUser || data.other_user || conv.otherUser || conv.other_user || {};

  const name = escapeHtml(other.displayName || other.display_name || other.username || 'Member');
  const avatar = other.avatar || '/profile.png';
  const role = (other.role || '').toLowerCase();
  const isOnline = Boolean(other.isOnline ?? other.is_online);
  const otherUserId = other.id ? Number(other.id) : null;
  const isConvLocked = Boolean(data.isLocked || data.is_locked || conv.isLocked || conv.is_locked);

  let roleBadge = '';
  if (role === 'author' || role === 'admin') {
    roleBadge = '<span class="role-badge-sm author">Author</span>';
  } else if (role === 'writer') {
    roleBadge = '<span class="role-badge-sm writer">Writer</span>';
  }

  // Precedence determination: Global availability + Individual Locks + Conversation Lock
  let targetAvailable = true;
  if (data.isChatAvailable !== undefined) {
    targetAvailable = Boolean(data.isChatAvailable);
  } else if (other.isChatAvailable !== undefined) {
    targetAvailable = Boolean(other.isChatAvailable);
  } else if (other.is_chat_available !== undefined) {
    targetAvailable = Boolean(other.is_chat_available);
  }

  const isLockedByMe = Boolean(lock.isLockedByMe || other.isLockedByMe);
  const isLockedByThem = Boolean(lock.isLockedByThem || other.isLockedByThem);
  const isUserLocked = Boolean(lock.locked || lock.isLocked || isLockedByMe || isLockedByThem);

  let canSend = data.canSend !== undefined ? Boolean(data.canSend) : true;
  let noticeHtml = '';

  if (isConvLocked) {
    canSend = false;
    noticeHtml = `
      <div class="chat-notice-banner danger">
        <span>🔒</span>
        <span>${escapeHtml(data.lockedReason || conv.lockedReason || 'This conversation is locked by an administrator.')}</span>
      </div>
    `;
  } else if (!targetAvailable) {
    canSend = false;
    noticeHtml = `
      <div class="chat-notice-banner warning">
        <span>⚠️</span>
        <span>This user is not accepting new messages.</span>
      </div>
    `;
  } else if (isUserLocked) {
    canSend = false;
    if (isLockedByMe) {
      noticeHtml = `
        <div class="chat-notice-banner danger">
          <span>🔒</span>
          <span>You locked chat with this user. Unlock to resume messaging.</span>
        </div>
      `;
    } else {
      noticeHtml = `
        <div class="chat-notice-banner danger">
          <span>🔒</span>
          <span>This user has locked direct messaging with you.</span>
        </div>
      `;
    }
  } else if (data.blockReason) {
    canSend = false;
    noticeHtml = `
      <div class="chat-notice-banner warning">
        <span>⚠️</span>
        <span>${escapeHtml(data.blockReason)}</span>
      </div>
    `;
  }

  mainArea.innerHTML = `
    <div class="conversation-view">
      <!-- Chat Top Header -->
      <div class="conversation-chat-header">
        <button class="chat-action-btn" onclick="backToConversationList()" title="Back to conversations">
          ←
        </button>
        <div class="chat-user-meta">
          <div class="thread-avatar-wrap" style="width:36px; height:36px;">
            <img src="${avatar}" class="thread-avatar" style="width:36px; height:36px;" alt="${name}" onerror="this.src='/profile.png'">
            <span class="online-dot ${isOnline ? '' : 'offline'}" style="width:10px; height:10px;"></span>
          </div>
          <div>
            <div style="font-weight:700; font-size:13.5px; color:var(--color-navy-deep); display:flex; align-items:center; gap:6px;">
              ${name}
              ${roleBadge}
            </div>
            <div style="font-size:10.5px; color:${isOnline ? 'var(--color-success)' : '#94A3B8'};">
              ${isOnline ? '● Online' : '○ Offline'}
            </div>
          </div>
        </div>

        <div class="chat-header-actions">
          ${otherUserId ? `
            <button class="chat-action-btn ${isLockedByMe ? 'locked' : ''}" 
                    onclick="toggleChatLock(${otherUserId}, '${isLockedByMe ? 'unlock' : 'lock'}')"
                    title="${isLockedByMe ? 'Unlock this conversation' : 'Lock messaging with this user'}">
              ${isLockedByMe ? '🔓 Unlock User' : '🔒 Lock User'}
            </button>
          ` : ''}

          ${(window.CURRENT_USER?.role === 'admin' || window.CURRENT_USER?.is_admin) ? `
            <button class="chat-action-btn ${isConvLocked ? 'locked' : ''}" 
                    onclick="toggleConversationLockUi(${activeConversationId}, ${isConvLocked ? 'false' : 'true'})"
                    title="${isConvLocked ? 'Unlock entire conversation' : 'Lock entire conversation'}">
              ${isConvLocked ? '🔓 Restore Chat' : '🔒 Lock Chat'}
            </button>
          ` : ''}
        </div>
      </div>

      <!-- Notice Banner (if locked or unavailable) -->
      ${noticeHtml}

      <!-- Message Bubbles Stream -->
      <div class="messages-stream" id="messages-stream-box">
        ${renderMessageBubbles(messages, other)}
      </div>

      <!-- Message Composer Container with WhatsApp tools -->
      <div class="message-composer-wrap" id="chat-composer-wrap">
        <!-- Editing Message Banner (hidden by default) -->
        <div class="chat-edit-banner" id="chat-edit-banner" style="display:none;">
          <span>✏️ Editing message</span>
          <button type="button" onclick="cancelEditChatMessage()">✕ Cancel</button>
        </div>

        <!-- Image Attachment Preview Strip (hidden by default) -->
        <div class="chat-image-preview-strip" id="chat-image-preview-strip" style="display:none;">
          <img src="" id="chat-image-preview-img" class="chat-image-preview-thumb" alt="Preview">
          <div class="chat-image-preview-info">
            <div id="chat-image-preview-name" style="font-weight:600;">image.png</div>
            <div id="chat-image-preview-size" style="font-size:10.5px; color:#94A3B8;">0 KB</div>
          </div>
          <button type="button" class="chat-image-preview-remove" onclick="clearChatImageAttachment()" title="Remove attachment">✕</button>
        </div>

        <!-- Voice Recording Active Bar (hidden by default) -->
        <div class="chat-voice-recording-bar" id="chat-voice-rec-bar" style="display:none;">
          <div class="chat-recording-indicator">
            <span class="rec-pulse-dot"></span>
            <span>Recording Voice Message...</span>
            <span id="chat-rec-timer" style="font-family:monospace; margin-left:6px;">00:00</span>
          </div>
          <div class="chat-recording-actions">
            <button type="button" class="btn-rec-cancel" onclick="cancelVoiceRecording()">🗑️ Cancel</button>
            <button type="button" class="btn-rec-send" onclick="sendVoiceRecording()">✓ Send</button>
          </div>
        </div>

        <!-- Composer Standard Row -->
        <div class="chat-composer-row" id="chat-composer-standard-row">
          <!-- Hidden File Input for Image Attachments -->
          <input type="file" id="chat-file-input" accept="image/jpeg,image/png,image/webp,image/gif" 
                 style="display:none;" onchange="handleChatImageSelect(event)">

          <!-- Attachment Trigger Button -->
          <button type="button" class="chat-icon-btn" onclick="triggerChatAttachment()" 
                  ${canSend ? '' : 'disabled'} title="Attach Photo / Image">
            📎
          </button>

          <!-- Emoji Picker Trigger Button -->
          <button type="button" class="chat-icon-btn" id="chat-emoji-trigger-btn" onclick="toggleEmojiPicker(event)" 
                  ${canSend ? '' : 'disabled'} title="Insert Emoji">
            😊
          </button>

          <!-- Floating Emoji Picker Popover -->
          <div class="chat-emoji-picker" id="chat-emoji-picker" style="display:none;">
            <div class="chat-emoji-tabs">
              <button type="button" class="chat-emoji-tab active" onclick="switchEmojiCategory('smileys', event)">😀</button>
              <button type="button" class="chat-emoji-tab" onclick="switchEmojiCategory('gestures', event)">👍</button>
              <button type="button" class="chat-emoji-tab" onclick="switchEmojiCategory('novels', event)">📚</button>
              <button type="button" class="chat-emoji-tab" onclick="switchEmojiCategory('hearts', event)">💖</button>
            </div>
            <div class="chat-emoji-grid" id="chat-emoji-grid">
              ${renderEmojiGrid('smileys')}
            </div>
          </div>

          <!-- Text Message Input -->
          <textarea id="chat-composer-input" class="message-input" rows="1"
                    placeholder="${canSend ? 'Type a private message...' : 'Messaging currently restricted'}" 
                    ${canSend ? '' : 'disabled'}
                    onkeydown="handleComposerKeydown(event)"></textarea>

          <!-- Voice Message Mic Button -->
          <button type="button" class="chat-icon-btn" id="chat-mic-btn" onclick="startVoiceRecording()" 
                  ${canSend ? '' : 'disabled'} title="Record Voice Message">
            🎙️
          </button>

          <!-- Send Message Button -->
          <button class="message-send-btn" id="chat-send-btn" 
                  onclick="sendChatMessage()" 
                  ${canSend ? '' : 'disabled'} 
                  title="Send Message">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </div>
      </div>
    </div>
  `;

  scrollMessagesToBottom();
}

/**
 * Categorized Emojis Database
 */
const EMOJI_CATEGORIES = {
  smileys: ['😀','😃','😄','😁','😆','😅','😂','🤣','🥲','☺️','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🥸','🤩','🥳','😏','😒','😞','😔','😟','😕','🙁','☹️','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤬','🤯','😳','🥵','🥶','😱','😨','😰','😥','😓','🤗','🤔','🫣','🤫','🫢','🫡','🤤','😴','😵','🤐','🥴','🤢','🤮'],
  gestures: ['👍','👎','👌','🤌','✌️','🤞','🫰','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','👋','🤚','🖐️','✋','🖖','🫱','🫲','🫸','🫷','👏','🙌','👐','🤲','🤝','🙏','✍️','💅','🤳','💪'],
  novels: ['📚','📖','📕','📗','📘','📙','📓','📒','📃','📜','📄','📰','📑','🔖','🏷️','✍️','🖋️','🖊️','🖌️','📝','💡','🌟','✨','⭐','🔥','☕','🍵','🎧','🎬','🎭','🎨','🏆','👑','💎'],
  hearts: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❤️‍🔥','❤️‍🩹','❣️','💕','💞','💓','💗','💖','💘','💝','💟','☮️','✝️','☪️','🕉️','☸️','✡️','🔯','🕎','☯️','☦️']
};

function renderEmojiGrid(category) {
  const list = EMOJI_CATEGORIES[category] || EMOJI_CATEGORIES.smileys;
  return list.map(em => `
    <button type="button" class="chat-emoji-item" onclick="insertEmoji('${em}')">${em}</button>
  `).join('');
}

export function switchEmojiCategory(category, event) {
  if (event) {
    const tabs = document.querySelectorAll('.chat-emoji-tab');
    tabs.forEach(t => t.classList.remove('active'));
    event.currentTarget.classList.add('active');
  }
  const grid = document.getElementById('chat-emoji-grid');
  if (grid) {
    grid.innerHTML = renderEmojiGrid(category);
  }
}

export function toggleEmojiPicker(e) {
  if (e) e.stopPropagation();
  const picker = document.getElementById('chat-emoji-picker');
  if (!picker) return;
  picker.style.display = picker.style.display === 'none' ? 'flex' : 'none';
}

export function insertEmoji(emoji) {
  const input = document.getElementById('chat-composer-input');
  if (!input) return;
  const start = input.selectionStart || input.value.length;
  const end = input.selectionEnd || input.value.length;
  const text = input.value;
  input.value = text.substring(0, start) + emoji + text.substring(end);
  input.focus();
  input.selectionStart = input.selectionEnd = start + emoji.length;
}

function handleGlobalClickDismiss(e) {
  // Dismiss emoji picker if clicked outside
  const picker = document.getElementById('chat-emoji-picker');
  const trigger = document.getElementById('chat-emoji-trigger-btn');
  if (picker && picker.style.display !== 'none') {
    if (!picker.contains(e.target) && (!trigger || !trigger.contains(e.target))) {
      picker.style.display = 'none';
    }
  }

  // Dismiss bubble action menus
  if (!e.target.closest('.bubble-actions-trigger') && !e.target.closest('.bubble-action-menu')) {
    const menus = document.querySelectorAll('.bubble-action-menu');
    menus.forEach(m => m.remove());
  }
}

/**
 * Image Attachment Handlers
 */
export function triggerChatAttachment() {
  const input = document.getElementById('chat-file-input');
  if (input) input.click();
}

export function handleChatImageSelect(event) {
  const file = event.target?.files?.[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    showToast('Please select a valid image file (JPEG, PNG, WebP, GIF).');
    return;
  }

  if (file.size > 8 * 1024 * 1024) {
    showToast('Image file size must be under 8MB.');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    pendingImageAttachment = {
      file,
      dataUrl,
      name: file.name,
      size: (file.size / 1024).toFixed(1) + ' KB'
    };

    // Show preview strip
    const strip = document.getElementById('chat-image-preview-strip');
    const thumb = document.getElementById('chat-image-preview-img');
    const nameEl = document.getElementById('chat-image-preview-name');
    const sizeEl = document.getElementById('chat-image-preview-size');

    if (strip && thumb && nameEl && sizeEl) {
      thumb.src = dataUrl;
      nameEl.textContent = file.name;
      sizeEl.textContent = pendingImageAttachment.size;
      strip.style.display = 'flex';
    }

    const input = document.getElementById('chat-composer-input');
    if (input) {
      input.placeholder = 'Add a caption (optional)...';
      input.focus();
    }
  };
  reader.readAsDataURL(file);
}

export function clearChatImageAttachment() {
  pendingImageAttachment = null;
  const strip = document.getElementById('chat-image-preview-strip');
  if (strip) strip.style.display = 'none';
  const fileInput = document.getElementById('chat-file-input');
  if (fileInput) fileInput.value = '';
  const input = document.getElementById('chat-composer-input');
  if (input && !editingMessageId) {
    input.placeholder = 'Type a private message...';
  }
}

/**
 * Voice Message MediaRecorder & Recording Handlers
 */
export async function startVoiceRecording() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showToast('Voice message recording is not supported on this browser.');
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioChunks = [];

    let mimeType = 'audio/webm';
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
      mimeType = 'audio/webm;codecs=opus';
    } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
      mimeType = 'audio/mp4';
    } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
      mimeType = 'audio/ogg';
    }

    mediaRecorder = new MediaRecorder(stream, { mimeType });
    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) audioChunks.push(e.data);
    };

    mediaRecorder.start(100);

    // Switch UI to voice recording bar
    recordingSeconds = 0;
    const stdRow = document.getElementById('chat-composer-standard-row');
    const recBar = document.getElementById('chat-voice-rec-bar');
    const timerEl = document.getElementById('chat-rec-timer');

    if (stdRow) stdRow.style.display = 'none';
    if (recBar) recBar.style.display = 'flex';

    if (recordingTimer) clearInterval(recordingTimer);
    recordingTimer = setInterval(() => {
      recordingSeconds++;
      const mins = String(Math.floor(recordingSeconds / 60)).padStart(2, '0');
      const secs = String(recordingSeconds % 60).padStart(2, '0');
      if (timerEl) timerEl.textContent = `${mins}:${secs}`;
    }, 1000);

  } catch (err) {
    console.warn('[Chat] Microphone permission error:', err);
    showToast('Microphone access is required to record voice messages.');
  }
}

export function cancelVoiceRecording() {
  if (recordingTimer) {
    clearInterval(recordingTimer);
    recordingTimer = null;
  }
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.onstop = null;
    mediaRecorder.stop();
    if (mediaRecorder.stream) {
      mediaRecorder.stream.getTracks().forEach(t => t.stop());
    }
  }
  mediaRecorder = null;
  audioChunks = [];
  recordingSeconds = 0;

  const stdRow = document.getElementById('chat-composer-standard-row');
  const recBar = document.getElementById('chat-voice-rec-bar');
  if (stdRow) stdRow.style.display = 'flex';
  if (recBar) recBar.style.display = 'none';
}

export async function sendVoiceRecording() {
  if (!mediaRecorder || mediaRecorder.state === 'inactive') return;

  const durationSec = recordingSeconds;
  if (recordingTimer) {
    clearInterval(recordingTimer);
    recordingTimer = null;
  }

  const recMime = mediaRecorder.mimeType || 'audio/webm';

  mediaRecorder.onstop = async () => {
    if (mediaRecorder.stream) {
      mediaRecorder.stream.getTracks().forEach(t => t.stop());
    }

    const audioBlob = new Blob(audioChunks, { type: recMime });
    if (audioBlob.size < 500) {
      showToast('Voice message too short.');
      cancelVoiceRecording();
      return;
    }

    showToast('Sending voice note...');

    try {
      // Convert to Base64
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Audio = reader.result;

        // 1. Upload to chat media endpoint
        const uploadRes = await chatApi('/api/chat/upload', {
          method: 'POST',
          body: JSON.stringify({
            file: base64Audio,
            fileType: 'audio',
            meta: { duration: durationSec }
          })
        });

        if (!uploadRes || !uploadRes.url) {
          throw new Error(uploadRes?.error || 'Failed to upload voice message.');
        }

        // 2. Send message
        const sendRes = await chatApi(`/api/chat/conversations/${activeConversationId}/messages`, {
          method: 'POST',
          body: JSON.stringify({
            messageType: 'audio',
            attachmentUrl: uploadRes.url,
            attachmentMeta: { duration: durationSec }
          })
        });

        if (sendRes && sendRes.message) {
          appendOutgoingBubble(sendRes.message);
        }
      };
      reader.readAsDataURL(audioBlob);
    } catch (err) {
      showToast('Failed to send voice note: ' + err.message);
    } finally {
      cancelVoiceRecording();
    }
  };

  mediaRecorder.stop();
}

/**
 * Custom Audio Player for Voice Messages
 */
export function toggleVoicePlay(msgId, audioUrl, btnEl) {
  if (activeAudio && activeAudio.src === audioUrl) {
    if (!activeAudio.paused) {
      activeAudio.pause();
      btnEl.textContent = '▶';
      return;
    } else {
      activeAudio.play();
      btnEl.textContent = '⏸';
      return;
    }
  }

  stopAnyPlayingAudio();

  const audio = new Audio(audioUrl);
  activeAudio = audio;
  activeAudioBtn = btnEl;
  btnEl.textContent = '⏸';

  const bubble = btnEl.closest('.message-bubble');
  const progressFill = bubble?.querySelector('.voice-progress-fill');
  const durationLabel = bubble?.querySelector('.voice-time-display');

  activeAudioFill = progressFill;

  audio.ontimeupdate = () => {
    if (audio.duration && progressFill) {
      const pct = (audio.currentTime / audio.duration) * 100;
      progressFill.style.width = pct + '%';
      if (durationLabel) {
        const rem = Math.max(0, Math.floor(audio.duration - audio.currentTime));
        const mins = Math.floor(rem / 60);
        const secs = String(rem % 60).padStart(2, '0');
        durationLabel.textContent = `${mins}:${secs}`;
      }
    }
  };

  audio.onended = () => {
    btnEl.textContent = '▶';
    if (progressFill) progressFill.style.width = '0%';
    stopAnyPlayingAudio();
  };

  audio.onerror = () => {
    btnEl.textContent = '▶';
    showToast('Failed to play voice message.');
    stopAnyPlayingAudio();
  };

  audio.play().catch(e => {
    console.warn('[Chat] Audio autoplay/playback error:', e);
    btnEl.textContent = '▶';
  });
}

export function seekVoiceAudio(event, audioUrl) {
  if (!activeAudio || activeAudio.src !== audioUrl) return;
  const bar = event.currentTarget;
  const rect = bar.getBoundingClientRect();
  const clickX = event.clientX - rect.left;
  const pct = Math.max(0, Math.min(1, clickX / rect.width));
  if (activeAudio.duration) {
    activeAudio.currentTime = pct * activeAudio.duration;
  }
}

function stopAnyPlayingAudio() {
  if (activeAudio) {
    try {
      activeAudio.pause();
    } catch {}
    activeAudio = null;
  }
  if (activeAudioBtn) {
    activeAudioBtn.textContent = '▶';
    activeAudioBtn = null;
  }
  if (activeAudioFill) {
    activeAudioFill.style.width = '0%';
    activeAudioFill = null;
  }
}

/**
 * Image Lightbox Modal
 */
export function openChatImageLightbox(src) {
  let lightbox = document.getElementById('chat-lightbox-modal');
  if (!lightbox) {
    lightbox = document.createElement('div');
    lightbox.id = 'chat-lightbox-modal';
    lightbox.className = 'chat-lightbox';
    lightbox.onclick = (e) => {
      if (e.target === lightbox || e.target.classList.contains('chat-lightbox-close')) {
        closeChatImageLightbox();
      }
    };
    lightbox.innerHTML = `
      <button type="button" class="chat-lightbox-close" title="Close">✕</button>
      <img src="" class="chat-lightbox-img" id="chat-lightbox-target-img" alt="Zoomed chat photo">
    `;
    document.body.appendChild(lightbox);
  }
  const imgEl = document.getElementById('chat-lightbox-target-img');
  if (imgEl) imgEl.src = src;
  lightbox.style.display = 'flex';
}

export function closeChatImageLightbox() {
  const lightbox = document.getElementById('chat-lightbox-modal');
  if (lightbox) lightbox.style.display = 'none';
}

/**
 * Message Bubble Context Menu (Edit & Delete)
 */
export function toggleBubbleMenu(event, msgId, isMyMessage) {
  event.stopPropagation();
  const triggerBtn = event.currentTarget;
  const bubble = triggerBtn.closest('.message-bubble');
  if (!bubble) return;

  const existingMenu = bubble.querySelector('.bubble-action-menu');
  if (existingMenu) {
    existingMenu.remove();
    return;
  }

  // Dismiss any other open menus
  document.querySelectorAll('.bubble-action-menu').forEach(m => m.remove());

  const isText = bubble.getAttribute('data-msg-type') === 'text';
  const isAdmin = window.CURRENT_USER?.role === 'admin' || window.CURRENT_USER?.is_admin;

  const menu = document.createElement('div');
  menu.className = 'bubble-action-menu';

  let itemsHtml = '';
  if (isMyMessage && isText) {
    itemsHtml += `<button type="button" onclick="startEditChatMessage(${msgId})">✏️ Edit</button>`;
  }
  if (isMyMessage || isAdmin) {
    itemsHtml += `<button type="button" class="danger" onclick="unsendChatMessage(${msgId})">🗑️ Unsend</button>`;
  }

  if (!itemsHtml) return;

  menu.innerHTML = itemsHtml;
  bubble.appendChild(menu);
}

/**
 * Message Editing Handlers
 */
export function startEditChatMessage(msgId) {
  const bubble = document.querySelector(`.message-bubble[data-msg-id="${msgId}"]`);
  if (!bubble) return;

  const textEl = bubble.querySelector('.bubble-text-content');
  const rawText = textEl ? textEl.textContent.trim() : '';

  editingMessageId = msgId;

  const editBanner = document.getElementById('chat-edit-banner');
  const composerInput = document.getElementById('chat-composer-input');

  if (editBanner) editBanner.style.display = 'flex';
  if (composerInput) {
    composerInput.value = rawText;
    composerInput.focus();
  }

  // Dismiss menu
  document.querySelectorAll('.bubble-action-menu').forEach(m => m.remove());
}

export function cancelEditChatMessage() {
  editingMessageId = null;
  const editBanner = document.getElementById('chat-edit-banner');
  const composerInput = document.getElementById('chat-composer-input');

  if (editBanner) editBanner.style.display = 'none';
  if (composerInput) {
    composerInput.value = '';
    composerInput.placeholder = 'Type a private message...';
  }
}

/**
 * Unsend / Delete Message
 */
export async function unsendChatMessage(msgId) {
  // Dismiss menu
  document.querySelectorAll('.bubble-action-menu').forEach(m => m.remove());

  if (!confirm('Are you sure you want to unsend this message? It will be deleted for everyone.')) {
    return;
  }

  try {
    const res = await chatApi(`/api/chat/messages/${msgId}`, { method: 'DELETE' });
    if (res && res.success) {
      showToast('Message deleted.');
      markBubbleAsDeleted(msgId);
    } else {
      throw new Error(res?.error || 'Failed to delete message.');
    }
  } catch (err) {
    showToast('Failed to delete message: ' + err.message);
  }
}

function markBubbleAsDeleted(msgId) {
  const bubble = document.querySelector(`.message-bubble[data-msg-id="${msgId}"]`);
  if (!bubble) return;
  bubble.className = 'message-bubble deleted';
  bubble.innerHTML = `
    <span>🚫 <i>This message was deleted</i></span>
    <div class="bubble-meta">
      <span>${formatMessageClock(new Date())}</span>
    </div>
  `;
}

/**
 * Conversation-Level Lock / Unlock Control
 */
export async function toggleConversationLockUi(convId, shouldLock) {
  try {
    const res = await chatApi(`/api/chat/conversations/${convId}/lock`, {
      method: 'POST',
      body: JSON.stringify({
        action: shouldLock ? 'lock' : 'unlock',
        reason: shouldLock ? 'Conversation restricted by administrator.' : ''
      })
    });
    if (res && res.success) {
      showToast(shouldLock ? 'Chat conversation has been locked.' : 'Chat conversation has been unlocked.');
      if (activeConversationId === Number(convId)) {
        await selectConversation(convId);
      }
    } else {
      throw new Error(res?.error || 'Failed to update conversation lock.');
    }
  } catch (err) {
    showToast('Failed to update chat lock: ' + err.message);
  }
}

/**
 * Toggle User-to-User Chat Lock
 */
export async function toggleChatLock(targetUserId, action) {
  try {
    const res = await chatApi('/api/chat/lock', {
      method: 'POST',
      body: JSON.stringify({ targetUserId: Number(targetUserId), action })
    });

    if (res && res.success) {
      showToast(action === 'lock' ? 'Chat with user has been locked.' : 'Chat with user has been unlocked.');
      if (activeConversationId) {
        await selectConversation(activeConversationId);
      }
    } else {
      throw new Error(res?.error || 'Failed to update lock');
    }
  } catch (err) {
    showToast('Failed to update chat lock: ' + err.message);
  }
}

/**
 * Render Message Bubbles List
 */
function renderMessageBubbles(messages, otherUser) {
  if (!messages || messages.length === 0) {
    return `
      <div style="text-align:center; padding:40px 16px; color:var(--color-text-muted); margin:auto;">
        <div style="font-size:32px; margin-bottom:8px;">👋</div>
        <div style="font-weight:600; color:var(--color-navy-deep); margin-bottom:4px;">No messages here yet</div>
        <div style="font-size:12px;">Say hello, share a photo, or send a voice note!</div>
      </div>
    `;
  }

  const currentUserId = window.CURRENT_USER?.id;
  let lastDateStr = '';
  const htmlChunks = [];

  messages.forEach((msg) => {
    if (!msg) return;
    const msgSenderId = msg.senderId ?? msg.sender_id ?? msg.sender?.id;
    const isOutgoing = Boolean(
      msg.isMe ||
      msg.is_me ||
      (currentUserId && Number(msgSenderId) === Number(currentUserId))
    );
    const rawDate = msg.createdAt || msg.created_at;
    const msgDate = rawDate ? new Date(rawDate) : new Date();
    const dateStr = formatDateSeparator(msgDate);

    if (dateStr !== lastDateStr) {
      htmlChunks.push(`<div class="message-date-separator">${escapeHtml(dateStr)}</div>`);
      lastDateStr = dateStr;
    }

    const timeStr = formatMessageClock(msgDate);
    const isRead = Boolean(msg.isRead ?? msg.is_read);
    const isEdited = Boolean(msg.isEdited ?? msg.is_edited);
    const isDeleted = Boolean(msg.isDeleted ?? msg.is_deleted);
    const msgType = msg.messageType || msg.message_type || 'text';
    const attachUrl = msg.attachmentUrl || msg.attachment_url;
    const msgId = msg.id || '';

    if (isDeleted) {
      htmlChunks.push(`
        <div class="message-bubble deleted ${isOutgoing ? 'outgoing' : 'incoming'}" data-msg-id="${msgId}">
          <span>🚫 <i>This message was deleted</i></span>
          <div class="bubble-meta">
            <span>${timeStr}</span>
          </div>
        </div>
      `);
      return;
    }

    let bodyHtml = '';

    if (msgType === 'image' && attachUrl) {
      bodyHtml = `
        <div class="chat-bubble-image-wrap" onclick="openChatImageLightbox('${escapeHtml(attachUrl)}')">
          <img src="${escapeHtml(attachUrl)}" alt="Attached photo" loading="lazy">
        </div>
        ${msg.content ? `<div class="bubble-text-content">${escapeHtml(msg.content)}</div>` : ''}
      `;
    } else if (msgType === 'audio' && attachUrl) {
      const meta = msg.attachmentMeta || msg.attachment_meta || {};
      const durationSec = meta.duration ? Math.round(meta.duration) : 0;
      const mins = Math.floor(durationSec / 60);
      const secs = String(durationSec % 60).padStart(2, '0');
      const timeDisplay = `${mins}:${secs}`;

      bodyHtml = `
        <div class="chat-voice-player">
          <button type="button" class="voice-play-btn" onclick="toggleVoicePlay(${msgId}, '${escapeHtml(attachUrl)}', this)">
            ▶
          </button>
          <div class="voice-waveform-wrap">
            <div class="voice-progress-bar" onclick="seekVoiceAudio(event, '${escapeHtml(attachUrl)}')">
              <div class="voice-progress-fill"></div>
            </div>
            <div class="voice-meta-row">
              <span class="voice-time-display">${timeDisplay}</span>
              <span>🎙️ Voice</span>
            </div>
          </div>
        </div>
      `;
    } else {
      bodyHtml = `<div class="bubble-text-content">${escapeHtml(msg.content || '')}</div>`;
    }

    const menuTriggerHtml = `
      <button type="button" class="bubble-actions-trigger" onclick="toggleBubbleMenu(event, ${msgId}, ${isOutgoing})" title="Message options">
        ⋮
      </button>
    `;

    htmlChunks.push(`
      <div class="message-bubble ${isOutgoing ? 'outgoing' : 'incoming'}" data-msg-id="${msgId}" data-msg-type="${msgType}">
        ${menuTriggerHtml}
        ${bodyHtml}
        <div class="bubble-meta">
          ${isEdited ? '<span class="chat-edited-tag">(edited)</span>' : ''}
          <span>${timeStr}</span>
          ${isOutgoing ? `<span class="read-checkmarks ${isRead ? 'read' : 'unread'}">${isRead ? '✓✓' : '✓'}</span>` : ''}
        </div>
      </div>
    `);
  });

  return htmlChunks.join('');
}

/**
 * Handle Enter to send in composer (Shift+Enter for newline)
 */
export function handleComposerKeydown(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendChatMessage();
  }
}
window.handleComposerKeydown = handleComposerKeydown;

/**
 * Send a message or update an edited message
 */
export async function sendChatMessage() {
  if (!activeConversationId) return;

  const input = document.getElementById('chat-composer-input');
  const sendBtn = document.getElementById('chat-send-btn');
  if (!input) return;

  const content = input.value.trim();

  // If in Edit Mode:
  if (editingMessageId) {
    if (!content) {
      showToast('Message cannot be empty.');
      return;
    }
    try {
      if (sendBtn) sendBtn.disabled = true;
      const res = await chatApi(`/api/chat/messages/${editingMessageId}`, {
        method: 'PUT',
        body: JSON.stringify({ content })
      });
      if (res && res.success) {
        showToast('Message updated.');
        updateBubbleTextLocally(editingMessageId, content);
        cancelEditChatMessage();
      } else {
        throw new Error(res?.error || 'Failed to update message.');
      }
    } catch (err) {
      showToast('Failed to edit message: ' + err.message);
    } finally {
      if (sendBtn) sendBtn.disabled = false;
    }
    return;
  }

  // If an image attachment is pending:
  if (pendingImageAttachment) {
    if (sendBtn) sendBtn.disabled = true;
    showToast('Uploading photo...');

    try {
      // 1. Upload image to chat storage
      const uploadRes = await chatApi('/api/chat/upload', {
        method: 'POST',
        body: JSON.stringify({
          file: pendingImageAttachment.dataUrl,
          fileType: 'image'
        })
      });

      if (!uploadRes || !uploadRes.url) {
        throw new Error(uploadRes?.error || 'Failed to upload image.');
      }

      // 2. Send message with attachment
      const sendRes = await chatApi(`/api/chat/conversations/${activeConversationId}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          content,
          messageType: 'image',
          attachmentUrl: uploadRes.url
        })
      });

      if (sendRes && sendRes.message) {
        appendOutgoingBubble(sendRes.message);
        clearChatImageAttachment();
        input.value = '';
      }
    } catch (err) {
      showToast('Failed to send image: ' + err.message);
    } finally {
      if (sendBtn) sendBtn.disabled = false;
      input.focus();
    }
    return;
  }

  // Standard text message:
  if (!content) return;

  input.value = '';
  if (sendBtn) sendBtn.disabled = true;

  try {
    const res = await chatApi(`/api/chat/conversations/${activeConversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content, messageType: 'text' })
    });

    if (res && res.message) {
      appendOutgoingBubble(res.message);
    } else {
      throw new Error(res?.error || 'Failed to send message');
    }
  } catch (err) {
    showToast('Failed to send message: ' + err.message);
    input.value = content; // restore text
  } finally {
    if (sendBtn) sendBtn.disabled = false;
    input.focus();
  }
}

/**
 * Append outgoing message bubble locally
 */
function appendOutgoingBubble(msg) {
  const streamBox = document.getElementById('messages-stream-box');
  if (!streamBox || !msg) return;

  // Remove empty placeholder if present
  const emptyState = streamBox.querySelector('.chat-empty-state') || streamBox.querySelector('div[style*="margin:auto"]');
  if (emptyState) emptyState.remove();

  const rawDate = msg.createdAt || msg.created_at || Date.now();
  const timeStr = formatMessageClock(new Date(rawDate));
  const isRead = Boolean(msg.isRead ?? msg.is_read);
  const msgType = msg.messageType || msg.message_type || 'text';
  const attachUrl = msg.attachmentUrl || msg.attachment_url;
  const msgId = msg.id || '';

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble outgoing';
  bubble.setAttribute('data-msg-id', msgId);
  bubble.setAttribute('data-msg-type', msgType);

  let bodyHtml = '';
  if (msgType === 'image' && attachUrl) {
    bodyHtml = `
      <div class="chat-bubble-image-wrap" onclick="openChatImageLightbox('${escapeHtml(attachUrl)}')">
        <img src="${escapeHtml(attachUrl)}" alt="Attached photo">
      </div>
      ${msg.content ? `<div class="bubble-text-content">${escapeHtml(msg.content)}</div>` : ''}
    `;
  } else if (msgType === 'audio' && attachUrl) {
    const meta = msg.attachmentMeta || msg.attachment_meta || {};
    const durationSec = meta.duration ? Math.round(meta.duration) : 0;
    const mins = Math.floor(durationSec / 60);
    const secs = String(durationSec % 60).padStart(2, '0');
    bodyHtml = `
      <div class="chat-voice-player">
        <button type="button" class="voice-play-btn" onclick="toggleVoicePlay(${msgId}, '${escapeHtml(attachUrl)}', this)">
          ▶
        </button>
        <div class="voice-waveform-wrap">
          <div class="voice-progress-bar" onclick="seekVoiceAudio(event, '${escapeHtml(attachUrl)}')">
            <div class="voice-progress-fill"></div>
          </div>
          <div class="voice-meta-row">
            <span class="voice-time-display">${mins}:${secs}</span>
            <span>🎙️ Voice</span>
          </div>
        </div>
      </div>
    `;
  } else {
    bodyHtml = `<div class="bubble-text-content">${escapeHtml(msg.content || '')}</div>`;
  }

  bubble.innerHTML = `
    <button type="button" class="bubble-actions-trigger" onclick="toggleBubbleMenu(event, ${msgId}, true)" title="Message options">
      ⋮
    </button>
    ${bodyHtml}
    <div class="bubble-meta">
      <span>${timeStr}</span>
      <span class="read-checkmarks ${isRead ? 'read' : 'unread'}">${isRead ? '✓✓' : '✓'}</span>
    </div>
  `;

  streamBox.appendChild(bubble);
  scrollMessagesToBottom();
}

function updateBubbleTextLocally(msgId, newContent) {
  const bubble = document.querySelector(`.message-bubble[data-msg-id="${msgId}"]`);
  if (!bubble) return;
  const textContent = bubble.querySelector('.bubble-text-content');
  if (textContent) {
    textContent.textContent = newContent;
  }
  const meta = bubble.querySelector('.bubble-meta');
  if (meta && !meta.querySelector('.chat-edited-tag')) {
    const tag = document.createElement('span');
    tag.className = 'chat-edited-tag';
    tag.textContent = '(edited)';
    meta.insertBefore(tag, meta.firstChild);
  }
}

/**
 * Back to Conversation List
 */
export function backToConversationList() {
  activeConversationId = null;
  activeConversationData = null;
  cancelEditChatMessage();
  clearChatImageAttachment();
  cancelVoiceRecording();
  stopAnyPlayingAudio();
  loadConversationsList();
}

/**
 * Scroll Messages Stream to Bottom
 */
function scrollMessagesToBottom() {
  setTimeout(() => {
    const stream = document.getElementById('messages-stream-box');
    if (stream) {
      stream.scrollTop = stream.scrollHeight;
    }
  }, 40);
}

/**
 * Real-Time SSE Handlers
 */
function handleIncomingRealtimeMessage(event) {
  const detail = event?.detail;
  if (!detail || !detail.message) return;

  const convId = Number(detail.conversationId);
  const msg = detail.message;

  // 1. If user is currently looking at this exact conversation
  if (isDrawerOpen && activeConversationId === convId) {
    const streamBox = document.getElementById('messages-stream-box');
    if (streamBox) {
      const rawDate = msg.createdAt || msg.created_at || Date.now();
      const timeStr = formatMessageClock(new Date(rawDate));
      const msgType = msg.messageType || msg.message_type || 'text';
      const attachUrl = msg.attachmentUrl || msg.attachment_url;
      const msgId = msg.id || '';

      const bubble = document.createElement('div');
      bubble.className = 'message-bubble incoming';
      bubble.setAttribute('data-msg-id', msgId);
      bubble.setAttribute('data-msg-type', msgType);

      let bodyHtml = '';
      if (msgType === 'image' && attachUrl) {
        bodyHtml = `
          <div class="chat-bubble-image-wrap" onclick="openChatImageLightbox('${escapeHtml(attachUrl)}')">
            <img src="${escapeHtml(attachUrl)}" alt="Photo">
          </div>
          ${msg.content ? `<div class="bubble-text-content">${escapeHtml(msg.content)}</div>` : ''}
        `;
      } else if (msgType === 'audio' && attachUrl) {
        const meta = msg.attachmentMeta || msg.attachment_meta || {};
        const durationSec = meta.duration ? Math.round(meta.duration) : 0;
        const mins = Math.floor(durationSec / 60);
        const secs = String(durationSec % 60).padStart(2, '0');
        bodyHtml = `
          <div class="chat-voice-player">
            <button type="button" class="voice-play-btn" onclick="toggleVoicePlay(${msgId}, '${escapeHtml(attachUrl)}', this)">
              ▶
            </button>
            <div class="voice-waveform-wrap">
              <div class="voice-progress-bar" onclick="seekVoiceAudio(event, '${escapeHtml(attachUrl)}')">
                <div class="voice-progress-fill"></div>
              </div>
              <div class="voice-meta-row">
                <span class="voice-time-display">${mins}:${secs}</span>
                <span>🎙️ Voice</span>
              </div>
            </div>
          </div>
        `;
      } else {
        bodyHtml = `<div class="bubble-text-content">${escapeHtml(msg.content || '')}</div>`;
      }

      const isAdmin = window.CURRENT_USER?.role === 'admin' || window.CURRENT_USER?.is_admin;
      const triggerHtml = isAdmin ? `
        <button type="button" class="bubble-actions-trigger" onclick="toggleBubbleMenu(event, ${msgId}, false)" title="Message options">
          ⋮
        </button>
      ` : '';

      bubble.innerHTML = `
        ${triggerHtml}
        ${bodyHtml}
        <div class="bubble-meta">
          <span>${timeStr}</span>
        </div>
      `;
      streamBox.appendChild(bubble);
      scrollMessagesToBottom();
    }
    // Mark conversation read on backend
    chatApi(`/api/chat/conversations/${convId}`).catch(() => {});
  } else {
    // Increment unread count & show subtle toast
    updateUnreadMessageBadge();
    const senderName = detail.sender?.displayName || detail.sender?.display_name || detail.sender?.name || detail.sender?.username || 'Someone';
    showToast(`✉️ New message from ${escapeHtml(senderName)}`);
    loadConversationsSilently();
  }
}

function handleSentRealtimeMessage(event) {
  loadConversationsSilently();
}

function handleRealtimeReadReceipt(event) {
  const detail = event?.detail;
  if (!detail || !activeConversationId) return;

  if (Number(detail.conversationId) === Number(activeConversationId)) {
    const receipts = document.querySelectorAll('#messages-stream-box .read-checkmarks');
    receipts.forEach((r) => {
      r.classList.add('read');
      r.classList.remove('unread');
      r.textContent = '✓✓';
    });
  }
}

function handleRealtimeLockChange(event) {
  const detail = event?.detail;
  if (!detail) return;
  if (activeConversationId) {
    selectConversation(activeConversationId);
  } else {
    loadConversationsSilently();
  }
}

function handleRealtimeConversationLock(event) {
  const detail = event?.detail;
  if (!detail) return;
  if (activeConversationId && Number(detail.conversationId) === Number(activeConversationId)) {
    selectConversation(activeConversationId);
  }
}

function handleRealtimeSettingsChange(event) {
  const detail = event?.detail;
  if (!detail) return;
  if (detail.userId === window.CURRENT_USER?.id) {
    globalChatAvailable = Boolean(detail.isChatAvailable);
    const toggleInput = document.getElementById('chat-global-toggle-input');
    if (toggleInput) toggleInput.checked = globalChatAvailable;
  }
  if (activeConversationId) {
    selectConversation(activeConversationId);
  }
}

function handleRealtimeMessageEdited(event) {
  const detail = event?.detail;
  if (!detail || !detail.messageId) return;
  updateBubbleTextLocally(detail.messageId, detail.content);
}

function handleRealtimeMessageDeleted(event) {
  const detail = event?.detail;
  if (!detail || !detail.messageId) return;
  markBubbleAsDeleted(detail.messageId);
}

/**
 * Start New Conversation Modal
 */
export function openNewChatModal() {
  let modal = document.getElementById('new-chat-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'new-chat-modal';
    modal.className = 'modal-overlay';
    modal.onclick = (e) => {
      if (e.target === modal) closeNewChatModal();
    };
    modal.innerHTML = `
      <div class="modal-card" style="max-width:440px;">
        <div class="modal-header">
          <h3 class="modal-title">New Private Conversation</h3>
          <button class="modal-close-btn" onclick="closeNewChatModal()">✕</button>
        </div>
        <div class="modal-body" style="padding:16px;">
          <input type="text" id="new-chat-user-search" class="form-input" 
                 placeholder="Search members, writers, or authors by name..." 
                 oninput="searchEligibleChatUsers(this.value)" autofocus>
          <div id="new-chat-users-list" style="max-height:300px; overflow-y:auto; margin-top:14px;">
            <div style="text-align:center; padding:20px; color:var(--color-text-muted); font-size:13px;">
              Type a name to search eligible members or authors.
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  modal.classList.add('open');
  const input = document.getElementById('new-chat-user-search');
  if (input) {
    input.value = '';
    input.focus();
  }
  searchEligibleChatUsers('');
}

export function closeNewChatModal() {
  const modal = document.getElementById('new-chat-modal');
  if (modal) modal.classList.remove('open');
}

export async function searchEligibleChatUsers(query) {
  if (userSearchTimer) clearTimeout(userSearchTimer);
  userSearchTimer = setTimeout(async () => {
    const listEl = document.getElementById('new-chat-users-list');
    if (!listEl) return;

    listEl.innerHTML = `<div style="text-align:center; padding:20px; color:var(--color-text-muted); font-size:13px;">Searching...</div>`;

    try {
      const res = await chatApi(`/api/chat/users?search=${encodeURIComponent(query || '')}`);
      const users = res?.users || [];

      if (users.length === 0) {
        listEl.innerHTML = `
          <div style="text-align:center; padding:24px 12px; color:var(--color-text-muted); font-size:13px;">
            No users found matching your search.
          </div>
        `;
        return;
      }

      listEl.innerHTML = users.map((u) => {
        const name = escapeHtml(u.display_name || u.username);
        const avatar = u.avatar || '/profile.png';
        const role = (u.role || '').toLowerCase();
        let roleBadge = '';
        if (role === 'author' || role === 'admin') {
          roleBadge = '<span class="role-badge-sm author">Author</span>';
        } else if (role === 'writer') {
          roleBadge = '<span class="role-badge-sm writer">Writer</span>';
        }

        return `
          <div class="thread-item" onclick="startChatWithUser(${u.id})" style="border-radius:8px; margin-bottom:6px;">
            <div class="thread-avatar-wrap" style="width:38px; height:38px;">
              <img src="${avatar}" class="thread-avatar" style="width:38px; height:38px;" alt="${name}" onerror="this.src='/profile.png'">
            </div>
            <div class="thread-content">
              <div class="thread-user-row">
                <span class="thread-name">
                  ${name}
                  ${roleBadge}
                </span>
                <span style="font-size:11px; color:var(--color-gold-warm);">Message ➔</span>
              </div>
              <span style="font-size:11.5px; color:#94A3B8;">@${escapeHtml(u.username)}</span>
            </div>
          </div>
        `;
      }).join('');
    } catch (err) {
      listEl.innerHTML = `
        <div style="text-align:center; padding:20px; color:#EF4444; font-size:13px;">
          ${escapeHtml(err.message || 'Failed to search users')}
        </div>
      `;
    }
  }, 250);
}

export async function startChatWithUser(userId) {
  closeNewChatModal();
  await openDirectChatWithUser(userId);
}

/**
 * Format Helpers
 */
function formatChatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return d.toLocaleDateString([], { weekday: 'short' });
  } else {
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
}

function formatDateSeparator(date) {
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return 'Today';
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatMessageClock(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
