// Rudhra Prarthana Novels — Direct Messaging System
// Modern Literary XenForo / Community Style Direct Messaging
// Full Rich-Text Toolbar, Multi-Recipient Composer, Voice Studio with Review, Inline Images, Files & Real-time SSE

import { apiFetch, resolveApiUrl } from './errors.js';
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

function safeAssetUrl(url) {
  if (!url || typeof url !== 'string') return '';
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;
  if (typeof resolveApiUrl === 'function') return resolveApiUrl(url);
  if (typeof window !== 'undefined' && typeof window.resolveApiUrl === 'function') {
    return window.resolveApiUrl(url);
  }
  return url;
}

// State
let activeConversationId = null;
let activeConversationData = null;
let conversationsList = [];
let currentFilter = 'all'; // 'all' | 'unread'
let searchQuery = '';
let chatChannel = null;

// Real-time synchronization timers
let activeChatPollTimer = null;
let unreadBadgePollTimer = null;

// Composer / Reply State
let dmSelectedRecipients = [];
let dmRecipientsSearchTimer = null;
let dmAttachedImage = null; // { file, dataUrl, name, size }
let dmAttachedFile = null;  // { file, dataUrl, name, size }
let dmIsPreviewing = false;
let dmReplyIsPreviewing = false;
let editingMessageId = null;

// Voice Recording Studio State
let dmVoiceState = {
  isRecording: false,
  isPaused: false,
  mediaRecorder: null,
  stream: null,
  chunks: [],
  timer: null,
  seconds: 0,
  audioBlob: null,
  audioUrl: null,
  audioDuration: 0,
  audioPreview: null,
  isPlayingPreview: false
};

// Cross-tab broadcast channel for unread badges
if (typeof BroadcastChannel !== 'undefined') {
  try {
    chatChannel = new BroadcastChannel('rp_chat_sync');
    chatChannel.onmessage = (event) => {
      const data = event.data;
      if (!data) return;
      if (data.type === 'UNREAD_UPDATE') {
        updateBadgeDisplay(data.count);
      } else if (data.type === 'CONVERSATIONS_REFRESH') {
        if (!activeConversationId && window.location.hash.startsWith('#messages')) {
          refreshConversationsListSilently();
        }
      }
    };
  } catch (err) {
    console.warn('[Chat] BroadcastChannel initialization failed:', err);
  }
}

/**
 * Chat API Helper
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
 * ==========================================================================
 * Initialization
 * ==========================================================================
 */
export function initMessaging() {
  // Expose global controller functions
  window.renderDirectMessagesView = renderDirectMessagesView;
  window.navigateToDirectMessages = navigateToDirectMessages;
  window.openDirectMessageComposerModal = openDirectMessageComposerModal;
  window.closeDirectMessageComposerModal = closeDirectMessageComposerModal;
  window.submitDirectMessage = submitDirectMessage;
  window.openDirectChatWithUser = openDirectChatWithUser;
  window.selectDirectMessageConversation = selectDirectMessageConversation;
  window.backToDirectMessagesList = backToDirectMessagesList;
  window.sendDirectMessageReply = sendDirectMessageReply;
  window.filterDirectMessages = filterDirectMessages;
  window.setDirectMessagesFilter = setDirectMessagesFilter;

  // Rich-Text Editor Toolbar Handlers
  window.formatDmText = formatDmText;
  window.formatDmFontSize = formatDmFontSize;
  window.formatDmColor = formatDmColor;
  window.toggleDmColorPalette = toggleDmColorPalette;
  window.formatDmAlign = formatDmAlign;
  window.openDmLinkDialog = openDmLinkDialog;
  window.closeDmLinkDialog = closeDmLinkDialog;
  window.confirmDmLink = confirmDmLink;
  window.triggerDmImageUpload = triggerDmImageUpload;
  window.handleDmImageSelect = handleDmImageSelect;
  window.clearDmAttachedImage = clearDmAttachedImage;
  window.triggerDmFileUpload = triggerDmFileUpload;
  window.handleDmFileSelect = handleDmFileSelect;
  window.clearDmAttachedFile = clearDmAttachedFile;
  window.toggleDmEmojiPicker = toggleDmEmojiPicker;
  window.switchDmEmojiCat = switchDmEmojiCat;
  window.insertDmEmoji = insertDmEmoji;
  window.insertDmTable = insertDmTable;
  window.toggleDmQuote = toggleDmQuote;
  window.toggleDmCode = toggleDmCode;
  window.toggleDmPreview = toggleDmPreview;
  window.toggleDmReplyPreview = toggleDmReplyPreview;

  // Voice Studio Handlers
  window.toggleDmVoiceStudio = toggleDmVoiceStudio;
  window.startDmVoiceRecording = startDmVoiceRecording;
  window.pauseDmVoiceRecording = pauseDmVoiceRecording;
  window.resumeDmVoiceRecording = resumeDmVoiceRecording;
  window.stopDmVoiceRecording = stopDmVoiceRecording;
  window.discardDmVoiceRecording = discardDmVoiceRecording;
  window.reRecordDmVoice = reRecordDmVoice;
  window.toggleDmVoicePlay = toggleDmVoicePlay;
  window.seekDmVoicePreview = seekDmVoicePreview;
  window.toggleVoicePlay = toggleVoicePlay;
  window.seekVoiceAudio = seekVoiceAudio;

  // Recipient Handlers
  window.handleDmRecipientsInput = handleDmRecipientsInput;
  window.handleDmRecipientsKeydown = handleDmRecipientsKeydown;
  window.addDmRecipient = addDmRecipient;
  window.removeDmRecipient = removeDmRecipient;
  window.focusDmRecipientsInput = focusDmRecipientsInput;

  // Invites & Locks
  window.openInviteModal = openInviteModal;
  window.closeInviteModal = closeInviteModal;
  window.handleInviteSearch = handleInviteSearch;
  window.submitInviteUser = submitInviteUser;
  window.toggleConversationLockUi = toggleConversationLockUi;
  window.toggleChatLock = toggleChatLock;

  // Message Actions
  window.startEditChatMessage = startEditChatMessage;
  window.cancelEditChatMessage = cancelEditChatMessage;
  window.unsendChatMessage = unsendChatMessage;
  window.deleteConversationUi = deleteConversationUi;
  window.openChatImageLightbox = openChatImageLightbox;
  window.closeChatImageLightbox = closeChatImageLightbox;

  // Backward compatibility aliases
  window.openMessagesDrawer = openMessagesDrawer;
  window.closeMessagesDrawer = closeMessagesDrawer;
  window.selectConversation = selectConversation;
  window.backToConversationList = backToConversationList;
  window.sendChatMessage = sendDirectMessageReply;
  window.startChatWithUser = openDirectChatWithUser;

  // Global click dismiss
  document.addEventListener('click', handleGlobalClickDismiss);

  // Real-time SSE Custom Event Listeners
  window.addEventListener('chat:message', handleIncomingRealtimeMessage);
  window.addEventListener('chat:message_sent', handleSentRealtimeMessage);
  window.addEventListener('chat:read', handleRealtimeReadReceipt);
  window.addEventListener('chat:lock_change', handleRealtimeLockChange);
  window.addEventListener('chat:message_edited', handleRealtimeMessageEdited);
  window.addEventListener('chat:message_deleted', handleRealtimeMessageDeleted);
  window.addEventListener('chat:conversation_lock', handleRealtimeConversationLock);

  // Unread badge poller
  startUnreadBadgePoller();
  if (window.IS_LOGGED_IN) {
    updateUnreadMessageBadge();
  }
}

/**
 * Backward compatibility helpers
 */
export function navigateToDirectMessages() {
  window.location.hash = '#messages';
}

export function openMessagesDrawer(targetParam = null) {
  if (targetParam) {
    window.location.hash = `#messages?user=${targetParam}`;
  } else {
    window.location.hash = '#messages';
  }
}

export function closeMessagesDrawer() {
  closeDirectMessageComposerModal();
  closeInviteModal();
  closeDmLinkDialog();
  closeChatImageLightbox();
}

export function selectConversation(convId) {
  selectDirectMessageConversation(convId);
}

export function backToConversationList() {
  backToDirectMessagesList();
}

/**
 * ==========================================================================
 * Main Direct Messages Page View Router & Renderer
 * ==========================================================================
 */
export async function renderDirectMessagesView(container, hash = '#messages') {
  if (!container) return;
  stopActiveConversationPoller();

  if (!window.IS_LOGGED_IN) {
    container.innerHTML = `
      <div class="dm-page-container container" style="max-width:960px; margin:40px auto; padding:0 16px;">
        <div class="dm-empty-state" style="background:#FFFFFF; border:1px solid #E2E8F0; border-radius:12px; padding:60px 24px; text-align:center;">
          <div style="font-size:48px; margin-bottom:12px;">🔒</div>
          <h2 style="font-size:22px; font-weight:700; color:#0F172A; margin:0 0 8px;">Direct Messages</h2>
          <p style="color:#64748B; font-size:14.5px; max-width:440px; margin:0 auto 20px;">
            Please sign in to your account to view your direct messages and communicate with authors, writers, and members.
          </p>
          <button type="button" class="btn btn-primary" onclick="if(typeof window.openAuthModal==='function') window.openAuthModal('login');" 
                  style="background:#50E386; color:#0F172A; font-weight:700; border:none; padding:10px 24px; border-radius:6px; cursor:pointer;">
            Sign In to Continue
          </button>
        </div>
      </div>
    `;
    return;
  }

  // Parse Hash Query Params: #messages?id=123 or #messages?user=45 or #messages?compose=1
  const queryPart = hash.includes('?') ? hash.split('?')[1] : '';
  const params = new URLSearchParams(queryPart);
  const convIdParam = params.get('id') ? Number(params.get('id')) : null;
  const userParam = params.get('user') ? Number(params.get('user')) : null;
  const composeParam = params.get('compose') === '1' || params.get('compose') === 'true';

  if (convIdParam) {
    await selectDirectMessageConversation(convIdParam, container);
    return;
  }

  if (userParam) {
    await handleDirectUserParam(userParam, container);
    return;
  }

  // Otherwise render full Conversations List
  activeConversationId = null;
  activeConversationData = null;
  await renderConversationsListView(container);

  if (composeParam) {
    openDirectMessageComposerModal();
  }
}

/**
 * Handle direct user param (#messages?user=12)
 */
async function handleDirectUserParam(targetUserId, container) {
  try {
    const res = await chatApi('/api/chat/conversations', {
      method: 'POST',
      body: JSON.stringify({ targetUserId: Number(targetUserId) })
    });
    const convId = res?.conversationId || res?.conversation?.id || res?.id;
    if (convId) {
      window.location.hash = `#messages?id=${convId}`;
    } else {
      await renderConversationsListView(container);
      openDirectMessageComposerModal(targetUserId);
    }
  } catch (err) {
    await renderConversationsListView(container);
    openDirectMessageComposerModal(targetUserId);
  }
}

/**
 * ==========================================================================
 * Conversations List View (XenForo / Community Forum Style)
 * ==========================================================================
 */
