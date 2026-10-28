// Rudhra Prarthana Novels — Unified Header Controller for Public, Admin, and Writer Pages
// Manages alignment, navigation items, View Site link, profile menus, and role-specific UI states

import { t } from './i18n.js';

let originalNavHtml = null;

const PUBLIC_NAV_HTML = `
  <a href="#forms" class="nav-link" data-nav="home">Home</a>
  <a href="#forms" class="nav-link" data-nav="forms">
    Forms <span class="nav-link-badge">New</span>
  </a>
  <a href="#audio" class="nav-link" data-nav="audio">Audio Novels</a>
  <a href="#novels?category=Ongoing" class="nav-link" data-nav="whatsnew">What's New</a>
  <a href="#members" class="nav-link" data-nav="members">Members</a>
  <a href="https://tamil.pratilipi.com/user/rudhra-prarthana-605774cq1w" target="_blank" rel="noopener" class="nav-link">Pratilipi</a>
  <a href="#contact" class="nav-link" data-nav="contact">Contact</a>
  <a href="https://www.youtube.com/@rudhraprarthanaaudionovels" target="_blank" rel="noopener" class="nav-link" style="color:#C89B3C;">
    YouTube
  </a>
`;

/**
 * Determine the active header mode based on route and user
 */
export function getHeaderMode(hash) {
  if (!hash) hash = window.location.hash || '#forms';
  const clean = hash.toLowerCase();

  // On login pages, header MUST stay in public guest mode
  if (clean.startsWith('#admin-login') || clean.startsWith('#writer-login')) {
    return 'public';
  }

  // Only activate admin header if genuinely authenticated as admin
  if (clean.startsWith('#admin')) {
    const u = window.CURRENT_USER;
    if (window.IS_LOGGED_IN && u && (u.isAdmin || u.role === 'Admin' || u.role === 'administrator' || u.isAuthorSession)) {
      return 'admin';
    }
    return 'public';
  }

  // Only activate writer header if genuinely authenticated as writer
  if (clean.startsWith('#writer')) {
    const u = window.CURRENT_USER;
    if (window.IS_LOGGED_IN && u && (u.role === 'writer' || u.isWriter)) {
      return 'writer';
    }
    return 'public';
  }

  if (clean.startsWith('#member')) {
    const urlParams = new URLSearchParams(hash.split('?')[1] || '');
    const memberParam = (urlParams.get('id') || '').toLowerCase();
    if (memberParam === 'rudhra' || memberParam === 'rudhra_author' || memberParam === '2') {
      return 'author-profile';
    }
    if (window.CURRENT_USER && (memberParam === 'me' || memberParam === window.CURRENT_USER.username?.toLowerCase() || String(memberParam) === String(window.CURRENT_USER.id))) {
      const u = window.CURRENT_USER;
      if (u.role === 'writer' || u.role === 'Admin' || u.isWriter || u.isAuthor || u.isAdmin) {
        return 'author-profile';
      }
    }
  }

  return 'public';
}

/**
 * Check if the given hash or member belongs to an Author or Writer
 */
export function isAuthorWriterPage(hash, member = null) {
  const mode = getHeaderMode(hash);
  if (mode === 'admin' || mode === 'writer' || mode === 'author-profile') {
    return true;
  }
  if (member) {
    if (member.role === 'writer' || member.role === 'Admin' || member.isWriter || member.isAuthor || member.id === 'rudhra' || member.username === 'rudhra_author') {
      return true;
    }
  }
  return false;
}

/**
 * Apply or remove the scoped header for public, admin, or writer
 */
