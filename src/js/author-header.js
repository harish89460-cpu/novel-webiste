// Rudhra Prarthana Novels — Scoped Header Controller for Author/Writer Pages
// Exclusively applies to Author/Writer Profile Page and Author/Writer Dashboard Pages

import { t } from './i18n.js';

let originalNavHtml = null;

/**
 * Check if the given hash or member belongs to an Author or Writer
 */
export function isAuthorWriterPage(hash, member = null) {
  if (!hash) hash = window.location.hash || '#forum';
  const cleanHash = hash.toLowerCase();

  // 1. Author & Writer Dashboard routes
  if (cleanHash.startsWith('#writer') || (cleanHash.startsWith('#admin') && !cleanHash.startsWith('#admin-login'))) {
    return true;
  }

  // 2. Member profile route
  if (cleanHash.startsWith('#member')) {
    const urlParams = new URLSearchParams(hash.split('?')[1] || '');
    const memberParam = (urlParams.get('id') || '').toLowerCase();

    // Known Author identifiers
    if (memberParam === 'rudhra' || memberParam === 'rudhra_author' || memberParam === '2') {
      return true;
    }

    // Current user if author or writer
    if (window.CURRENT_USER && (memberParam === 'me' || memberParam === window.CURRENT_USER.username?.toLowerCase() || String(memberParam) === String(window.CURRENT_USER.id))) {
      const u = window.CURRENT_USER;
      if (u.role === 'writer' || u.role === 'Admin' || u.isWriter || u.isAuthor || u.isAdmin) {
        return true;
      }
    }

    // Inspect member object if provided
    if (member) {
      if (member.role === 'writer' || member.role === 'Admin' || member.isWriter || member.isAuthor || member.id === 'rudhra' || member.username === 'rudhra_author') {
        return true;
      }
    }
  }

  return false;
}

/**
 * Apply or remove the scoped Author/Writer header
 */
export function updateAuthorWriterHeader(isActive, member = null) {
  const header = document.querySelector('.site-header');
  const navDesktop = document.querySelector('.site-header .nav-desktop');
  const authContainer = document.getElementById('header-auth-container');
  if (!header) return;

  if (isActive) {
    document.body.classList.add('author-page-view');
    header.classList.add('author-header-mode');

    // Save original nav markup on first activation
    if (navDesktop) {
      if (!originalNavHtml) {
        originalNavHtml = navDesktop.innerHTML;
      }
      navDesktop.innerHTML = getAuthorNavHtml();
      navDesktop.classList.add('author-nav-active');
    }

    // Render streamlined right actions
    if (authContainer) {
      authContainer.innerHTML = getAuthorAuthHtml(member);
    }
  } else {
    document.body.classList.remove('author-page-view');
    header.classList.remove('author-header-mode');

    // Restore original public navigation
    if (navDesktop && originalNavHtml) {
      navDesktop.innerHTML = originalNavHtml;
      navDesktop.classList.remove('author-nav-active');
    }

    // Restore standard public auth area
    if (typeof window.updateHeaderUserArea === 'function') {
      window.updateHeaderUserArea();
    }
  }
}

/**
 * Return streamlined essential navigation HTML for Author/Writer
 */
function getAuthorNavHtml() {
  const currentHash = window.location.hash || '#home';
  const isHome = currentHash === '#home';
  const isNovels = currentHash.startsWith('#novel');
  const isForum = currentHash.startsWith('#forum') || currentHash.startsWith('#topic');
  const isAudio = currentHash.startsWith('#audio');

  return `
    <a href="#home" class="nav-link ${isHome ? 'active' : ''}">Home</a>
    <a href="#novels" class="nav-link ${isNovels ? 'active' : ''}">Novels</a>
    <a href="#forum" class="nav-link ${isForum ? 'active' : ''}">Forum</a>
    <a href="#audio" class="nav-link ${isAudio ? 'active' : ''}">Audio</a>

    <!-- Compact 'More ▾' Collapsible Menu -->
    <div class="author-more-wrap" id="author-more-wrap">
      <button type="button" class="nav-link author-more-trigger" onclick="window.toggleAuthorMoreNav(event)">
        More <span class="more-chevron">▾</span>
      </button>
      <div class="author-more-dropdown" id="author-more-dropdown">
        <a href="#novels?category=Ongoing" class="author-more-item" onclick="window.closeAuthorMoreNav()">What's New</a>
        <a href="#members" class="author-more-item" onclick="window.closeAuthorMoreNav()">Members</a>
        <a href="#contact" class="author-more-item" onclick="window.closeAuthorMoreNav()">Contact</a>
        <a href="https://tamil.pratilipi.com/user/rudhra-prarthana-605774cq1w" target="_blank" rel="noopener" class="author-more-item" onclick="window.closeAuthorMoreNav()">
          Pratilipi <span style="font-size:11px; opacity:0.6;">↗</span>
        </a>
        <a href="https://www.youtube.com/@rudhraprarthanaaudionovels" target="_blank" rel="noopener" class="author-more-item" style="color:#C89B3C;" onclick="window.closeAuthorMoreNav()">
          YouTube <span style="font-size:11px; opacity:0.7;">↗</span>
        </a>
      </div>
    </div>
  `;
}

/**
 * Return streamlined right-side user & dashboard actions
 */
