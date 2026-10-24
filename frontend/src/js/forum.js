// Reader Forum & Community Interactions Module
// Live MySQL Database Integration for Topics, Nested Replies, and Emoji Reactions

import { showToast } from './reader.js';
import { apiFetch } from './errors.js';

export const FORUM_EMOJIS = [
  { emoji: '❤️', title: 'Love' },
  { emoji: '👍', title: 'Like' },
  { emoji: '👏', title: 'Clap' },
  { emoji: '😂', title: 'Laugh' },
  { emoji: '😮', title: 'Surprise' },
  { emoji: '😍', title: 'Adore' },
  { emoji: '😢', title: 'Sad' }
];

export function initForum() {
  window._replyingToParentId = null;

  window.quotePost = (author, content) => {
    const replyInput = document.getElementById('topic-reply-input');
    if (replyInput) {
      const cleanQuote = String(content || '').replace(/<[^>]+>/g, '').trim().substring(0, 160);
      replyInput.value = `<blockquote><strong>@${author}:</strong> ${cleanQuote}...</blockquote>\n\n`;
      replyInput.focus();
      replyInput.scrollIntoView({ behavior: 'smooth' });
    }
  };

  window.setReplyingToPost = (postId, author) => {
    window._replyingToParentId = postId;
    const indicator = document.getElementById('replying-to-indicator');
    const authorSpan = document.getElementById('replying-to-author');
    if (indicator && authorSpan) {
      authorSpan.textContent = author;
      indicator.style.display = 'flex';
    }
    const replyInput = document.getElementById('topic-reply-input');
    if (replyInput) {
      replyInput.focus();
      replyInput.scrollIntoView({ behavior: 'smooth' });
    }
  };

  window.cancelReplyToPost = () => {
    window._replyingToParentId = null;
    const indicator = document.getElementById('replying-to-indicator');
    if (indicator) {
      indicator.style.display = 'none';
    }
  };

  /**
   * Submit Reply to a Forum Topic with Live MySQL Persistence
   */
  window.submitForumReply = async (topicId) => {
    const isGuest = !window.IS_LOGGED_IN;
    if (isGuest) {
      showToast('Please log in to reply.');
      if (typeof window.openAuthModal === 'function') {
        window.openAuthModal('login');
      }
      return;
    }

    const replyInput = document.getElementById('topic-reply-input');
    if (!replyInput || !replyInput.value.trim()) {
      showToast('Please enter your reply.');
      return;
    }

    const replyContent = replyInput.value.trim();
    const submitBtn = document.getElementById('topic-reply-submit-btn');

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerText = 'Posting...';
    }

    try {
      const res = await apiFetch(`/api/forum/topics/${encodeURIComponent(topicId)}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: replyContent,
          parentId: window._replyingToParentId || null
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.error || 'Failed to post reply.');
        return;
      }

      replyInput.value = '';
      window.cancelReplyToPost();
      showToast('Reply posted successfully! 💬');

      // Dispatch real-time refresh event for sidebar & lists
      window.dispatchEvent(new CustomEvent('rp:forum-updated', { detail: { topicId } }));

      // Immediately refresh the current topic view to display the new post from MySQL
      if (typeof window.renderTopicView === 'function') {
        window.renderTopicView();
      }
    } catch (err) {
      console.error('[Forum] Error submitting reply:', err);
      showToast('Failed to post reply. Please check your connection.');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerText = 'Post Reply 💬';
      }
    }
  };

  /**
   * Toggle Emoji Reaction on a Forum Post or Topic with Live MySQL Persistence
   */
  window.toggleReaction = async (topicId, postId, emoji) => {
    if (!window.IS_LOGGED_IN) {
      showToast('Please log in to react.');
      if (typeof window.openAuthModal === 'function') {
        window.openAuthModal('login');
      }
      return;
    }

    const targetType = postId ? 'forum_post' : 'forum_topic';
    const targetId = String(postId || topicId);

    try {
      const res = await apiFetch('/api/reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType, targetId, emoji })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.error || 'Failed to update reaction.');
        return;
      }

      // Re-render topic view or update container in-place
      const groupEl = document.getElementById(postId ? `reactions-${postId}` : `reactions-topic-${topicId}`);
      if (groupEl) {
        const reactionTarget = {
          id: postId,
          reactions: data.counts || {},
          userReacted: data.userReaction || null
        };
        groupEl.innerHTML = renderReactionButtons(topicId, reactionTarget, !postId);
      } else if (typeof window.renderTopicView === 'function') {
        window.renderTopicView();
      }

      showToast(data.userReaction ? `Reacted ${emoji}!` : 'Reaction removed.');
    } catch (err) {
      console.error('[Forum] Error toggling reaction:', err);
      showToast('Failed to update reaction.');
    }
  };

  /**
   * Toggle New Topic Form in Category View
   */
  window.toggleNewTopicForm = () => {
    if (!window.IS_LOGGED_IN) {
      showToast('Please log in to start a new discussion.');
      if (typeof window.openAuthModal === 'function') {
        window.openAuthModal('login');
      }
      return;
    }

    const form = document.getElementById('new-topic-form-container');
    if (form) {
      const isVisible = form.style.display !== 'none';
      form.style.display = isVisible ? 'none' : 'block';
      if (!isVisible) {
        const titleInput = document.getElementById('new-topic-title-input');
        if (titleInput) titleInput.focus();
      }
    }
  };

  /**
   * Submit New Forum Topic in Category View
   */
  window.submitNewForumTopic = async (categoryId) => {
    if (!window.IS_LOGGED_IN) {
      showToast('Please log in to create a discussion.');
      if (typeof window.openAuthModal === 'function') {
        window.openAuthModal('login');
      }
      return;
    }

    const titleInput = document.getElementById('new-topic-title-input');
    const contentInput = document.getElementById('new-topic-content-input');
    const submitBtn = document.getElementById('new-topic-submit-btn');

    const title = titleInput?.value?.trim();
    const content = contentInput?.value?.trim();

    if (!title || !content) {
      showToast('Please enter both title and content for your discussion.');
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerText = 'Publishing...';
    }

    try {
      const res = await apiFetch('/api/forum/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId, title, content })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.error || 'Failed to create discussion.');
        return;
      }

      showToast('Discussion created successfully! 🎉');
      window.dispatchEvent(new CustomEvent('rp:forum-updated', { detail: { topicId: data.topicId } }));

      // Navigate to the newly created topic thread
      window.location.hash = `#topic?id=${encodeURIComponent(data.topicId)}`;
    } catch (err) {
      console.error('[Forum] Error creating topic:', err);
      showToast('Failed to publish discussion.');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerText = 'Publish Discussion 🚀';
      }
    }
  };
}

/**
 * Render standard interactive reaction buttons for a forum post or topic
 */
export function renderReactionButtons(topicId, post, isTopic = false) {
  const targetId = isTopic ? 'null' : post.id;
  const reactions = post.reactions || {};
  const activeUserEmoji = post.userReacted;

  return FORUM_EMOJIS.map(({ emoji, title }) => {
    const count = Number(reactions[emoji] || 0);
    const isActive = activeUserEmoji === emoji;
    return `
      <button type="button" class="reaction-btn ${isActive ? 'active' : ''}" 
              onclick="toggleReaction('${topicId}', ${targetId}, '${emoji}')"
              title="${title}">
        <span class="reaction-emoji">${emoji}</span>
        ${count > 0 ? `<span class="reaction-count">${count}</span>` : ''}
      </button>
    `;
  }).join('');
}