export function updateAuthorWriterHeader(isActive, member = null, routeHash = null) {
  const header = document.querySelector('.site-header');
  const navDesktop = document.querySelector('.site-header .nav-desktop');
  const authContainer = document.getElementById('header-auth-container');
  const brandLink = document.getElementById('rp-brand-link');
  const brandTagline = document.querySelector('.site-header .brand-tagline');
  if (!header) return;

  const currentHash = routeHash || window.location.hash || '#forms';
  const mode = isActive ? getHeaderMode(currentHash) : 'public';

  // Save original nav markup on first call
  if (navDesktop && !originalNavHtml) {
    originalNavHtml = navDesktop.innerHTML.trim() || PUBLIC_NAV_HTML;
  }

  // Reset mode classes
  header.classList.remove('admin-header-mode', 'writer-header-mode', 'author-header-mode');
  document.body.classList.remove('admin-header-view', 'writer-header-view', 'author-page-view');

  if (mode === 'admin') {
    header.classList.add('admin-header-mode', 'author-header-mode');
    document.body.classList.add('admin-header-view', 'author-page-view');

    // Update Brand Link & Tagline
    if (brandLink) {
      brandLink.setAttribute('href', '#admin');
      brandLink.setAttribute('title', 'Rudhra Prarthana — Author & Admin Workspace');
    }
    if (brandTagline) {
      brandTagline.textContent = 'Author & Admin Workspace';
    }

    // Render Admin Center Navigation
    if (navDesktop) {
      navDesktop.innerHTML = getAdminNavHtml(currentHash);
      navDesktop.classList.add('admin-nav-active', 'author-nav-active');
    }

    // Render Admin Right-Side Actions (View Site + Profile Menu)
    if (authContainer) {
      authContainer.innerHTML = getAdminAuthHtml(member);
    }
  } else if (mode === 'writer') {
    header.classList.add('writer-header-mode', 'author-header-mode');
    document.body.classList.add('writer-header-view', 'author-page-view');

    // Update Brand Link & Tagline
    if (brandLink) {
      brandLink.setAttribute('href', '#writer');
      brandLink.setAttribute('title', 'Rudhra Prarthana — Writer Workspace');
    }
    if (brandTagline) {
      brandTagline.textContent = 'Writer Workspace';
    }

    // Render Writer Center Navigation
    if (navDesktop) {
      navDesktop.innerHTML = getWriterNavHtml(currentHash);
      navDesktop.classList.add('writer-nav-active', 'author-nav-active');
    }

    // Render Writer Right-Side Actions (View Site + Profile Menu)
    if (authContainer) {
      authContainer.innerHTML = getWriterAuthHtml(member);
    }
  } else if (mode === 'author-profile') {
    header.classList.add('author-header-mode');
    document.body.classList.add('author-page-view');

    if (brandLink) {
      brandLink.setAttribute('href', '#forms');
      brandLink.setAttribute('title', 'Rudhra Prarthana Novels');
    }
    if (brandTagline) {
      brandTagline.textContent = 'Novels & Community';
    }

    if (navDesktop) {
      navDesktop.innerHTML = PUBLIC_NAV_HTML;
      navDesktop.classList.remove('admin-nav-active', 'writer-nav-active', 'author-nav-active');
    }

    if (authContainer) {
      authContainer.innerHTML = getAuthorProfileAuthHtml(member);
    }
  } else {
    // Mode is 'public' — strictly preserve public website header
    if (brandLink) {
      brandLink.setAttribute('href', '#forms');
      brandLink.setAttribute('title', 'Rudhra Prarthana Novels');
    }
    if (brandTagline) {
      brandTagline.textContent = 'Novels & Community';
    }

    if (navDesktop) {
      navDesktop.innerHTML = originalNavHtml || PUBLIC_NAV_HTML;
      navDesktop.classList.remove('admin-nav-active', 'writer-nav-active', 'author-nav-active');
    }

    if (typeof window.updateHeaderUserArea === 'function') {
      window.updateHeaderUserArea();
    }
  }
}

/**
 * Return Admin Center Navigation HTML
 */
function getAdminNavHtml(hash) {
  const urlParams = new URLSearchParams((hash || '').split('?')[1] || '');
  const activeTab = urlParams.get('tab') || 'overview';

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'novels', label: 'Novels', aliases: ['novel-create', 'novels'] },
    { id: 'audio', label: 'Audio' },
    { id: 'episodes', label: 'Episodes' },
    { id: 'stories', label: 'Stories' },
    { id: 'forms', label: 'Forms & Content' },
    { id: 'scheduler', label: 'Scheduler' },
    { id: 'writers', label: 'Writers' },
    { id: 'settings', label: 'Settings' }
  ];

  return tabs.map(t => {
    const isAct = t.id === activeTab || (t.aliases && t.aliases.includes(activeTab));
    return `
      <a href="#admin?tab=${t.id}" 
         class="nav-link admin-header-nav-link ${isAct ? 'active' : ''}" 
         data-admin-tab="${t.id}"
         onclick="if (typeof window.switchAdminTab === 'function') { window.switchAdminTab('${t.id}'); }">
        ${t.label}
      </a>
    `;
  }).join('');
}