async function renderConversationsListView(container) {
  container.innerHTML = `
    <div class="dm-page-container container" style="max-width:1160px; margin:28px auto; padding:0 16px;">
      <!-- Breadcrumb -->
      <nav class="dm-breadcrumb">
        <a href="#forms">Home</a>
        <span class="dm-breadcrumb-sep">›</span>
        <span class="dm-breadcrumb-current">Direct messages</span>
      </nav>

      <!-- Page Header -->
      <div class="dm-page-header">
        <div>
          <h1 class="dm-page-title">Direct messages</h1>
          <div class="dm-page-subtitle">Private conversations with authors, writers, and community members</div>
        </div>
        <div class="dm-page-actions">
          <button type="button" class="btn btn-primary dm-start-btn" onclick="openDirectMessageComposerModal()">
            <span>✉️</span>
            <span>Start direct message</span>
          </button>
        </div>
      </div>

      <!-- Controls: Search & Filter Tabs -->
      <div class="dm-controls-bar">
        <div class="dm-filter-tabs">
          <button type="button" class="dm-tab-btn ${currentFilter === 'all' ? 'active' : ''}" 
                  onclick="setDirectMessagesFilter('all')">
            All direct messages
          </button>
          <button type="button" class="dm-tab-btn ${currentFilter === 'unread' ? 'active' : ''}" 
                  onclick="setDirectMessagesFilter('unread')" id="dm-tab-unread">
            Unread
          </button>
        </div>

        <div class="dm-search-wrap">
          <span class="dm-search-glass">🔍</span>
          <input type="text" class="dm-search-field" id="dm-filter-input" 
                 placeholder="Filter direct messages..." 
                 value="${escapeHtml(searchQuery)}" 
                 oninput="filterDirectMessages(this.value)">
          ${searchQuery ? `<button type="button" class="dm-search-clear-btn" onclick="filterDirectMessages('')">✕</button>` : ''}
        </div>
      </div>

      <!-- Conversations Table / Cards Container -->
      <div class="dm-list-container" id="dm-conversations-list-box">
        <div style="text-align:center; padding:48px 16px; color:#64748B;">
          <div style="font-size:28px; margin-bottom:8px;">⏳</div>
          <div>Loading your direct messages...</div>
        </div>
      </div>
    </div>
  `;

  await loadAndRenderConversations();
}

async function loadAndRenderConversations() {
  const box = document.getElementById('dm-conversations-list-box');
  if (!box) return;

  try {
    const res = await chatApi('/api/chat/conversations');
    conversationsList = res?.conversations || [];
    renderConversationsTable(conversationsList);
  } catch (err) {
    if (box) {
      box.innerHTML = `
        <div class="dm-empty-state" style="padding:48px 16px;">
          <div style="font-size:32px; margin-bottom:8px;">⚠️</div>
          <div style="color:#DC2626; font-weight:600;">Failed to load direct messages</div>
          <div style="color:#64748B; font-size:13px; margin-top:4px;">${escapeHtml(err.message)}</div>
          <button class="btn btn-outline btn-sm" onclick="renderDirectMessagesView(document.getElementById('main-content'))" style="margin-top:14px;">
            Retry
          </button>
        </div>
      `;
    }
  }
}

async function refreshConversationsListSilently() {
  try {
    const res = await chatApi('/api/chat/conversations');
    conversationsList = res?.conversations || [];
    const box = document.getElementById('dm-conversations-list-box');
    if (box && !activeConversationId) {
      renderConversationsTable(conversationsList);
    }
  } catch {}
}

export function setDirectMessagesFilter(filter) {
  currentFilter = filter;
  document.querySelectorAll('.dm-tab-btn').forEach(btn => btn.classList.remove('active'));
  if (filter === 'unread') {
    const unreadBtn = document.getElementById('dm-tab-unread');
    if (unreadBtn) unreadBtn.classList.add('active');
  } else {
    const allBtn = document.querySelector('.dm-filter-tabs .dm-tab-btn');
    if (allBtn) allBtn.classList.add('active');
  }
  renderConversationsTable(conversationsList);
}

export function filterDirectMessages(query) {
  searchQuery = query || '';
  const input = document.getElementById('dm-filter-input');
  if (input && input.value !== searchQuery) input.value = searchQuery;
  renderConversationsTable(conversationsList);
}

function renderConversationsTable(list) {
  const box = document.getElementById('dm-conversations-list-box');
  if (!box) return;

  const q = (searchQuery || '').toLowerCase().trim();

  let filtered = (list || []).filter(c => {
    if (!c) return false;
    if (!q) return true;
    const title = (c.title || c.conversationTitle || '').toLowerCase();
    const other = c.otherUser || c.other_user || {};
    const name = (other.displayName || other.display_name || other.username || '').toLowerCase();
    const snippet = (typeof c.lastMessage === 'string' ? c.lastMessage : (c.lastMessage?.content || c.last_message || '')).toLowerCase();
    return title.includes(q) || name.includes(q) || snippet.includes(q);
  });

  if (currentFilter === 'unread') {
    filtered = filtered.filter(c => Number(c?.unreadCount ?? c?.unread_count ?? 0) > 0);
  }

  // Sort by lastMessageAt descending
  filtered.sort((a, b) => {
    const tA = new Date(a.lastMessageAt || a.last_message_at || a.updatedAt || a.updated_at || 0).getTime();
    const tB = new Date(b.lastMessageAt || b.last_message_at || b.updatedAt || b.updated_at || 0).getTime();
    return tB - tA;
  });

  if (filtered.length === 0) {
    box.innerHTML = `
      <div class="dm-empty-state">
        <div style="font-size:46px; margin-bottom:12px;">✉️</div>
        <div style="font-size:18px; font-weight:700; color:#0F172A;">No direct messages found</div>
        <div style="color:#64748B; font-size:14px; margin:6px auto 18px; max-width:380px;">
          ${currentFilter === 'unread' ? 'You have no unread direct messages.' : 'Start a private conversation with authors, writers, or members.'}
        </div>
        <button type="button" class="btn btn-primary dm-start-btn" onclick="openDirectMessageComposerModal()">
          <span>✉️</span>
          <span>Start direct message</span>
        </button>
      </div>
    `;
    return;
  }

  box.innerHTML = `
    <div class="dm-table-card">
      <div class="dm-table-header">
        <div class="dm-col-main">Conversation / Participants</div>
        <div class="dm-col-replies">Replies</div>
        <div class="dm-col-last">Last Message</div>
      </div>
      <div class="dm-table-rows">
        ${filtered.map(c => renderConversationRow(c)).join('')}
      </div>
    </div>
  `;
}

function renderConversationRow(c) {
  const convId = c.id ?? c.conversationId;
  const other = c.otherUser || c.other_user || {};
  const name = escapeHtml(other.displayName || other.display_name || other.username || 'Member');
  const avatar = safeAssetUrl(other.avatar || '/profile.png');
  const role = (other.role || '').toLowerCase();
  const unread = Number(c.unreadCount ?? c.unread_count ?? 0);
  const isLocked = Boolean(c.isLocked || c.is_locked);
  const rawTitle = c.title || c.conversationTitle || '';
  const displayTitle = rawTitle ? escapeHtml(rawTitle) : `Direct message with ${name}`;
  const repliesCount = Number(c.messageCount || c.message_count || 1);

  let roleBadge = '';
  if (role === 'author' || role === 'admin') {
    roleBadge = '<span class="role-badge-sm author">Author</span>';
  } else if (role === 'writer') {
    roleBadge = '<span class="role-badge-sm writer">Writer</span>';
  }

  let snippet = 'Started a conversation';
  let messageType = 'text';
  if (c.lastMessage && typeof c.lastMessage === 'object') {
    snippet = c.lastMessage.content || snippet;
    messageType = c.lastMessage.messageType || c.lastMessage.message_type || 'text';
  } else if (typeof c.last_message === 'string' && c.last_message) {
    snippet = c.last_message;
  } else if (typeof c.lastMessage === 'string' && c.lastMessage) {
    snippet = c.lastMessage;
  }

  let prefix = '';
  if (messageType === 'image') prefix = '📷 Photo: ';
  else if (messageType === 'audio') prefix = '🎙️ Voice note: ';
  else if (messageType === 'file') prefix = '📎 File: ';

  const cleanSnippet = snippet.replace(/<[^>]*>/g, '').trim() || (messageType === 'audio' ? 'Voice note' : 'Message');
  const time = formatChatTime(c.lastMessageAt || c.last_message_at || c.updatedAt || c.updated_at);

  return `
    <div class="dm-row ${unread > 0 ? 'unread' : ''}" onclick="window.location.hash='#messages?id=${convId}'">
      <div class="dm-col-main dm-row-main">
        <div class="dm-avatar-wrap">
          <img src="${avatar}" class="dm-avatar" alt="${name}" onerror="this.src='/profile.png'">
        </div>
        <div class="dm-info">
          <div class="dm-title-line">
            <span class="dm-title-text">${displayTitle}</span>
            ${unread > 0 ? `<span class="dm-unread-dot" title="Unread message"></span>` : ''}
            ${isLocked ? `<span class="dm-lock-icon" title="Locked conversation">🔒</span>` : ''}
          </div>
          <div class="dm-meta-line">
            <span>with <strong>${name}</strong></span>
            ${roleBadge}
          </div>
        </div>
      </div>

      <div class="dm-col-replies dm-row-replies">
        <span class="dm-replies-badge">${repliesCount}</span>
      </div>

      <div class="dm-col-last dm-row-last">
        <div class="dm-last-snippet">${prefix}${escapeHtml(cleanSnippet)}</div>
        <div class="dm-last-time">${time}</div>
      </div>
    </div>
  `;
}

/**
 * ==========================================================================
 * Active Conversation Thread View (XenForo Modern Forum Layout)
 * ==========================================================================
 */
export async function selectDirectMessageConversation(conversationId, container = null) {
  if (!conversationId) return;
  activeConversationId = Number(conversationId);
  stopActiveConversationPoller();

  const main = container || document.getElementById('main-content');
  if (!main) return;

  main.innerHTML = `
    <div class="dm-page-container container" style="max-width:1160px; margin:28px auto; padding:0 16px;">
      <!-- Breadcrumb -->
      <nav class="dm-breadcrumb">
        <a href="#forms">Home</a>
        <span class="dm-breadcrumb-sep">›</span>
        <a href="#messages" onclick="window.location.hash='#messages'; return false;">Direct messages</a>
        <span class="dm-breadcrumb-sep">›</span>
        <span class="dm-breadcrumb-current" id="dm-breadcrumb-title">Loading...</span>
      </nav>

      <div style="text-align:center; padding:60px 16px; color:#64748B;">
        <div style="font-size:32px; margin-bottom:10px;">⏳</div>
        <div>Loading direct message conversation...</div>
      </div>
    </div>
  `;

  try {
    const data = await chatApi(`/api/chat/conversations/${conversationId}`);
    if (!data || !data.success) {
      throw new Error(data?.error || 'Failed to open conversation.');
    }
    activeConversationData = data;
    renderActiveConversationThread(main, data);
    startActiveConversationPoller(Number(conversationId));
    updateUnreadMessageBadge();
  } catch (err) {
    main.innerHTML = `
      <div class="dm-page-container container" style="max-width:960px; margin:40px auto; padding:0 16px;">
        <div class="dm-empty-state" style="background:#FFFFFF; border:1px solid #E2E8F0; border-radius:12px; padding:60px 24px; text-align:center;">
          <div style="font-size:42px; margin-bottom:12px;">⚠️</div>
          <h2 style="font-size:20px; font-weight:700; color:#0F172A; margin:0 0 8px;">Conversation Not Available</h2>
          <p style="color:#64748B; font-size:14px; margin:0 auto 20px;">${escapeHtml(err.message)}</p>
          <button type="button" class="btn btn-outline" onclick="window.location.hash='#messages'">
            ← Back to Direct messages
          </button>
        </div>
      </div>
    `;
  }
}

