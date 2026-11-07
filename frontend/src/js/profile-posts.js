/**
 * Rudhra Prarthana Novels — Latest Profile Posts Engine
 * Matches Trending Posts compact styling and provides:
 *  - Small, clean input box with placeholder: "Write something..."
 *  - Golden-colored Post button matching website branding
 *  - Admin, Writer, and Member post creation
 *  - Immediate display in newest-first order
 *  - Author profile picture, username link, content, relative timestamp
 *  - Edit & delete capabilities (creator can edit/delete; admin can moderate any post)
 *  - Inline replies & likes with real-time notifications
 *  - Strict isolation: Profile posts appear ONLY in Latest Profile Posts
 */

import { apiFetch } from './errors.js';
import { showToast } from './reader.js';

// Safe HTML escaping
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getAvatarUrl(url) {
  if (!url) return '/profile.png';
  if (url.includes('images.unsplash.com') || url.includes('ui-avatars.com') || url.includes('dicebear.com')) {
    return '/profile.png';
  }
  return url;
}

/**
 * Return HTML markup for the Latest Profile Posts panel in the sidebar
 */
export function renderLatestProfilePostsPanelHtml() {
  return `
    <section class="forum-panel latest-profile-posts-panel" aria-labelledby="sidebar-profile-posts-heading" id="latest-profile-posts-section">
      <div class="forum-panel-header">
        <h3 id="sidebar-profile-posts-heading" class="forum-panel-title">
          <span>💬</span>
          <span>Latest Profile Posts</span>
        </h3>
        <span class="forum-panel-badge" style="background:rgba(200, 155, 60, 0.15); color:#8C6116;">COMMUNITY</span>
      </div>

      <!-- Compact Post Creator Input Form -->
      <div class="profile-post-create-box" style="display:block !important; margin-bottom:14px; padding-bottom:12px; border-bottom:1px dashed rgba(200,155,60,0.35);">
        <div class="profile-post-input-wrap" style="display:flex !important; gap:8px !important; align-items:center !important; width:100% !important;">
          <input type="text" 
                 id="profile-post-input" 
                 class="profile-post-input" 
                 placeholder="Write something..." 
                 maxlength="500" 
                 autocomplete="off"
                 style="flex:1; min-width:0; padding:8px 12px; font-size:13px; line-height:1.4; border:1.5px solid rgba(200,155,60,0.4); border-radius:8px; background:#FFFFFF; color:#0B1F33; outline:none; height:38px; box-sizing:border-box;"
                 onkeydown="if(event.key==='Enter') window.handleCreateProfilePost();">
          <button type="button" 
                  class="btn btn-gold btn-sm profile-post-submit-btn" 
                  id="profile-post-submit-btn" 
                  style="display:inline-flex !important; align-items:center !important; justify-content:center !important; flex-shrink:0 !important; min-width:70px !important; height:38px !important; padding:0 16px !important; border-radius:8px !important; background:linear-gradient(135deg, #D4AF37 0%, #C89B3C 50%, #B88635 100%) !important; background-color:#C89B3C !important; color:#FFFFFF !important; font-weight:700 !important; font-size:13px !important; line-height:1 !important; border:1px solid #B88635 !important; cursor:pointer !important; box-shadow:0 2px 8px rgba(200,155,60,0.45) !important; visibility:visible !important; opacity:1 !important;"
                  onclick="window.handleCreateProfilePost()">
            Post
          </button>
        </div>
      </div>

      <!-- Profile Posts Feed List -->
      <div id="latest-profile-posts-list" class="forum-panel-list profile-posts-list">
        <div style="text-align:center; padding:16px; color:#64748B; font-size:12px;">
          Loading profile posts…
        </div>
      </div>
    </section>
  `;
}

/**
 * Load and render profile posts into `#latest-profile-posts-list`
 */