/**
 * Return Writer Center Navigation HTML (Strictly Writer-Safe, No Admin Overlap)
 */
function getWriterNavHtml(hash) {
  const urlParams = new URLSearchParams((hash || '').split('?')[1] || '');
  const activeTab = urlParams.get('tab') || 'overview';

  const tabs = [
    { id: 'overview', label: 'Dashboard' },
    { id: 'novels', label: 'My Novels' },
    { id: 'episodes', label: 'Episodes' },
    { id: 'editor', label: 'Writing Editor' },
    { id: 'submissions', label: 'Submissions' },
    { id: 'guidelines', label: 'Guidelines' },
    { id: 'profile', label: 'Profile' }
  ];

  return tabs.map(t => {
    const isAct = t.id === activeTab;
    return `
      <a href="#writer?tab=${t.id}" 
         class="nav-link writer-header-nav-link ${isAct ? 'active' : ''}" 
         data-writer-tab="${t.id}"
         onclick="if (typeof window.switchWriterTab === 'function') { window.switchWriterTab('${t.id}'); }">
        ${t.label}
      </a>
    `;
  }).join('');
}

/**
 * Return Admin Right-Side Actions HTML (Admin Profile Menu)
 */
function getAdminAuthHtml(member) {
  const user = window.CURRENT_USER;
  if (!user || !window.IS_LOGGED_IN) {
    return `
      <button class="btn btn-gold btn-sm" onclick="openAuthModal('login')">${t('btn_login') || 'Log In'}</button>
      <button class="btn btn-outline btn-sm" onclick="openAuthModal('register')">${t('btn_register') || 'Register'}</button>
    `;
  }
  const displayName = user.displayName || user.username || 'Rudhra Prarthana';
  const rawAvatar = user.avatar;
  const avatar = (rawAvatar && !rawAvatar.includes('images.unsplash.com') && !rawAvatar.includes('ui-avatars.com')) 
    ? rawAvatar 
    : '/images/logo.png';
  const memberParam = user.username || (user.id ? String(user.id) : 'rudhra_author');

  return `
    <!-- Admin Profile Menu Trigger -->
    <div class="author-profile-menu-wrap" style="position:relative;">
      <button type="button" class="author-profile-menu-btn" onclick="window.toggleAuthorProfileMenu(event)" title="Admin Account Menu" aria-label="Admin Profile Menu" aria-expanded="false">
        <img src="${avatar}" class="author-avatar-sm" alt="${escapeQuote(displayName)}" onerror="this.src='/images/logo.png'">
        <span class="author-name-sm">${escapeQuote(displayName)}</span>
        <span class="author-role-pill admin">Admin</span>
        <span class="author-chevron" aria-hidden="true">▼</span>
      </button>

      <!-- Profile Dropdown Menu -->
      <div class="author-profile-dropdown" id="author-profile-dropdown" role="menu">
        <div class="author-dropdown-user-header">
          <img src="${avatar}" class="author-dropdown-avatar" alt="${escapeQuote(displayName)}" onerror="this.src='/images/logo.png'">
          <div style="min-width:0; flex:1;">
            <div class="author-dropdown-name">${escapeQuote(displayName)}</div>
            <div class="author-dropdown-role-badge">Author &amp; Admin</div>
          </div>
        </div>

        <div class="author-dropdown-divider"></div>

        <a href="#member?id=${encodeURIComponent(memberParam)}" class="author-dropdown-item" onclick="window.closeAuthorProfileMenu()" role="menuitem">
          <span class="item-icon">👤</span> View Public Profile
        </a>
        <a href="#admin" class="author-dropdown-item" onclick="window.closeAuthorProfileMenu()" role="menuitem">
          <span class="item-icon">📊</span> Admin Dashboard
        </a>
        <a href="#member?id=me" class="author-dropdown-item" onclick="window.closeAuthorProfileMenu()" role="menuitem">
          <span class="item-icon">⚙️</span> Profile Settings
        </a>
        <a href="#followers" class="author-dropdown-item" onclick="window.closeAuthorProfileMenu()" role="menuitem">
          <span class="item-icon">👥</span> Followers &amp; Following
        </a>

        <div class="author-dropdown-divider"></div>

        <button type="button" class="author-dropdown-item logout-item" onclick="window.closeAuthorProfileMenu(); handleLogout();" role="menuitem">
          <span class="item-icon">🚪</span> Log Out
        </button>
      </div>
    </div>
  `;
}

