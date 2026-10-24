// Global Search Controller with Dynamic SQL Data Querying

import { t } from './i18n.js';
import { getNovelsList, getForumTopics, getMembersList } from './content-service.js';

let activeSearchFilter = 'all';
let cachedSearchNovels = [];
let cachedSearchTopics = [];
let cachedSearchMembers = [];

export function initSearch() {
  window.openSearchModal = async () => {
    const modal = document.getElementById('search-modal');
    if (modal) {
      modal.classList.add('open');
      const input = document.getElementById('search-input');
      if (input) {
        input.value = '';
        input.focus();
      }
      await refreshSearchIndex();
      renderSearchResults('');
    }
  };

  window.closeSearchModal = () => {
    const modal = document.getElementById('search-modal');
    if (modal) modal.classList.remove('open');
  };

  window.setSearchFilter = (filter) => {
    activeSearchFilter = filter;
    document.querySelectorAll('.search-pill').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.filter === filter);
    });
    const input = document.getElementById('search-input');
    renderSearchResults(input ? input.value : '');
  };

  // Keyboard shortcut: ESC to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      window.closeSearchModal();
      if (window.closeAuthModal) window.closeAuthModal();
      if (window.closeMessagesDrawer) window.closeMessagesDrawer();
    }
  });

  // Real-time search debounce
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      renderSearchResults(e.target.value);
    });
  }
}

async function refreshSearchIndex() {
  try {
    const [novels, topics, membersData] = await Promise.all([
      getNovelsList({ all: true }),
      getForumTopics(),
      getMembersList()
    ]);
    if (novels && Array.isArray(novels)) cachedSearchNovels = novels;
    if (topics && Array.isArray(topics)) cachedSearchTopics = topics;
    if (membersData && Array.isArray(membersData.members)) cachedSearchMembers = membersData.members;
  } catch (err) {
    console.warn('[Search] Index refresh notice:', err);
  }
}

function renderSearchResults(query) {
  const container = document.getElementById('search-results-container');
  if (!container) return;

  const q = query.trim().toLowerCase();
  const results = [];

  // Search Novels from SQL
  if (activeSearchFilter === 'all' || activeSearchFilter === 'novels') {
    cachedSearchNovels.forEach(n => {
      if (!q || n.title.toLowerCase().includes(q) || (n.genre && n.genre.toLowerCase().includes(q))) {
        const title = n.title;
        const author = n.author || 'Rudhra Prarthana';
        const count = n.chaptersCount !== undefined ? n.chaptersCount : (n.chapters ? n.chapters.length : '');
        const subtitle = `Author: ${author}${count ? ` • ${count} Chapters` : ''}`;
        results.push({
          type: 'Novel',
          title: title,
          subtitle: subtitle,
          link: `#novel?id=${encodeURIComponent(n.id)}`
        });
      }
    });
  }

  // Search Forum Topics from SQL
  if (activeSearchFilter === 'all' || activeSearchFilter === 'topics') {
    cachedSearchTopics.forEach(t => {
      if (!q || t.title.toLowerCase().includes(q) || (t.categoryTitle && t.categoryTitle.toLowerCase().includes(q))) {
        const subtitle = `Category: ${t.categoryTitle || 'Discussions'} • ${t.repliesCount || 0} Replies`;
        results.push({
          type: 'Topic',
          title: t.title,
          subtitle: subtitle,
          link: `#topic?id=${encodeURIComponent(t.id)}`
        });
      }
    });
  }

  // Search Members from SQL
  if (activeSearchFilter === 'all' || activeSearchFilter === 'members') {
    cachedSearchMembers.forEach(m => {
      const name = m.displayName || m.username || '';
      const username = m.username || '';
      if (!q || name.toLowerCase().includes(q) || username.toLowerCase().includes(q)) {
        const posts = m.posts || m.postsCount || 0;
        const subtitle = `Member • ${posts} Posts`;
        results.push({
          type: 'Member',
          title: `${name} (@${username})`,
          subtitle: subtitle,
          link: `#member?id=${encodeURIComponent(username || m.id)}`
        });
      }
    });
  }

  if (results.length === 0) {
    container.innerHTML = `
      <div style="padding: 32px; text-align: center; color: var(--color-text-muted);">
        <div style="font-size: 24px; margin-bottom: 8px;">🔍</div>
        <div>${t('search_no_results')}</div>
      </div>
    `;
    return;
  }

  container.innerHTML = results.map(r => `
    <div class="search-result-item" onclick="window.location.hash = '${r.link}'; closeSearchModal();">
      <span class="search-item-badge">${r.type}</span>
      <div>
        <div style="font-weight: 700; font-size: 14px; color: var(--color-navy-deep);">${r.title}</div>
        <div style="font-size: 11px; color: var(--color-text-muted);">${r.subtitle}</div>
      </div>
    </div>
  `).join('');
}
