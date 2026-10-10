import { SITE_DATA } from './data.js';
import { showToast } from './reader.js';
import { getLanguage } from './i18n.js';

export function initForum() {
  window.toggleReaction = (topicId, postId, reactionType) => {
    const topic = SITE_DATA.forumTopics.find(t => t.id === topicId);
    if (!topic) return;
    const post = topic.posts.find(p => p.id === postId);
    if (!post) return;

    if (post.userReacted === reactionType) {
      post.reactions[reactionType]--;
      post.userReacted = null;
    } else {
      if (post.userReacted) {
        post.reactions[post.userReacted]--;
      }
      post.reactions[reactionType]++;
      post.userReacted = reactionType;
    }

    // Re-render reaction buttons in place
    const container = document.getElementById(`reactions-${postId}`);
    if (container) {
      container.innerHTML = renderReactionButtons(topicId, post);
    }
  };

  window.quotePost = (author, content) => {
    const replyInput = document.getElementById('topic-reply-input');
    if (replyInput) {
      replyInput.value = `<blockquote><strong>@${author}:</strong> ${content.substring(0, 120)}...</blockquote>\n\n`;
      replyInput.focus();
      replyInput.scrollIntoView({ behavior: 'smooth' });
    }
  };

  window.submitForumReply = (topicId) => {
    const replyInput = document.getElementById('topic-reply-input');
    if (!replyInput || !replyInput.value.trim()) {
      showToast('தயவுசெய்து கருத்தை உள்ளிடவும்.');
      return;
    }

    const topic = SITE_DATA.forumTopics.find(t => t.id === topicId);
    if (!topic) return;

    const currentRole = window.CURRENT_USER_ROLE || 'Registered Member';
    const isTa = getLanguage() === 'ta';
    const userAvatar = window.CURRENT_USER?.avatar;
    const cleanAvatar = (userAvatar && !userAvatar.includes('images.unsplash.com') && !userAvatar.includes('ui-avatars.com')) ? userAvatar : '/profile.png';
    const newPost = {
      id: topic.posts.length + 1,
      author: currentRole === 'Author' ? (isTa ? 'ருத்ரா பிரார்த்தனா' : 'Rudhra Prarthana') : (window.CURRENT_USER?.displayName || (isTa ? 'நீங்கள்' : 'You')),
      role: currentRole === 'Author' ? 'Author' : (currentRole === 'Admin' ? 'Admin' : 'Member'),
      avatar: cleanAvatar,
      date: 'சற்றுமுன்',
      content: replyInput.value.trim(),
      reactions: { love: 1, like: 1, clap: 0, haha: 0, wow: 0, sad: 0 },
      userReacted: 'love'
    };

    topic.posts.push(newPost);
    topic.repliesCount++;
    replyInput.value = '';

    showToast('கருத்து வெற்றிகரமாகப் பதிவிடப்பட்டது! 💬');
    
    // Refresh topic view
    if (window.renderTopicView) {
      window.renderTopicView(topicId);
    }
  };
}

export function renderReactionButtons(topicId, post) {
  const icons = {
    love: '❤️',
    like: '👍',
    clap: '👏',
    haha: '😂',
    wow: '😮',
    sad: '😢'
  };

  return Object.entries(icons).map(([type, emoji]) => {
    const count = post.reactions[type] || 0;
    const isActive = post.userReacted === type;
    return `
      <button class="reaction-btn ${isActive ? 'active' : ''}" 
              onclick="toggleReaction('${topicId}', ${post.id}, '${type}')"
              title="${type}">
        <span>${emoji}</span>
        <span>${count}</span>
      </button>
    `;
  }).join('');
}