function renderActiveConversationThread(container, data) {
  const conv = data.conversation || {};
  const messages = Array.isArray(data.messages) ? data.messages : (Array.isArray(conv.messages) ? conv.messages : []);
  const other = data.otherUser || data.other_user || conv.otherUser || conv.other_user || {};
  const participants = Array.isArray(data.participants) ? data.participants : (Array.isArray(conv.participants) ? conv.participants : []);
  const isConvLocked = Boolean(data.isLocked || data.is_locked || conv.isLocked || conv.is_locked);
  const allowInvite = Boolean(data.allowInvite ?? conv.allowInvite ?? data.allow_invite ?? conv.allow_invite ?? true);
  const rawTitle = data.conversationTitle || conv.conversationTitle || data.title || conv.title || '';
  const otherName = escapeHtml(other.displayName || other.display_name || other.username || 'Member');
  const threadTitle = rawTitle ? escapeHtml(rawTitle) : `Direct message with ${otherName}`;

  const currentRole = (window.CURRENT_USER?.role || '').toLowerCase();
  const isAdmin = currentRole === 'admin' || Boolean(window.CURRENT_USER?.isAdmin || window.CURRENT_USER?.is_admin);
  const canLock = isAdmin || currentRole === 'author';

  // Participants meta tags
  const participantsChips = (participants.length > 0 ? participants : [other]).map(p => {
    const pName = escapeHtml(p.displayName || p.display_name || p.username || 'User');
    const pRole = (p.role || '').toLowerCase();
    let badge = '';
    if (pRole === 'author' || pRole === 'admin') badge = '<span class="role-badge-sm author">Author</span>';
    else if (pRole === 'writer') badge = '<span class="role-badge-sm writer">Writer</span>';
    return `
      <span class="dm-participant-pill" onclick="navigateToUserProfile('${encodeURIComponent(p.username || p.id)}')">
        <span>${pName}</span>
        ${badge}
      </span>
    `;
  }).join('');

  container.innerHTML = `
    <div class="dm-page-container container" style="max-width:1160px; margin:28px auto; padding:0 16px;">
      <!-- Breadcrumb -->
      <nav class="dm-breadcrumb">
        <a href="#forms">Home</a>
        <span class="dm-breadcrumb-sep">›</span>
        <a href="#messages" onclick="window.location.hash='#messages'; return false;">Direct messages</a>
        <span class="dm-breadcrumb-sep">›</span>
        <span class="dm-breadcrumb-current">${threadTitle}</span>
      </nav>

      <!-- Thread Header -->
      <div class="dm-thread-header-card">
        <div class="dm-thread-header-left">
          <button type="button" class="dm-back-link" onclick="window.location.hash='#messages'" title="Back to all direct messages">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            <span>All Direct Messages</span>
          </button>
          <h1 class="dm-thread-headline">${threadTitle}</h1>
          <div class="dm-participants-row">
            <span style="font-size:12.5px; color:#64748B; font-weight:600;">Participants:</span>
            <div class="dm-participants-list">${participantsChips}</div>
          </div>
        </div>

        <div class="dm-thread-header-right">
          ${allowInvite ? `
            <button type="button" class="btn btn-outline btn-sm" onclick="openInviteModal(${activeConversationId})" title="Invite users">
              <span>➕</span>
              <span>Invite</span>
            </button>
          ` : ''}

          ${canLock ? `
            <button type="button" class="btn btn-outline btn-sm ${isConvLocked ? 'btn-danger' : ''}" 
                    onclick="toggleConversationLockUi(${activeConversationId}, ${isConvLocked ? 'false' : 'true'})" 
                    title="${isConvLocked ? 'Unlock direct message' : 'Lock direct message'}">
              ${isConvLocked ? '🔓 Unlock conversation' : '🔒 Lock conversation'}
            </button>
          ` : ''}

          <button type="button" class="btn btn-outline btn-sm btn-danger" 
                  onclick="deleteConversationUi(${activeConversationId})" title="Delete conversation">
            🗑️ Leave / Delete
          </button>
        </div>
      </div>

      <!-- Lock Notice Banner -->
      ${isConvLocked ? `
        <div class="dm-notice-banner danger">
          <span>🔒</span>
          <span>This direct message conversation is locked. No further responses will be allowed.</span>
        </div>
      ` : ''}

      <!-- Message Stream (Forum Posts Style) -->
      <div class="dm-stream" id="dm-messages-stream">
        ${messages.map(m => renderPostCard(m)).join('')}
      </div>

      <!-- Reply Composer Box (Matching Exact Reference Toolbar) -->
      ${!isConvLocked ? `
        <div class="dm-reply-card" id="dm-reply-composer-wrap">
          <div class="dm-reply-title">
            <span>💬</span>
            <span>Direct message reply</span>
          </div>

          <div class="dm-editor-wrapper">
            <!-- Reference Rich-Text Toolbar -->
            <div class="dm-toolbar">
              <div class="dm-toolbar-left">
                <button type="button" class="dm-toolbar-btn" onclick="formatDmText('removeFormat')" title="Clear Formatting">&amp;</button>
                <button type="button" class="dm-toolbar-btn" onclick="formatDmText('bold')" title="Bold"><b>B</b></button>
                <button type="button" class="dm-toolbar-btn" onclick="formatDmText('italic')" title="Italic"><i>I</i></button>
                <button type="button" class="dm-toolbar-btn" onclick="formatDmText('underline')" title="Underline"><u>U</u></button>
                <div class="dm-toolbar-separator"></div>
                <button type="button" class="dm-toolbar-btn" onclick="formatDmText('insertUnorderedList')" title="Bulleted List">•≡</button>
                <button type="button" class="dm-toolbar-btn" onclick="formatDmText('insertOrderedList')" title="Numbered List">1.≡</button>
                <div class="dm-toolbar-separator"></div>
                <button type="button" class="dm-toolbar-btn" onclick="openDmLinkDialog()" title="Insert Link">🔗</button>
                <button type="button" class="dm-toolbar-btn" onclick="triggerDmImageUpload()" title="Attach Photo / Image">🖼️</button>
                <button type="button" class="dm-toolbar-btn" onclick="toggleDmVoiceStudio()" title="Record Voice Message with Review">🎙️</button>
                <button type="button" class="dm-toolbar-btn" onclick="triggerDmFileUpload()" title="Attach File">📎</button>
                <button type="button" class="dm-toolbar-btn" onclick="toggleDmEmojiPicker(event)" title="Insert Emoji">😊</button>
              </div>
              <div class="dm-toolbar-right">
                <button type="button" class="dm-toolbar-btn" onclick="formatDmText('undo')" title="Undo">↺</button>
                <button type="button" class="dm-toolbar-btn" onclick="formatDmText('redo')" title="Redo">↻</button>
                <button type="button" class="dm-toolbar-btn preview-btn" id="dm-reply-preview-btn" onclick="toggleDmReplyPreview()" title="Preview rendered text">👁 Preview</button>
              </div>
            </div>

            <!-- Content Area (Editable Rich Text) -->
            <div id="dm-editor-content" class="dm-editor-content" contenteditable="true" 
                 data-placeholder="Write your direct message reply here..." 
                 style="min-height:110px; max-height:260px;" 
                 onkeydown="handleReplyEditorKeydown(event)"></div>
            <div id="dm-editor-preview" class="dm-editor-preview" style="display:none; min-height:110px; max-height:260px;"></div>

            <!-- Voice Recording Studio Container -->
            <div id="dm-voice-studio" class="dm-voice-studio" style="display:none;"></div>

            <!-- Attachments Strip (Image & File Preview) -->
            <div id="dm-attachments-strip" class="dm-attachments-strip" style="display:none;"></div>

            <!-- Hidden file inputs -->
            <input type="file" id="dm-image-file-input" accept="image/jpeg,image/png,image/webp,image/gif" style="display:none;" onchange="handleDmImageSelect(event)">
            <input type="file" id="dm-general-file-input" accept=".pdf,.doc,.docx,.txt,.zip,.rar,image/*,audio/*" style="display:none;" onchange="handleDmFileSelect(event)">
          </div>

          <!-- Bottom Action Row: Send Button (Green matching reference) -->
          <div style="display:flex; justify-content:flex-end; align-items:center; margin-top:12px;">
            <button type="button" class="dm-submit-btn" id="dm-reply-send-btn" onclick="sendDirectMessageReply()" style="width:auto; padding:11px 26px; font-size:14.5px;">
              💬 Send direct message
            </button>
          </div>
        </div>
      ` : `
        <div class="dm-notice-banner warning" style="margin-top:20px;">
          This direct message is locked. Responses are disabled.
        </div>
      `}
    </div>
  `;

  dmAttachedImage = null;
  dmAttachedFile = null;
  resetDmVoiceState();
  updateDmAttachmentsStrip();
  updateDmVoiceStudioUi();
  scrollMessagesToBottom();

  const dmEditor = document.getElementById('dm-editor-content');
  if (dmEditor && typeof window.setupSmartEditor === 'function') {
    window.setupSmartEditor(dmEditor);
  }
  if (typeof window.hydrateLinkPreviewCards === 'function') {
    window.hydrateLinkPreviewCards(document.getElementById('dm-messages-stream'));
  }
}

/**
 * Render Post Card for a Single Message
 */
function renderPostCard(msg) {
  if (!msg) return '';
  const msgId = msg.id || '';
  const currentUserId = window.CURRENT_USER?.id;
  const sender = msg.sender || {};
  const senderId = msg.senderId ?? msg.sender_id ?? sender.id;
  const isMe = Boolean(
    msg.isMe ||
    msg.is_me ||
    (currentUserId && Number(senderId) === Number(currentUserId))
  );

  const name = escapeHtml(msg.senderName || msg.sender_name || sender.displayName || sender.display_name || sender.username || (isMe ? 'You' : 'Member'));
  const avatar = safeAssetUrl(msg.senderAvatar || msg.sender_avatar || sender.avatar || (isMe ? window.CURRENT_USER?.avatar : '/profile.png') || '/profile.png');
  const role = ((sender.role || (isMe ? window.CURRENT_USER?.role : '')) || '').toLowerCase();
  const time = formatChatTime(msg.createdAt || msg.created_at || Date.now());

  let roleBadge = '';
  if (role === 'author' || role === 'admin') {
    roleBadge = '<span class="role-badge-sm author">Author</span>';
  } else if (role === 'writer') {
    roleBadge = '<span class="role-badge-sm writer">Writer</span>';
  }

  const msgType = msg.messageType || msg.message_type || 'text';
  const attachUrl = safeAssetUrl(msg.attachmentUrl || msg.attachment_url);

  let bodyHtml = '';
  if (msg.isDeleted || msg.is_deleted) {
    bodyHtml = `<div style="color:#94A3B8; font-style:italic;">🚫 This message was deleted</div>`;
  } else {
    // Rich content
    if (msg.content) {
      bodyHtml += `<div class="dm-post-html" id="dm-post-content-${msgId}" data-raw-content="${(typeof escapeQuote === 'function' ? escapeQuote(msg.content) : String(msg.content).replace(/"/g, '&quot;'))}">${renderSafeMessageContent(msg.content)}</div>`;
    }

    // Image attachment
    if (msgType === 'image' && attachUrl) {
      bodyHtml += `
        <div class="dm-post-image-wrap" onclick="openChatImageLightbox('${escapeHtml(attachUrl)}')">
          <img src="${escapeHtml(attachUrl)}" class="dm-post-image" alt="Attached photo" loading="lazy">
        </div>
      `;
    }

    // Audio voice message
    if (msgType === 'audio' && attachUrl) {
      const meta = msg.attachmentMeta || msg.attachment_meta || {};
      const durationSec = meta.duration ? Math.round(meta.duration) : 0;
      const mins = Math.floor(durationSec / 60);
      const secs = String(durationSec % 60).padStart(2, '0');

      bodyHtml += `
        <div class="dm-post-voice-player">
          <button type="button" class="dm-voice-play-toggle" onclick="toggleVoicePlay(${msgId}, '${escapeHtml(attachUrl)}', this)">▶</button>
          <div style="flex:1; display:flex; flex-direction:column; gap:3px;">
            <div class="dm-voice-scrubber-track" onclick="seekVoiceAudio(event, '${escapeHtml(attachUrl)}')">
              <div class="dm-voice-progress-fill" id="dm-voice-fill-${msgId}"></div>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:11.5px; color:#64748B;">
              <span>🎙️ Voice Message</span>
              <span id="dm-voice-time-${msgId}">${mins}:${secs}</span>
            </div>
          </div>
        </div>
      `;
    }

    // Document file attachment
    if (msgType === 'file' && attachUrl) {
      const meta = msg.attachmentMeta || msg.attachment_meta || {};
      const fileName = escapeHtml(meta.name || 'Download Attachment');
      const fileSize = meta.size ? `(${Math.round(meta.size / 1024)} KB)` : '';

      bodyHtml += `
        <a href="${escapeHtml(attachUrl)}" download target="_blank" rel="noopener noreferrer" class="dm-post-file-box">
          <span style="font-size:22px;">📎</span>
          <div style="flex:1;">
            <div style="font-weight:600; font-size:13.5px; color:#0F172A;">${fileName}</div>
            <div style="font-size:11.5px; color:#64748B;">Document file ${fileSize}</div>
          </div>
          <span style="font-size:12.5px; font-weight:600; color:#22C55E;">Download ↓</span>
        </a>
      `;
    }
  }

  const isAdmin = (window.CURRENT_USER?.role || '').toLowerCase() === 'admin' || Boolean(window.CURRENT_USER?.isAdmin || window.CURRENT_USER?.is_admin);
  const canDelete = isMe || isAdmin;
  const canEdit = isMe && !msg.isDeleted && !msg.is_deleted && msgType === 'text';

  return `
    <div class="dm-post-card" id="dm-msg-card-${msgId}">
      <!-- Left Column: Author Info -->
      <div class="dm-post-author-col">
        <img src="${avatar}" class="dm-post-author-avatar" alt="${name}" onerror="this.src='/profile.png'">
        <div class="dm-post-author-name">${name}</div>
        ${roleBadge}
      </div>

      <!-- Right Column: Message Content & Timestamp -->
      <div class="dm-post-body-col">
        <div class="dm-post-header-line">
          <span class="dm-post-timestamp">${time}</span>
          ${msg.isEdited || msg.is_edited ? '<span class="dm-post-edited-tag">(edited)</span>' : ''}

          ${(canEdit || canDelete) ? `
            <div class="dm-post-actions-wrap">
              ${canEdit ? `
                <button type="button" class="dm-action-link" onclick="startEditChatMessage(${msgId})" title="Edit message">✏️ Edit</button>
              ` : ''}
              ${canDelete ? `
                <button type="button" class="dm-action-link danger" onclick="unsendChatMessage(${msgId})" title="Delete message">🗑️ Delete</button>
              ` : ''}
            </div>
          ` : ''}
        </div>

        <div class="dm-post-body-content">
          ${bodyHtml}
        </div>
      </div>
    </div>
  `;
}

