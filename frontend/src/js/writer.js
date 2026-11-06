
if (typeof window !== 'undefined' && !window.showSavedContentLinkModal) {
  window.showSavedContentLinkModal = ({ title, type, contentLink }) => {
    const existing = document.getElementById('saved-content-link-modal');
    if (existing) existing.remove();

    const fullLink = (contentLink && contentLink.startsWith('http')) 
      ? contentLink 
      : `${window.location.origin}/${(contentLink || '').startsWith('#') ? contentLink : '#' + (contentLink || '')}`;

    const modal = document.createElement('div');
    modal.id = 'saved-content-link-modal';
    modal.className = 'admin-modal-backdrop';
    modal.style.cssText = 'position:fixed; inset:0; background:rgba(15,23,42,0.65); z-index:999999; display:flex; align-items:center; justify-content:center; padding:16px; backdrop-filter:blur(3px);';
    modal.innerHTML = `
      <div class="admin-modal-box" onclick="event.stopPropagation()" style="background:#FFFFFF; border-radius:16px; width:100%; max-width:540px; padding:28px; box-shadow:0 24px 48px rgba(0,0,0,0.25); text-align:center; border:1px solid #E8DCCB;">
        <div style="font-size:46px; line-height:1; margin-bottom:12px;">✅</div>
        <h3 style="font-family:'Playfair Display',serif; font-size:1.5rem; color:#0B1F33; margin:0 0 8px;">
          ${title || 'Content'} Saved Successfully!
        </h3>
        <p style="color:#64748B; font-size:13.5px; margin:0 0 20px; line-height:1.6;">
          Content has been saved in your dashboard. To publish this content to readers, copy the unique content link below and post it via <strong>Post thread</strong> on the frontend category page.
        </p>

        <div style="background:#FAF8F5; border:1px solid #E8DCCB; border-radius:10px; padding:14px; margin-bottom:20px; text-align:left;">
          <label style="font-size:11px; font-weight:700; color:#856404; text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:6px;">
            Generated Unique Content Link
          </label>
          <div style="display:flex; gap:8px;">
            <input type="text" id="generated-content-link-input" readonly value="${fullLink}" class="form-input" style="font-family:monospace; font-size:12.5px; background:#FFFFFF; flex:1; padding:8px 10px; border:1px solid #CBD5E1; border-radius:6px;" onclick="this.select()">
            <button type="button" class="btn btn-gold btn-sm" id="btn-copy-modal-link" onclick="window.copyGeneratedModalLink('${fullLink}')" style="display:inline-flex; align-items:center; gap:6px; font-weight:700; white-space:nowrap; padding:8px 14px;">
              📋 Copy Link
            </button>
          </div>
        </div>

        <div style="display:flex; justify-content:center; gap:12px;">
          <button type="button" class="btn btn-outline btn-sm" onclick="document.getElementById('saved-content-link-modal')?.remove()" style="padding:8px 18px;">
            Done
          </button>
          <a href="#forms" class="btn btn-gold btn-sm" onclick="document.getElementById('saved-content-link-modal')?.remove()" style="display:inline-flex; align-items:center; gap:6px; padding:8px 18px; text-decoration:none;">
            Go to Categories ➔
          </a>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  };

  window.copyGeneratedModalLink = (link) => {
    navigator.clipboard.writeText(link).then(() => {
      const btn = document.getElementById('btn-copy-modal-link');
      if (btn) btn.innerHTML = '✓ Copied!';
      showToast('Unique content link copied to clipboard! 📋');
    }).catch(() => {
      const input = document.getElementById('generated-content-link-input');
      if (input) {
        input.select();
        document.execCommand('copy');
        showToast('Unique content link copied to clipboard! 📋');
      }
    });
  };
}


export function escapeQuote(str) {
  if (!str) return '';
  return String(str).replace(/"/g, '&quot;').replace(/'/g, "\'");
}
export const escapeQuotes = escapeQuote;

if (typeof window !== 'undefined') {
  window.escapeQuote = escapeQuote;
  window.escapeQuotes = escapeQuote;
  window.onWriterMinuteType = function(inputEl, selectId) {
    let val = inputEl.value;
    if (val === '') {
      window.updateWriterSchedPreview && window.updateWriterSchedPreview();
      return;
    }
    let num = parseInt(val, 10);
    if (!isNaN(num)) {
      if (num > 59) { num = 59; inputEl.value = '59'; }
      if (num < 0) { num = 0; inputEl.value = '00'; }
      const padded = String(num).padStart(2, '0');
      const sel = document.getElementById(selectId);
      if (sel) sel.value = padded;
    }
    window.updateWriterSchedPreview && window.updateWriterSchedPreview();
  };
  window.normalizeWriterMinuteOnBlur = function(inputEl, selectId) {
    const normalized = window.validateAndNormalizeMinute ? window.validateAndNormalizeMinute(inputEl.value) : String(Math.max(0, Math.min(59, parseInt(inputEl.value || 0, 10)))).padStart(2, '0');
    inputEl.value = normalized;
    const sel = document.getElementById(selectId);
    if (sel) sel.value = normalized;
    window.updateWriterSchedPreview && window.updateWriterSchedPreview();
  };
  window.onWriterMinuteSelect = function(selectEl, inputId) {
    const input = document.getElementById(inputId);
    if (input) input.value = selectEl.value;
    window.updateWriterSchedPreview && window.updateWriterSchedPreview();
  };
  window.onWriterReschedMinuteType = function(inputEl, selectId) {
    let val = inputEl.value;
    if (val === '') {
      window.updateWriterReschedPreview && window.updateWriterReschedPreview();
      return;
    }
    let num = parseInt(val, 10);
    if (!isNaN(num)) {
      if (num > 59) { num = 59; inputEl.value = '59'; }
      if (num < 0) { num = 0; inputEl.value = '00'; }
      const padded = String(num).padStart(2, '0');
      const sel = document.getElementById(selectId);
      if (sel) sel.value = padded;
    }
    window.updateWriterReschedPreview && window.updateWriterReschedPreview();
  };
  window.normalizeWriterReschedMinuteOnBlur = function(inputEl, selectId) {
    const normalized = window.validateAndNormalizeMinute ? window.validateAndNormalizeMinute(inputEl.value) : String(Math.max(0, Math.min(59, parseInt(inputEl.value || 0, 10)))).padStart(2, '0');
    inputEl.value = normalized;
    const sel = document.getElementById(selectId);
    if (sel) sel.value = normalized;
    window.updateWriterReschedPreview && window.updateWriterReschedPreview();
  };
  window.onWriterReschedMinuteSelect = function(selectEl, inputId) {
    const input = document.getElementById(inputId);
    if (input) input.value = selectEl.value;
    window.updateWriterReschedPreview && window.updateWriterReschedPreview();
  };
}

// Rudhra Prarthana Novels — Professional Writer Dashboard & Novel Writing Workspace
// Minimal, distraction-free writing environment connected directly to MySQL backend

import { apiFetch } from './errors.js';
import { showToast } from './reader.js';
import { ADMIN_ICONS } from './admin.js';
import { updateHeaderUserArea } from './auth.js';

// Global Writer State
export const writerState = {
  activeTab: 'overview', // 'overview' | 'novels' | 'write' | 'episodes' | 'editor' | 'status' | 'profile'
  user: null,
  stats: null,
  novels: [],
  selectedNovelId: null,
  episodes: [],
  currentNovel: null,
  currentEpisode: null,
  saveStatus: 'saved', // 'saved' | 'saving' | 'unsaved'
  editorDirty: false,
  autosaveTimer: null
};
window.writerState = writerState;

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ========================================================
   1. MAIN WRITER DASHBOARD CONTROLLER
   ======================================================== */
export async function renderWriterDashboard(container, requestedTab) {
  // Loading guard
  container.innerHTML = `
    <div class="writer-dashboard" style="min-height:80vh; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:16px;">
      <div style="width:38px; height:38px; border:3px solid #E2E8F0; border-top-color:#B88635; border-radius:50%; animation:writerSpin 0.8s linear infinite;"></div>
      <div style="font-family:'Playfair Display',serif; font-size:16px; color:#0B1F33; font-weight:600;">
        Connecting to Writer Workspace...
      </div>
      <style>@keyframes writerSpin { to { transform: rotate(360deg); } }</style>
    </div>
  `;

  // Verify Writer / Author Session with Backend
  const token = localStorage.getItem('rp_auth_token');
  if (!token) {
    sessionStorage.setItem('rp_admin_redirect', '#writer');
    showToast('Please log in to access your Writer Workspace.');
    window.location.hash = '#writer-login';
    return;
  }

  let sessionUser = null;
  try {
    const res = await apiFetch('/api/writer/enhanced-workspace');
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || 'Access denied: Active Writer session required.');
        sessionStorage.setItem('rp_admin_redirect', '#writer');
        window.location.hash = '#writer-login';
        return;
      }
      throw new Error('Failed to load writer workspace');
    }

    const data = await res.json();
    sessionUser = data.writer;
    writerState.user = data.writer;
    writerState.stats = data.stats || {
      novelsCount: 0,
      draftsCount: 0,
      publishedNovelsCount: 0,
      episodesCount: 0,
      totalViews: 0
    };
    writerState.novels = data.novels || [];
    writerState.permissions = data.permissions || { canNovels: 1, canShortStories: 0, canAudioNovels: 0, canEpisodes: 1, accessLevel: 'review_required', fullAccess: 0 };
    writerState.assignments = data.assignments || [];
    writerState.assignmentsCount = data.assignmentsCount || (data.assignments || []).length;
    writerState.submissions = data.submissions || [];
    writerState.pendingSubmissionsCount = data.pendingSubmissionsCount || 0;
    writerState.changesRequestedCount = data.changesRequestedCount || 0;
    writerState.shortStories = data.shortStories || [];
    writerState.audioNovels = data.audioNovels || [];
    window.CURRENT_USER = data.writer;
    window.IS_LOGGED_IN = true;
    updateHeaderUserArea();
  } catch (err) {
    console.error('Writer workspace auth error:', err);
    container.innerHTML = `
      <div class="writer-dashboard" style="min-height:80vh; display:flex; align-items:center; justify-content:center; padding:20px;">
        <div class="writer-card" style="max-width:480px; text-align:center; padding:36px 28px;">
          <div style="font-size:42px; margin-bottom:12px;">🔒</div>
          <h2 class="writer-header-title" style="margin-bottom:8px; font-size:22px;">Authentication Required</h2>
          <p style="color:#64748B; font-size:14px; line-height:1.6; margin-bottom:20px;">
            ${escapeHtml(err.message || 'Please log in with your authorized Writer account.')}
          </p>
          <div style="display:flex; justify-content:center; gap:12px;">
            <a href="#forms" class="btn btn-outline">« Reader Home</a>
            <a href="#writer-login" class="btn btn-gold">Author & Writer Login »</a>
          </div>
        </div>
      </div>
    `;
    return;
  }

  if (requestedTab) {
    writerState.activeTab = requestedTab;
  }

  const TAB_TITLES = {
    overview: 'Overview',
    novels: 'My Novels',
    write: 'Write Novel',
    episodes: 'Manage Episodes',
    editor: 'Writing Editor',
    'published-novels': 'Published Novel Management',
    status: 'Publishing Status',
    trash: 'Recycle Bin',
    profile: 'Profile & Password'
  };

  // Render Writer Shell Layout with strictly 8 essential sidebar items
  container.innerHTML = `
    <div class="writer-dashboard">
      <!-- Mobile Bar -->
      <header class="admin-top-bar" role="banner" style="background:#0B1F33; border-bottom:1px solid rgba(255,255,255,0.08);">
        <button type="button" id="writer-mobile-toggle" class="admin-mobile-toggle-btn" 
                aria-label="Toggle Navigation Menu" aria-expanded="false" 
                onclick="toggleWriterMobileNav()">
          <span class="hamburger-icon" aria-hidden="true">
            <span></span><span></span><span></span>
          </span>
          <span class="admin-mobile-toggle-label" style="color:#FFFFFF;">Menu</span>
        </button>
        
        <span id="writer-top-bar-current-tab" class="admin-top-current-tab" style="color:#FFFFFF;">
          ${TAB_TITLES[writerState.activeTab] || 'Writer Dashboard'}
        </span>

        <a href="#forms" class="admin-mobile-site-btn" title="View Reader Site" style="color:#E2E8F0;">
          ${ADMIN_ICONS.externalLink}
        </a>
      </header>

      <!-- Mobile Backdrop -->
      <div id="writer-sidebar-backdrop" class="admin-sidebar-backdrop" onclick="toggleWriterMobileNav(false)" aria-hidden="true"></div>

      <div class="writer-shell">
        <!-- Sidebar Navigation: ONLY 8 essential items -->
        <aside class="writer-sidebar" id="writer-sidebar-nav" aria-label="Writer Navigation">
          <!-- Mobile Drawer Header -->
          <div class="admin-drawer-header" style="border-bottom:1px solid rgba(255,255,255,0.08); padding:16px 20px;">
            <span class="admin-drawer-title" style="color:#FFFFFF; font-size:15px; font-weight:600;">Writer Menu</span>
            <button type="button" class="admin-drawer-close-btn" aria-label="Close navigation" onclick="toggleWriterMobileNav(false)" style="color:#94A3B8;">
              ✕
            </button>
          </div>

          <!-- Writer Identity -->
          <div class="writer-sidebar-user">
            <div class="writer-avatar-circle">
              ${sessionUser.avatar && sessionUser.avatar !== '/profile.png' ? `
                <img src="${escapeHtml(sessionUser.avatar)}" alt="${escapeHtml(sessionUser.name || sessionUser.username)}">
              ` : `
                <span class="writer-avatar-initial">${escapeHtml((sessionUser.name || sessionUser.username || 'W')[0].toUpperCase())}</span>
              `}
            </div>
            <div class="writer-user-info">
              <div class="writer-user-name">${escapeHtml(sessionUser.name || sessionUser.username)}</div>
              <span class="writer-user-role">Writer</span>
            </div>
          </div>

          <!-- Dynamic Permissions-Aware Navigation Items -->
          <nav class="writer-nav-list" aria-label="Writer Workspace Navigation">
            <!-- 1. Overview -->
            <button type="button" class="writer-nav-btn ${writerState.activeTab === 'overview' ? 'active' : ''}" 
                    onclick="switchWriterTab('overview')">
              <span class="writer-nav-btn-content">
                ${ADMIN_ICONS.grid}
                <span>Overview</span>
              </span>
            </button>

            <!-- 2. My Assignments -->
            <button type="button" class="writer-nav-btn ${writerState.activeTab === 'assignments' ? 'active' : ''}" 
                    onclick="switchWriterTab('assignments')">
              <span class="writer-nav-btn-content">
                ${ADMIN_ICONS.feather || ADMIN_ICONS.edit}
                <span>My Assignments</span>
              </span>
              <span class="writer-nav-pill" id="wnav-assignments-count" style="background:#EDE9FE; color:#5B21B6;">${writerState.assignmentsCount || 0}</span>
            </button>

            <!-- 3. My Novels (if permitted) -->
            ${(!writerState.permissions || writerState.permissions.canNovels) ? `
              <button type="button" class="writer-nav-btn ${writerState.activeTab === 'novels' ? 'active' : ''}" 
                      onclick="switchWriterTab('novels')">
                <span class="writer-nav-btn-content">
                  ${ADMIN_ICONS.book}
                  <span>My Novels</span>
                </span>
                <span class="writer-nav-pill" id="wnav-novels-count">${writerState.novels.length}</span>
              </button>
            ` : ''}

            <!-- 4. My Short Stories (if permitted) -->
            ${(writerState.permissions && writerState.permissions.canShortStories) ? `
              <button type="button" class="writer-nav-btn ${writerState.activeTab === 'short-stories' ? 'active' : ''}" 
                      onclick="switchWriterTab('short-stories')">
                <span class="writer-nav-btn-content">
                  ${ADMIN_ICONS.feather || ADMIN_ICONS.book}
                  <span>My Short Stories</span>
                </span>
                <span class="writer-nav-pill" id="wnav-stories-count">${writerState.shortStories?.length || 0}</span>
              </button>
            ` : ''}

            <!-- 5. My Audio Novels (if permitted) -->
            ${(writerState.permissions && writerState.permissions.canAudioNovels) ? `
              <button type="button" class="writer-nav-btn ${writerState.activeTab === 'audio-novels' ? 'active' : ''}" 
                      onclick="switchWriterTab('audio-novels')">
                <span class="writer-nav-btn-content">
                  ${ADMIN_ICONS.headphones || ADMIN_ICONS.book}
                  <span>My Audio Novels</span>
                </span>
                <span class="writer-nav-pill" id="wnav-audio-count">${writerState.audioNovels?.length || 0}</span>
              </button>
            ` : ''}

            <!-- Novel Content Writing -->
            <button type="button" class="writer-nav-btn ${writerState.activeTab === 'editor' ? 'active' : ''}" 
                    onclick="switchWriterTab('editor')">
              <span class="writer-nav-btn-content">
                ${ADMIN_ICONS.edit}
                <span>Novel Writing</span>
              </span>
            </button>

            <!-- Published Novel Management -->
            <button type="button" class="writer-nav-btn ${writerState.activeTab === 'published-novels' ? 'active' : ''}" 
                    onclick="switchWriterTab('published-novels')">
              <span class="writer-nav-btn-content">
                <span>📚</span>
                <span>Published Novels</span>
              </span>
              <span class="writer-nav-pill" id="wnav-published-count">-</span>
            </button>

            <!-- 6. Manage Episodes (if permitted) -->
            ${(!writerState.permissions || writerState.permissions.canEpisodes) ? `
              <button type="button" class="writer-nav-btn ${writerState.activeTab === 'episodes' ? 'active' : ''}" 
                      onclick="switchWriterTab('episodes')">
                <span class="writer-nav-btn-content">
                  ${ADMIN_ICONS.episodes}
                  <span>Manage Episodes</span>
                </span>
                <span class="writer-nav-pill" id="wnav-episodes-count">${writerState.stats?.episodesCount || 0}</span>
              </button>
            ` : ''}

            <!-- 7. Publication Schedule -->
            <button type="button" class="writer-nav-btn ${writerState.activeTab === 'schedule' ? 'active' : ''}" 
                    onclick="switchWriterTab('schedule')">
              <span class="writer-nav-btn-content">
                ${ADMIN_ICONS.clock}
                <span>Publication Schedule</span>
              </span>
              <span class="writer-nav-pill" id="wnav-sched-count">${writerState.stats?.scheduledCount || 0}</span>
            </button>

            <!-- 8. Publishing Status & Reviews -->
            <button type="button" class="writer-nav-btn ${writerState.activeTab === 'status' ? 'active' : ''}" 
                    onclick="switchWriterTab('status')">
              <span class="writer-nav-btn-content">
                ${ADMIN_ICONS.checkCircle}
                <span>Status &amp; Reviews</span>
              </span>
              ${writerState.changesRequestedCount > 0 ? `
                <span class="writer-nav-pill" style="background:#FEE2E2; color:#991B1B;" title="Revisions Requested">${writerState.changesRequestedCount} ⚠️</span>
              ` : (writerState.pendingSubmissionsCount > 0 ? `
                <span class="writer-nav-pill" style="background:#FEF3C7; color:#92400E;">${writerState.pendingSubmissionsCount}</span>
              ` : '')}
            </button>

            <!-- 9. Notifications -->
            <button type="button" class="writer-nav-btn ${writerState.activeTab === 'notifications' ? 'active' : ''}" 
                    onclick="switchWriterTab('notifications')">
              <span class="writer-nav-btn-content">
                ${ADMIN_ICONS.bell || ADMIN_ICONS.episodes}
                <span>Notifications</span>
              </span>
            </button>

            <!-- Recycle Bin / Trash -->
            <button type="button" class="writer-nav-btn ${writerState.activeTab === 'trash' ? 'active' : ''}" 
                    onclick="switchWriterTab('trash')">
              <span class="writer-nav-btn-content">
                ${ADMIN_ICONS.trash}
                <span>Recycle Bin</span>
              </span>
              <span class="writer-nav-pill" id="wnav-trash-count" style="background:#FEE2E2; color:#991B1B; ${writerState.trashCount ? '' : 'display:none;'}">${writerState.trashCount || 0}</span>
            </button>

            <!-- 10. Profile & Password -->
            <button type="button" class="writer-nav-btn ${writerState.activeTab === 'profile' ? 'active' : ''}" 
                    onclick="switchWriterTab('profile')">
              <span class="writer-nav-btn-content">
                ${ADMIN_ICONS.settings}
                <span>Profile & Password</span>
              </span>
            </button>
          </nav>

          <!-- Sidebar Footer: 7. Community Site, 8. Sign Out -->
          <div class="writer-sidebar-footer">
            <a href="#forms" class="writer-footer-link" title="View Reader Site">
              ${ADMIN_ICONS.externalLink}
              <span>Community Site</span>
            </a>
            <button type="button" class="writer-footer-link logout-btn" onclick="handleWriterLogout()" title="Sign Out of Writer Workspace">
              ${ADMIN_ICONS.logout}
              <span>Sign Out</span>
            </button>
          </div>
        </aside>

        <!-- Main Content Canvas -->
        <main class="writer-canvas" id="writer-main-canvas" role="main" tabindex="-1">
          <!-- Dynamically populated based on activeTab -->
        </main>
      </div>
    </div>
  `;

  // Window methods for navigation
  window.toggleWriterMobileNav = (forceState) => {
    const sidebar = document.getElementById('writer-sidebar-nav');
    const backdrop = document.getElementById('writer-sidebar-backdrop');
    const toggleBtn = document.getElementById('writer-mobile-toggle');
    if (!sidebar) return;

    const isOpen = forceState !== undefined ? forceState : !sidebar.classList.contains('drawer-open');
    if (isOpen) {
      sidebar.classList.add('drawer-open');
      if (backdrop) backdrop.classList.add('active');
      if (toggleBtn) toggleBtn.classList.add('active');
    } else {
      sidebar.classList.remove('drawer-open');
      if (backdrop) backdrop.classList.remove('active');
      if (toggleBtn) toggleBtn.classList.remove('active');
    }
  };

  window.switchWriterTab = (tab, params = {}) => {
    // Unsaved changes guard
    if (writerState.editorDirty && !confirm('You have unsaved writing changes. Discard and switch section?')) {
      return;
    }
    writerState.editorDirty = false;

    writerState.activeTab = tab;
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, '', `#writer?tab=${tab}`);
    }

    if (typeof window.toggleWriterMobileNav === 'function') {
      window.toggleWriterMobileNav(false);
    }

    document.querySelectorAll('#writer-sidebar-nav .writer-nav-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    const clickedBtn = document.querySelector(`#writer-sidebar-nav .writer-nav-btn[onclick*="'${tab}'"]`);
    if (clickedBtn) clickedBtn.classList.add('active');

    // Sync active state in top header nav
    if (typeof window.updateWriterHeaderActiveTab === 'function') {
      window.updateWriterHeaderActiveTab(tab);
    }

    const topBarTitle = document.getElementById('writer-top-bar-current-tab');
    if (topBarTitle) {
      topBarTitle.textContent = TAB_TITLES[tab] || 'Writer Dashboard';
    }

    renderActiveWriterTab(params);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  window.handleWriterLogout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.warn('Logout error:', e);
    } finally {
      localStorage.removeItem('rp_auth_token');
      sessionStorage.removeItem('rp_admin_redirect');
      window.IS_LOGGED_IN = false;
      window.CURRENT_USER = null;
      updateHeaderUserArea();
      showToast('Logged out of Writer Workspace successfully.');
      window.location.hash = '#writer-login';
      if (window.renderAppView) window.renderAppView();
    }
  };

  // Beforeunload warning if editor is dirty
  window.onbeforeunload = (e) => {
    if (writerState.editorDirty) {
      e.preventDefault();
      e.returnValue = 'You have unsaved writing changes.';
      return 'You have unsaved writing changes.';
    }
  };

  renderActiveWriterTab();
  if (typeof window.loadWriterTrashCount === 'function') {
    window.loadWriterTrashCount();
  }
}

