// Novel & Chapter Comments and Emoji Reactions Client Module
// Rudhra Prarthana Novels — Live Database Integration

import { t, getLanguage } from './i18n.js';
import { showToast } from './reader.js';
import { apiFetch } from './errors.js';
import { getAvatarUrl } from './app.js';

const ALLOWED_EMOJIS = ['❤️', '👍', '😂', '😢', '😍', '🔥'];

// In-memory cache for fast UI updates
const reactionsCache = {};
const commentsCache = {};

/**
 * Format timestamp into relative display (e.g. "Just now", "5m ago", "Today")
 */
function formatCommentTime(isoStr, isTa) {
  if (!isoStr) return isTa ? 'சற்றுமுன்' : 'Just now';
  try {
    const date = new Date(isoStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 2) return isTa ? 'சற்றுமுன்' : 'Just now';
    if (diffMins < 60) return isTa ? `${diffMins} நிமிடம் முன்` : `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return isTa ? `${diffHours} மணிநேரம் முன்` : `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return isTa ? `${diffDays} நாள் முன்` : `${diffDays}d ago`;

    return date.toLocaleDateString(isTa ? 'ta-IN' : 'en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch {
    return isTa ? 'சற்றுமுன்' : 'Just now';
  }
}

/**
 * 1. Render Emoji Reactions Widget
 */
export async function renderReactionsWidget(containerId, targetType, targetId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const isTa = getLanguage() === 'ta';
  const cacheKey = `${targetType}:${targetId}`;

  // Fetch latest reactions from backend
  try {
    const res = await apiFetch(`/api/reactions?targetType=${encodeURIComponent(targetType)}&targetId=${encodeURIComponent(targetId)}`);
    if (res.ok) {
      const data = await res.json();
      reactionsCache[cacheKey] = data;
    }
  } catch (err) {
    console.warn('Failed to load reactions:', err);
  }

  const reactionData = reactionsCache[cacheKey] || {
    counts: { '❤️': 0, '👍': 0, '😂': 0, '😢': 0, '😍': 0, '🔥': 0 },
    userReaction: null
  };

  const isGuest = !window.IS_LOGGED_IN || window.CURRENT_USER_ROLE === 'Guest';

  container.innerHTML = `
    <div class="rp-reactions-container">
      <div class="rp-reactions-header">
        <h3 class="rp-reactions-title">
          <span>✨</span>
          <span>${t('reactions_heading')}</span>
        </h3>
        ${isGuest ? `<span class="rp-reactions-guest-note">(${isTa ? 'எதிர்வினையாற்ற உள்நுழையவும்' : 'Log in to react'})</span>` : ''}
      </div>

      <div class="rp-reactions-bar">
        ${ALLOWED_EMOJIS.map(emoji => {
          const count = reactionData.counts[emoji] || 0;
          const isActive = reactionData.userReaction === emoji;
          return `
            <button type="button" 
                    class="rp-reaction-pill ${isActive ? 'active' : ''}" 
                    onclick="handleReactionClick('${targetType}', '${targetId}', '${emoji}', '${containerId}')"
                    title="${emoji} (${count})">
              <span class="rp-reaction-emoji">${emoji}</span>
              <span class="rp-reaction-count">${count}</span>
            </button>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

/**
 * Handle Reaction Click
 * - Guests: prompt login without blocking reading
 * - Logged-in: toggle or switch reaction, prevent duplicates
 */
window.handleReactionClick = async function(targetType, targetId, emoji, containerId) {
  const isTa = getLanguage() === 'ta';
  const isGuest = !window.IS_LOGGED_IN || window.CURRENT_USER_ROLE === 'Guest';

  if (isGuest) {
    showToast(isTa ? 'எதிர்வினையாற்ற தயவுசெய்து உள்நுழையவும்! ✨' : 'Please log in to react to this story! ✨');
    if (typeof window.openAuthModal === 'function') {
      window.openAuthModal('login');
    }
    return;
  }

  const cacheKey = `${targetType}:${targetId}`;

  try {
    const res = await apiFetch('/api/reactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetType, targetId, emoji })
    });

    if (res.ok) {
      const data = await res.json();
      reactionsCache[cacheKey] = data;
      renderReactionsWidget(containerId, targetType, targetId);
    }
  } catch (err) {
    console.error('Failed to toggle reaction:', err);
    showToast(isTa ? 'எதிர்வினையைப் புதுப்பிக்க முடியவில்லை.' : 'Failed to update reaction.');
  }
};

/**
 * 2. Render Comments Widget
 */
export async function renderCommentsWidget(containerId, novelId, chapterNum = 0) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const isTa = getLanguage() === 'ta';
  const cacheKey = `${novelId}:${chapterNum}`;

  try {
    const res = await apiFetch(`/api/comments?novel=${encodeURIComponent(novelId)}&ch=${chapterNum}`);
    if (res.ok) {
      const data = await res.json();
      commentsCache[cacheKey] = data.comments || [];
    }
  } catch (err) {
    console.warn('Failed to load comments:', err);
  }

  const comments = commentsCache[cacheKey] || [];
  const isGuest = !window.IS_LOGGED_IN || window.CURRENT_USER_ROLE === 'Guest';
  const user = window.CURRENT_USER;
  const currentAvatar = getAvatarUrl(user?.avatar);
  const currentDisplayName = user ? (isTa && user.displayNameTa ? user.displayNameTa : (user.displayName || user.username)) : (isTa ? 'விருந்தினர்' : 'Guest');

  container.innerHTML = `
    <div class="rp-comments-container">
      <div class="rp-comments-header">
        <h2 class="rp-comments-title">
          <span>💬</span>
          <span>${isTa ? 'வாசகர் கருத்துக்கள்' : 'Reader Comments'}</span>
          <span class="rp-comments-count-badge">${comments.length}</span>
        </h2>
      </div>

      <!-- Comment Submission Box -->
      <div class="rp-comment-form-wrap">
        ${isGuest ? `
          <div class="rp-comment-guest-callout">
            <div>
              <strong>${isTa ? 'கருத்து தெரிவிக்க விரும்புகிறீர்களா?' : 'Want to join the conversation?'}</strong>
              <div style="font-size:12px; color:var(--color-text-muted); margin-top:2px;">
                ${isTa ? 'வாசகர் கருத்துக்களைப் பதிய தயவுசெய்து உள்நுழையவும்.' : 'Log in or register to post your thoughts and engage with author Rudhra Prarthana.'}
              </div>
            </div>
            <button type="button" class="btn btn-gold btn-sm" onclick="openAuthModal('login')">
              ${t('btn_login')}
            </button>
          </div>
        ` : `
          <div class="rp-comment-form-header">
            <img src="${currentAvatar}" class="rp-comment-author-avatar" alt="${currentDisplayName}" onerror="this.src='/profile.png'">
            <div class="rp-comment-author-info">
              <span class="rp-comment-author-name">${currentDisplayName}</span>
              <span style="font-size:11px; color:var(--color-gold-warm); font-weight:600;">
                ${isTa ? (window.CURRENT_USER_ROLE === 'Author' ? 'எழுத்தாளர்' : 'பதிவுசெய்த வாசகர்') : (window.CURRENT_USER_ROLE || 'Member')}
              </span>
            </div>
          </div>
        `}

        <textarea id="comment-input-${containerId}" 
                  class="rp-comment-textarea" 
                  placeholder="${t('reader_comment_placeholder')}"
                  ${isGuest ? `onclick="handleGuestCommentFocus()"` : ''}></textarea>

        <div class="rp-comment-form-footer">
          <span style="font-size:11.5px; color:var(--color-text-muted);">
            ${isTa ? 'அன்பான & கண்ணியமான உரையாடலை ஊக்குவிக்கிறோம்.' : 'Constructive & warm discussions welcomed.'}
          </span>
          <button type="button" 
                  id="comment-submit-btn-${containerId}" 
                  class="btn btn-gold btn-sm"
                  onclick="handleCommentSubmit('${novelId}', ${chapterNum}, '${containerId}')">
            ${t('reader_comment_submit')}
          </button>
        </div>
      </div>

      <!-- Comments Stream -->
      <div class="rp-comments-list" id="comments-list-${containerId}">
        ${comments.length === 0 ? `
          <div class="rp-comments-empty-state">
            <div class="rp-comments-empty-icon">📝</div>
            <p>${t('comments_empty')}</p>
          </div>
        ` : comments.map(c => {
          const authorAvatar = getAvatarUrl(c.avatar);
          const authorName = isTa && c.displayNameTa ? c.displayNameTa : (c.displayName || c.username);
          const timeDisplay = formatCommentTime(c.createdAt, isTa);
          
          const isOwner = Boolean(user && (String(user.id) === String(c.userId) || user.username === c.username));
          const isPrivileged = window.CURRENT_USER_ROLE === 'Admin' || window.CURRENT_USER_ROLE === 'Moderator';
          const canManage = isOwner || isPrivileged;

          const roleBadgeHtml = c.role === 'Author'
            ? `<span style="font-size:10px; font-weight:700; color:#8C6116; background:#FFF7E6; border:1px solid #C89B3C; padding:1px 6px; border-radius:4px; margin-left:6px;">${isTa ? 'எழுத்தாளர்' : 'Author'}</span>`
            : (c.role === 'Admin' ? `<span style="font-size:10px; font-weight:700; color:#1E3A8A; background:#EFF6FF; padding:1px 6px; border-radius:4px; margin-left:6px;">Admin</span>` : '');

          return `
            <div class="rp-comment-card" id="comment-card-${c.id}">
              <div class="rp-comment-meta-row">
                <div class="rp-comment-user-box">
                  <img src="${authorAvatar}" class="rp-comment-avatar" alt="${authorName}" onerror="this.src='/profile.png'">
                  <div>
                    <div style="display:flex; align-items:center;">
                      <span class="rp-comment-user-name">${authorName}</span>
                      ${roleBadgeHtml}
                    </div>
                    <span class="rp-comment-date">${timeDisplay}</span>
                  </div>
                </div>

                ${canManage ? `
                  <div class="rp-comment-actions-bar" style="border:none; margin:0; padding:0;">
                    <button class="rp-comment-action-btn" onclick="handleCommentEdit(${c.id}, '${containerId}')" title="${t('btn_edit')}">
                      ✏️ ${t('btn_edit')}
                    </button>
                    <button class="rp-comment-action-btn delete" onclick="handleCommentDelete(${c.id}, '${novelId}', ${chapterNum}, '${containerId}')" title="${t('btn_delete')}">
                      🗑️ ${t('btn_delete')}
                    </button>
                  </div>
                ` : ''}
              </div>

              <div class="rp-comment-body" id="comment-content-${c.id}">${escapeHtml(c.content)}</div>
              
              <div class="rp-comment-edit-box" id="comment-edit-box-${c.id}" style="display:none;">
                <textarea id="comment-edit-input-${c.id}" class="rp-comment-textarea" style="min-height:70px;">${escapeHtml(c.content)}</textarea>
                <div style="display:flex; gap:8px; justify-content:flex-end;">
                  <button class="btn btn-outline btn-sm" onclick="handleCommentCancelEdit(${c.id})">${t('btn_cancel')}</button>
                  <button class="btn btn-gold btn-sm" onclick="handleCommentSave(${c.id}, '${novelId}', ${chapterNum}, '${containerId}')">${t('btn_save')}</button>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

window.handleGuestCommentFocus = function() {
  const isTa = getLanguage() === 'ta';
  showToast(isTa ? 'கருத்து தெரிவிக்க தயவுசெய்து உள்நுழையவும்! 💬' : 'Please log in to post your comment! 💬');
  if (typeof window.openAuthModal === 'function') {
    window.openAuthModal('login');
  }
};

window.handleCommentSubmit = async function(novelId, chapterNum, containerId) {
  const isTa = getLanguage() === 'ta';
  const isGuest = !window.IS_LOGGED_IN || window.CURRENT_USER_ROLE === 'Guest';

  if (isGuest) {
    showToast(isTa ? 'கருத்து தெரிவிக்க தயவுசெய்து உள்நுழையவும்! 💬' : 'Please log in to post a comment! 💬');
    if (typeof window.openAuthModal === 'function') {
      window.openAuthModal('login');
    }
    return;
  }

  const inputEl = document.getElementById(`comment-input-${containerId}`);
  const submitBtn = document.getElementById(`comment-submit-btn-${containerId}`);
  const content = inputEl?.value?.trim();

  if (!content) {
    showToast(isTa ? 'தயவுசெய்து கருத்தை உள்ளிடவும்.' : 'Please enter your comment.');
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.classList.add('btn-loading');
  }

  try {
    const res = await apiFetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ novelId, chapterNum, content })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      showToast(data.error || (isTa ? 'கருத்தைப் பதிவிட முடியவில்லை.' : 'Failed to post comment.'));
      return;
    }

    if (inputEl) inputEl.value = '';
    showToast(t('comments_post_success'));
    renderCommentsWidget(containerId, novelId, chapterNum);
  } catch (err) {
    console.error('Comment submit error:', err);
    showToast(isTa ? 'பிணையப் பிழை. மீண்டும் முயற்சிக்கவும்.' : 'Network error posting comment.');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.classList.remove('btn-loading');
    }
  }
};