function renderSafeMessageContent(html) {
  if (!html) return '';
  let safe = html;
  if (!/<[a-z][\s\S]*>/i.test(safe)) {
    safe = escapeHtml(safe).replace(/\n/g, '<br>');
  } else {
    safe = String(safe)
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
  }

  // Format mentions and safe links
  if (typeof window.formatRichContent === 'function') {
    safe = window.formatRichContent(safe);
  }

  // In-app embeds (YouTube, Vimeo, website cards)
  const urlRegex = /(https?:\/\/[^\s<]+|www\.[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+[^\s<]*)/;
  const match = String(html).match(urlRegex);
  if (match && typeof window.parseSmartUrl === 'function' && typeof window.renderSmartEmbed === 'function') {
    const embedInfo = window.parseSmartUrl(match[0]);
    if (embedInfo) {
      safe += `<div style="margin-top:8px;">${window.renderSmartEmbed(embedInfo, 'dm-msg')}</div>`;
    }
  }

  return safe;
}

export function backToDirectMessagesList() {
  activeConversationId = null;
  activeConversationData = null;
  stopActiveConversationPoller();
  window.location.hash = '#messages';
}

function scrollMessagesToBottom() {
  setTimeout(() => {
    const stream = document.getElementById('dm-messages-stream');
    if (stream) stream.scrollTop = stream.scrollHeight;
  }, 60);
}

/**
 * ==========================================================================
 * Sending Reply in Active Conversation
 * ==========================================================================
 */
export async function sendDirectMessageReply() {
  if (!activeConversationId) return;

  const editor = document.getElementById('dm-editor-content');
  const sendBtn = document.getElementById('dm-reply-send-btn');

  const rawHtml = editor ? editor.innerHTML.trim() : '';
  const cleanContent = rawHtml === '<br>' || rawHtml === '<p><br></p>' ? '' : rawHtml;

  const hasVoice = Boolean(dmVoiceState.audioBlob);
  const hasImage = Boolean(dmAttachedImage);
  const hasFile = Boolean(dmAttachedFile);
  const hasText = Boolean(cleanContent);

  if (!hasText && !hasVoice && !hasImage && !hasFile) {
    showToast('Please type a reply, record voice, or attach an image.');
    if (editor) editor.focus();
    return;
  }

  if (sendBtn) {
    sendBtn.disabled = true;
    sendBtn.innerHTML = '⏳ Sending reply...';
  }

  try {
    let attachmentUrl = null;
    let attachmentMeta = null;
    let messageType = 'text';

    if (hasVoice) {
      const reader = new FileReader();
      const base64Audio = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(dmVoiceState.audioBlob);
      });

      const upRes = await chatApi('/api/chat/upload', {
        method: 'POST',
        body: JSON.stringify({
          file: base64Audio,
          fileType: 'audio',
          meta: { duration: dmVoiceState.audioDuration }
        })
      });

      if (!upRes?.url) throw new Error(upRes?.error || 'Failed to upload voice note');
      attachmentUrl = upRes.url;
      attachmentMeta = { duration: dmVoiceState.audioDuration };
      messageType = 'audio';
    } else if (hasImage) {
      const upRes = await chatApi('/api/chat/upload', {
        method: 'POST',
        body: JSON.stringify({
          file: dmAttachedImage.dataUrl,
          fileType: 'image'
        })
      });
      if (!upRes?.url) throw new Error(upRes?.error || 'Failed to upload image');
      attachmentUrl = upRes.url;
      messageType = 'image';
    } else if (hasFile) {
      const upRes = await chatApi('/api/chat/upload', {
        method: 'POST',
        body: JSON.stringify({
          file: dmAttachedFile.dataUrl,
          fileType: 'file',
          meta: { name: dmAttachedFile.name, size: dmAttachedFile.size }
        })
      });
      if (!upRes?.url) throw new Error(upRes?.error || 'Failed to upload file');
      attachmentUrl = upRes.url;
      attachmentMeta = { name: dmAttachedFile.name, size: dmAttachedFile.size };
      messageType = 'file';
    }

    const res = await chatApi(`/api/chat/conversations/${activeConversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        content: cleanContent,
        messageType: messageType,
        attachmentUrl: attachmentUrl,
        attachmentMeta: attachmentMeta
      })
    });

    if (res && res.success && res.message) {
      // Clear composer state
      if (editor) editor.innerHTML = '';
      dmAttachedImage = null;
      dmAttachedFile = null;
      resetDmVoiceState();
      updateDmAttachmentsStrip();
      updateDmVoiceStudioUi();

      appendPostCard(res.message);
      scrollMessagesToBottom();
      showToast('Reply sent ✨');
    } else {
      throw new Error(res?.error || 'Failed to send reply');
    }
  } catch (err) {
    console.error('[Send Reply Error]:', err);
    showToast(err.message || 'Failed to send reply');
  } finally {
    if (sendBtn) {
      sendBtn.disabled = false;
      sendBtn.innerHTML = '💬 Send direct message';
    }
  }
}

function appendPostCard(msg) {
  const stream = document.getElementById('dm-messages-stream');
  if (!stream || !msg) return;

  const existing = document.getElementById(`dm-msg-card-${msg.id}`);
  if (existing) return;

  const cardHtml = renderPostCard(msg);
  stream.insertAdjacentHTML('beforeend', cardHtml);
  scrollMessagesToBottom();
}

window.handleReplyEditorKeydown = function(e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    sendDirectMessageReply();
  }
};

/**
 * ==========================================================================
 * Start Direct Message Composer Modal (Exact Reference UI / UX Match)
 * ==========================================================================
 */
export function openDirectMessageComposerModal(prefillUserId = null) {
  if (!window.IS_LOGGED_IN) {
    if (typeof window.openAuthModal === 'function') {
      window.openAuthModal('login');
      showToast('Please sign in to start a direct message.');
    }
    return;
  }

  let modal = document.getElementById('dm-composer-modal');
  let body = document.getElementById('dm-composer-modal-body');

  if (!modal || !body) {
    console.warn('[DM Modal] Missing modal root in DOM, rendering directly');
    return;
  }

  dmSelectedRecipients = [];
  dmAttachedImage = null;
  dmAttachedFile = null;
  resetDmVoiceState();

  body.innerHTML = `
    <!-- Recipients -->
    <div class="dm-field-group">
      <label class="dm-field-label">Recipients:</label>
      <div class="dm-recipients-box" onclick="focusDmRecipientsInput()">
        <div id="dm-chips-container" style="display:flex; flex-wrap:wrap; gap:6px;"></div>
        <input type="text" id="dm-recipients-input" class="dm-recipients-input" 
               placeholder="Type a username..." 
               autocomplete="off"
               oninput="handleDmRecipientsInput(this.value)" 
               onkeydown="handleDmRecipientsKeydown(event)">
      </div>
      <div class="dm-field-hint">You may enter multiple names here.</div>
      <div id="dm-recipients-dropdown" class="dm-dropdown" style="display:none;"></div>
    </div>

    <!-- Title -->
    <div class="dm-field-group">
      <input type="text" id="dm-title-input" class="dm-title-input" placeholder="Title...">
    </div>

    <!-- Rich-Text Editor -->
    <div class="dm-editor-wrapper">
      <!-- Reference Toolbar -->
      <div class="dm-toolbar">
        <div class="dm-toolbar-left">
          <button type="button" class="dm-toolbar-btn" onclick="formatDmText('removeFormat')" title="Clear Formatting">&amp;</button>
          <button type="button" class="dm-toolbar-btn" onclick="formatDmText('bold')" title="Bold"><b>B</b></button>
          <button type="button" class="dm-toolbar-btn" onclick="formatDmText('italic')" title="Italic"><i>I</i></button>
          <button type="button" class="dm-toolbar-btn" onclick="formatDmText('underline')" title="Underline"><u>U</u></button>
          <div class="dm-toolbar-separator"></div>
          <button type="button" class="dm-toolbar-btn" onclick="formatDmText('insertUnorderedList')" title="Bulleted List">•≡</button>
          <button type="button" class="dm-toolbar-btn" onclick="formatDmText('insertOrderedList')" title="Numbered List">1.≡</button>
          <div class="dm-toolbar-separator"></div>
          <button type="button" class="dm-toolbar-btn" onclick="openDmLinkDialog()" title="Insert Link">🔗</button>
          <button type="button" class="dm-toolbar-btn" onclick="triggerDmImageUpload()" title="Attach Photo / Image">🖼️</button>
          <button type="button" class="dm-toolbar-btn" onclick="toggleDmVoiceStudio()" title="Record Voice Message with Review">🎙️</button>
          <button type="button" class="dm-toolbar-btn" onclick="triggerDmFileUpload()" title="Attach File">📎</button>
          <button type="button" class="dm-toolbar-btn" onclick="toggleDmEmojiPicker(event)" title="Insert Emoji">😊</button>
        </div>
        <div class="dm-toolbar-right">
          <button type="button" class="dm-toolbar-btn" onclick="formatDmText('undo')" title="Undo">↺</button>
          <button type="button" class="dm-toolbar-btn" onclick="formatDmText('redo')" title="Redo">↻</button>
          <button type="button" class="dm-toolbar-btn preview-btn" id="dm-preview-toggle-btn" onclick="toggleDmPreview()" title="Preview rendered text">👁 Preview</button>
        </div>
      </div>

      <!-- Content Area -->
      <div id="dm-editor-content" class="dm-editor-content" contenteditable="true" 
           data-placeholder="Write your direct message here..." 
           style="min-height:180px; max-height:320px;"></div>
      <div id="dm-editor-preview" class="dm-editor-preview" style="display:none; min-height:180px; max-height:320px;"></div>

      <!-- Voice Studio -->
      <div id="dm-voice-studio" class="dm-voice-studio" style="display:none;"></div>

      <!-- Attachments Strip -->
      <div id="dm-attachments-strip" class="dm-attachments-strip" style="display:none;"></div>

      <!-- Hidden inputs -->
      <input type="file" id="dm-image-file-input" accept="image/jpeg,image/png,image/webp,image/gif" style="display:none;" onchange="handleDmImageSelect(event)">
      <input type="file" id="dm-general-file-input" accept=".pdf,.doc,.docx,.txt,.zip,.rar,image/*,audio/*" style="display:none;" onchange="handleDmFileSelect(event)">
    </div>

    <!-- Checkbox Options -->
    <div class="dm-bottom-options">
      <label class="dm-checkbox-row">
        <input type="checkbox" id="dm-allow-invite" checked>
        <span>Allow anyone in this direct message to invite others</span>
      </label>
      <label class="dm-checkbox-row">
        <input type="checkbox" id="dm-is-locked">
        <span>Lock direct message (no responses will be allowed)</span>
      </label>
    </div>

    <!-- Submit Button (Green matching reference) -->
    <div style="margin-top:10px;">
      <button type="button" class="dm-submit-btn" id="dm-submit-btn" onclick="submitDirectMessage()">
        Send direct message
      </button>
    </div>
  `;

  modal.classList.add('open');

  // If a prefill user was requested
  if (prefillUserId) {
    chatApi(`/api/chat/users?search=${encodeURIComponent(prefillUserId)}`).then(res => {
      const match = (res?.users || []).find(u => Number(u.id) === Number(prefillUserId)) || res?.users?.[0];
      if (match) {
        addDmRecipient(match);
      }
    }).catch(() => {});
  } else {
    focusDmRecipientsInput();
  }
}

export function closeDirectMessageComposerModal() {
  const modal = document.getElementById('dm-composer-modal');
  if (modal) modal.classList.remove('open');
  resetDmVoiceState();
  dmAttachedImage = null;
  dmAttachedFile = null;
  dmSelectedRecipients = [];
}

export async function submitDirectMessage() {
  const submitBtn = document.getElementById('dm-submit-btn');
  const titleInput = document.getElementById('dm-title-input');
  const editor = document.getElementById('dm-editor-content');
  const allowInviteCb = document.getElementById('dm-allow-invite');
  const isLockedCb = document.getElementById('dm-is-locked');

  // Check unresolved input text
  const inputEl = document.getElementById('dm-recipients-input');
  if (inputEl && inputEl.value.trim() && dmSelectedRecipients.length === 0) {
    try {
      const res = await chatApi(`/api/chat/users?search=${encodeURIComponent(inputEl.value.trim())}`);
      if (res?.users?.[0]) addDmRecipient(res.users[0]);
    } catch {}
  }

  if (dmSelectedRecipients.length === 0) {
    showToast('Please specify at least one recipient.');
    focusDmRecipientsInput();
    return;
  }

  const title = titleInput ? titleInput.value.trim() : '';
  const rawHtml = editor ? editor.innerHTML.trim() : '';
  const cleanContent = rawHtml === '<br>' || rawHtml === '<p><br></p>' ? '' : rawHtml;
  const allowInvite = allowInviteCb ? allowInviteCb.checked : true;
  const isLocked = isLockedCb ? isLockedCb.checked : false;

  const hasVoice = Boolean(dmVoiceState.audioBlob);
  const hasImage = Boolean(dmAttachedImage);
  const hasFile = Boolean(dmAttachedFile);
  const hasText = Boolean(cleanContent);

  if (!hasText && !hasVoice && !hasImage && !hasFile) {
    showToast('Please write a message, record voice, or attach an image/file.');
    if (editor) editor.focus();
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '⏳ Sending direct message...';
  }

  try {
    let attachmentUrl = null;
    let attachmentMeta = null;
    let messageType = 'text';

    if (hasVoice) {
      const reader = new FileReader();
      const base64Audio = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(dmVoiceState.audioBlob);
      });

      const upRes = await chatApi('/api/chat/upload', {
        method: 'POST',
        body: JSON.stringify({
          file: base64Audio,
          fileType: 'audio',
          meta: { duration: dmVoiceState.audioDuration }
        })
      });

      if (!upRes?.url) throw new Error(upRes?.error || 'Failed to upload voice message');
      attachmentUrl = upRes.url;
      attachmentMeta = { duration: dmVoiceState.audioDuration };
      messageType = 'audio';
    } else if (hasImage) {
      const upRes = await chatApi('/api/chat/upload', {
        method: 'POST',
        body: JSON.stringify({
          file: dmAttachedImage.dataUrl,
          fileType: 'image'
        })
      });
      if (!upRes?.url) throw new Error(upRes?.error || 'Failed to upload image');
      attachmentUrl = upRes.url;
      messageType = 'image';
    } else if (hasFile) {
      const upRes = await chatApi('/api/chat/upload', {
        method: 'POST',
        body: JSON.stringify({
          file: dmAttachedFile.dataUrl,
          fileType: 'file',
          meta: { name: dmAttachedFile.name, size: dmAttachedFile.size }
        })
      });
      if (!upRes?.url) throw new Error(upRes?.error || 'Failed to upload file');
      attachmentUrl = upRes.url;
      attachmentMeta = { name: dmAttachedFile.name, size: dmAttachedFile.size };
      messageType = 'file';
    }

    const payload = {
      recipients: dmSelectedRecipients.map(r => r.id),
      title: title,
      content: cleanContent,
      messageType: messageType,
      attachmentUrl: attachmentUrl,
      attachmentMeta: attachmentMeta,
      allowInvite: allowInvite,
      isLocked: isLocked
    };

    const convRes = await chatApi('/api/chat/conversations', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    if (!convRes || !convRes.success) {
      throw new Error(convRes?.error || 'Failed to send direct message');
    }

    const convId = convRes.conversationId || convRes.conversation?.id || convRes.id;
    closeDirectMessageComposerModal();
    showToast('Direct message sent successfully! ✨');

    if (convId) {
      window.location.hash = `#messages?id=${convId}`;
    } else {
      window.location.hash = '#messages';
    }
  } catch (err) {
    console.error('[Send DM Error]:', err);
    showToast(err.message || 'Failed to send direct message');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Send direct message';
    }
  }
}