function getAuthorAuthHtml(member) {
  const user = window.CURRENT_USER;
  if (!user || !window.IS_LOGGED_IN) {
    return `
      <button class="btn btn-gold btn-sm" onclick="openAuthModal('login')">${t('btn_login') || 'Log In'}</button>
      <button class="btn btn-outline btn-sm" onclick="openAuthModal('register')">${t('btn_register') || 'Register'}</button>
    `;
  }

  const isWriter = user.role === 'writer' || user.isWriter;
  const isAdmin = user.isAdmin || user.role === 'Admin';

  const dashHash = isWriter ? '#writer' : '#admin';
  const dashLabel = isWriter ? '✍️ Dashboard' : '👑 Dashboard';
  const isCurrentlyOnDash = window.location.hash.startsWith(dashHash);

  const displayName = user.displayName || user.username || 'Author';
  const rawAvatar = user.avatar;
  const avatar = (rawAvatar && !rawAvatar.includes('images.unsplash.com') && !rawAvatar.includes('ui-avatars.com')) ? rawAvatar : '/profile.png';
  const memberParam = user.username || (user.id ? String(user.id) : 'me');
  const roleTitle = isAdmin ? 'Author & Admin' : (isWriter ? 'Writer' : 'Author');

  return `
    <!-- Visible Dashboard Access Button -->
    <a href="${dashHash}" class="btn ${isCurrentlyOnDash ? 'btn-primary' : 'btn-gold'} author-header-dash-btn" title="Go to ${roleTitle} Workspace">
      ${dashLabel}
    </a>

    <!-- Author/Writer Profile Menu Trigger -->
    <div class="author-profile-menu-wrap" style="position:relative;">
      <button type="button" class="author-profile-menu-btn" onclick="window.toggleAuthorProfileMenu(event)" title="Account & Profile Menu" aria-label="Author Profile Menu">
        <img src="${avatar}" class="author-avatar-sm" alt="${escapeQuote(displayName)}" onerror="this.src='/profile.png'">
        <span class="author-name-sm">${escapeQuote(displayName)}</span>
        <span class="author-chevron">▾</span>
      </button>

      <!-- Profile Dropdown Menu -->
      <div class="author-profile-dropdown" id="author-profile-dropdown">
        <div class="author-dropdown-user-header">
          <img src="${avatar}" class="author-dropdown-avatar" alt="${escapeQuote(displayName)}" onerror="this.src='/profile.png'">
          <div style="min-width:0; flex:1;">
            <div class="author-dropdown-name">${escapeQuote(displayName)}</div>
            <div class="author-dropdown-role-badge">${roleTitle}</div>
          </div>
        </div>

        <div class="author-dropdown-divider"></div>

        <a href="#member?id=${encodeURIComponent(memberParam)}" class="author-dropdown-item" onclick="window.closeAuthorProfileMenu()">
          <span class="item-icon">👤</span> View Public Profile
        </a>
        <a href="${dashHash}" class="author-dropdown-item" onclick="window.closeAuthorProfileMenu()">
          <span class="item-icon">${isWriter ? '✍️' : '📊'}</span> ${roleTitle} Dashboard
        </a>
        <a href="#member?id=me" class="author-dropdown-item" onclick="window.closeAuthorProfileMenu()">
          <span class="item-icon">⚙️</span> Profile Settings
        </a>

        <div class="author-dropdown-divider"></div>

        <button type="button" class="author-dropdown-item logout-item" onclick="window.closeAuthorProfileMenu(); handleLogout();">
          <span class="item-icon">🚪</span> Log Out
        </button>
      </div>
    </div>
  `;
}

// Global UI interactive triggers
window.toggleAuthorProfileMenu = (event) => {
  if (event) event.stopPropagation();
  const dropdown = document.getElementById('author-profile-dropdown');
  if (dropdown) {
    dropdown.classList.toggle('open');
  }
};

window.closeAuthorProfileMenu = () => {
  const dropdown = document.getElementById('author-profile-dropdown');
  if (dropdown) {
    dropdown.classList.remove('open');
  }
};

window.toggleAuthorMoreNav = (event) => {
  if (event) event.stopPropagation();
  const dropdown = document.getElementById('author-more-dropdown');
  if (dropdown) {
    dropdown.classList.toggle('open');
  }
};

window.closeAuthorMoreNav = () => {
  const dropdown = document.getElementById('author-more-dropdown');
  if (dropdown) {
    dropdown.classList.remove('open');
  }
};

// Global click listeners to close dropdowns on outside click
document.addEventListener('click', (e) => {
  const profDropdown = document.getElementById('author-profile-dropdown');
  const profTrigger = document.querySelector('.author-profile-menu-btn');
  if (profDropdown && profDropdown.classList.contains('open')) {
    if (!profDropdown.contains(e.target) && (!profTrigger || !profTrigger.contains(e.target))) {
      profDropdown.classList.remove('open');
    }
  }

  const moreDropdown = document.getElementById('author-more-dropdown');
  const moreTrigger = document.querySelector('.author-more-trigger');
  if (moreDropdown && moreDropdown.classList.contains('open')) {
    if (!moreDropdown.contains(e.target) && (!moreTrigger || !moreTrigger.contains(e.target))) {
      moreDropdown.classList.remove('open');
    }
  }
});

function escapeQuote(str) {
  if (!str) return '';
  return String(str).replace(/'/g, "\\'").replace(/"/g, '&quot;');
}
