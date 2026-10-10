// Global Search Controller

import { SITE_DATA } from './data.js';
import { t, getLanguage } from './i18n.js';

let activeSearchFilter = 'all';

export function initSearch() {
  window.openSearchModal = () => {
    const modal = document.getElementById('search-modal');
    if (modal) {
      modal.classList.add('open');
      const input = document.getElementById('search-input');
      if (input) {
        input.value = '';
        input.focus();
      }
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

function renderSearchResults(query) {
  const container = document.getElementById('search-results-container');
  if (!container) return;

  const q = query.trim().toLowerCase();
  const results = [];
  const isTa = getLanguage() === 'ta';

  // Search Novels
  if (activeSearchFilter === 'all' || activeSearchFilter === 'novels') {
    SITE_DATA.novels.forEach(n => {
      if (!q || n.title.toLowerCase().includes(q) || n.tamilTitle.toLowerCase().includes(q) || n.genre.toLowerCase().includes(q)) {
        const title = isTa ? n.tamilTitle : n.title;
        const author = isTa ? n.author : 'Rudhra Prarthana';
        const subtitle = isTa ? `எழுத்தாளர்: ${author} • ${n.chaptersCount} அத்தியாயங்கள்` : `Author: ${author} • ${n.chaptersCount} Chapters`;
        results.push({
          type: isTa ? 'நாவல்' : 'Novel',
          title: title,
          subtitle: subtitle,
          link: `#novel?id=${n.id}`
        });
      }
    });
  }

  // Search Forum Topics
  if (activeSearchFilter === 'all' || activeSearchFilter === 'topics') {
    SITE_DATA.forumTopics.forEach(t => {
      if (!q || t.title.toLowerCase().includes(q) || t.categoryTitle.toLowerCase().includes(q)) {
        const subtitle = isTa ? `பிரிவு: ${t.categoryTitle} • ${t.repliesCount} பதில்கள்` : `Category: ${t.categoryTitle} • ${t.repliesCount} Replies`;
        results.push({
          type: isTa ? 'விவாதம்' : 'Topic',
          title: t.title,
          subtitle: subtitle,
          link: `#topic?id=${t.id}`
        });
      }
    });
  }

  // Search Members
  if (activeSearchFilter === 'all' || activeSearchFilter === 'members') {
    (SITE_DATA.members || []).forEach(m => {
      const name = m.displayName || m.name || m.username || '';
      const username = m.username || '';
      const role = m.role || '';
      if (!q || name.toLowerCase().includes(q) || username.toLowerCase().includes(q) || role.toLowerCase().includes(q)) {
        const title = m.title || 'Member';
        const posts = m.postsCount || m.posts || 0;
        const subtitle = isTa ? `${title} • ${posts} பதிவுகள்` : `${title} • ${posts} Posts`;
        results.push({
          type: isTa ? 'உறுப்பினர்' : 'Member',
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