/**
 * Open Direct Chat with User (from Profile or Directory)
 */
export async function openDirectChatWithUser(targetUserId) {
  if (!window.IS_LOGGED_IN) {
    if (typeof window.openAuthModal === 'function') {
      window.openAuthModal('login');
      showToast('Please sign in to send direct messages.');
    }
    return;
  }

  try {
    const res = await chatApi('/api/chat/conversations', {
      method: 'POST',
      body: JSON.stringify({ targetUserId: Number(targetUserId) })
    });
    const convId = res?.conversationId || res?.conversation?.id || res?.id;
    if (convId) {
      window.location.hash = `#messages?id=${convId}`;
    } else {
      openDirectMessageComposerModal(targetUserId);
    }
  } catch (err) {
    openDirectMessageComposerModal(targetUserId);
  }
}

/**
 * ==========================================================================
 * Recipients Input & Autocomplete
 * ==========================================================================
 */
export function focusDmRecipientsInput() {
  const input = document.getElementById('dm-recipients-input');
  if (input) input.focus();
}

function renderDmRecipientsChips() {
  const container = document.getElementById('dm-chips-container');
  if (!container) return;

  container.innerHTML = dmSelectedRecipients.map(u => {
    const isAuthor = (u.role || '').toLowerCase() === 'author' || (u.role || '').toLowerCase() === 'admin';
    return `
      <span class="dm-chip ${isAuthor ? 'author-chip' : ''}">
        <span>@${escapeHtml(u.username)}</span>
        <button type="button" class="dm-chip-remove" onclick="removeDmRecipient(${u.id})" title="Remove recipient">✕</button>
      </span>
    `;
  }).join('');
}

export function addDmRecipient(user) {
  if (!user || !user.id) return;
  const existing = dmSelectedRecipients.some(r => Number(r.id) === Number(user.id));
  if (!existing) {
    dmSelectedRecipients.push({
      id: Number(user.id),
      username: user.username,
      displayName: user.display_name || user.displayName || user.username,
      role: user.role || 'reader'
    });
    renderDmRecipientsChips();
  }

  const input = document.getElementById('dm-recipients-input');
  if (input) input.value = '';
  const dropdown = document.getElementById('dm-recipients-dropdown');
  if (dropdown) dropdown.style.display = 'none';
  focusDmRecipientsInput();
}

export function removeDmRecipient(userId) {
  dmSelectedRecipients = dmSelectedRecipients.filter(r => Number(r.id) !== Number(userId));
  renderDmRecipientsChips();
  focusDmRecipientsInput();
}

export function handleDmRecipientsInput(query) {
  const dropdown = document.getElementById('dm-recipients-dropdown');
  if (!dropdown) return;

  if (dmRecipientsSearchTimer) clearTimeout(dmRecipientsSearchTimer);
  const cleanQ = (query || '').trim();

  if (!cleanQ) {
    dropdown.style.display = 'none';
    dropdown.innerHTML = '';
    return;
  }

  dmRecipientsSearchTimer = setTimeout(async () => {
    dropdown.style.display = 'block';
    dropdown.innerHTML = `<div style="padding:10px; font-size:12.5px; color:#64748B; text-align:center;">Searching...</div>`;

    try {
      const res = await chatApi(`/api/chat/users?search=${encodeURIComponent(cleanQ)}`);
      const users = res?.users || [];

      if (users.length === 0) {
        dropdown.innerHTML = `<div style="padding:10px; font-size:12.5px; color:#64748B; text-align:center;">No matching members found</div>`;
        return;
      }

      dropdown.innerHTML = users.map(u => {
        const name = escapeHtml(u.display_name || u.username);
        const avatar = safeAssetUrl(u.avatar || '/profile.png');
        const role = (u.role || '').toLowerCase();
        let roleBadge = '';
        if (role === 'author' || role === 'admin') {
          roleBadge = '<span class="role-badge-sm author" style="margin-left:4px;">Author</span>';
        } else if (role === 'writer') {
          roleBadge = '<span class="role-badge-sm writer" style="margin-left:4px;">Writer</span>';
        }

        const userJson = JSON.stringify({
          id: u.id,
          username: u.username,
          display_name: u.display_name || u.username,
          role: u.role
        }).replace(/"/g, '&quot;');

        return `
          <div class="dm-dropdown-item" onclick="addDmRecipient(${userJson})">
            <img src="${avatar}" class="dm-dropdown-avatar" alt="${name}" onerror="this.src='/profile.png'">
            <div>
              <div class="dm-dropdown-name">${name} ${roleBadge}</div>
              <div class="dm-dropdown-handle">@${escapeHtml(u.username)}</div>
            </div>
          </div>
        `;
      }).join('');
    } catch (err) {
      dropdown.innerHTML = `<div style="padding:10px; font-size:12.5px; color:#DC2626; text-align:center;">Search failed</div>`;
    }
  }, 180);
}

export function handleDmRecipientsKeydown(e) {
  const input = document.getElementById('dm-recipients-input');
  if (!input) return;

  if (e.key === 'Backspace' && !input.value && dmSelectedRecipients.length > 0) {
    dmSelectedRecipients.pop();
    renderDmRecipientsChips();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    const dropdown = document.getElementById('dm-recipients-dropdown');
    const firstItem = dropdown ? dropdown.querySelector('.dm-dropdown-item') : null;
    if (firstItem) firstItem.click();
  }
}

/**
 * ==========================================================================
 * Rich-Text Editor Toolbar Actions
 * ==========================================================================
 */
export function formatDmText(command, value = null) {
  document.execCommand(command, false, value);
  const editor = document.getElementById('dm-editor-content');
  if (editor) editor.focus();
}

export function formatDmFontSize(size) {
  if (!size) return;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  const span = document.createElement('span');
  span.style.fontSize = size;
  try {
    range.surroundContents(span);
  } catch {
    document.execCommand('fontSize', false, '4');
  }
  const editor = document.getElementById('dm-editor-content');
  if (editor) editor.focus();
}

export function toggleDmColorPalette(event) {
  if (event) event.stopPropagation();
  const popover = document.getElementById('dm-palette-popover');
  if (!popover) return;
  popover.style.display = popover.style.display === 'none' ? 'grid' : 'none';
}

export function formatDmColor(color) {
  document.execCommand('foreColor', false, color);
  const popover = document.getElementById('dm-palette-popover');
  if (popover) popover.style.display = 'none';
  const editor = document.getElementById('dm-editor-content');
  if (editor) editor.focus();
}

export function formatDmAlign(align) {
  if (!align) return;
  document.execCommand(align, false, null);
  const editor = document.getElementById('dm-editor-content');
  if (editor) editor.focus();
}

let dmSavedRange = null;

export function openDmLinkDialog() {
  const modal = document.getElementById('dm-link-modal');
  if (!modal) return;
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0) {
    dmSavedRange = sel.getRangeAt(0).cloneRange();
  } else {
    dmSavedRange = null;
  }
  modal.style.display = 'flex';
  const textInput = document.getElementById('dm-link-text-input');
  const urlInput = document.getElementById('dm-link-url-input');
  if (textInput) {
    textInput.value = sel ? sel.toString().trim() : '';
    if (!textInput.value) textInput.focus();
    else if (urlInput) urlInput.focus();
  }
  if (urlInput) urlInput.value = '';
}