window.handleCommentEdit = function(commentId) {
  const contentEl = document.getElementById(`comment-content-${commentId}`);
  const editBox = document.getElementById(`comment-edit-box-${commentId}`);
  if (contentEl && editBox) {
    contentEl.style.display = 'none';
    editBox.style.display = 'flex';
  }
};

window.handleCommentCancelEdit = function(commentId) {
  const contentEl = document.getElementById(`comment-content-${commentId}`);
  const editBox = document.getElementById(`comment-edit-box-${commentId}`);
  if (contentEl && editBox) {
    contentEl.style.display = 'block';
    editBox.style.display = 'none';
  }
};

window.handleCommentSave = async function(commentId, novelId, chapterNum, containerId) {
  const isTa = getLanguage() === 'ta';
  const editInput = document.getElementById(`comment-edit-input-${commentId}`);
  const content = editInput?.value?.trim();

  if (!content) {
    showToast(isTa ? 'கருத்து காலியாக இருக்கக்கூடாது.' : 'Comment cannot be empty.');
    return;
  }

  try {
    const res = await apiFetch('/api/comments/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commentId, content })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      showToast(data.error || (isTa ? 'புதுப்பிக்க முடியவில்லை.' : 'Failed to update.'));
      return;
    }

    showToast(t('comments_update_success'));
    renderCommentsWidget(containerId, novelId, chapterNum);
  } catch (err) {
    console.error('Comment save error:', err);
    showToast(isTa ? 'பிணையப் பிழை.' : 'Network error.');
  }
};

window.handleCommentDelete = async function(commentId, novelId, chapterNum, containerId) {
  const isTa = getLanguage() === 'ta';
  if (!confirm(t('comments_delete_confirm'))) {
    return;
  }

  try {
    const res = await apiFetch('/api/comments/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commentId })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      showToast(data.error || (isTa ? 'நீக்க முடியவில்லை.' : 'Failed to delete.'));
      return;
    }

    showToast(t('comments_delete_success'));
    renderCommentsWidget(containerId, novelId, chapterNum);
  } catch (err) {
    console.error('Comment delete error:', err);
    showToast(isTa ? 'பிணையப் பிழை.' : 'Network error.');
  }
};