export async function loadLatestProfilePosts() {
  const container = document.getElementById('latest-profile-posts-list');
  if (!container) return;

  try {
    const res = await apiFetch('/api/profile-posts?limit=10');
    const data = await res.json();

    if (!res.ok || !data.success) {
      container.innerHTML = `
        <div class="sidebar-empty-state" style="text-align:center; padding:18px 12px;">
          <div style="font-size:20px; margin-bottom:4px;">⚠️</div>
          <div style="font-size:12px; color:#64748B;">Unable to load profile posts.</div>
        </div>
      `;
      return;
    }

    const posts = data.posts || [];
    window._latestProfilePostsCache = posts;

    if (posts.length === 0) {
      container.innerHTML = `
        <div class="sidebar-empty-state" style="text-align:center; padding:20px 14px;">
          <div style="font-size:22px; margin-bottom:4px;">💬</div>
          <div style="font-weight:600; font-size:13px; color:#0B1F33; margin-bottom:2px;">No profile posts yet</div>
          <div style="font-size:11.5px; color:#64748B;">Be the first to share an update with the reader community above!</div>
        </div>
      `;
      return;
    }

    container.innerHTML = posts.map(post => renderSingleProfilePostHtml(post)).join('');

    // Check if URL has a ?post=ID or hash to highlight
    checkAndHighlightTargetPost();
  } catch (err) {
    console.warn('[ProfilePosts] Error loading posts:', err.message);
    container.innerHTML = `
      <div class="sidebar-empty-state" style="text-align:center; padding:18px 12px;">
        <div style="font-size:12px; color:#64748B;">No recent profile posts available.</div>
      </div>
    `;
  }
}

/**
 * Render single profile post HTML matching Trending Posts compact styling
 */
function renderSingleProfilePostHtml(post) {
  const avatarUrl = getAvatarUrl(post.authorAvatar);
  const safeAuthorName = escapeHtml(post.authorName || post.authorUsername || 'Member');
  const safeUsername = escapeHtml(post.authorUsername || 'member');
  const safeTime = escapeHtml(post.timeAgo || 'Recently');
  const safeContent = escapeHtml(post.content || '');
  const authorProfileLink = `#member?id=${encodeURIComponent(post.authorUsername)}`;

  return `
    <article class="sidebar-post-item profile-post-item" id="profile-post-item-${post.id}">
      <div class="sidebar-post-avatar-wrap">
        <a href="${authorProfileLink}" title="View ${safeAuthorName}'s profile">
          <img src="${avatarUrl}" alt="${safeAuthorName}" class="sidebar-post-avatar" onerror="this.onerror=null;this.src='/profile.png';" loading="lazy">
        </a>
      </div>

      <div class="sidebar-post-content profile-post-body">
        <div class="profile-post-header-line">
          <a href="${authorProfileLink}" class="profile-post-author-link" title="View Profile">
            <strong class="sidebar-updater-name">${safeAuthorName}</strong>
          </a>
          <span class="meta-item profile-post-time">🕐 ${safeTime}</span>
        </div>

        <div class="profile-post-text" id="profile-post-text-${post.id}">
          ${safeContent}
        </div>

        <!-- Inline Edit Box (hidden by default) -->
        <div class="profile-post-edit-box" id="profile-post-edit-box-${post.id}" style="display:none; margin:8px 0;">
          <input type="text" id="profile-post-edit-input-${post.id}" class="profile-post-edit-input" value="${safeContent}" maxlength="500" style="width:100%; padding:6px 10px; font-size:13px; border:1px solid #CBD5E1; border-radius:6px; margin-bottom:6px;">
          <div style="display:flex; justify-content:flex-end; gap:6px;">
            <button type="button" class="btn btn-outline btn-xs" onclick="window.cancelEditProfilePost(${post.id})">Cancel</button>
            <button type="button" class="btn btn-gold btn-xs" style="background:linear-gradient(135deg, #D4AF37 0%, #C89B3C 50%, #B88635 100%) !important; color:#FFFFFF !important; font-weight:700 !important; border:1px solid #B88635 !important; border-radius:6px !important; padding:4px 12px !important; cursor:pointer !important;" onclick="window.saveEditProfilePost(${post.id})">Save</button>
          </div>
        </div>

        <!-- Meta Actions Line (Like, Comment, Edit, Delete) -->
        <div class="profile-post-actions-line">
          <button type="button" class="profile-post-action-btn ${post.isLiked ? 'liked' : ''}" onclick="window.handleLikeProfilePost(${post.id})" title="Like post">
            <span>${post.isLiked ? '❤️' : '🤍'}</span>
            <span id="pp-like-count-${post.id}">${post.likesCount || 0}</span>
          </button>

          <button type="button" class="profile-post-action-btn" onclick="window.toggleProfilePostComments(${post.id})" title="View and add replies">
            <span>💬</span>
            <span id="pp-comment-count-${post.id}">${post.commentsCount || 0}</span>
          </button>

          ${post.canEdit ? `
            <button type="button" class="profile-post-action-btn edit-btn" onclick="window.handleEditProfilePost(${post.id})" title="Edit your post">
              ✏️ Edit
            </button>
          ` : ''}

          ${post.canDelete ? `
            <button type="button" class="profile-post-action-btn delete-btn" onclick="window.handleDeleteProfilePost(${post.id})" title="Delete post">
              🗑️ Delete
            </button>
          ` : ''}
        </div>

        <!-- Expandable Comments Drawer -->
        <div class="profile-post-comments-wrap" id="pp-comments-${post.id}" style="display:none;">
          <div class="pp-comments-list" id="pp-comments-list-${post.id}">
            <div style="text-align:center; padding:8px; font-size:11.5px; color:#64748B;">Loading replies…</div>
          </div>
          <div class="pp-comment-input-row">
            <input type="text" id="pp-comment-input-${post.id}" placeholder="Write a reply..." class="pp-comment-input" maxlength="300" onkeydown="if(event.key==='Enter') window.handleSubmitProfilePostComment(${post.id});">
            <button type="button" class="btn btn-gold btn-xs pp-comment-submit-btn" style="background:linear-gradient(135deg, #D4AF37 0%, #C89B3C 50%, #B88635 100%) !important; color:#FFFFFF !important; font-weight:700 !important; border:1px solid #B88635 !important; border-radius:6px !important; padding:4px 12px !important; cursor:pointer !important;" onclick="window.handleSubmitProfilePostComment(${post.id})">Reply</button>
          </div>
        </div>
      </div>
    </article>
  `;
}