export function closeDmLinkDialog() {
  const modal = document.getElementById('dm-link-modal');
  if (modal) modal.style.display = 'none';
  dmSavedRange = null;
}

export function confirmDmLink() {
  const textInput = document.getElementById('dm-link-text-input');
  const urlInput = document.getElementById('dm-link-url-input');
  let text = textInput ? textInput.value.trim() : '';
  let url = urlInput ? urlInput.value.trim() : '';

  if (!url) {
    showToast('Please enter a valid URL.');
    return;
  }

  if (!/^https?:\/\//i.test(url) && !/^mailto:/i.test(url)) {
    url = 'https://' + url;
  }
  if (!text) text = url;

  const editor = document.getElementById('dm-message-editor');
  if (editor) {
    editor.focus();
  }

  if (dmSavedRange) {
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(dmSavedRange);
  }

  const html = `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(text)}</a>`;
  document.execCommand('insertHTML', false, html);
  dmSavedRange = null;
  closeDmLinkDialog();
}

export function triggerDmImageUpload() {
  const input = document.getElementById('dm-image-file-input');
  if (input) input.click();
}

export function handleDmImageSelect(event) {
  const file = event?.target?.files?.[0];
  if (!file) return;

  if (file.size > 8 * 1024 * 1024) {
    showToast('Image size exceeds 8MB limit.');
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    dmAttachedImage = {
      file,
      dataUrl: reader.result,
      name: file.name,
      size: file.size
    };
    updateDmAttachmentsStrip();
  };
  reader.readAsDataURL(file);
}

export function clearDmAttachedImage() {
  dmAttachedImage = null;
  const input = document.getElementById('dm-image-file-input');
  if (input) input.value = '';
  updateDmAttachmentsStrip();
}

export function triggerDmFileUpload() {
  const input = document.getElementById('dm-general-file-input');
  if (input) input.click();
}

export function handleDmFileSelect(event) {
  const file = event?.target?.files?.[0];
  if (!file) return;

  if (file.size > 16 * 1024 * 1024) {
    showToast('File size exceeds 16MB limit.');
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    dmAttachedFile = {
      file,
      dataUrl: reader.result,
      name: file.name,
      size: file.size
    };
    updateDmAttachmentsStrip();
  };
  reader.readAsDataURL(file);
}

export function clearDmAttachedFile() {
  dmAttachedFile = null;
  const input = document.getElementById('dm-general-file-input');
  if (input) input.value = '';
  updateDmAttachmentsStrip();
}

function updateDmAttachmentsStrip() {
  const strip = document.getElementById('dm-attachments-strip');
  if (!strip) return;

  if (!dmAttachedImage && !dmAttachedFile) {
    strip.style.display = 'none';
    strip.innerHTML = '';
    return;
  }

  strip.style.display = 'flex';
  let html = '';

  if (dmAttachedImage) {
    html += `
      <div class="dm-attached-thumb-wrap">
        <img src="${dmAttachedImage.dataUrl}" class="dm-attached-thumb" alt="${escapeHtml(dmAttachedImage.name)}" 
             onclick="openChatImageLightbox('${escapeHtml(dmAttachedImage.dataUrl)}')" title="Click to view full preview">
        <button type="button" class="dm-attached-remove" onclick="clearDmAttachedImage()" title="Remove image">✕</button>
      </div>
    `;
  }

  if (dmAttachedFile) {
    html += `
      <div class="dm-attached-file-pill">
        <span style="font-size:18px;">📎</span>
        <div>
          <div style="font-weight:600; font-size:13px;">${escapeHtml(dmAttachedFile.name)}</div>
          <div style="font-size:11px; color:#64748B;">${Math.round(dmAttachedFile.size / 1024)} KB</div>
        </div>
        <button type="button" class="dm-chip-remove" onclick="clearDmAttachedFile()" title="Remove attachment">✕</button>
      </div>
    `;
  }

  strip.innerHTML = html;
}

export function toggleDmEmojiPicker(event) {
  if (event) event.stopPropagation();
  let popover = document.getElementById('dm-emoji-popover');
  if (!popover) {
    popover = document.createElement('div');
    popover.id = 'dm-emoji-popover';
    popover.className = 'dm-emoji-popover';
    popover.innerHTML = `
      <div class="dm-emoji-grid">
        ${['😊','😂','❤️','👍','🙏','✨','🎉','🔥','📖','✍️','👏','😍','🤔','🙌','💯','🌸','☕','🌟','💕','📚'].map(e => `
          <button type="button" class="dm-emoji-btn" onclick="insertDmEmoji('${e}')">${e}</button>
        `).join('')}
      </div>
    `;
    document.body.appendChild(popover);
  }

  const btn = event?.currentTarget;
  if (btn) {
    const rect = btn.getBoundingClientRect();
    popover.style.position = 'fixed';
    popover.style.top = `${rect.bottom + 6}px`;
    popover.style.left = `${Math.min(rect.left, window.innerWidth - 270)}px`;
  }

  popover.style.display = popover.style.display === 'block' ? 'none' : 'block';
}

export function switchDmEmojiCat(cat) {
  // Can be expanded if needed
}

export function insertDmEmoji(emoji) {
  document.execCommand('insertText', false, emoji);
  const popover = document.getElementById('dm-emoji-popover');
  if (popover) popover.style.display = 'none';
  const editor = document.getElementById('dm-editor-content');
  if (editor) editor.focus();
}

export function insertDmTable() {
  const tableHtml = `
    <table style="width:100%; border-collapse:collapse; margin:10px 0;">
      <tbody>
        <tr>
          <td style="border:1px solid #CBD5E1; padding:8px 10px;"><b>Header 1</b></td>
          <td style="border:1px solid #CBD5E1; padding:8px 10px;"><b>Header 2</b></td>
        </tr>
        <tr>
          <td style="border:1px solid #CBD5E1; padding:8px 10px;">Content 1</td>
          <td style="border:1px solid #CBD5E1; padding:8px 10px;">Content 2</td>
        </tr>
      </tbody>
    </table>
    <p><br></p>
  `;
  document.execCommand('insertHTML', false, tableHtml);
  const editor = document.getElementById('dm-editor-content');
  if (editor) editor.focus();
}

export function toggleDmQuote() {
  document.execCommand('formatBlock', false, 'blockquote');
  const editor = document.getElementById('dm-editor-content');
  if (editor) editor.focus();
}

export function toggleDmCode() {
  const sel = window.getSelection();
  if (sel && sel.toString()) {
    const codeHtml = `<code>${escapeHtml(sel.toString())}</code>`;
    document.execCommand('insertHTML', false, codeHtml);
  } else {
    document.execCommand('formatBlock', false, 'pre');
  }
  const editor = document.getElementById('dm-editor-content');
  if (editor) editor.focus();
}

export function toggleDmPreview() {
  const content = document.getElementById('dm-editor-content');
  const preview = document.getElementById('dm-editor-preview');
  const btn = document.getElementById('dm-preview-toggle-btn');
  if (!content || !preview || !btn) return;

  dmIsPreviewing = !dmIsPreviewing;
  if (dmIsPreviewing) {
    btn.classList.add('active');
    preview.innerHTML = renderSafeMessageContent(content.innerHTML) || '<span style="color:#94A3B8; font-style:italic;">(No content written yet)</span>';
    content.style.display = 'none';
    preview.style.display = 'block';
  } else {
    btn.classList.remove('active');
    preview.style.display = 'none';
    content.style.display = 'block';
    content.focus();
  }
}

export function toggleDmReplyPreview() {
  const content = document.getElementById('dm-editor-content');
  const preview = document.getElementById('dm-editor-preview');
  const btn = document.getElementById('dm-reply-preview-btn');
  if (!content || !preview || !btn) return;

  dmReplyIsPreviewing = !dmReplyIsPreviewing;
  if (dmReplyIsPreviewing) {
    btn.classList.add('active');
    preview.innerHTML = renderSafeMessageContent(content.innerHTML) || '<span style="color:#94A3B8; font-style:italic;">(No content written yet)</span>';
    content.style.display = 'none';
    preview.style.display = 'block';
  } else {
    btn.classList.remove('active');
    preview.style.display = 'none';
    content.style.display = 'block';
    content.focus();
  }
}

/**
 * ==========================================================================
 * Voice Recording Studio (Microphone Recording, Review & Preview Playback)
 * ==========================================================================
 */
function resetDmVoiceState() {
  if (dmVoiceState.timer) {
    clearInterval(dmVoiceState.timer);
    dmVoiceState.timer = null;
  }
  if (dmVoiceState.mediaRecorder && dmVoiceState.mediaRecorder.state !== 'inactive') {
    dmVoiceState.mediaRecorder.onstop = null;
    dmVoiceState.mediaRecorder.stop();
  }
  if (dmVoiceState.stream) {
    dmVoiceState.stream.getTracks().forEach(t => t.stop());
    dmVoiceState.stream = null;
  }
  if (dmVoiceState.audioPreview) {
    dmVoiceState.audioPreview.pause();
    dmVoiceState.audioPreview = null;
  }
  if (dmVoiceState.audioUrl) {
    URL.revokeObjectURL(dmVoiceState.audioUrl);
  }

  dmVoiceState = {
    isRecording: false,
    isPaused: false,
    mediaRecorder: null,
    stream: null,
    chunks: [],
    timer: null,
    seconds: 0,
    audioBlob: null,
    audioUrl: null,
    audioDuration: 0,
    audioPreview: null,
    isPlayingPreview: false
  };

  updateDmVoiceStudioUi();
}

export function toggleDmVoiceStudio() {
  const studio = document.getElementById('dm-voice-studio');
  if (!studio) return;

  if (studio.style.display === 'none') {
    studio.style.display = 'flex';
    if (!dmVoiceState.isRecording && !dmVoiceState.audioBlob) {
      startDmVoiceRecording();
    }
  } else {
    if (dmVoiceState.isRecording) {
      discardDmVoiceRecording();
    } else {
      studio.style.display = 'none';
    }
  }
}