/**
 * Return Writer Right-Side Actions HTML (View Site + Writer Profile Menu)
 */
function getWriterAuthHtml(member) {
  const user = window.CURRENT_USER;
  if (!user || !window.IS_LOGGED_IN) {
    return `
      <button class="btn btn-gold btn-sm" onclick="openAuthModal('login')">${t('btn_login') || 'Log In'}</button>
      <button class="btn btn-outline btn-sm" onclick="openAuthModal('register')">${t('btn_register') || 'Register'}</button>
    `;
  }
  const displayName = user.displayName || user.username || 'Writer';
  const rawAvatar = user.avatar;
  const avatar = (rawAvatar && !rawAvatar.includes('images.unsplash.com') && !rawAvatar.includes('ui-avatars.com')) 
    ? rawAvatar 
    : '/profile.png';
  const memberParam = user.username || (user.id ? String(user.id) : 'me');

  return `
    <!-- View Public Reader Website Button -->
    <a href="#forms" target="_blank" rel="noopener" class="btn btn-outline btn-sm author-header-viewsite-btn" title="Open Public Reader Website (#forms)">
      <span>View Site</span>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
        <polyline points="15 3 21 3 21 9"></polyline>
        <line x1="10" y1="14" x2="21" y2="3"></line>
      </svg>
    </a>

    <!-- Writer Profile Menu Trigger -->
    <div class="author-profile-menu-wrap" style="position:relative;">
      <button type="button" class="author-profile-menu-btn" onclick="window.toggleAuthorProfileMenu(event)" title="Writer Account Menu" aria-label="Writer Profile Menu" aria-expanded="false">
        <img src="${avatar}" class="author-avatar-sm" alt="${escapeQuote(displayName)}" onerror="this.src='/profile.png'">
        <span class="author-name-sm">${escapeQuote(displayName)}</span>
        <span class="author-role-pill writer">Writer</span>
        <span class="author-chevron" aria-hidden="true">▼</span>
      </button>

      <!-- Profile Dropdown Menu -->
      <div class="author-profile-dropdown" id="author-profile-dropdown" role="menu">
        <div class="author-dropdown-user-header">
          <img src="${avatar}" class="author-dropdown-avatar" alt="${escapeQuote(displayName)}" onerror="this.src='/profile.png'">
          <div style="min-width:0; flex:1;">
            <div class="author-dropdown-name">${escapeQuote(displayName)}</div>
            <div class="author-dropdown-role-badge writer">Authorized Writer</div>
          </div>
        </div>

        <div class="author-dropdown-divider"></div>

        <a href="#member?id=${encodeURIComponent(memberParam)}" class="author-dropdown-item" onclick="window.closeAuthorProfileMenu()" role="menuitem">
          <span class="item-icon">👤</span> View Public Profile
        </a>
        <a href="#writer" class="author-dropdown-item" onclick="window.closeAuthorProfileMenu()" role="menuitem">
          <span class="item-icon">✍️</span> Writer Dashboard
        </a>
        <a href="#member?id=me" class="author-dropdown-item" onclick="window.closeAuthorProfileMenu()" role="menuitem">
          <span class="item-icon">⚙️</span> Profile Settings
        </a>
        <a href="#followers" class="author-dropdown-item" onclick="window.closeAuthorProfileMenu()" role="menuitem">
          <span class="item-icon">👥</span> Followers &amp; Following
        </a>

        <div class="author-dropdown-divider"></div>

        <button type="button" class="author-dropdown-item logout-item" onclick="window.closeAuthorProfileMenu(); if (typeof handleWriterLogout === 'function') handleWriterLogout(); else handleLogout();" role="menuitem">
          <span class="item-icon">🚪</span> Log Out
        </button>
      </div>
    </div>
  `;
}

/**
 * Return Author Profile Page Auth HTML (when on public profile #member?id=rudhra)
 */