/**
 * Switch and Render Active Tab
 */
function renderActiveWriterTab(params = {}) {
  const canvas = document.getElementById('writer-main-canvas');
  if (!canvas) return;

  switch (writerState.activeTab) {
    case 'overview':
      renderWriterOverview(canvas);
      break;
    case 'novels':
      renderWriterNovels(canvas);
      break;
    case 'write':
      renderWriterCreateNovel(canvas, params.novelId);
      break;
    case 'episodes':
      renderWriterEpisodes(canvas, params.novelId);
      break;
    case 'editor':
      renderWriterEditor(canvas, params.episodeId, params.novelId, params.parentId);
      break;
    case 'published-novels':
      renderWriterPublishedNovels(canvas);
      break;
    case 'status':
      renderWriterStatus(canvas);
      break;
    case 'trash':
      renderWriterTrashTab(canvas);
      break;
    case 'profile':
      renderWriterProfile(canvas);
      break;
    default:
      renderWriterOverview(canvas);
  }
}

/* ========================================================
   2. WRITER OVERVIEW TAB
   ======================================================== */
async function renderWriterOverview(canvas) {
  // Show honest loading state if stats not yet present
  if (!writerState.stats) {
    canvas.innerHTML = `
      <div style="text-align:center; padding:60px 20px; color:#64748B;">
        <div style="width:32px; height:32px; border:3px solid #E2E8F0; border-top-color:#B88635; border-radius:50%; animation:writerSpin 0.8s linear infinite; margin:0 auto 12px;"></div>
        <div>Loading dashboard metrics...</div>
      </div>
    `;
  }

  // Refresh workspace data from MySQL to ensure real-time counts
  try {
    const res = await apiFetch('/api/writer/workspace');
    if (res.ok) {
      const data = await res.json();
      writerState.stats = data.stats;
      writerState.novels = data.novels || [];
      const novelsPill = document.getElementById('wnav-novels-count');
      if (novelsPill) novelsPill.textContent = writerState.novels.length;
      const epPill = document.getElementById('wnav-episodes-count');
      if (epPill) epPill.textContent = data.stats?.episodesCount || 0;
    }
  } catch (e) {
    console.warn('Failed to refresh stats:', e);
  }

  const stats = writerState.stats || {
    novelsCount: 0,
    draftsCount: 0,
    publishedNovelsCount: 0,
    episodesCount: 0,
    totalViews: 0
  };

  // Safe numerical formatting (guarantees NO 'undefined' ever)
  const novelsCount = Number(stats.novelsCount) || 0;
  const draftsCount = Number(stats.draftsCount) || 0;
  const publishedNovelsCount = Number(stats.publishedNovelsCount) || 0;
  const episodesCount = Number(stats.episodesCount) || 0;
  const totalViews = Number(stats.totalViews) || 0;

  canvas.innerHTML = `
    <!-- Simple, Clean Header -->
    <div class="writer-header-bar">
      <div>
        <h1 class="writer-header-title">Writer Dashboard</h1>
        <p class="writer-header-sub">Manage your novels and drafts.</p>
      </div>
      <div class="writer-header-actions">
        <button type="button" class="btn btn-gold" onclick="switchWriterTab('write')">
          ${ADMIN_ICONS.edit}
          <span>+ Write Novel</span>
        </button>
      </div>
    </div>

    ${writerState.changesRequestedCount > 0 ? `
      <div class="feedback-callout" style="margin-bottom:18px;">
        <h4 style="display:flex; align-items:center; gap:6px;">⚠️ Revisions Requested by Administrator (${writerState.changesRequestedCount})</h4>
        <p>The editor has requested revisions on your submission. Click below to inspect editorial feedback and revise your draft.</p>
        <button type="button" class="btn btn-outline btn-xs" style="margin-top:8px; border-color:#F59E0B; color:#92400E;" onclick="switchWriterTab('status')">
          View Feedback &amp; Revise ➔
        </button>
      </div>
    ` : ''}

    <!-- 6 Essential Database-Backed Statistics Grid -->
    <div class="writer-metrics-grid" style="grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));">
      <div class="writer-metric-card" onclick="switchWriterTab('assignments')" style="cursor:pointer;" title="View My Assignments">
        <span class="writer-metric-label">Assignments</span>
        <span class="writer-metric-value" style="color:#6B21A8;">${writerState.assignmentsCount || 0}</span>
      </div>

      <div class="writer-metric-card">
        <span class="writer-metric-label">Drafts</span>
        <span class="writer-metric-value drafts">${draftsCount}</span>
      </div>

      <div class="writer-metric-card" onclick="switchWriterTab('status')" style="cursor:pointer;" title="View Pending Reviews">
        <span class="writer-metric-label">In Review</span>
        <span class="writer-metric-value" style="color:#B45309;">${writerState.pendingSubmissionsCount || 0}</span>
      </div>

      <div class="writer-metric-card" onclick="switchWriterTab('schedule')" style="cursor:pointer;" title="View Scheduled Releases">
        <span class="writer-metric-label">Scheduled</span>
        <span class="writer-metric-value" style="color:#1D4ED8;">${stats.scheduledCount || 0}</span>
      </div>

      <div class="writer-metric-card">
        <span class="writer-metric-label">Published</span>
        <span class="writer-metric-value published">${stats.publishedCount || publishedNovelsCount}</span>
      </div>

      <div class="writer-metric-card">
        <span class="writer-metric-label">Reader Views</span>
        <span class="writer-metric-value" style="color:#0B1F33;">${totalViews.toLocaleString()}</span>
      </div>
    </div>

    <!-- Active Assignments Callout Card -->
    ${(writerState.assignments && writerState.assignments.length > 0) ? `
      <div class="writer-card" style="margin-bottom:18px;">
        <div class="writer-card-header">
          <h2 class="writer-card-title">🎯 My Assigned Tasks (${writerState.assignments.length})</h2>
          <button type="button" class="btn btn-outline" style="font-size:12px; padding:3px 8px;" onclick="switchWriterTab('assignments')">View All</button>
        </div>
        <div style="display:flex; flex-direction:column; gap:8px;">
          ${writerState.assignments.slice(0, 3).map(a => `
            <div style="background:#FAF7F2; border:1px solid #EAD8B1; border-radius:8px; padding:10px 14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
              <div>
                <span class="assignment-badge ${a.contentType}" style="font-size:10px; margin-right:6px;">${a.contentType.toUpperCase().replace('_', ' ')}</span>
                <strong style="font-size:13.5px; color:#1A0B2E;">${escapeHtml(a.title)}</strong>
                ${a.deadline ? `<span style="font-size:11.5px; color:#B45309; margin-left:8px;">📅 Due: ${new Date(a.deadline).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>` : ''}
                ${a.instructions ? `<div style="font-size:12px; color:#64748B; margin-top:2px;">${escapeHtml(a.instructions)}</div>` : ''}
              </div>
              <button type="button" class="btn btn-gold btn-xs" onclick="switchWriterTab('editor', { episodeId: '${a.contentId}' })">
                Write / Continue ➔
              </button>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}

    <!-- Recent Novels Section (Compact, Clean, Distraction-free) -->
    <div class="writer-card">
      <div class="writer-card-header">
        <h2 class="writer-card-title">Recent Novels</h2>
        ${writerState.novels.length > 0 ? `
          <button type="button" class="btn btn-outline" style="font-size:12.5px; padding:4px 10px;" onclick="switchWriterTab('novels')">
            View All (${writerState.novels.length}) »
          </button>
        ` : ''}
      </div>

      ${writerState.novels.length === 0 ? `
        <div class="writer-empty-state">
          <div class="writer-empty-icon">📖</div>
          <h3 class="writer-empty-title">No novels created yet</h3>
          <p class="writer-empty-desc">Begin your writing journey by creating your first novel.</p>
          <button type="button" class="btn btn-gold" onclick="switchWriterTab('write')">
            + Write Novel
          </button>
        </div>
      ` : `
        <div class="writer-table-wrap">
          <table class="writer-table">
            <thead>
              <tr>
                <th style="width:60px;">Cover</th>
                <th>Novel Title</th>
                <th style="text-align:center;">Status</th>
                <th style="text-align:center;">Episodes</th>
                <th style="text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${writerState.novels.slice(0, 5).map(n => `
                <tr>
                  <td>
                    <img src="${escapeHtml(n.cover || '/default-cover.jpg')}" alt="${escapeHtml(n.title)}" 
                         style="width:36px; height:50px; object-fit:cover; border-radius:4px; border:1px solid #E2E8F0;">
                  </td>
                  <td>
                    <div style="font-weight:600; color:#0B1F33; font-size:14px;">${escapeHtml(n.title)}</div>
                    <div style="font-size:12px; color:#64748B;">${escapeHtml(n.genre || 'Novel')}</div>
                  </td>
                  <td style="text-align:center;">
                    <span class="writer-badge ${n.visibility === 'public' ? 'published' : (n.visibility === 'submitted' ? 'review' : 'draft')}">
                      ${n.visibility === 'public' ? 'Published' : (n.visibility === 'submitted' ? 'Under Review' : 'Draft')}
                    </span>
                  </td>
                  <td style="text-align:center; font-weight:600; color:#0B1F33;">
                    ${n.chapters_count || n.chaptersCount || 0}
                  </td>
                  <td style="text-align:right;">
                    <div style="display:inline-flex; gap:8px;">
                      <button type="button" class="btn btn-outline" style="font-size:12px; padding:5px 10px;" 
                              onclick="switchWriterTab('write', { novelId: '${n.id}' })">
                        Edit
                      </button>
                      <button type="button" class="btn btn-gold" style="font-size:12px; padding:5px 10px;" 
                              onclick="switchWriterTab('episodes', { novelId: '${n.id}' })">
                        Episodes
                      </button>
                      <button type="button" class="btn btn-outline" style="font-size:12px; padding:5px 8px; color:#DC2626; border-color:#FCA5A5;" 
                              onclick="deleteWriterNovel('${n.id}', '${escapeHtml(n.title)}')" title="Move to Recycle Bin">
                        ${ADMIN_ICONS.trash}
                      </button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `}
    </div>
  `;
}

/* ========================================================
   3. MY NOVELS TAB
   ======================================================== */
async function renderWriterNovels(canvas) {
  canvas.innerHTML = `
    <div class="writer-header-bar">
      <div>
        <h1 class="writer-header-title">My Novels</h1>
        <p class="writer-header-sub">Manage your novels catalog, edit titles, and organize episodes.</p>
      </div>
      <div class="writer-header-actions">
        <button type="button" class="btn btn-gold" onclick="switchWriterTab('write')">
          ${ADMIN_ICONS.edit}
          <span>+ Write Novel</span>
        </button>
      </div>
    </div>

    <div id="writer-novels-table-container">
      <div style="text-align:center; padding:40px; color:#64748B;">
        Loading your novels...
      </div>
    </div>
  `;

  try {
    const res = await apiFetch('/api/writer/novels');
    const data = await res.json();
    writerState.novels = data.novels || [];

    const container = document.getElementById('writer-novels-table-container');
    if (!container) return;

    if (writerState.novels.length === 0) {
      container.innerHTML = `
        <div class="writer-card">
          <div class="writer-empty-state">
            <div class="writer-empty-icon">📚</div>
            <h3 class="writer-empty-title">No novels created yet</h3>
            <p class="writer-empty-desc">You haven't created any novels yet. Start your first novel today.</p>
            <button type="button" class="btn btn-gold" onclick="switchWriterTab('write')">
              + Write Novel
            </button>
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="writer-card" style="padding:0; overflow:hidden;">
        <div class="writer-table-wrap" style="border:none;">
          <table class="writer-table">
            <thead>
              <tr>
                <th style="width:60px;">Cover</th>
                <th>Novel Title</th>
                <th>Genre</th>
                <th style="text-align:center;">Episodes</th>
                <th style="text-align:center;">Status</th>
                <th style="text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${writerState.novels.map(n => `
                <tr>
                  <td>
                    <img src="${escapeHtml(n.cover || '/default-cover.jpg')}" alt="${escapeHtml(n.title)}" 
                         style="width:40px; height:56px; object-fit:cover; border-radius:4px; border:1px solid #E2E8F0;">
                  </td>
                  <td>
                    <div style="font-weight:600; color:#0B1F33; font-size:14.5px;">${escapeHtml(n.title)}</div>
                    <div style="font-size:12px; color:#64748B; max-width:320px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                      ${escapeHtml(n.description || 'No description added.')}
                    </div>
                  </td>
                  <td style="color:#475569;">
                    ${escapeHtml(n.genre || 'Novel')}
                  </td>
                  <td style="text-align:center; font-weight:700; color:#0B1F33;">
                    ${n.chapters_count || n.chaptersCount || 0}
                  </td>
                  <td style="text-align:center;">
                    <span class="writer-badge ${n.visibility === 'public' ? 'published' : (n.visibility === 'submitted' ? 'review' : 'draft')}">
                      ${n.visibility === 'public' ? 'Published' : (n.visibility === 'submitted' ? 'Under Review' : 'Draft')}
                    </span>
                  </td>
                  <td style="text-align:right;">
                    <div style="display:inline-flex; gap:8px;">
                      <button type="button" class="btn btn-outline" style="font-size:12.5px; padding:5px 10px;" 
                              onclick="switchWriterTab('write', { novelId: '${n.id}' })">
                        Edit
                      </button>
                      <button type="button" class="btn btn-gold" style="font-size:12.5px; padding:5px 10px;" 
                              onclick="switchWriterTab('episodes', { novelId: '${n.id}' })">
                        Episodes
                      </button>
                      ${n.visibility === 'public' ? `
                        <a href="#novel?id=${encodeURIComponent(n.id)}" class="btn btn-outline" style="font-size:12px; padding:5px 8px;" target="_blank" title="View Reader Page">
                          ${ADMIN_ICONS.externalLink}
                        </a>
                      ` : ''}
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch (err) {
    showToast('Failed to load novels: ' + err.message);
  }
}

/* ========================================================
   4. WRITE NOVEL / EDIT NOVEL TAB (Focused Minimal Form)
   ======================================================== */
async function renderWriterCreateNovel(canvas, editNovelId = null) {
  let existing = null;
  if (editNovelId) {
    existing = writerState.novels.find(n => n.id === editNovelId);
    if (!existing) {
      try {
        const res = await apiFetch(`/api/writer/novels/${editNovelId}`);
        const data = await res.json();
        existing = data.novel;
      } catch (e) {
        console.warn('Novel fetch error:', e);
      }
    }
  }

  const isEditing = Boolean(existing);
  writerState.currentNovel = existing;
  writerState.editorDirty = false;

  canvas.innerHTML = `
    <!-- Compact Writing Page Header -->
    <div class="writer-header-bar">
      <div>
        <a href="#writer?tab=novels" onclick="switchWriterTab('novels')" class="btn btn-outline" style="padding:4px 10px; font-size:12px; margin-bottom:8px; display:inline-flex; align-items:center; gap:6px;">
          ${ADMIN_ICONS.backArrow}
          <span>Back to My Novels</span>
        </a>
        <h1 class="writer-header-title" id="wn-header-title">
          ${isEditing ? escapeHtml(existing.title) : 'New Novel'}
        </h1>
      </div>

      <div class="writer-header-actions">
        <!-- Live Save Status Indicator -->
        <div id="wn-save-status" class="writer-save-status saved">
          <span class="writer-save-dot"></span>
          <span>${isEditing ? 'Saved' : 'Draft'}</span>
        </div>

        <button type="button" class="btn btn-outline" onclick="previewWriterNovel()">
          ${ADMIN_ICONS.eye}
          <span>Preview</span>
        </button>

        <button type="button" class="btn btn-gold" id="wn-save-btn" onclick="submitWriterNovel(false, ${isEditing ? `'${existing.id}'` : 'null'})">
          ${isEditing ? 'Save Changes' : 'Save Draft'}
        </button>
      </div>
    </div>

    <!-- Distraction-Free Form Canvas -->
    <div class="writer-card" style="max-width:760px; margin:0 auto; padding:32px;">
      <div id="wn-form-error" style="display:none; color:#DC2626; background:#FEF2F2; border:1px solid #FCA5A5; padding:10px 14px; border-radius:8px; font-size:13px; margin-bottom:18px; font-weight:600;"></div>

      <form id="writer-novel-form" onsubmit="event.preventDefault(); submitWriterNovel(false, ${isEditing ? `'${existing.id}'` : 'null'});">
        <!-- 1. Novel Title (Required) -->
        <div class="writer-form-group">
          <label class="writer-form-label" for="wn-title">
            Novel Title <span style="color:#DC2626;">*</span>
          </label>
          <input type="text" id="wn-title" class="writer-form-input" 
                 value="${escapeHtml(existing?.title || '')}"
                 placeholder="e.g. நிலவே மலர்ந்திடு (Nilaave Malarnthidu)" required autofocus
                 style="font-size:16px; font-weight:600; padding:12px 14px;"
                 oninput="handleNovelFormChange()">
          <div class="writer-form-hint">Slug will be generated automatically in the background.</div>
        </div>

        <!-- 2. Category / Genre -->
        <div class="writer-form-group">
          <label class="writer-form-label" for="wn-genre">
            Category / Genre
          </label>
          <select id="wn-genre" class="writer-form-select" onchange="handleNovelFormChange()">
            ${[
              'Family Romance',
              'Romance / Drama',
              'Thriller / Mystery',
              'Social Drama',
              'Historical Fiction',
              'Poetry / Literary'
            ].map(g => `
              <option value="${g}" ${(existing?.genre || 'Family Romance') === g ? 'selected' : ''}>${g}</option>
            `).join('')}
          </select>
        </div>

        <!-- 3. Cover Image (URL + Upload Picker) -->
        <div class="writer-form-group">
          <label class="writer-form-label">Cover Image</label>
          <div style="display:flex; gap:12px; align-items:center;">
            <div style="width:50px; height:70px; border-radius:6px; border:1px solid #CBD5E1; overflow:hidden; background:#F8FAFC; flex-shrink:0; display:flex; align-items:center; justify-content:center;">
              <img id="wn-cover-preview" src="${escapeHtml(existing?.cover || '/default-cover.jpg')}" alt="Cover preview" 
                   style="width:100%; height:100%; object-fit:cover;">
            </div>
            <div style="flex:1;">
              <input type="text" id="wn-cover" class="writer-form-input" 
                     value="${escapeHtml(existing?.cover || '')}"
                     placeholder="https://... or upload below"
                     oninput="updateCoverPreview(this.value); handleNovelFormChange();">
            </div>
            <label class="btn btn-outline" style="cursor:pointer; padding:10px 14px; white-space:nowrap; margin:0;">
              ${ADMIN_ICONS.upload}
              <span>Upload</span>
              <input type="file" id="wn-cover-file" accept="image/*" style="display:none;" onchange="handleWriterCoverUpload(this)">
            </label>
          </div>
          <div class="writer-form-hint">Standard cover ratio 2:3 (e.g. 600x900px, max 5MB).</div>
        </div>

        <!-- 4. Description / Synopsis -->
        <div class="writer-form-group">
          <label class="writer-form-label" for="wn-description">
            Description / Synopsis
          </label>
          <textarea id="wn-description" class="writer-form-textarea" rows="5" 
                    placeholder="Enter an engaging synopsis for your novel..."
                    style="line-height:1.6;"
                    oninput="handleNovelFormChange()">${escapeHtml(existing?.description || '')}</textarea>
        </div>

        <!-- Primary Action -->
        <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid #F1F5F9; padding-top:20px; margin-top:24px;">
          <button type="button" class="btn btn-outline" onclick="switchWriterTab('novels')">
            Cancel
          </button>
          
          <div style="display:flex; gap:10px;">
            <button type="submit" id="wn-bottom-save-btn" class="btn btn-gold" style="padding:10px 24px;">
              ${isEditing ? 'Save Changes' : 'Save Draft'}
            </button>
          </div>
        </div>
      </form>
    </div>
  `;
}

window.handleNovelFormChange = () => {
  writerState.editorDirty = true;
  const statusEl = document.getElementById('wn-save-status');
  if (statusEl) {
    statusEl.className = 'writer-save-status unsaved';
    statusEl.innerHTML = `<span class="writer-save-dot"></span><span>Unsaved changes</span>`;
  }
};

window.updateCoverPreview = (url) => {
  const preview = document.getElementById('wn-cover-preview');
  if (preview) {
    preview.src = url || '/default-cover.jpg';
  }
};

window.handleWriterCoverUpload = async (fileInput) => {
  const file = fileInput.files?.[0];
  if (!file) return;

  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/jpg'];
  if (!validTypes.includes(file.type)) {
    showToast('Please select a valid image file (JPG, PNG, WebP, GIF).');
    fileInput.value = '';
    return;
  }

  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    showToast('Cover image size must be under 10MB.');
    fileInput.value = '';
    return;
  }

  const currentCover = document.getElementById('wn-cover')?.value?.trim() || null;

  const reader = new FileReader();
  reader.onload = async () => {
    try {
      showToast('Uploading cover image...');
      const res = await apiFetch('/api/upload/image', {
        method: 'POST',
        body: JSON.stringify({
          data: reader.result,
          folder: 'covers',
          filename: file.name,
          replaceUrl: currentCover
        })
      });
      const data = await res.json();
      if (res.ok && data.url) {
        const coverInput = document.getElementById('wn-cover');
        if (coverInput) {
          coverInput.value = data.url;
          updateCoverPreview(data.url);
          handleNovelFormChange();
        }
        showToast('Cover image uploaded successfully! ✨');
      } else {
        showToast(data.error || 'Failed to upload cover image.');
      }
    } catch (e) {
      showToast('Error uploading image: ' + e.message);
    }
  };
  reader.readAsDataURL(file);
};

window.submitWriterNovel = async (publishNow = false, novelId = null) => {
  const title = document.getElementById('wn-title')?.value?.trim();
  const genre = document.getElementById('wn-genre')?.value?.trim() || 'Novel';
  const cover = document.getElementById('wn-cover')?.value?.trim() || '/default-cover.jpg';
  const description = document.getElementById('wn-description')?.value?.trim() || '';
  const errorEl = document.getElementById('wn-form-error');
  const saveBtn = document.getElementById('wn-save-btn');
  const bottomSaveBtn = document.getElementById('wn-bottom-save-btn');
  const statusEl = document.getElementById('wn-save-status');

  if (errorEl) errorEl.style.display = 'none';

  if (!title) {
    if (errorEl) {
      errorEl.textContent = 'Novel title is required.';
      errorEl.style.display = 'block';
    }
    return;
  }

  if (statusEl) {
    statusEl.className = 'writer-save-status saving';
    statusEl.innerHTML = `<span class="writer-save-dot"></span><span>Saving…</span>`;
  }
  if (saveBtn) saveBtn.disabled = true;
  if (bottomSaveBtn) bottomSaveBtn.disabled = true;

  try {
    const url = novelId ? `/api/writer/novels/${novelId}` : '/api/writer/novels';
    const method = novelId ? 'PUT' : 'POST';

    const res = await apiFetch(url, {
      method,
      body: JSON.stringify({
        title,
        genre,
        cover,
        description,
        visibility: 'draft'
      })
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      if (errorEl) {
        errorEl.textContent = data.error || 'Failed to save novel.';
        errorEl.style.display = 'block';
      }
      if (statusEl) {
        statusEl.className = 'writer-save-status unsaved';
        statusEl.innerHTML = `<span class="writer-save-dot"></span><span>Failed to save</span>`;
      }
      return;
    }

    writerState.editorDirty = false;
    if (statusEl) {
      statusEl.className = 'writer-save-status saved';
      statusEl.innerHTML = `<span class="writer-save-dot"></span><span>Saved</span>`;
    }

    showToast(novelId ? 'Novel updated successfully!' : 'Novel draft created successfully!');
    const savedId = data.novel?.id || data.id || novelId;
    const contentLink = data.contentLink || (`#novel?id=${encodeURIComponent(savedId)}`);
    window.showSavedContentLinkModal({ title, type: 'novel', contentLink });
    switchWriterTab('novels');
  } catch (err) {
    if (errorEl) {
      errorEl.textContent = err.message || 'Error communicating with server.';
      errorEl.style.display = 'block';
    }
  } finally {
    if (saveBtn) saveBtn.disabled = false;
    if (bottomSaveBtn) bottomSaveBtn.disabled = false;
  }
};

window.previewWriterNovel = () => {
  const title = document.getElementById('wn-title')?.value || 'Untitled Novel';
  const genre = document.getElementById('wn-genre')?.value || 'Novel';
  const cover = document.getElementById('wn-cover')?.value || '/default-cover.jpg';
  const description = document.getElementById('wn-description')?.value || 'No description provided.';
  const authorName = writerState.user?.name || writerState.user?.username || 'Writer';

  openReaderPreviewModal({
    novelTitle: title,
    episodeTitle: 'Synopsis & Book Details',
    authorName,
    cover,
    genre,
    content: `<p style="font-size:18px; line-height:1.8; color:#1E293B;">${escapeHtml(description)}</p>`,
    isDraft: true
  });
};

/* ========================================================
   5. MANAGE EPISODES TAB
   ======================================================== */
async function renderWriterEpisodes(canvas, preselectedNovelId = null) {
  if (preselectedNovelId) {
    writerState.selectedNovelId = preselectedNovelId;
  } else if (!writerState.selectedNovelId && writerState.novels.length > 0) {
    writerState.selectedNovelId = writerState.novels[0].id;
  }

  canvas.innerHTML = `
    <div class="writer-header-bar">
      <div>
        <h1 class="writer-header-title">Manage Episodes</h1>
        <p class="writer-header-sub">Select a novel to organize chapters and launch the writing editor.</p>
      </div>
      <div class="writer-header-actions" style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
        <button type="button" class="btn btn-outline" onclick="openWriterAddChapterModal()" id="btn-writer-add-chapter" style="display:inline-flex; align-items:center; gap:6px; font-weight:700;">
          <span style="font-size:16px; line-height:1;">+</span>
          <span>Add Chapter</span>
        </button>
        <button type="button" class="btn btn-gold" onclick="openNewEpisodeForCurrentNovel()" id="btn-add-episode" style="display:inline-flex; align-items:center; gap:6px; font-weight:700;">
          ${ADMIN_ICONS.edit}
          <span>+ Add Episode</span>
        </button>
      </div>
    </div>

    <!-- Novel Selector Dropdown -->
    <div class="writer-card" style="padding:16px 20px; margin-bottom:20px;">
      <div style="display:flex; align-items:center; gap:14px; flex-wrap:wrap;">
        <label for="writer-novel-picker" style="font-weight:600; color:#0B1F33; font-size:13.5px; white-space:nowrap;">
          Select Novel:
        </label>
        <select id="writer-novel-picker" class="writer-form-select" style="max-width:380px; padding:8px 12px;" onchange="handleWriterNovelSelect(this.value)">
          ${writerState.novels.map(n => `
            <option value="${n.id}" ${n.id === writerState.selectedNovelId ? 'selected' : ''}>
              ${escapeHtml(n.title)} (${n.chapters_count || n.chaptersCount || 0} episodes)
            </option>
          `).join('')}
        </select>
      </div>
    </div>

    <div id="writer-episodes-table-card">
      <div style="text-align:center; padding:40px; color:#64748B;">
        Loading episodes...
      </div>
    </div>
  `;

  if (writerState.novels.length === 0) {
    const card = document.getElementById('writer-episodes-table-card');
    if (card) {
      card.innerHTML = `
        <div class="writer-card">
          <div class="writer-empty-state">
            <div class="writer-empty-icon">📖</div>
            <h3 class="writer-empty-title">No novels available</h3>
            <p class="writer-empty-desc">Create a novel first before adding episodes.</p>
            <button type="button" class="btn btn-gold" onclick="switchWriterTab('write')">+ Write Novel</button>
          </div>
        </div>
      `;
    }
    return;
  }

  loadEpisodesForWriterNovel(writerState.selectedNovelId);
}

window.handleWriterNovelSelect = (novelId) => {
  writerState.selectedNovelId = novelId;
  loadEpisodesForWriterNovel(novelId);
};

async function loadEpisodesForWriterNovel(novelId) {
  const container = document.getElementById('writer-episodes-table-card');
  if (!container) return;

  try {
    const res = await apiFetch(`/api/writer/episodes?novelId=${encodeURIComponent(novelId)}`);
    const data = await res.json();
    writerState.episodes = data.episodes || [];

    if (writerState.episodes.length === 0) {
      container.innerHTML = `
        <div class="writer-card">
          <div class="writer-empty-state">
            <div class="writer-empty-icon">📝</div>
            <h3 class="writer-empty-title">No episodes written yet</h3>
            <p class="writer-empty-desc">Create a chapter first, then add episodes and story content.</p>
            <div style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">
              <button type="button" class="btn btn-gold" onclick="openWriterAddChapterModal()">+ Create Chapter 1</button>
              <button type="button" class="btn btn-outline" onclick="openNewEpisodeForCurrentNovel()">+ Write Episode</button>
            </div>
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="writer-card" style="padding:0; overflow:hidden;">
        <div class="writer-table-wrap" style="border:none;">
          <table class="writer-table">
            <thead>
              <tr>
                <th style="width:70px;">Episode</th>
                <th>Episode Title</th>
                <th style="text-align:center;">Words</th>
                <th style="text-align:center;">Status</th>
                <th style="text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${writerState.episodes.map(ep => {
                const isChapter = !ep.parent_id && !ep.parentId;
                return `
                <tr style="${isChapter ? 'background:#FAF5FF;' : ''}">
                  <td style="font-weight:700; color:#0B1F33;">
                    ${isChapter ? `
                      <span class="chapter-badge" style="background:#EDE9FE; color:#5B21B6; font-size:10.5px; padding:2px 7px; border-radius:4px; font-weight:800; display:inline-block; margin-bottom:2px;">Chapter</span><br>
                    ` : ''}
                    #${ep.episode_number || ep.chapter_num || '1'}
                  </td>
                  <td>
                    <div style="font-weight:600; color:#0B1F33;">${escapeHtml(ep.title || (isChapter ? `Chapter ${ep.episode_number || ep.chapter_num}` : `Episode ${ep.episode_number || ep.chapter_num}`))}</div>
                    ${isChapter ? `<span style="font-size:11px; color:#7C3AED;">Root Chapter Container</span>` : ''}
                  </td>
                  <td style="text-align:center; color:#64748B;">
                    ${isChapter ? '—' : (ep.word_count || ep.wordCount || 0).toLocaleString()}
                  </td>
                  <td style="text-align:center;">
                    <span class="writer-badge ${ep.status === 'published' ? 'published' : (ep.status === 'submitted' ? 'review' : 'draft')}">
                      ${ep.status === 'published' ? 'Published' : (ep.status === 'submitted' ? 'Under Review' : 'Draft')}
                    </span>
                  </td>
                  <td style="text-align:right;">
                    <div style="display:inline-flex; gap:8px;">
                      ${isChapter ? `
                        <button type="button" class="btn btn-gold" style="font-size:12.5px; padding:5px 12px;" 
                                onclick="openWriterEditChapterModal('${ep.id}')" title="Edit Chapter Title Only">
                          Edit
                        </button>
                        <button type="button" class="btn btn-outline" style="font-size:12px; padding:5px 10px; color:#4F46E5; border-color:#C7D2FE;" 
                                onclick="switchWriterTab('editor', { episodeId: null, novelId: '${novelId}', parentId: '${ep.id}' })" title="Add Episode to this Chapter">
                          + Episode
                        </button>
                      ` : `
                        <button type="button" class="btn btn-gold" style="font-size:12.5px; padding:5px 12px;" 
                                onclick="switchWriterTab('editor', { episodeId: '${ep.id}', novelId: '${novelId}' })">
                          Edit
                        </button>
                        <button type="button" class="btn btn-outline" style="font-size:12px; padding:5px 8px;" 
                                onclick="previewWriterEpisodeFromList('${ep.id}')" title="Preview Episode">
                          ${ADMIN_ICONS.eye}
                        </button>
                        <button type="button" class="btn btn-outline" style="font-size:12px; padding:5px 8px;" 
                                onclick="window.copyGeneratedModalLink('${window.location.origin}/#reader?novel=${encodeURIComponent(novelId)}&ch=${encodeURIComponent(ep.episodeNumber || ep.chapterNum || ep.num || '1')}')" title="Copy Content Link">
                          📋
                        </button>
                      `}
                      ${ep.status !== 'published' ? `
                        <button type="button" class="btn btn-outline" style="font-size:12px; padding:5px 8px; color:#DC2626; border-color:#FCA5A5;" 
                                onclick="deleteWriterEpisode('${ep.id}')" title="Delete Draft">
                          ${ADMIN_ICONS.trash}
                        </button>
                      ` : ''}
                    </div>
                  </td>
                </tr>
              `; }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="writer-card" style="padding:24px; text-align:center; color:#DC2626;">Failed to load episodes: ${escapeHtml(err.message)}</div>`;
  }
}


/* ========================================================
   WRITER CHAPTER CREATION WORKFLOW
   Requires ONLY chapter title & basic details (no content required).
   After creation, automatically navigates to Episode Creation for that chapter.
   ======================================================== */
window.openWriterAddChapterModal = (novelId) => {
  const existingModal = document.getElementById('modal-writer-add-chapter');
  if (existingModal) existingModal.remove();

  const currentNovelId = novelId || writerState.selectedNovelId || writerState.novels[0]?.id;
  const novel = writerState.novels.find(n => n.id === currentNovelId);
  const novelTitle = novel?.title || 'Novel';

  // Compute next chapter number from root chapters (parent_id IS NULL)
  const rootChapters = (writerState.episodes || []).filter(e => !e.parent_id && !e.parentId);
  let maxChapterNum = 0;
  for (const ch of rootChapters) {
    const n = parseInt(String(ch.chapter_num || ch.episode_number || ch.chapterNum || ch.episodeNumber || '0'), 10);
    if (!isNaN(n) && n > maxChapterNum) maxChapterNum = n;
  }
  const nextChapterNum = maxChapterNum + 1;
  const defaultTitle = `${novelTitle} (Chapter ${nextChapterNum})`;
  const canPublish = writerState.permissions?.accessLevel === 'independent_publish';

  const modalHtml = `
    <div class="admin-modal-backdrop" id="modal-writer-add-chapter" style="position:fixed; inset:0; background:rgba(11,31,51,0.6); display:flex; align-items:center; justify-content:center; z-index:9999; padding:20px;">
      <div class="admin-modal-card" style="background:#FFF; width:100%; max-width:520px; border-radius:12px; box-shadow:0 12px 36px rgba(0,0,0,0.2); overflow:hidden;">
        <div style="background:#1A0B2E; color:#FFF; padding:16px 20px; display:flex; justify-content:space-between; align-items:center;">
          <h3 style="margin:0; font-size:16px; font-weight:700;">➕ Add New Chapter</h3>
          <button type="button" onclick="document.getElementById('modal-writer-add-chapter').remove()" style="background:transparent; border:none; color:#FFF; font-size:18px; cursor:pointer;">✕</button>
        </div>
        <form id="form-writer-add-chapter" onsubmit="event.preventDefault(); submitWriterAddChapter('${currentNovelId}');" style="padding:20px;">
          <div style="display:flex; gap:12px; margin-bottom:14px; background:#F8FAFC; padding:10px 14px; border-radius:8px; border:1px solid #E2E8F0; align-items:center;">
            <div>
              <div style="font-size:11px; text-transform:uppercase; color:#64748B; font-weight:700;">Novel</div>
              <div style="font-weight:700; color:#0B1F33; font-size:14px;">${escapeHtml(novelTitle)}</div>
            </div>
            <div style="margin-left:auto; text-align:right;">
              <div style="font-size:11px; text-transform:uppercase; color:#64748B; font-weight:700;">Auto Number</div>
              <span class="chapter-number-badge" style="background:#B88635; color:#FFF; font-weight:800; font-size:12px; padding:3px 8px; border-radius:4px;">
                Chapter ${nextChapterNum}
              </span>
            </div>
          </div>

          <div class="form-group" style="margin-bottom:14px;">
            <label class="writer-form-label" style="font-weight:700; color:#0B1F33; font-size:13px; margin-bottom:4px; display:block;">
              Chapter Title <span style="color:#EF4444;">*</span>
            </label>
            <input type="text" id="w-add-chapter-title-input" class="writer-form-input" 
                   value="${escapeQuotes(defaultTitle)}" 
                   placeholder="e.g. ${escapeQuotes(defaultTitle)}" required
                   style="width:100%; font-size:14px; font-weight:700; padding:10px 12px;">
            <div style="font-size:11.5px; color:#64748B; margin-top:3px;">
              Format: <code>${escapeHtml(novelTitle)} (${nextChapterNum})</code> — editable anytime.
            </div>
          </div>

          <div class="form-group" style="margin-bottom:16px;">
            <label class="writer-form-label" style="font-weight:700; color:#0B1F33; font-size:13px; margin-bottom:4px; display:block;">
              Status
            </label>
            <select id="w-add-chapter-status-select" class="writer-form-select" style="width:100%;">
              ${canPublish ? `
                <option value="published" selected>🚀 Published (Live Now)</option>
                <option value="draft">📝 Draft (Private)</option>
              ` : `
                <option value="draft" selected>📝 Draft (Private)</option>
                <option value="submitted">⏳ Submit for Admin Review</option>
              `}
            </select>
          </div>

          <div style="background:#F0FDF4; border:1px solid #BBF7D0; border-radius:8px; padding:12px 14px; margin-bottom:18px; display:flex; align-items:flex-start; gap:10px;">
            <span style="font-size:18px; line-height:1;">✨</span>
            <div style="font-size:12px; color:#166534; line-height:1.45;">
              <strong>Streamlined Chapter Workflow:</strong> Only chapter title and basic settings are required. Once created, you will automatically navigate to <strong>Episode Creation</strong> to write episodes and story content.
            </div>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:14px; border-top:1px solid #F1F5F9; padding-top:14px;">
            <button type="button" class="btn btn-outline btn-sm" onclick="document.getElementById('modal-writer-add-chapter').remove()">Cancel</button>
            <div style="display:flex; gap:8px;">
              <button type="submit" id="btn-submit-writer-add-chapter" class="btn btn-gold btn-sm" style="padding:8px 20px; font-weight:700;">
                Create Chapter & Add Episode →
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  document.getElementById('w-add-chapter-title-input')?.focus();
};

window.submitWriterAddChapter = async (novelId) => {
  const title = document.getElementById('w-add-chapter-title-input')?.value?.trim();
  const status = document.getElementById('w-add-chapter-status-select')?.value || 'draft';
  const submitBtn = document.getElementById('btn-submit-writer-add-chapter');

  if (!title) {
    showToast('Please enter a chapter title.');
    return;
  }
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating Chapter...';
  }

  try {
    const res = await apiFetch('/api/writer/episodes', {
      method: 'POST',
      body: JSON.stringify({
        novelId,
        parentId: null,
        title,
        status,
        content: ''
      })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      showToast(data.error || 'Failed to create chapter.');
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Create Chapter & Add Episode →'; }
      return;
    }

    const createdChapter = data.episode;
    document.getElementById('modal-writer-add-chapter')?.remove();
    showToast(`Chapter "${title}" created successfully! Opening Episode Creation...`);

    // Reload episodes list in background
    if (typeof loadEpisodesForWriterNovel === 'function') {
      loadEpisodesForWriterNovel(novelId).catch(() => {});
    }

    // Automatically navigate to the Episode Creation page for that chapter
    switchWriterTab('editor', { episodeId: null, novelId, parentId: createdChapter?.id });
  } catch (err) {
    showToast('Error creating chapter: ' + err.message);
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Create Chapter & Add Episode →'; }
  }
};

window.openNewEpisodeForCurrentNovel = () => {
  const novelId = writerState.selectedNovelId;
  if (!novelId) {
    showToast('Please select or create a novel first.');
    return;
  }
  switchWriterTab('editor', { episodeId: null, novelId });
};


/* ========================================================
   WRITER CHAPTER EDIT WORKFLOW
   Allows editing ONLY the chapter title.
   Does NOT redirect to episode edit page or modify episode content.
   Preserves all associated episodes, content, and database records.
   ======================================================== */
window.openWriterEditChapterModal = async (chapterId) => {
  const existingModal = document.getElementById('modal-writer-edit-chapter');
  if (existingModal) existingModal.remove();

  let chapter = (writerState.episodes || []).find(e => String(e.id) === String(chapterId));

  if (!chapter) {
    try {
      const res = await apiFetch(`/api/writer/episodes/${chapterId}`);
      const data = await res.json();
      if (data.success && data.episode) {
        chapter = data.episode;
      }
    } catch (e) {
      console.warn('Error fetching chapter:', e);
    }
  }

  if (!chapter) {
    showToast('Chapter details could not be loaded.');
    return;
  }

  const currentNovelId = chapter.novel_id || chapter.novelId || writerState.selectedNovelId;
  const novel = (writerState.novels || []).find(n => n.id === currentNovelId);
  const novelTitle = novel?.title || 'Novel';
  const chapterNum = chapter.chapter_num || chapter.episode_number || chapter.chapterNum || chapter.episodeNumber || '1';

  const modalHtml = `
    <div class="admin-modal-backdrop" id="modal-writer-edit-chapter" style="position:fixed; inset:0; background:rgba(11,31,51,0.6); display:flex; align-items:center; justify-content:center; z-index:9999; padding:20px;">
      <div class="admin-modal-card" style="background:#FFF; width:100%; max-width:520px; border-radius:12px; box-shadow:0 12px 36px rgba(0,0,0,0.2); overflow:hidden;">
        <div style="background:#1A0B2E; color:#FFF; padding:16px 20px; display:flex; justify-content:space-between; align-items:center;">
          <h3 style="margin:0; font-size:16px; font-weight:700;">✏️ Edit Chapter Title</h3>
          <button type="button" onclick="document.getElementById('modal-writer-edit-chapter').remove()" style="background:transparent; border:none; color:#FFF; font-size:18px; cursor:pointer;">✕</button>
        </div>
        <form id="form-writer-edit-chapter" onsubmit="event.preventDefault(); submitWriterEditChapter('${chapter.id}');" style="padding:20px;">
          <!-- Novel & Chapter Info Card -->
          <div style="display:flex; gap:12px; margin-bottom:16px; background:#F8FAFC; padding:10px 14px; border-radius:8px; border:1px solid #E2E8F0; align-items:center;">
            <div>
              <div style="font-size:11px; text-transform:uppercase; color:#64748B; font-weight:700;">Novel</div>
              <div style="font-weight:700; color:#0B1F33; font-size:14px;">${escapeHtml(novelTitle)}</div>
            </div>
            <div style="margin-left:auto; text-align:right;">
              <span class="chapter-number-badge" style="background:#B88635; color:#FFF; font-weight:800; font-size:12px; padding:3px 8px; border-radius:4px;">
                Chapter ${escapeHtml(chapterNum)}
              </span>
            </div>
          </div>

          <!-- Chapter Title Input (ONLY field editable) -->
          <div class="form-group" style="margin-bottom:16px;">
            <label class="writer-form-label" style="font-weight:700; color:#0B1F33; font-size:13px; margin-bottom:6px; display:block;">
              Chapter Title <span style="color:#EF4444;">*</span>
            </label>
            <input type="text" id="w-edit-chapter-title-input" class="writer-form-input" 
                   value="${escapeQuotes(chapter.title || '')}" 
                   placeholder="Enter chapter title" required
                   style="width:100%; font-size:14px; font-weight:700; padding:10px 12px;">
            <div style="font-size:11.5px; color:#64748B; margin-top:5px; line-height:1.4;">
              Edit the chapter title only. All episodes and story content remain intact.
            </div>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:20px; border-top:1px solid #F1F5F9; padding-top:14px;">
            <button type="button" class="btn btn-outline btn-sm" onclick="document.getElementById('modal-writer-edit-chapter').remove()">Cancel</button>
            <div style="display:flex; gap:8px;">
              <button type="submit" id="btn-submit-writer-edit-chapter" class="btn btn-gold btn-sm" style="padding:8px 22px; font-weight:700;">
                Save Changes
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  const inputEl = document.getElementById('w-edit-chapter-title-input');
  if (inputEl) {
    inputEl.focus();
    inputEl.select();
  }
};

window.submitWriterEditChapter = async (chapterId) => {
  const title = document.getElementById('w-edit-chapter-title-input')?.value?.trim();
  const submitBtn = document.getElementById('btn-submit-writer-edit-chapter');

  if (!title) {
    showToast('Please enter a chapter title.');
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';
  }

  try {
    const res = await apiFetch(`/api/writer/episodes/${chapterId}`, {
      method: 'PUT',
      body: JSON.stringify({ title })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      showToast(data.error || 'Failed to update chapter title.');
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Save Changes'; }
      return;
    }

    document.getElementById('modal-writer-edit-chapter')?.remove();
    showToast('Chapter title updated successfully! 🎉');

    // Refresh episodes table
    if (typeof loadEpisodesForWriterNovel === 'function' && writerState.selectedNovelId) {
      loadEpisodesForWriterNovel(writerState.selectedNovelId).catch(() => {});
    }
  } catch (err) {
    showToast('Error updating chapter: ' + err.message);
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Save Changes'; }
  }
};

window.deleteWriterEpisode = async (episodeId) => {
  if (!confirm('Are you sure you want to delete this draft episode?')) return;

  try {
    const res = await apiFetch(`/api/writer/episodes/${episodeId}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast('Episode deleted successfully.');
      loadEpisodesForWriterNovel(writerState.selectedNovelId);
    } else {
      showToast(data.error || 'Failed to delete episode.');
    }
  } catch (e) {
    showToast('Error: ' + e.message);
  }
};

window.previewWriterEpisodeFromList = (episodeId) => {
  const ep = writerState.episodes.find(e => String(e.id) === String(episodeId));
  const novel = writerState.novels.find(n => n.id === writerState.selectedNovelId);
  if (!ep) return;

  openReaderPreviewModal({
    novelTitle: novel?.title || 'Story',
    episodeTitle: ep.title || `Episode #${ep.episode_number || ep.chapter_num}`,
    authorName: writerState.user?.name || writerState.user?.username || 'Writer',
    cover: novel?.cover || '/default-cover.jpg',
    genre: novel?.genre || 'Novel',
    content: ep.content || '<p>No content in this episode.</p>',
    isDraft: ep.status !== 'published'
  });
};

/* ========================================================
   6. PROFESSIONAL NOVEL WRITING PAGE / RICH-TEXT EDITOR
   ======================================================== */
async function renderWriterEditor(canvas, episodeId = null, novelId = null, parentId = null) {
  const currentNovelId = novelId || writerState.selectedNovelId;
  const currentNovel = writerState.novels.find(n => n.id === currentNovelId) || writerState.novels[0];

  let ep = null;
  if (episodeId) {
    try {
      const res = await apiFetch(`/api/writer/episodes/${episodeId}`);
      const data = await res.json();
      ep = data.episode;
      // Guard: If this is a root chapter container (not an episode), route to chapter title edit modal
      if (ep && !ep.parent_id && !ep.parentId) {
        openWriterEditChapterModal(ep.id);
        switchWriterTab('episodes', { novelId: currentNovelId });
        return;
      }
    } catch (e) {
      console.warn('Episode fetch error:', e);
    }
  }

  const isEditing = Boolean(ep);
  const activeParentId = (parentId !== undefined && parentId !== null) ? parentId : (ep ? (ep.parent_id || ep.parentId) : null);
  writerState.currentParentId = activeParentId;

  // Find parent chapter info if available
  let parentChapter = null;
  if (activeParentId) {
    parentChapter = (writerState.episodes || []).find(e => Number(e.id) === Number(activeParentId));
    if (!parentChapter) {
      try {
        const res = await apiFetch(`/api/writer/episodes?novelId=${encodeURIComponent(currentNovelId)}`);
        const data = await res.json();
        writerState.episodes = data.episodes || [];
        parentChapter = (writerState.episodes || []).find(e => Number(e.id) === Number(activeParentId));
      } catch (e) {}
    }
  }

  let nextNum = '1';
  if (ep) {
    nextNum = ep.episode_number || ep.chapter_num || '1';
  } else if (parentChapter) {
    const parentNum = String(parentChapter.chapter_num || parentChapter.episode_number || '1');
    const existingSubs = (writerState.episodes || []).filter(e => Number(e.parent_id || e.parentId) === Number(parentChapter.id));
    let maxSuffix = 0;
    for (const sub of existingSubs) {
      const subNumStr = String(sub.episode_number || sub.chapter_num || '');
      if (subNumStr.startsWith(parentNum + '.')) {
        const rest = subNumStr.slice(parentNum.length + 1);
        const firstPart = parseInt(rest.split('.')[0], 10);
        if (!isNaN(firstPart) && firstPart > maxSuffix) maxSuffix = firstPart;
      }
    }
    const nextIdx = Math.max(maxSuffix + 1, existingSubs.length + 1);
    nextNum = `${parentNum}.${nextIdx}`;
  } else {
    nextNum = String((writerState.episodes?.length || 0) + 1);
  }

  writerState.currentEpisode = ep;
  writerState.editorDirty = false;

  canvas.innerHTML = `
    <!-- Dedicated Novel Content Writing Page Header -->
    <div class="writer-header-bar" style="margin-bottom:16px;">
      <div>
        <a href="#writer?tab=episodes" onclick="switchWriterTab('episodes', { novelId: '${currentNovelId}' })" 
           class="btn btn-outline" style="padding:4px 10px; font-size:12px; margin-bottom:8px; display:inline-flex; align-items:center; gap:6px;">
          ${ADMIN_ICONS.backArrow}
          <span>Back to Episodes</span>
        </a>
        <h1 class="writer-header-title" id="we-page-title" style="margin:0 0 4px;">
          ${isEditing ? `Edit Novel Content: ${escapeHtml(ep?.title || '')}` : 'Novel Content Writing'}
        </h1>
        <p style="font-size:13px; color:#64748B; margin:0;">
          Write, format, preview reader experience, and generate shareable publish links for frontend threads.
        </p>
      </div>

      <div class="writer-header-actions" style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
        <!-- Live Save Status Indicator -->
        <div id="we-save-status" class="writer-save-status saved">
          <span class="writer-save-dot"></span>
          <span>${isEditing ? 'Saved' : 'Draft'}</span>
        </div>

        <button type="button" class="btn btn-outline btn-sm" onclick="previewWriterEditorContent()">
          ${ADMIN_ICONS.eye}
          <span>Preview Option</span>
        </button>

        <button type="button" class="btn btn-outline btn-sm" id="we-save-draft-btn" 
                onclick="saveWriterEpisode('${currentNovelId}', ${ep ? `'${ep.id}'` : 'null'}, 'draft', null, false)">
          💾 Save Draft
        </button>

        <button type="button" class="btn btn-gold btn-sm" id="we-generate-link-btn" 
                onclick="generateWriterPublishLink('${currentNovelId}', ${ep ? `'${ep.id}'` : 'null'})"
                style="font-weight:700; padding:8px 18px; box-shadow:0 2px 8px rgba(200,155,60,0.3);">
          🔗 Generate Publish Link
        </button>
      </div>
    </div>

    <!-- Title Field (Freely enter own title without selecting predefined options) -->
    <div class="writer-card" style="padding:18px 24px; margin-bottom:16px;">
      <div id="we-editor-error" style="display:none; color:#DC2626; background:#FEF2F2; border:1px solid #FCA5A5; padding:10px 14px; border-radius:8px; font-size:13px; margin-bottom:14px; font-weight:600;"></div>

      ${writerState.editingPublishedId ? `
        <div style="background:#EFF6FF; border:1px solid #BFDBFE; border-radius:8px; padding:12px 16px; margin-bottom:16px; display:flex; justify-content:space-between; align-items:center;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:18px;">✏️</span>
            <div>
              <strong style="color:#1E40AF; font-size:13.5px;">Editing Published Novel</strong>
              <div style="font-size:12px; color:#3B82F6;">Saving will update the live reader page immediately while preserving the original link and all comments.</div>
            </div>
          </div>
          <button type="button" class="btn btn-outline btn-sm" onclick="cancelEditingPublishedNovelWriter()" style="font-size:12px;">Cancel Edit</button>
        </div>
      ` : ''}

      <input type="hidden" id="we-novel-id" value="${escapeHtml(currentNovelId || '')}">
      <input type="hidden" id="we-number" value="${escapeHtml(nextNum || '')}">

      <div>
        <label class="writer-form-label" for="we-title" style="font-weight:700; color:#0B1F33; font-size:14px; margin-bottom:8px; display:flex; align-items:center; gap:8px;">
          <span style="font-size:18px;">📝</span> Title <span style="color:#EF4444;">*</span>
        </label>
        <input type="text" id="we-title" class="writer-form-input" 
               value="${escapeHtml(ep?.title || '')}" 
               placeholder="Enter title..."
               oninput="handleEditorInputChange()"
               style="font-size:16px; font-weight:700; height:46px; width:100%; border-radius:8px;">
        <div style="font-size:12px; color:#64748B; margin-top:6px;">
          Freely enter your title and content below without selecting predefined options.
        </div>
      </div>
    </div>

    <!-- Focused Writing Canvas with Compact Toolbar -->
    <div class="writer-editor-container">
      <!-- Formatting Toolbar -->
      <div class="writer-toolbar" role="toolbar" aria-label="Text Formatting">
        <!-- Style Select -->
        <select class="writer-toolbar-btn" style="padding:4px 8px; font-size:12.5px; border:1px solid #CBD5E1; background:#fff;" 
                onchange="formatStory('formatBlock', this.value); this.value='p';">
          <option value="p">Paragraph</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
          <option value="blockquote">Quote</option>
        </select>

        <div class="writer-toolbar-divider"></div>

        <!-- Inline Formats -->
        <button type="button" class="writer-toolbar-btn" onclick="formatStory('bold')" title="Bold (Ctrl+B)">
          <strong>B</strong>
        </button>
        <button type="button" class="writer-toolbar-btn" onclick="formatStory('italic')" title="Italic (Ctrl+I)">
          <em>I</em>
        </button>
        <button type="button" class="writer-toolbar-btn" onclick="formatStory('underline')" title="Underline (Ctrl+U)">
          <u>U</u>
        </button>

        <div class="writer-toolbar-divider"></div>

        <!-- Text Alignment -->
        <button type="button" class="writer-toolbar-btn" onclick="formatStory('justifyLeft')" title="Align Left">
          ⇤
        </button>
        <button type="button" class="writer-toolbar-btn" onclick="formatStory('justifyCenter')" title="Center">
          ⇋
        </button>
        <button type="button" class="writer-toolbar-btn" onclick="formatStory('justifyRight')" title="Align Right">
          ⇥
        </button>
        <button type="button" class="writer-toolbar-btn" onclick="formatStory('justifyFull')" title="Justify">
          ☰
        </button>

        <div class="writer-toolbar-divider"></div>

        <!-- Lists -->
        <button type="button" class="writer-toolbar-btn" onclick="formatStory('insertUnorderedList')" title="Bulleted List">
          • List
        </button>
        <button type="button" class="writer-toolbar-btn" onclick="formatStory('insertOrderedList')" title="Numbered List">
          1. List
        </button>

        <div class="writer-toolbar-divider"></div>

        <!-- Insert -->
        <button type="button" class="writer-toolbar-btn" onclick="insertStoryLink()" title="Insert Link">
          🔗 Link
        </button>
        <button type="button" class="writer-toolbar-btn" onclick="insertStoryImage()" title="Insert Image">
          🖼️ Image
        </button>

        <div class="writer-toolbar-divider"></div>

        <!-- History & Clean -->
        <button type="button" class="writer-toolbar-btn" onclick="formatStory('undo')" title="Undo (Ctrl+Z)">
          ↩
        </button>
        <button type="button" class="writer-toolbar-btn" onclick="formatStory('redo')" title="Redo (Ctrl+Y)">
          ↪
        </button>
        <button type="button" class="writer-toolbar-btn" onclick="formatStory('removeFormat')" title="Clear Formatting">
          ✕ Clear
        </button>
      </div>

      <!-- Comfortable Contenteditable Story Canvas -->
      <div id="we-canvas" class="writer-writing-area" contenteditable="true" 
           spellcheck="true"
           oninput="handleStoryInput()"
           placeholder="">${ep?.content || ''}</div>

      <!-- Live Counters & Status Bar with Action Buttons -->
      <div class="writer-editor-footer" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; padding:12px 16px;">
        <div style="display:flex; align-items:center; gap:12px;">
          <div id="we-word-counter" style="font-weight:600; color:#0B1F33;">Words: 0 | Characters: 0</div>
          <span style="color:#CBD5E1;">|</span>
          <div style="font-size:12px; color:#64748B;">Autosave enabled</div>
        </div>

        <div style="display:flex; align-items:center; gap:10px;">
          <button type="button" class="btn btn-outline btn-sm" onclick="previewWriterEditorContent()">
            ${ADMIN_ICONS.eye}
            <span>Preview Option</span>
          </button>
          <button type="button" class="btn btn-outline btn-sm" onclick="saveWriterEpisode('${currentNovelId}', ${ep ? `'${ep.id}'` : 'null'}, 'draft', null, false)">
            💾 Save Draft
          </button>
          <button type="button" class="btn btn-gold btn-sm" onclick="generateWriterPublishLink('${currentNovelId}', ${ep ? `'${ep.id}'` : 'null'})" style="font-weight:700;">
            🔗 Generate Publish Link
          </button>
        </div>
      </div>
    </div>
  `;

  setTimeout(() => {
    handleStoryInput(false);
  }, 100);
}

window.handleEditorInputChange = () => {
  writerState.editorDirty = true;
  const statusEl = document.getElementById('we-save-status');
  if (statusEl) {
    statusEl.className = 'writer-save-status unsaved';
    statusEl.innerHTML = `<span class="writer-save-dot"></span><span>Unsaved changes</span>`;
  }
};

window.formatStory = (cmd, val = null) => {
  document.execCommand(cmd, false, val);
  const canvas = document.getElementById('we-canvas');
  if (canvas) canvas.focus();
  handleStoryInput();
};

window.insertStoryLink = () => {
  const url = prompt('Enter link URL:');
  if (url) formatStory('createLink', url);
};

window.insertStoryImage = () => {
  const url = prompt('Enter image URL:');
  if (url) formatStory('insertImage', url);
};

window.handleStoryInput = (markDirty = true) => {
  const canvas = document.getElementById('we-canvas');
  const counter = document.getElementById('we-word-counter');
  if (!canvas || !counter) return;

  const text = canvas.innerText || '';
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const chars = text.length;

  counter.textContent = `Words: ${words.toLocaleString()} | Characters: ${chars.toLocaleString()}`;

  if (markDirty) {
    writerState.editorDirty = true;
    const statusEl = document.getElementById('we-save-status');
    if (statusEl) {
      statusEl.className = 'writer-save-status unsaved';
      statusEl.innerHTML = `<span class="writer-save-dot"></span><span>Unsaved changes</span>`;
    }

    // Debounced autosave after 4 seconds of inactivity
    if (writerState.autosaveTimer) clearTimeout(writerState.autosaveTimer);
    writerState.autosaveTimer = setTimeout(() => {
      autosaveDraftSilently();
    }, 4000);
  }
};

async function autosaveDraftSilently() {
  if (!writerState.editorDirty) return;
  const canvas = document.getElementById('we-canvas');
  const num = document.getElementById('we-number')?.value?.trim();
  const title = document.getElementById('we-title')?.value?.trim();
  const currentNovelId = writerState.selectedNovelId;
  const ep = writerState.currentEpisode;

  if (!canvas || !num || !currentNovelId) return;

  const statusEl = document.getElementById('we-save-status');
  if (statusEl) {
    statusEl.className = 'writer-save-status saving';
    statusEl.innerHTML = `<span class="writer-save-dot"></span><span>Autosaving…</span>`;
  }

  try {
    const url = ep ? `/api/writer/episodes/${ep.id}` : '/api/writer/episodes';
    const method = ep ? 'PUT' : 'POST';

    const res = await apiFetch(url, {
      method,
      body: JSON.stringify({
        novelId: currentNovelId,
        parentId: writerState.currentParentId ? Number(writerState.currentParentId) : null,
        episodeNumber: num,
        title: title || `Episode ${num}`,
        content: canvas.innerHTML,
        status: 'draft'
      })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      writerState.editorDirty = false;
      if (!ep && data.episode) {
        writerState.currentEpisode = data.episode;
      }
      if (statusEl) {
        statusEl.className = 'writer-save-status saved';
        statusEl.innerHTML = `<span class="writer-save-dot"></span><span>Saved</span>`;
      }
    }
  } catch (e) {
    console.warn('Autosave error:', e);
  }
}

window.generateWriterPublishLink = async (novelId, episodeId) => {
  const currentEpId = episodeId || writerState.currentEpisode?.id || null;
  await saveWriterEpisode(novelId, currentEpId, 'draft', null, true);
};

window.saveWriterEpisode = async (novelId, episodeId, targetStatus = 'draft', scheduledAt = null, generateLinkOnly = false) => {
  const effectiveNovelId = document.getElementById('we-novel-id')?.value || novelId || writerState.selectedNovelId || writerState.novels[0]?.id;
  const num = document.getElementById('we-number')?.value?.trim();
  const title = document.getElementById('we-title')?.value?.trim();
  const canvas = document.getElementById('we-canvas');
  const content = canvas ? canvas.innerHTML : '';
  const plainText = (canvas ? canvas.innerText : '').trim();
  const errorEl = document.getElementById('we-editor-error');
  const draftBtn = document.getElementById('we-save-draft-btn');
  const reviewBtn = document.getElementById('we-submit-review-btn');
  const statusEl = document.getElementById('we-save-status');

  if (errorEl) errorEl.style.display = 'none';

  if (!title) {
    if (errorEl) {
      errorEl.textContent = 'Please enter a title.';
      errorEl.style.display = 'block';
    }
    document.getElementById('we-title')?.focus();
    return;
  }

  if (!plainText) {
    if (errorEl) {
      errorEl.textContent = 'Content cannot be empty.';
      errorEl.style.display = 'block';
    }
    canvas?.focus();
    return;
  }

  // If editing an existing published novel, update in-place immediately without generating duplicate records
  const publishedId = writerState.editingPublishedId || (writerState.currentEpisode && writerState.currentEpisode.publishedArticleId);
  if (publishedId) {
    try {
      const res = await apiFetch(`/api/published-novels/${publishedId}`, {
        method: 'PUT',
        body: JSON.stringify({ title, content })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        if (errorEl) {
          errorEl.textContent = data.error || 'Failed to update published novel.';
          errorEl.style.display = 'block';
        }
        return;
      }
      showToast(`Published novel "${title}" updated successfully! Changes are live on reader page.`);
      writerState.editorDirty = false;
      writerState.editingPublishedId = null;
      switchWriterTab('published-novels');
      return;
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = 'Error updating published novel: ' + err.message;
        errorEl.style.display = 'block';
      }
      return;
    }
  }

  if (draftBtn) draftBtn.disabled = true;
  if (reviewBtn) reviewBtn.disabled = true;
  if (statusEl) {
    statusEl.className = 'writer-save-status saving';
    statusEl.innerHTML = `<span class="writer-save-dot"></span><span>Saving…</span>`;
  }

  try {
    const url = episodeId ? `/api/writer/episodes/${episodeId}` : '/api/writer/episodes';
    const method = episodeId ? 'PUT' : 'POST';

    const res = await apiFetch(url, {
      method,
      body: JSON.stringify({
        novelId: effectiveNovelId,
        episodeNumber: num || undefined,
        title,
        content,
        status: targetStatus,
        scheduledAt: scheduledAt || undefined
      })
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      if (errorEl) {
        errorEl.textContent = data.error || 'Failed to save episode.';
        errorEl.style.display = 'block';
      }
      if (statusEl) {
        statusEl.className = 'writer-save-status unsaved';
        statusEl.innerHTML = `<span class="writer-save-dot"></span><span>Failed</span>`;
      }
      return;
    }

    writerState.editorDirty = false;
    if (statusEl) {
      statusEl.className = 'writer-save-status saved';
      statusEl.innerHTML = `<span class="writer-save-dot"></span><span>Saved</span>`;
    }

    const epNum = data.episode?.episodeNumber || num || '1';
    const contentLink = data.contentLink || (`#reader?novel=${encodeURIComponent(novelId)}&ch=${encodeURIComponent(epNum)}`);
    window.showSavedContentLinkModal({ title, type: 'episode', contentLink });

    if (data.episode) {
      writerState.currentEpisode = data.episode;
    }

    if (targetStatus === 'submitted') {
      try {
        await apiFetch('/api/writer/submissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contentType: 'episode',
            contentId: data.episodeId || episodeId,
            title,
            parentId: novelId
          })
        });
      } catch (subErr) {
        console.warn('Error recording submission:', subErr);
      }
      showToast('Episode submitted for Admin Review! 📩');
    } else if (targetStatus === 'published') {
      showToast('✓ Episode published successfully to website! 📖');
    } else {
      showToast('Novel content draft saved successfully! 💾');
    }

    if (!generateLinkOnly) {
      // Stay on page if user is actively writing
    }
  } catch (err) {
    if (errorEl) {
      errorEl.textContent = err.message || 'Error communicating with server.';
      errorEl.style.display = 'block';
    }
  } finally {
    if (draftBtn) draftBtn.disabled = false;
    if (reviewBtn) reviewBtn.disabled = false;
  }
};

window.previewWriterEditorContent = () => {
  const title = document.getElementById('we-title')?.value?.trim() || 'Untitled Content';
  const canvas = document.getElementById('we-canvas');
  const content = canvas ? canvas.innerHTML : '<p>No content written yet.</p>';
  const authorName = writerState.user?.name || writerState.user?.username || 'Writer';

  openReaderPreviewModal({
    novelTitle: 'Rudhra Novels',
    episodeTitle: title,
    authorName,
    cover: '/default-cover.jpg',
    genre: 'Reader View',
    content,
    isDraft: writerState.editorDirty || true
  });
};

/* ========================================================
   7. READER PREVIEW MODAL
   ======================================================== */
window.setWriterPreviewTheme = (theme) => {
  const body = document.querySelector('.writer-preview-body');
  if (!body) return;
  body.classList.remove('mode-light', 'mode-sepia', 'mode-dark');
  body.classList.add(`mode-${theme}`);
  document.querySelectorAll('.writer-theme-pill').forEach(b => b.classList.remove('active'));
  const activeBtn = document.querySelector(`.writer-theme-${theme}`);
  if (activeBtn) activeBtn.classList.add('active');
};

function openReaderPreviewModal({ novelTitle, episodeTitle, authorName, cover, genre, content, isDraft }) {
  // Remove existing modal if open
  const existing = document.getElementById('writer-reader-preview-overlay');
  if (existing) existing.remove();

  const plainText = (content || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const wordCount = plainText ? plainText.split(/\s+/).length : 0;
  const readTimeMins = Math.max(1, Math.ceil(wordCount / 200));

  const overlay = document.createElement('div');
  overlay.id = 'writer-reader-preview-overlay';
  overlay.className = 'writer-preview-overlay';
  overlay.innerHTML = `
    <div class="writer-preview-modal" role="dialog" aria-modal="true" aria-labelledby="wpreview-title" style="max-width:860px; border-radius:14px; overflow:hidden;">
      <!-- Preview Header with Themes and Generate Link -->
      <div class="writer-preview-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; background:#0B1F33; padding:12px 20px;">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-size:16px;">📖</span>
          <span style="font-weight:600; font-size:13.5px; color:#FFFFFF;">Live Reader Preview ${isDraft ? '— (Draft Content)' : ''}</span>
        </div>

        <div style="display:flex; align-items:center; gap:8px;">
          <div style="display:flex; gap:4px;">
            <button type="button" class="writer-theme-pill writer-theme-light active" style="font-size:11px; padding:3px 8px; border-radius:4px; border:1px solid #CBD5E1; cursor:pointer;" onclick="setWriterPreviewTheme('light')">Light</button>
            <button type="button" class="writer-theme-pill writer-theme-sepia" style="font-size:11px; padding:3px 8px; border-radius:4px; border:1px solid #CBD5E1; background:#FBF0D9; color:#5F4B32; cursor:pointer;" onclick="setWriterPreviewTheme('sepia')">Sepia</button>
            <button type="button" class="writer-theme-pill writer-theme-dark" style="font-size:11px; padding:3px 8px; border-radius:4px; border:1px solid #475569; background:#181A1B; color:#E8E6E3; cursor:pointer;" onclick="setWriterPreviewTheme('dark')">Dark</button>
          </div>
          <button type="button" class="btn btn-gold btn-sm" onclick="closeReaderPreviewModal(); generateWriterPublishLink('${writerState.selectedNovelId}', ${writerState.currentEpisode ? `'${writerState.currentEpisode.id}'` : 'null'})" style="font-weight:700;">
            🔗 Generate Publish Link
          </button>
          <button type="button" class="btn btn-outline" style="color:#FFFFFF; border-color:rgba(255,255,255,0.25); padding:4px 10px; font-size:12px;" onclick="closeReaderPreviewModal()">
            ✕ Close Preview
          </button>
        </div>
      </div>

      <!-- Reader Simulation Canvas -->
      <div class="writer-preview-body mode-light" style="padding:28px 24px; max-height:78vh; overflow-y:auto; transition:background 0.2s, color 0.2s;">
        <div style="text-align:center; margin-bottom:28px; border-bottom:1px solid rgba(200,155,60,0.3); padding-bottom:20px;">
          <div style="font-size:12px; font-weight:700; color:#B88635; text-transform:uppercase; letter-spacing:1px; margin-bottom:4px;">
            Rudhra Prarthana Novels • ${escapeHtml(genre || 'Novel')}
          </div>
          <h2 id="wpreview-title" style="font-family:'Playfair Display',Georgia,serif; font-size:26px; color:inherit; margin:0 0 6px; font-weight:700;">
            ${escapeHtml(episodeTitle)}
          </h2>
          <div style="font-size:12.5px; opacity:0.8; margin-top:4px;">
            ✍️ By ${escapeHtml(authorName)} • ⏱ ${readTimeMins} min read • ${wordCount.toLocaleString()} words
          </div>
        </div>

        <!-- Rendered Story Content -->
        <article class="reader-formatted-content" style="max-width:700px; margin:0 auto; font-family:'Lora','Georgia',serif; font-size:1.15rem; line-height:1.9;">
          ${content}
        </article>

        <div style="text-align:center; margin-top:36px; font-size:1.6rem; color:#C89B3C;">❦</div>

        <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid #E2E8F0; padding-top:16px; margin-top:24px;">
          <button type="button" class="btn btn-outline btn-sm" onclick="closeReaderPreviewModal()">
            ← Back to Edit
          </button>
          <button type="button" class="btn btn-gold btn-sm" onclick="closeReaderPreviewModal(); generateWriterPublishLink('${writerState.selectedNovelId}', ${writerState.currentEpisode ? `'${writerState.currentEpisode.id}'` : 'null'})" style="font-weight:700;">
            🔗 Generate Publish Link
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
}

window.closeReaderPreviewModal = () => {
  const overlay = document.getElementById('writer-reader-preview-overlay');
  if (overlay) overlay.remove();
};

/* ========================================================
   8. PUBLISHING STATUS TAB
   ======================================================== */
async function renderWriterStatus(canvas) {
  canvas.innerHTML = `
    <div class="writer-header-bar">
      <div>
        <h1 class="writer-header-title">Publishing Status & Guidelines</h1>
        <p class="writer-header-sub">Understand the review and publishing workflow for writer episodes.</p>
      </div>
    </div>

    <div class="writer-card">
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:18px;">
        <div style="background:#FFFBEB; border:1px solid #FDE68A; border-radius:10px; padding:20px;">
          <div style="font-weight:700; color:#B45309; font-size:15px; margin-bottom:8px;">1. Writer Draft</div>
          <p style="font-size:13px; color:#78350F; line-height:1.6; margin:0;">
            Created exclusively by you. Revise, edit, and preview anytime. Entirely private and hidden from public readers.
          </p>
        </div>

        <div style="background:#EFF6FF; border:1px solid #BFDBFE; border-radius:10px; padding:20px;">
          <div style="font-weight:700; color:#1D4ED8; font-size:15px; margin-bottom:8px;">2. Submitted for Review</div>
          <p style="font-size:13px; color:#1E40AF; line-height:1.6; margin:0;">
            When your episode is ready, click "Submit for Review". The administrator reviews and approves for public release.
          </p>
        </div>

        <div style="background:#F0FDF4; border:1px solid #BBF7D0; border-radius:10px; padding:20px;">
          <div style="font-weight:700; color:#15803D; font-size:15px; margin-bottom:8px;">3. Published & Live</div>
          <p style="font-size:13px; color:#166534; line-height:1.6; margin:0;">
            Once approved, the episode becomes live in the novel library for readers with full comment and rating features.
          </p>
        </div>
      </div>
    </div>
  `;
}

/* ========================================================
   PUBLISHED NOVEL MANAGEMENT TAB (Writer)
   ======================================================== */
async function renderWriterPublishedNovels(canvas) {
  canvas.innerHTML = `
    <div class="writer-header-bar" style="margin-bottom:16px;">
      <div>
        <h1 class="writer-header-title" style="display:flex; align-items:center; gap:8px;">
          <span>📚</span> Published Novel Management
        </h1>
        <p class="writer-header-sub">Manage, edit, and review all novels and stories you have published for readers.</p>
      </div>
      <div class="writer-header-actions">
        <button type="button" class="btn btn-gold btn-sm" onclick="writerState.editingPublishedId = null; writerState.currentEpisode = null; switchWriterTab('editor');">
          ✍️ + Write Novel Content
        </button>
      </div>
    </div>

    <!-- Summary Stats Strip -->
    <div id="writer-published-summary-mount" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:14px; margin-bottom:20px;">
      <div class="writer-card" style="padding:16px 20px;">
        <div style="font-size:12px; font-weight:600; color:#64748B; text-transform:uppercase;">My Published Novels</div>
        <div id="wpub-stat-total" style="font-size:24px; font-weight:800; color:#0B1F33; margin-top:4px;">Loading…</div>
      </div>
      <div class="writer-card" style="padding:16px 20px;">
        <div style="font-size:12px; font-weight:600; color:#64748B; text-transform:uppercase;">Total Reader Views</div>
        <div id="wpub-stat-views" style="font-size:24px; font-weight:800; color:#2563EB; margin-top:4px;">-</div>
      </div>
      <div class="writer-card" style="padding:16px 20px;">
        <div style="font-size:12px; font-weight:600; color:#64748B; text-transform:uppercase;">Reader Reviews / Comments</div>
        <div id="wpub-stat-comments" style="font-size:24px; font-weight:800; color:#10B981; margin-top:4px;">-</div>
      </div>
    </div>

    <div id="writer-published-table-mount">
      <div style="text-align:center; padding:40px; color:#64748B;">Loading published novels…</div>
    </div>
  `;

  await loadPublishedNovelsWriter();
}

async function loadPublishedNovelsWriter() {
  const mount = document.getElementById('writer-published-table-mount');
  if (!mount) return;

  try {
    const res = await apiFetch('/api/published-novels');
    const data = await res.json();
    if (!res.ok || !data.success) {
      mount.innerHTML = `<div style="color:#EF4444; padding:20px;">Failed to load published novels: ${data.error || 'Server error'}</div>`;
      return;
    }

    const items = data.items || [];
    const navCount = document.getElementById('wnav-published-count');
    if (navCount) navCount.textContent = items.length;

    const totalViews = items.reduce((acc, i) => acc + (i.viewsCount || 0), 0);
    const totalComments = items.reduce((acc, i) => acc + (i.commentsCount || 0), 0);

    const totalEl = document.getElementById('wpub-stat-total');
    const viewsEl = document.getElementById('wpub-stat-views');
    const commentsEl = document.getElementById('wpub-stat-comments');
    if (totalEl) totalEl.textContent = items.length;
    if (viewsEl) viewsEl.textContent = totalViews.toLocaleString();
    if (commentsEl) commentsEl.textContent = totalComments.toLocaleString();

    if (items.length === 0) {
      mount.innerHTML = `
        <div class="writer-card" style="padding:48px 24px; text-align:center;">
          <div style="font-size:40px; margin-bottom:12px;">📚</div>
          <h3 style="font-size:18px; font-weight:700; color:#0B1F33; margin:0 0 6px;">No Published Novels Yet</h3>
          <p style="color:#64748B; font-size:14px; margin:0 0 20px;">You haven't published any novel content to frontend categories yet.</p>
          <button type="button" class="btn btn-gold btn-sm" onclick="switchWriterTab('editor')">
            ✍️ + Write Your First Novel Content
          </button>
        </div>
      `;
      return;
    }

    mount.innerHTML = `
      <div class="writer-table-wrap" style="box-shadow:0 1px 3px rgba(0,0,0,0.05); border-radius:12px; overflow-x:auto;">
        <table class="admin-table" style="width:100%; border-collapse:collapse; min-width:850px;">
          <thead>
            <tr style="background:#F8FAFC; border-bottom:1px solid #E2E8F0;">
              <th style="padding:14px 18px; text-align:left; font-size:12.5px; font-weight:700; color:#475569;">Title & Reader Link</th>
              <th style="padding:14px 18px; text-align:left; font-size:12.5px; font-weight:700; color:#475569;">Category / Section</th>
              <th style="padding:14px 18px; text-align:center; font-size:12.5px; font-weight:700; color:#475569;">Views / Comments</th>
              <th style="padding:14px 18px; text-align:left; font-size:12.5px; font-weight:700; color:#475569;">Published Date</th>
              <th style="padding:14px 18px; text-align:right; font-size:12.5px; font-weight:700; color:#475569;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(item => `
              <tr style="border-bottom:1px solid #F1F5F9; transition:background 0.15s;" onmouseover="this.style.background='#F8FAFC'" onmouseout="this.style.background='transparent'">
                <td style="padding:14px 18px;">
                  <div style="font-weight:700; font-size:14.5px; color:#0B1F33; margin-bottom:4px;">
                    <a href="#thread?id=${item.id}" target="_blank" style="color:#0B1F33; text-decoration:none; display:inline-flex; align-items:center; gap:6px;">
                      <span>${escapeHtml(item.title)}</span>
                      <span style="font-size:11px; color:#3B82F6;">↗</span>
                    </a>
                  </div>
                  <div style="font-size:12px; color:#64748B; display:flex; align-items:center; gap:8px;">
                    <span style="background:#F1F5F9; padding:2px 6px; border-radius:4px; font-family:monospace; font-size:11px;">#thread?id=${item.id}</span>
                    <button type="button" class="btn btn-outline" style="padding:1px 6px; font-size:10.5px; height:auto;" onclick="navigator.clipboard.writeText(window.location.origin + '/#thread?id=${item.id}'); showToast('Reader link copied!');">
                      📋 Copy Link
                    </button>
                  </div>
                </td>
                <td style="padding:14px 18px; font-size:13px;">
                  <span style="background:#EDE9FE; color:#5B21B6; padding:3px 8px; border-radius:6px; font-weight:600; font-size:12px;">
                    ${escapeHtml(item.categoryTitle || 'General')}
                  </span>
                  ${item.subcategoryTitle ? `
                    <div style="font-size:11.5px; color:#64748B; margin-top:4px;">
                      ${escapeHtml(item.subcategoryTitle)}
                    </div>
                  ` : ''}
                </td>
                <td style="padding:14px 18px; text-align:center; font-size:12.5px;">
                  <span style="font-weight:700; color:#0B1F33;">${item.viewsCount}</span> <span style="color:#94A3B8;">views</span>
                  <div style="font-size:11.5px; color:#64748B;">${item.commentsCount} comments</div>
                </td>
                <td style="padding:14px 18px; font-size:12.5px; color:#64748B;">
                  ${item.publishedAt ? new Date(item.publishedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                </td>
                <td style="padding:14px 18px; text-align:right;">
                  <div style="display:inline-flex; align-items:center; gap:8px;">
                    <button type="button" class="btn btn-outline btn-sm" onclick="editPublishedNovelWriter(${item.id})" style="display:inline-flex; align-items:center; gap:4px; font-weight:600; padding:6px 12px;" title="Edit Title and Content in Editor">
                      ✏️ Edit
                    </button>
                    <button type="button" class="btn btn-outline btn-sm" onclick="deletePublishedNovelWriter(${item.id}, '${escapeQuote(item.title)}')" style="color:#DC2626; border-color:#FCA5A5; display:inline-flex; align-items:center; gap:4px; font-weight:600; padding:6px 12px;" title="Delete Published Novel">
                      🗑️ Delete
                    </button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    mount.innerHTML = `<div style="color:#EF4444; padding:20px;">Error loading published novels: ${err.message}</div>`;
  }
}

window.editPublishedNovelWriter = async (publishedId) => {
  try {
    const res = await apiFetch(`/api/published-novels/${publishedId}`);
    const data = await res.json();
    if (!res.ok || !data.success) {
      showToast(data.error || 'Failed to load published novel for editing.');
      return;
    }
    const item = data.item;
    writerState.editingPublishedId = item.id;
    writerState.currentEpisode = {
      id: item.chapterId || null,
      publishedArticleId: item.id,
      novelId: item.novelId,
      title: item.title,
      content: item.content,
      status: 'published'
    };
    switchWriterTab('editor');

    setTimeout(() => {
      const titleInput = document.getElementById('we-title');
      const canvas = document.getElementById('we-canvas');
      if (titleInput) titleInput.value = item.title || '';
      if (canvas) canvas.innerHTML = item.content || '';
      if (typeof handleStoryInput === 'function') handleStoryInput(false);
      showToast(`Editing published novel "${item.title}". Update title & content, then click Save.`);
    }, 150);
  } catch (err) {
    showToast('Error opening published novel: ' + err.message);
  }
};

window.cancelEditingPublishedNovelWriter = () => {
  writerState.editingPublishedId = null;
  writerState.currentEpisode = null;
  switchWriterTab('published-novels');
};

window.deletePublishedNovelWriter = async (id, title) => {
  const confirmed = confirm(`Are you sure you want to delete the published novel "${title}"?\n\nThis will permanently remove it from the reader page and delete associated comments.`);
  if (!confirmed) return;

  try {
    const res = await apiFetch(`/api/published-novels/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok || !data.success) {
      showToast(data.error || 'Failed to delete published novel.');
      return;
    }
    showToast(`Published novel "${title}" was successfully deleted.`);
    loadPublishedNovelsWriter();
  } catch (err) {
    showToast('Error deleting published novel: ' + err.message);
  }
};

/* ========================================================
   9. WRITER PROFILE & PASSWORD TAB
   ======================================================== */
async function renderWriterProfile(canvas) {
  const user = writerState.user || {};

  canvas.innerHTML = `
    <div class="writer-header-bar">
      <div>
        <h1 class="writer-header-title">Profile & Password</h1>
        <p class="writer-header-sub">Manage your writer identity and update your password.</p>
      </div>
    </div>

    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap:24px;">
      <!-- Writer Identity Card -->
      <div class="writer-card">
        <h2 class="writer-card-title" style="margin-bottom:18px;">Writer Details</h2>

        <div class="writer-form-group">
          <label class="writer-form-label">Display Name</label>
          <input type="text" class="writer-form-input" value="${escapeHtml(user.name || user.username)}" disabled 
                 style="background:#F8FAFC; color:#64748B;">
          <div class="writer-form-hint">Display name registered by administration.</div>
        </div>

        <div class="writer-form-group">
          <label class="writer-form-label">Email Address</label>
          <input type="email" class="writer-form-input" value="${escapeHtml(user.email || '')}" disabled 
                 style="background:#F8FAFC; color:#64748B; font-family:monospace;">
          <div class="writer-form-hint">Your verified login email.</div>
        </div>

        <div class="writer-form-group" style="margin-bottom:0;">
          <label class="writer-form-label">Account Status</label>
          <span class="writer-badge published">✓ Active Writer</span>
        </div>
      </div>

      <!-- Change Password Card -->
      <div class="writer-card">
        <h2 class="writer-card-title" style="margin-bottom:18px;">Change Password</h2>

        <div id="wp-pass-error" style="display:none; color:#DC2626; background:#FEF2F2; border:1px solid #FCA5A5; padding:10px 14px; border-radius:8px; font-size:13px; margin-bottom:16px; font-weight:600;"></div>

        <form onsubmit="event.preventDefault(); submitWriterPasswordChange();">
          <div class="writer-form-group">
            <label class="writer-form-label" for="wp-new-pass">
              New Password <span style="color:#DC2626;">*</span>
            </label>
            <input type="password" id="wp-new-pass" class="writer-form-input" placeholder="Min 6 characters" required minlength="6">
          </div>

          <div class="writer-form-group">
            <label class="writer-form-label" for="wp-confirm-pass">
              Confirm New Password <span style="color:#DC2626;">*</span>
            </label>
            <input type="password" id="wp-confirm-pass" class="writer-form-input" placeholder="Re-enter new password" required minlength="6">
          </div>

          <button type="submit" id="wp-pass-btn" class="btn btn-gold" style="width:100%; padding:11px; font-weight:600;">
            Update Password
          </button>
        </form>
      </div>
    </div>
  `;
}

window.submitWriterPasswordChange = async () => {
  const newPass = document.getElementById('wp-new-pass')?.value;
  const confirmPass = document.getElementById('wp-confirm-pass')?.value;
  const errorEl = document.getElementById('wp-pass-error');
  const btn = document.getElementById('wp-pass-btn');

  if (errorEl) errorEl.style.display = 'none';

  if (!newPass || newPass.length < 6) {
    if (errorEl) {
      errorEl.textContent = 'Password must be at least 6 characters.';
      errorEl.style.display = 'block';
    }
    return;
  }

  if (newPass !== confirmPass) {
    if (errorEl) {
      errorEl.textContent = 'New passwords do not match.';
      errorEl.style.display = 'block';
    }
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Updating...';
  }

  try {
    const res = await apiFetch('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify({ newPassword: newPass })
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      if (errorEl) {
        errorEl.textContent = data.error || 'Failed to update password.';
        errorEl.style.display = 'block';
      }
      return;
    }

    showToast('Password updated successfully! 🔒');
    const p1 = document.getElementById('wp-new-pass');
    const p2 = document.getElementById('wp-confirm-pass');
    if (p1) p1.value = '';
    if (p2) p2.value = '';
  } catch (err) {
    if (errorEl) {
      errorEl.textContent = err.message || 'Error updating password.';
      errorEl.style.display = 'block';
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Update Password';
    }
  }
};


// ============================================================================
// WRITER ASSIGNMENTS, STORIES, SCHEDULE & NOTIFICATIONS VIEWS
// ============================================================================

/**
 * Render My Assignments Tab
 */
async function renderWriterAssignments(canvas) {
  try {
    const res = await apiFetch('/api/writer/assignments');
    const data = await res.json();
    const assignments = data.assignments || [];

    canvas.innerHTML = `
      <div class="writer-header-bar">
        <div>
          <h1 class="writer-header-title">My Content Assignments</h1>
          <p class="writer-header-subtitle">Novels, short stories, and chapters assigned to you by the administrator.</p>
        </div>
      </div>

      <div class="writer-card" style="padding:0; overflow:hidden;">
        ${assignments.length > 0 ? `
          <div class="admin-table-wrap">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Content Type</th>
                  <th>Assigned Item Title</th>
                  <th>Instructions / Editorial Notes</th>
                  <th>Deadline</th>
                  <th>Status</th>
                  <th style="text-align:right;">Action</th>
                </tr>
              </thead>
              <tbody>
                ${assignments.map(a => `
                  <tr>
                    <td><span class="assignment-badge ${a.contentType}">${a.contentType.toUpperCase().replace('_', ' ')}</span></td>
                    <td><strong style="color:#1A0B2E; font-size:13.5px;">${escapeHtml(a.title)}</strong></td>
                    <td style="color:#64748B; font-size:12.5px;">${escapeHtml(a.instructions || 'Follow editorial guidelines')}</td>
                    <td style="font-size:12px; color:#64748B;">
                      ${a.deadline ? `📅 ${new Date(a.deadline).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}` : '<span style="color:#94A3B8;">No deadline</span>'}
                    </td>
                    <td>
                      <span style="font-size:11px; font-weight:700; color:${a.status === 'active' ? '#166534' : '#64748B'}; background:${a.status === 'active' ? '#DCFCE7' : '#F1F5F9'}; padding:2px 8px; border-radius:10px;">
                        ${a.status.toUpperCase()}
                      </span>
                    </td>
                    <td style="text-align:right;">
                      ${a.contentType === 'novel' ? `
                        <button type="button" class="btn btn-gold btn-xs" onclick="switchWriterTab('episodes', { novelId: '${a.contentId}' })">
                          Write Episodes ➔
                        </button>
                      ` : (a.contentType === 'short_story' ? `
                        <button type="button" class="btn btn-gold btn-xs" onclick="switchWriterTab('short-stories')">
                          Open Story ➔
                        </button>
                      ` : `
                        <button type="button" class="btn btn-gold btn-xs" onclick="switchWriterTab('editor', { episodeId: '${a.contentId}' })">
                          Write / Edit ➔
                        </button>
                      `)}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : `
          <div style="text-align:center; padding:48px 20px; color:#64748B;">
            <div style="font-size:36px; margin-bottom:8px;">🎯</div>
            <div style="font-size:15px; font-weight:600; color:#1A0B2E; margin-bottom:4px;">No Assigned Tasks Currently</div>
            <p style="font-size:13px; margin:0 0 16px;">The administrator has not assigned specific content to your queue at this moment.</p>
          </div>
        `}
      </div>
    `;
  } catch (err) {
    canvas.innerHTML = '<div class="writer-card" style="color:#EF4444; padding:24px;">Failed to load assignments.</div>';
  }
}

/**
 * Render Writer Short Stories Tab
 */
async function renderWriterShortStories(canvas) {
  try {
    const res = await apiFetch('/api/writer/short-stories');
    const data = await res.json();
    const stories = data.stories || [];

    canvas.innerHTML = `
      <div class="writer-header-bar">
        <div>
          <h1 class="writer-header-title">My Short Stories</h1>
          <p class="writer-header-subtitle">Create and manage your permitted short stories.</p>
        </div>
      </div>

      <div class="writer-card" style="padding:0; overflow:hidden;">
        ${stories.length > 0 ? `
          <div class="admin-table-wrap">
            <table class="admin-table">
              <thead>
                <tr>
                  <th style="width:50px;">Cover</th>
                  <th>Story Title</th>
                  <th>Genre</th>
                  <th>Status / Review</th>
                  <th>Reads</th>
                  <th>Updated</th>
                  <th style="text-align:right;">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${stories.map(s => `
                  <tr>
                    <td>
                      <img src="${s.cover_image || '/default-cover.jpg'}" alt="" style="width:36px; height:46px; object-fit:cover; border-radius:4px;" onerror="this.src='/default-cover.jpg';">
                    </td>
                    <td>
                      <strong style="color:#1A0B2E; font-size:13.5px;">${escapeHtml(s.title)}</strong>
                      ${s.title_ta ? `<div style="font-size:11.5px; color:#B88635;">${escapeHtml(s.title_ta)}</div>` : ''}
                    </td>
                    <td style="font-size:12px; color:#64748B;">${escapeHtml(s.genre || 'Short Story')}</td>
                    <td>
                      <span class="sub-status-pill ${s.review_status === 'pending_review' ? 'sub-status-pending' : (s.review_status === 'changes_requested' ? 'sub-status-changes' : 'sub-status-published')}">
                        ${s.review_status || s.status}
                      </span>
                    </td>
                    <td style="font-size:12px;">👁️ ${Number(s.views_count || 0).toLocaleString()}</td>
                    <td style="font-size:12px; color:#64748B;">${new Date(s.updated_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}</td>
                    <td style="text-align:right;">
                      <a href="#story?id=${s.slug || s.id}" class="btn btn-outline btn-xs" target="_blank">View ➔</a>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : `
          <div style="text-align:center; padding:48px 20px; color:#64748B;">
            <div style="font-size:36px; margin-bottom:8px;">📖</div>
            <div style="font-size:15px; font-weight:600; color:#1A0B2E; margin-bottom:4px;">No Short Stories Yet</div>
            <p style="font-size:13px; margin:0;">You have not been assigned or authored any short stories yet.</p>
          </div>
        `}
      </div>
    `;
  } catch (err) {
    canvas.innerHTML = '<div class="writer-card" style="color:#EF4444; padding:24px;">Failed to load short stories.</div>';
  }
}

/**
 * Render Writer Audio Novels Tab
 */
async function renderWriterAudioNovels(canvas) {
  try {
    const res = await apiFetch('/api/writer/audio-novels');
    const data = await res.json();
    const audioNovels = data.audioNovels || [];

    if (writerState.selectedAudioNovelForEpisodes) {
      return renderWriterAudioEpisodesTree(canvas, writerState.selectedAudioNovelForEpisodes);
    }

    canvas.innerHTML = `
      <div class="writer-header-bar">
        <div>
          <h1 class="writer-header-title">My Audio Novels</h1>
          <p class="writer-header-subtitle">Manage audio novel episodes, audio files, YouTube links, and submissions where authorized.</p>
        </div>
      </div>

      <div class="writer-card" style="padding:0; overflow:hidden;">
        ${audioNovels.length > 0 ? `
          <div class="admin-table-wrap">
            <table class="admin-table">
              <thead>
                <tr>
                  <th style="width:50px;">Cover</th>
                  <th>Audio Novel Title</th>
                  <th>Author / Voice</th>
                  <th>Episodes</th>
                  <th>Status</th>
                  <th style="text-align:right;">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${audioNovels.map(a => `
                  <tr>
                    <td>
                      <img src="${a.cover || '/default-cover.jpg'}" alt="" style="width:36px; height:46px; object-fit:cover; border-radius:4px;" onerror="this.src='/default-cover.jpg';">
                    </td>
                    <td>
                      <strong style="color:#1A0B2E; font-size:13.5px;">${escapeHtml(a.title)}</strong>
                      <div style="font-size:11.5px; color:#64748B;">ID: ${escapeHtml(a.id)}</div>
                    </td>
                    <td style="font-size:12px; color:#475569;">
                      <div>✍️ ${escapeHtml(a.author || 'Rudhra Prarthana')}</div>
                      <div style="color:#64748B;">🎙️ ${escapeHtml(a.audio_voice || a.author || 'Rudhra Prarthana')}</div>
                    </td>
                    <td style="font-size:12.5px; font-weight:600; color:#1A0B2E;">
                      🎧 ${a.total_episodes || 0} episodes
                    </td>
                    <td>
                      <span class="sub-status-pill ${a.is_published ? 'sub-status-published' : 'sub-status-pending'}">
                        ${a.is_published ? 'Published' : 'Draft'}
                      </span>
                    </td>
                    <td style="text-align:right;">
                      <div style="display:flex; gap:6px; justify-content:flex-end;">
                        <button type="button" class="btn btn-gold btn-xs" onclick="openWriterAudioEpisodes('${a.id}')">
                          📖 Episodes & Audio
                        </button>
                        <a href="#audio?novel=${encodeURIComponent(a.id)}" class="btn btn-outline btn-xs" target="_blank">
                          ▶ Listen
                        </a>
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : `
          <div style="text-align:center; padding:48px 20px; color:#64748B;">
            <div style="font-size:36px; margin-bottom:8px;">🎧</div>
            <div style="font-size:15px; font-weight:600; color:#1A0B2E; margin-bottom:4px;">No Audio Novels Assigned</div>
            <p style="font-size:13px; margin:0;">Audio novel management will be available when an audio novel project is assigned to you by the admin.</p>
          </div>
        `}
      </div>
      <div id="writer-audio-modal-mount"></div>
    `;

    window.openWriterAudioEpisodes = (novelId) => {
      writerState.selectedAudioNovelForEpisodes = novelId;
      const c = document.getElementById('writer-main-canvas');
      if (c) renderWriterAudioNovels(c);
    };
  } catch (err) {
    canvas.innerHTML = '<div class="writer-card" style="color:#EF4444; padding:24px;">Failed to load audio novels: ' + err.message + '</div>';
  }
}

async function renderWriterAudioEpisodesTree(canvas, novelId) {
  try {
    const res = await apiFetch(`/api/admin/audio-episodes?novel=${encodeURIComponent(novelId)}`);
    const data = await res.json();
    const chapters = data.episodes || [];

    canvas.innerHTML = `
      <div class="writer-header-bar" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
        <div>
          <button type="button" class="btn btn-outline btn-xs" onclick="writerState.selectedAudioNovelForEpisodes = null; switchWriterTab('audio-novels');" style="margin-bottom:6px;">
            « Back to Audio Novels
          </button>
          <h1 class="writer-header-title">Manage Episodes: ${escapeHtml(novelId)}</h1>
          <p class="writer-header-subtitle">Create chapters, upload audio files, and embed YouTube videos.</p>
        </div>
        <div style="display:flex; gap:8px;">
          <button type="button" class="btn btn-gold btn-sm" onclick="openWriterAudioEpisodeModal({ novelId: '${novelId}' })">
            + Add Episode
          </button>
        </div>
      </div>

      <div class="writer-card" style="padding:16px;">
        ${chapters.length === 0 ? `
          <div style="text-align:center; padding:40px 20px; color:#64748B;">
            <div style="font-size:32px; margin-bottom:8px;">📖</div>
            <h4 style="color:#1A0B2E; margin-bottom:6px;">No Chapters or Episodes Added Yet</h4>
            <p style="font-size:13px; margin-bottom:16px;">Click below to add your first episode to this audio novel.</p>
            <button type="button" class="btn btn-gold btn-sm" onclick="openWriterAudioEpisodeModal({ novelId: '${novelId}' })">
              + Add Episode
            </button>
          </div>
        ` : `
          <div style="display:flex; flex-direction:column; gap:12px;">
            ${chapters.map(ch => renderWriterAudioChapterCard(ch, novelId)).join('')}
          </div>
        `}
      </div>
      <div id="writer-audio-modal-mount"></div>
    `;
  } catch (err) {
    canvas.innerHTML = '<div class="writer-card" style="color:#EF4444; padding:24px;">Failed to load episodes: ' + err.message + '</div>';
  }
}

function renderWriterAudioChapterCard(ch, novelId) {
  const subs = ch.subEpisodes || [];
  const hasAudio = Boolean(ch.audioFileUrl);
  const hasYt = Boolean(ch.youtubeVideoId || ch.youtubeUrl);

  return `
    <div style="border:1px solid #E2E8F0; border-radius:8px; overflow:hidden;">
      <div style="background:#F8FAFC; padding:12px 16px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
        <div>
          <span class="admin-audio-chapter-badge">Chapter ${escapeHtml(ch.chapterNum || ch.episodeNumber)}</span>
          <strong style="margin-left:8px; color:#0B1F33; font-size:14px;">${escapeHtml(ch.title)}</strong>
          ${ch.audioDuration ? `<span style="font-size:11px; color:#64748B; margin-left:8px;">⏱ ${escapeHtml(ch.audioDuration)}</span>` : ''}
          <span class="sub-status-pill ${ch.status === 'published' ? 'sub-status-published' : 'sub-status-pending'}" style="margin-left:8px; font-size:9.5px;">${ch.status}</span>
        </div>
        <div style="display:flex; gap:6px;">
          <button type="button" class="btn btn-gold btn-xs" onclick="openWriterAudioEpisodeModal({ novelId: '${novelId}', parentId: ${ch.id} })">
            ➕ Add Episode
          </button>
        </div>
      </div>

      ${subs.length > 0 ? `
        <div style="padding:10px 16px; background:#FFF;">
          ${subs.map(ep => `
            <div style="padding:8px 10px; border-bottom:1px solid #F1F5F9; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
              <div style="display:flex; align-items:center; gap:8px;">
                <span class="admin-audio-badge-sm">Episode ${escapeHtml(ep.episodeNumber)}</span>
                <span style="font-size:13px; font-weight:600; color:#1A0B2E;">${escapeHtml(ep.title)}</span>
                ${ep.hasAudio && ep.hasYouTube ? '<span style="font-size:10px; color:#701A75; font-weight:700;">🎧+🎥 Both</span>' : (ep.hasYouTube ? '<span style="font-size:10px; color:#DC2626;">🎥 Video</span>' : '<span style="font-size:10px; color:#D97706;">🎧 Audio</span>')}
                <span class="sub-status-pill ${ep.status === 'published' ? 'sub-status-published' : 'sub-status-pending'}" style="font-size:9.5px;">${ep.status}</span>
              </div>
              <div style="display:flex; gap:4px;">
                <button type="button" class="btn btn-outline btn-xs" onclick="openWriterAudioEpisodeModal({ novelId: '${novelId}', episodeId: ${ep.id} })">✏️ Edit</button>
              </div>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

window.openWriterAudioEpisodeModal = async ({ novelId, parentId = null, episodeId = null } = {}) => {
  const mount = document.getElementById('writer-audio-modal-mount');
  if (!mount) return;

  const isEdit = Boolean(episodeId);
  const isIndependent = writerState.permissions?.accessLevel === 'independent_publish';

  mount.innerHTML = `
    <div class="modal-overlay open" id="writer-aep-modal" onclick="if(event.target === this) closeWriterAudioModal();">
      <div class="modal-card admin-modal-card" style="max-width:680px; max-height:92vh; overflow-y:auto;">
        <div class="modal-header">
          <h3 class="modal-title">${isEdit ? 'Edit Audio Episode' : '+ Add Audio Episode'}</h3>
          <button class="modal-close-btn" onclick="closeWriterAudioModal()">✕</button>
        </div>
        <div class="modal-body" style="padding:20px 24px;">
          <form id="writer-aep-form" onsubmit="event.preventDefault(); submitWriterAudioEpisodeForm();">
            <input type="hidden" id="waep-novel-id" value="${escapeHtml(novelId)}">
            <input type="hidden" id="waep-episode-id" value="${episodeId || ''}">
            <input type="hidden" id="waep-parent-id" value="${parentId || ''}">

            <div id="waep-error" class="novel-form-banner-error" style="display:none; margin-bottom:14px;"></div>

            <div class="form-group" style="margin-bottom:14px;">
              <label class="form-label" style="font-weight:700;">Episode Title <span style="color:#EF4444;">*</span></label>
              <input type="text" id="waep-title" class="form-input" placeholder="e.g. Episode 1.1 — Journey into the Mist" required>
            </div>

            <div class="form-group" style="margin-bottom:14px;">
              <label class="form-label">Duration (Optional)</label>
              <input type="text" id="waep-duration" class="form-input" placeholder="e.g. 18:30 (auto-detected on upload)">
            </div>

            <!-- Media Options -->
            <div style="padding:14px; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px; margin-bottom:16px;">
              <label class="form-label" style="font-weight:700; margin-bottom:8px; display:block;">Media Playback Choice</label>
              <div style="display:flex; gap:10px; margin-bottom:12px; flex-wrap:wrap;">
                <label style="display:inline-flex; align-items:center; gap:6px; cursor:pointer; font-size:13px; font-weight:600; padding:6px 12px; background:#FFF; border:1px solid #CBD5E1; border-radius:6px;">
                  <input type="radio" name="waep-source-type" value="both" checked onchange="toggleWaepMedia(this.value)">
                  <span>🎧+🎥 Both Audio & YouTube</span>
                </label>
                <label style="display:inline-flex; align-items:center; gap:6px; cursor:pointer; font-size:13px; font-weight:600; padding:6px 12px; background:#FFF; border:1px solid #CBD5E1; border-radius:6px;">
                  <input type="radio" name="waep-source-type" value="audio_file" onchange="toggleWaepMedia(this.value)">
                  <span>🎧 Audio Only</span>
                </label>
                <label style="display:inline-flex; align-items:center; gap:6px; cursor:pointer; font-size:13px; font-weight:600; padding:6px 12px; background:#FFF; border:1px solid #CBD5E1; border-radius:6px;">
                  <input type="radio" name="waep-source-type" value="youtube" onchange="toggleWaepMedia(this.value)">
                  <span>🎥 YouTube Only</span>
                </label>
              </div>

              <!-- Audio Section -->
              <div id="waep-audio-wrap" style="padding:10px; background:#FFF; border:1px solid #E2E8F0; border-radius:6px; margin-bottom:10px;">
                <label class="form-label" style="font-weight:600;">Upload Audio File (MP3, M4A, WAV up to 50MB)</label>
                <input type="file" id="waep-audio-input" accept="audio/*" onchange="handleWaepAudioFile(this.files[0])" class="form-input">
                <input type="hidden" id="waep-audio-base64" value="">
                <div id="waep-audio-status" style="font-size:11.5px; color:#64748B; margin-top:4px;"></div>
              </div>

              <!-- YouTube Section -->
              <div id="waep-yt-wrap" style="padding:10px; background:#FFF; border:1px solid #E2E8F0; border-radius:6px;">
                <label class="form-label" style="font-weight:600;">YouTube Video Link</label>
                <input type="url" id="waep-youtube-url" class="form-input" placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/...">
              </div>
            </div>

            <!-- Status Actions -->
            <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:20px;">
              <button type="button" class="btn btn-outline" onclick="closeWriterAudioModal()">Cancel</button>
              <button type="button" class="btn btn-outline" onclick="submitWriterAudio('draft')">💾 Save Draft</button>
              ${isIndependent ? `
                <button type="button" class="btn btn-gold" onclick="submitWriterAudio('published')">🚀 Publish Now</button>
              ` : `
                <button type="button" class="btn btn-gold" onclick="submitWriterAudio('submitted')">📤 Submit for Review</button>
              `}
            </div>
          </form>
        </div>
      </div>
    </div>
  `;

  window.toggleWaepMedia = (val) => {
    const aWrap = document.getElementById('waep-audio-wrap');
    const yWrap = document.getElementById('waep-yt-wrap');
    if (aWrap) aWrap.style.display = val === 'youtube' ? 'none' : 'block';
    if (yWrap) yWrap.style.display = val === 'audio_file' ? 'none' : 'block';
  };

  window.handleWaepAudioFile = (file) => {
    if (!file) return;
    const stat = document.getElementById('waep-audio-status');
    const base64Input = document.getElementById('waep-audio-base64');
    if (stat) stat.textContent = `Loading ${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)...`;

    const reader = new FileReader();
    reader.onload = (e) => {
      if (base64Input) base64Input.value = e.target.result;
      if (stat) stat.textContent = `✓ Ready: ${file.name}`;
    };
    reader.readAsDataURL(file);
  };
};

window.closeWriterAudioModal = () => {
  document.getElementById('writer-aep-modal')?.remove();
};

window.submitWriterAudio = async (statusTarget) => {
  const novelId = document.getElementById('waep-novel-id')?.value;
  const episodeId = document.getElementById('waep-episode-id')?.value;
  const parentId = document.getElementById('waep-parent-id')?.value || null;
  const title = (document.getElementById('waep-title')?.value || '').trim();
  const audioDuration = (document.getElementById('waep-duration')?.value || '').trim();
  const sourceType = document.querySelector('input[name="waep-source-type"]:checked')?.value || 'both';
  const youtubeUrl = (document.getElementById('waep-youtube-url')?.value || '').trim();
  const audioData = document.getElementById('waep-audio-base64')?.value || '';

  const errEl = document.getElementById('waep-error');
  if (!title) {
    if (errEl) { errEl.textContent = 'Episode title is required.'; errEl.style.display = 'block'; }
    return;
  }

  const payload = {
    novelId,
    parentId: parentId ? Number(parentId) : null,
    title,
    audioDuration,
    status: statusTarget,
    sourceType,
    youtubeUrl: (sourceType === 'youtube' || sourceType === 'both') ? youtubeUrl : null,
    audioData: (sourceType === 'audio_file' || sourceType === 'both') ? audioData : null
  };

  try {
    const isEdit = Boolean(episodeId);
    const endpoint = isEdit ? `/api/writer/audio-episodes/${episodeId}` : '/api/writer/audio-episodes';
    const method = isEdit ? 'PUT' : 'POST';

    const res = await apiFetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      if (errEl) { errEl.textContent = data.error || 'Failed to save audio episode.'; errEl.style.display = 'block'; }
      return;
    }

    showToast(data.message || 'Episode saved successfully!');
    closeWriterAudioModal();
    const c = document.getElementById('writer-main-canvas');
    if (c) renderWriterAudioNovels(c);
  } catch (err) {
    if (errEl) { errEl.textContent = err.message; errEl.style.display = 'block'; }
  }
};


async function renderWriterSchedule(canvas) {
  canvas.innerHTML = `
    <div class="writer-header-bar">
      <div>
        <h1 class="writer-header-title">Publication Schedule (Asia/Kolkata)</h1>
        <p class="writer-header-subtitle">Upcoming releases and automated publication timeline in Indian Standard Time (IST).</p>
      </div>
    </div>

    <div id="writer-schedule-mount">
      <div style="text-align:center; padding:40px; color:#64748B;">
        Loading publication schedule...
      </div>
    </div>
  `;

  try {
    const res = await apiFetch('/api/writer/schedule');
    const data = await res.json();
    const scheduled = data.scheduled || [];
    const mount = document.getElementById('writer-schedule-mount');
    if (!mount) return;

    if (scheduled.length === 0) {
      mount.innerHTML = `
        <div class="writer-card" style="text-align:center; padding:48px 20px; color:#64748B;">
          <div style="font-size:36px; margin-bottom:8px;">🕒</div>
          <div style="font-size:15px; font-weight:600; color:#1A0B2E; margin-bottom:4px;">No Releases Currently Scheduled</div>
          <p style="font-size:13px; margin:0 0 16px;">Scheduled episodes and stories will appear here.</p>
          <button type="button" class="btn btn-gold btn-sm" onclick="switchWriterTab('editor')">+ Schedule an Episode</button>
        </div>
      `;
      return;
    }

    mount.innerHTML = `
      <div class="writer-card" style="padding:0; overflow:hidden;">
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Novel</th>
                <th>Episode Title</th>
                <th>Scheduled Release (IST)</th>
                <th>Status</th>
                <th style="text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${scheduled.map(e => {
                const timeText = e.formattedIST || (typeof window.formatISTDisplay === 'function' ? window.formatISTDisplay(e.scheduledAt) : e.scheduledAt);
                const isUnderReview = e.status === 'submitted' || e.reviewStatus === 'pending_review';
                return `
                  <tr>
                    <td><strong>${escapeHtml(e.novelTitle || 'Novel')}</strong></td>
                    <td>${escapeHtml(e.title || `Episode #${e.episodeNumber}`)}</td>
                    <td style="color:#1A0B2E; font-weight:700;">
                      🕒 ${timeText}
                    </td>
                    <td>
                      ${isUnderReview ? `
                        <span class="sub-status-pill sub-status-submitted" style="background:#FEF3C7; color:#92400E; border:1px solid #FCD34D;">⏳ Pending Admin Approval</span>
                      ` : `
                        <span class="sub-status-pill sub-status-approved" style="background:#ECFDF5; color:#065F46; border:1px solid #A7F3D0;">✓ Scheduled for Release</span>
                      `}
                    </td>
                    <td style="text-align:right;">
                      <div style="display:inline-flex; align-items:center; gap:6px;">
                        <button type="button" class="btn btn-outline btn-xs" onclick="window.copyGeneratedModalLink('${window.location.origin}/#reader?novel=${encodeURIComponent(e.novel_id || currentNovelId)}&ch=${encodeURIComponent(e.episode_number || e.chapter_num || '1')}')" title="Copy Content Link">
                            📋 Copy Link
                          </button>
                        <button type="button" class="btn btn-outline btn-xs" onclick="openWriterRescheduleModal(${e.id}, '${escapeQuote(e.title)}', '${e.scheduledAt}')" title="Change date/time">
                          ✏️ Reschedule
                        </button>
                        <button type="button" class="btn btn-outline btn-xs" onclick="writerCancelScheduleAction(${e.id})" style="color:#DC2626;" title="Cancel schedule (revert to draft)">
                          ✕ Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch (err) {
    const mount = document.getElementById('writer-schedule-mount');
    if (mount) mount.innerHTML = `<div style="color:#DC2626; padding:20px;">Failed to load schedule: ${err.message}</div>`;
  }
}

window.openWriterScheduleModal = (novelId, episodeId) => {
  const existing = document.getElementById('modal-writer-schedule');
  if (existing) existing.remove();

  const isIndependent = writerState.permissions?.accessLevel === 'independent_publish' || writerState.permissions?.canPublishIndependently;
  const num = document.getElementById('we-number')?.value?.trim() || '1';
  const title = document.getElementById('we-title')?.value?.trim() || `Episode ${num}`;

  const now = new Date();
  const future = new Date(now.getTime() + 2 * 3600 * 1000);
  const yyyy = future.getFullYear();
  const mm = String(future.getMonth() + 1).padStart(2, '0');
  const dd = String(future.getDate()).padStart(2, '0');
  const defaultDate = `${yyyy}-${mm}-${dd}`;

  let defHour = future.getHours();
  const defAmpm = defHour >= 12 ? 'PM' : 'AM';
  defHour = defHour % 12 || 12;
  const defHourStr = String(defHour).padStart(2, '0');
  const defMin = String(Math.floor(future.getMinutes() / 5) * 5).padStart(2, '0');

  const todayDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const hoursOptions = [1,2,3,4,5,6,7,8,9,10,11,12].map(h => {
    const val = String(h).padStart(2, '0');
    return `<option value="${val}" ${val === defHourStr ? 'selected' : ''}>${val}</option>`;
  }).join('');

  const minsOptions = Array.from({ length: 60 }, (_, i) => {
    const val = String(i).padStart(2, '0');
    return `<option value="${val}" ${val === defMin ? 'selected' : ''}>${val}</option>`;
  }).join('');

  const modalHtml = `
    <div class="admin-modal-backdrop" id="modal-writer-schedule" style="position:fixed; inset:0; background:rgba(11,31,51,0.65); display:flex; align-items:center; justify-content:center; z-index:9999; padding:20px;">
      <div class="admin-modal-card" style="background:#FFF; width:100%; max-width:500px; border-radius:14px; box-shadow:0 16px 40px rgba(0,0,0,0.25); overflow:hidden;">
        <div style="background:#1E1B4B; color:#FFF; padding:18px 22px; display:flex; justify-content:space-between; align-items:center;">
          <h3 style="margin:0; font-size:16px; font-weight:700;">⏰ Schedule Episode Publication (IST)</h3>
          <button type="button" onclick="document.getElementById('modal-writer-schedule').remove()" style="background:transparent; border:none; color:#FFF; font-size:18px; cursor:pointer;">✕</button>
        </div>

        <form id="form-writer-sched" onsubmit="event.preventDefault(); submitWriterSchedule('${novelId}', ${episodeId ? `'${episodeId}'` : 'null'});" style="padding:22px;">
          <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px; padding:12px 14px; margin-bottom:16px;">
            <div style="font-size:11.5px; font-weight:700; color:#64748B; text-transform:uppercase;">Episode</div>
            <strong style="color:#1E1B4B; font-size:14.5px;">${escapeHtml(title)}</strong>
          </div>

          <div style="margin-bottom:16px;">
            <label class="writer-form-label" style="font-weight:700; font-size:13px; margin-bottom:6px; display:block;">Publication Date</label>
            <input type="date" id="wsched-date" class="writer-form-input" min="${todayDate}" value="${defaultDate}" required style="width:100%;" onchange="updateWriterSchedPreview()">
          </div>

          <div style="margin-bottom:16px;">
            <label class="writer-form-label" style="font-weight:700; font-size:13px; margin-bottom:6px; display:block;">Publication Time (12-Hour AM/PM)</label>
            <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:10px;">
              <div>
                <select id="wsched-hour" class="writer-form-input" style="width:100%; text-align:center; font-weight:600;" onchange="updateWriterSchedPreview()">
                  ${hoursOptions}
                </select>
                <div style="font-size:11px; color:#64748B; text-align:center; margin-top:3px;">Hour</div>
              </div>
              <div>
                <select id="wsched-minute" class="writer-form-input" style="width:100%; text-align:center; font-weight:600;" onchange="updateWriterSchedPreview()">
                  ${minsOptions}
                </select>
                <div style="font-size:11px; color:#64748B; text-align:center; margin-top:3px;">Minute (00-59)</div>
              </div>
              <div>
                <select id="wsched-ampm" class="writer-form-input" style="width:100%; text-align:center; font-weight:700;" onchange="updateWriterSchedPreview()">
                  <option value="AM" ${defAmpm === 'AM' ? 'selected' : ''}>AM</option>
                  <option value="PM" ${defAmpm === 'PM' ? 'selected' : ''}>PM</option>
                </select>
                <div style="font-size:11px; color:#64748B; text-align:center; margin-top:3px;">AM/PM</div>
              </div>
            </div>
          </div>

          <div id="wsched-preview-box" style="background:#EEF2FF; border:1px solid #C7D2FE; border-radius:8px; padding:12px 14px; margin-bottom:16px;">
            <div style="font-size:11.5px; font-weight:700; color:#4338CA; text-transform:uppercase;">Scheduled Release Time (IST)</div>
            <div id="wsched-preview-text" style="font-size:13.5px; font-weight:700; color:#1E1B4B; margin-top:2px;">Loading...</div>
          </div>

          <div style="margin-bottom:18px;">
            ${isIndependent ? `
              <div style="background:#ECFDF5; border:1px solid #A7F3D0; color:#065F46; padding:10px 12px; border-radius:8px; font-size:12.5px; line-height:1.4;">
                ✓ <strong>Independent Publishing Enabled:</strong> This episode will automatically be published live to readers at the scheduled time.
              </div>
            ` : `
              <div style="background:#FFFBEB; border:1px solid #FDE68A; color:#92400E; padding:10px 12px; border-radius:8px; font-size:12.5px; line-height:1.4;">
                📋 <strong>Editorial Review Required:</strong> This episode and requested release schedule will be submitted for Administrator review. Once approved, it will automatically publish at this time.
              </div>
            `}
          </div>

          <div style="display:flex; justify-content:flex-end; gap:10px;">
            <button type="button" class="btn btn-outline btn-sm" onclick="document.getElementById('modal-writer-schedule').remove()">Cancel</button>
            <button type="submit" class="btn btn-gold btn-sm" style="font-weight:700; padding:8px 18px;">Confirm &amp; Schedule</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  updateWriterSchedPreview();
};

window.updateWriterSchedPreview = () => {
  const dateVal = document.getElementById('wsched-date')?.value;
  const hourVal = document.getElementById('wsched-hour')?.value || '12';
  const rawMin = document.getElementById('wsched-minute')?.value ?? document.getElementById('wsched-minute-select')?.value ?? '00';
  const minVal = window.validateAndNormalizeMinute ? window.validateAndNormalizeMinute(rawMin) : String(rawMin).padStart(2, '0');
  const ampmVal = document.getElementById('wsched-ampm')?.value || 'PM';
  const previewText = document.getElementById('wsched-preview-text');
  const previewBox = document.getElementById('wsched-preview-box');
  if (!previewText) return;

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const [y, m, d] = (dateVal || '').split('-');
  const monthName = months[parseInt(m, 10) - 1] || m;
  const formatted = `${d} ${monthName} ${y}, ${hourVal}:${minVal} ${ampmVal} IST (Asia/Kolkata)`;

  let h = parseInt(hourVal, 10);
  if (ampmVal === 'PM' && h < 12) h += 12;
  if (ampmVal === 'AM' && h === 12) h = 0;
  const hh = String(h).padStart(2, '0');
  const schedStr = `${dateVal} ${hh}:${minVal}:00`;

  const now = new Date();
  const nowStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`;

  if (schedStr < nowStr) {
    previewBox.style.background = '#FEF2F2';
    previewBox.style.borderColor = '#FCA5A5';
    previewText.innerHTML = `<span style="color:#DC2626;">⚠️ Warning: Time is in the past! (${formatted})</span>`;
  } else {
    previewBox.style.background = '#EEF2FF';
    previewBox.style.borderColor = '#C7D2FE';
    previewText.innerHTML = `<span style="color:#1E1B4B;">🕒 ${formatted}</span>`;
  }
};

window.submitWriterSchedule = async (novelId, episodeId) => {
  const dateVal = document.getElementById('wsched-date')?.value;
  const hourVal = document.getElementById('wsched-hour')?.value || '12';
  const rawMin = document.getElementById('wsched-minute')?.value ?? document.getElementById('wsched-minute-select')?.value ?? '00';
  const minVal = window.validateAndNormalizeMinute ? window.validateAndNormalizeMinute(rawMin) : String(rawMin).padStart(2, '0');
  const ampmVal = document.getElementById('wsched-ampm')?.value || 'PM';

  if (!dateVal) {
    showToast('Please select a date.');
    return;
  }

  let h = parseInt(hourVal, 10);
  if (ampmVal === 'PM' && h < 12) h += 12;
  if (ampmVal === 'AM' && h === 12) h = 0;
  const hh = String(h).padStart(2, '0');
  const scheduledAt = `${dateVal} ${hh}:${minVal}:00`;

  document.getElementById('modal-writer-schedule')?.remove();
  await saveWriterEpisode(novelId, episodeId, 'scheduled', scheduledAt);
};

window.writerPublishNowAction = async (episodeId) => {
  if (!confirm('Publish this episode immediately to the website?')) return;
  try {
    const res = await apiFetch(`/api/writer/scheduler/${episodeId}/publish-now`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok || !data.success) {
      showToast(data.error || 'Failed to publish.');
      return;
    }
    showToast('Episode published immediately to the website!');
    switchWriterTab('schedule');
  } catch (err) {
    showToast('Error: ' + err.message);
  }
};

window.writerCancelScheduleAction = async (episodeId) => {
  if (!confirm('Cancel schedule and revert episode to draft?')) return;
  try {
    const res = await apiFetch(`/api/writer/scheduler/${episodeId}/cancel`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok || !data.success) {
      showToast(data.error || 'Failed to cancel schedule.');
      return;
    }
    showToast('Schedule cancelled; episode reverted to draft.');
    switchWriterTab('schedule');
  } catch (err) {
    showToast('Error: ' + err.message);
  }
};

window.openWriterRescheduleModal = (episodeId, title, currentSched) => {
  const existing = document.getElementById('modal-writer-reschedule');
  if (existing) existing.remove();

  let curY = '', curM = '', curD = '', curH = '08', curMin = '00', curAmpm = 'PM';
  if (currentSched) {
    const match = String(currentSched).match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
    if (match) {
      [, curY, curM, curD, curH, curMin] = match;
      let h = parseInt(curH, 10);
      curAmpm = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      curH = String(h).padStart(2, '0');
    }
  }

  const now = new Date();
  const todayDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const defaultDate = (curY && curM && curD) ? `${curY}-${curM}-${curD}` : todayDate;

  const hoursOptions = [1,2,3,4,5,6,7,8,9,10,11,12].map(h => {
    const val = String(h).padStart(2, '0');
    return `<option value="${val}" ${val === curH ? 'selected' : ''}>${val}</option>`;
  }).join('');

  const minsOptions = Array.from({ length: 60 }, (_, i) => {
    const val = String(i).padStart(2, '0');
    return `<option value="${val}" ${val === curMin ? 'selected' : ''}>${val}</option>`;
  }).join('');

  const modalHtml = `
    <div class="admin-modal-backdrop" id="modal-writer-reschedule" style="position:fixed; inset:0; background:rgba(11,31,51,0.65); display:flex; align-items:center; justify-content:center; z-index:9999; padding:20px;">
      <div class="admin-modal-card" style="background:#FFF; width:100%; max-width:480px; border-radius:14px; box-shadow:0 16px 40px rgba(0,0,0,0.25); overflow:hidden;">
        <div style="background:#1E1B4B; color:#FFF; padding:16px 20px; display:flex; justify-content:space-between; align-items:center;">
          <h3 style="margin:0; font-size:16px; font-weight:700;">✏️ Reschedule Release (IST)</h3>
          <button type="button" onclick="document.getElementById('modal-writer-reschedule').remove()" style="background:transparent; border:none; color:#FFF; font-size:18px; cursor:pointer;">✕</button>
        </div>

        <form id="form-writer-resched" onsubmit="event.preventDefault(); submitWriterReschedule(${episodeId});" style="padding:20px;">
          <div style="margin-bottom:14px;">
            <div style="font-size:12px; color:#64748B;">Episode:</div>
            <strong style="color:#1E1B4B; font-size:14.5px;">${escapeHtml(title)}</strong>
          </div>

          <div style="margin-bottom:16px;">
            <label class="writer-form-label" style="font-weight:700; font-size:13px; margin-bottom:6px; display:block;">New Release Date</label>
            <input type="date" id="wresched-date" class="writer-form-input" min="${todayDate}" value="${defaultDate}" required style="width:100%;" onchange="updateWriterReschedPreview()">
          </div>

          <div style="margin-bottom:16px;">
            <label class="writer-form-label" style="font-weight:700; font-size:13px; margin-bottom:6px; display:block;">New Release Time (12-Hour AM/PM)</label>
            <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:10px;">
              <div>
                <select id="wresched-hour" class="writer-form-input" style="width:100%; text-align:center; font-weight:600;" onchange="updateWriterReschedPreview()">
                  ${hoursOptions}
                </select>
                <div style="font-size:11px; color:#64748B; text-align:center; margin-top:3px;">Hour</div>
              </div>
              <div>
                <select id="wresched-minute" class="writer-form-input" style="width:100%; text-align:center; font-weight:600;" onchange="updateWriterReschedPreview()">
                  ${minsOptions}
                </select>
                <div style="font-size:11px; color:#64748B; text-align:center; margin-top:3px;">Minute (00-59)</div>
              </div>
              <div>
                <select id="wresched-ampm" class="writer-form-input" style="width:100%; text-align:center; font-weight:700;" onchange="updateWriterReschedPreview()">
                  <option value="AM" ${curAmpm === 'AM' ? 'selected' : ''}>AM</option>
                  <option value="PM" ${curAmpm === 'PM' ? 'selected' : ''}>PM</option>
                </select>
                <div style="font-size:11px; color:#64748B; text-align:center; margin-top:3px;">AM/PM</div>
              </div>
            </div>
          </div>

          <div id="wresched-preview-box" style="background:#EEF2FF; border:1px solid #C7D2FE; border-radius:8px; padding:10px 12px; margin-bottom:16px;">
            <div id="wresched-preview-text" style="font-size:13px; font-weight:700; color:#1E1B4B;">Loading...</div>
          </div>

          <div style="display:flex; justify-content:flex-end; gap:10px;">
            <button type="button" class="btn btn-outline btn-sm" onclick="document.getElementById('modal-writer-reschedule').remove()">Cancel</button>
            <button type="submit" class="btn btn-gold btn-sm" style="font-weight:700;">Save New Schedule</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  updateWriterReschedPreview();
};

window.updateWriterReschedPreview = () => {
  const dateVal = document.getElementById('wresched-date')?.value;
  const hourVal = document.getElementById('wresched-hour')?.value || '12';
  const rawMin = document.getElementById('wresched-minute')?.value ?? document.getElementById('wresched-minute-select')?.value ?? '00';
  const minVal = window.validateAndNormalizeMinute ? window.validateAndNormalizeMinute(rawMin) : String(rawMin).padStart(2, '0');
  const ampmVal = document.getElementById('wresched-ampm')?.value || 'PM';
  const previewText = document.getElementById('wresched-preview-text');
  const previewBox = document.getElementById('wresched-preview-box');
  if (!previewText) return;

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const [y, m, d] = (dateVal || '').split('-');
  const monthName = months[parseInt(m, 10) - 1] || m;
  const formatted = `${d} ${monthName} ${y}, ${hourVal}:${minVal} ${ampmVal} IST (Asia/Kolkata)`;

  let h = parseInt(hourVal, 10);
  if (ampmVal === 'PM' && h < 12) h += 12;
  if (ampmVal === 'AM' && h === 12) h = 0;
  const hh = String(h).padStart(2, '0');
  const schedStr = `${dateVal} ${hh}:${minVal}:00`;

  const now = new Date();
  const nowStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`;

  if (schedStr < nowStr) {
    previewBox.style.background = '#FEF2F2';
    previewBox.style.borderColor = '#FCA5A5';
    previewText.innerHTML = `<span style="color:#DC2626;">⚠️ Warning: Time is in the past! (${formatted})</span>`;
  } else {
    previewBox.style.background = '#EEF2FF';
    previewBox.style.borderColor = '#C7D2FE';
    previewText.innerHTML = `<span style="color:#1E1B4B;">🕒 ${formatted}</span>`;
  }
};

window.submitWriterReschedule = async (episodeId) => {
  const dateVal = document.getElementById('wresched-date')?.value;
  const hourVal = document.getElementById('wresched-hour')?.value || '12';
  const rawMin = document.getElementById('wresched-minute')?.value ?? document.getElementById('wresched-minute-select')?.value ?? '00';
  const minVal = window.validateAndNormalizeMinute ? window.validateAndNormalizeMinute(rawMin) : String(rawMin).padStart(2, '0');
  const ampmVal = document.getElementById('wresched-ampm')?.value || 'PM';

  if (!dateVal) {
    showToast('Please select a date.');
    return;
  }

  let h = parseInt(hourVal, 10);
  if (ampmVal === 'PM' && h < 12) h += 12;
  if (ampmVal === 'AM' && h === 12) h = 0;
  const hh = String(h).padStart(2, '0');
  const scheduledAt = `${dateVal} ${hh}:${minVal}:00`;

  try {
    const res = await apiFetch(`/api/writer/scheduler/${episodeId}/reschedule`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheduledAt, timezone: 'Asia/Kolkata' })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      showToast(data.error || 'Failed to reschedule.');
      return;
    }
    document.getElementById('modal-writer-reschedule')?.remove();
    showToast('Publication schedule updated successfully!');
    switchWriterTab('schedule');
  } catch (err) {
    showToast('Error: ' + err.message);
  }
};

/**
 * Render Notifications Tab for Writer
 */
async function renderWriterNotifications(canvas) {
  try {
    const res = await apiFetch('/api/notifications');
    const data = await res.json();
    const notifications = data.notifications || [];

    canvas.innerHTML = `
      <div class="writer-header-bar">
        <div>
          <h1 class="writer-header-title">Editorial Notifications</h1>
          <p class="writer-header-subtitle">Assignment notices, review decisions, change requests, and alerts.</p>
        </div>
      </div>

      <div class="writer-card" style="padding:0; overflow:hidden;">
        ${notifications.length > 0 ? `
          <div style="divide-y: 1px solid #F1ECE4;">
            ${notifications.map(n => `
              <div style="padding:16px 20px; border-bottom:1px solid #F1ECE4; display:flex; justify-content:space-between; align-items:flex-start;">
                <div>
                  <strong style="font-size:14px; color:#1A0B2E; display:block; margin-bottom:3px;">${escapeHtml(n.title)}</strong>
                  <p style="margin:0 0 4px 0; font-size:13px; color:#475569; line-height:1.5;">${escapeHtml(n.message)}</p>
                  <span style="font-size:11.5px; color:#94A3B8;">${new Date(n.created_at || n.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                ${n.link ? `
                  <a href="${n.link}" class="btn btn-outline btn-xs" style="white-space:nowrap; margin-left:12px;">View ➔</a>
                ` : ''}
              </div>
            `).join('')}
          </div>
        ` : `
          <div style="text-align:center; padding:48px 20px; color:#64748B;">
            <div style="font-size:36px; margin-bottom:8px;">🔔</div>
            <div style="font-size:15px; font-weight:600; color:#1A0B2E; margin-bottom:4px;">No Notifications Yet</div>
            <p style="font-size:13px; margin:0;">Editorial notices and approval alerts will appear here.</p>
          </div>
        `}
      </div>
    `;
  } catch (err) {
    canvas.innerHTML = '<div class="writer-card" style="color:#EF4444; padding:24px;">Failed to load notifications.</div>';
  }
}