export async function startDmVoiceRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    dmVoiceState.stream = stream;
    dmVoiceState.chunks = [];

    let mimeType = 'audio/webm';
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
      mimeType = 'audio/webm;codecs=opus';
    } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
      mimeType = 'audio/mp4';
    } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
      mimeType = 'audio/ogg';
    }

    const recorder = new MediaRecorder(stream, { mimeType });
    dmVoiceState.mediaRecorder = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) dmVoiceState.chunks.push(e.data);
    };

    recorder.onstop = () => {
      if (dmVoiceState.chunks.length > 0) {
        dmVoiceState.audioBlob = new Blob(dmVoiceState.chunks, { type: mimeType });
        dmVoiceState.audioUrl = URL.createObjectURL(dmVoiceState.audioBlob);
        dmVoiceState.audioDuration = dmVoiceState.seconds;

        const audio = new Audio(dmVoiceState.audioUrl);
        dmVoiceState.audioPreview = audio;

        audio.ontimeupdate = () => {
          const scrubber = document.getElementById('dm-voice-scrubber');
          const timer = document.getElementById('dm-voice-player-time');
          if (scrubber && audio.duration) {
            scrubber.value = (audio.currentTime / audio.duration) * 100;
          }
          if (timer) {
            const curMins = Math.floor(audio.currentTime / 60);
            const curSecs = String(Math.floor(audio.currentTime % 60)).padStart(2, '0');
            const totMins = Math.floor(dmVoiceState.audioDuration / 60);
            const totSecs = String(Math.floor(dmVoiceState.audioDuration % 60)).padStart(2, '0');
            timer.textContent = `${curMins}:${curSecs} / ${totMins}:${totSecs}`;
          }
        };

        audio.onended = () => {
          dmVoiceState.isPlayingPreview = false;
          const playBtn = document.getElementById('dm-voice-play-toggle');
          if (playBtn) playBtn.textContent = '▶';
          const scrubber = document.getElementById('dm-voice-scrubber');
          if (scrubber) scrubber.value = 0;
        };
      }
      dmVoiceState.isRecording = false;
      updateDmVoiceStudioUi();
    };

    recorder.start(100);
    dmVoiceState.isRecording = true;
    dmVoiceState.isPaused = false;
    dmVoiceState.seconds = 0;

    if (dmVoiceState.timer) clearInterval(dmVoiceState.timer);
    dmVoiceState.timer = setInterval(() => {
      if (!dmVoiceState.isPaused) {
        dmVoiceState.seconds++;
        const timerEl = document.getElementById('dm-voice-rec-timer');
        if (timerEl) {
          const m = String(Math.floor(dmVoiceState.seconds / 60)).padStart(2, '0');
          const s = String(dmVoiceState.seconds % 60).padStart(2, '0');
          timerEl.textContent = `${m}:${s}`;
        }
      }
    }, 1000);

    updateDmVoiceStudioUi();
  } catch (err) {
    console.warn('[DM Voice Recording Error]:', err);
    showToast('Microphone access is required to record voice messages.');
    const studio = document.getElementById('dm-voice-studio');
    if (studio) studio.style.display = 'none';
  }
}

export function pauseDmVoiceRecording() {
  if (dmVoiceState.mediaRecorder && dmVoiceState.mediaRecorder.state === 'recording') {
    dmVoiceState.mediaRecorder.pause();
    dmVoiceState.isPaused = true;
    updateDmVoiceStudioUi();
  }
}

export function resumeDmVoiceRecording() {
  if (dmVoiceState.mediaRecorder && dmVoiceState.mediaRecorder.state === 'paused') {
    dmVoiceState.mediaRecorder.resume();
    dmVoiceState.isPaused = false;
    updateDmVoiceStudioUi();
  }
}

export function stopDmVoiceRecording() {
  if (dmVoiceState.timer) {
    clearInterval(dmVoiceState.timer);
    dmVoiceState.timer = null;
  }
  if (dmVoiceState.mediaRecorder && dmVoiceState.mediaRecorder.state !== 'inactive') {
    dmVoiceState.mediaRecorder.stop();
  }
  if (dmVoiceState.stream) {
    dmVoiceState.stream.getTracks().forEach(t => t.stop());
    dmVoiceState.stream = null;
  }
}

export function discardDmVoiceRecording() {
  resetDmVoiceState();
  const studio = document.getElementById('dm-voice-studio');
  if (studio) studio.style.display = 'none';
}

export function reRecordDmVoice() {
  resetDmVoiceState();
  const studio = document.getElementById('dm-voice-studio');
  if (studio) studio.style.display = 'flex';
  startDmVoiceRecording();
}

export function playDmVoicePreview() {
  if (!dmVoiceState.audioPreview) return;
  dmVoiceState.audioPreview.play();
  dmVoiceState.isPlayingPreview = true;
  const playBtn = document.getElementById('dm-voice-play-toggle');
  if (playBtn) playBtn.textContent = '⏸';
}

export function pauseDmVoicePreview() {
  if (!dmVoiceState.audioPreview) return;
  dmVoiceState.audioPreview.pause();
  dmVoiceState.isPlayingPreview = false;
  const playBtn = document.getElementById('dm-voice-play-toggle');
  if (playBtn) playBtn.textContent = '▶';
}

export function toggleDmVoicePlay() {
  if (dmVoiceState.isPlayingPreview) {
    pauseDmVoicePreview();
  } else {
    playDmVoicePreview();
  }
}

export function seekDmVoicePreview(percent) {
  if (dmVoiceState.audioPreview && dmVoiceState.audioPreview.duration) {
    dmVoiceState.audioPreview.currentTime = (percent / 100) * dmVoiceState.audioPreview.duration;
  }
}

function updateDmVoiceStudioUi() {
  const studio = document.getElementById('dm-voice-studio');
  if (!studio) return;

  if (dmVoiceState.isRecording) {
    const m = String(Math.floor(dmVoiceState.seconds / 60)).padStart(2, '0');
    const s = String(dmVoiceState.seconds % 60).padStart(2, '0');

    studio.innerHTML = `
      <div class="dm-voice-recording-info">
        <span class="dm-voice-pulse"></span>
        <span>${dmVoiceState.isPaused ? 'Recording Paused' : 'Recording Voice Message...'}</span>
        <span id="dm-voice-rec-timer" style="font-family:monospace; margin-left:6px;">${m}:${s}</span>
      </div>
      <div class="dm-voice-studio-actions">
        ${dmVoiceState.isPaused ? `
          <button type="button" class="dm-voice-btn pause-btn" onclick="resumeDmVoiceRecording()">▶ Resume</button>
        ` : `
          <button type="button" class="dm-voice-btn pause-btn" onclick="pauseDmVoiceRecording()">⏸ Pause</button>
        `}
        <button type="button" class="dm-voice-btn stop-btn" onclick="stopDmVoiceRecording()">⏹ Stop &amp; Review</button>
        <button type="button" class="dm-voice-btn discard-btn" onclick="discardDmVoiceRecording()">🗑️ Discard</button>
      </div>
    `;
  } else if (dmVoiceState.audioBlob) {
    const totMins = Math.floor(dmVoiceState.audioDuration / 60);
    const totSecs = String(Math.floor(dmVoiceState.audioDuration % 60)).padStart(2, '0');

    studio.innerHTML = `
      <div class="dm-voice-preview-player">
        <button type="button" class="dm-voice-play-toggle" id="dm-voice-play-toggle" onclick="toggleDmVoicePlay()" title="Play / Pause Preview">
          ${dmVoiceState.isPlayingPreview ? '⏸' : '▶'}
        </button>
        <div style="flex:1; display:flex; flex-direction:column; gap:4px;">
          <input type="range" class="dm-voice-scrubber" id="dm-voice-scrubber" min="0" max="100" value="0" oninput="seekDmVoicePreview(this.value)">
          <div style="display:flex; justify-content:space-between; font-size:11px; color:#64748B;">
            <span>🎙️ Voice Note Preview</span>
            <span id="dm-voice-player-time" style="font-family:monospace;">00:00 / ${totMins}:${totSecs}</span>
          </div>
        </div>
        <button type="button" class="dm-voice-btn discard-btn" onclick="reRecordDmVoice()" title="Re-record voice message">🔄 Re-record</button>
        <button type="button" class="dm-voice-btn discard-btn" onclick="discardDmVoiceRecording()" title="Delete voice note">🗑️ Remove</button>
      </div>
    `;
  } else {
    studio.innerHTML = '';
  }
}

/**
 * Voice Audio Playback in Message Stream
 */
let activeStreamAudio = null;
let activeStreamAudioBtn = null;
let activeStreamAudioId = null;

export function toggleVoicePlay(msgId, url, btn) {
  if (activeStreamAudio && activeStreamAudioId === msgId) {
    if (activeStreamAudio.paused) {
      activeStreamAudio.play();
      if (btn) btn.textContent = '⏸';
    } else {
      activeStreamAudio.pause();
      if (btn) btn.textContent = '▶';
    }
    return;
  }

  stopAnyPlayingAudio();

  const audio = new Audio(url);
  activeStreamAudio = audio;
  activeStreamAudioBtn = btn;
  activeStreamAudioId = msgId;

  if (btn) btn.textContent = '⏸';

  const fill = document.getElementById(`dm-voice-fill-${msgId}`);
  const timeEl = document.getElementById(`dm-voice-time-${msgId}`);

  audio.ontimeupdate = () => {
    if (audio.duration && fill) {
      const p = (audio.currentTime / audio.duration) * 100;
      fill.style.width = `${p}%`;
    }
    if (timeEl && audio.duration) {
      const m = Math.floor(audio.currentTime / 60);
      const s = String(Math.floor(audio.currentTime % 60)).padStart(2, '0');
      timeEl.textContent = `${m}:${s}`;
    }
  };

  audio.onended = () => {
    if (btn) btn.textContent = '▶';
    if (fill) fill.style.width = '0%';
    activeStreamAudio = null;
    activeStreamAudioBtn = null;
    activeStreamAudioId = null;
  };

  audio.play().catch(() => {
    if (btn) btn.textContent = '▶';
  });
}

export function seekVoiceAudio(event, url) {
  if (!activeStreamAudio || !activeStreamAudio.duration) return;
  const track = event.currentTarget;
  const rect = track.getBoundingClientRect();
  const clickX = event.clientX - rect.left;
  const percent = Math.max(0, Math.min(1, clickX / rect.width));
  activeStreamAudio.currentTime = percent * activeStreamAudio.duration;
}

function stopAnyPlayingAudio() {
  if (activeStreamAudio) {
    activeStreamAudio.pause();
    if (activeStreamAudioBtn) activeStreamAudioBtn.textContent = '▶';
    activeStreamAudio = null;
    activeStreamAudioBtn = null;
    activeStreamAudioId = null;
  }
}

/**
 * ==========================================================================
 * Lightbox for Images
 * ==========================================================================
 */
export function openChatImageLightbox(src) {
  if (!src || typeof src !== 'string') return;
  const cleanSrc = src.trim();
  if (!cleanSrc || cleanSrc === 'null' || cleanSrc === 'undefined' || cleanSrc === '[object Object]') return;

  // Pre-load image in background memory first to verify it is valid before rendering any DOM overlay
  const preloader = new Image();
  preloader.onload = () => {
    // Remove any pre-existing preview overlay
    closeChatImageLightbox();

    const lightbox = document.createElement('div');
    lightbox.id = 'dm-image-lightbox';
    lightbox.className = 'dm-lightbox-overlay open';
    lightbox.style.setProperty('display', 'flex', 'important');
    lightbox.onclick = closeChatImageLightbox;

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'dm-lightbox-close';
    closeBtn.setAttribute('aria-label', 'Close image');
    closeBtn.textContent = '✕';
    closeBtn.onclick = closeChatImageLightbox;

    const img = document.createElement('img');
    img.id = 'dm-lightbox-img';
    img.className = 'dm-lightbox-img';
    img.alt = '';
    img.src = cleanSrc;
    img.onclick = (e) => e.stopPropagation();
    img.onerror = () => closeChatImageLightbox();

    lightbox.appendChild(closeBtn);
    lightbox.appendChild(img);
    document.body.appendChild(lightbox);
  };
  preloader.onerror = () => {
    // If the image fails to load, fail safely without ever showing an empty or dimmed broken image overlay
    closeChatImageLightbox();
  };
  preloader.src = cleanSrc;
}