function getAuthorProfileAuthHtml(member) {
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
  const dashLabel = isWriter ? '✍️ WD' : '📊 AD';

  const displayName = user.displayName || user.username || 'Author';
  const rawAvatar = user.avatar;
  const avatar = (rawAvatar && !rawAvatar.includes('images.unsplash.com') && !rawAvatar.includes('ui-avatars.com')) 
    ? rawAvatar 
    : '/profile.png';
  const memberParam = user.username || (user.id ? String(user.id) : 'me');

  return `
    <a href="${dashHash}" class="btn btn-gold author-header-dash-btn" title="Go to Dashboard">
      ${dashLabel}
    </a>

    <div class="author-profile-menu-wrap" style="position:relative;">
      <button type="button" class="author-profile-menu-btn" onclick="window.toggleAuthorProfileMenu(event)" title="Account Menu" aria-label="Profile Menu">
        <img src="${avatar}" class="author-avatar-sm" alt="${escapeQuote(displayName)}" onerror="this.src='/profile.png'">
        <span class="author-name-sm">${escapeQuote(displayName)}</span>
        <span class="author-chevron">▼</span>
      </button>

      <div class="author-profile-dropdown" id="author-profile-dropdown">
        <div class="author-dropdown-user-header">
          <img src="${avatar}" class="author-dropdown-avatar" alt="${escapeQuote(displayName)}" onerror="this.src='/profile.png'">
          <div style="min-width:0; flex:1;">
            <div class="author-dropdown-name">${escapeQuote(displayName)}</div>
            <div class="author-dropdown-role-badge">${isAdmin ? 'Admin' : 'Writer'}</div>
          </div>
        </div>

        <div class="author-dropdown-divider"></div>

        <a href="#member?id=${encodeURIComponent(memberParam)}" class="author-dropdown-item" onclick="window.closeAuthorProfileMenu()">
          <span class="item-icon">👤</span> View Public Profile
        </a>
        <a href="${dashHash}" class="author-dropdown-item" onclick="window.closeAuthorProfileMenu()">
          <span class="item-icon">${isWriter ? '✍️' : '📊'}</span> ${isWriter ? 'Writer' : 'Admin'} Dashboard
        </a>
        <a href="#member?id=me" class="author-dropdown-item" onclick="window.closeAuthorProfileMenu()">
          <span class="item-icon">⚙️</span> Profile Settings
        </a>
        <a href="#followers" class="author-dropdown-item" onclick="window.closeAuthorProfileMenu()" role="menuitem">
          <span class="item-icon">👥</span> Followers &amp; Following
        </a>

        <div class="author-dropdown-divider"></div>

        <button type="button" class="author-dropdown-item logout-item" onclick="window.closeAuthorProfileMenu(); handleLogout();">
          <span class="item-icon">🚪</span> Log Out
        </button>
      </div>
    </div>
  `;
}

/**
 * Update active tab highlight in the top admin header bar
 */
window.updateAdminHeaderActiveTab = (tab) => {
  document.querySelectorAll('.admin-header-nav-link').forEach(link => {
    link.classList.remove('active');
    if (link.getAttribute('data-admin-tab') === tab || 
        (tab === 'novel-create' && link.getAttribute('data-admin-tab') === 'novels')) {
      link.classList.add('active');
    }
  });
};

/**
 * Update active tab highlight in the top writer header bar
 */
window.updateWriterHeaderActiveTab = (tab) => {
  document.querySelectorAll('.writer-header-nav-link').forEach(link => {
    link.classList.remove('active');
    if (link.getAttribute('data-writer-tab') === tab) {
      link.classList.add('active');
    }
  });
};

// Global Interactive Dropdown Controls
window.toggleAuthorProfileMenu = (event) => {
  if (event) event.stopPropagation();
  const dropdown = document.getElementById('author-profile-dropdown');
  const btn = document.querySelector('.author-profile-menu-btn');
  if (dropdown) {
    const willOpen = !dropdown.classList.contains('open');
    dropdown.classList.toggle('open', willOpen);
    if (btn) btn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
  }
};

window.closeAuthorProfileMenu = () => {
  const dropdown = document.getElementById('author-profile-dropdown');
  const btn = document.querySelector('.author-profile-menu-btn');
  if (dropdown) dropdown.classList.remove('open');
  if (btn) btn.setAttribute('aria-expanded', 'false');
};

// Global click listener to close dropdowns on outside click
document.addEventListener('click', (e) => {
  const profDropdown = document.getElementById('author-profile-dropdown');
  const profTrigger = document.querySelector('.author-profile-menu-btn');
  if (profDropdown && profDropdown.classList.contains('open')) {
    if (!profDropdown.contains(e.target) && (!profTrigger || !profTrigger.contains(e.target))) {
      window.closeAuthorProfileMenu();
    }
  }
});

function escapeQuote(str) {
  if (!str) return '';
  return String(str).replace(/'/g, "\\'").replace(/"/g, '&quot;');
}