/**
 * Create a new profile post
 */
window.handleCreateProfilePost = async () => {
  if (!window.IS_LOGGED_IN || !window.CURRENT_USER) {
    showToast('Please log in to share a profile post.');
    if (typeof openAuthModal === 'function') openAuthModal('login');
    return;
  }

  const input = document.getElementById('profile-post-input');
  const btn = document.getElementById('profile-post-submit-btn');
  const content = (input?.value || '').trim();

  if (!content) {
    showToast('Please enter something to post.');
    input?.focus();
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Posting…';
  }

  try {
    const res = await apiFetch('/api/profile-posts', {
      method: 'POST',
      body: JSON.stringify({ content })
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      showToast(data.error || 'Failed to publish profile post.');
      return;
    }

    if (input) input.value = '';
    showToast('Profile post published! ✓');

    // Reload list to show at the top immediately
    await loadLatestProfilePosts();
  } catch (err) {
    showToast('Error sharing post: ' + err.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Post';
    }
  }
};

/**
 * Edit a profile post
 */
window.handleEditProfilePost = (postId) => {
  const textBox = document.getElementById(`profile-post-text-${postId}`);
  const editBox = document.getElementById(`profile-post-edit-box-${postId}`);
  if (textBox && editBox) {
    textBox.style.display = 'none';
    editBox.style.display = 'block';
    const input = document.getElementById(`profile-post-edit-input-${postId}`);
    input?.focus();
  }
};

window.cancelEditProfilePost = (postId) => {
  const textBox = document.getElementById(`profile-post-text-${postId}`);
  const editBox = document.getElementById(`profile-post-edit-box-${postId}`);
  if (textBox && editBox) {
    textBox.style.display = 'block';
    editBox.style.display = 'none';
  }
};

window.saveEditProfilePost = async (postId) => {
  const input = document.getElementById(`profile-post-edit-input-${postId}`);
  const newContent = (input?.value || '').trim();

  if (!newContent) {
    showToast('Post content cannot be empty.');
    input?.focus();
    return;
  }

  try {
    const res = await apiFetch(`/api/profile-posts/${postId}`, {
      method: 'PUT',
      body: JSON.stringify({ content: newContent })
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      showToast(data.error || 'Failed to update post.');
      return;
    }

    const textBox = document.getElementById(`profile-post-text-${postId}`);
    if (textBox) textBox.textContent = newContent;
    window.cancelEditProfilePost(postId);
    showToast('Profile post updated successfully! ✓');
  } catch (err) {
    showToast('Error updating post: ' + err.message);
  }
};

/**
 * Delete a profile post
 */
window.handleDeleteProfilePost = async (postId) => {
  const confirmed = confirm('Are you sure you want to permanently delete this profile post?');
  if (!confirmed) return;

  try {
    const res = await apiFetch(`/api/profile-posts/${postId}`, { method: 'DELETE' });
    const data = await res.json();

    if (!res.ok || !data.success) {
      showToast(data.error || 'Failed to delete post.');
      return;
    }

    const item = document.getElementById(`profile-post-item-${postId}`);
    if (item) {
      item.style.transition = 'opacity 0.3s ease';
      item.style.opacity = '0';
      setTimeout(() => item.remove(), 300);
    }
    showToast('Profile post deleted.');
  } catch (err) {
    showToast('Error deleting post: ' + err.message);
  }
};

/**
 * Like a profile post
 */
window.handleLikeProfilePost = async (postId) => {
  if (!window.IS_LOGGED_IN || !window.CURRENT_USER) {
    showToast('Please log in to like posts.');
    if (typeof openAuthModal === 'function') openAuthModal('login');
    return;
  }

  try {
    const res = await apiFetch(`/api/profile-posts/${postId}/like`, { method: 'POST' });
    const data = await res.json();

    if (res.ok && data.success) {
      const countEl = document.getElementById(`pp-like-count-${postId}`);
      if (countEl) countEl.textContent = data.likesCount || 0;

      const btn = countEl?.closest('.profile-post-action-btn');
      if (btn) {
        btn.classList.toggle('liked', data.isLiked);
        btn.querySelector('span:first-child').textContent = data.isLiked ? '❤️' : '🤍';
      }
    }
  } catch (err) {
    console.warn('[Like Error]:', err.message);
  }
};

/**
 * Toggle comments for a profile post
 */
window.toggleProfilePostComments = async (postId) => {
  const wrap = document.getElementById(`pp-comments-${postId}`);
  if (!wrap) return;

  const isHidden = wrap.style.display === 'none';
  wrap.style.display = isHidden ? 'block' : 'none';

  if (isHidden) {
    await loadProfilePostComments(postId);
  }
};

/**
 * Fetch and render comments for a profile post
 */
async function loadProfilePostComments(postId) {
  const listEl = document.getElementById(`pp-comments-list-${postId}`);
  if (!listEl) return;

  try {
    const res = await apiFetch(`/api/profile-posts/${postId}/comments`);
    const data = await res.json();

    if (!res.ok || !data.success) {
      listEl.innerHTML = '<div style="color:#DC2626; font-size:11.5px; padding:6px;">Unable to load replies.</div>';
      return;
    }

    const comments = data.comments || [];
    if (comments.length === 0) {
      listEl.innerHTML = '<div style="color:#64748B; font-size:11.5px; padding:6px;">No replies yet. Start the conversation!</div>';
      return;
    }

    listEl.innerHTML = comments.map(c => `
      <div class="pp-comment-row" id="pp-comment-row-${c.id}">
        <a href="#member?id=${encodeURIComponent(c.authorUsername)}" title="${escapeHtml(c.authorName)}">
          <img src="${getAvatarUrl(c.authorAvatar)}" class="pp-comment-avatar" alt="${escapeHtml(c.authorName)}" onerror="this.src='/profile.png'">
        </a>
        <div class="pp-comment-content">
          <div class="pp-comment-header">
            <a href="#member?id=${encodeURIComponent(c.authorUsername)}" class="pp-comment-author">${escapeHtml(c.authorName)}</a>
            <span class="pp-comment-time">${escapeHtml(c.timeAgo)}</span>
            ${c.canDelete ? `
              <button type="button" class="pp-comment-delete-btn" onclick="window.handleDeleteProfilePostComment(${c.id}, ${postId})" title="Delete reply">✕</button>
            ` : ''}
          </div>
          <div class="pp-comment-text">${escapeHtml(c.content)}</div>
        </div>
      </div>
    `).join('');
  } catch (err) {
    listEl.innerHTML = '<div style="color:#64748B; font-size:11.5px; padding:6px;">Error loading replies.</div>';
  }
}

/**
 * Submit comment / reply to a profile post
 */
window.handleSubmitProfilePostComment = async (postId) => {
  if (!window.IS_LOGGED_IN || !window.CURRENT_USER) {
    showToast('Please log in to reply.');
    if (typeof openAuthModal === 'function') openAuthModal('login');
    return;
  }

  const input = document.getElementById(`pp-comment-input-${postId}`);
  const content = (input?.value || '').trim();

  if (!content) {
    showToast('Please enter a reply.');
    input?.focus();
    return;
  }

  try {
    const res = await apiFetch(`/api/profile-posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content })
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      showToast(data.error || 'Failed to submit reply.');
      return;
    }

    if (input) input.value = '';

    // Update count badge
    const countEl = document.getElementById(`pp-comment-count-${postId}`);
    if (countEl && data.commentsCount !== undefined) {
      countEl.textContent = data.commentsCount;
    }

    // Refresh comments list
    await loadProfilePostComments(postId);
    showToast('Reply submitted! ✓');
  } catch (err) {
    showToast('Error replying: ' + err.message);
  }
};

/**
 * Delete a profile post comment
 */
window.handleDeleteProfilePostComment = async (commentId, postId) => {
  if (!confirm('Delete this reply?')) return;

  try {
    const res = await apiFetch(`/api/profile-posts/comments/${commentId}`, { method: 'DELETE' });
    const data = await res.json();

    if (res.ok && data.success) {
      const row = document.getElementById(`pp-comment-row-${commentId}`);
      if (row) row.remove();

      const countEl = document.getElementById(`pp-comment-count-${postId}`);
      if (countEl && data.commentsCount !== undefined) {
        countEl.textContent = data.commentsCount;
      }
      showToast('Reply deleted.');
    }
  } catch (err) {
    showToast('Error deleting reply: ' + err.message);
  }
};

/**
 * Check if the current URL has a target profile post (from a notification or direct link) and highlight it
 */
async function checkAndHighlightTargetPost() {
  const hash = window.location.hash || '';
  let targetId = null;

  if (hash.includes('post=')) {
    const match = hash.match(/post=(\d+)/);
    if (match) targetId = parseInt(match[1], 10);
  }

  if (!targetId) return;

  const container = document.getElementById('latest-profile-posts-list');
  let el = document.getElementById(`profile-post-item-${targetId}`);

  if (!el && container) {
    try {
      const res = await apiFetch(`/api/profile-posts/${targetId}`);
      const data = await res.json();
      if (res.ok && data.success && data.post) {
        const itemHtml = renderSingleProfilePostHtml(data.post);
        container.insertAdjacentHTML('afterbegin', itemHtml);
        el = document.getElementById(`profile-post-item-${targetId}`);
      }
    } catch (err) {
      console.warn('[ProfilePosts] Target post fetch error:', err);
    }
  }

  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('highlight-glow');
    setTimeout(() => el.classList.remove('highlight-glow'), 4000);
    window.toggleProfilePostComments(targetId);
  }
}

if (typeof window !== 'undefined') {
  window.loadLatestProfilePosts = loadLatestProfilePosts;
  window.renderLatestProfilePostsPanelHtml = renderLatestProfilePostsPanelHtml;
}