export function closeChatImageLightbox() {
  const lightbox = document.getElementById('dm-image-lightbox');
  if (lightbox) {
    lightbox.classList.remove('open');
    lightbox.style.setProperty('display', 'none', 'important');
    lightbox.innerHTML = '';
    lightbox.remove();
  }
}

/**
 * ==========================================================================
 * Multi-User Invitation System
 * ==========================================================================
 */
export function openInviteModal(conversationId) {
  let modal = document.getElementById('dm-invite-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'dm-invite-modal';
    modal.className = 'dm-modal-overlay';
    modal.onclick = (e) => {
      if (e.target === modal) closeInviteModal();
    };
    modal.innerHTML = `
      <div class="dm-composer-card" style="max-width:480px;">
        <div class="dm-composer-header">
          <div class="dm-composer-title">
            <span>➕</span>
            <span>Invite Users to Direct Message</span>
          </div>
          <button type="button" class="dm-composer-close-btn" onclick="closeInviteModal()">✕</button>
        </div>
        <div class="dm-composer-body" style="padding:16px;">
          <input type="text" id="dm-invite-search" class="dm-title-input" 
                 placeholder="Search members to invite..." 
                 oninput="handleInviteSearch(this.value)">
          <div id="dm-invite-users-list" style="max-height:260px; overflow-y:auto; margin-top:12px;"></div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  modal.classList.add('open');
  modal.setAttribute('data-conv-id', conversationId);
  handleInviteSearch('');
}

export function closeInviteModal() {
  const modal = document.getElementById('dm-invite-modal');
  if (modal) modal.classList.remove('open');
}

export async function handleInviteSearch(query) {
  const listEl = document.getElementById('dm-invite-users-list');
  if (!listEl) return;
  listEl.innerHTML = `<div style="text-align:center; padding:16px; color:#64748B; font-size:13px;">Searching...</div>`;

  try {
    const res = await chatApi(`/api/chat/users?search=${encodeURIComponent(query || '')}`);
    const users = res?.users || [];
    if (users.length === 0) {
      listEl.innerHTML = `<div style="text-align:center; padding:16px; color:#64748B; font-size:13px;">No users found</div>`;
      return;
    }

    const modal = document.getElementById('dm-invite-modal');
    const convId = modal ? modal.getAttribute('data-conv-id') : null;

    listEl.innerHTML = users.map(u => {
      const name = escapeHtml(u.display_name || u.username);
      const avatar = safeAssetUrl(u.avatar || '/profile.png');
      return `
        <div class="dm-invite-item" onclick="submitInviteUser(${convId}, ${u.id})" 
             style="display:flex; align-items:center; gap:10px; padding:8px 12px; border-radius:6px; cursor:pointer; margin-bottom:4px; transition:background 0.15s ease;">
          <img src="${avatar}" style="width:34px; height:34px; border-radius:50%; object-fit:cover;" alt="${name}" onerror="this.src='/profile.png'">
          <div style="flex:1;">
            <div style="font-weight:600; font-size:13.5px; color:#0F172A;">${name}</div>
            <div style="font-size:11.5px; color:#64748B;">@${escapeHtml(u.username)}</div>
          </div>
          <span style="font-size:12px; font-weight:700; color:#22C55E;">Invite +</span>
        </div>
      `;
    }).join('');
  } catch (err) {
    listEl.innerHTML = `<div style="text-align:center; padding:16px; color:#DC2626; font-size:13px;">Search failed</div>`;
  }
}

export async function submitInviteUser(convId, userId) {
  if (!convId || !userId) return;
  try {
    const res = await chatApi(`/api/chat/conversations/${convId}/invite`, {
      method: 'POST',
      body: JSON.stringify({ recipients: [userId] })
    });
    if (!res || !res.success) throw new Error(res?.error || 'Failed to invite user');
    showToast('User invited to the conversation! ✨');
    closeInviteModal();
    if (activeConversationId) {
      selectDirectMessageConversation(activeConversationId);
    }
  } catch (err) {
    showToast(err.message || 'Failed to invite user');
  }
}

/**
 * ==========================================================================
 * Locks & Deletions
 * ==========================================================================
 */
export async function toggleConversationLockUi(convId, lockStatus) {
  const shouldLock = lockStatus === 'true' || lockStatus === true;
  try {
    const res = await chatApi(`/api/chat/conversations/${convId}/lock`, {
      method: 'POST',
      body: JSON.stringify({ isLocked: shouldLock })
    });
    if (!res || !res.success) throw new Error(res?.error || 'Failed to update conversation lock');
    showToast(shouldLock ? 'Conversation locked 🔒' : 'Conversation unlocked 🔓');
    if (activeConversationId) {
      selectDirectMessageConversation(activeConversationId);
    }
  } catch (err) {
    showToast(err.message || 'Failed to update lock');
  }
}

export async function toggleChatLock(userId, action) {
  try {
    const shouldLock = action === 'lock';
    const res = await chatApi('/api/chat/lock', {
      method: 'POST',
      body: JSON.stringify({ targetUserId: Number(userId), lock: shouldLock })
    });
    if (!res || !res.success) throw new Error(res?.error || 'Failed to update user lock');
    showToast(shouldLock ? 'User locked from direct messaging' : 'User unlocked');
    if (activeConversationId) {
      selectDirectMessageConversation(activeConversationId);
    }
  } catch (err) {
    showToast(err.message || 'Could not update lock');
  }
}

export async function deleteConversationUi(convId) {
  if (!confirm('Are you sure you want to remove/leave this direct message conversation?')) return;
  try {
    window.location.hash = '#messages';
    showToast('Conversation removed');
  } catch (err) {
    showToast('Could not delete conversation: ' + err.message);
  }
}

export function startEditChatMessage(msgId) {
  const postBody = document.getElementById(`dm-post-content-${msgId}`);
  if (!postBody) return;
  const currentContent = postBody.getAttribute('data-raw-content') || postBody.innerText.trim();
  const newText = prompt('Edit your direct message:', currentContent);
  if (newText === null || newText.trim() === currentContent.trim()) return;

  chatApi(`/api/chat/messages/${msgId}`, {
    method: 'PUT',
    body: JSON.stringify({ content: newText.trim() })
  }).then(res => {
    if (res?.success) {
      postBody.setAttribute('data-raw-content', newText.trim());
      postBody.innerHTML = renderSafeMessageContent(newText.trim());
      showToast('Message updated ✨');
    }
  }).catch(err => {
    showToast(err.message || 'Failed to edit message');
  });
}

export function cancelEditChatMessage() {
  editingMessageId = null;
}

export function unsendChatMessage(msgId) {
  if (!confirm('Are you sure you want to delete this message?')) return;
  chatApi(`/api/chat/messages/${msgId}`, {
    method: 'DELETE'
  }).then(res => {
    if (res?.success) {
      const card = document.getElementById(`dm-msg-card-${msgId}`);
      if (card) {
        const bodyContent = card.querySelector('.dm-post-body-content');
        if (bodyContent) {
          bodyContent.innerHTML = `<div style="color:#94A3B8; font-style:italic;">🚫 This message was deleted</div>`;
        }
      }
      showToast('Message deleted');
    }
  }).catch(err => {
    showToast(err.message || 'Could not delete message');
  });
}

/**
 * ==========================================================================
 * Real-Time Polling & SSE Handlers
 * ==========================================================================
 */
function startActiveConversationPoller(convId) {
  stopActiveConversationPoller();
  activeChatPollTimer = setInterval(() => {
    syncActiveConversationMessages(convId);
  }, 2500);
}

function stopActiveConversationPoller() {
  if (activeChatPollTimer) {
    clearInterval(activeChatPollTimer);
    activeChatPollTimer = null;
  }
}

function startUnreadBadgePoller() {
  if (unreadBadgePollTimer) return;
  unreadBadgePollTimer = setInterval(() => {
    if (window.IS_LOGGED_IN) {
      updateUnreadMessageBadge();
    }
  }, 10000);
}

async function syncActiveConversationMessages(convId) {
  if (!activeConversationId || activeConversationId !== Number(convId)) {
    stopActiveConversationPoller();
    return;
  }
  try {
    const data = await chatApi(`/api/chat/conversations/${convId}`);
    if (!data || !data.success || !Array.isArray(data.messages)) return;
    if (activeConversationId !== Number(convId)) return;

    data.messages.forEach(m => appendPostCard(m));
  } catch {}
}

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
  const wnavBadge = document.getElementById('wnav-messages-count');

  [badge, drawerBadge].forEach(el => {
    if (el) {
      el.textContent = count > 99 ? '99+' : count;
      el.style.display = count > 0 ? 'flex' : 'none';
    }
  });

  if (wnavBadge) {
    wnavBadge.textContent = count;
    wnavBadge.style.display = count > 0 ? 'inline-flex' : 'none';
  }
}

function handleIncomingRealtimeMessage(event) {
  const msg = event?.detail?.message || event?.detail;
  if (!msg) return;

  const convId = Number(msg.conversationId || msg.conversation_id);
  if (activeConversationId && activeConversationId === convId) {
    appendPostCard(msg);
    scrollMessagesToBottom();
  }

  updateUnreadMessageBadge();
  refreshConversationsListSilently();
}

function handleSentRealtimeMessage(event) {
  const msg = event?.detail?.message || event?.detail;
  if (!msg) return;
  const convId = Number(msg.conversationId || msg.conversation_id);
  if (activeConversationId && activeConversationId === convId) {
    appendPostCard(msg);
    scrollMessagesToBottom();
  }
}

function handleRealtimeReadReceipt() {
  updateUnreadMessageBadge();
}

function handleRealtimeLockChange(event) {
  if (activeConversationId) {
    selectDirectMessageConversation(activeConversationId);
  }
}

function handleRealtimeConversationLock(event) {
  const convId = Number(event?.detail?.conversationId || event?.detail?.conversation_id);
  if (activeConversationId && activeConversationId === convId) {
    selectDirectMessageConversation(convId);
  }
}

function handleRealtimeMessageEdited(event) {
  const msg = event?.detail?.message || event?.detail;
  if (!msg || !msg.id) return;
  const postBody = document.getElementById(`dm-post-content-${msg.id}`);
  if (postBody && msg.content) {
    postBody.innerHTML = renderSafeMessageContent(msg.content);
  }
}

function handleRealtimeMessageDeleted(event) {
  const msgId = event?.detail?.messageId || event?.detail?.id;
  if (!msgId) return;
  const card = document.getElementById(`dm-msg-card-${msgId}`);
  if (card) {
    const bodyContent = card.querySelector('.dm-post-body-content');
    if (bodyContent) {
      bodyContent.innerHTML = `<div style="color:#94A3B8; font-style:italic;">🚫 This message was deleted</div>`;
    }
  }
}

function handleGlobalClickDismiss(event) {
  // Dismiss emoji popover
  const emojiPop = document.getElementById('dm-emoji-popover');
  if (emojiPop && emojiPop.style.display === 'block') {
    if (!emojiPop.contains(event.target) && !event.target.closest('.dm-toolbar-btn')) {
      emojiPop.style.display = 'none';
    }
  }

  // Dismiss recipients autocomplete
  const dropdown = document.getElementById('dm-recipients-dropdown');
  if (dropdown && dropdown.style.display === 'block') {
    if (!dropdown.contains(event.target) && !event.target.closest('.dm-recipients-box')) {
      dropdown.style.display = 'none';
    }
  }
}

export function navigateToUserProfile(target) {
  if (!target) return;
  const clean = decodeURIComponent(String(target)).trim();
  window.location.hash = `#member?id=${encodeURIComponent(clean)}`;
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
    return 'Yesterday ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays < 7) {
    return d.toLocaleDateString([], { weekday: 'short' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else {
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  }
}
