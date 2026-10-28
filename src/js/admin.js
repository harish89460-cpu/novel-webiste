// Rudhra Prarthana Novels — Admin & Author Dashboard Controller
// Secure Admin Login, Novel Management, Nested Episodes Hierarchy,
// Reader-Style Rich-Text Editor, Publishing Scheduler, Media Management, Settings & Logout

import { apiFetch } from './errors.js';
import { showToast } from './reader.js';
import { t } from './i18n.js';
import { updateHeaderUserArea } from './auth.js';
import { clearHomepageCache } from './content-service.js';

// Global Admin State
export const adminState = {
  activeTab: 'overview', // 'overview' | 'novels' | 'audio' | 'episodes' | 'editor' | 'scheduler' | 'writers' | 'media' | 'settings'
  novels: [],
  selectedNovelId: null,
  audioNovels: [],
  selectedAudioNovelId: null,
  shortStories: [],
  selectedShortStoryId: null,
  episodes: [],
  editingEpisode: null, // Episode currently loaded in the rich-text editor
  scheduledEpisodes: [],
  writers: [],
  selectedWriterId: null,
  writersFilter: { search: '', status: 'all' },
  mediaList: [],
  settings: {
    author_name: 'Rudhra Prarthana',
    default_timezone: 'Asia/Kolkata',
    site_title: 'Rudhra Prarthana Novels'
  },
  editorDirty: false,
  editorStep: 1,
  editorViewMode: 'write',
  autosaveTimer: null,
  previewMode: 'split' // 'split' | 'edit-only' | 'preview-only'
};
window.adminState = adminState;

// Clean, consistent modern SVG icons (Feather/Lucide style)
export const ADMIN_ICONS = {
  grid: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>`,
  book: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>`,
  headphones: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 18v-6a9 9 0 0 1 18 0v6"></path><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path></svg>`,
  feather: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"></path><line x1="16" y1="8" x2="2" y2="22"></line><line x1="17.5" y1="15" x2="9" y2="15"></line></svg>`,
  episodes: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>`,
  edit: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>`,
  clock: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`,
  image: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`,
  settings: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`,
  checkCircle: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`,
  externalLink: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>`,
  logout: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>`,
  backArrow: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>`,
  upload: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>`,
  trash: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`,
  writers: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`,
  userPlus: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>`,
  lock: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`,
  unlock: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg>`,
  search: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`,
  history: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 14 14"></polyline><path d="M3.05 11a9 9 0 0 1 .5-2m17.4 2a9 9 0 0 0-.5-2"></path></svg>`,
  layout: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>`,
  arrowUp: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>`,
  arrowDown: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>`,
  eye: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`,
  eyeOff: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`,
  grip: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="5" r="1.5"></circle><circle cx="9" cy="12" r="1.5"></circle><circle cx="9" cy="19" r="1.5"></circle><circle cx="15" cy="5" r="1.5"></circle><circle cx="15" cy="12" r="1.5"></circle><circle cx="15" cy="19" r="1.5"></circle></svg>`,
  refresh: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>`,
  plus: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`,
  chat: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`,
  users: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`,
  key: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 2l-2 2m-1.5 1.5L14 9l-1.5-1.5L10 10l2 2-6 6H2v-4l6-6 2.5 2.5L13.5 8 12 6.5 14.5 4z"></path><circle cx="7.5" cy="16.5" r="1.5"></circle></svg>`,
  shield: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`,
  userCheck: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><polyline points="17 11 19 13 23 9"></polyline></svg>`,
  userX: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="18" y1="8" x2="23" y2="13"></line><line x1="23" y1="8" x2="18" y2="13"></line></svg>`,
  sliders: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line></svg>`
};

/* ========================================================
   1. DEDICATED SECURE ADMIN LOGIN VIEW
   ======================================================== */
export async function renderAdminLoginView(container) {
  // If token exists, verify whether genuinely authorized on the backend
  const token = localStorage.getItem('rp_auth_token');
  if (token) {
    container.innerHTML = `
      <div class="admin-auth-guard-loading" style="min-height:70vh; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:16px; background:#F8FAFC;">
        <div style="width:40px; height:40px; border:3px solid #E2E8F0; border-top-color:#B88635; border-radius:50%; animation:adminSpinner 0.8s linear infinite;"></div>
        <div style="font-family:'Playfair Display',serif; font-size:16px; color:#0B1F33; font-weight:600;">
          Checking Existing Session...
        </div>
        <style>@keyframes adminSpinner { to { transform: rotate(360deg); } }</style>
      </div>
    `;
    const auth = await verifyAdminAuthentication();
    if (auth.authorized) {
      const isWriter = auth.user?.role === 'writer' || auth.user?.isWriter === true;
      let dest = sessionStorage.getItem('rp_admin_redirect');
      sessionStorage.removeItem('rp_admin_redirect');
      if (!dest) {
        dest = isWriter ? '#writer' : '#admin';
      } else if (isWriter && dest.startsWith('#admin')) {
        dest = '#writer';
      }
      window.location.hash = dest;
      return;
    }
  }

  // Admin & Writer Portal role state
  const currentHash = window.location.hash || '';
  const redirectTarget = sessionStorage.getItem('rp_admin_redirect') || '';
  const isInitialWriter = currentHash.includes('writer') || redirectTarget.includes('writer');

  window.ADMIN_FORGOT_STATE = {
    view: 'login', // 'login' | 'forgot-request' | 'forgot-otp' | 'forgot-password' | 'forgot-success'
    portalRole: isInitialWriter ? 'writer' : 'admin', // 'admin' | 'writer'
    email: '',
    resetToken: null,
    expirySeconds: 300,
    cooldownSeconds: 60,
    timerInterval: null,
    cooldownInterval: null
  };

  window.switchAdminLoginRole = (role) => {
    window.ADMIN_FORGOT_STATE.portalRole = role;
    renderCardContent();
  };

  function cleanupTimers() {
    if (window.ADMIN_FORGOT_STATE.timerInterval) {
      clearInterval(window.ADMIN_FORGOT_STATE.timerInterval);
      window.ADMIN_FORGOT_STATE.timerInterval = null;
    }
    if (window.ADMIN_FORGOT_STATE.cooldownInterval) {
      clearInterval(window.ADMIN_FORGOT_STATE.cooldownInterval);
      window.ADMIN_FORGOT_STATE.cooldownInterval = null;
    }
  }

  window.switchAdminLoginView = (view) => {
    window.ADMIN_FORGOT_STATE.view = view;
    renderCardContent();
  };

  function renderCardContent() {
    const cardBody = document.getElementById('admin-login-body-container');
    const titleEl = document.getElementById('admin-login-title-text');
    const subtitleEl = document.getElementById('admin-login-subtitle-text');
    if (!cardBody) return;

    const currentView = window.ADMIN_FORGOT_STATE.view;

    if (currentView === 'login') {
      cleanupTimers();
      const isWriter = window.ADMIN_FORGOT_STATE.portalRole === 'writer';
      if (titleEl) titleEl.textContent = 'Author, Admin & Writer Portal';
      if (subtitleEl) subtitleEl.textContent = isWriter ? 'Authorized Writer Workspace Access' : 'Rudhra Prarthana Publishing & Administration';

      const roleBadge = isWriter ? '✍️ Authorized Writer Workspace' : '👑 Author & Administrative Portal';
      const userLabel = isWriter ? 'Writer Username or Email' : 'Admin Username or Email';
      const userPlaceholder = isWriter ? 'Enter registered writer username or email' : 'Enter admin username or email';
      const submitText = isWriter ? '✍️ Authenticate & Access Writer Workspace' : '🔒 Authenticate & Access Admin Dashboard';

      cardBody.innerHTML = `
        <div id="admin-login-error" style="display:none; color:#EF4444; background:#FEF2F2; border:1px solid #FCA5A5; padding:10px 14px; border-radius:8px; font-size:13px; margin-bottom:16px; font-weight:600;"></div>
        <div id="admin-login-success" style="display:none; color:#15803D; background:#F0FDF4; border:1px solid #86EFAC; padding:10px 14px; border-radius:8px; font-size:13px; margin-bottom:16px; font-weight:600;"></div>

        <!-- Role Switcher Tabs (Author/Admin vs Writer) -->
        <div class="portal-role-tabs" style="display:flex; background:#FAF5EC; padding:4px; border-radius:10px; margin-bottom:18px; border:1px solid rgba(200,155,60,0.25);">
          <button type="button" 
                  onclick="switchAdminLoginRole('admin')"
                  class="portal-role-tab ${!isWriter ? 'active' : ''}"
                  style="flex:1; padding:8px 12px; font-size:13px; font-weight:700; border:none; border-radius:7px; cursor:pointer; transition:all 0.2s ease; display:flex; align-items:center; justify-content:center; gap:6px; ${!isWriter ? 'background:#FFFFFF; color:#0B1F33; box-shadow:0 2px 6px rgba(16,42,67,0.08); border:1px solid rgba(200,155,60,0.3);' : 'background:transparent; color:#64748B;'}">
            <span>👑</span>
            <span>Author & Admin</span>
          </button>
          <button type="button" 
                  onclick="switchAdminLoginRole('writer')"
                  class="portal-role-tab ${isWriter ? 'active' : ''}"
                  style="flex:1; padding:8px 12px; font-size:13px; font-weight:700; border:none; border-radius:7px; cursor:pointer; transition:all 0.2s ease; display:flex; align-items:center; justify-content:center; gap:6px; ${isWriter ? 'background:#FFFFFF; color:#0B1F33; box-shadow:0 2px 6px rgba(16,42,67,0.08); border:1px solid rgba(200,155,60,0.3);' : 'background:transparent; color:#64748B;'}">
            <span>✍️</span>
            <span>Writer Workspace</span>
          </button>
        </div>

        <form onsubmit="event.preventDefault(); submitAdminLoginForm();">
          <div class="form-group" style="margin-bottom:16px;">
            <label class="form-label" style="font-weight:700; color:var(--color-navy-deep); font-size:13px; margin-bottom:6px; display:block;">
              ${userLabel}
            </label>
            <input type="text" id="admin-username-input" class="form-input" 
                   value="${window.ADMIN_FORGOT_STATE.email || ''}"
                   placeholder="${userPlaceholder}" required autocomplete="off"
                   style="width:100%; padding:10px 14px; border:1px solid var(--color-border); border-radius:8px; font-size:14px;">
          </div>

          <div class="form-group" style="margin-bottom:20px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
              <label class="form-label" style="font-weight:700; color:var(--color-navy-deep); font-size:13px; margin:0; display:block;">
                Password
              </label>
              <a href="javascript:void(0)" id="admin-forgot-password-link" onclick="switchAdminLoginView('forgot-request')" 
                 style="color:var(--color-gold-warm); font-size:12px; font-weight:700; text-decoration:none; cursor:pointer;">
                Forgot Password?
              </a>
            </div>
            <div style="position:relative; display:flex; align-items:center;">
              <input type="password" id="admin-password-input" class="form-input" 
                     placeholder="••••••••" required autocomplete="current-password"
                     style="width:100%; padding:10px 44px 10px 14px; border:1px solid var(--color-border); border-radius:8px; font-size:14px;">
              <button type="button" class="password-toggle-btn" 
                      onclick="toggleAdminPasswordVis('admin-password-input')" 
                      title="Show/Hide Password" aria-label="Toggle password visibility" 
                      style="position:absolute; right:8px; background:none; border:none; cursor:pointer; font-size:18px; color:var(--color-text-muted); padding:4px 8px;">
                👁️
              </button>
            </div>
          </div>

          <button type="submit" id="admin-login-submit-btn" class="btn btn-gold" 
                  style="width:100%; padding:12px; font-size:14.5px; font-weight:700; letter-spacing:0.3px; border-radius:8px;">
            ${submitText}
          </button>
        </form>

        <div style="text-align:center; margin-top:20px; font-size:12px; color:var(--color-text-muted);">
          <span>Authorized access only. Session activity is cryptographically logged.</span>
          <div style="margin-top:10px;">
            <a href="#forms" style="color:var(--color-gold-warm); text-decoration:none; font-weight:600;">« Return to Public Website</a>
          </div>
        </div>
      `;
    } else if (currentView === 'forgot-request') {
      if (titleEl) titleEl.textContent = 'Reset Author Password';
      if (subtitleEl) subtitleEl.textContent = 'Enter your registered Author email';

      cardBody.innerHTML = `
        <div id="admin-login-error" style="display:none; color:#EF4444; background:#FEF2F2; border:1px solid #FCA5A5; padding:10px 14px; border-radius:8px; font-size:13px; margin-bottom:16px; font-weight:600;"></div>

        <p style="font-size:13px; color:var(--color-text-muted); line-height:1.6; margin-bottom:16px;">
          Enter your registered Author email address. We will send a secure 6-digit OTP code to verify your identity.
        </p>

        <form onsubmit="event.preventDefault(); handleAdminForgotRequestOtp();">
          <div class="form-group" style="margin-bottom:20px;">
            <label class="form-label" style="font-weight:700; color:var(--color-navy-deep); font-size:13px; margin-bottom:6px; display:block;">
              Registered Admin Email
            </label>
            <input type="email" id="admin-forgot-email-input" class="form-input" 
                   value="${window.ADMIN_FORGOT_STATE.email || ''}"
                   placeholder="Enter registered email"
                   required autocomplete="email"
                   style="width:100%; padding:10px 14px; border:1px solid var(--color-border); border-radius:8px; font-size:14px;">
          </div>

          <button type="submit" id="admin-forgot-send-btn" class="btn btn-gold" 
                  style="width:100%; padding:12px; font-size:15px; font-weight:700; letter-spacing:0.5px; border-radius:8px; margin-bottom:12px;">
            📩 Send Verification Code (OTP)
          </button>
        </form>

        <div style="text-align:center; margin-top:16px;">
          <a href="javascript:void(0)" onclick="switchAdminLoginView('login')" 
             style="color:var(--color-navy-deep); font-size:13px; font-weight:600; text-decoration:none;">
            « Back to Author Login
          </a>
        </div>
      `;
    } else if (currentView === 'forgot-otp') {
      if (titleEl) titleEl.textContent = 'Verify Email OTP';
      if (subtitleEl) subtitleEl.textContent = '6-digit verification code';

      cardBody.innerHTML = `
        <div id="admin-login-error" style="display:none; color:#EF4444; background:#FEF2F2; border:1px solid #FCA5A5; padding:10px 14px; border-radius:8px; font-size:13px; margin-bottom:16px; font-weight:600;"></div>
        <div id="admin-login-info" style="color:#0B1F33; background:#EFF6FF; border:1px solid #BFDBFE; padding:10px 14px; border-radius:8px; font-size:13px; margin-bottom:16px; line-height:1.5;">
          A 6-digit code was sent to <strong>${window.ADMIN_FORGOT_STATE.email}</strong>.
        </div>

        <form onsubmit="event.preventDefault(); handleAdminForgotVerifyOtp();">
          <div class="form-group" style="margin-bottom:16px;">
            <label class="form-label" style="font-weight:700; color:var(--color-navy-deep); font-size:13px; margin-bottom:8px; display:block; text-align:center;">
              Enter 6-Digit Code
            </label>
            <div id="admin-otp-inputs" style="display:flex; justify-content:center; gap:8px;">
              <input type="text" maxlength="1" class="admin-otp-digit" data-idx="0" inputmode="numeric" pattern="[0-9]*" style="width:44px; height:50px; font-size:22px; text-align:center; font-weight:700; border:2px solid var(--color-border); border-radius:8px; color:var(--color-navy-deep);" autofocus>
              <input type="text" maxlength="1" class="admin-otp-digit" data-idx="1" inputmode="numeric" pattern="[0-9]*" style="width:44px; height:50px; font-size:22px; text-align:center; font-weight:700; border:2px solid var(--color-border); border-radius:8px; color:var(--color-navy-deep);">
              <input type="text" maxlength="1" class="admin-otp-digit" data-idx="2" inputmode="numeric" pattern="[0-9]*" style="width:44px; height:50px; font-size:22px; text-align:center; font-weight:700; border:2px solid var(--color-border); border-radius:8px; color:var(--color-navy-deep);">
              <input type="text" maxlength="1" class="admin-otp-digit" data-idx="3" inputmode="numeric" pattern="[0-9]*" style="width:44px; height:50px; font-size:22px; text-align:center; font-weight:700; border:2px solid var(--color-border); border-radius:8px; color:var(--color-navy-deep);">
              <input type="text" maxlength="1" class="admin-otp-digit" data-idx="4" inputmode="numeric" pattern="[0-9]*" style="width:44px; height:50px; font-size:22px; text-align:center; font-weight:700; border:2px solid var(--color-border); border-radius:8px; color:var(--color-navy-deep);">
              <input type="text" maxlength="1" class="admin-otp-digit" data-idx="5" inputmode="numeric" pattern="[0-9]*" style="width:44px; height:50px; font-size:22px; text-align:center; font-weight:700; border:2px solid var(--color-border); border-radius:8px; color:var(--color-navy-deep);">
            </div>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; font-size:12px; color:var(--color-text-muted);">
            <span id="admin-otp-timer-display" style="font-weight:600; color:#DC2626;">⏱️ Expires in: 05:00</span>
            <button type="button" id="admin-otp-resend-btn" onclick="handleAdminForgotResendOtp()" 
                    style="background:none; border:none; color:var(--color-gold-warm); font-weight:700; cursor:pointer; font-size:12px; padding:0;" disabled>
              Resend Code (60s)
            </button>
          </div>

          <button type="submit" id="admin-verify-otp-btn" class="btn btn-gold" 
                  style="width:100%; padding:12px; font-size:15px; font-weight:700; letter-spacing:0.5px; border-radius:8px;">
            ✓ Verify Code & Proceed
          </button>
        </form>

        <div style="text-align:center; margin-top:16px;">
          <a href="javascript:void(0)" onclick="switchAdminLoginView('forgot-request')" 
             style="color:var(--color-text-muted); font-size:12px; text-decoration:none;">
            « Change Email Address
          </a>
        </div>
      `;

      bindOtpInputEvents();
      startAdminOtpTimers();
    } else if (currentView === 'forgot-password') {
      cleanupTimers();
      if (titleEl) titleEl.textContent = 'Create New Password';
      if (subtitleEl) subtitleEl.textContent = 'Author & Admin Account';

      cardBody.innerHTML = `
        <div id="admin-login-error" style="display:none; color:#EF4444; background:#FEF2F2; border:1px solid #FCA5A5; padding:10px 14px; border-radius:8px; font-size:13px; margin-bottom:16px; font-weight:600;"></div>

        <p style="font-size:13px; color:var(--color-text-muted); line-height:1.6; margin-bottom:16px;">
          Enter your new password below. It will be cryptographically hashed and saved in MySQL.
        </p>

        <form onsubmit="event.preventDefault(); handleAdminForgotResetPassword();">
          <div class="form-group" style="margin-bottom:16px;">
            <label class="form-label" style="font-weight:700; color:var(--color-navy-deep); font-size:13px; margin-bottom:6px; display:block;">
              New Password <span style="color:#EF4444;">*</span>
            </label>
            <div style="position:relative; display:flex; align-items:center;">
              <input type="password" id="admin-new-password" class="form-input" 
                     placeholder="Minimum 6 characters" required minlength="6" autocomplete="new-password"
                     style="width:100%; padding:10px 44px 10px 14px; border:1px solid var(--color-border); border-radius:8px; font-size:14px;">
              <button type="button" class="password-toggle-btn" 
                      onclick="toggleAdminPasswordVis('admin-new-password')" 
                      title="Show/Hide Password" aria-label="Toggle password visibility" 
                      style="position:absolute; right:8px; background:none; border:none; cursor:pointer; font-size:18px; color:var(--color-text-muted); padding:4px 8px;">
                👁️
              </button>
            </div>
            <small style="font-size:11px; color:var(--color-text-muted); margin-top:4px; display:block;">
              Password must be at least 6 characters long.
            </small>
          </div>

          <div class="form-group" style="margin-bottom:20px;">
            <label class="form-label" style="font-weight:700; color:var(--color-navy-deep); font-size:13px; margin-bottom:6px; display:block;">
              Confirm New Password <span style="color:#EF4444;">*</span>
            </label>
            <div style="position:relative; display:flex; align-items:center;">
              <input type="password" id="admin-confirm-password" class="form-input" 
                     placeholder="Re-enter new password" required minlength="6" autocomplete="new-password"
                     style="width:100%; padding:10px 44px 10px 14px; border:1px solid var(--color-border); border-radius:8px; font-size:14px;">
              <button type="button" class="password-toggle-btn" 
                      onclick="toggleAdminPasswordVis('admin-confirm-password')" 
                      title="Show/Hide Password" aria-label="Toggle password visibility" 
                      style="position:absolute; right:8px; background:none; border:none; cursor:pointer; font-size:18px; color:var(--color-text-muted); padding:4px 8px;">
                👁️
              </button>
            </div>
          </div>

          <button type="submit" id="admin-reset-submit-btn" class="btn btn-gold" 
                  style="width:100%; padding:12px; font-size:15px; font-weight:700; letter-spacing:0.5px; border-radius:8px;">
            🔒 Save New Password & Update Account
          </button>
        </form>

        <div style="text-align:center; margin-top:16px;">
          <a href="javascript:void(0)" onclick="switchAdminLoginView('login')" 
             style="color:var(--color-navy-deep); font-size:13px; font-weight:600; text-decoration:none;">
            « Cancel & Back to Login
          </a>
        </div>
      `;
    } else if (currentView === 'forgot-success') {
      cleanupTimers();
      if (titleEl) titleEl.textContent = 'Password Reset Complete';
      if (subtitleEl) subtitleEl.textContent = 'Credentials Updated Successfully';

      cardBody.innerHTML = `
        <div style="text-align:center; padding:10px 0;">
          <div style="font-size:48px; margin-bottom:12px;">🎉</div>
          <h3 style="color:var(--color-navy-deep); font-size:1.25rem; font-weight:700; margin-bottom:8px;">
            Password Updated in MySQL!
          </h3>
          <p style="color:var(--color-text-muted); font-size:14px; line-height:1.6; margin-bottom:24px;">
            Your author credentials have been securely updated with salted cryptographic hashing. You can now log in to the Author & Admin Portal with your new password.
          </p>

          <button type="button" class="btn btn-gold" style="width:100%; padding:12px; font-weight:700; border-radius:8px;"
                  onclick="switchAdminLoginView('login'); const el = document.getElementById('admin-username-input'); if(el) el.value = '${window.ADMIN_FORGOT_STATE.email}';">
            Proceed to Author Login ➔
          </button>
        </div>
      `;
    }
  }

  function bindOtpInputEvents() {
    const inputs = document.querySelectorAll('#admin-otp-inputs .admin-otp-digit');
    inputs.forEach((input, idx) => {
      input.addEventListener('input', (e) => {
        const val = e.target.value.replace(/[^0-9]/g, '');
        e.target.value = val ? val[0] : '';
        if (val && idx < inputs.length - 1) {
          inputs[idx + 1].focus();
        }
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !input.value && idx > 0) {
          inputs[idx - 1].focus();
        }
      });
      input.addEventListener('paste', (e) => {
        e.preventDefault();
        const text = (e.clipboardData || window.clipboardData).getData('text').replace(/[^0-9]/g, '').slice(0, 6);
        for (let i = 0; i < text.length && i < inputs.length; i++) {
          inputs[i].value = text[i];
        }
        if (inputs[Math.min(text.length, inputs.length - 1)]) {
          inputs[Math.min(text.length, inputs.length - 1)].focus();
        }
      });
    });
  }

  function startAdminOtpTimers() {
    cleanupTimers();

    const timerDisplay = document.getElementById('admin-otp-timer-display');
    const resendBtn = document.getElementById('admin-otp-resend-btn');
    const verifyBtn = document.getElementById('admin-verify-otp-btn');

    // 5-minute countdown
    window.ADMIN_FORGOT_STATE.timerInterval = setInterval(() => {
      window.ADMIN_FORGOT_STATE.expirySeconds--;
      const sec = window.ADMIN_FORGOT_STATE.expirySeconds;
      if (sec <= 0) {
        clearInterval(window.ADMIN_FORGOT_STATE.timerInterval);
        if (timerDisplay) {
          timerDisplay.textContent = '❌ Code Expired';
          timerDisplay.style.color = '#EF4444';
        }
        if (verifyBtn) verifyBtn.disabled = true;
      } else {
        const mins = Math.floor(sec / 60);
        const remSec = sec % 60;
        if (timerDisplay) {
          timerDisplay.textContent = `⏱️ Expires in: ${String(mins).padStart(2, '0')}:${String(remSec).padStart(2, '0')}`;
        }
      }
    }, 1000);

    // 60-second resend cooldown
    window.ADMIN_FORGOT_STATE.cooldownInterval = setInterval(() => {
      window.ADMIN_FORGOT_STATE.cooldownSeconds--;
      const c = window.ADMIN_FORGOT_STATE.cooldownSeconds;
      if (c <= 0) {
        clearInterval(window.ADMIN_FORGOT_STATE.cooldownInterval);
        if (resendBtn) {
          resendBtn.disabled = false;
          resendBtn.textContent = '🔄 Resend Code';
          resendBtn.style.cursor = 'pointer';
        }
      } else {
        if (resendBtn) {
          resendBtn.disabled = true;
          resendBtn.textContent = `Resend Code (${c}s)`;
          resendBtn.style.cursor = 'not-allowed';
        }
      }
    }, 1000);
  }

  window.toggleAdminPasswordVis = (inputId) => {
    const input = document.getElementById(inputId);
    if (input) {
      input.type = input.type === 'password' ? 'text' : 'password';
    }
  };

  window.handleAdminForgotRequestOtp = async () => {
    const emailInput = document.getElementById('admin-forgot-email-input');
    const errorEl = document.getElementById('admin-login-error');
    const sendBtn = document.getElementById('admin-forgot-send-btn');
    if (errorEl) errorEl.style.display = 'none';

    const email = emailInput?.value?.trim().toLowerCase();
    if (!email) {
      if (errorEl) {
        errorEl.textContent = 'Please enter your registered email address.';
        errorEl.style.display = 'block';
      }
      return;
    }

    if (sendBtn) {
      sendBtn.disabled = true;
      sendBtn.textContent = 'Sending OTP...';
    }

    try {
      const res = await apiFetch('/api/auth/forgot-password/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        const errMsg = data.error || 'Failed to send OTP code.';
        if (errorEl) {
          errorEl.textContent = errMsg;
          errorEl.style.display = 'block';
        }
        showToast(errMsg);
        return;
      }

      window.ADMIN_FORGOT_STATE.email = email;
      window.ADMIN_FORGOT_STATE.expirySeconds = data.expiresInSeconds || 300;
      window.ADMIN_FORGOT_STATE.cooldownSeconds = data.cooldownSeconds || 60;

      showToast('Verification code sent to registered email! 📩');
      switchAdminLoginView('forgot-otp');
    } catch (err) {
      console.error('Admin request OTP error:', err);
      const errMsg = err.message || 'Network error requesting OTP. Please check backend connection.';
      if (errorEl) {
        errorEl.textContent = errMsg;
        errorEl.style.display = 'block';
      }
      showToast(errMsg);
    } finally {
      if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.textContent = '📩 Send Verification Code (OTP)';
      }
    }
  };

  window.handleAdminForgotVerifyOtp = async () => {
    const inputs = document.querySelectorAll('#admin-otp-inputs .admin-otp-digit');
    const errorEl = document.getElementById('admin-login-error');
    const verifyBtn = document.getElementById('admin-verify-otp-btn');
    if (errorEl) errorEl.style.display = 'none';

    let otp = '';
    inputs.forEach(input => {
      otp += input.value.trim();
    });

    if (otp.length !== 6) {
      const errMsg = 'Please enter the complete 6-digit verification code.';
      if (errorEl) {
        errorEl.textContent = errMsg;
        errorEl.style.display = 'block';
      }
      showToast(errMsg);
      return;
    }

    if (verifyBtn) {
      verifyBtn.disabled = true;
      verifyBtn.textContent = 'Verifying Code...';
    }

    try {
      const res = await apiFetch('/api/auth/forgot-password/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: window.ADMIN_FORGOT_STATE.email, otp })
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        const errMsg = data.error || 'Invalid verification code.';
        if (errorEl) {
          errorEl.textContent = errMsg;
          errorEl.style.display = 'block';
        }
        showToast(errMsg);
        inputs.forEach(input => { input.value = ''; });
        if (inputs[0]) inputs[0].focus();
        return;
      }

      window.ADMIN_FORGOT_STATE.resetToken = data.resetToken;
      cleanupTimers();

      showToast('OTP verified successfully! ✨');
      switchAdminLoginView('forgot-password');
    } catch (err) {
      console.error('Admin verify OTP error:', err);
      const errMsg = err.message || 'Error verifying OTP code.';
      if (errorEl) {
        errorEl.textContent = errMsg;
        errorEl.style.display = 'block';
      }
      showToast(errMsg);
    } finally {
      if (verifyBtn) {
        verifyBtn.disabled = false;
        verifyBtn.textContent = '✓ Verify Code & Proceed';
      }
    }
  };

  window.handleAdminForgotResendOtp = async () => {
    const resendBtn = document.getElementById('admin-otp-resend-btn');
    const errorEl = document.getElementById('admin-login-error');
    if (errorEl) errorEl.style.display = 'none';

    if (window.ADMIN_FORGOT_STATE.cooldownSeconds > 0) return;

    if (resendBtn) {
      resendBtn.disabled = true;
      resendBtn.textContent = 'Resending...';
    }

    try {
      const res = await apiFetch('/api/auth/forgot-password/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: window.ADMIN_FORGOT_STATE.email })
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        const errMsg = data.error || 'Failed to resend OTP code.';
        if (errorEl) {
          errorEl.textContent = errMsg;
          errorEl.style.display = 'block';
        }
        showToast(errMsg);
        return;
      }

      window.ADMIN_FORGOT_STATE.expirySeconds = data.expiresInSeconds || 300;
      window.ADMIN_FORGOT_STATE.cooldownSeconds = data.cooldownSeconds || 60;

      const verifyBtn = document.getElementById('admin-verify-otp-btn');
      if (verifyBtn) verifyBtn.disabled = false;
      const inputs = document.querySelectorAll('#admin-otp-inputs .admin-otp-digit');
      inputs.forEach(input => { input.value = ''; });
      if (inputs[0]) inputs[0].focus();

      startAdminOtpTimers();
      showToast('New verification code sent to your email! 📩');
    } catch (err) {
      console.error('Admin resend OTP error:', err);
      showToast('Error resending OTP code.');
    } finally {
      if (resendBtn && window.ADMIN_FORGOT_STATE.cooldownSeconds <= 0) {
        resendBtn.disabled = false;
        resendBtn.textContent = '🔄 Resend Code';
      }
    }
  };

  window.handleAdminForgotResetPassword = async () => {
    const newPassInput = document.getElementById('admin-new-password');
    const confirmPassInput = document.getElementById('admin-confirm-password');
    const errorEl = document.getElementById('admin-login-error');
    const submitBtn = document.getElementById('admin-reset-submit-btn');
    if (errorEl) errorEl.style.display = 'none';

    const newPassword = newPassInput?.value;
    const confirmPassword = confirmPassInput?.value;

    if (!newPassword || newPassword.length < 6) {
      const errMsg = 'Password must be at least 6 characters long.';
      if (errorEl) {
        errorEl.textContent = errMsg;
        errorEl.style.display = 'block';
      }
      showToast(errMsg);
      return;
    }

    if (newPassword !== confirmPassword) {
      const errMsg = 'Passwords do not match!';
      if (errorEl) {
        errorEl.textContent = errMsg;
        errorEl.style.display = 'block';
      }
      showToast(errMsg);
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Updating Password in MySQL...';
    }

    try {
      const res = await apiFetch('/api/auth/forgot-password/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: window.ADMIN_FORGOT_STATE.email,
          resetToken: window.ADMIN_FORGOT_STATE.resetToken,
          newPassword,
          confirmPassword
        })
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        const errMsg = data.error || 'Failed to update password.';
        if (errorEl) {
          errorEl.textContent = errMsg;
          errorEl.style.display = 'block';
        }
        showToast(errMsg);
        return;
      }

      showToast('Admin password updated successfully! 🎉');
      switchAdminLoginView('forgot-success');
    } catch (err) {
      console.error('Admin reset password error:', err);
      const errMsg = err.message || 'Error updating password.';
      if (errorEl) {
        errorEl.textContent = errMsg;
        errorEl.style.display = 'block';
      }
      showToast(errMsg);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = '🔒 Save New Password & Update Account';
      }
    }
  };

  window.submitAdminLoginForm = async () => {
    const username = document.getElementById('admin-username-input')?.value?.trim();
    const password = document.getElementById('admin-password-input')?.value;
    const errorEl = document.getElementById('admin-login-error');
    const submitBtn = document.getElementById('admin-login-submit-btn');

    if (!username || !password) {
      if (errorEl) {
        errorEl.textContent = 'Please enter both username/email and password.';
        errorEl.style.display = 'block';
      }
      return;
    }

    if (errorEl) errorEl.style.display = 'none';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Authenticating...';
    }

    try {
      const res = await apiFetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        if (errorEl) {
          errorEl.textContent = data.error || 'Authentication failed: Invalid credentials or insufficient privileges.';
          errorEl.style.display = 'block';
        }
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = '🔒 Authenticate & Access Dashboard';
        }
        return;
      }

      // Successful Authentication (Admin or Writer)
      localStorage.setItem('rp_auth_token', data.token);
      window.IS_LOGGED_IN = true;
      window.CURRENT_USER = data.user;
      updateHeaderUserArea();

      const isWriter = data.user.role === 'writer' || data.user.isWriter === true;
      let dest = sessionStorage.getItem('rp_admin_redirect');
      sessionStorage.removeItem('rp_admin_redirect');

      if (!dest) {
        dest = isWriter ? '#writer' : '#admin';
      } else if (isWriter && dest.startsWith('#admin')) {
        dest = '#writer';
      }

      showToast(`Welcome, ${data.user.displayName || data.user.username}! ${isWriter ? 'Writer Workspace unlocked.' : 'Admin Dashboard unlocked.'}`);
      window.location.hash = dest;
      if (window.renderAppView) window.renderAppView();
    } catch (err) {
      console.error('Admin login error:', err);
      if (errorEl) {
        errorEl.textContent = err.message || 'Unable to reach backend server. Please check your connection.';
        errorEl.style.display = 'block';
      }
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = '🔒 Authenticate & Access Dashboard';
      }
    }
  };

  // Initial Shell Render
  container.innerHTML = `
    <div class="admin-login-wrapper">
      <div class="admin-login-card">
        <div class="admin-login-header">
          <div class="admin-login-seal">
            <img src="/images/logo.png" alt="Rudhra Prarthana Novels Seal" onerror="this.src='/profile.png'">
          </div>
          <h1 class="admin-login-title" id="admin-login-title-text">Author, Admin &amp; Writer Portal</h1>
          <p class="admin-login-subtitle" id="admin-login-subtitle-text">Rudhra Prarthana Novels</p>
        </div>

        <div class="admin-login-body" id="admin-login-body-container">
          <!-- Dynamically switched between login, forgot-request, forgot-otp, forgot-password, forgot-success -->
        </div>
      </div>
    </div>
  `;

  renderCardContent();
}

/**
 * Centralized Server-Side Admin Authentication Guard
 * Queries /api/admin/auth/check directly with token to verify active author session.
 */
export async function verifyAdminAuthentication() {
  const token = localStorage.getItem('rp_auth_token');
  if (!token) {
    window.IS_LOGGED_IN = false;
    window.CURRENT_USER = null;
    return { authenticated: false, authorized: false, reason: 'unauthenticated' };
  }

  try {
    const res = await apiFetch('/api/admin/auth/check');
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      localStorage.removeItem('rp_auth_token');
      window.IS_LOGGED_IN = false;
      window.CURRENT_USER = null;
      updateHeaderUserArea();
      return {
        authenticated: false,
        authorized: false,
        status: res.status,
        reason: res.status === 403 ? 'forbidden' : 'unauthorized',
        error: data.error || (res.status === 403 ? 'Access denied: Author privileges required' : 'Authentication required')
      };
    }

    const data = await res.json();
    if (data.success && data.authorized && data.user) {
      window.IS_LOGGED_IN = true;
      window.CURRENT_USER = data.user;
      return { authenticated: true, authorized: true, user: data.user };
    } else {
      localStorage.removeItem('rp_auth_token');
      window.IS_LOGGED_IN = false;
      window.CURRENT_USER = null;
      updateHeaderUserArea();
      return { authenticated: false, authorized: false, reason: 'invalid_data' };
    }
  } catch (err) {
    console.warn('[Admin Auth Guard] Session verification failed:', err);
    localStorage.removeItem('rp_auth_token');
    window.IS_LOGGED_IN = false;
    window.CURRENT_USER = null;
    updateHeaderUserArea();
    return { authenticated: false, authorized: false, reason: 'network_or_expired' };
  }
}

/* ========================================================
   2. MAIN ADMIN DASHBOARD CONTROLLER
   ======================================================== */
export async function renderAdminDashboard(container, requestedTab) {
  // 1. Immediately render neutral loading state to prevent brief flash of dashboard
  container.innerHTML = `
    <div class="admin-auth-guard-loading" style="min-height:75vh; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:16px; background:#F8FAFC;">
      <div style="width:40px; height:40px; border:3px solid #E2E8F0; border-top-color:#B88635; border-radius:50%; animation:adminSpinner 0.8s linear infinite;"></div>
      <div style="font-family:'Playfair Display',serif; font-size:16px; color:#0B1F33; font-weight:600;">
        Verifying Author Authentication...
      </div>
      <div style="font-size:12.5px; color:#64748B;">
        Securing administrative workspace
      </div>
      <style>@keyframes adminSpinner { to { transform: rotate(360deg); } }</style>
    </div>
  `;

  // 2. Query backend to verify genuine authenticated author session
  const authResult = await verifyAdminAuthentication();

  // 3. Block access and redirect if unauthenticated or unauthorized
  if (!authResult.authorized) {
    const intendedRoute = window.location.hash || (requestedTab ? `#admin?tab=${requestedTab}` : '#admin');
    if (!intendedRoute.includes('admin-login')) {
      sessionStorage.setItem('rp_admin_redirect', intendedRoute);
    }

    container.innerHTML = '';

    if (authResult.status === 403 || authResult.reason === 'forbidden') {
      container.innerHTML = `
        <div style="max-width:550px; margin:80px auto; text-align:center; padding:40px 24px; background:#fff; border-radius:16px; border:1px solid #E2E8F0; box-shadow:0 10px 25px rgba(0,0,0,0.06);">
          <div style="font-size:48px; margin-bottom:16px;">🔒</div>
          <h2 style="font-family:'Playfair Display',serif; color:#0B1F33; margin-bottom:12px;">Access Denied</h2>
          <p style="color:#64748B; font-size:15px; line-height:1.6; margin-bottom:24px;">
            This area is restricted exclusively to the authorized author. Normal reader accounts cannot access publishing controls or author tools.
          </p>
          <div style="display:flex; justify-content:center; gap:12px;">
            <a href="#forms" class="btn btn-outline">« Back to Reader Home</a>
            <a href="#admin-login" class="btn btn-gold">Author Portal Login »</a>
          </div>
        </div>
      `;
      showToast('Access denied: Author privileges required.');
    } else {
      showToast('Author authentication required. Redirecting to Author Portal...');
      window.location.hash = '#admin-login';
    }
    return;
  }

  if (requestedTab) {
    adminState.activeTab = requestedTab === 'homepage' ? 'overview' : requestedTab;
  }

  const TAB_TITLES = {
    overview: 'Dashboard',
    novels: 'Novels',
    'novel-create': 'Create New Novel',
    audio: 'Audio Novels',
    'short-stories': 'Short Stories',
    episodes: 'Episodes',
    editor: 'Editor',
    scheduler: 'Schedule',
    writers: 'Writer Management',
    members: 'Member Account Management',
    forum: 'Forms & Content Management',
    settings: 'Settings'
  };

  // Render Clean Modern Dashboard Shell Structure
  container.innerHTML = `
    <div class="admin-dashboard-container">
      <!-- Admin Mobile Bar (Visible only on mobile/tablet <= 992px) -->
      <header class="admin-top-bar" role="banner">
        <button type="button" id="admin-mobile-toggle" class="admin-mobile-toggle-btn" 
                aria-label="Toggle Navigation Menu" aria-expanded="false" 
                onclick="toggleAdminMobileNav()">
          <span class="hamburger-icon" aria-hidden="true">
            <span></span><span></span><span></span>
          </span>
          <span class="admin-mobile-toggle-label">Menu</span>
        </button>
        
        <span id="admin-top-bar-current-tab" class="admin-top-current-tab">
          ${TAB_TITLES[adminState.activeTab] || 'Dashboard'}
        </span>

        <a href="#forms" class="admin-mobile-site-btn" title="View Reader Site">
          ${ADMIN_ICONS.externalLink}
        </a>
      </header>

      <!-- Backdrop overlay for slide-out mobile drawer -->
      <div id="admin-sidebar-backdrop" class="admin-sidebar-backdrop" onclick="toggleAdminMobileNav(false)" aria-hidden="true"></div>

      <div class="admin-shell">
        <!-- Sidebar Navigation (Consistent 240px Desktop, Slide-out Drawer on Mobile) -->
        <aside class="admin-sidebar" id="admin-sidebar-nav" aria-label="Dashboard Navigation">
          <!-- Drawer Header (visible on mobile drawer only) -->
          <div class="admin-drawer-header">
            <span class="admin-drawer-title">Navigation</span>
            <button type="button" class="admin-drawer-close-btn" aria-label="Close navigation menu" onclick="toggleAdminMobileNav(false)">
              ✕
            </button>
          </div>

          <!-- Compact Brand Header -->
          <div class="admin-sidebar-brand">
            <img src="/images/logo.png" class="admin-sidebar-logo" alt="RP" onerror="this.src='/profile.png'">
            <div class="admin-sidebar-brand-text">
              <div class="admin-brand-name">Rudhra Prarthana</div>
              <div class="admin-brand-sub">Author Workspace</div>
            </div>
          </div>

          <nav class="admin-nav-list" aria-label="Admin Sections">
            <button type="button" class="admin-nav-item ${adminState.activeTab === 'overview' ? 'active' : ''}" 
                    onclick="switchAdminTab('overview')">
              <span class="admin-nav-item-content">
                ${ADMIN_ICONS.grid}
                <span>Overview</span>
              </span>
            </button>

            <button type="button" class="admin-nav-item ${adminState.activeTab === 'novels' ? 'active' : ''}" 
                    onclick="switchAdminTab('novels')">
              <span class="admin-nav-item-content">
                ${ADMIN_ICONS.book}
                <span>Novels</span>
              </span>
              <span class="admin-nav-pill" id="nav-novels-count">-</span>
            </button>

            <button type="button" class="admin-nav-item ${adminState.activeTab === 'audio' ? 'active' : ''}" 
                    onclick="switchAdminTab('audio')">
              <span class="admin-nav-item-content">
                ${ADMIN_ICONS.headphones}
                <span>Audio Novels</span>
              </span>
              <span class="admin-nav-pill" id="nav-audio-count">-</span>
            </button>

            <button type="button" class="admin-nav-item ${adminState.activeTab === 'short-stories' ? 'active' : ''}" 
                    onclick="switchAdminTab('short-stories')">
              <span class="admin-nav-item-content">
                ${ADMIN_ICONS.feather}
                <span>Short Stories</span>
              </span>
              <span class="admin-nav-pill" id="nav-short-stories-count">-</span>
            </button>

            <button type="button" class="admin-nav-item ${adminState.activeTab === 'episodes' ? 'active' : ''}" 
                    onclick="switchAdminTab('episodes')">
              <span class="admin-nav-item-content">
                ${ADMIN_ICONS.episodes}
                <span>Episodes</span>
              </span>
              <span class="admin-nav-pill" id="nav-episodes-count">-</span>
            </button>

            <button type="button" class="admin-nav-item ${adminState.activeTab === 'editor' ? 'active' : ''}" 
                    onclick="switchAdminTab('editor')">
              <span class="admin-nav-item-content">
                ${ADMIN_ICONS.edit}
                <span>Editor</span>
              </span>
            </button>

            <button type="button" class="admin-nav-item ${adminState.activeTab === 'scheduler' ? 'active' : ''}" 
                    onclick="switchAdminTab('scheduler')">
              <span class="admin-nav-item-content">
                ${ADMIN_ICONS.clock}
                <span>Schedule</span>
              </span>
              <span class="admin-nav-pill" id="nav-sched-count">-</span>
            </button>

            <button type="button" class="admin-nav-item ${adminState.activeTab === 'writers' ? 'active' : ''}" 
                    onclick="switchAdminTab('writers')">
              <span class="admin-nav-item-content">
                ${ADMIN_ICONS.writers}
                <span>Writer Management</span>
              </span>
              <span class="admin-nav-pill" id="nav-writers-count">-</span>
            </button>

            <button type="button" class="admin-nav-item ${adminState.activeTab === 'submissions' ? 'active' : ''}" 
                    onclick="switchAdminTab('submissions')">
              <span class="admin-nav-item-content">
                ${ADMIN_ICONS.episodes}
                <span>Writer Submissions</span>
              </span>
              <span class="admin-nav-pill" id="nav-submissions-count">-</span>
            </button>

            <button type="button" class="admin-nav-item ${adminState.activeTab === 'writer-chats' ? 'active' : ''}" 
                    onclick="switchAdminTab('writer-chats')">
              <span class="admin-nav-item-content">
                ${ADMIN_ICONS.chat}
                <span>Writer Chat History</span>
              </span>
              <span class="admin-nav-pill" style="background:#FEF3C7; color:#92400E;">Audit</span>
            </button>

            <button type="button" class="admin-nav-item ${adminState.activeTab === 'members' ? 'active' : ''}" 
                    onclick="switchAdminTab('members')">
              <span class="admin-nav-item-content">
                ${ADMIN_ICONS.users}
                <span>Member Management</span>
              </span>
              <span class="admin-nav-pill" id="nav-members-count">-</span>
            </button>

            <button type="button" class="admin-nav-item ${adminState.activeTab === 'forum' ? 'active' : ''}" 
                    onclick="switchAdminTab('forum')">
              <span class="admin-nav-item-content">
                ${ADMIN_ICONS.chat}
                <span>Forms &amp; Content Management</span>
              </span>
              <span class="admin-nav-pill" id="nav-forum-count">-</span>
            </button>

            <button type="button" class="admin-nav-item ${adminState.activeTab === 'settings' ? 'active' : ''}" 
                    onclick="switchAdminTab('settings')">
              <span class="admin-nav-item-content">
                ${ADMIN_ICONS.settings}
                <span>Settings</span>
              </span>
            </button>
          </nav>

          <!-- Compact Sidebar Footer with ONLY View Site and ONLY Logout -->
          <div class="admin-sidebar-footer">
            <a href="#forms" class="admin-sidebar-action-btn" title="Open Public Reader Website">
              ${ADMIN_ICONS.externalLink}
              <span>View Site</span>
            </a>
            <button type="button" class="admin-sidebar-action-btn logout" onclick="handleAdminLogout()" title="Sign out of Dashboard">
              ${ADMIN_ICONS.logout}
              <span>Logout</span>
            </button>
          </div>
        </aside>

        <!-- Main Workspace Tab Canvas -->
        <main class="admin-main" id="admin-main-canvas" role="region" aria-live="polite">
          <div style="text-align:center; padding:60px 20px; color:var(--color-text-muted);">
            <div>Loading dashboard...</div>
          </div>
        </main>
      </div>
    </div>
  `;

  window.toggleAdminMobileNav = (forceState) => {
    const sidebar = document.getElementById('admin-sidebar-nav');
    const backdrop = document.getElementById('admin-sidebar-backdrop');
    const toggleBtn = document.getElementById('admin-mobile-toggle');
    if (!sidebar) return;

    const isOpen = typeof forceState === 'boolean' 
      ? forceState 
      : !sidebar.classList.contains('drawer-open');

    if (isOpen) {
      sidebar.classList.add('drawer-open');
      if (backdrop) backdrop.classList.add('active');
      if (toggleBtn) {
        toggleBtn.setAttribute('aria-expanded', 'true');
        toggleBtn.classList.add('active');
      }
      document.body.classList.add('admin-drawer-active');
    } else {
      sidebar.classList.remove('drawer-open');
      if (backdrop) backdrop.classList.remove('active');
      if (toggleBtn) {
        toggleBtn.setAttribute('aria-expanded', 'false');
        toggleBtn.classList.remove('active');
      }
      document.body.classList.remove('admin-drawer-active');
    }
  };

  window.switchAdminTab = (tab) => {
    if (adminState.activeTab === 'editor' && adminState.editorDirty && tab !== 'editor') {
      const confirmLeave = confirm('You have unsaved changes in the editor. Are you sure you want to leave? Your draft has been backed up in local storage.');
      if (!confirmLeave) return;
    }
    adminState.activeTab = tab;
    
    // Update URL hash so refresh and direct access preserve the active tab
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, '', `#admin?tab=${tab}`);
    }

    // Close mobile drawer on tab navigation
    if (typeof window.toggleAdminMobileNav === 'function') {
      window.toggleAdminMobileNav(false);
    }

    // Update active tab button style (novel-create corresponds to the Novels nav section)
    document.querySelectorAll('.admin-nav-item').forEach(btn => {
      btn.classList.remove('active');
    });
    const activeNavTab = tab === 'novel-create' ? 'novels' : tab;
    const clickedBtn = document.querySelector(`.admin-nav-item[onclick*="'${activeNavTab}'"]`);
    if (clickedBtn) clickedBtn.classList.add('active');

    // Sync active state in top header nav
    if (typeof window.updateAdminHeaderActiveTab === 'function') {
      window.updateAdminHeaderActiveTab(tab);
    }

    // Update top bar title
    const topBarTitle = document.getElementById('admin-top-bar-current-tab');
    if (topBarTitle) {
      topBarTitle.textContent = TAB_TITLES[tab] || 'Author Dashboard';
    }

    renderActiveAdminTab();

    // Scroll smoothly to top of main canvas
    if (window.innerWidth <= 992) {
      const canvas = document.getElementById('admin-main-canvas');
      if (canvas) {
        const top = canvas.getBoundingClientRect().top + window.scrollY - 130;
        window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
      }
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  window.navigateToCreateNovel = () => {
    window.switchAdminTab('novel-create');
  };

  window.handleAdminLogout = async () => {
    try {
      const token = localStorage.getItem('rp_auth_token');
      if (token) {
        await apiFetch('/api/auth/logout', { method: 'POST' });
      }
    } catch (e) {
      console.warn('Logout API error:', e);
    } finally {
      localStorage.removeItem('rp_auth_token');
      sessionStorage.removeItem('rp_admin_redirect');
      window.IS_LOGGED_IN = false;
      window.CURRENT_USER = null;
      adminState.novels = [];
      adminState.episodes = [];
      adminState.scheduledEpisodes = [];
      adminState.editingEpisode = null;
      adminState.mediaList = [];
      if (container) container.innerHTML = '';
      updateHeaderUserArea();
      showToast('Logged out successfully. All administrative sessions closed.');
      window.location.hash = '#admin-login';
      if (window.renderAppView) window.renderAppView();
    }
  };

  // Load Initial Novels & Data
  await loadAdminInitialData();
  renderActiveAdminTab();
}

/**
 * Load initial data for counts and novels
 */
async function loadAdminInitialData() {
  try {
    const [novelsRes, overviewRes, audioRes, writersRes] = await Promise.all([
      apiFetch('/api/admin/novels'),
      apiFetch('/api/admin/overview'),
      apiFetch('/api/admin/audio-novels'),
      apiFetch('/api/admin/writers')
    ]);

    if (!novelsRes.ok || !overviewRes.ok) {
      if (novelsRes.status === 401 || overviewRes.status === 401 || novelsRes.status === 403 || overviewRes.status === 403) {
        localStorage.removeItem('rp_auth_token');
        sessionStorage.removeItem('rp_admin_redirect');
        window.IS_LOGGED_IN = false;
        window.CURRENT_USER = null;
        updateHeaderUserArea();
        showToast('Session expired or unauthorized. Redirecting to Author Portal...');
        window.location.hash = '#admin-login';
        return;
      }
    }

    if (novelsRes.ok) {
      const novelsData = await novelsRes.json();
      adminState.novels = novelsData.novels || [];
      if (!adminState.selectedNovelId && adminState.novels.length > 0) {
        adminState.selectedNovelId = adminState.novels[0].id;
      }
    }

    if (audioRes && audioRes.ok) {
      const audioData = await audioRes.json();
      adminState.audioNovels = audioData.audioNovels || [];
      const audioCountBadge = document.getElementById('nav-audio-count');
      if (audioCountBadge) audioCountBadge.textContent = adminState.audioNovels.length;
    }

    try {
      const ssRes = await apiFetch('/api/admin/short-stories');
      if (ssRes && ssRes.ok) {
        const ssData = await ssRes.json();
        adminState.shortStories = ssData.stories || [];
        const ssBadge = document.getElementById('nav-short-stories-count');
        if (ssBadge) ssBadge.textContent = adminState.shortStories.length;
      }
    } catch (err) {
      console.warn('Failed to load short stories badge:', err);
    }

    if (writersRes && writersRes.ok) {
      const writersData = await writersRes.json();
      adminState.writers = writersData.writers || [];
      const writersCountBadge = document.getElementById('nav-writers-count');
      if (writersCountBadge) {
        writersCountBadge.textContent = writersData.total !== undefined ? writersData.total : adminState.writers.length;
      }
    }

    if (overviewRes.ok) {
      const overview = await overviewRes.json();
      const stats = overview.stats;
      const novelsCountBadge = document.getElementById('nav-novels-count');
      const episodesCountBadge = document.getElementById('nav-episodes-count');
      const schedCountBadge = document.getElementById('nav-sched-count');
      const membersCountBadge = document.getElementById('nav-members-count');

      if (novelsCountBadge && stats?.novels) novelsCountBadge.textContent = stats.novels.total;
      if (episodesCountBadge && stats?.episodes) episodesCountBadge.textContent = stats.episodes.total;
      if (schedCountBadge && stats?.episodes) schedCountBadge.textContent = stats.episodes.scheduled;
      if (membersCountBadge && stats?.community?.users !== undefined) membersCountBadge.textContent = stats.community.users;
    }
  } catch (err) {
    console.error('Failed to load admin initial data:', err);
    if (err.status === 401 || err.status === 403 || err.isSessionExpired) {
      localStorage.removeItem('rp_auth_token');
      sessionStorage.removeItem('rp_admin_redirect');
      window.IS_LOGGED_IN = false;
      window.CURRENT_USER = null;
      updateHeaderUserArea();
      showToast('Session expired. Please log in again.');
      window.location.hash = '#admin-login';
    }
  }
}

/**
 * Render whichever tab is currently active
 */
function renderActiveAdminTab() {
  const canvas = document.getElementById('admin-main-canvas');
  if (!canvas) return;

  switch (adminState.activeTab) {
    case 'overview':
      renderOverviewTab(canvas);
      break;
    case 'novels':
      renderNovelsTab(canvas);
      break;
    case 'novel-create':
      renderNovelCreatePage(canvas);
      break;
    case 'audio':
      renderAudioNovelsTab(canvas);
      break;
    case 'short-stories':
      renderShortStoriesTab(canvas);
      break;
    case 'episodes':
      renderEpisodesTab(canvas);
      break;
    case 'editor':
      renderEditorTab(canvas);
      break;
    case 'scheduler':
      renderSchedulerTab(canvas);
      break;
    case 'writers':
      renderWritersTab(canvas);
      break;
    case 'submissions':
      renderWriterSubmissionsTab(canvas);
      break;
    case 'writer-chats':
      renderWriterChatAuditTab(canvas);
      break;
    case 'media':
      renderMediaTab(canvas);
      break;
    case 'members':
      renderMembersManagementTab(canvas);
      break;
    case 'forum':
      renderForumManagementTab(canvas);
      break;
    case 'settings':
      renderSettingsTab(canvas);
      break;
    default:
      renderOverviewTab(canvas);
  }
}

/* ========================================================
   3. OVERVIEW TAB
   ======================================================== */
async function renderOverviewTab(canvas) {
  canvas.innerHTML = `
    <div style="text-align:center; padding:40px 20px; color:var(--color-text-muted);">
      <div>Loading dashboard data...</div>
    </div>
  `;

  try {
    const res = await apiFetch('/api/admin/overview');
    const data = await res.json();
    const stats = data.stats || {};
    const n = stats.novels || {};
    const e = stats.episodes || {};

    canvas.innerHTML = `
      <div class="admin-page-header">
        <div class="admin-page-title-group">
          <h1 class="admin-page-title">Dashboard</h1>
          <p class="admin-page-subtitle">Manage novels and publishing.</p>
        </div>
        <div class="admin-page-actions">
          <button type="button" class="btn btn-gold btn-sm" onclick="navigateToCreateNovel()">+ New Novel</button>
          <button type="button" class="btn btn-outline btn-sm" onclick="startNewEpisodeInEditor()">+ New Episode</button>
          <button type="button" class="btn btn-outline btn-sm" onclick="switchAdminTab('scheduler')">Scheduler</button>
        </div>
      </div>

      <!-- 4 Compact Database-Backed Metric Cards -->
      <div class="admin-metrics-grid">
        <div class="admin-metric-card">
          <div class="admin-metric-header">
            <span class="admin-metric-label">Novels</span>
            <span class="admin-metric-icon">${ADMIN_ICONS.book}</span>
          </div>
          <div class="admin-metric-value">${n.total ?? 0}</div>
        </div>

        <div class="admin-metric-card">
          <div class="admin-metric-header">
            <span class="admin-metric-label">Published Episodes</span>
            <span class="admin-metric-icon">${ADMIN_ICONS.checkCircle}</span>
          </div>
          <div class="admin-metric-value">${e.published ?? 0}</div>
        </div>

        <div class="admin-metric-card">
          <div class="admin-metric-header">
            <span class="admin-metric-label">Scheduled</span>
            <span class="admin-metric-icon">${ADMIN_ICONS.clock}</span>
          </div>
          <div class="admin-metric-value">${e.scheduled ?? 0}</div>
        </div>

        <div class="admin-metric-card">
          <div class="admin-metric-header">
            <span class="admin-metric-label">Drafts</span>
            <span class="admin-metric-icon">${ADMIN_ICONS.edit}</span>
          </div>
          <div class="admin-metric-value">${e.drafts ?? 0}</div>
        </div>
      </div>

      <!-- 2-Column Content Sections: Scheduled Episodes & Novels -->
      <div class="admin-content-grid">
        <!-- Scheduled Episodes Section -->
        <div class="admin-card">
          <div class="admin-card-header">
            <h2 class="admin-card-title">Recent / Upcoming Episodes</h2>
            <button type="button" class="admin-card-action-link" onclick="switchAdminTab('scheduler')">View all</button>
          </div>
          <div class="admin-card-body">
            ${(!data.upcomingScheduled || data.upcomingScheduled.length === 0) ? `
              <div class="admin-empty-state">
                <div class="admin-empty-title">No scheduled episodes</div>
                <div class="admin-empty-desc">Schedule an episode to see it here.</div>
              </div>
            ` : `
              <div class="admin-compact-list">
                ${data.upcomingScheduled.map(s => `
                  <div class="admin-compact-item">
                    <div class="admin-compact-info">
                      <div class="admin-compact-title">${escapeHtml(s.title)}</div>
                      <div class="admin-compact-meta">${escapeHtml(s.novelTitle)} • Ep ${escapeHtml(s.episodeNumber)}</div>
                    </div>
                    <span class="status-badge scheduled">${formatScheduleDate(s.scheduledAt)}</span>
                  </div>
                `).join('')}
              </div>
            `}
          </div>
        </div>

        <!-- Novels Section -->
        <div class="admin-card">
          <div class="admin-card-header">
            <h2 class="admin-card-title">Novels</h2>
            <button type="button" class="admin-card-action-link" onclick="switchAdminTab('novels')">Manage novels</button>
          </div>
          <div class="admin-card-body">
            ${(!data.recentNovels || data.recentNovels.length === 0) ? `
              <div class="admin-empty-state">
                <div class="admin-empty-title">No novels yet</div>
                <div class="admin-empty-desc">Create your first novel to get started.</div>
              </div>
            ` : `
              <div class="admin-compact-list">
                ${(data.recentNovels || []).map(nov => `
                  <div class="admin-compact-item">
                    <div class="admin-compact-thumb-wrap">
                      <img src="${nov.cover || '/default-cover.jpg'}" class="admin-compact-thumb" alt="" onerror="this.src='/default-cover.jpg'">
                      <div class="admin-compact-info">
                        <div class="admin-compact-title">${escapeHtml(nov.title)}</div>
                        <div class="admin-compact-meta">${nov.chaptersCount ?? 0} chapters • ${escapeHtml(nov.status || 'Ongoing')}</div>
                      </div>
                    </div>
                    <button type="button" class="btn btn-outline btn-xs" onclick="selectNovelForEpisodes('${nov.id}')">
                      Episodes
                    </button>
                  </div>
                `).join('')}
              </div>
            `}
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    canvas.innerHTML = `
      <div style="color:#EF4444; padding:20px; background:#FEF2F2; border-radius:8px;">
        Failed to load overview data: ${err.message}
      </div>
    `;
  }
}

/* ========================================================
   4. NOVELS MANAGEMENT TAB
   ======================================================== */
async function renderNovelsTab(canvas) {
  canvas.innerHTML = `
    <div class="admin-page-header">
      <div class="admin-page-title-group">
        <h1 class="admin-page-title">Novels</h1>
        <p class="admin-page-subtitle">Manage and organize author novels.</p>
      </div>
      <div class="admin-page-actions">
        <button type="button" class="btn btn-gold btn-sm" onclick="navigateToCreateNovel()">+ New Novel</button>
      </div>
    </div>

    <div class="admin-filters-bar">
      <div class="admin-search-wrap">
        <span class="admin-search-icon" aria-hidden="true">🔍</span>
        <input type="text" id="novel-search-input" class="admin-search-input" 
               placeholder="Search novels by title, author, or genre..." 
               oninput="filterNovelsTable(this.value)">
      </div>
      <select id="novel-status-filter" class="admin-filter-select" onchange="filterNovelsByStatus(this.value)">
        <option value="all">All Statuses</option>
        <option value="ongoing">Ongoing</option>
        <option value="completed">Completed</option>
        <option value="draft">Draft / Private</option>
      </select>
    </div>

    <div class="admin-table-wrapper">
      <table class="admin-table">
        <thead>
          <tr>
            <th>Novel</th>
            <th>Author</th>
            <th>Genre / Category</th>
            <th>Status</th>
            <th>Visibility</th>
            <th>Episodes</th>
            <th style="text-align:right;">Actions</th>
          </tr>
        </thead>
        <tbody id="novels-table-body">
          ${adminState.novels.length === 0 ? `
            <tr>
              <td colspan="7" style="text-align:center; padding:40px 16px; color:var(--color-text-muted);">
                <div style="font-size:16px; font-weight:600; color:var(--color-navy-deep); margin-bottom:6px;">No novels found</div>
                <div style="font-size:13px; margin-bottom:16px;">Create your first novel to start publishing episodes.</div>
                <button type="button" class="btn btn-gold btn-sm" onclick="navigateToCreateNovel()">+ Create First Novel</button>
              </td>
            </tr>
          ` : adminState.novels.map(nov => renderNovelTableRow(nov)).join('')}
        </tbody>
      </table>
    </div>

    <!-- Novel Create/Edit Modal Container -->
    <div id="novel-modal-mount"></div>
  `;

  window.filterNovelsTable = (query) => {
    const q = query.toLowerCase().trim();
    const rows = document.querySelectorAll('.novel-table-row');
    rows.forEach(row => {
      const text = row.textContent.toLowerCase();
      row.style.display = text.includes(q) ? '' : 'none';
    });
  };

  window.filterNovelsByStatus = (status) => {
    const s = status.toLowerCase();
    const rows = document.querySelectorAll('.novel-table-row');
    rows.forEach(row => {
      if (s === 'all') {
        row.style.display = '';
      } else if (s === 'draft') {
        const vis = row.getAttribute('data-vis') || '';
        row.style.display = vis !== 'public' ? '' : 'none';
      } else {
        const rowStatus = (row.getAttribute('data-status') || '').toLowerCase();
        row.style.display = rowStatus === s ? '' : 'none';
      }
    });
  };
}

function renderNovelTableRow(nov) {
  const isPub = nov.isPublished && nov.visibility === 'public';
  return `
    <tr class="novel-table-row" data-status="${escapeHtml(nov.status)}" data-vis="${escapeHtml(nov.visibility)}">
      <td>
        <div class="admin-novel-cell">
          <img src="${nov.cover || '/default-cover.jpg'}" class="admin-novel-thumb" alt="${escapeHtml(nov.title)}" onerror="this.src='/default-cover.jpg'">
          <div>
            <div class="admin-novel-title">${escapeHtml(nov.title)}</div>
            <div class="admin-novel-meta">Slug: <code>${escapeHtml(nov.id)}</code></div>
          </div>
        </div>
      </td>
      <td><strong>${escapeHtml(nov.author || 'Rudhra Prarthana')}</strong></td>
      <td>${escapeHtml(nov.genre || 'Novel')}</td>
      <td>
        <span class="status-pill ${nov.status?.toLowerCase() === 'ongoing' ? 'scheduled' : 'published'}">
          ${escapeHtml(nov.status || 'Ongoing')}
        </span>
      </td>
      <td>
        <span class="status-pill ${isPub ? 'published' : 'draft'}">
          ${isPub ? '🟢 Public' : '🔒 Draft / Private'}
        </span>
      </td>
      <td><strong>${nov.chaptersCount ?? 0}</strong></td>
      <td style="text-align:right;">
        <div class="admin-action-btn-group">
          <button type="button" class="btn btn-outline btn-sm" onclick="selectNovelForEpisodes('${nov.id}')" title="Manage Episodes">
            📑 <span class="hide-xs">Episodes</span>
          </button>
          <button type="button" class="btn btn-outline btn-sm" onclick="openEditNovelModal('${nov.id}')" title="Edit Novel">
            ✏️
          </button>
          <button type="button" class="btn btn-outline btn-sm" onclick="deleteNovelPrompt('${nov.id}', '${escapeHtml(nov.title)}')" style="color:#DC2626; border-color:#FECACA;" title="Delete Novel">
            🗑️
          </button>
        </div>
      </td>
    </tr>
  `;
}

/* ========================================================
   4a. DEDICATED NOVEL CREATION WORKSPACE
   ======================================================== */
// State for Dynamic Novel Create Form with Access Control
let novelCreateState = {
  genres: [],
  categories: [],
  members: [],
  writers: [],
  filteredMembers: [],
  filteredWriters: [],
  selectedMembers: new Set(),
  selectedWriters: new Set(),
  contentType: 'written_novel',
  genre: 'Romance / Drama',
  isCustomGenre: false,
  customGenre: '',
  isCustomCategory: false,
  customCategory: '',
  status: 'Ongoing',
  visibility: 'public',
  accessPermission: 'admin_only',
  coverUrl: '',
  audioSourceType: 'youtube',
  audioDuration: '',
  audioVoice: '',
  youtubeUrl: '',
  audioFileUrl: '',
  storyContent: '',
  membersSearch: '',
  writersSearch: ''
};
window.novelCreateState = novelCreateState;

async function renderNovelCreatePage(canvas) {
  // Reset state
  novelCreateState.selectedMembers = new Set();
  novelCreateState.selectedWriters = new Set();
  novelCreateState.contentType = 'written_novel';
  novelCreateState.isCustomGenre = false;
  novelCreateState.isCustomCategory = false;
  novelCreateState.status = 'Ongoing';
  novelCreateState.visibility = 'public';
  novelCreateState.accessPermission = 'admin_only';
  novelCreateState.coverUrl = '';
  novelCreateState.audioSourceType = 'youtube';
  novelCreateState.audioDuration = '';
  novelCreateState.audioVoice = '';
  novelCreateState.youtubeUrl = '';
  novelCreateState.audioFileUrl = '';
  novelCreateState.storyContent = '';
  novelCreateState.membersSearch = '';
  novelCreateState.writersSearch = '';

  // Render initial loading skeleton inside container
  canvas.innerHTML = `
    <div class="novel-create-container">
      <div class="novel-create-header">
        <div class="novel-create-back-wrap">
          <button type="button" class="admin-back-btn" onclick="switchAdminTab('novels')" title="Back to Novels List">
            ${ADMIN_ICONS.backArrow}
            <span>Back to Novels</span>
          </button>
        </div>
        <div class="novel-create-title-box">
          <h1 class="admin-page-title">Create New Novel</h1>
          <p class="admin-page-subtitle">Loading novel configuration and database categories...</p>
        </div>
      </div>
      <div style="padding:40px; text-align:center;">
        <div class="browser-spinner" style="width:32px; height:32px; margin:0 auto 12px;"></div>
        <div style="font-size:14px; color:#64748B;">Connecting to database...</div>
      </div>
    </div>
  `;

  // Fetch genres, content categories, members, and writers in parallel
  try {
    const [genresRes, catsRes, memsRes, wrsRes] = await Promise.all([
      apiFetch('/api/genres').then(r => r.json()).catch(() => ({ genres: [] })),
      apiFetch('/api/content-categories').then(r => r.json()).catch(() => ({ categories: [] })),
      apiFetch('/api/admin/members/lookup').then(r => r.json()).catch(() => ({ members: [] })),
      apiFetch('/api/admin/writers/lookup').then(r => r.json()).catch(() => ({ writers: [] }))
    ]);

    novelCreateState.genres = genresRes.genres || [];
    novelCreateState.categories = catsRes.categories || [];
    novelCreateState.members = memsRes.members || [];
    novelCreateState.writers = wrsRes.writers || [];
    novelCreateState.filteredMembers = [...novelCreateState.members];
    novelCreateState.filteredWriters = [...novelCreateState.writers];
  } catch (err) {
    console.error('Error loading novel create lookups:', err);
  }

  // Fallback standard genres if novel_genres was empty
  if (!novelCreateState.genres.length) {
    novelCreateState.genres = [
      { id: 1, name: 'Romance / Drama' },
      { id: 2, name: 'Family Drama' },
      { id: 3, name: 'Romantic Thriller' },
      { id: 4, name: 'Historical Fiction' },
      { id: 5, name: 'Social / Contemporary' },
      { id: 6, name: 'Mystery / Suspense' },
      { id: 7, name: 'Romance' },
      { id: 8, name: 'Drama' },
      { id: 9, name: 'Family' },
      { id: 10, name: 'Thriller' },
      { id: 11, name: 'Feel Good' }
    ];
  }

  // Set default genre
  novelCreateState.genre = novelCreateState.genres[0]?.name || 'Romance / Drama';

  // Render Full Redesigned Form
  renderNovelCreateFormContent(canvas);
}

function renderNovelCreateFormContent(canvas) {
  const currentAuthorName = adminState.settings?.author_name || 'Rudhra Prarthana';

  canvas.innerHTML = `
    <div class="novel-create-container">
      <!-- Clean, Compact Header with Back Link -->
      <div class="novel-create-header">
        <div class="novel-create-back-wrap">
          <button type="button" class="admin-back-btn" onclick="switchAdminTab('novels')" title="Back to Novels List">
            ${ADMIN_ICONS.backArrow}
            <span>Back to Novels</span>
          </button>
        </div>
        <div class="novel-create-title-box">
          <h1 class="admin-page-title">Create New Novel</h1>
          <p class="admin-page-subtitle">Add your novel details and prepare it for readers.</p>
        </div>
      </div>

      <form id="novel-create-form" onsubmit="event.preventDefault(); handleNovelCreateSubmit(false);" novalidate>
        <!-- Section 1 — Basic Information -->
        <div class="admin-card novel-form-section">
          <div class="admin-card-header">
            <h2 class="admin-card-title">Section 1 — Basic Information</h2>
          </div>
          <div class="admin-card-body">
            <div class="novel-form-two-col">
              <!-- Left Column: Primary Text & Categorization -->
              <div class="novel-form-fields">
                <!-- 1. Novel Title (Required, blank placeholder) -->
                <div class="form-group">
                  <label class="form-label" for="nc-title">
                    Novel Title <span class="required-star" aria-hidden="true">*</span>
                  </label>
                  <input type="text" id="nc-title" class="form-input" 
                         placeholder="" 
                         required 
                         oninput="handleNovelTitleInput(this.value)">
                  <div class="form-field-error" id="nc-title-error" style="display:none;" role="alert"></div>
                </div>

                <!-- 2. Short Description (Blank default) -->
                <div class="form-group">
                  <label class="form-label" for="nc-short-desc">Short Description</label>
                  <textarea id="nc-short-desc" class="form-input" rows="2" 
                            placeholder=""></textarea>
                  <div class="form-field-hint">Displayed in catalog cards and search summaries.</div>
                </div>

                <!-- 3. Full Synopsis (Blank default) -->
                <div class="form-group">
                  <label class="form-label" for="nc-synopsis">Full Synopsis</label>
                  <textarea id="nc-synopsis" class="form-input" rows="5" 
                            placeholder=""></textarea>
                  <div class="form-field-hint">Comprehensive synopsis displayed prominently on the novel detail page.</div>
                </div>

                <!-- 4. Content Type & Language Grid -->
                <div class="form-row-2col">
                  <!-- Content Type Selector -->
                  <div class="form-group">
                    <label class="form-label" for="nc-content-type">Content Type</label>
                    <select id="nc-content-type" class="form-input" onchange="handleNovelContentTypeChange(this.value)">
                      <option value="written_novel" ${novelCreateState.contentType === 'written_novel' ? 'selected' : ''}>Written Novel</option>
                      <option value="audio_novel" ${novelCreateState.contentType === 'audio_novel' ? 'selected' : ''}>Audio Novel</option>
                      <option value="short_story" ${novelCreateState.contentType === 'short_story' ? 'selected' : ''}>Short Story</option>
                      <option value="__other__" ${novelCreateState.isCustomCategory ? 'selected' : ''}>Other (Create New Category...)</option>
                    </select>
                    <div class="form-field-hint">Determines placement and dedicated reading interface.</div>
                  </div>

                  <!-- Language Selector -->
                  <div class="form-group">
                    <label class="form-label" for="nc-language">Language</label>
                    <select id="nc-language" class="form-input">
                      <option value="Tamil" selected>Tamil (தமிழ்)</option>
                      <option value="English">English</option>
                      <option value="Bilingual">Bilingual (Tamil / English)</option>
                    </select>
                  </div>
                </div>

                <!-- Conditional New Category Input (When Other is selected) -->
                <div id="nc-custom-category-container" class="novel-conditional-panel" style="display:${novelCreateState.isCustomCategory ? 'block' : 'none'};">
                  <label class="form-label" for="nc-custom-category">
                    New Content Category Name <span class="required-star">*</span>
                  </label>
                  <input type="text" id="nc-custom-category" class="form-input" 
                         placeholder="e.g. Novellas, Poetry, Special Series" 
                         value="${escapeHtml(novelCreateState.customCategory || '')}">
                  <div class="form-field-hint">This new category will be saved to the database and made available for future use.</div>
                </div>

                <!-- 5. Genre / Category Selector with Other Support -->
                <div class="form-group">
                  <label class="form-label" for="nc-genre">Genre / Category</label>
                  <select id="nc-genre" class="form-input" onchange="handleNovelGenreChange(this.value)">
                    ${novelCreateState.genres.map(g => `
                      <option value="${escapeHtml(g.name)}" ${novelCreateState.genre === g.name && !novelCreateState.isCustomGenre ? 'selected' : ''}>
                        ${escapeHtml(g.name)}
                      </option>
                    `).join('')}
                    <option value="__other__" ${novelCreateState.isCustomGenre ? 'selected' : ''}>Other (Create New Genre...)</option>
                  </select>
                  <div class="form-field-hint">Select existing database genre or create a new one.</div>
                </div>

                <!-- Conditional New Genre Input (When Other is selected) -->
                <div id="nc-custom-genre-container" class="novel-conditional-panel" style="display:${novelCreateState.isCustomGenre ? 'block' : 'none'};">
                  <label class="form-label" for="nc-custom-genre">
                    New Genre / Category Name <span class="required-star">*</span>
                  </label>
                  <input type="text" id="nc-custom-genre" class="form-input" 
                         placeholder="e.g. Mythological Fantasy, Crime Noir" 
                         value="${escapeHtml(novelCreateState.customGenre || '')}">
                  <div class="form-field-hint">Will be added to the database genres and prevented from duplicate entry.</div>
                </div>

                <!-- Conditional Audio Novel Specific Fields -->
                <div id="nc-audio-fields-container" class="novel-conditional-panel" style="display:${novelCreateState.contentType === 'audio_novel' ? 'block' : 'none'};">
                  <h4 style="margin:0 0 12px 0; font-size:14px; font-weight:700; color:var(--color-navy-deep);">
                    🎧 Audio Novel Details
                  </h4>
                  <div class="form-row-2col">
                    <div class="form-group">
                      <label class="form-label" for="nc-audio-voice">Voice / Narrator</label>
                      <input type="text" id="nc-audio-voice" class="form-input" 
                             placeholder="e.g. Rudhra Prarthana" 
                             value="${escapeHtml(novelCreateState.audioVoice || currentAuthorName)}">
                    </div>
                    <div class="form-group">
                      <label class="form-label" for="nc-audio-duration">Estimated Duration</label>
                      <input type="text" id="nc-audio-duration" class="form-input" 
                             placeholder="e.g. 45 mins / Ongoing episodes" 
                             value="${escapeHtml(novelCreateState.audioDuration || '')}">
                    </div>
                  </div>

                  <!-- Audio Source Selection: YouTube Link vs Direct Audio Upload -->
                  <div class="form-group" style="margin-top:14px;">
                    <label class="form-label">Audio Source Selection</label>
                    <div style="display:flex; gap:12px; margin-bottom:12px;">
                      <label style="display:inline-flex; align-items:center; gap:8px; cursor:pointer; font-size:13px; font-weight:600; padding:8px 14px; background:#FFFFFF; border:1px solid #CBD5E1; border-radius:8px;">
                        <input type="radio" name="nc-audio-source" value="youtube" ${novelCreateState.audioSourceType === 'youtube' ? 'checked' : ''} onchange="handleNovelAudioSourceToggle('youtube')">
                        <span>▶ YouTube Link</span>
                      </label>
                      <label style="display:inline-flex; align-items:center; gap:8px; cursor:pointer; font-size:13px; font-weight:600; padding:8px 14px; background:#FFFFFF; border:1px solid #CBD5E1; border-radius:8px;">
                        <input type="radio" name="nc-audio-source" value="audio_file" ${novelCreateState.audioSourceType === 'audio_file' ? 'checked' : ''} onchange="handleNovelAudioSourceToggle('audio_file')">
                        <span>🎧 Direct Audio Upload</span>
                      </label>
                    </div>

                    <!-- YouTube Link Container -->
                    <div id="nc-youtube-wrap" style="display:${novelCreateState.audioSourceType === 'youtube' ? 'block' : 'none'};">
                      <input type="url" id="nc-audio-youtube-url" class="form-input" 
                             placeholder="Paste YouTube video or playlist URL" 
                             value="${escapeHtml(novelCreateState.youtubeUrl || '')}" 
                             oninput="handleNovelYouTubeInput(this.value)">
                      <div class="form-field-hint">Supports standard YouTube video, Shorts, and youtu.be URLs.</div>
                      
                      <!-- Live Preview Container -->
                      <div id="nc-youtube-preview-wrap" style="margin-top:10px; display:none;">
                        <div style="position:relative; width:100%; aspect-ratio:16/9; background:#000; border-radius:8px; overflow:hidden;">
                          <iframe id="nc-youtube-preview-iframe" src="" style="position:absolute; inset:0; width:100%; height:100%; border:0;" allowfullscreen></iframe>
                        </div>
                      </div>
                    </div>

                    <!-- Direct Audio Upload Container -->
                    <div id="nc-audio-file-wrap" style="display:${novelCreateState.audioSourceType === 'audio_file' ? 'block' : 'none'};">
                      <div class="admin-audio-upload-dropzone" onclick="document.getElementById('nc-audio-file-input').click();">
                        <div style="font-size:26px; margin-bottom:4px;">🎧</div>
                        <div style="font-size:13px; font-weight:600; color:var(--color-navy-deep);" id="nc-audio-filename-display">
                          ${novelCreateState.audioFileUrl ? novelCreateState.audioFileUrl.split('/').pop() : 'Click to select audio file (MP3, M4A, WAV up to 50MB)'}
                        </div>
                      </div>
                      <input type="file" id="nc-audio-file-input" accept="audio/*" style="display:none;" onchange="handleNovelDirectAudioSelected(this.files[0])">
                      <input type="hidden" id="nc-audio-file-url" value="${escapeHtml(novelCreateState.audioFileUrl || '')}">
                      <div id="nc-audio-player-preview" style="margin-top:10px; display:${novelCreateState.audioFileUrl ? 'block' : 'none'};">
                        <audio id="nc-audio-player" controls style="width:100%;" src="${novelCreateState.audioFileUrl || ''}"></audio>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Conditional Short Story Specific Fields -->
                <div id="nc-story-fields-container" class="novel-conditional-panel" style="display:${novelCreateState.contentType === 'short_story' ? 'block' : 'none'};">
                  <h4 style="margin:0 0 10px 0; font-size:14px; font-weight:700; color:var(--color-navy-deep);">
                    ✍️ Short Story Content
                  </h4>
                  <div class="form-group">
                    <label class="form-label" for="nc-story-content">Story Text</label>
                    <textarea id="nc-story-content" class="form-input" rows="8" 
                              placeholder="" 
                              oninput="handleNovelStoryContentInput(this.value)">${escapeHtml(novelCreateState.storyContent || '')}</textarea>
                    <div id="nc-story-stats" class="form-field-hint">Words: 0 • Read Time: 1 min</div>
                  </div>
                </div>
              </div>

              <!-- Right Column: Clean 2:3 Cover Image with Clean Placeholder -->
              <div class="novel-cover-upload-panel">
                <label class="form-label" style="font-weight:700; color:var(--color-navy-deep); font-size:13px; margin-bottom:8px; display:block;">
                  Novel Cover Image
                </label>
                <div class="novel-cover-preview-card clean-cover-card">
                  <!-- Cover Image Preview Wrapper -->
                  <div class="novel-cover-img-wrapper" id="nc-cover-wrapper" onclick="triggerNovelCoverFilePicker()" title="Click to choose or replace cover image">
                    <!-- Clean Placeholder (Displayed when no image is uploaded) -->
                    <div id="nc-cover-placeholder" class="clean-cover-placeholder" style="display:${novelCreateState.coverUrl ? 'none' : 'flex'};">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <circle cx="8.5" cy="8.5" r="1.5"></circle>
                        <polyline points="21 15 16 10 5 21"></polyline>
                      </svg>
                      <div class="clean-cover-placeholder-title">No Cover Image</div>
                      <div class="clean-cover-placeholder-sub">Click to select cover (2:3 ratio)</div>
                    </div>

                    <!-- Real Image (Displayed once uploaded) -->
                    <img id="nc-cover-preview-img" 
                         src="${novelCreateState.coverUrl || ''}" 
                         alt="Novel Cover Preview" 
                         style="display:${novelCreateState.coverUrl ? 'block' : 'none'}; width:100%; height:100%; object-fit:cover;"
                         onerror="this.style.display='none'; document.getElementById('nc-cover-placeholder').style.display='flex';">

                    <div class="novel-cover-hover-overlay">
                      <span>Click to choose or change</span>
                    </div>

                    <div id="nc-cover-spinner" class="novel-cover-uploading-spinner" style="display:none;">
                      <div class="browser-spinner" style="width:24px; height:24px; margin:0 0 6px;"></div>
                      <span style="font-size:11px; font-weight:600; color:#ffffff;">Uploading...</span>
                    </div>
                  </div>

                  <!-- Hidden Native File Input & Value Carrier -->
                  <input type="file" id="nc-cover-file-input" accept="image/jpeg,image/png,image/webp,image/gif" style="display:none;" onchange="handleNovelCoverFileSelected(this.files[0])">
                  <input type="hidden" id="nc-cover-url-input" value="${escapeHtml(novelCreateState.coverUrl || '')}">

                  <!-- Actions Container -->
                  <div class="novel-cover-single-action" style="width:100%; margin-top:12px;">
                    <button type="button" id="nc-choose-cover-btn" class="btn btn-gold btn-sm" style="width:100%; justify-content:center; gap:8px;" onclick="triggerNovelCoverFilePicker()">
                      ${ADMIN_ICONS.upload}
                      <span id="nc-choose-cover-text">${novelCreateState.coverUrl ? 'Replace Cover Image' : 'Choose Cover Image'}</span>
                    </button>
                    <button type="button" id="nc-remove-cover-btn" class="btn btn-outline btn-sm btn-danger-subtle" 
                            style="display:${novelCreateState.coverUrl ? 'inline-flex' : 'none'}; width:100%; justify-content:center; gap:6px; margin-top:8px;" 
                            onclick="removeNovelCoverImage()">
                      ✕ Remove Image
                    </button>
                  </div>

                  <!-- Inline Error Container -->
                  <div id="nc-cover-error" class="novel-cover-inline-error" style="display:none; color:#EF4444; font-size:12px; margin-top:8px; text-align:center;"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Section 2 — Publishing Details -->
        <div class="admin-card novel-form-section" style="margin-top:20px;">
          <div class="admin-card-header">
            <h2 class="admin-card-title">Section 2 — Publishing Details</h2>
          </div>
          <div class="admin-card-body">
            <div class="admin-form-grid">
              <!-- A. Publication Status -->
              <div class="form-group">
                <label class="form-label" for="nc-status">Publication Status</label>
                <select id="nc-status" class="form-input" onchange="handleNovelStatusChange(this.value)">
                  <option value="Ongoing" selected>Ongoing (தொடர்கதை)</option>
                  <option value="Completed">Completed (முழு நாவல்)</option>
                  <option value="Draft">Draft (வரைவு)</option>
                  <option value="Scheduled">Scheduled (திட்டமிடப்பட்டது)</option>
                </select>
                <div class="form-field-hint">Indicates whether content is active, completed, or scheduled.</div>
              </div>

              <!-- B. Author / Creator Selector -->
              <div class="form-group">
                <label class="form-label" for="nc-author-select">Author / Creator</label>
                <select id="nc-author-select" class="form-input">
                  <option value="Rudhra Prarthana|2" selected>Rudhra Prarthana (Admin / Author)</option>
                  ${novelCreateState.writers.filter(w => w.id !== 2).map(w => `
                    <option value="${escapeHtml(w.name)}|${w.id}">
                      ${escapeHtml(w.name)} (${escapeHtml(w.role || 'Writer')})
                    </option>
                  `).join('')}
                </select>
                <div class="form-field-hint">Authenticated author or assigned creator identity.</div>
              </div>

              <!-- C. Visibility — Who Can View This Content? -->
              <div class="form-group">
                <label class="form-label" for="nc-visibility">Visibility — Who Can View This Content?</label>
                <select id="nc-visibility" class="form-input" onchange="handleNovelVisibilityChange(this.value)">
                  <option value="public" selected>Public (Any Visitor / Reader)</option>
                  <option value="members">All Members (Registered & Authorized Members)</option>
                  <option value="selected_members">Selected Members (Specific Members Only)</option>
                  <option value="private">Private / Admin Only (Authorized Administrators Only)</option>
                </select>
                <div class="form-field-hint">Controls frontend reader discovery and backend reading access.</div>
              </div>

              <!-- D. Access Permissions — Who Can Work on This Content? -->
              <div class="form-group">
                <label class="form-label" for="nc-access-permission">Access Permissions — Who Can Work on This Content?</label>
                <select id="nc-access-permission" class="form-input" onchange="handleNovelAccessPermissionChange(this.value)">
                  <option value="admin_only" selected>Admin Only (Authorized Administrators Only)</option>
                  <option value="all_writers">All Authorized Writers (Any User with Writer Permissions)</option>
                  <option value="selected_writers">Selected Writers (Specifically Selected Writers Only)</option>
                  <option value="assigned_writers">Assigned Writer(s) (Assigned Writers Only)</option>
                </select>
                <div class="form-field-hint">Strictly enforced on all backend content creation & editing endpoints.</div>
              </div>
            </div>

            <!-- Conditional Scheduled Date / Time Picker -->
            <div id="nc-scheduled-container" class="novel-conditional-panel" style="display:none; margin-top:16px;">
              <div class="form-group">
                <label class="form-label" for="nc-scheduled-at">
                  Scheduled Publication Date & Time <span class="required-star">*</span>
                </label>
                <input type="datetime-local" id="nc-scheduled-at" class="form-input" style="max-width:320px;">
                <div class="form-field-hint">The system will automatically publish this novel when the scheduled time arrives.</div>
              </div>
            </div>

            <!-- Conditional Searchable Members Checklist (Visibility: Selected Members) -->
            <div id="nc-selected-members-container" class="novel-conditional-panel" style="display:none; margin-top:16px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <label class="form-label" style="margin:0; font-weight:700;">
                  👥 Select Eligible Members to Grant Viewing Access
                </label>
                <span id="nc-selected-members-count" class="novel-checklist-badge">0 members selected</span>
              </div>
              <div class="novel-checklist-box">
                <div class="novel-checklist-toolbar">
                  <div class="novel-checklist-search-wrap">
                    <span class="novel-checklist-search-icon">🔍</span>
                    <input type="text" id="nc-members-search" placeholder="Search members by name, email, or ID..." oninput="filterMembersChecklist(this.value)">
                  </div>
                  <button type="button" class="btn btn-outline btn-sm" onclick="toggleSelectAllMembers(true)">Select All</button>
                  <button type="button" class="btn btn-outline btn-sm" onclick="toggleSelectAllMembers(false)">Clear</button>
                </div>
                <div id="nc-members-scroll-list" class="novel-checklist-scroll">
                  ${renderMembersChecklistItems(novelCreateState.filteredMembers)}
                </div>
              </div>
              <div class="form-field-hint" style="margin-top:6px;">Only these chosen members will have backend authorization to discover and view this novel.</div>
            </div>

            <!-- Conditional Searchable Writers Checklist (Access Permissions: Selected/Assigned Writers) -->
            <div id="nc-selected-writers-container" class="novel-conditional-panel" style="display:none; margin-top:16px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <label class="form-label" style="margin:0; font-weight:700;">
                  ✍️ Select Authorized Writers Permitted to Work on This Content
                </label>
                <span id="nc-selected-writers-count" class="novel-checklist-badge">0 writers selected</span>
              </div>
              <div class="novel-checklist-box">
                <div class="novel-checklist-toolbar">
                  <div class="novel-checklist-search-wrap">
                    <span class="novel-checklist-search-icon">🔍</span>
                    <input type="text" id="nc-writers-search" placeholder="Search writers by name, email, or ID..." oninput="filterWritersChecklist(this.value)">
                  </div>
                  <button type="button" class="btn btn-outline btn-sm" onclick="toggleSelectAllWriters(true)">Select All</button>
                  <button type="button" class="btn btn-outline btn-sm" onclick="toggleSelectAllWriters(false)">Clear</button>
                </div>
                <div id="nc-writers-scroll-list" class="novel-checklist-scroll">
                  ${renderWritersChecklistItems(novelCreateState.filteredWriters)}
                </div>
              </div>
              <div class="form-field-hint" style="margin-top:6px;">Writers not selected in this list will be blocked on the backend from creating chapters or editing this novel.</div>
            </div>
          </div>
        </div>

        <!-- Submission Status Banner -->
        <div id="nc-form-error" class="novel-form-banner-error" style="display:none;" role="alert"></div>

        <!-- Form Actions Bar: Cancel, Save Draft, Create / Publish -->
        <div class="novel-form-actions-bar">
          <div class="novel-form-actions-left">
            <button type="button" class="btn btn-outline" onclick="switchAdminTab('novels')">
              Cancel
            </button>
          </div>
          <div class="novel-form-actions-right">
            <button type="button" class="btn btn-outline" id="nc-save-draft-btn" onclick="submitNovelCreateForm(true)">
              Save Draft
            </button>
            <button type="submit" class="btn btn-gold" id="nc-submit-btn">
              Create Novel
            </button>
          </div>
        </div>
      </form>

      <!-- Confirmation Summary Modal Mount -->
      <div id="nc-confirm-modal-mount"></div>
    </div>
  `;

  // Focus title input on render
  setTimeout(() => {
    document.getElementById('nc-title')?.focus();
  }, 100);
}

// Helpers for Members Checklist
function renderMembersChecklistItems(members) {
  if (!members || !members.length) {
    return `<div style="padding:16px; text-align:center; color:#94A3B8; font-size:12.5px;">No active members found.</div>`;
  }
  return members.map(m => {
    const isSelected = novelCreateState.selectedMembers.has(Number(m.id));
    const avatar = m.avatar 
      ? `<img src="${escapeHtml(m.avatar)}" class="novel-checklist-avatar" alt="${escapeHtml(m.name)}">`
      : `<div class="novel-checklist-avatar">${escapeHtml((m.name || 'M').charAt(0).toUpperCase())}</div>`;
    return `
      <label class="novel-checklist-item ${isSelected ? 'selected' : ''}" id="nc-mem-item-${m.id}">
        <input type="checkbox" value="${m.id}" ${isSelected ? 'checked' : ''} onchange="toggleMemberSelection(${m.id}, this.checked)">
        ${avatar}
        <div class="novel-checklist-info">
          <span class="novel-checklist-name">${escapeHtml(m.name)}</span>
          <span class="novel-checklist-email">${escapeHtml(m.email || m.username || '')}</span>
        </div>
        <span class="novel-checklist-id">#${m.id}</span>
      </label>
    `;
  }).join('');
}

window.filterMembersChecklist = (queryText) => {
  novelCreateState.membersSearch = (queryText || '').toLowerCase().trim();
  const filtered = novelCreateState.members.filter(m => {
    const name = (m.name || '').toLowerCase();
    const email = (m.email || '').toLowerCase();
    const username = (m.username || '').toLowerCase();
    const id = String(m.id);
    return name.includes(novelCreateState.membersSearch) ||
           email.includes(novelCreateState.membersSearch) ||
           username.includes(novelCreateState.membersSearch) ||
           id === novelCreateState.membersSearch;
  });
  novelCreateState.filteredMembers = filtered;
  const listEl = document.getElementById('nc-members-scroll-list');
  if (listEl) {
    listEl.innerHTML = renderMembersChecklistItems(filtered);
  }
};

window.toggleMemberSelection = (memberId, isChecked) => {
  const mId = Number(memberId);
  if (isChecked) {
    novelCreateState.selectedMembers.add(mId);
  } else {
    novelCreateState.selectedMembers.delete(mId);
  }
  const itemEl = document.getElementById(`nc-mem-item-${mId}`);
  if (itemEl) {
    if (isChecked) itemEl.classList.add('selected');
    else itemEl.classList.remove('selected');
  }
  updateSelectedMembersCount();
};

window.toggleSelectAllMembers = (selectAll) => {
  if (selectAll) {
    novelCreateState.filteredMembers.forEach(m => novelCreateState.selectedMembers.add(Number(m.id)));
  } else {
    novelCreateState.selectedMembers.clear();
  }
  const listEl = document.getElementById('nc-members-scroll-list');
  if (listEl) {
    listEl.innerHTML = renderMembersChecklistItems(novelCreateState.filteredMembers);
  }
  updateSelectedMembersCount();
};

function updateSelectedMembersCount() {
  const countEl = document.getElementById('nc-selected-members-count');
  if (countEl) {
    const count = novelCreateState.selectedMembers.size;
    countEl.textContent = `${count} member${count === 1 ? '' : 's'} selected`;
  }
}

// Helpers for Writers Checklist
function renderWritersChecklistItems(writers) {
  if (!writers || !writers.length) {
    return `<div style="padding:16px; text-align:center; color:#94A3B8; font-size:12.5px;">No active writers found.</div>`;
  }
  return writers.map(w => {
    const isSelected = novelCreateState.selectedWriters.has(Number(w.id));
    const avatar = w.avatar 
      ? `<img src="${escapeHtml(w.avatar)}" class="novel-checklist-avatar" alt="${escapeHtml(w.name)}">`
      : `<div class="novel-checklist-avatar">${escapeHtml((w.name || 'W').charAt(0).toUpperCase())}</div>`;
    return `
      <label class="novel-checklist-item ${isSelected ? 'selected' : ''}" id="nc-wr-item-${w.id}">
        <input type="checkbox" value="${w.id}" ${isSelected ? 'checked' : ''} onchange="toggleWriterSelection(${w.id}, this.checked)">
        ${avatar}
        <div class="novel-checklist-info">
          <span class="novel-checklist-name">${escapeHtml(w.name)}</span>
          <span class="novel-checklist-email">${escapeHtml(w.email || w.username || '')} (${escapeHtml(w.role || 'Writer')})</span>
        </div>
        <span class="novel-checklist-id">#${w.id}</span>
      </label>
    `;
  }).join('');
}

window.filterWritersChecklist = (queryText) => {
  novelCreateState.writersSearch = (queryText || '').toLowerCase().trim();
  const filtered = novelCreateState.writers.filter(w => {
    const name = (w.name || '').toLowerCase();
    const email = (w.email || '').toLowerCase();
    const username = (w.username || '').toLowerCase();
    const id = String(w.id);
    return name.includes(novelCreateState.writersSearch) ||
           email.includes(novelCreateState.writersSearch) ||
           username.includes(novelCreateState.writersSearch) ||
           id === novelCreateState.writersSearch;
  });
  novelCreateState.filteredWriters = filtered;
  const listEl = document.getElementById('nc-writers-scroll-list');
  if (listEl) {
    listEl.innerHTML = renderWritersChecklistItems(filtered);
  }
};

window.toggleWriterSelection = (writerId, isChecked) => {
  const wId = Number(writerId);
  if (isChecked) {
    novelCreateState.selectedWriters.add(wId);
  } else {
    novelCreateState.selectedWriters.delete(wId);
  }
  const itemEl = document.getElementById(`nc-wr-item-${wId}`);
  if (itemEl) {
    if (isChecked) itemEl.classList.add('selected');
    else itemEl.classList.remove('selected');
  }
  updateSelectedWritersCount();
};

window.toggleSelectAllWriters = (selectAll) => {
  if (selectAll) {
    novelCreateState.filteredWriters.forEach(w => novelCreateState.selectedWriters.add(Number(w.id)));
  } else {
    novelCreateState.selectedWriters.clear();
  }
  const listEl = document.getElementById('nc-writers-scroll-list');
  if (listEl) {
    listEl.innerHTML = renderWritersChecklistItems(novelCreateState.filteredWriters);
  }
  updateSelectedWritersCount();
};

function updateSelectedWritersCount() {
  const countEl = document.getElementById('nc-selected-writers-count');
  if (countEl) {
    const count = novelCreateState.selectedWriters.size;
    countEl.textContent = `${count} writer${count === 1 ? '' : 's'} selected`;
  }
}

// Form Field Event Handlers
window.handleNovelTitleInput = (title) => {
  const titleError = document.getElementById('nc-title-error');
  if (titleError) titleError.style.display = 'none';
};

window.handleNovelContentTypeChange = (type) => {
  novelCreateState.contentType = type;
  novelCreateState.isCustomCategory = (type === '__other__');

  const customCatWrap = document.getElementById('nc-custom-category-container');
  if (customCatWrap) customCatWrap.style.display = novelCreateState.isCustomCategory ? 'block' : 'none';

  const audioFieldsWrap = document.getElementById('nc-audio-fields-container');
  if (audioFieldsWrap) audioFieldsWrap.style.display = (type === 'audio_novel') ? 'block' : 'none';

  const storyFieldsWrap = document.getElementById('nc-story-fields-container');
  if (storyFieldsWrap) storyFieldsWrap.style.display = (type === 'short_story') ? 'block' : 'none';
};

window.handleNovelGenreChange = (val) => {
  novelCreateState.genre = val;
  novelCreateState.isCustomGenre = (val === '__other__');
  const customGenreWrap = document.getElementById('nc-custom-genre-container');
  if (customGenreWrap) customGenreWrap.style.display = novelCreateState.isCustomGenre ? 'block' : 'none';
};

window.handleNovelStatusChange = (status) => {
  novelCreateState.status = status;
  const schedWrap = document.getElementById('nc-scheduled-container');
  if (schedWrap) schedWrap.style.display = (status === 'Scheduled') ? 'block' : 'none';
};

window.handleNovelVisibilityChange = (vis) => {
  novelCreateState.visibility = vis;
  const memsWrap = document.getElementById('nc-selected-members-container');
  if (memsWrap) memsWrap.style.display = (vis === 'selected_members') ? 'block' : 'none';
};

window.handleNovelAccessPermissionChange = (perm) => {
  novelCreateState.accessPermission = perm;
  const wrsWrap = document.getElementById('nc-selected-writers-container');
  if (wrsWrap) {
    const show = (perm === 'selected_writers' || perm === 'assigned_writers');
    wrsWrap.style.display = show ? 'block' : 'none';
  }
};

window.handleNovelAudioSourceToggle = (sourceType) => {
  novelCreateState.audioSourceType = sourceType;
  const ytWrap = document.getElementById('nc-youtube-wrap');
  const fileWrap = document.getElementById('nc-audio-file-wrap');
  if (ytWrap) ytWrap.style.display = (sourceType === 'youtube') ? 'block' : 'none';
  if (fileWrap) fileWrap.style.display = (sourceType === 'audio_file') ? 'block' : 'none';
};

window.handleNovelYouTubeInput = (url) => {
  novelCreateState.youtubeUrl = url;
  const previewWrap = document.getElementById('nc-youtube-preview-wrap');
  const iframe = document.getElementById('nc-youtube-preview-iframe');
  const match = (url || '').trim().match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/i);
  const videoId = match ? match[1] : null;
  if (videoId && previewWrap && iframe) {
    iframe.src = `https://www.youtube-nocookie.com/embed/${videoId}?rel=0`;
    previewWrap.style.display = 'block';
  } else if (previewWrap) {
    previewWrap.style.display = 'none';
  }
};

window.handleNovelDirectAudioSelected = async (file) => {
  if (!file) return;
  const filenameDisplay = document.getElementById('nc-audio-filename-display');
  if (filenameDisplay) filenameDisplay.textContent = `Uploading: ${file.name}...`;

  try {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64Data = e.target.result;
      const res = await apiFetch('/api/admin/media/upload', {
        method: 'POST',
        body: JSON.stringify({
          data: base64Data,
          filename: file.name
        })
      });
      const data = await res.json();
      if (res.ok && data.success && data.media?.url) {
        novelCreateState.audioFileUrl = data.media.url;
        document.getElementById('nc-audio-file-url').value = data.media.url;
        if (filenameDisplay) filenameDisplay.textContent = `Attached: ${file.name}`;
        const playerPreview = document.getElementById('nc-audio-player-preview');
        const player = document.getElementById('nc-audio-player');
        if (playerPreview && player) {
          player.src = data.media.url;
          playerPreview.style.display = 'block';
        }
        showToast('Audio file attached! 🎧');
      } else {
        if (filenameDisplay) filenameDisplay.textContent = 'Upload failed. Click to retry.';
        showToast(data.error || 'Failed to upload audio file.');
      }
    };
    reader.readAsDataURL(file);
  } catch (err) {
    console.error('Audio upload error:', err);
    showToast('Failed to process audio file.');
  }
};

window.handleNovelStoryContentInput = (content) => {
  novelCreateState.storyContent = content;
  const statsEl = document.getElementById('nc-story-stats');
  if (statsEl) {
    const plain = (content || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    const words = plain ? plain.split(/\s+/).filter(Boolean).length : 0;
    const mins = Math.max(1, Math.ceil(words / 200));
    statsEl.textContent = `Words: ${words.toLocaleString()} • Estimated Read Time: ${mins} min${mins === 1 ? '' : 's'}`;
  }
};

// Cover Image Handlers with Clean Placeholder (No Broken Image Preview!)
window.triggerNovelCoverFilePicker = () => {
  const fileInput = document.getElementById('nc-cover-file-input');
  if (fileInput) fileInput.click();
};

window.chooseCoverImageForCreateNovel = () => {
  window.triggerNovelCoverFilePicker();
};

window.handleNovelCoverFileSelected = async (file) => {
  if (!file) return;
  const errEl = document.getElementById('nc-cover-error');
  const spinner = document.getElementById('nc-cover-spinner');
  const previewImg = document.getElementById('nc-cover-preview-img');
  const placeholder = document.getElementById('nc-cover-placeholder');
  const urlInput = document.getElementById('nc-cover-url-input');
  const removeBtn = document.getElementById('nc-remove-cover-btn');
  const chooseBtnText = document.getElementById('nc-choose-cover-text');

  if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }

  if (!file.type.startsWith('image/')) {
    const msg = 'Please select a valid image file (JPG, PNG, WebP, GIF).';
    if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; }
    showToast(msg);
    return;
  }
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    const msg = 'Cover image file size must be under 10MB.';
    if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; }
    showToast(msg);
    return;
  }

  const reader = new FileReader();
  reader.onload = async (e) => {
    const localDataUrl = e.target.result;
    if (placeholder) placeholder.style.display = 'none';
    if (previewImg) {
      previewImg.src = localDataUrl;
      previewImg.style.display = 'block';
    }
    if (spinner) spinner.style.display = 'flex';

    try {
      const res = await apiFetch('/api/admin/media/upload', {
        method: 'POST',
        body: JSON.stringify({
          data: localDataUrl,
          filename: file.name
        })
      });
      const data = await res.json();
      if (spinner) spinner.style.display = 'none';

      if (!res.ok || !data.success || !data.media?.url) {
        const errMsg = data.error || 'Failed to upload cover image.';
        if (errEl) { errEl.textContent = errMsg; errEl.style.display = 'block'; }
        showToast(errMsg);
        return;
      }

      novelCreateState.coverUrl = data.media.url;
      if (urlInput) urlInput.value = data.media.url;
      if (previewImg) previewImg.src = data.media.url;
      if (removeBtn) removeBtn.style.display = 'inline-flex';
      if (chooseBtnText) chooseBtnText.textContent = 'Replace Cover Image';
      showToast('Cover image uploaded successfully! ✨');
    } catch (err) {
      if (spinner) spinner.style.display = 'none';
      const errMsg = err.message || 'Network error while uploading cover.';
      if (errEl) { errEl.textContent = errMsg; errEl.style.display = 'block'; }
      showToast(errMsg);
    }
  };
  reader.readAsDataURL(file);
};

window.removeNovelCoverImage = () => {
  const previewImg = document.getElementById('nc-cover-preview-img');
  const placeholder = document.getElementById('nc-cover-placeholder');
  const urlInput = document.getElementById('nc-cover-url-input');
  const fileInput = document.getElementById('nc-cover-file-input');
  const removeBtn = document.getElementById('nc-remove-cover-btn');
  const chooseBtnText = document.getElementById('nc-choose-cover-text');
  const errEl = document.getElementById('nc-cover-error');

  novelCreateState.coverUrl = '';
  if (previewImg) {
    previewImg.src = '';
    previewImg.style.display = 'none';
  }
  if (placeholder) placeholder.style.display = 'flex';
  if (urlInput) urlInput.value = '';
  if (fileInput) fileInput.value = '';
  if (removeBtn) removeBtn.style.display = 'none';
  if (chooseBtnText) chooseBtnText.textContent = 'Choose Cover Image';
  if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
  showToast('Cover image removed.');
};

window.removeCoverImage = () => {
  window.removeNovelCoverImage();
};

// Confirmation Summary Modal before Publishing
window.handleNovelCreateSubmit = (isDraft = false) => {
  const titleInput = document.getElementById('nc-title');
  const titleError = document.getElementById('nc-title-error');
  const formError = document.getElementById('nc-form-error');

  if (titleError) titleError.style.display = 'none';
  if (formError) formError.style.display = 'none';

  const title = titleInput?.value?.trim() || '';
  if (!title) {
    if (titleError) {
      titleError.textContent = 'Please enter a novel title.';
      titleError.style.display = 'block';
    }
    if (titleInput) titleInput.focus();
    return;
  }

  // Validate custom category if selected
  if (novelCreateState.isCustomCategory) {
    const customCat = (document.getElementById('nc-custom-category')?.value || '').trim();
    if (!customCat) {
      if (formError) {
        formError.textContent = 'Please enter a name for the new content category.';
        formError.style.display = 'block';
      }
      document.getElementById('nc-custom-category')?.focus();
      return;
    }
    novelCreateState.customCategory = customCat;
  }

  // Validate custom genre if selected
  if (novelCreateState.isCustomGenre) {
    const customGenre = (document.getElementById('nc-custom-genre')?.value || '').trim();
    if (!customGenre) {
      if (formError) {
        formError.textContent = 'Please enter a name for the new genre.';
        formError.style.display = 'block';
      }
      document.getElementById('nc-custom-genre')?.focus();
      return;
    }
    novelCreateState.customGenre = customGenre;
  }

  // If drafting, proceed directly without confirmation modal
  if (isDraft) {
    submitNovelCreateForm(true);
    return;
  }

  // Open Confirmation Summary Modal before live creation
  openNovelConfirmModal();
};

window.openNovelConfirmModal = () => {
  const mount = document.getElementById('nc-confirm-modal-mount');
  if (!mount) return;

  const title = (document.getElementById('nc-title')?.value || '').trim();
  const contentType = novelCreateState.isCustomCategory 
    ? `Custom: ${novelCreateState.customCategory || document.getElementById('nc-custom-category')?.value || 'Other'}` 
    : (novelCreateState.contentType === 'written_novel' ? 'Written Novel' : (novelCreateState.contentType === 'audio_novel' ? 'Audio Novel' : 'Short Story'));
  
  const genre = novelCreateState.isCustomGenre 
    ? `New: ${document.getElementById('nc-custom-genre')?.value || 'Custom'}` 
    : (document.getElementById('nc-genre')?.value || novelCreateState.genre);

  const status = document.getElementById('nc-status')?.value || 'Ongoing';
  const vis = document.getElementById('nc-visibility')?.value || 'public';
  const visLabels = {
    public: 'Public (Any Reader)',
    members: 'All Members',
    selected_members: `Selected Members (${novelCreateState.selectedMembers.size} member${novelCreateState.selectedMembers.size === 1 ? '' : 's'})`,
    private: 'Private / Admin Only'
  };
  const visText = visLabels[vis] || vis;

  const access = document.getElementById('nc-access-permission')?.value || 'admin_only';
  const accessLabels = {
    admin_only: 'Admin Only',
    all_writers: 'All Authorized Writers',
    selected_writers: `Selected Writers (${novelCreateState.selectedWriters.size} writer${novelCreateState.selectedWriters.size === 1 ? '' : 's'})`,
    assigned_writers: `Assigned Writer(s) (${novelCreateState.selectedWriters.size} assigned)`
  };
  const accessText = accessLabels[access] || access;

  mount.innerHTML = `
    <div class="novel-confirm-modal-overlay" onclick="if(event.target === this) closeNovelConfirmModal()">
      <div class="novel-confirm-card" role="dialog" aria-labelledby="nc-modal-title">
        <div class="novel-confirm-header">
          <h3 id="nc-modal-title">Confirm Content Details</h3>
          <p>Please review your settings before creating this content.</p>
        </div>
        <div class="novel-confirm-body">
          <div class="novel-confirm-row">
            <span class="novel-confirm-label">Content Type</span>
            <span class="novel-confirm-val">${escapeHtml(contentType)}</span>
          </div>
          <div class="novel-confirm-row">
            <span class="novel-confirm-label">Title</span>
            <span class="novel-confirm-val" style="color:var(--color-gold-warm, #B8860B);">${escapeHtml(title)}</span>
          </div>
          <div class="novel-confirm-row">
            <span class="novel-confirm-label">Genre</span>
            <span class="novel-confirm-val">${escapeHtml(genre)}</span>
          </div>
          <div class="novel-confirm-row">
            <span class="novel-confirm-label">Publication Status</span>
            <span class="novel-confirm-val">${escapeHtml(status)}</span>
          </div>
          <div class="novel-confirm-row">
            <span class="novel-confirm-label">Visibility</span>
            <span class="novel-confirm-val">${escapeHtml(visText)}</span>
          </div>
          <div class="novel-confirm-row">
            <span class="novel-confirm-label">Access Permissions</span>
            <span class="novel-confirm-val">${escapeHtml(accessText)}</span>
          </div>
        </div>
        <div class="novel-confirm-actions">
          <button type="button" class="btn btn-outline" onclick="closeNovelConfirmModal()">
            Back to Edit
          </button>
          <button type="button" class="btn btn-gold" id="nc-confirm-publish-btn" onclick="confirmAndExecutePublish()">
            Confirm & Create
          </button>
        </div>
      </div>
    </div>
  `;
};

window.closeNovelConfirmModal = () => {
  const mount = document.getElementById('nc-confirm-modal-mount');
  if (mount) mount.innerHTML = '';
};

window.confirmAndExecutePublish = () => {
  closeNovelConfirmModal();
  submitNovelCreateForm(false);
};

// Automatic URL slug transliteration
const TAMIL_MAP = {
  'அ': 'a', 'ஆ': 'aa', 'இ': 'i', 'ஈ': 'ee', 'உ': 'u', 'ஊ': 'oo',
  'எ': 'e', 'ஏ': 'ae', 'ஐ': 'ai', 'ஒ': 'o', 'ஓ': 'oa', 'ஔ': 'au', 'ஃ': 'akh',
  'க': 'k', 'ங': 'ng', 'ச': 's', 'ஞ': 'ny', 'ட': 't', 'ண': 'n',
  'த': 'th', 'ந': 'n', 'ப': 'p', 'ம': 'm', 'ய': 'y', 'ர': 'r',
  'ல': 'l', 'வ': 'v', 'ழ': 'zh', 'ள': 'l', 'ற': 'r', 'ன': 'n',
  'ஜ': 'j', 'ஷ': 'sh', 'ஸ': 's', 'ஹ': 'h', 'க்ஷ': 'ksh'
};

const TAMIL_VOWEL_SIGNS = {
  'ா': 'aa', 'ி': 'i', 'ீ': 'ee', 'ு': 'u', 'ூ': 'oo',
  'ெ': 'e', 'ே': 'ae', 'ை': 'ai', 'ொ': 'o', 'ோ': 'oa', 'ௌ': 'au'
};

export function transliterateTamil(text) {
  if (!text || typeof text !== 'string') return '';
  let res = '';
  const chars = Array.from(text);
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const next = chars[i + 1];
    if (TAMIL_MAP[ch]) {
      if (['அ','ஆ','இ','ஈ','உ','ஊ','எ','ஏ','ஐ','ஒ','ஓ','ஔ','ஃ'].includes(ch)) {
        res += TAMIL_MAP[ch];
      } else {
        const base = TAMIL_MAP[ch];
        if (next === '்') {
          res += base;
          i++;
        } else if (next && TAMIL_VOWEL_SIGNS[next]) {
          res += base + TAMIL_VOWEL_SIGNS[next];
          i++;
        } else {
          res += base + 'a';
        }
      }
    } else if (TAMIL_VOWEL_SIGNS[ch]) {
      res += TAMIL_VOWEL_SIGNS[ch];
    } else if (ch === '்') {
      // stray virama
    } else {
      res += ch;
    }
  }
  return res;
}

export function generateNovelSlug(title) {
  if (!title || typeof title !== 'string') return '';
  const transliterated = transliterateTamil(title.trim());
  let slug = transliterated
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
  if (!slug) {
    slug = title
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/gu, '')
      .replace(/-{2,}/g, '-');
  }
  if (!slug) {
    slug = 'novel-' + Date.now().toString(36);
  }
  return slug;
}

window.autoGenerateSlug = (title) => generateNovelSlug(title);

// Final Submission
window.submitNovelCreateForm = async (isDraft = false) => {
  const titleInput = document.getElementById('nc-title');
  const titleError = document.getElementById('nc-title-error');
  const formError = document.getElementById('nc-form-error');

  if (titleError) titleError.style.display = 'none';
  if (formError) formError.style.display = 'none';

  const title = titleInput?.value?.trim() || '';
  const shortDesc = document.getElementById('nc-short-desc')?.value?.trim() || '';
  const synopsis = document.getElementById('nc-synopsis')?.value?.trim() || '';
  const language = document.getElementById('nc-language')?.value || 'Tamil';
  const cover = document.getElementById('nc-cover-url-input')?.value?.trim() || '/default-cover.jpg';

  let status = document.getElementById('nc-status')?.value || 'Ongoing';
  let visibility = document.getElementById('nc-visibility')?.value || 'public';
  const accessPermission = document.getElementById('nc-access-permission')?.value || 'admin_only';

  const authorSelect = document.getElementById('nc-author-select');
  const authorVal = authorSelect?.value || 'Rudhra Prarthana|2';
  const [authorName, authorIdStr] = authorVal.split('|');
  const authorId = parseInt(authorIdStr || '2', 10);

  // Validation
  if (!title) {
    if (titleError) {
      titleError.textContent = 'Please enter a novel title.';
      titleError.style.display = 'block';
    }
    if (titleInput) titleInput.focus();
    return;
  }

  // Genre resolution
  let genre = document.getElementById('nc-genre')?.value || 'Romance / Drama';
  let newGenre = null;
  if (novelCreateState.isCustomGenre || genre === '__other__') {
    newGenre = (document.getElementById('nc-custom-genre')?.value || '').trim();
    if (!newGenre) {
      if (formError) {
        formError.textContent = 'Please enter a name for the new genre.';
        formError.style.display = 'block';
      }
      return;
    }
    genre = newGenre;
  }

  // Content type resolution
  let contentType = document.getElementById('nc-content-type')?.value || 'written_novel';
  let customCategoryName = null;
  if (novelCreateState.isCustomCategory || contentType === '__other__') {
    customCategoryName = (document.getElementById('nc-custom-category')?.value || '').trim();
    if (!customCategoryName) {
      if (formError) {
        formError.textContent = 'Please enter a name for the new content category.';
        formError.style.display = 'block';
      }
      return;
    }
    contentType = customCategoryName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  }

  // Category string based on content type and status
  let category = customCategoryName || (
    contentType === 'audio_novel' 
      ? 'Audio Novels' 
      : (contentType === 'short_story' ? 'Short Stories' : (status === 'Completed' ? 'Completed Novels' : 'Ongoing Novels'))
  );

  // Scheduled date
  let scheduledAt = null;
  if (status === 'Scheduled') {
    const schedInput = document.getElementById('nc-scheduled-at')?.value;
    if (schedInput) {
      scheduledAt = new Date(schedInput).toISOString();
    }
  }

  // Auto-generate URL slug
  const slug = generateNovelSlug(title);

  // If draft clicked, force draft status and visibility
  if (isDraft) {
    visibility = 'draft';
    status = 'Draft';
  }

  const isPublished = (isDraft || status === 'Draft' || visibility === 'draft') ? 0 : 1;
  const description = synopsis || shortDesc || '';

  // Prevent duplicate submissions
  const submitBtn = document.getElementById('nc-submit-btn');
  const draftBtn = document.getElementById('nc-save-draft-btn');
  if (submitBtn) submitBtn.disabled = true;
  if (draftBtn) draftBtn.disabled = true;

  if (isDraft && draftBtn) {
    draftBtn.textContent = 'Saving Draft...';
  } else if (submitBtn) {
    submitBtn.textContent = 'Creating Novel...';
  }

  // Build full payload
  const payload = {
    slug,
    title,
    author: authorName,
    authorId,
    genre,
    newGenre,
    category,
    contentType,
    customCategoryName,
    status,
    scheduledAt,
    visibility,
    accessPermission,
    isPublished,
    cover,
    description,
    shortDescription: shortDesc,
    language,
    selectedMemberIds: visibility === 'selected_members' ? Array.from(novelCreateState.selectedMembers) : [],
    selectedWriterIds: (accessPermission === 'selected_writers' || accessPermission === 'assigned_writers') ? Array.from(novelCreateState.selectedWriters) : [],
    // Audio specific
    audioVoice: contentType === 'audio_novel' ? (document.getElementById('nc-audio-voice')?.value || authorName) : null,
    duration: contentType === 'audio_novel' ? (document.getElementById('nc-audio-duration')?.value || null) : null,
    youtubeUrl: contentType === 'audio_novel' ? (document.getElementById('nc-audio-youtube-url')?.value || null) : null,
    // Story specific
    storyContent: contentType === 'short_story' ? (document.getElementById('nc-story-content')?.value || '') : null
  };

  try {
    const res = await apiFetch('/api/novels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.success) {
      const errMsg = data.error || 'Failed to create novel in database.';
      if (formError) {
        formError.textContent = errMsg;
        formError.style.display = 'block';
      }
      showToast(errMsg);
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Novel';
      }
      if (draftBtn) {
        draftBtn.disabled = false;
        draftBtn.textContent = 'Save Draft';
      }
      return;
    }

    // Success!
    showToast(isDraft ? `Novel draft "${title}" saved! 📝` : `Novel "${title}" created successfully! 🎉`);

    // Reload admin initial data so all tabs & novel lists update
    await loadAdminInitialData();

    // Route dynamically based on content type:
    if (contentType === 'audio_novel') {
      switchAdminTab('audio');
    } else if (contentType === 'short_story') {
      switchAdminTab('short-stories');
    } else {
      switchAdminTab('novels');
    }
  } catch (err) {
    console.error('Error submitting novel form:', err);
    const errMsg = err.message || 'Network error while creating novel.';
    if (formError) {
      formError.textContent = errMsg;
      formError.style.display = 'block';
    }
    showToast(errMsg);
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Create Novel';
    }
    if (draftBtn) {
      draftBtn.disabled = false;
      draftBtn.textContent = 'Save Draft';
    }
  }
};

// Backwards compatibility alias
window.openCreateNovelModal = () => {
  window.switchAdminTab('novel-create');
};

window.closeNovelModal = () => {
  const modal = document.getElementById('novel-form-modal');
  if (modal) modal.remove();
};

/**
 * Open Edit Novel Modal
 */
window.openEditNovelModal = (novelId) => {
  const nov = adminState.novels.find(n => n.id === novelId);
  if (!nov) return;

  const mount = document.getElementById('novel-modal-mount');
  if (!mount) return;

  mount.innerHTML = `
    <div class="modal-overlay open" id="novel-form-modal" onclick="if(event.target === this) closeNovelModal();">
      <div class="modal-card admin-modal-card">
        <div class="modal-header">
          <h3 class="modal-title">Edit Novel: ${escapeHtml(nov.title)}</h3>
          <button class="modal-close-btn" onclick="closeNovelModal()">✕</button>
        </div>
        <div class="modal-body">
          <form onsubmit="event.preventDefault(); submitEditNovelForm('${nov.id}');">
            <div class="admin-form-grid">
              <div class="form-group">
                <label class="form-label">Novel Title</label>
                <input type="text" id="edit-novel-title" class="form-input" value="${escapeHtml(nov.title)}" required>
              </div>

              <div class="form-group">
                <label class="form-label">Author Name</label>
                <input type="text" id="edit-novel-author" class="form-input" value="${escapeHtml(nov.author || 'Rudhra Prarthana')}" required>
              </div>

              <div class="form-group">
                <label class="form-label">Genre</label>
                <input type="text" id="edit-novel-genre" class="form-input" value="${escapeHtml(nov.genre || '')}">
              </div>

              <div class="form-group">
                <label class="form-label">Publication Status</label>
                <select id="edit-novel-status" class="form-input">
                  <option value="Ongoing" ${nov.status === 'Ongoing' ? 'selected' : ''}>Ongoing</option>
                  <option value="Completed" ${nov.status === 'Completed' ? 'selected' : ''}>Completed</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">Visibility</label>
                <select id="edit-novel-visibility" class="form-input">
                  <option value="public" ${nov.visibility === 'public' ? 'selected' : ''}>Public (Live on Website)</option>
                  <option value="draft" ${nov.visibility === 'draft' ? 'selected' : ''}>Draft (Hidden)</option>
                  <option value="private" ${nov.visibility === 'private' ? 'selected' : ''}>Private (Admin Only)</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">Featured on Homepage?</label>
                <select id="edit-novel-featured" class="form-input">
                  <option value="1" ${nov.featured ? 'selected' : ''}>Yes, Feature on Homepage</option>
                  <option value="0" ${!nov.featured ? 'selected' : ''}>Standard</option>
                </select>
              </div>
            </div>

            <div class="form-group" style="margin-top:14px;">
              <label class="form-label" style="font-weight:700; color:var(--color-navy-deep); font-size:13px; margin-bottom:6px; display:block;">Novel Cover Image</label>
              <div class="edit-cover-clean-card" style="display:flex; gap:16px; align-items:center; background:#FFFDF8; padding:12px; border:1px solid var(--color-border-light); border-radius:8px;">
                <div class="edit-cover-preview-box" id="edit-cover-wrapper" onclick="triggerEditNovelCoverFilePicker()" title="Click to choose or replace cover image">
                  <img id="edit-novel-cover-preview" src="${escapeHtml(nov.cover || '/default-cover.jpg')}" alt="Cover Preview" onerror="this.onerror=null;this.src='/default-cover.jpg';">
                  <div id="edit-cover-spinner" class="novel-cover-uploading-spinner" style="display:none; position:absolute; inset:0; background:rgba(11,31,51,0.7); align-items:center; justify-content:center;">
                    <div class="browser-spinner" style="width:18px; height:18px; margin:0;"></div>
                  </div>
                </div>

                <input type="file" id="edit-cover-file-input" accept="image/jpeg,image/png,image/webp,image/gif" style="display:none;" onchange="handleEditCoverFileSelected(this.files[0])">
                <input type="hidden" id="edit-novel-cover" value="${escapeHtml(nov.cover || '/default-cover.jpg')}">

                <div style="flex:1;">
                  <button type="button" id="edit-choose-cover-btn" class="btn btn-gold btn-sm" onclick="triggerEditNovelCoverFilePicker()" style="display:inline-flex; align-items:center; gap:6px;">
                    ${ADMIN_ICONS.upload}
                    <span id="edit-choose-cover-text">${nov.cover && nov.cover !== '/default-cover.jpg' ? 'Replace Cover Image' : 'Choose Cover Image'}</span>
                  </button>

                  <button type="button" id="edit-remove-cover-btn" class="btn btn-outline btn-sm btn-danger-subtle" onclick="removeEditNovelCoverImage()" style="display:${nov.cover && nov.cover !== '/default-cover.jpg' ? 'inline-flex' : 'none'}; margin-left:8px;">
                    ✕ Remove Image
                  </button>

                  <div id="edit-cover-error" style="display:none; color:#EF4444; font-size:11px; margin-top:6px;"></div>
                </div>
              </div>
            </div>

            <div class="form-group" style="margin-top:14px;">
              <label class="form-label">Description / Synopsis</label>
              <textarea id="edit-novel-desc" class="form-input" rows="4">${escapeHtml(nov.description || '')}</textarea>
            </div>

            <div style="display:flex; gap:12px; margin-top:20px; justify-content:flex-end;">
              <button type="button" class="btn btn-outline" onclick="closeNovelModal()">Cancel</button>
              <button type="submit" id="update-novel-btn" class="btn btn-gold">Save Changes</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;

  window.triggerEditNovelCoverFilePicker = () => {
    const fileInput = document.getElementById('edit-cover-file-input');
    if (fileInput) fileInput.click();
  };

  window.chooseCoverImageForEditNovel = () => {
    window.triggerEditNovelCoverFilePicker();
  };

  window.handleEditCoverFileSelected = async (file) => {
    if (!file) return;
    const errEl = document.getElementById('edit-cover-error');
    const spinner = document.getElementById('edit-cover-spinner');
    const previewImg = document.getElementById('edit-novel-cover-preview');
    const input = document.getElementById('edit-novel-cover');
    const removeBtn = document.getElementById('edit-remove-cover-btn');
    const chooseBtnText = document.getElementById('edit-choose-cover-text');

    if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }

    if (!file.type.startsWith('image/')) {
      const msg = 'Please select a valid image file.';
      if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; }
      showToast(msg);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      const msg = 'Image must be under 10MB.';
      if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; }
      showToast(msg);
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target.result;
      if (previewImg) previewImg.src = dataUrl;
      if (spinner) spinner.style.display = 'flex';

      try {
        const res = await apiFetch('/api/admin/media/upload', {
          method: 'POST',
          body: JSON.stringify({ data: dataUrl, filename: file.name })
        });
        const data = await res.json();
        if (spinner) spinner.style.display = 'none';

        if (!res.ok || !data.success || !data.media?.url) {
          const errMsg = data.error || 'Failed to upload cover.';
          if (errEl) { errEl.textContent = errMsg; errEl.style.display = 'block'; }
          showToast(errMsg);
          return;
        }

        if (input) {
          input.value = data.media.url;
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
        if (previewImg) previewImg.src = data.media.url;
        if (removeBtn) removeBtn.style.display = 'inline-flex';
        if (chooseBtnText) chooseBtnText.textContent = 'Replace Cover Image';
        showToast('Cover image updated! ✨');
      } catch (err) {
        if (spinner) spinner.style.display = 'none';
        const errMsg = err.message || 'Upload failed.';
        if (errEl) { errEl.textContent = errMsg; errEl.style.display = 'block'; }
        showToast(errMsg);
      }
    };
    reader.readAsDataURL(file);
  };

  window.removeEditNovelCoverImage = () => {
    const previewImg = document.getElementById('edit-novel-cover-preview');
    const input = document.getElementById('edit-novel-cover');
    const fileInput = document.getElementById('edit-cover-file-input');
    const removeBtn = document.getElementById('edit-remove-cover-btn');
    const chooseBtnText = document.getElementById('edit-choose-cover-text');
    const errEl = document.getElementById('edit-cover-error');

    if (previewImg) previewImg.src = '/default-cover.jpg';
    if (input) {
      input.value = '/default-cover.jpg';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (fileInput) fileInput.value = '';
    if (removeBtn) removeBtn.style.display = 'none';
    if (chooseBtnText) chooseBtnText.textContent = 'Choose Cover Image';
    if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
    showToast('Cover image reset to default.');
  };

  window.submitEditNovelForm = async (id) => {
    const title = document.getElementById('edit-novel-title')?.value?.trim();
    const author = document.getElementById('edit-novel-author')?.value?.trim();
    const genre = document.getElementById('edit-novel-genre')?.value?.trim();
    const status = document.getElementById('edit-novel-status')?.value;
    const visibility = document.getElementById('edit-novel-visibility')?.value;
    const featured = document.getElementById('edit-novel-featured')?.value === '1';
    const cover = document.getElementById('edit-novel-cover')?.value?.trim();
    const description = document.getElementById('edit-novel-desc')?.value?.trim();

    try {
      const res = await apiFetch(`/api/novels/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          title, author, genre, status, visibility,
          isPublished: visibility === 'public' ? 1 : 0,
          featured, cover, description
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.error || 'Failed to update novel.');
        return;
      }

      showToast(`Novel "${title}" updated successfully!`);
      closeNovelModal();
      await loadAdminInitialData();
      renderActiveAdminTab();
    } catch (err) {
      showToast('Error updating novel: ' + err.message);
    }
  };
};

/**
 * Delete Novel Prompt
 */
window.deleteNovelPrompt = async (id, title) => {
  if (!confirm(`Are you sure you want to permanently delete novel "${title}" and all its episodes?\n\nThis action cannot be undone.`)) {
    return;
  }

  try {
    const res = await apiFetch(`/api/novels/${id}`, { method: 'DELETE' });
    showToast(`Novel "${title}" deleted.`);
    await loadAdminInitialData();
    renderActiveAdminTab();
  } catch (err) {
    showToast('Error deleting novel: ' + err.message);
  }
};

/* ========================================================
   4b. AUDIO NOVELS MANAGEMENT TAB
   ======================================================== */
export async function renderAudioNovelsTab(canvas) {
  // Reload latest audio novels list from backend
  try {
    const res = await apiFetch('/api/admin/audio-novels');
    if (res.ok) {
      const data = await res.json();
      adminState.audioNovels = data.audioNovels || [];
      const badge = document.getElementById('nav-audio-count');
      if (badge) badge.textContent = adminState.audioNovels.length;
    }
  } catch (err) {
    console.warn('Failed to refresh audio novels:', err);
  }

  // Ensure default view mode and selected novel
  if (!adminState.audioViewMode) adminState.audioViewMode = 'catalog';
  if (!adminState.selectedAudioNovelId && adminState.audioNovels.length > 0) {
    adminState.selectedAudioNovelId = adminState.audioNovels[0].id;
  }

  const selectedNovel = adminState.audioNovels.find(a => String(a.id) === String(adminState.selectedAudioNovelId)) || adminState.audioNovels[0] || null;

  canvas.innerHTML = `
    <div class="admin-page-header">
      <div class="admin-page-title-group">
        <h1 class="admin-page-title">Audio Novels Management</h1>
        <p class="admin-page-subtitle">Chapter-Wise & Episode-Wise Audio Management — Upload audio files, embed YouTube videos, and manage hierarchical playback.</p>
      </div>
      <div class="admin-page-actions" style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
        <button type="button" class="btn ${adminState.audioViewMode === 'catalog' ? 'btn-gold' : 'btn-outline'} btn-sm" onclick="switchAudioViewMode('catalog')">
          📚 Catalog (${adminState.audioNovels.length})
        </button>
        <button type="button" class="btn ${adminState.audioViewMode === 'tree' ? 'btn-gold' : 'btn-outline'} btn-sm" onclick="switchAudioViewMode('tree')">
          📖 Chapters & Tree
        </button>
        <button type="button" class="btn btn-gold btn-sm" onclick="openAudioNovelModal()">
          + Add Audio Novel
        </button>
        ${adminState.audioViewMode === 'tree' && selectedNovel ? `
          <button type="button" class="btn btn-sm" onclick="openAudioEpisodeModal({ novelId: '${selectedNovel.id}', isChapter: true })" style="background:var(--color-navy-deep); color:#FFF;">
            + Add Chapter
          </button>
          <button type="button" class="btn btn-gold btn-sm" onclick="openAudioEpisodeModal({ novelId: '${selectedNovel.id}' })">
            + Add Episode
          </button>
        ` : ''}
      </div>
    </div>

    ${adminState.audioViewMode === 'catalog' ? renderAudioCatalogView() : renderAudioTreeView(selectedNovel)}

    <!-- Modal mount container for Add/Edit Audio Novel and Audio Episodes -->
    <div id="audio-modal-mount"></div>
  `;

  window.switchAudioViewMode = (mode) => {
    adminState.audioViewMode = mode;
    const canvas = document.getElementById('admin-main-canvas');
    if (canvas) renderAudioNovelsTab(canvas);
  };

  window.onSelectAudioNovelForTree = (novelId) => {
    adminState.selectedAudioNovelId = novelId;
    loadAndRenderAudioTree(novelId);
  };

  if (adminState.audioViewMode === 'tree' && selectedNovel) {
    loadAndRenderAudioTree(selectedNovel.id);
  }
}

function renderAudioCatalogView() {
  return `
    <div class="admin-filters-bar">
      <div class="admin-search-wrap">
        <span class="admin-search-icon" aria-hidden="true">🔍</span>
        <input type="text" id="audio-search-input" class="admin-search-input" 
               placeholder="Search by title, description, or author..." 
               oninput="filterAudioNovelsTable(this.value)">
      </div>
      <select id="audio-status-filter" class="admin-filter-select" onchange="filterAudioNovelsByFilters()">
        <option value="all">All Statuses</option>
        <option value="published">Published</option>
        <option value="draft">Draft</option>
      </select>
    </div>

    <div class="admin-table-wrapper">
      <table class="admin-table">
        <thead>
          <tr>
            <th>Audio Novel</th>
            <th>Chapters & Episodes</th>
            <th>Author / Voice</th>
            <th>Status</th>
            <th>Views</th>
            <th style="text-align:right;">Actions</th>
          </tr>
        </thead>
        <tbody id="audio-novels-table-body">
          ${adminState.audioNovels.length === 0 ? `
            <tr>
              <td colspan="6" style="text-align:center; padding:48px 16px; color:var(--color-text-muted);">
                <div style="font-size:32px; margin-bottom:8px;">🎧</div>
                <div style="font-size:16px; font-weight:600; color:var(--color-navy-deep); margin-bottom:6px;">No audio novels created yet</div>
                <div style="font-size:13px; margin-bottom:16px;">Add your first audio novel with chapters, episodes, audio uploads, and YouTube links.</div>
                <button type="button" class="btn btn-gold btn-sm" onclick="openAudioNovelModal()">+ Add Audio Novel</button>
              </td>
            </tr>
          ` : adminState.audioNovels.map(an => renderAudioNovelCatalogRow(an)).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderAudioNovelCatalogRow(an) {
  const isPub = an.status === 'published' || an.isPublished;
  const chCount = an.chaptersCount || 0;
  const epCount = an.episodesCount || an.totalEpisodes || 0;

  return `
    <tr class="audio-table-row" data-status="${escapeHtml(an.status)}">
      <td>
        <div class="admin-novel-cell">
          <img src="${an.cover || '/default-cover.jpg'}" class="admin-novel-thumb" alt="${escapeHtml(an.title)}" onerror="this.src='/default-cover.jpg'">
          <div>
            <div class="admin-novel-title">${escapeHtml(an.title)}</div>
            <div class="admin-novel-meta">Slug: <code>${escapeHtml(an.slug || an.id)}</code></div>
          </div>
        </div>
      </td>
      <td>
        <div style="font-weight:700; color:#1A0B2E; font-size:13.5px;">
          📖 ${chCount} ${chCount === 1 ? 'Chapter' : 'Chapters'}
        </div>
        <div style="font-size:12px; color:#64748B; margin-top:2px;">
          🎧 ${epCount} ${epCount === 1 ? 'Episode' : 'Episodes'}
        </div>
      </td>
      <td>
        <div style="font-size:13px; font-weight:600; color:var(--color-navy-deep);">✍️ ${escapeHtml(an.author || 'Rudhra Prarthana')}</div>
        <div style="font-size:11.5px; color:#64748B;">🎙️ ${escapeHtml(an.voice || an.author || 'Rudhra Prarthana')}</div>
      </td>
      <td>
        <button type="button" class="status-pill ${isPub ? 'published' : 'draft'}" 
                style="cursor:pointer; border:none;" 
                onclick="toggleAudioNovelStatus('${an.id}', '${an.status}')" 
                title="Click to toggle publish status">
          ${isPub ? '🟢 Published' : '🔒 Draft'}
        </button>
      </td>
      <td>${Number(an.views || 0).toLocaleString()}</td>
      <td style="text-align:right;">
        <div class="admin-action-btn-group">
          <button type="button" class="btn btn-gold btn-xs" onclick="adminState.selectedAudioNovelId = '${an.id}'; switchAudioViewMode('tree');" title="Open Chapter & Episode Tree">
            📖 Tree
          </button>
          <a href="#audio?novel=${encodeURIComponent(an.slug || an.id)}" class="btn btn-outline btn-xs" target="_blank" title="Listen Public Playback">
            ▶ Play
          </a>
          <button type="button" class="btn btn-outline btn-xs" onclick="openAudioNovelModal('${an.id}')" title="Edit Novel Info">
            ✏️
          </button>
          <button type="button" class="btn btn-outline btn-xs" onclick="deleteAudioNovelPrompt('${an.id}')" style="color:#DC2626; border-color:#FECACA;" title="Delete Novel">
            🗑️
          </button>
        </div>
      </td>
    </tr>
  `;
}

function renderAudioTreeView(selectedNovel) {
  if (!selectedNovel) {
    return `
      <div style="text-align:center; padding:60px 20px; background:#FFF; border-radius:12px; border:1px solid #E2E8F0;">
        <div style="font-size:32px; margin-bottom:12px;">🎧</div>
        <h3>No Audio Novels Found</h3>
        <p style="color:#64748B; margin-bottom:20px;">Please create an audio novel first before managing chapters and episodes.</p>
        <button type="button" class="btn btn-gold btn-sm" onclick="openAudioNovelModal()">+ Add Audio Novel</button>
      </div>
    `;
  }

  return `
    <!-- Audio Novel Selector Bar -->
    <div class="admin-selector-bar" style="margin-bottom:20px; background:#FFFDF8; border:1px solid rgba(200,155,60,0.3); border-radius:10px; padding:14px 18px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
      <div style="display:flex; align-items:center; gap:12px; flex:1; min-width:280px;">
        <img src="${selectedNovel.cover || '/default-cover.jpg'}" alt="" style="width:42px; height:54px; object-fit:cover; border-radius:6px; border:1px solid #E2E8F0;" onerror="this.src='/default-cover.jpg';">
        <div style="flex:1;">
          <div style="display:flex; align-items:center; gap:8px;">
            <label for="audio-novel-selector" style="font-size:12px; font-weight:700; color:#64748B; text-transform:uppercase;">Selected Audio Novel:</label>
            <span class="status-pill ${selectedNovel.status === 'published' ? 'published' : 'draft'}" style="font-size:10px;">${selectedNovel.status}</span>
          </div>
          <select id="audio-novel-selector" class="form-input" style="font-weight:700; font-size:14px; margin-top:4px;" onchange="onSelectAudioNovelForTree(this.value)">
            ${adminState.audioNovels.map(an => `
              <option value="${an.id}" ${an.id === selectedNovel.id ? 'selected' : ''}>${escapeHtml(an.title)} (${an.chaptersCount || 0} Ch, ${an.episodesCount || 0} Ep)</option>
            `).join('')}
          </select>
        </div>
      </div>

      <div style="display:flex; gap:8px; align-items:center;">
        <button type="button" class="btn btn-outline btn-sm" onclick="openAudioNovelModal('${selectedNovel.id}')">✏️ Edit Novel Info</button>
        <a href="#audio?novel=${encodeURIComponent(selectedNovel.id)}" target="_blank" class="btn btn-outline btn-sm">▶ Reader View</a>
        <button type="button" class="btn btn-gold btn-sm" onclick="openAudioEpisodeModal({ novelId: '${selectedNovel.id}', isChapter: true })">+ Add Chapter</button>
        <button type="button" class="btn btn-sm" onclick="openAudioEpisodeModal({ novelId: '${selectedNovel.id}' })" style="background:var(--color-navy-deep); color:#FFF;">+ Add Episode</button>
      </div>
    </div>

    <!-- Tree Canvas -->
    <div id="audio-tree-container">
      <div style="text-align:center; padding:40px; color:#64748B;">
        Loading chapters & episodes tree...
      </div>
    </div>
  `;
}

async function loadAndRenderAudioTree(novelId) {
  const container = document.getElementById('audio-tree-container');
  if (!container) return;

  try {
    const res = await apiFetch(`/api/admin/audio-episodes?novel=${encodeURIComponent(novelId)}`);
    const data = await res.json();
    const chapters = data.episodes || [];

    if (chapters.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding:60px 20px; background:#FFFDF8; border:1px dashed var(--color-border); border-radius:12px;">
          <div style="font-size:2.5rem; margin-bottom:12px;">📖</div>
          <h3 style="font-family:var(--font-serif); color:var(--color-navy-deep); margin:0 0 8px;">No Chapters or Episodes Created Yet</h3>
          <p style="color:var(--color-text-muted); font-size:14px; max-width:480px; margin:0 auto 18px;">
            Organize this audio novel using the standard hierarchy: Chapters (e.g. Chapter 1), Episodes (e.g. Episode 1.1), and Sub-episodes (e.g. Sub-episode 1.1.1).
          </p>
          <div style="display:flex; justify-content:center; gap:10px;">
            <button type="button" class="btn btn-gold btn-sm" onclick="openAudioEpisodeModal({ novelId: '${novelId}', isChapter: true })">+ Add Chapter 1</button>
            <button type="button" class="btn btn-outline btn-sm" onclick="openAudioEpisodeModal({ novelId: '${novelId}' })">+ Add Episode</button>
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="admin-audio-tree" style="display:flex; flex-direction:column; gap:14px;">
        ${chapters.map(ch => renderAudioChapterTreeCard(ch, novelId)).join('')}
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div style="color:#EF4444; padding:20px; background:#FEF2F2; border-radius:8px;">Failed to load tree: ${err.message}</div>`;
  }
}

function renderAudioChapterTreeCard(ch, novelId) {
  const subs = ch.subEpisodes || [];
  const isPub = ch.status === 'published';
  const hasAudio = Boolean(ch.audioFileUrl);
  const hasYt = Boolean(ch.youtubeVideoId || ch.youtubeUrl);

  let mediaBadge = '';
  if (hasAudio && hasYt) mediaBadge = '<span class="admin-source-badge" style="background:#701A75; color:#FFF; font-size:10px; padding:2px 6px;">🎧+🎥 Both</span>';
  else if (hasYt) mediaBadge = '<span class="admin-source-badge youtube" style="font-size:10px; padding:2px 6px;">🎥 YouTube</span>';
  else if (hasAudio) mediaBadge = '<span class="admin-source-badge audio_file" style="font-size:10px; padding:2px 6px;">🎧 Audio</span>';

  return `
    <div class="admin-audio-chapter-card" style="background:#FFF; border:1px solid #E2E8F0; border-radius:10px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.04);">
      <!-- Chapter Header -->
      <div style="background:#F8FAFC; padding:12px 16px; border-bottom:1px solid #E2E8F0; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
        <div style="display:flex; align-items:center; gap:12px;">
          <span class="admin-audio-chapter-badge">Chapter ${escapeHtml(ch.chapterNum || ch.episodeNumber)}</span>
          <div>
            <div style="font-weight:700; font-size:15px; color:#0B1F33;">${escapeHtml(ch.title)}</div>
            <div style="font-size:11.5px; color:#64748B; margin-top:2px; display:flex; align-items:center; gap:8px;">
              ${mediaBadge}
              ${ch.audioDuration ? `<span>⏱ ${escapeHtml(ch.audioDuration)}</span>` : ''}
              <span>•</span>
              <button type="button" class="status-pill ${ch.status === 'published' ? 'published' : (ch.status === 'scheduled' ? 'scheduled' : 'draft')}" 
                      style="font-size:10px; border:none; cursor:pointer;" 
                      onclick="toggleAudioEpisodeStatusPrompt(${ch.id})">
                ${ch.status}
              </button>
              <span style="font-weight:700; color:#B88635;">(${subs.length} ${subs.length === 1 ? 'Episode' : 'Episodes'})</span>
            </div>
          </div>
        </div>

        <div style="display:flex; gap:6px; align-items:center;">
          <button type="button" class="btn btn-gold btn-xs" onclick="openAudioEpisodeModal({ novelId: '${novelId}', parentId: ${ch.id} })" title="Add Episode to this Chapter">
            ➕ Add Episode
          </button>
          ${(hasAudio || hasYt) ? `
            <button type="button" class="btn btn-outline btn-xs" onclick="previewAudioEpisodeModal(${ch.id})" title="Preview Playback">
              👁️ Preview
            </button>
          ` : ''}
          <button type="button" class="btn btn-outline btn-xs" onclick="openAudioEpisodeModal({ novelId: '${novelId}', episodeId: ${ch.id} })" title="Edit Chapter">
            ✏️ Edit
          </button>
          <button type="button" class="btn btn-outline btn-xs" onclick="deleteAudioEpisodePrompt(${ch.id})" style="color:#DC2626;" title="Delete Chapter">
            🗑️
          </button>
        </div>
      </div>

      <!-- Episodes list inside chapter -->
      ${subs.length > 0 ? `
        <div style="padding:8px 16px; background:#FAFAFA;">
          ${subs.map(ep => renderAudioEpisodeItemRow(ep, novelId)).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

function renderAudioEpisodeItemRow(ep, novelId) {
  const subEpisodes = ep.subEpisodes || [];
  const hasAudio = Boolean(ep.audioFileUrl);
  const hasYt = Boolean(ep.youtubeVideoId || ep.youtubeUrl);

  let mediaBadge = '';
  if (hasAudio && hasYt) mediaBadge = '<span class="admin-source-badge" style="background:#701A75; color:#FFF; font-size:10px; padding:2px 6px;">🎧+🎥 Both</span>';
  else if (hasYt) mediaBadge = '<span class="admin-source-badge youtube" style="font-size:10px; padding:2px 6px;">🎥 YouTube</span>';
  else if (hasAudio) mediaBadge = '<span class="admin-source-badge audio_file" style="font-size:10px; padding:2px 6px;">🎧 Audio</span>';

  return `
    <div style="background:#FFF; border:1px solid #E2E8F0; border-radius:8px; margin:6px 0; overflow:hidden;">
      <div style="padding:10px 14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
        <div style="display:flex; align-items:center; gap:10px;">
          <span class="admin-audio-badge-sm">Episode ${escapeHtml(ep.episodeNumber)}</span>
          <div>
            <div style="font-weight:600; font-size:13.5px; color:#0B1F33;">${escapeHtml(ep.title)}</div>
            <div style="font-size:11px; color:#64748B; display:flex; align-items:center; gap:6px; margin-top:2px;">
              ${mediaBadge}
              ${ep.audioDuration ? `<span>⏱ ${escapeHtml(ep.audioDuration)}</span>` : ''}
              <span>•</span>
              <button type="button" class="status-pill ${ep.status === 'published' ? 'published' : (ep.status === 'scheduled' ? 'scheduled' : 'draft')}" 
                      style="font-size:9.5px; border:none; cursor:pointer;" 
                      onclick="toggleAudioEpisodeStatusPrompt(${ep.id})">
                ${ep.status}
              </button>
              ${subEpisodes.length > 0 ? `<span style="color:#701A75; font-weight:700;">(${subEpisodes.length} Sub-episodes)</span>` : ''}
            </div>
          </div>
        </div>

        <div style="display:flex; gap:6px; align-items:center;">
          <button type="button" class="btn btn-outline btn-xs" onclick="openAudioEpisodeModal({ novelId: '${novelId}', parentId: ${ep.id} })" style="background:#FDF4FF; color:#701A75; border-color:#F5D0FE;" title="Add Sub-episode">
            ➕ Sub-Ep
          </button>
          ${(hasAudio || hasYt) ? `
            <button type="button" class="btn btn-outline btn-xs" onclick="previewAudioEpisodeModal(${ep.id})" title="Preview Playback">
              👁️ Preview
            </button>
          ` : ''}
          <button type="button" class="btn btn-outline btn-xs" onclick="openAudioEpisodeModal({ novelId: '${novelId}', episodeId: ${ep.id} })" title="Edit Episode">
            ✏️
          </button>
          <button type="button" class="btn btn-outline btn-xs" onclick="deleteAudioEpisodePrompt(${ep.id})" style="color:#DC2626;" title="Delete Episode">
            🗑️
          </button>
        </div>
      </div>

      <!-- Nested Sub-episodes (Level 2) -->
      ${subEpisodes.length > 0 ? `
        <div style="padding:6px 14px 10px; background:#FAF5FF; border-top:1px dashed #E9D5FF; margin-left:20px;">
          ${subEpisodes.map(sub => renderAudioSubEpisodeItemRow(sub, novelId)).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

function renderAudioSubEpisodeItemRow(sub, novelId) {
  const hasAudio = Boolean(sub.audioFileUrl);
  const hasYt = Boolean(sub.youtubeVideoId || sub.youtubeUrl);

  let mediaBadge = '';
  if (hasAudio && hasYt) mediaBadge = '<span class="admin-source-badge" style="background:#701A75; color:#FFF; font-size:9px; padding:1px 5px;">🎧+🎥 Both</span>';
  else if (hasYt) mediaBadge = '<span class="admin-source-badge youtube" style="font-size:9px; padding:1px 5px;">🎥 YouTube</span>';
  else if (hasAudio) mediaBadge = '<span class="admin-source-badge audio_file" style="font-size:9px; padding:1px 5px;">🎧 Audio</span>';

  return `
    <div style="padding:6px 10px; background:#FFF; border:1px solid #E9D5FF; border-radius:6px; margin:4px 0; display:flex; justify-content:space-between; align-items:center;">
      <div style="display:flex; align-items:center; gap:8px;">
        <span class="admin-audio-badge-sm" style="background:#701A75; font-size:9.5px;">Sub-Ep ${escapeHtml(sub.episodeNumber)}</span>
        <span style="font-size:12.5px; font-weight:600; color:#0B1F33;">${escapeHtml(sub.title)}</span>
        ${mediaBadge}
        ${sub.audioDuration ? `<span style="font-size:10px; color:#64748B;">⏱ ${escapeHtml(sub.audioDuration)}</span>` : ''}
      </div>

      <div style="display:flex; gap:4px; align-items:center;">
        ${(hasAudio || hasYt) ? `
          <button type="button" class="btn btn-outline btn-xs" onclick="previewAudioEpisodeModal(${sub.id})" title="Preview">👁️</button>
        ` : ''}
        <button type="button" class="btn btn-outline btn-xs" onclick="openAudioEpisodeModal({ novelId: '${novelId}', episodeId: ${sub.id} })" title="Edit">✏️</button>
        <button type="button" class="btn btn-outline btn-xs" onclick="deleteAudioEpisodePrompt(${sub.id})" style="color:#DC2626;" title="Delete">🗑️</button>
      </div>
    </div>
  `;
}


window.openAudioNovelModal = (audioNovelId = null) => {
  const an = audioNovelId ? adminState.audioNovels.find(a => String(a.id) === String(audioNovelId)) : null;
  const isEdit = Boolean(an);

  const mount = document.getElementById('audio-modal-mount');
  if (!mount) return;

  const currentSourceType = an?.sourceType || 'youtube';

  mount.innerHTML = `
    <div class="modal-overlay open" id="audio-form-modal" onclick="if(event.target === this) closeAudioNovelModal();">
      <div class="modal-card admin-modal-card" style="max-width:680px;">
        <div class="modal-header">
          <h3 class="modal-title">${isEdit ? `Edit Audio Novel: ${escapeHtml(an.title)}` : '+ Add New Audio Novel'}</h3>
          <button class="modal-close-btn" onclick="closeAudioNovelModal()">✕</button>
        </div>
        <div class="modal-body">
          <form id="audio-novel-form" onsubmit="event.preventDefault(); submitAudioNovelForm('${an?.id || ''}');">
            <div id="audio-form-error" class="novel-form-banner-error" style="display:none; margin-bottom:16px;"></div>

            <!-- Basic Info Grid -->
            <div class="admin-form-grid">
              <div class="form-group" style="grid-column: 1 / -1;">
                <label class="form-label" style="font-weight:700;">Audio Novel Title <span style="color:#EF4444;">*</span></label>
                <input type="text" id="an-title" class="form-input" value="${escapeHtml(an?.title || '')}" placeholder="e.g. Maaya Nadhi Theeram — Part 1" required>
              </div>

              <div class="form-group">
                <label class="form-label">Link to Novel (Optional)</label>
                <select id="an-novel-id" class="form-input">
                  <option value="">None / Standalone Audio Novel</option>
                  ${adminState.novels.map(n => `
                    <option value="${n.id}" ${an?.novelId === n.id ? 'selected' : ''}>${escapeHtml(n.title)}</option>
                  `).join('')}
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">Language</label>
                <select id="an-language" class="form-input">
                  <option value="Tamil" ${(!an || an.language === 'Tamil') ? 'selected' : ''}>Tamil</option>
                  <option value="English" ${an?.language === 'English' ? 'selected' : ''}>English</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">Episode / Part Number</label>
                <input type="number" id="an-part-number" class="form-input" value="${an?.partNumber || 1}" min="1" step="1">
              </div>

              <div class="form-group">
                <label class="form-label">Episode Label</label>
                <input type="text" id="an-episode-number" class="form-input" value="${escapeHtml(an?.episodeNumber || 'Part 1')}" placeholder="e.g. Part 1, Full Audio">
              </div>

              <div class="form-group">
                <label class="form-label">Publication Status</label>
                <select id="an-status" class="form-input">
                  <option value="published" ${(!an || an.status === 'published') ? 'selected' : ''}>Published (Public)</option>
                  <option value="draft" ${an?.status === 'draft' ? 'selected' : ''}>Draft (Admin Only)</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">Duration (Optional)</label>
                <input type="text" id="an-duration" class="form-input" value="${escapeHtml(an?.audioDuration || '')}" placeholder="e.g. 24:15">
              </div>
            </div>

            <!-- Description -->
            <div class="form-group" style="margin-top:14px;">
              <label class="form-label">Description / Introduction</label>
              <textarea id="an-desc" class="form-input" rows="3" placeholder="Short description of this audio novel or episode...">${escapeHtml(an?.description || '')}</textarea>
            </div>

            <!-- Cover Image Picker -->
            <div class="form-group" style="margin-top:14px;">
              <label class="form-label" style="font-weight:700;">Cover Image</label>
              <div class="edit-cover-clean-card" style="display:flex; gap:16px; align-items:center; background:#FFFDF8; padding:12px; border:1px solid var(--color-border-light); border-radius:8px;">
                <div class="edit-cover-preview-box" onclick="document.getElementById('an-cover-file-input').click();" title="Click to upload cover image" style="position:relative; width:80px; height:80px; border-radius:8px; overflow:hidden; border:1px solid #CBD5E1; cursor:pointer;">
                  <img id="an-cover-preview-img" src="${an?.cover || '/default-cover.jpg'}" alt="Cover" style="width:100%; height:100%; object-fit:cover;" onerror="this.src='/default-cover.jpg'">
                </div>

                <input type="file" id="an-cover-file-input" accept="image/jpeg,image/png,image/webp" style="display:none;" onchange="handleAudioCoverFileSelected(this.files[0])">
                <input type="hidden" id="an-cover-url" value="${an?.cover || ''}">

                <div style="flex:1;">
                  <button type="button" class="btn btn-gold btn-sm" onclick="document.getElementById('an-cover-file-input').click();" style="display:inline-flex; align-items:center; gap:6px;">
                    ${ADMIN_ICONS.upload}
                    <span id="an-choose-cover-text">${an?.cover ? 'Replace Cover Image' : 'Choose Cover Image'}</span>
                  </button>
                  <button type="button" id="an-remove-cover-btn" class="btn btn-outline btn-sm" onclick="removeAudioCoverImage()" style="display:${an?.cover ? 'inline-flex' : 'none'}; margin-left:8px; color:#DC2626;">
                    ✕ Remove
                  </button>
                  <div style="font-size:11.5px; color:#64748B; margin-top:4px;">JPG, PNG, WebP up to 10MB</div>
                </div>
              </div>
            </div>

            <!-- Audio Source Selector: YouTube vs Direct Audio -->
            <div class="form-group" style="margin-top:20px; padding:16px; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:10px;">
              <label class="form-label" style="font-weight:700; font-size:14px; margin-bottom:10px; display:block;">
                Audio Source Selection <span style="color:#EF4444;">*</span>
              </label>
              
              <div style="display:flex; gap:12px; margin-bottom:16px;">
                <label style="display:inline-flex; align-items:center; gap:8px; cursor:pointer; font-size:13.5px; font-weight:600; padding:8px 14px; background:#FFFFFF; border:1px solid #CBD5E1; border-radius:8px;">
                  <input type="radio" name="an-source-type" value="youtube" ${currentSourceType === 'youtube' ? 'checked' : ''} onchange="toggleAudioSourceSection('youtube')">
                  <span>▶ YouTube Link</span>
                </label>
                <label style="display:inline-flex; align-items:center; gap:8px; cursor:pointer; font-size:13.5px; font-weight:600; padding:8px 14px; background:#FFFFFF; border:1px solid #CBD5E1; border-radius:8px;">
                  <input type="radio" name="an-source-type" value="audio_file" ${currentSourceType === 'audio_file' ? 'checked' : ''} onchange="toggleAudioSourceSection('audio_file')">
                  <span>🎧 Upload Audio File</span>
                </label>
              </div>

              <!-- YouTube Link Field (Visible when YouTube is selected) -->
              <div id="an-youtube-container" style="display:${currentSourceType === 'youtube' ? 'block' : 'none'};">
                <label class="form-label" style="font-weight:600;">Paste YouTube video URL</label>
                <input type="url" id="an-youtube-url" class="form-input" 
                       value="${escapeHtml(an?.youtubeUrl || '')}" 
                       placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..." 
                       oninput="handleYouTubeUrlInput(this.value)">
                <div style="font-size:12px; color:#64748B; margin-top:4px;">
                  Accepts standard YouTube video URLs, youtu.be, and Shorts.
                </div>

                <!-- Live YouTube Embed Preview -->
                <div id="an-youtube-preview-box" style="margin-top:12px; display:${an?.youtubeVideoId ? 'block' : 'none'};">
                  <div style="font-size:12px; font-weight:600; color:#334155; margin-bottom:6px;">Live Video Preview:</div>
                  <div style="position:relative; width:100%; aspect-ratio:16/9; background:#000; border-radius:8px; overflow:hidden;">
                    <iframe id="an-youtube-preview-iframe" src="${an?.youtubeVideoId ? `https://www.youtube-nocookie.com/embed/${an.youtubeVideoId}?rel=0` : ''}" style="position:absolute; inset:0; width:100%; height:100%; border:0;" allowfullscreen></iframe>
                  </div>
                  <div style="font-size:11px; color:#64748B; margin-top:6px; font-style:italic;">
                    Note: Playback depends on video availability and YouTube embedding permissions.
                  </div>
                </div>
              </div>

              <!-- Direct Audio Upload Field (Visible when Direct Audio is selected) -->
              <div id="an-audio-file-container" style="display:${currentSourceType === 'audio_file' ? 'block' : 'none'};">
                <label class="form-label" style="font-weight:600;">Upload Audio File (MP3, M4A, WAV)</label>
                <div class="admin-audio-upload-dropzone" onclick="document.getElementById('an-direct-audio-file').click();">
                  <div style="font-size:28px; margin-bottom:6px;">🎧</div>
                  <div style="font-size:13.5px; font-weight:600; color:var(--color-navy-deep);" id="an-audio-filename-display">
                    ${an?.audioFileUrl ? `Existing File: ${an.audioFileUrl.split('/').pop()}` : 'Click to select audio file from your computer'}
                  </div>
                  <div style="font-size:12px; color:#64748B; margin-top:4px;">
                    Supports MP3, M4A, WAV up to 50MB. Stored directly on server storage.
                  </div>
                </div>

                <input type="file" id="an-direct-audio-file" accept="audio/mpeg,audio/mp3,audio/m4a,audio/x-m4a,audio/wav,audio/aac" style="display:none;" onchange="handleDirectAudioFileSelected(this.files[0])">
                <input type="hidden" id="an-audio-file-url" value="${an?.audioFileUrl || ''}">
                <input type="hidden" id="an-audio-base64-data" value="">

                <!-- Upload Progress & Status -->
                <div id="an-audio-progress-wrap" style="display:none; margin-top:12px;">
                  <div style="display:flex; justify-content:space-between; font-size:12px; color:#475569; margin-bottom:4px;">
                    <span id="an-audio-status-text">Processing audio file...</span>
                    <span id="an-audio-percent">0%</span>
                  </div>
                  <div class="admin-audio-progress-bar">
                    <div id="an-audio-progress-fill" class="admin-audio-progress-fill"></div>
                  </div>
                </div>

                <!-- Audio Playback Preview -->
                <div id="an-audio-preview-wrap" style="margin-top:14px; display:${an?.audioFileUrl ? 'block' : 'none'};">
                  <div style="font-size:12px; font-weight:600; color:#334155; margin-bottom:4px;">Audio File Preview:</div>
                  <audio id="an-audio-preview-player" controls style="width:100%;" src="${an?.audioFileUrl || ''}"></audio>
                </div>
              </div>
            </div>

            <!-- Modal Action Buttons -->
            <div style="display:flex; gap:12px; margin-top:24px; justify-content:flex-end;">
              <button type="button" class="btn btn-outline" onclick="closeAudioNovelModal()">Cancel</button>
              <button type="submit" id="an-submit-btn" class="btn btn-gold">
                ${isEdit ? 'Save Changes' : '+ Create Audio Novel'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;

  window.toggleAudioSourceSection = (type) => {
    const ytContainer = document.getElementById('an-youtube-container');
    const audioContainer = document.getElementById('an-audio-file-container');
    if (ytContainer) ytContainer.style.display = type === 'youtube' ? 'block' : 'none';
    if (audioContainer) audioContainer.style.display = type === 'audio_file' ? 'block' : 'none';
  };

  window.handleYouTubeUrlInput = (url) => {
    const previewBox = document.getElementById('an-youtube-preview-box');
    const iframe = document.getElementById('an-youtube-preview-iframe');
    const match = (url || '').trim().match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/i);
    const videoId = match ? match[1] : null;

    if (videoId && previewBox && iframe) {
      iframe.src = `https://www.youtube-nocookie.com/embed/${videoId}?rel=0`;
      previewBox.style.display = 'block';
    } else if (previewBox) {
      previewBox.style.display = 'none';
    }
  };

  window.handleAudioCoverFileSelected = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid image file (JPG, PNG, WebP).');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast('Cover image must be under 10MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      const previewImg = document.getElementById('an-cover-preview-img');
      const urlInput = document.getElementById('an-cover-url');
      const removeBtn = document.getElementById('an-remove-cover-btn');
      const textSpan = document.getElementById('an-choose-cover-text');

      if (previewImg) previewImg.src = dataUrl;
      if (urlInput) urlInput.value = dataUrl;
      if (removeBtn) removeBtn.style.display = 'inline-flex';
      if (textSpan) textSpan.textContent = 'Replace Cover Image';
    };
    reader.readAsDataURL(file);
  };

  window.removeAudioCoverImage = () => {
    const previewImg = document.getElementById('an-cover-preview-img');
    const urlInput = document.getElementById('an-cover-url');
    const removeBtn = document.getElementById('an-remove-cover-btn');
    const textSpan = document.getElementById('an-choose-cover-text');
    const fileInput = document.getElementById('an-cover-file-input');

    if (previewImg) previewImg.src = '/default-cover.jpg';
    if (urlInput) urlInput.value = '';
    if (removeBtn) removeBtn.style.display = 'none';
    if (textSpan) textSpan.textContent = 'Choose Cover Image';
    if (fileInput) fileInput.value = '';
  };

  window.handleDirectAudioFileSelected = (file) => {
    if (!file) return;
    const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/m4a', 'audio/x-m4a', 'audio/wav', 'audio/x-wav', 'audio/aac', 'audio/ogg'];
    const isExtAllowed = /\.(mp3|m4a|wav|aac|ogg)$/i.test(file.name);

    if (!allowedTypes.includes(file.type) && !isExtAllowed) {
      showToast('Unsupported audio format. Please upload MP3, M4A, or WAV.');
      return;
    }

    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      showToast(`Audio file exceeds the maximum 50MB limit (File size: ${(file.size / 1024 / 1024).toFixed(1)}MB).`);
      return;
    }

    const progressWrap = document.getElementById('an-audio-progress-wrap');
    const progressFill = document.getElementById('an-audio-progress-fill');
    const statusText = document.getElementById('an-audio-status-text');
    const percentText = document.getElementById('an-audio-percent');
    const filenameDisplay = document.getElementById('an-audio-filename-display');
    const previewWrap = document.getElementById('an-audio-preview-wrap');
    const previewPlayer = document.getElementById('an-audio-preview-player');
    const base64Input = document.getElementById('an-audio-base64-data');

    if (progressWrap) progressWrap.style.display = 'block';
    if (statusText) statusText.textContent = `Reading ${file.name}...`;
    if (filenameDisplay) filenameDisplay.textContent = `${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)`;

    const reader = new FileReader();

    reader.onprogress = (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        if (progressFill) progressFill.style.width = `${pct}%`;
        if (percentText) percentText.textContent = `${pct}%`;
      }
    };

    reader.onload = (e) => {
      const dataUrl = e.target.result;
      if (base64Input) base64Input.value = dataUrl;
      if (statusText) statusText.textContent = 'Audio file ready for saving.';
      if (progressFill) progressFill.style.width = '100%';
      if (percentText) percentText.textContent = '100%';

      if (previewWrap && previewPlayer) {
        previewPlayer.src = dataUrl;
        previewWrap.style.display = 'block';
      }

      // Try reading duration from audio element once metadata loads
      const tempAudio = new Audio();
      tempAudio.src = dataUrl;
      tempAudio.onloadedmetadata = () => {
        if (tempAudio.duration && isFinite(tempAudio.duration)) {
          const mins = Math.floor(tempAudio.duration / 60);
          const secs = Math.floor(tempAudio.duration % 60);
          const durationStr = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
          const durationInput = document.getElementById('an-duration');
          if (durationInput && !durationInput.value) {
            durationInput.value = durationStr;
          }
        }
      };

      showToast(`Loaded ${file.name} successfully! 🎧`);
    };

    reader.onerror = () => {
      showToast('Error reading audio file.');
      if (statusText) statusText.textContent = 'Failed to read audio file.';
    };

    reader.readAsDataURL(file);
  };
};

window.closeAudioNovelModal = () => {
  const modal = document.getElementById('audio-form-modal');
  if (modal) modal.remove();
};

window.submitAudioNovelForm = async (audioNovelId = '') => {
  const errorEl = document.getElementById('audio-form-error');
  const submitBtn = document.getElementById('an-submit-btn');
  if (errorEl) { errorEl.style.display = 'none'; errorEl.textContent = ''; }

  const title = (document.getElementById('an-title')?.value || '').trim();
  if (!title) {
    if (errorEl) { errorEl.textContent = 'Audio Novel Title is required.'; errorEl.style.display = 'block'; }
    showToast('Audio Novel Title is required.');
    return;
  }

  const novelId = document.getElementById('an-novel-id')?.value || null;
  const language = document.getElementById('an-language')?.value || 'Tamil';
  const partNumber = parseInt(document.getElementById('an-part-number')?.value || '1', 10);
  const episodeNumber = (document.getElementById('an-episode-number')?.value || `Part ${partNumber}`).trim();
  const status = document.getElementById('an-status')?.value || 'published';
  const audioDuration = (document.getElementById('an-duration')?.value || '').trim();
  const description = (document.getElementById('an-desc')?.value || '').trim();
  const cover = document.getElementById('an-cover-url')?.value || null;

  const sourceType = document.querySelector('input[name="an-source-type"]:checked')?.value || 'youtube';

  const payload = {
    title,
    novelId,
    language,
    partNumber,
    episodeNumber,
    status,
    audioDuration,
    description,
    cover,
    sourceType
  };

  if (sourceType === 'youtube') {
    const youtubeUrl = (document.getElementById('an-youtube-url')?.value || '').trim();
    if (!youtubeUrl) {
      const err = 'Please enter a valid YouTube video URL.';
      if (errorEl) { errorEl.textContent = err; errorEl.style.display = 'block'; }
      showToast(err);
      return;
    }
    payload.youtubeUrl = youtubeUrl;
  } else {
    // Direct audio
    const audioData = document.getElementById('an-audio-base64-data')?.value || '';
    const audioFileUrl = document.getElementById('an-audio-file-url')?.value || '';

    if (!audioData && !audioFileUrl) {
      const err = 'Please upload an audio file (MP3/M4A/WAV).';
      if (errorEl) { errorEl.textContent = err; errorEl.style.display = 'block'; }
      showToast(err);
      return;
    }

    if (audioData) payload.audioData = audioData;
    if (audioFileUrl) payload.audioFileUrl = audioFileUrl;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving to Database...';
  }

  try {
    const isEdit = Boolean(audioNovelId);
    const endpoint = isEdit ? `/api/admin/audio-novels/${encodeURIComponent(audioNovelId)}` : '/api/admin/audio-novels';
    const method = isEdit ? 'PUT' : 'POST';

    const res = await apiFetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.success) {
      const errMsg = data.error || 'Failed to save audio novel.';
      if (errorEl) { errorEl.textContent = errMsg; errorEl.style.display = 'block'; }
      showToast(errMsg);
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = isEdit ? 'Save Changes' : '+ Create Audio Novel';
      }
      return;
    }

    showToast(isEdit ? `Audio novel "${title}" updated successfully! ✨` : `Audio novel "${title}" created successfully! 🎉`);
    closeAudioNovelModal();

    await loadAdminInitialData();
    const canvas = document.getElementById('admin-main-canvas');
    if (canvas) renderAudioNovelsTab(canvas);
  } catch (err) {
    console.error('Audio novel save error:', err);
    const errMsg = err.message || 'Network error saving audio novel.';
    if (errorEl) { errorEl.textContent = errMsg; errorEl.style.display = 'block'; }
    showToast(errMsg);
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Save';
    }
  }
};

window.toggleAudioNovelStatus = async (id, currentStatus) => {
  const nextStatus = currentStatus === 'published' ? 'draft' : 'published';
  try {
    const res = await apiFetch(`/api/admin/audio-novels/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      showToast(data.error || 'Failed to update audio novel status.');
      return;
    }
    showToast(`Status changed to ${nextStatus === 'published' ? 'Published 🟢' : 'Draft 🔒'}`);
    await loadAdminInitialData();
    const canvas = document.getElementById('admin-main-canvas');
    if (canvas) renderAudioNovelsTab(canvas);
  } catch (err) {
    showToast('Error updating status: ' + err.message);
  }
};

window.deleteAudioNovelPrompt = async (id, title) => {
  const an = adminState.audioNovels.find(a => String(a.id) === String(id));
  const novelTitle = title || an?.title || 'this audio novel';
  if (!confirm(`Are you sure you want to permanently delete audio novel "${novelTitle}"?\n\nThis action cannot be undone.`)) {
    return;
  }

  try {
    const res = await apiFetch(`/api/admin/audio-novels/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      showToast(data.error || 'Failed to delete audio novel.');
      return;
    }
    showToast(`Audio novel "${title}" deleted.`);
    await loadAdminInitialData();
    const canvas = document.getElementById('admin-main-canvas');
    if (canvas) renderAudioNovelsTab(canvas);
  } catch (err) {
    showToast('Error deleting audio novel: ' + err.message);
  }
};

window.pickMediaForCover = (targetInputId = 'form-novel-cover') => {
  if (targetInputId === 'nc-cover-url-input') {
    window.triggerNovelCoverFilePicker();
  } else if (targetInputId === 'edit-novel-cover') {
    window.triggerEditNovelCoverFilePicker();
  }
};

window.previewEpisodeModal = async (episodeId) => {
  try {
    const res = await apiFetch(`/api/admin/episodes/${episodeId}`);
    const data = await res.json();
    if (!res.ok || !data.episode) {
      showToast('Episode not found.');
      return;
    }
    const ep = data.episode;
    let prevModal = document.getElementById('episode-preview-modal');
    if (!prevModal) {
      prevModal = document.createElement('div');
      prevModal.id = 'episode-preview-modal';
      prevModal.className = 'modal-overlay open';
      document.body.appendChild(prevModal);
    }

    prevModal.innerHTML = `
      <div class="modal-card" style="max-width:760px; max-height:90vh; display:flex; flex-direction:column; overflow:hidden;">
        <div class="modal-header" style="background:#FFFDF8; border-bottom:1px solid var(--color-border-light);">
          <div>
            <div style="font-size:11px; text-transform:uppercase; color:var(--color-gold-warm); font-weight:700;">Reader Preview</div>
            <h3 class="modal-title" style="margin:2px 0 0;">${escapeHtml(ep.title)}</h3>
          </div>
          <button class="modal-close-btn" onclick="document.getElementById('episode-preview-modal')?.remove()">✕</button>
        </div>
        <div class="modal-body" style="padding:24px 32px; overflow-y:auto; font-family:var(--font-serif); font-size:1.15rem; line-height:1.9;">
          <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px; color:var(--color-text-muted); border-bottom:1px solid rgba(200,155,60,0.2); padding-bottom:8px; margin-bottom:20px;">
            <span>Episode ${escapeHtml(ep.episodeNumber)} • Status: <strong style="color:var(--color-gold-warm);">${ep.status}</strong></span>
            <span>${ep.wordCount || ''} • ${ep.readTime || ''}</span>
          </div>
          <div>${ep.content}</div>
          <div style="text-align:center; margin-top:30px; font-size:1.5rem; color:var(--color-gold);">❦</div>
        </div>
      </div>
    `;
  } catch (err) {
    showToast('Failed to preview episode: ' + err.message);
  }
};

/* ========================================================
   5. NESTED EPISODES MANAGEMENT TAB
   ======================================================== */
window.selectNovelForEpisodes = (novelId) => {
  adminState.selectedNovelId = novelId;
  switchAdminTab('episodes');
};

async function renderEpisodesTab(canvas) {
  const currentNovelId = adminState.selectedNovelId || (adminState.novels[0]?.id);
  const currentNovel = adminState.novels.find(n => n.id === currentNovelId);

  canvas.innerHTML = `
    <div class="admin-page-header">
      <div class="admin-page-title-group">
        <h1 class="admin-page-title">Chapters & Episodes</h1>
        <p class="admin-page-subtitle">Manage chapter hierarchy, episodes, sub-episodes, and publication status.</p>
      </div>
      <div class="admin-page-actions" style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
        <button type="button" class="btn btn-gold btn-sm" id="btn-admin-add-chapter" onclick="startNewChapterInEditor('${currentNovelId}')" style="display:inline-flex; align-items:center; gap:6px; font-weight:700;">
          <span style="font-size:16px; line-height:1;">+</span>
          <span>Add Chapter</span>
        </button>
        <button type="button" class="btn btn-sm" id="btn-admin-add-episode" onclick="startNewEpisodeInEditor('${currentNovelId}')" style="background:var(--color-navy-deep); color:#FFF; border:1px solid var(--color-navy-deep); display:inline-flex; align-items:center; gap:6px; font-weight:700;">
          <span style="font-size:16px; line-height:1;">+</span>
          <span>Add Episode</span>
        </button>
      </div>
    </div>

    <!-- Novel Selector Bar -->
    <div class="admin-selector-bar">
      <div class="admin-selector-field">
        <label for="episodes-novel-select" class="admin-selector-label">Select Novel:</label>
        <select id="episodes-novel-select" class="admin-selector-select" onchange="onEpisodeNovelChange(this.value)">
          ${adminState.novels.map(n => `
            <option value="${n.id}" ${n.id === currentNovelId ? 'selected' : ''}>${escapeHtml(n.title)} (${n.chaptersCount ?? 0} eps)</option>
          `).join('')}
        </select>
      </div>

      <div class="admin-selector-meta">
        Author: <strong style="color:var(--color-navy-deep);">${escapeHtml(currentNovel?.author || 'Rudhra Prarthana')}</strong>
      </div>
    </div>

    <!-- Tree View Canvas -->
    <div id="episodes-tree-container">
      <div style="text-align:center; padding:40px; color:var(--color-text-muted);">
        Loading chapters & episodes for ${escapeHtml(currentNovel?.title || 'novel')}...
      </div>
    </div>
  `;

  window.onEpisodeNovelChange = (novelId) => {
    adminState.selectedNovelId = novelId;
    loadAndRenderEpisodesTree(novelId);
  };

  if (currentNovelId) {
    loadAndRenderEpisodesTree(currentNovelId);
  }
}

/**
 * Fetch and render the nested hierarchical episode tree
 */
async function loadAndRenderEpisodesTree(novelId) {
  const container = document.getElementById('episodes-tree-container');
  if (!container) return;

  try {
    const res = await apiFetch(`/api/admin/episodes?novel=${encodeURIComponent(novelId)}&hierarchical=true`);
    const data = await res.json();
    adminState.episodes = data.episodes || [];

    if (!adminState.episodes || adminState.episodes.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding:60px 20px; background:#FFFDF8; border:1px dashed var(--color-border); border-radius:12px;">
          <div style="font-size:2.5rem; margin-bottom:12px;">📖</div>
          <h3 style="font-family:var(--font-serif); color:var(--color-navy-deep); margin:0 0 8px;">No Chapters or Episodes Created Yet</h3>
          <p style="color:var(--color-text-muted); font-size:14px; max-width:480px; margin:0 auto 18px;">
            Start organizing your novel with chapters (e.g. Chapter 1), episodes (e.g. Episode 1.1), and nested sub-episodes (e.g. Sub-Episode 1.1.1).
          </p>
          <div style="display:flex; justify-content:center; gap:10px;">
            <button type="button" class="btn btn-gold btn-sm" onclick="startNewChapterInEditor('${novelId}')">+ Add Chapter 1</button>
            <button type="button" class="btn btn-outline btn-sm" onclick="startNewEpisodeInEditor('${novelId}')">+ Add Episode</button>
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="admin-episodes-tree" style="display:flex; flex-direction:column; gap:14px;">
        ${adminState.episodes.map(ep => renderEpisodeTreeItem(ep)).join('')}
      </div>
    `;
  } catch (err) {
    container.innerHTML = `
      <div style="color:#EF4444; padding:20px; background:#FEF2F2; border-radius:8px;">
        Failed to load episodes: ${err.message}
      </div>
    `;
  }
}

/**
 * Render an individual episode tree item and its nested sub-episodes (3-tier hierarchy)
 */
function renderEpisodeTreeItem(ep) {
  const subs = ep.subEpisodes || [];
  const statusClass = ep.status === 'published' ? 'published' : (ep.status === 'scheduled' ? 'scheduled' : 'draft');
  const statusLabel = ep.status === 'published' ? 'Published' : (ep.status === 'scheduled' ? `Scheduled (${formatScheduleDate(ep.scheduledAt)})` : 'Draft');

  return `
    <div class="episode-tree-root chapter-tree-card" id="ep-item-${ep.id}" style="background:#FFF; border:1px solid #E2E8F0; border-radius:10px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.04);">
      <!-- Chapter Header Row -->
      <div class="episode-root-row" style="background:#F8FAFC; padding:12px 16px; border-bottom:1px solid #E2E8F0; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
        <div class="episode-item-info" style="display:flex; align-items:center; gap:12px;">
          <span class="chapter-number-badge" style="background:var(--color-gold); color:var(--color-navy-deep); font-weight:800; font-size:12px; padding:4px 10px; border-radius:6px; text-transform:uppercase; letter-spacing:0.5px;">
            Chapter ${escapeHtml(ep.chapterNum || ep.episodeNumber)}
          </span>
          <div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="episode-item-title" id="item-title-${ep.id}" style="font-size:15px; font-weight:700; color:var(--color-navy-deep); word-break:break-word;">
                ${escapeHtml(ep.title)}
              </span>
              
            </div>
            <div class="episode-item-meta" style="font-size:11px; color:#64748B; margin-top:2px;">
              <span>📅 ${ep.releaseDate || 'Recent'}</span>
              <span>•</span>
              <span>⏱ ${ep.readTime || '8 mins'}</span>
              <span>•</span>
              <span class="status-pill ${statusClass}" style="font-size:10px;">${statusLabel}</span>
              ${subs.length > 0 ? `<span style="font-weight:700; color:var(--color-gold-warm); margin-left:6px;">(${subs.length} episodes)</span>` : '<span style="color:#94A3B8; margin-left:6px;">(0 episodes)</span>'}
            </div>
          </div>
        </div>

        <div class="episode-item-actions" style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
          <button type="button" class="btn btn-gold btn-xs" onclick="startNewEpisodeInEditor('${ep.novelId}', ${ep.id})" title="Add Episode to this Chapter" style="padding:5px 10px; font-size:12px; font-weight:700;">
            ➕ Add Episode
          </button>
          <button type="button" class="btn btn-outline btn-sm" onclick="editEpisodeInEditor(${ep.id})" title="Edit in Rich-Text Editor">
            ✏️ Edit
          </button>
          <button type="button" class="btn btn-outline btn-sm" onclick="duplicateEpisodeAction(${ep.id})" title="Duplicate Chapter">
            📋 <span class="hide-sm">Copy</span>
          </button>
          <button type="button" class="btn btn-outline btn-sm" onclick="previewEpisodeModal(${ep.id})" title="Preview Reader View">
            👁️
          </button>
          <button type="button" class="btn btn-outline btn-sm" onclick="deleteEpisodeAction(${ep.id}, '${escapeQuotes(ep.title)}')" style="color:#DC2626; border-color:#FECACA;" title="Delete Chapter">
            🗑️
          </button>
        </div>
      </div>

      <!-- Nested Episodes Container (Tier 2) -->
      ${subs.length > 0 ? `
        <div class="chapter-episodes-container" style="padding:10px 16px; display:flex; flex-direction:column; gap:8px;">
          ${subs.map(sub => {
            const subSubs = sub.subEpisodes || [];
            const subStatusClass = sub.status === 'published' ? 'published' : (sub.status === 'scheduled' ? 'scheduled' : 'draft');
            return `
              <div class="episode-tier2-card" style="border:1px solid #E2E8F0; background:#FAFAFA; border-radius:8px; padding:10px 12px;">
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                  <div style="display:flex; align-items:center; gap:10px;">
                    <span class="episode-badge" style="background:var(--color-navy-deep); color:#FFF; font-weight:700; font-size:11px; padding:3px 8px; border-radius:4px;">
                      Episode ${escapeHtml(sub.episodeNumber)}
                    </span>
                    <div>
                      <div style="display:flex; align-items:center; gap:6px;">
                        <span id="item-title-${sub.id}" style="font-weight:700; font-size:13.5px; color:var(--color-navy-deep); word-break:break-word;">
                          ${escapeHtml(sub.title)}
                        </span>
                        
                      </div>
                      <div style="font-size:11px; color:#64748B;">
                        ${sub.readTime} • <span class="status-pill ${subStatusClass}" style="font-size:9px; padding:1px 5px;">${sub.status}</span>
                        ${subSubs.length > 0 ? `<span style="font-weight:700; color:var(--color-gold-warm); margin-left:6px;">(${subSubs.length} sub-episodes)</span>` : ''}
                      </div>
                    </div>
                  </div>

                  <div style="display:flex; gap:4px; align-items:center; flex-wrap:wrap;">
                    <button class="btn btn-outline btn-sm" style="font-size:11px; padding:3px 8px; font-weight:600;" onclick="startNewSubEpisodeInEditor('${sub.novelId}', ${sub.id})" title="Add Sub-Episode (e.g. ${sub.episodeNumber}.1)">
                      ➕ Sub-Ep
                    </button>
                    <button class="btn btn-outline btn-sm" style="font-size:11px; padding:3px 8px;" onclick="editEpisodeInEditor(${sub.id})">✏️ Edit</button>
                    <button class="btn btn-outline btn-sm" style="font-size:11px; padding:3px 8px;" onclick="duplicateEpisodeAction(${sub.id})">📋</button>
                    <button class="btn btn-outline btn-sm" style="font-size:11px; padding:3px 8px;" onclick="previewEpisodeModal(${sub.id})">👁️</button>
                    <button class="btn btn-outline btn-sm" style="font-size:11px; padding:3px 8px; color:#EF4444;" onclick="deleteEpisodeAction(${sub.id}, '${escapeQuotes(sub.title)}')">🗑️</button>
                  </div>
                </div>

                <!-- Tier 3: Sub-Episodes List -->
                ${subSubs.length > 0 ? `
                  <div class="sub-sub-episodes-list" style="margin-top:8px; margin-left:20px; border-left:2px solid var(--color-gold); padding-left:10px; display:flex; flex-direction:column; gap:6px;">
                    ${subSubs.map(ss => `
                      <div class="sub-episode-row" style="background:#FFF; padding:6px 10px; border-radius:6px; border:1px solid #E2E8F0; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
                        <div style="display:flex; align-items:center; gap:8px;">
                          <span style="background:#F1F5F9; color:#475569; font-weight:700; font-size:10px; padding:2px 6px; border-radius:3px;">
                            Sub-Ep ${escapeHtml(ss.episodeNumber)}
                          </span>
                          <span id="item-title-${ss.id}" style="font-weight:600; font-size:12.5px; color:var(--color-navy-deep); word-break:break-word;">
                            ${escapeHtml(ss.title)}
                          </span>
                          
                        </div>
                        <div style="display:flex; gap:3px;">
                          <button class="btn btn-outline btn-sm" style="font-size:10px; padding:2px 6px;" onclick="editEpisodeInEditor(${ss.id})">✏️ Edit</button>
                          <button class="btn btn-outline btn-sm" style="font-size:10px; padding:2px 6px;" onclick="duplicateEpisodeAction(${ss.id})">📋</button>
                          <button class="btn btn-outline btn-sm" style="font-size:10px; padding:2px 6px;" onclick="previewEpisodeModal(${ss.id})">👁️</button>
                          <button class="btn btn-outline btn-sm" style="font-size:10px; padding:2px 6px; color:#EF4444;" onclick="deleteEpisodeAction(${ss.id}, '${escapeQuotes(ss.title)}')">🗑️</button>
                        </div>
                      </div>
                    `).join('')}
                  </div>
                ` : ''}
              </div>
            `;
          }).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Modal to quickly edit the title of any Chapter, Episode, or Sub-Episode
 */
window.openEditItemTitleModal = (itemId, currentTitle, itemType = 'Chapter') => {
  const existingModal = document.getElementById('modal-edit-title');
  if (existingModal) existingModal.remove();

  const modalHtml = `
    <div class="admin-modal-backdrop" id="modal-edit-title" style="position:fixed; inset:0; background:rgba(11,31,51,0.6); display:flex; align-items:center; justify-content:center; z-index:9999; padding:20px;">
      <div class="admin-modal-card" style="background:#FFF; width:100%; max-width:480px; border-radius:12px; box-shadow:0 12px 36px rgba(0,0,0,0.2); overflow:hidden;">
        <div style="background:var(--color-navy-deep); color:#FFF; padding:16px 20px; display:flex; justify-content:space-between; align-items:center;">
          <h3 style="margin:0; font-size:16px; font-weight:700;">Edit ${itemType} Title</h3>
          <button type="button" onclick="document.getElementById('modal-edit-title').remove()" style="background:transparent; border:none; color:#FFF; font-size:18px; cursor:pointer;">✕</button>
        </div>
        <form id="form-edit-title" onsubmit="event.preventDefault(); submitEditItemTitle(${itemId});" style="padding:20px;">
          <div class="form-group" style="margin-bottom:16px;">
            <label class="form-label" style="font-weight:700; color:var(--color-navy-deep); font-size:13px; margin-bottom:6px; display:block;">
              ${itemType} Title <span style="color:#EF4444;">*</span>
            </label>
            <input type="text" id="quick-edit-title-input" class="form-input" 
                   value="${escapeQuotes(currentTitle)}" 
                   placeholder="Enter new title..." required autofocus
                   style="width:100%; font-size:15px; font-weight:600; padding:10px 12px;">
            <div style="font-size:12px; color:#64748B; margin-top:4px;">
              Supports Tamil, English, numbers, and Unicode text.
            </div>
          </div>
          <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;">
            <button type="button" class="btn btn-outline btn-sm" onclick="document.getElementById('modal-edit-title').remove()">Cancel</button>
            <button type="submit" id="btn-save-quick-title" class="btn btn-gold btn-sm" style="padding:8px 18px; font-weight:700;">Save Title</button>
          </div>
        </form>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  document.getElementById('quick-edit-title-input')?.focus();
};

window.submitEditItemTitle = async (itemId) => {
  const newTitle = document.getElementById('quick-edit-title-input')?.value?.trim();
  const saveBtn = document.getElementById('btn-save-quick-title');
  if (!newTitle) {
    showToast('Title cannot be empty.');
    return;
  }
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
  }

  try {
    const res = await apiFetch(`/api/admin/episodes/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify({ title: newTitle, titleTa: newTitle })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      showToast(data.error || 'Failed to update title.');
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save Title'; }
      return;
    }

    showToast('Title updated successfully! ✨');
    document.getElementById('modal-edit-title')?.remove();

    // Update in DOM immediately
    const titleEl = document.getElementById(`item-title-${itemId}`);
    if (titleEl) titleEl.textContent = newTitle;

    // Refresh tree to keep state consistent
    if (adminState.selectedNovelId) {
      loadAndRenderEpisodesTree(adminState.selectedNovelId);
    }
  } catch (err) {
    showToast('Error saving title: ' + err.message);
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save Title'; }
  }
};

/**
 * Modal to Add a New Chapter directly under the selected novel
 */
window.openAddChapterModal = (novelId) => {
  const existingModal = document.getElementById('modal-add-chapter');
  if (existingModal) existingModal.remove();

  const currentNovelId = novelId || adminState.selectedNovelId || adminState.novels[0]?.id;
  const novel = adminState.novels.find(n => n.id === currentNovelId);
  const novelTitle = novel?.title || 'Novel';

  // Compute next chapter number
  const rootChapters = (adminState.episodes || []).filter(e => !e.parentId);
  let maxChapterNum = 0;
  for (const ch of rootChapters) {
    const n = parseInt(String(ch.chapterNum || ch.episodeNumber || '0'), 10);
    if (!isNaN(n) && n > maxChapterNum) maxChapterNum = n;
  }
  const nextChapterNum = maxChapterNum + 1;
  const defaultTitle = `${novelTitle} (${nextChapterNum})`;

  const modalHtml = `
    <div class="admin-modal-backdrop" id="modal-add-chapter" style="position:fixed; inset:0; background:rgba(11,31,51,0.6); display:flex; align-items:center; justify-content:center; z-index:9999; padding:20px;">
      <div class="admin-modal-card" style="background:#FFF; width:100%; max-width:540px; border-radius:12px; box-shadow:0 12px 36px rgba(0,0,0,0.2); overflow:hidden;">
        <div style="background:var(--color-navy-deep); color:#FFF; padding:16px 20px; display:flex; justify-content:space-between; align-items:center;">
          <h3 style="margin:0; font-size:16px; font-weight:700;">➕ Add New Chapter</h3>
          <button type="button" onclick="document.getElementById('modal-add-chapter').remove()" style="background:transparent; border:none; color:#FFF; font-size:18px; cursor:pointer;">✕</button>
        </div>
        <form id="form-add-chapter" onsubmit="event.preventDefault(); submitAddChapter('${currentNovelId}');" style="padding:20px;">
          <div style="display:flex; gap:12px; margin-bottom:14px; background:#F8FAFC; padding:10px 14px; border-radius:8px; border:1px solid #E2E8F0; align-items:center;">
            <div>
              <div style="font-size:11px; text-transform:uppercase; color:#64748B; font-weight:700;">Novel</div>
              <div style="font-weight:700; color:var(--color-navy-deep); font-size:14px;">${escapeHtml(novelTitle)}</div>
            </div>
            <div style="margin-left:auto; text-align:right;">
              <div style="font-size:11px; text-transform:uppercase; color:#64748B; font-weight:700;">Auto Number</div>
              <span class="chapter-number-badge" style="background:var(--color-gold); color:var(--color-navy-deep); font-weight:800; font-size:12px; padding:3px 8px; border-radius:4px;">
                Chapter ${nextChapterNum}
              </span>
            </div>
          </div>

          <div class="form-group" style="margin-bottom:14px;">
            <label class="form-label" style="font-weight:700; color:var(--color-navy-deep); font-size:13px; margin-bottom:4px; display:block;">
              Chapter Title <span style="color:#EF4444;">*</span>
            </label>
            <input type="text" id="add-chapter-title-input" class="form-input" 
                   value="${escapeQuotes(defaultTitle)}" 
                   placeholder="e.g. ${escapeQuotes(defaultTitle)}" required
                   style="width:100%; font-size:14.5px; font-weight:700; padding:10px 12px;">
            <div style="font-size:11.5px; color:#64748B; margin-top:3px;">
              Format: <code>${escapeHtml(novelTitle)} (${nextChapterNum})</code> — editable anytime.
            </div>
          </div>

          <div class="form-group" style="margin-bottom:14px;">
            <label class="form-label" style="font-weight:700; color:var(--color-navy-deep); font-size:13px; margin-bottom:4px; display:block;">
              Status
            </label>
            <select id="add-chapter-status-select" class="form-input" style="width:100%;">
              <option value="published" selected>🚀 Published (Live Now)</option>
              <option value="draft">📝 Draft (Private)</option>
            </select>
          </div>

          <div class="form-group" style="margin-bottom:16px;">
            <label class="form-label" style="font-weight:700; color:var(--color-navy-deep); font-size:13px; margin-bottom:4px; display:block;">
              Story Content (Optional summary or opening)
            </label>
            <textarea id="add-chapter-content-input" class="form-input" rows="3" style="width:100%; font-family:var(--font-sans);" placeholder="Enter chapter story text or notes..."></textarea>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:20px; border-top:1px solid #F1F5F9; padding-top:14px;">
            <button type="button" class="btn btn-outline btn-sm" onclick="document.getElementById('modal-add-chapter').remove()">Cancel</button>
            <div style="display:flex; gap:8px;">
              <button type="submit" id="btn-submit-add-chapter" class="btn btn-gold btn-sm" style="padding:8px 20px; font-weight:700;">
                Create Chapter
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  document.getElementById('add-chapter-title-input')?.focus();
};

window.submitAddChapter = async (novelId) => {
  const title = document.getElementById('add-chapter-title-input')?.value?.trim();
  const status = document.getElementById('add-chapter-status-select')?.value || 'published';
  const content = document.getElementById('add-chapter-content-input')?.value?.trim() || '<p>Chapter story begins here...</p>';
  const submitBtn = document.getElementById('btn-submit-add-chapter');

  if (!title) {
    showToast('Please enter a chapter title.');
    return;
  }
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating Chapter...';
  }

  try {
    const res = await apiFetch('/api/admin/episodes', {
      method: 'POST',
      body: JSON.stringify({
        novelId,
        parentId: null,
        title,
        titleTa: title,
        content,
        status
      })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      showToast(data.error || 'Failed to create chapter.');
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Create Chapter'; }
      return;
    }

    showToast(`Chapter "${title}" created successfully! 🎉`);
    document.getElementById('modal-add-chapter')?.remove();
    loadAndRenderEpisodesTree(novelId);
  } catch (err) {
    showToast('Error creating chapter: ' + err.message);
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Create Chapter'; }
  }
};

/**
 * Modal to Add an Episode (under Chapter) or Sub-Episode (under Episode)
 */
window.openAddEpisodeModal = (novelId, defaultParentId = null) => {
  const existingModal = document.getElementById('modal-add-episode');
  if (existingModal) existingModal.remove();

  const currentNovelId = novelId || adminState.selectedNovelId || adminState.novels[0]?.id;
  const novel = adminState.novels.find(n => n.id === currentNovelId);
  const novelTitle = novel?.title || 'Novel';

  // Build list of valid parents:
  // Level 1: Root chapters (parent_id == null) -> creating an Episode under Chapter
  // Level 2: Episodes (parent_id != null) -> creating a Sub-Episode under Episode
  const validParents = [];
  for (const ch of (adminState.episodes || [])) {
    validParents.push({
      id: ch.id,
      type: 'Chapter',
      number: String(ch.chapterNum || ch.episodeNumber || '1'),
      title: ch.title,
      isSub: false,
      children: ch.subEpisodes || []
    });
    if (ch.subEpisodes) {
      for (const ep of ch.subEpisodes) {
        validParents.push({
          id: ep.id,
          type: 'Episode',
          number: String(ep.episodeNumber || ep.chapterNum || '1.1'),
          title: ep.title,
          isSub: true,
          children: ep.subEpisodes || []
        });
      }
    }
  }

  if (validParents.length === 0) {
    showToast('Please create Chapter 1 first before adding episodes.');
    openAddChapterModal(currentNovelId);
    return;
  }

  // Determine initial selected parent
  let selectedParentId = defaultParentId ? Number(defaultParentId) : validParents[0].id;
  let selectedParent = validParents.find(p => p.id === selectedParentId) || validParents[0];

  function computeNextChildInfo(parent) {
    const parentNum = parent.number;
    const existingChildren = parent.children || [];
    let maxSuffix = 0;
    for (const c of existingChildren) {
      const cStr = String(c.episodeNumber || c.chapterNum || '');
      if (cStr.startsWith(parentNum + '.')) {
        const rest = cStr.slice(parentNum.length + 1);
        const part = parseInt(rest.split('.')[0], 10);
        if (!isNaN(part) && part > maxSuffix) maxSuffix = part;
      }
    }
    const nextIndex = Math.max(maxSuffix + 1, existingChildren.length + 1);
    const nextNum = `${parentNum}.${nextIndex}`;
    const itemType = parent.type === 'Chapter' ? 'Episode' : 'Sub-Episode';
    const suggestedTitle = `${novelTitle} (${nextNum})`;
    return { nextNum, itemType, suggestedTitle };
  }

  const initialInfo = computeNextChildInfo(selectedParent);

  const modalHtml = `
    <div class="admin-modal-backdrop" id="modal-add-episode" style="position:fixed; inset:0; background:rgba(11,31,51,0.6); display:flex; align-items:center; justify-content:center; z-index:9999; padding:20px;">
      <div class="admin-modal-card" style="background:#FFF; width:100%; max-width:560px; border-radius:12px; box-shadow:0 12px 36px rgba(0,0,0,0.2); overflow:hidden;">
        <div style="background:var(--color-navy-deep); color:#FFF; padding:16px 20px; display:flex; justify-content:space-between; align-items:center;">
          <h3 style="margin:0; font-size:16px; font-weight:700;">➕ Add Episode / Sub-Episode</h3>
          <button type="button" onclick="document.getElementById('modal-add-episode').remove()" style="background:transparent; border:none; color:#FFF; font-size:18px; cursor:pointer;">✕</button>
        </div>
        <form id="form-add-episode" onsubmit="event.preventDefault(); submitAddEpisode('${currentNovelId}');" style="padding:20px;">
          <div style="margin-bottom:14px;">
            <label class="form-label" style="font-weight:700; color:var(--color-navy-deep); font-size:13px; margin-bottom:4px; display:block;">
              Parent Chapter / Episode <span style="color:#EF4444;">*</span>
            </label>
            <select id="add-episode-parent-select" class="form-input" style="width:100%; font-size:13.5px;" onchange="onAddEpisodeParentChange(this.value)">
              ${validParents.map(p => `
                <option value="${p.id}" ${p.id === selectedParent.id ? 'selected' : ''}>
                  ${p.type === 'Chapter' ? '📁 Chapter' : '  ↳ 📄 Episode'} ${escapeHtml(p.number)}: ${escapeHtml(p.title)}
                </option>
              `).join('')}
            </select>
            <div style="font-size:11.5px; color:#64748B; margin-top:3px;">
              Select Chapter to add Episode (e.g. 1.1) or Episode to add Sub-Episode (e.g. 1.1.1).
            </div>
          </div>

          <div style="display:flex; gap:12px; margin-bottom:14px; background:#F8FAFC; padding:10px 14px; border-radius:8px; border:1px solid #E2E8F0; align-items:center;">
            <div>
              <div style="font-size:11px; text-transform:uppercase; color:#64748B; font-weight:700;">Item Type</div>
              <div id="add-ep-type-display" style="font-weight:700; color:var(--color-navy-deep); font-size:13px;">${initialInfo.itemType}</div>
            </div>
            <div style="margin-left:auto; text-align:right;">
              <div style="font-size:11px; text-transform:uppercase; color:#64748B; font-weight:700;">Generated Number</div>
              <span id="add-ep-num-badge" style="background:var(--color-navy-deep); color:#FFF; font-weight:800; font-size:12px; padding:3px 8px; border-radius:4px;">
                ${initialInfo.nextNum}
              </span>
            </div>
          </div>

          <div class="form-group" style="margin-bottom:14px;">
            <label class="form-label" style="font-weight:700; color:var(--color-navy-deep); font-size:13px; margin-bottom:4px; display:block;">
              Title <span style="color:#EF4444;">*</span>
            </label>
            <input type="text" id="add-episode-title-input" class="form-input" 
                   value="${escapeQuotes(initialInfo.suggestedTitle)}" 
                   placeholder="e.g. ${escapeQuotes(initialInfo.suggestedTitle)}" required
                   style="width:100%; font-size:14.5px; font-weight:700; padding:10px 12px;">
            <div style="font-size:11.5px; color:#64748B; margin-top:3px;">
              Automatically numbered according to parent. You can also customize the title.
            </div>
          </div>

          <div class="form-group" style="margin-bottom:14px;">
            <label class="form-label" style="font-weight:700; color:var(--color-navy-deep); font-size:13px; margin-bottom:4px; display:block;">
              Status
            </label>
            <select id="add-episode-status-select" class="form-input" style="width:100%;">
              <option value="published" selected>🚀 Published (Live Now)</option>
              <option value="draft">📝 Draft (Private)</option>
            </select>
          </div>

          <div class="form-group" style="margin-bottom:16px;">
            <label class="form-label" style="font-weight:700; color:var(--color-navy-deep); font-size:13px; margin-bottom:4px; display:block;">
              Episode Story Content (or write in Full Editor)
            </label>
            <textarea id="add-episode-content-input" class="form-input" rows="4" style="width:100%; font-family:var(--font-sans);" placeholder="Write episode narrative here..."></textarea>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:20px; border-top:1px solid #F1F5F9; padding-top:14px;">
            <button type="button" class="btn btn-outline btn-sm" onclick="document.getElementById('modal-add-episode').remove()">Cancel</button>
            <div style="display:flex; gap:8px;">
              <button type="button" class="btn btn-outline btn-sm" onclick="launchEditorFromAddEpisodeModal('${currentNovelId}')" title="Open Full Rich-Text Editor">
                ✍️ Full Editor
              </button>
              <button type="submit" id="btn-submit-add-episode" class="btn btn-gold btn-sm" style="padding:8px 20px; font-weight:700;">
                Create Episode
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  document.getElementById('add-episode-title-input')?.focus();

  window.onAddEpisodeParentChange = (parentIdVal) => {
    const pId = Number(parentIdVal);
    const p = validParents.find(item => item.id === pId);
    if (!p) return;
    const info = computeNextChildInfo(p);
    const typeDisplay = document.getElementById('add-ep-type-display');
    const numBadge = document.getElementById('add-ep-num-badge');
    const titleInput = document.getElementById('add-episode-title-input');
    if (typeDisplay) typeDisplay.textContent = info.itemType;
    if (numBadge) numBadge.textContent = info.nextNum;
    if (titleInput) titleInput.value = info.suggestedTitle;
  };

  window.launchEditorFromAddEpisodeModal = (nId) => {
    const parentId = document.getElementById('add-episode-parent-select')?.value;
    const title = document.getElementById('add-episode-title-input')?.value;
    const num = document.getElementById('add-ep-num-badge')?.textContent?.trim();
    const content = document.getElementById('add-episode-content-input')?.value;
    document.getElementById('modal-add-episode')?.remove();
    adminState.editingEpisode = {
      id: null,
      novelId: nId,
      parentId: parentId ? parseInt(parentId, 10) : null,
      episodeNumber: num || '',
      title: title || '',
      content: content ? `<p>${escapeHtml(content)}</p>` : '<p>Write your episode here...</p>',
      status: 'published'
    };
    switchAdminTab('editor');
  };
};

window.submitAddEpisode = async (novelId) => {
  const parentId = document.getElementById('add-episode-parent-select')?.value;
  const title = document.getElementById('add-episode-title-input')?.value?.trim();
  const status = document.getElementById('add-episode-status-select')?.value || 'published';
  const content = document.getElementById('add-episode-content-input')?.value?.trim() || '';
  const episodeNumber = document.getElementById('add-ep-num-badge')?.textContent?.trim();
  const submitBtn = document.getElementById('btn-submit-add-episode');

  if (!parentId) {
    showToast('Please select a valid parent Chapter or Episode.');
    return;
  }
  if (!title) {
    showToast('Please enter an episode title.');
    return;
  }
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating Episode...';
  }

  try {
    const res = await apiFetch('/api/admin/episodes', {
      method: 'POST',
      body: JSON.stringify({
        novelId,
        parentId: parseInt(parentId, 10),
        episodeNumber: episodeNumber || undefined,
        title,
        titleTa: title,
        content,
        status
      })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      showToast(data.error || 'Failed to create episode.');
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Create Episode'; }
      return;
    }

    showToast(`Episode "${title}" created successfully! 🎉`);
    document.getElementById('modal-add-episode')?.remove();
    loadAndRenderEpisodesTree(novelId);
  } catch (err) {
    showToast('Error creating episode: ' + err.message);
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Create Episode'; }
  }
};

/**
 * Duplicate episode action
 */
window.duplicateEpisodeAction = async (episodeId) => {
  try {
    const res = await apiFetch(`/api/admin/episodes/${episodeId}/duplicate`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok || !data.success) {
      showToast(data.error || 'Failed to duplicate episode.');
      return;
    }
    showToast('Episode duplicated as draft copy.');
    if (adminState.selectedNovelId) {
      loadAndRenderEpisodesTree(adminState.selectedNovelId);
    }
  } catch (err) {
    showToast('Error duplicating episode: ' + err.message);
  }
};

/**
 * Delete episode action
 */
window.deleteEpisodeAction = async (episodeId, title) => {
  if (!confirm(`Are you sure you want to delete "${title}"?`)) {
    return;
  }
  try {
    const res = await apiFetch(`/api/admin/episodes/${episodeId}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok || !data.success) {
      showToast(data.error || 'Failed to delete episode.');
      return;
    }
    showToast(`"${title}" deleted.`);
    if (adminState.selectedNovelId) {
      loadAndRenderEpisodesTree(adminState.selectedNovelId);
    }
  } catch (err) {
    showToast('Error deleting episode: ' + err.message);
  }
};

/* ========================================================
   6. READER-STYLE RICH-TEXT EDITOR
   ======================================================== */
window.startNewChapterInEditor = (novelId) => {
  const currentNovelId = novelId || adminState.selectedNovelId || adminState.novels[0]?.id;
  const novel = adminState.novels.find(n => n.id === currentNovelId);
  const novelTitle = novel?.title || 'Novel';

  // Find max root chapter
  const rootChapters = (adminState.episodes || []).filter(e => !e.parentId);
  let maxNum = 0;
  for (const r of rootChapters) {
    const n = parseInt(String(r.chapterNum || r.episodeNumber || '0'), 10);
    if (!isNaN(n) && n > maxNum) maxNum = n;
  }
  const nextNum = String(maxNum + 1);

  adminState.editingEpisode = {
    id: null,
    novelId: currentNovelId,
    parentId: null,
    parentType: null,
    parentNum: null,
    hierarchyType: 'Chapter',
    episodeNumber: nextNum,
    title: `${novelTitle} (Chapter ${nextNum})`,
    content: '',
    status: 'draft',
    scheduledAt: null,
    timezone: 'Asia/Kolkata'
  };
  adminState.selectedNovelId = currentNovelId;
  adminState.editorStep = 1;
  adminState.editorDirty = false;
  switchAdminTab('editor');
};

window.startNewEpisodeInEditor = (novelId, parentChapterId = null) => {
  const currentNovelId = novelId || adminState.selectedNovelId || adminState.novels[0]?.id;
  const novel = adminState.novels.find(n => n.id === currentNovelId);
  const novelTitle = novel?.title || 'Novel';

  let parentChapter = null;
  if (parentChapterId) {
    parentChapter = (adminState.episodes || []).find(e => Number(e.id) === Number(parentChapterId));
  }
  if (!parentChapter && (adminState.episodes || []).length > 0) {
    parentChapter = adminState.episodes[0];
  }

  if (!parentChapter) {
    showToast('Please create Chapter 1 first.');
    startNewChapterInEditor(currentNovelId);
    return;
  }

  const parentNum = String(parentChapter.chapterNum || parentChapter.episodeNumber || '1');
  const existingChildren = parentChapter.subEpisodes || [];
  let maxSuffix = 0;
  for (const c of existingChildren) {
    const cStr = String(c.episodeNumber || c.chapterNum || '');
    if (cStr.startsWith(parentNum + '.')) {
      const rest = cStr.slice(parentNum.length + 1);
      const part = parseInt(rest.split('.')[0], 10);
      if (!isNaN(part) && part > maxSuffix) maxSuffix = part;
    }
  }
  const nextIndex = Math.max(maxSuffix + 1, existingChildren.length + 1);
  const nextNum = `${parentNum}.${nextIndex}`;

  adminState.editingEpisode = {
    id: null,
    novelId: currentNovelId,
    parentId: parentChapter.id,
    parentType: 'Chapter',
    parentNum: parentNum,
    hierarchyType: 'Episode',
    episodeNumber: nextNum,
    title: `${novelTitle} (${nextNum})`,
    content: '',
    status: 'draft',
    scheduledAt: null,
    timezone: 'Asia/Kolkata'
  };
  adminState.selectedNovelId = currentNovelId;
  adminState.editorStep = 1;
  adminState.editorDirty = false;
  switchAdminTab('editor');
};

window.startNewSubEpisodeInEditor = (novelId, parentEpisodeId) => {
  const currentNovelId = novelId || adminState.selectedNovelId || adminState.novels[0]?.id;
  const novel = adminState.novels.find(n => n.id === currentNovelId);
  const novelTitle = novel?.title || 'Novel';

  let parentEpisode = null;
  for (const ch of (adminState.episodes || [])) {
    if (Number(ch.id) === Number(parentEpisodeId)) {
      parentEpisode = ch;
      break;
    }
    if (ch.subEpisodes) {
      for (const sub of ch.subEpisodes) {
        if (Number(sub.id) === Number(parentEpisodeId)) {
          parentEpisode = sub;
          break;
        }
      }
    }
    if (parentEpisode) break;
  }

  if (!parentEpisode) {
    showToast('Parent episode not found.');
    return;
  }

  const parentNum = String(parentEpisode.episodeNumber || parentEpisode.chapterNum || '1.1');
  const existingChildren = parentEpisode.subEpisodes || [];
  let maxSuffix = 0;
  for (const c of existingChildren) {
    const cStr = String(c.episodeNumber || c.chapterNum || '');
    if (cStr.startsWith(parentNum + '.')) {
      const rest = cStr.slice(parentNum.length + 1);
      const part = parseInt(rest.split('.')[0], 10);
      if (!isNaN(part) && part > maxSuffix) maxSuffix = part;
    }
  }
  const nextIndex = Math.max(maxSuffix + 1, existingChildren.length + 1);
  const nextNum = `${parentNum}.${nextIndex}`;

  adminState.editingEpisode = {
    id: null,
    novelId: currentNovelId,
    parentId: parentEpisode.id,
    parentType: 'Episode',
    parentNum: parentNum,
    hierarchyType: 'Sub-Episode',
    episodeNumber: nextNum,
    title: `${novelTitle} (${nextNum})`,
    content: '',
    status: 'draft',
    scheduledAt: null,
    timezone: 'Asia/Kolkata'
  };
  adminState.selectedNovelId = currentNovelId;
  adminState.editorStep = 1;
  adminState.editorDirty = false;
  switchAdminTab('editor');
};

window.editEpisodeInEditor = async (episodeId) => {
  try {
    const res = await apiFetch(`/api/admin/episodes/${episodeId}`);
    const data = await res.json();
    if (!res.ok || !data.success || !data.episode) {
      showToast(data.error || 'Failed to load episode.');
      return;
    }
    const ep = data.episode;
    adminState.editingEpisode = {
      id: ep.id,
      novelId: ep.novelId,
      parentId: ep.parentId,
      parentType: ep.parentType || (ep.parentId ? 'Chapter' : null),
      parentNum: ep.parentNum || null,
      hierarchyType: ep.hierarchyType || (ep.parentId ? 'Episode' : 'Chapter'),
      episodeNumber: ep.episodeNumber || ep.chapterNum,
      title: ep.title,
      content: ep.content || '',
      status: ep.status,
      scheduledAt: ep.scheduledAt,
      timezone: ep.timezone || 'Asia/Kolkata'
    };
    adminState.selectedNovelId = ep.novelId;
    adminState.editorStep = 1;
    adminState.editorDirty = false;
    switchAdminTab('editor');
  } catch (err) {
    showToast('Failed to load episode for editing: ' + err.message);
  }
};

window.goToEditorStep = (step) => {
  if (step === 2) {
    const title = document.getElementById('editor-title-input')?.value?.trim();
    const surface = document.getElementById('editor-surface');
    const content = surface?.innerHTML?.trim() || '';
    const plainText = surface?.innerText?.trim() || '';

    if (!title) {
      showToast('Please enter an episode title before proceeding to preview.');
      document.getElementById('editor-title-input')?.focus();
      return;
    }
    if (!plainText) {
      showToast('Episode story content cannot be empty. Please write your content before previewing.');
      surface?.focus();
      return;
    }

    if (!adminState.editingEpisode) adminState.editingEpisode = {};
    adminState.editingEpisode.title = title;
    adminState.editingEpisode.content = content;
    adminState.editingEpisode.novelId = document.getElementById('editor-novel-select')?.value || adminState.editingEpisode.novelId;
    adminState.editingEpisode.episodeNumber = document.getElementById('editor-num-input')?.value?.trim() || adminState.editingEpisode.episodeNumber;
    const parentIdVal = document.getElementById('editor-parent-id')?.value;
    if (parentIdVal) adminState.editingEpisode.parentId = parseInt(parentIdVal, 10);

    adminState.editorStep = 2;
    const canvas = document.getElementById('admin-main-canvas');
    if (canvas) renderEditorTab(canvas);
  } else if (step === 1) {
    adminState.editorStep = 1;
    const canvas = document.getElementById('admin-main-canvas');
    if (canvas) renderEditorTab(canvas);
  }
};

function renderEditorTab(canvas) {
  const ep = adminState.editingEpisode || {
    id: null,
    novelId: adminState.selectedNovelId || adminState.novels[0]?.id,
    parentId: null,
    parentType: null,
    parentNum: null,
    hierarchyType: 'Chapter',
    episodeNumber: '',
    title: '',
    content: '',
    status: 'draft',
    scheduledAt: null,
    timezone: 'Asia/Kolkata'
  };

  const isEditing = Boolean(ep.id);
  const currentNovelId = ep.novelId || adminState.selectedNovelId || adminState.novels[0]?.id;
  const currentNovel = adminState.novels.find(n => n.id === currentNovelId);
  const novelTitle = currentNovel?.title || 'Novel';

  let hierarchyLabel = 'Chapter';
  let hierarchyClass = 'badge-chapter';
  if (ep.hierarchyType === 'Sub-Episode' || (ep.parentId && ep.parentType === 'Episode')) {
    hierarchyLabel = `Sub-Episode under Episode ${ep.parentNum || ''}`;
    hierarchyClass = 'badge-sub-episode';
  } else if (ep.hierarchyType === 'Episode' || (ep.parentId && ep.parentType === 'Chapter')) {
    hierarchyLabel = `Episode under Chapter ${ep.parentNum || ''}`;
    hierarchyClass = 'badge-episode';
  } else if (ep.hierarchyType === 'Chapter' || !ep.parentId) {
    hierarchyLabel = 'New Chapter';
    hierarchyClass = 'badge-chapter';
  }

  if (!adminState.editorStep) {
    adminState.editorStep = 1;
  }
  const editorStep = adminState.editorStep;

  const plainText = (ep.content || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const wordCount = plainText ? plainText.split(/\s+/).length : 0;
  const readTimeMins = Math.max(1, Math.ceil(wordCount / 200));
  const readTimeStr = `${readTimeMins} min read`;

  canvas.innerHTML = `
    <!-- Top Stepper Workflow: Step 1 -> Step 2 -> Step 3 -->
    <div class="editor-stepper-container">
      <div class="editor-step-item ${editorStep === 1 ? 'active' : 'completed'}" onclick="goToEditorStep(1)">
        <span class="step-num">${editorStep > 1 ? '✓' : '1'}</span>
        <span class="step-label">Step 1: Write Content</span>
      </div>
      <div class="editor-step-arrow">➔</div>
      <div class="editor-step-item ${editorStep === 2 ? 'active' : (editorStep > 2 ? 'completed' : '')}" onclick="goToEditorStep(2)">
        <span class="step-num">${editorStep > 2 ? '✓' : '2'}</span>
        <span class="step-label">Step 2: Preview</span>
      </div>
      <div class="editor-step-arrow">➔</div>
      <div class="editor-step-item ${editorStep === 3 ? 'active' : ''}">
        <span class="step-num">3</span>
        <span class="step-label">Step 3: Publish or Schedule</span>
      </div>
    </div>

    <!-- Context Banner: Displaying known novel, hierarchy, and assigned number -->
    <div class="editor-context-banner">
      <div class="context-item">
        <span class="context-icon">📚</span>
        <span class="context-label">Novel:</span>
        <strong class="context-val">${escapeHtml(novelTitle)}</strong>
      </div>
      <div class="context-divider">|</div>
      <div class="context-item">
        <span class="context-icon">📁</span>
        <span class="context-label">Hierarchy:</span>
        <span class="context-badge ${hierarchyClass}">${escapeHtml(hierarchyLabel)}</span>
      </div>
      <div class="context-divider">|</div>
      <div class="context-item">
        <span class="context-icon">🏷️</span>
        <span class="context-label">Assigned #:</span>
        <strong class="context-val">${escapeHtml(ep.episodeNumber || 'Auto')}</strong>
      </div>
    </div>

    ${editorStep === 1 
      ? renderEditorStep1Write(ep, currentNovelId, isEditing) 
      : renderEditorStep2Preview(ep, novelTitle, hierarchyLabel, wordCount, readTimeStr)
    }
  `;

  setupEditorEventListeners(ep);
}

function renderEditorStep1Write(ep, currentNovelId, isEditing) {
  return `
    <div class="admin-page-header" style="margin-bottom:14px;">
      <div class="admin-page-title-group">
        <h1 class="admin-page-title">${isEditing ? `Edit: ${escapeHtml(ep.title || 'Untitled')}` : 'Write Content'}</h1>
        <p class="admin-page-subtitle">Rich-text writing surface with automatic local draft backup.</p>
      </div>
      <div class="admin-page-actions" style="display:flex; gap:10px; align-items:center;">
        <button type="button" class="btn btn-outline btn-sm" onclick="saveEditorDraft(false)">
          💾 Save Draft
        </button>
        <button type="button" class="btn btn-gold btn-sm" onclick="goToEditorStep(2)" style="font-weight:700;">
          Preview Episode ➔
        </button>
      </div>
    </div>

    <div class="editor-container">
      <!-- 1. Novel selection first, 2. Title second -->
      <div class="editor-meta-grid">
        <input type="hidden" id="editor-parent-id" value="${ep.parentId ? escapeHtml(ep.parentId) : ''}">
        <input type="hidden" id="editor-status-select" value="${ep.status || 'draft'}">

        <div class="form-group editor-novel-group">
          <label class="form-label" for="editor-novel-select" style="font-weight:700; color:var(--color-navy-deep); font-size:13px; margin-bottom:6px; display:flex; align-items:center; gap:6px;">
            <span>📚</span> Novel <span style="color:#EF4444;">*</span>
          </label>
          <select id="editor-novel-select" class="form-input editor-novel-select" onchange="onEditorNovelChange(this.value)" style="font-size:14px; font-weight:600; height:42px;">
            ${adminState.novels.map(n => `
              <option value="${n.id}" ${n.id === currentNovelId ? 'selected' : ''}>${escapeHtml(n.title)}</option>
            `).join('')}
          </select>
        </div>

        <div class="form-group editor-title-group">
          <label class="form-label" for="editor-title-input" style="font-weight:700; color:var(--color-navy-deep); font-size:13px; margin-bottom:6px; display:flex; align-items:center; gap:6px;">
            <span>📝</span> Title <span style="color:#EF4444;">*</span>
          </label>
          <input type="text" id="editor-title-input" class="form-input editor-title-input" 
                 placeholder="Enter episode or chapter title" 
                 value="${escapeHtml(ep.title || '')}"
                 oninput="onEditorContentChange()"
                 style="font-size:15px; font-weight:700; height:42px;">
        </div>
      </div>

      <!-- Episode Numbering Strip -->
      <div class="editor-meta-strip">
        <div class="editor-num-wrap">
          <span class="editor-strip-label">Episode #:</span>
          <input type="text" id="editor-num-input" class="editor-num-input" placeholder="e.g. 1.1" 
                 value="${escapeHtml(ep.episodeNumber || '')}"
                 oninput="onEditorContentChange()">
          <span class="editor-strip-hint">(Generated from parent relationship)</span>
        </div>

        <div style="font-size:12px; color:var(--color-text-muted);">
          <span>Draft autosaves to local storage as you type</span>
        </div>
      </div>

      <!-- Rich-Text Formatting Toolbar -->
      <div class="editor-toolbar" role="toolbar" aria-label="Text Formatting">
        <div class="toolbar-group">
          <button type="button" class="toolbar-btn" onclick="execCmd('undo')" title="Undo (Ctrl+Z)">↶</button>
          <button type="button" class="toolbar-btn" onclick="execCmd('redo')" title="Redo (Ctrl+Y)">↷</button>
        </div>

        <div class="toolbar-group">
          <select class="toolbar-select" onchange="execFormatBlock(this.value); this.value='p';">
            <option value="p">Paragraph</option>
            <option value="h1">Heading 1</option>
            <option value="h2">Heading 2</option>
            <option value="h3">Heading 3</option>
            <option value="blockquote">Quote Block</option>
          </select>

          <select class="toolbar-select" onchange="execFontSize(this.value); this.value='';">
            <option value="">Font Size</option>
            <option value="3">Normal (16px)</option>
            <option value="4">Medium (18px)</option>
            <option value="5">Large (22px)</option>
            <option value="6">Extra Large (26px)</option>
          </select>
        </div>

        <div class="toolbar-group">
          <button type="button" class="toolbar-btn" onclick="execCmd('bold')" title="Bold (Ctrl+B)"><strong>B</strong></button>
          <button type="button" class="toolbar-btn" onclick="execCmd('italic')" title="Italic (Ctrl+I)"><em>I</em></button>
          <button type="button" class="toolbar-btn" onclick="execCmd('underline')" title="Underline (Ctrl+U)"><u>U</u></button>
          <button type="button" class="toolbar-btn" onclick="execCmd('strikeThrough')" title="Strikethrough"><s>S</s></button>
        </div>

        <div class="toolbar-group">
          <button type="button" class="toolbar-btn" onclick="execCmd('justifyLeft')" title="Align Left">⇤</button>
          <button type="button" class="toolbar-btn" onclick="execCmd('justifyCenter')" title="Align Center">≡</button>
          <button type="button" class="toolbar-btn" onclick="execCmd('justifyRight')" title="Align Right">⇥</button>
          <button type="button" class="toolbar-btn" onclick="execCmd('justifyFull')" title="Justify">≣</button>
        </div>

        <div class="toolbar-group">
          <button type="button" class="toolbar-btn" onclick="execCmd('insertUnorderedList')" title="Bullet List">• List</button>
          <button type="button" class="toolbar-btn" onclick="execCmd('insertOrderedList')" title="Numbered List">1. List</button>
          <button type="button" class="toolbar-btn" onclick="execCmd('insertHorizontalRule')" title="Divider Line">—</button>
        </div>

        <div class="toolbar-group">
          <button type="button" class="toolbar-btn" onclick="promptInsertLink()" title="Insert/Edit Link">🔗 Link</button>
          <button type="button" class="toolbar-btn" onclick="promptInsertImage()" title="Insert Image">🖼️ Image</button>
          <button type="button" class="toolbar-btn" onclick="execCmd('removeFormat')" title="Clear Formatting">🧹 Clear</button>
        </div>
      </div>

      <!-- Completely Blank Writing Surface (No placeholder text) -->
      <div class="editor-canvas-wrap">
        <div style="display:flex; flex-direction:column; gap:6px; width:100%;">
          <div class="editor-writing-surface" id="editor-surface" contenteditable="true" 
               oninput="onEditorContentChange()" role="textbox" aria-multiline="true">${ep.content ? ep.content : ''}</div>
        </div>
      </div>

      <!-- Bottom Status & Actions Bar -->
      <div class="editor-status-bar" style="margin-top:14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
        <div style="display:flex; gap:14px; align-items:center; flex-wrap:wrap;">
          <div class="editor-autosave-badge">
            <span class="editor-autosave-dot" id="autosave-dot"></span>
            <span id="autosave-text">Draft autosaved locally</span>
          </div>
          <span style="color:var(--color-border);">|</span>
          <span id="editor-word-count" style="font-weight:700; color:var(--color-navy-deep); font-size:13px;">0 words</span>
          <span id="editor-read-time" style="color:var(--color-text-muted); font-size:12.5px;">1 min read</span>
        </div>

        <div style="display:flex; gap:10px; align-items:center;">
          <button type="button" class="btn btn-outline btn-sm" onclick="saveEditorDraft(false)">
            💾 Save Draft
          </button>
          <button type="button" class="btn btn-gold btn-sm" onclick="goToEditorStep(2)" style="font-weight:700;">
            Preview Episode ➔
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderEditorStep2Preview(ep, novelTitle, hierarchyLabel, wordCount, readTimeStr) {
  const contentHtml = ep.content || '<p style="color:#94A3B8; font-style:italic;">No content written.</p>';
  return `
    <div class="admin-page-header" style="margin-bottom:14px;">
      <div class="admin-page-title-group">
        <h1 class="admin-page-title">Step 2: Preview Episode</h1>
        <p class="admin-page-subtitle">Inspect the complete episode in exact reader view before publishing or scheduling release.</p>
      </div>
      <div class="admin-page-actions" style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
        <button type="button" class="btn btn-outline btn-sm" onclick="goToEditorStep(1)">
          ← Back to Edit
        </button>
        <button type="button" class="btn btn-sm btn-schedule-pub" onclick="openSchedulePublicationModal()" style="background:#4F46E5; color:#FFF; font-weight:700; border:none; padding:8px 16px; border-radius:6px; cursor:pointer;">
          ⏰ Schedule Publication
        </button>
        <button type="button" class="btn btn-gold btn-sm btn-publish-now" onclick="executePublishNow()" style="font-weight:700; padding:8px 16px;">
          🚀 Publish Now
        </button>
      </div>
    </div>

    <!-- Confirmation Details Card -->
    <div class="editor-preview-confirm-card">
      <div class="preview-confirm-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-size:18px;">📋</span>
          <h3 style="margin:0; font-size:16px; font-weight:700; color:var(--color-navy-deep);">Episode Confirmation Summary</h3>
        </div>
        <span class="status-pill ${ep.status === 'published' ? 'published' : (ep.status === 'scheduled' ? 'scheduled' : 'draft')}">
          ${(ep.status || 'draft').toUpperCase()}
        </span>
      </div>

      <div class="preview-confirm-grid">
        <div class="confirm-stat-box">
          <span class="stat-label">📚 Novel</span>
          <span class="stat-val">${escapeHtml(novelTitle)}</span>
        </div>
        <div class="confirm-stat-box">
          <span class="stat-label">📁 Hierarchy</span>
          <span class="stat-val">${escapeHtml(hierarchyLabel)}</span>
        </div>
        <div class="confirm-stat-box">
          <span class="stat-label">🏷️ Episode Number</span>
          <span class="stat-val">${escapeHtml(ep.episodeNumber || 'Auto')}</span>
        </div>
        <div class="confirm-stat-box">
          <span class="stat-label">📝 Content Title</span>
          <span class="stat-val">${escapeHtml(ep.title || 'Untitled')}</span>
        </div>
        <div class="confirm-stat-box">
          <span class="stat-label">📊 Word Count</span>
          <span class="stat-val">${wordCount.toLocaleString()} words</span>
        </div>
        <div class="confirm-stat-box">
          <span class="stat-label">⏱️ Estimated Read Time</span>
          <span class="stat-val">${readTimeStr}</span>
        </div>
      </div>

      <div class="preview-confirm-actions">
        <button type="button" class="btn btn-outline btn-sm" onclick="goToEditorStep(1)" style="font-weight:600;">
          ← Back to Edit
        </button>
        <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
          <button type="button" class="btn btn-sm btn-schedule-pub" onclick="openSchedulePublicationModal()" style="background:#4F46E5; color:#FFF; font-weight:700; border:none; padding:8px 16px; border-radius:6px; cursor:pointer;">
            ⏰ Schedule Publication
          </button>
          <button type="button" class="btn btn-gold btn-sm btn-publish-now" onclick="executePublishNow()" style="font-weight:700; padding:8px 16px;">
            🚀 Publish Now
          </button>
        </div>
      </div>
    </div>

    <!-- Reader Preview Container with exact reader experience -->
    <div style="background:#FFFFFF; border:1px solid var(--color-border); border-radius:12px; padding:24px; box-shadow:0 2px 8px rgba(0,0,0,0.04);">
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #F1F5F9; padding-bottom:12px; margin-bottom:20px; flex-wrap:wrap; gap:10px;">
        <span style="font-weight:700; font-size:13px; color:var(--color-gold-warm); text-transform:uppercase; letter-spacing:0.5px;">
          📖 Live Reader View (Exact Reader Experience)
        </span>
        <div style="display:flex; gap:6px;">
          <button class="mode-pill mode-pill-light active" style="font-size:11px; padding:3px 8px;" onclick="setEditorPreviewTheme('light')">Light</button>
          <button class="mode-pill mode-pill-sepia" style="font-size:11px; padding:3px 8px;" onclick="setEditorPreviewTheme('sepia')">Sepia</button>
          <button class="mode-pill mode-pill-dark" style="font-size:11px; padding:3px 8px;" onclick="setEditorPreviewTheme('dark')">Dark</button>
        </div>
      </div>

      <div class="editor-preview-surface mode-light" id="editor-preview-surface" style="min-height:360px; max-width:800px; margin:0 auto; padding:24px;">
        <div style="font-family:var(--font-serif); border-bottom:1px solid rgba(200,155,60,0.25); padding-bottom:14px; margin-bottom:24px; text-align:center;">
          <div style="font-size:12px; letter-spacing:1.5px; text-transform:uppercase; color:var(--color-gold-warm); font-weight:700;">Rudhra Prarthana Novels</div>
          <h2 style="font-size:2rem; margin:8px 0 6px; color:inherit; font-weight:700;">${escapeHtml(ep.title || 'Untitled Episode')}</h2>
          <div style="font-size:12px; opacity:0.75;">✍️ Rudhra Prarthana • ⏱ ${readTimeStr} • Protected Reading</div>
        </div>
        <div class="reader-body-content" style="font-family:var(--font-serif); font-size:1.15rem; line-height:1.9;">
          ${contentHtml}
        </div>
        <div style="text-align:center; margin-top:36px; font-size:1.6rem; color:var(--color-gold);">❦</div>
      </div>

      <!-- Bottom Actions -->
      <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid #F1F5F9; padding-top:16px; margin-top:24px; flex-wrap:wrap; gap:10px;">
        <button type="button" class="btn btn-outline btn-sm" onclick="goToEditorStep(1)">
          ← Back to Edit
        </button>
        <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
          <button type="button" class="btn btn-sm btn-schedule-pub" onclick="openSchedulePublicationModal()" style="background:#4F46E5; color:#FFF; font-weight:700; border:none; padding:8px 16px; border-radius:6px; cursor:pointer;">
            ⏰ Schedule Publication
          </button>
          <button type="button" class="btn btn-gold btn-sm btn-publish-now" onclick="executePublishNow()" style="font-weight:700; padding:8px 16px;">
            🚀 Publish Now
          </button>
        </div>
      </div>
    </div>
  `;
}

function setupEditorEventListeners(ep) {
  if (adminState.editorStep === 1) {
    updateWordCounters();

    // Check if there is an unsaved local draft for new episodes
    if (!ep.id && !ep.content) {
      try {
        const rawDraft = localStorage.getItem('rp_admin_editor_draft');
        if (rawDraft) {
          const draftData = JSON.parse(rawDraft);
          if (draftData && draftData.content && draftData.content.trim()) {
            const surface = document.getElementById('editor-surface');
            const titleInput = document.getElementById('editor-title-input');
            if (surface && titleInput && !surface.innerText.trim()) {
              if (confirm('An unsaved local draft was found. Do you want to restore it?')) {
                surface.innerHTML = draftData.content;
                if (draftData.title) titleInput.value = draftData.title;
                updateWordCounters();
                showToast('Autosaved draft restored.');
              }
            }
          }
        }
      } catch (e) {}
    }
  }
}

window.execCmd = (command, value = null) => {
  document.execCommand(command, false, value);
  const surface = document.getElementById('editor-surface');
  if (surface) surface.focus();
  onEditorContentChange();
};

window.execFormatBlock = (tag) => {
  document.execCommand('formatBlock', false, tag);
  const surface = document.getElementById('editor-surface');
  if (surface) surface.focus();
  onEditorContentChange();
};

window.execFontSize = (size) => {
  if (!size) return;
  document.execCommand('fontSize', false, size);
  const surface = document.getElementById('editor-surface');
  if (surface) surface.focus();
  onEditorContentChange();
};

window.promptInsertLink = () => {
  const url = prompt('Enter web URL to link:');
  if (url) {
    document.execCommand('createLink', false, url);
    onEditorContentChange();
  }
};

window.promptInsertImage = () => {
  const url = prompt('Enter image URL or select from media library:');
  if (url) {
    document.execCommand('insertImage', false, url);
    onEditorContentChange();
  }
};

window.onEditorContentChange = () => {
  adminState.editorDirty = true;
  updateWordCounters();

  const dot = document.getElementById('autosave-dot');
  const text = document.getElementById('autosave-text');
  if (dot) dot.classList.add('dirty');
  if (text) text.textContent = 'Unsaved changes...';

  if (adminState.autosaveTimer) clearTimeout(adminState.autosaveTimer);
  adminState.autosaveTimer = setTimeout(() => {
    saveEditorLocalDraft();
  }, 2500);
};

window.setEditorPreviewTheme = (theme) => {
  const prevSurface = document.getElementById('editor-preview-surface');
  if (!prevSurface) return;
  prevSurface.classList.remove('mode-light', 'mode-sepia', 'mode-dark');
  prevSurface.classList.add(`mode-${theme}`);

  document.querySelectorAll('.mode-pill').forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.querySelector(`.mode-pill-${theme}`);
  if (activeBtn) activeBtn.classList.add('active');
};

window.saveEditorLocalDraft = () => {
  const content = document.getElementById('editor-surface')?.innerHTML || adminState.editingEpisode?.content || '';
  const title = document.getElementById('editor-title-input')?.value || adminState.editingEpisode?.title || '';
  localStorage.setItem('rp_admin_editor_draft', JSON.stringify({
    title, content, timestamp: new Date().toLocaleTimeString()
  }));
  const dot = document.getElementById('autosave-dot');
  const text = document.getElementById('autosave-text');
  if (dot) dot.classList.remove('dirty');
  if (text) text.textContent = `Draft autosaved locally at ${new Date().toLocaleTimeString()}`;
};

window.saveEditorDraft = async (redirect = true) => {
  await saveEpisodePayload('draft', redirect);
};

window.executePublishNow = async () => {
  if (!confirm('Are you sure you want to publish this episode live to readers right now?')) return;
  await saveEpisodePayload('published', true);
};

window.openSchedulePublicationModal = () => {
  const ep = adminState.editingEpisode || {};
  const existingModal = document.getElementById('modal-schedule-pub');
  if (existingModal) existingModal.remove();

  const defaultDateObj = new Date(Date.now() + 3600000);
  const yyyy = defaultDateObj.getFullYear();
  const mm = String(defaultDateObj.getMonth() + 1).padStart(2, '0');
  const dd = String(defaultDateObj.getDate()).padStart(2, '0');
  const hh = String(defaultDateObj.getHours()).padStart(2, '0');
  const min = String(defaultDateObj.getMinutes()).padStart(2, '0');

  const defaultDate = `${yyyy}-${mm}-${dd}`;
  const defaultTime = `${hh}:${min}`;
  const todayDate = new Date().toISOString().split('T')[0];

  const modalHtml = `
    <div class="admin-modal-backdrop" id="modal-schedule-pub" style="position:fixed; inset:0; background:rgba(11,31,51,0.6); display:flex; align-items:center; justify-content:center; z-index:9999; padding:20px;">
      <div class="admin-modal-card" style="background:#FFF; width:100%; max-width:480px; border-radius:12px; box-shadow:0 12px 36px rgba(0,0,0,0.25); overflow:hidden;">
        <div style="background:var(--color-navy-deep); color:#FFF; padding:16px 20px; display:flex; justify-content:space-between; align-items:center;">
          <h3 style="margin:0; font-size:16px; font-weight:700; display:flex; align-items:center; gap:8px;">
            <span>⏰</span> Schedule Publication
          </h3>
          <button type="button" onclick="document.getElementById('modal-schedule-pub').remove()" style="background:transparent; border:none; color:#FFF; font-size:18px; cursor:pointer;">✕</button>
        </div>

        <form id="form-schedule-pub" onsubmit="event.preventDefault(); submitSchedulePublication();" style="padding:20px;">
          <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px; padding:12px 14px; margin-bottom:16px;">
            <div style="font-size:12px; color:var(--color-text-muted);">Scheduling Episode:</div>
            <strong style="color:var(--color-navy-deep); font-size:14px;">${escapeHtml(ep.title || 'Untitled')}</strong>
            <div style="font-size:11.5px; color:var(--color-gold-warm); margin-top:2px;">Episode ${escapeHtml(ep.episodeNumber || 'Auto')}</div>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:14px;">
            <div>
              <label class="form-label" style="font-weight:700; font-size:12.5px; margin-bottom:4px; display:block;">
                Publication Date <span style="color:#EF4444;">*</span>
              </label>
              <input type="date" id="sched-input-date" class="form-input" min="${todayDate}" value="${defaultDate}" required style="width:100%;">
            </div>
            <div>
              <label class="form-label" style="font-weight:700; font-size:12.5px; margin-bottom:4px; display:block;">
                Publication Time <span style="color:#EF4444;">*</span>
              </label>
              <input type="time" id="sched-input-time" class="form-input" value="${defaultTime}" required style="width:100%;">
            </div>
          </div>

          <div style="margin-bottom:16px;">
            <label class="form-label" style="font-weight:700; font-size:12.5px; margin-bottom:4px; display:block;">
              Timezone
            </label>
            <select id="sched-input-timezone" class="form-input" style="width:100%;">
              <option value="Asia/Kolkata" selected>Asia/Kolkata (IST - Indian Standard Time)</option>
              <option value="UTC">UTC (Coordinated Universal Time)</option>
              <option value="America/New_York">America/New_York (EST / EDT)</option>
              <option value="Europe/London">Europe/London (GMT / BST)</option>
              <option value="Asia/Singapore">Asia/Singapore (SGT)</option>
              <option value="Asia/Dubai">Asia/Dubai (GST)</option>
            </select>
          </div>

          <div style="font-size:11.5px; color:#64748B; margin-bottom:18px; line-height:1.5;">
            ℹ️ When the scheduled date and time arrive, the server scheduler will automatically publish this episode to all readers.
          </div>

          <div style="display:flex; justify-content:flex-end; gap:10px;">
            <button type="button" class="btn btn-outline btn-sm" onclick="document.getElementById('modal-schedule-pub').remove()">Cancel</button>
            <button type="submit" class="btn btn-gold btn-sm" style="font-weight:700;">Confirm & Schedule Release</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
};

window.submitSchedulePublication = async () => {
  const dateVal = document.getElementById('sched-input-date')?.value;
  const timeVal = document.getElementById('sched-input-time')?.value;
  const timezone = document.getElementById('sched-input-timezone')?.value || 'Asia/Kolkata';

  if (!dateVal || !timeVal) {
    showToast('Please select both publication date and time.');
    return;
  }

  const dtStr = `${dateVal}T${timeVal}:00`;
  const scheduledDate = new Date(dtStr);
  if (isNaN(scheduledDate.getTime())) {
    showToast('Invalid publication date/time.');
    return;
  }

  const scheduledAt = scheduledDate.toISOString();
  document.getElementById('modal-schedule-pub')?.remove();

  if (!adminState.editingEpisode) adminState.editingEpisode = {};
  adminState.editingEpisode.scheduledAt = scheduledAt;
  adminState.editingEpisode.timezone = timezone;
  await saveEpisodePayload('scheduled', true);
};

window.onEditorNovelChange = async (novelId) => {
  adminState.selectedNovelId = novelId;
  try {
    const res = await apiFetch(`/api/admin/episodes?novel=${encodeURIComponent(novelId)}&hierarchical=true`);
    const data = await res.json();
    adminState.episodes = data.episodes || [];
    const parentIdVal = document.getElementById('editor-parent-id')?.value || adminState.editingEpisode?.parentId || null;
    recalculateEpisodeNumbering(parentIdVal);
  } catch (e) {}
};

function recalculateEpisodeNumbering(parentId) {
  const novel = adminState.novels.find(n => n.id === (document.getElementById('editor-novel-select')?.value || adminState.selectedNovelId));
  const novelTitle = novel?.title || 'Novel';
  const numInput = document.getElementById('editor-num-input');
  const titleInput = document.getElementById('editor-title-input');
  const isEditing = Boolean(adminState.editingEpisode?.id);

  if (!parentId) {
    const rootChapters = (adminState.episodes || []).filter(e => !e.parentId);
    let maxNum = 0;
    for (const r of rootChapters) {
      const n = parseInt(String(r.chapterNum || r.episodeNumber || '0'), 10);
      if (!isNaN(n) && n > maxNum) maxNum = n;
    }
    const nextNum = String(maxNum + 1);
    if (numInput && (!numInput.value || !isEditing)) numInput.value = nextNum;
    if (titleInput && !isEditing && (!titleInput.value || titleInput.value.includes('('))) {
      titleInput.value = `${novelTitle} (Chapter ${nextNum})`;
    }
  } else {
    let parentItem = null;
    for (const item of (adminState.episodes || [])) {
      if (Number(item.id) === Number(parentId)) { parentItem = item; break; }
      if (item.subEpisodes) {
        for (const sub of item.subEpisodes) {
          if (Number(sub.id) === Number(parentId)) { parentItem = sub; break; }
        }
      }
    }
    if (parentItem) {
      const parentNum = String(parentItem.episodeNumber || parentItem.chapterNum || '1');
      const children = parentItem.subEpisodes || [];
      let maxSuffix = 0;
      for (const c of children) {
        const cStr = String(c.episodeNumber || c.chapterNum || '');
        if (cStr.startsWith(parentNum + '.')) {
          const rest = cStr.slice(parentNum.length + 1);
          const part = parseInt(rest.split('.')[0], 10);
          if (!isNaN(part) && part > maxSuffix) maxSuffix = part;
        }
      }
      const nextIndex = Math.max(maxSuffix + 1, children.length + 1);
      const calculatedNum = `${parentNum}.${nextIndex}`;
      if (numInput && (!numInput.value || !isEditing)) numInput.value = calculatedNum;
      if (titleInput && !isEditing && (!titleInput.value || titleInput.value.includes('('))) {
        titleInput.value = `${novelTitle} (${calculatedNum})`;
      }
    }
  }
  onEditorContentChange();
}

function updateWordCounters() {
  const surface = document.getElementById('editor-surface');
  if (!surface) return;
  const text = surface.innerText || '';
  const words = text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
  const mins = Math.max(1, Math.ceil(words / 200));

  const wordEl = document.getElementById('editor-word-count');
  const timeEl = document.getElementById('editor-read-time');
  if (wordEl) wordEl.textContent = `${words.toLocaleString()} words`;
  if (timeEl) timeEl.textContent = `${mins} min read`;
}

async function saveEpisodePayload(forcedStatus, redirectAfterSave = true) {
  const ep = adminState.editingEpisode || {};
  const title = (document.getElementById('editor-title-input')?.value || ep.title || '').trim();
  const novelId = document.getElementById('editor-novel-select')?.value || ep.novelId || adminState.selectedNovelId;
  const parentIdVal = document.getElementById('editor-parent-id')?.value || ep.parentId || null;
  const episodeNumber = (document.getElementById('editor-num-input')?.value || ep.episodeNumber || '').trim();
  const surface = document.getElementById('editor-surface');
  const content = (surface ? surface.innerHTML : ep.content || '').trim();
  const plainText = (surface ? surface.innerText : (ep.content || '').replace(/<[^>]*>/g, ' ')).trim();
  const status = forcedStatus || ep.status || 'published';

  if (!title) {
    showToast('Please enter an episode title.');
    document.getElementById('editor-title-input')?.focus();
    return;
  }
  if (!plainText) {
    showToast('Episode story content cannot be empty.');
    return;
  }

  let scheduledAt = null;
  let timezone = 'Asia/Kolkata';

  if (status === 'scheduled') {
    scheduledAt = ep.scheduledAt;
    timezone = ep.timezone || 'Asia/Kolkata';
    if (!scheduledAt) {
      showToast('Please specify scheduled date and time.');
      return;
    }
  }

  const payload = {
    novelId,
    parentId: parentIdVal ? parseInt(parentIdVal, 10) : null,
    episodeNumber: episodeNumber || undefined,
    title,
    content,
    status,
    scheduledAt,
    timezone
  };

  const isEditing = Boolean(ep.id);
  const endpoint = isEditing ? `/api/admin/episodes/${ep.id}` : '/api/admin/episodes';
  const method = isEditing ? 'PUT' : 'POST';

  try {
    const res = await apiFetch(endpoint, {
      method,
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      showToast(data.error || 'Failed to save episode.');
      return;
    }

    showToast(`Episode "${title}" successfully saved as ${status}!`);
    adminState.editorDirty = false;
    localStorage.removeItem('rp_admin_editor_draft');

    if (redirectAfterSave) {
      adminState.selectedNovelId = novelId;
      adminState.editorStep = 1;
      adminState.editingEpisode = null;
      switchAdminTab(status === 'scheduled' ? 'scheduler' : 'episodes');
    }
  } catch (err) {
    showToast('Error saving episode: ' + err.message);
  }
}

// Global beforeunload warning when editor is dirty
if (typeof window !== 'undefined' && !window._rp_editor_beforeunload_registered) {
  window._rp_editor_beforeunload_registered = true;
  window.addEventListener('beforeunload', (e) => {
    if (adminState && adminState.editorDirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
}


/* ========================================================
   7. PUBLISHING SCHEDULER VIEW
   ======================================================== */
async function renderSchedulerTab(canvas) {
  canvas.innerHTML = `
    <div class="admin-page-header">
      <div class="admin-page-title-group">
        <h1 class="admin-page-title">Schedule</h1>
        <p class="admin-page-subtitle">Automated release timeline and upcoming publication queue.</p>
      </div>
      <div class="admin-page-actions">
        <button type="button" class="btn btn-gold btn-sm" onclick="startNewEpisodeInEditor()">+ Schedule Episode</button>
      </div>
    </div>

    <div id="scheduler-content-mount">
      <div style="text-align:center; padding:40px; color:var(--color-text-muted);">
        Loading scheduled queue...
      </div>
    </div>
  `;

  try {
    const res = await apiFetch('/api/admin/scheduler');
    const data = await res.json();
    adminState.scheduledEpisodes = data.scheduled || [];
    const container = document.getElementById('scheduler-content-mount');
    if (!container) return;

    if (!adminState.scheduledEpisodes || adminState.scheduledEpisodes.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding:60px 20px; background:#FFFDF8; border:1px dashed var(--color-border); border-radius:12px;">
          <div style="font-size:2.5rem; margin-bottom:12px;">⏰</div>
          <h3 style="font-family:var(--font-serif); color:var(--color-navy-deep); margin:0 0 8px;">No Scheduled Releases</h3>
          <p style="color:var(--color-text-muted); font-size:14px; max-width:440px; margin:0 auto 18px;">
            You can write chapters in advance and schedule them to automatically publish at any future date, time, and timezone.
          </p>
          <button class="btn btn-gold btn-sm" onclick="startNewEpisodeInEditor()">+ Write & Schedule Chapter</button>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="scheduler-timeline">
        ${adminState.scheduledEpisodes.map(s => renderSchedulerCard(s)).join('')}
      </div>
    `;
  } catch (err) {
    const container = document.getElementById('scheduler-content-mount');
    if (container) {
      container.innerHTML = `<div style="color:#EF4444; padding:20px;">Failed to load scheduler: ${err.message}</div>`;
    }
  }
}

function renderSchedulerCard(s) {
  const schedDate = new Date(s.scheduledAt);
  const dateStr = schedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const timeStr = schedDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const countdown = getCountdownString(schedDate);

  return `
    <div class="scheduler-card">
      <div style="display:flex; align-items:center; gap:16px;">
        <div class="scheduler-time-badge">
          <span class="scheduler-date-text">${dateStr}</span>
          <span class="scheduler-hour-text">${timeStr}</span>
          <span class="scheduler-tz-text">${escapeHtml(s.timezone || 'Asia/Kolkata')}</span>
          <span class="scheduler-countdown">${countdown}</span>
        </div>

        <div>
          <div style="font-weight:700; font-size:16px; color:var(--color-navy-deep);">${escapeHtml(s.title)}</div>
          <div style="font-size:13px; color:var(--color-text-muted); margin-top:2px;">
            ${escapeHtml(s.novelTitle)} • Episode ${escapeHtml(s.episodeNumber)}
          </div>
          <div style="font-size:11px; color:var(--color-gold-warm); margin-top:4px;">
            🔒 Private & hidden from public until release time
          </div>
        </div>
      </div>

      <div style="display:flex; align-items:center; gap:8px;">
        <button class="btn btn-gold btn-sm" onclick="publishScheduledNowAction(${s.id})" title="Publish live immediately">
          🚀 Publish Now
        </button>
        <button class="btn btn-outline btn-sm" onclick="editEpisodeInEditor(${s.id})" title="Reschedule or Edit">
          ✏️ Edit Schedule
        </button>
        <button class="btn btn-outline btn-sm" onclick="cancelScheduleAction(${s.id})" style="color:#EF4444;" title="Cancel schedule (revert to draft)">
          ✕ Cancel
        </button>
      </div>
    </div>
  `;
}

window.publishScheduledNowAction = async (episodeId) => {
  if (!confirm('Publish this episode immediately to readers?')) return;
  try {
    const res = await apiFetch(`/api/admin/scheduler/${episodeId}/publish-now`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok || !data.success) {
      showToast(data.error || 'Failed to publish episode.');
      return;
    }
    showToast('Episode published immediately to the public website!');
    switchAdminTab('scheduler');
  } catch (err) {
    showToast('Error publishing: ' + err.message);
  }
};

window.cancelScheduleAction = async (episodeId) => {
  if (!confirm('Cancel schedule and revert episode to draft?')) return;
  try {
    const res = await apiFetch(`/api/admin/scheduler/${episodeId}/cancel`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok || !data.success) {
      showToast(data.error || 'Failed to cancel schedule.');
      return;
    }
    showToast('Schedule cancelled. Episode saved as draft.');
    switchAdminTab('scheduler');
  } catch (err) {
    showToast('Error cancelling schedule: ' + err.message);
  }
};

/* ========================================================
   8. MEDIA / IMAGE MANAGEMENT TAB
   ======================================================== */
async function renderMediaTab(canvas) {
  canvas.innerHTML = `
    <div class="admin-page-header">
      <div class="admin-page-title-group">
        <h1 class="admin-page-title">Media</h1>
        <p class="admin-page-subtitle">Upload and manage novel covers, banners, and illustrations.</p>
      </div>
      <div class="admin-page-actions">
        <button type="button" class="btn btn-gold btn-sm" onclick="triggerMediaFileInput()">+ Upload Image</button>
      </div>
    </div>

    <!-- Drag & Drop Upload Zone -->
    <div class="media-uploader-zone" id="media-drop-zone" onclick="triggerMediaFileInput()">
      <div style="font-size:2.5rem; margin-bottom:8px;">📁</div>
      <div style="font-weight:700; font-size:15px; color:var(--color-navy-deep);">Click to Upload or Drag and Drop Images</div>
      <div style="font-size:12px; color:var(--color-text-muted); margin-top:4px;">Supports PNG, JPG, WebP, GIF up to 10MB</div>
      <input type="file" id="media-file-input" style="display:none;" accept="image/*" onchange="handleMediaUpload(this.files[0])">
    </div>

    <!-- Gallery Grid -->
    <div id="media-gallery-mount">
      <div style="text-align:center; padding:30px; color:var(--color-text-muted);">
        Loading media gallery...
      </div>
    </div>
  `;

  window.triggerMediaFileInput = () => {
    document.getElementById('media-file-input')?.click();
  };

  window.handleMediaUpload = async (file) => {
    if (!file) return;
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      showToast('Image size exceeds 10MB limit.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      showToast('Uploading image asset...');
      try {
        const res = await apiFetch('/api/admin/media/upload', {
          method: 'POST',
          body: JSON.stringify({
            data: e.target.result,
            filename: file.name
          })
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          showToast(data.error || 'Upload failed.');
          return;
        }
        showToast('Image uploaded successfully!');
        loadAndRenderMediaGallery();
      } catch (err) {
        showToast('Upload error: ' + err.message);
      }
    };
    reader.readAsDataURL(file);
  };

  loadAndRenderMediaGallery();
}

async function loadAndRenderMediaGallery() {
  const mount = document.getElementById('media-gallery-mount');
  if (!mount) return;

  try {
    const res = await apiFetch('/api/admin/media?limit=60');
    const data = await res.json();
    adminState.mediaList = data.media || [];

    if (!adminState.mediaList || adminState.mediaList.length === 0) {
      mount.innerHTML = `
        <div style="text-align:center; padding:40px; color:var(--color-text-muted); font-size:14px;">
          No media uploaded yet. Drop an image above to start building your gallery!
        </div>
      `;
      return;
    }

    mount.innerHTML = `
      <div class="media-gallery-grid">
        ${adminState.mediaList.map(m => `
          <div class="media-item-card">
            <img src="${m.url}" class="media-item-preview" alt="${escapeHtml(m.originalName)}" loading="lazy">
            <div class="media-item-info">
              <div>
                <div class="media-item-name" title="${escapeHtml(m.originalName)}">${escapeHtml(m.originalName)}</div>
                <div class="media-item-meta">${m.formattedSize} • ${m.mimeType.replace('image/', '')}</div>
              </div>
              <div class="media-item-actions">
                <button class="btn btn-outline btn-sm" style="flex:1; font-size:11px;" onclick="copyMediaUrl('${m.url}')">
                  📋 Copy URL
                </button>
                <button class="btn btn-outline btn-sm" style="color:#EF4444; font-size:11px;" onclick="deleteMediaAction(${m.id})">
                  🗑️
                </button>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  } catch (err) {
    mount.innerHTML = `<div style="color:#EF4444; padding:20px;">Failed to load media: ${err.message}</div>`;
  }
}

window.copyMediaUrl = (url) => {
  navigator.clipboard.writeText(url).then(() => {
    showToast('Media URL copied to clipboard: ' + url);
  }).catch(() => {
    prompt('Copy image URL:', url);
  });
};

window.deleteMediaAction = async (mediaId) => {
  if (!confirm('Permanently delete this media asset?')) return;
  try {
    const res = await apiFetch(`/api/admin/media/${mediaId}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast('Media asset deleted.');
      loadAndRenderMediaGallery();
    }
  } catch (err) {
    showToast('Failed to delete media: ' + err.message);
  }
};

/* ========================================================
   9. SETTINGS & LOGOUT TAB
   ======================================================== */
async function renderSettingsTab(canvas) {
  canvas.innerHTML = `
    <div class="admin-page-header">
      <div class="admin-page-title-group">
        <h1 class="admin-page-title">Settings</h1>
        <p class="admin-page-subtitle">Author identity and publishing defaults.</p>
      </div>
    </div>

    <div style="max-width:680px; background:#FFFDF8; border:1px solid var(--color-border); border-radius:var(--radius-lg); padding:var(--space-6);">
      <form onsubmit="event.preventDefault(); submitSiteSettings();">
        <div class="form-group" style="margin-bottom:16px;">
          <label class="form-label" style="font-weight:700; color:var(--color-navy-deep); font-size:13px; margin-bottom:6px; display:block;">
            Author / Pen Name
          </label>
          <input type="text" id="setting-author-name" class="form-input" value="Rudhra Prarthana" required>
        </div>

        <div class="form-group" style="margin-bottom:16px;">
          <label class="form-label" style="font-weight:700; color:var(--color-navy-deep); font-size:13px; margin-bottom:6px; display:block;">
            Default Publishing Timezone
          </label>
          <select id="setting-default-tz" class="form-input">
            <option value="Asia/Kolkata" selected>India Standard Time (IST - Asia/Kolkata)</option>
            <option value="UTC">Coordinated Universal Time (UTC)</option>
            <option value="America/New_York">Eastern Time (EST - New York)</option>
            <option value="Europe/London">Greenwich Mean Time (GMT - London)</option>
          </select>
        </div>

        <div class="form-group" style="margin-bottom:20px;">
          <label class="form-label" style="font-weight:700; color:var(--color-navy-deep); font-size:13px; margin-bottom:6px; display:block;">
            Website Literary Title
          </label>
          <input type="text" id="setting-site-title" class="form-input" value="Rudhra Prarthana Novels" required>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--color-border-light); padding-top:18px;">
          <button type="submit" class="btn btn-gold">💾 Save Settings</button>
          <button type="button" class="btn btn-outline" style="color:#EF4444; border-color:#FCA5A5;" onclick="handleAdminLogout()">
            🚪 Secure Admin Logout
          </button>
        </div>
      </form>
    </div>
  `;

  window.submitSiteSettings = async () => {
    const authorName = document.getElementById('setting-author-name')?.value?.trim();
    const defaultTz = document.getElementById('setting-default-tz')?.value;
    const siteTitle = document.getElementById('setting-site-title')?.value?.trim();

    try {
      const res = await apiFetch('/api/admin/settings', {
        method: 'POST',
        body: JSON.stringify({
          author_name: authorName,
          default_timezone: defaultTz,
          site_title: siteTitle
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Settings saved successfully!');
      }
    } catch (err) {
      showToast('Failed to save settings: ' + err.message);
    }
  };
}

/* ========================================================
   9. WRITER MANAGEMENT TAB & MODALS
   ======================================================== */
async function renderWritersTab(canvas) {
  canvas.innerHTML = `
    <div style="text-align:center; padding:40px 20px; color:var(--color-text-muted);">
      <div style="width:36px; height:36px; border:3px solid #E2E8F0; border-top-color:#B88635; border-radius:50%; animation:adminSpinner 0.8s linear infinite; margin:0 auto 12px;"></div>
      <div>Loading Writer Accounts...</div>
    </div>
  `;

  try {
    const res = await apiFetch('/api/admin/writers');
    if (!res.ok) {
      throw new Error('Failed to retrieve writers from backend');
    }
    const data = await res.json();
    adminState.writers = data.writers || [];

    const badge = document.getElementById('nav-writers-count');
    if (badge) badge.textContent = data.total !== undefined ? data.total : adminState.writers.length;

    renderWritersListUI(canvas);
  } catch (err) {
    console.error('Error fetching writers:', err);
    canvas.innerHTML = `
      <div class="admin-card" style="text-align:center; padding:40px 20px;">
        <div style="font-size:36px; margin-bottom:12px;">⚠️</div>
        <h3 style="color:#DC2626; margin-bottom:8px;">Failed to Load Writers</h3>
        <p style="color:var(--color-text-muted); font-size:14px; margin-bottom:16px;">${escapeHtml(err.message)}</p>
        <button class="btn btn-outline" onclick="renderWritersTab(document.getElementById('admin-main-canvas'))">
          ↻ Retry Loading
        </button>
      </div>
    `;
  }
}

function renderWritersListUI(canvas) {
  const filter = adminState.writersFilter || { search: '', status: 'all' };
  const searchLower = (filter.search || '').toLowerCase().trim();

  const filteredWriters = (adminState.writers || []).filter(w => {
    const matchesSearch = !searchLower || 
      (w.name || '').toLowerCase().includes(searchLower) ||
      (w.email || '').toLowerCase().includes(searchLower) ||
      (w.username || '').toLowerCase().includes(searchLower);

    const matchesStatus = filter.status === 'all' || w.status === filter.status;
    return matchesSearch && matchesStatus;
  });

  const activeCount = adminState.writers.filter(w => w.status === 'active').length;
  const blockedCount = adminState.writers.filter(w => w.status === 'blocked').length;

  canvas.innerHTML = `
    <div class="admin-page-header">
      <div>
        <h2 class="admin-page-title">Writer Management</h2>
        <p class="admin-page-subtitle">Create, monitor, and manage authorized writer accounts, assigned novels, and security access.</p>
      </div>
      <div class="admin-header-actions" style="display:flex; gap:10px; flex-wrap:wrap;">
        <button type="button" class="btn btn-outline" onclick="openWriterAuditLogsModal(null)" title="View recent administrative and security audit activity">
          ${ADMIN_ICONS.history}
          <span>Audit Logs</span>
        </button>
        <button type="button" class="btn btn-gold" onclick="openCreateWriterModal()" id="btn-create-writer">
          ${ADMIN_ICONS.userPlus}
          <span>+ Create Writer</span>
        </button>
      </div>
    </div>

    <!-- Metrics Strip -->
    <div class="admin-stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); margin-bottom:20px;">
      <div class="admin-stat-card">
        <div class="stat-meta">
          <span class="stat-label">Total Writers</span>
          <span class="stat-value">${adminState.writers.length}</span>
        </div>
      </div>
      <div class="admin-stat-card">
        <div class="stat-meta">
          <span class="stat-label">Active Writers</span>
          <span class="stat-value" style="color:#16A34A;">${activeCount}</span>
        </div>
      </div>
      <div class="admin-stat-card">
        <div class="stat-meta">
          <span class="stat-label">Temporarily Blocked</span>
          <span class="stat-value" style="color:#DC2626;">${blockedCount}</span>
        </div>
      </div>
    </div>

    <!-- Search & Filter Bar -->
    <div class="admin-card" style="margin-bottom:20px; padding:16px;">
      <div style="display:flex; justify-content:space-between; align-items:center; gap:16px; flex-wrap:wrap;">
        <div style="position:relative; flex:1; min-width:240px; max-width:420px;">
          <input type="text" id="writer-search-input" class="form-input" 
                 placeholder="Search by writer name or email..." 
                 value="${escapeHtml(filter.search || '')}"
                 oninput="handleWriterSearchInput(this.value)"
                 style="width:100%; padding:9px 12px 9px 36px; font-size:13.5px; border-radius:8px;">
          <span style="position:absolute; left:12px; top:50%; transform:translateY(-50%); color:#94A3B8; pointer-events:none;">
            ${ADMIN_ICONS.search}
          </span>
          ${filter.search ? `<button type="button" onclick="clearWriterSearch()" style="position:absolute; right:10px; top:50%; transform:translateY(-50%); background:none; border:none; color:#94A3B8; cursor:pointer; font-size:14px;">✕</button>` : ''}
        </div>

        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-size:13px; font-weight:600; color:var(--color-navy-deep);">Status:</span>
          <div class="btn-group" style="display:flex; gap:4px;">
            <button type="button" class="btn ${filter.status === 'all' ? 'btn-gold' : 'btn-outline'}" 
                    style="padding:6px 14px; font-size:12.5px; border-radius:6px;"
                    onclick="filterWritersByStatus('all')">
              All (${adminState.writers.length})
            </button>
            <button type="button" class="btn ${filter.status === 'active' ? 'btn-gold' : 'btn-outline'}" 
                    style="padding:6px 14px; font-size:12.5px; border-radius:6px;"
                    onclick="filterWritersByStatus('active')">
              Active (${activeCount})
            </button>
            <button type="button" class="btn ${filter.status === 'blocked' ? 'btn-gold' : 'btn-outline'}" 
                    style="padding:6px 14px; font-size:12.5px; border-radius:6px;"
                    onclick="filterWritersByStatus('blocked')">
              Blocked (${blockedCount})
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Writers Table Container -->
    <div class="admin-card" style="padding:0; overflow:hidden;">
      <div class="admin-table-responsive" style="overflow-x:auto;">
        <table class="admin-table" style="width:100%; border-collapse:collapse; text-align:left; font-size:13.5px;">
          <thead>
            <tr style="background:#F8FAFC; border-bottom:1px solid var(--color-border); color:var(--color-navy-deep); font-weight:700;">
              <th style="padding:14px 16px;">Writer</th>
              <th style="padding:14px 16px;">Email</th>
              <th style="padding:14px 16px; text-align:center;">Status</th>
              <th style="padding:14px 16px; text-align:center;">Novels</th>
              <th style="padding:14px 16px; text-align:center;">Episodes</th>
              <th style="padding:14px 16px;">Last Login</th>
              <th style="padding:14px 16px;">Created Date</th>
              <th style="padding:14px 16px; text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${filteredWriters.length === 0 ? `
              <tr>
                <td colspan="8" style="padding:48px 16px; text-align:center; color:var(--color-text-muted);">
                  <div style="font-size:32px; margin-bottom:8px;">✍️</div>
                  <div style="font-weight:600; color:var(--color-navy-deep); font-size:15px; margin-bottom:4px;">No Writer Accounts Found</div>
                  <div style="font-size:13px; max-width:400px; margin:0 auto 16px;">${filter.search || filter.status !== 'all' ? 'Try adjusting your search query or status filter.' : 'No writer accounts have been created yet. Click "+ Create Writer" to add an author.'}</div>
                  ${filter.search || filter.status !== 'all' ? `
                    <button class="btn btn-outline" style="font-size:12.5px;" onclick="clearWriterFilters()">Reset Filters</button>
                  ` : `
                    <button class="btn btn-gold" style="font-size:12.5px;" onclick="openCreateWriterModal()">+ Create First Writer</button>
                  `}
                </td>
              </tr>
            ` : filteredWriters.map(w => {
              const isBlocked = w.status === 'blocked';
              const createdDate = w.createdAt ? new Date(w.createdAt).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' }) : '—';
              const lastLogin = w.lastLogin ? new Date(w.lastLogin).toLocaleDateString('en-US', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }) : 'Never';

              return `
                <tr style="border-bottom:1px solid var(--color-border-light); transition:background 0.15s ease;" onmouseover="this.style.background='#F8FAFC'" onmouseout="this.style.background='transparent'">
                  <!-- Writer Name & Avatar -->
                  <td style="padding:14px 16px;">
                    <div style="display:flex; align-items:center; gap:12px;">
                      <div style="width:38px; height:38px; border-radius:50%; overflow:hidden; background:#E2E8F0; display:flex; align-items:center; justify-content:center; flex-shrink:0; border:1px solid var(--color-border);">
                        ${w.avatar ? `
                          <img src="${escapeHtml(w.avatar)}" alt="${escapeHtml(w.name)}" style="width:100%; height:100%; object-fit:cover;" onerror="this.onerror=null; this.parentElement.innerHTML='<span style=\\'font-weight:700; color:var(--color-navy-deep);\\'>${escapeHtml((w.name||'W')[0].toUpperCase())}</span>';">
                        ` : `
                          <span style="font-weight:700; color:var(--color-navy-deep); font-size:14px;">${escapeHtml((w.name || w.username || 'W')[0].toUpperCase())}</span>
                        `}
                      </div>
                      <div>
                        <div style="font-weight:700; color:var(--color-navy-deep); font-size:14px;">
                          ${escapeHtml(w.name || w.username)}
                        </div>
                        <div style="font-size:12px; color:var(--color-text-muted);">
                          @${escapeHtml(w.username)}
                        </div>
                      </div>
                    </div>
                  </td>

                  <!-- Email -->
                  <td style="padding:14px 16px; color:#475569;">
                    <span style="font-family:monospace; font-size:13px;">${escapeHtml(w.email)}</span>
                  </td>

                  <!-- Status -->
                  <td style="padding:14px 16px; text-align:center;">
                    ${isBlocked ? `
                      <span class="badge" style="background:#FEE2E2; color:#DC2626; border:1px solid #FCA5A5; padding:3px 10px; border-radius:12px; font-weight:700; font-size:11.5px; display:inline-flex; align-items:center; gap:4px;">
                        <span style="width:6px; height:6px; border-radius:50%; background:#DC2626;"></span>
                        Blocked
                      </span>
                    ` : `
                      <span class="badge" style="background:#DCFCE7; color:#15803D; border:1px solid #86EFAC; padding:3px 10px; border-radius:12px; font-weight:700; font-size:11.5px; display:inline-flex; align-items:center; gap:4px;">
                        <span style="width:6px; height:6px; border-radius:50%; background:#16A34A;"></span>
                        Active
                      </span>
                    `}
                  </td>

                  <!-- Created Novels Count -->
                  <td style="padding:14px 16px; text-align:center;">
                    <span style="font-weight:700; color:var(--color-navy-deep); background:#F1F5F9; padding:2px 8px; border-radius:6px;">
                      ${w.novelsCount || 0}
                    </span>
                  </td>

                  <!-- Published Episodes Count -->
                  <td style="padding:14px 16px; text-align:center;">
                    <span style="font-weight:600; color:#475569;">
                      ${w.episodesCount || 0}
                    </span>
                  </td>

                  <!-- Last Login -->
                  <td style="padding:14px 16px; font-size:12.5px; color:#64748B;">
                    ${lastLogin}
                  </td>

                  <!-- Created Date -->
                  <td style="padding:14px 16px; font-size:12.5px; color:#64748B;">
                    ${createdDate}
                  </td>

                  <!-- Actions -->
                  <td style="padding:14px 16px; text-align:right;">
                    <div style="display:inline-flex; align-items:center; gap:6px;">
                      <button type="button" class="btn btn-outline" 
                              style="padding:5px 9px; font-size:12px; border-radius:6px;"
                              title="Edit Writer Profile" 
                              onclick="openEditWriterModal(${w.id})">
                        ${ADMIN_ICONS.edit}
                      </button>

                      ${isBlocked ? `
                        <button type="button" class="btn btn-outline" 
                                style="padding:5px 9px; font-size:12px; color:#16A34A; border-color:#86EFAC; border-radius:6px;"
                                title="Reactivate Account" 
                                onclick="toggleWriterStatus(${w.id}, 'active', '${escapeHtml(w.name || w.username)}')">
                          ${ADMIN_ICONS.unlock}
                        </button>
                      ` : `
                        <button type="button" class="btn btn-outline" 
                                style="padding:5px 9px; font-size:12px; color:#DC2626; border-color:#FCA5A5; border-radius:6px;"
                                title="Block Account" 
                                onclick="toggleWriterStatus(${w.id}, 'blocked', '${escapeHtml(w.name || w.username)}')">
                          ${ADMIN_ICONS.lock}
                        </button>
                      `}

                      <button type="button" class="btn btn-outline" 
                              style="padding:5px 9px; font-size:12px; border-radius:6px;"
                              title="View Account Audit Trail" 
                              onclick="openWriterAuditLogsModal(${w.id})">
                        ${ADMIN_ICONS.history}
                      </button>

                      <button type="button" class="btn btn-outline" 
                              style="padding:5px 9px; font-size:12px; color:#EF4444; border-color:#FCA5A5; border-radius:6px;"
                              title="Delete Account Safely" 
                              onclick="confirmDeleteWriterModal(${w.id})">
                        ${ADMIN_ICONS.trash}
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

    <!-- Mount Point for Writer Modals -->
    <div id="writer-modal-mount"></div>
  `;
}

// Global Writer Search & Filter Handlers
window.handleWriterSearchInput = (val) => {
  adminState.writersFilter = adminState.writersFilter || {};
  adminState.writersFilter.search = val;
  const canvas = document.getElementById('admin-main-canvas');
  if (canvas) renderWritersListUI(canvas);
};

window.clearWriterSearch = () => {
  adminState.writersFilter = adminState.writersFilter || {};
  adminState.writersFilter.search = '';
  const canvas = document.getElementById('admin-main-canvas');
  if (canvas) renderWritersListUI(canvas);
};

window.filterWritersByStatus = (status) => {
  adminState.writersFilter = adminState.writersFilter || {};
  adminState.writersFilter.status = status;
  const canvas = document.getElementById('admin-main-canvas');
  if (canvas) renderWritersListUI(canvas);
};

window.clearWriterFilters = () => {
  adminState.writersFilter = { search: '', status: 'all' };
  const canvas = document.getElementById('admin-main-canvas');
  if (canvas) renderWritersListUI(canvas);
};

/* ========================================================
   10. WRITER MODALS: CREATE, EDIT, STATUS, DELETE, AUDIT
   ======================================================== */

window.closeWriterModal = () => {
  const mount = document.getElementById('writer-modal-mount');
  if (mount) mount.innerHTML = '';
};

// 1. CREATE WRITER MODAL
window.openCreateWriterModal = () => {
  const mount = document.getElementById('writer-modal-mount');
  if (!mount) return;

  mount.innerHTML = `
    <div class="modal-overlay open" id="create-writer-modal" onclick="if(event.target === this) closeWriterModal();">
      <div class="modal-card admin-modal-card" style="max-width:540px;">
        <div class="modal-header">
          <div style="display:flex; align-items:center; gap:10px;">
            <div style="width:36px; height:36px; border-radius:8px; background:#FAF5EC; display:flex; align-items:center; justify-content:center; color:var(--color-gold-warm);">
              ${ADMIN_ICONS.userPlus}
            </div>
            <div>
              <h3 class="modal-title" style="margin:0; font-size:1.15rem;">Create Writer Account</h3>
              <p style="margin:2px 0 0; font-size:12px; color:var(--color-text-muted);">Register a new authorized author with a dedicated writing workspace.</p>
            </div>
          </div>
          <button class="modal-close-btn" onclick="closeWriterModal()" aria-label="Close modal">✕</button>
        </div>

        <div class="modal-body" style="padding:24px;">
          <div id="create-writer-error" style="display:none; color:#EF4444; background:#FEF2F2; border:1px solid #FCA5A5; padding:10px 14px; border-radius:8px; font-size:13px; margin-bottom:16px; font-weight:600;"></div>

          <form onsubmit="event.preventDefault(); submitCreateWriterForm();">
            <div class="form-group" style="margin-bottom:16px;">
              <label class="form-label" style="font-weight:700; color:var(--color-navy-deep); font-size:13px; margin-bottom:6px; display:block;">
                Writer's Full Name <span style="color:#DC2626;">*</span>
              </label>
              <input type="text" id="cw-fullname" class="form-input" 
                     placeholder="e.g. Kavitha Ramasamy" required autofocus
                     style="width:100%; padding:10px 14px; border:1px solid var(--color-border); border-radius:8px; font-size:14px;">
              <div style="font-size:11.5px; color:#64748B; margin-top:4px;">This display name will be displayed on writer's novels and episodes.</div>
            </div>

            <div class="form-group" style="margin-bottom:16px;">
              <label class="form-label" style="font-weight:700; color:var(--color-navy-deep); font-size:13px; margin-bottom:6px; display:block;">
                Email Address <span style="color:#DC2626;">*</span>
              </label>
              <input type="email" id="cw-email" class="form-input" 
                     placeholder="writer@example.com" required autocomplete="email"
                     style="width:100%; padding:10px 14px; border:1px solid var(--color-border); border-radius:8px; font-size:14px;">
              <div style="font-size:11.5px; color:#64748B; margin-top:4px;">Must be unique. The writer will use this email for portal login and OTP resets.</div>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:16px;">
              <div class="form-group">
                <label class="form-label" style="font-weight:700; color:var(--color-navy-deep); font-size:13px; margin-bottom:6px; display:block;">
                  Initial Password <span style="color:#DC2626;">*</span>
                </label>
                <div style="position:relative; display:flex; align-items:center;">
                  <input type="password" id="cw-password" class="form-input" 
                         placeholder="Min 6 characters" required minlength="6"
                         style="width:100%; padding:10px 38px 10px 14px; border:1px solid var(--color-border); border-radius:8px; font-size:14px;">
                  <button type="button" onclick="toggleAdminPasswordVis('cw-password')" 
                          style="position:absolute; right:8px; background:none; border:none; cursor:pointer; color:#94A3B8; padding:4px;">
                    👁️
                  </button>
                </div>
              </div>

              <div class="form-group">
                <label class="form-label" style="font-weight:700; color:var(--color-navy-deep); font-size:13px; margin-bottom:6px; display:block;">
                  Confirm Password <span style="color:#DC2626;">*</span>
                </label>
                <input type="password" id="cw-confirm-password" class="form-input" 
                       placeholder="Re-enter password" required minlength="6"
                       style="width:100%; padding:10px 14px; border:1px solid var(--color-border); border-radius:8px; font-size:14px;">
              </div>
            </div>

            <div class="form-group" style="margin-bottom:16px;">
              <label class="form-label" style="font-weight:700; color:var(--color-navy-deep); font-size:13px; margin-bottom:6px; display:block;">
                Initial Account Status
              </label>
              <select id="cw-status" class="form-input" style="width:100%; padding:10px 14px; border:1px solid var(--color-border); border-radius:8px; font-size:14px;">
                <option value="active" selected>Active (Can log in immediately)</option>
                <option value="blocked">Temporarily Blocked (Access disabled)</option>
              </select>
            </div>

            <div class="form-group" style="margin-bottom:20px;">
              <label class="form-label" style="font-weight:700; color:var(--color-navy-deep); font-size:13px; margin-bottom:6px; display:block;">
                Profile Avatar URL (Optional)
              </label>
              <input type="url" id="cw-avatar" class="form-input" 
                     placeholder="https://example.com/avatar.jpg"
                     style="width:100%; padding:10px 14px; border:1px solid var(--color-border); border-radius:8px; font-size:14px;">
            </div>

            <!-- Security Notice Banner -->
            <div style="background:#FFFBEB; border:1px solid #FDE68A; border-radius:8px; padding:12px 14px; margin-bottom:20px; font-size:12.5px; color:#92400E; line-height:1.5;">
              <div style="font-weight:700; display:flex; align-items:center; gap:6px; margin-bottom:2px;">
                🛡️ Credential Security Best Practice
              </div>
              Passwords are salted and cryptographically hashed before storing in MySQL. Securely communicate the initial credentials to the writer, and encourage them to reset their password via email OTP upon first login.
            </div>

            <div style="display:flex; justify-content:flex-end; gap:10px; border-top:1px solid var(--color-border-light); padding-top:16px;">
              <button type="button" class="btn btn-outline" onclick="closeWriterModal()">Cancel</button>
              <button type="submit" id="cw-submit-btn" class="btn btn-gold" style="font-weight:700; padding:10px 20px;">
                ✓ Create Writer Account
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
};

window.submitCreateWriterForm = async () => {
  const fullName = document.getElementById('cw-fullname')?.value?.trim();
  const email = document.getElementById('cw-email')?.value?.trim();
  const password = document.getElementById('cw-password')?.value;
  const confirmPassword = document.getElementById('cw-confirm-password')?.value;
  const status = document.getElementById('cw-status')?.value || 'active';
  const avatarUrl = document.getElementById('cw-avatar')?.value?.trim() || null;
  const errorEl = document.getElementById('create-writer-error');
  const submitBtn = document.getElementById('cw-submit-btn');

  if (errorEl) errorEl.style.display = 'none';

  if (!fullName || !email || !password) {
    if (errorEl) {
      errorEl.textContent = 'Please fill out all required fields.';
      errorEl.style.display = 'block';
    }
    return;
  }

  if (password.length < 6) {
    if (errorEl) {
      errorEl.textContent = 'Password must be at least 6 characters long.';
      errorEl.style.display = 'block';
    }
    return;
  }

  if (password !== confirmPassword) {
    if (errorEl) {
      errorEl.textContent = 'Initial password and confirm password do not match.';
      errorEl.style.display = 'block';
    }
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating Account in MySQL...';
  }

  try {
    const res = await apiFetch('/api/admin/writers', {
      method: 'POST',
      body: JSON.stringify({
        fullName,
        email,
        password,
        status,
        avatarUrl
      })
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      if (errorEl) {
        errorEl.textContent = data.error || 'Failed to create writer account.';
        errorEl.style.display = 'block';
      }
      return;
    }

    showToast(`Writer account "${fullName}" successfully created! 🎉`);
    closeWriterModal();

    // Reload writers list
    const canvas = document.getElementById('admin-main-canvas');
    if (canvas) renderWritersTab(canvas);
  } catch (err) {
    console.error('Create writer error:', err);
    if (errorEl) {
      errorEl.textContent = err.message || 'Error communicating with server.';
      errorEl.style.display = 'block';
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = '✓ Create Writer Account';
    }
  }
};

// 2. EDIT WRITER MODAL
window.openEditWriterModal = async (writerId) => {
  const mount = document.getElementById('writer-modal-mount');
  if (!mount) return;

  const writer = adminState.writers.find(w => w.id === writerId);
  if (!writer) {
    showToast('Writer not found');
    return;
  }

  mount.innerHTML = `
    <div class="modal-overlay open" id="edit-writer-modal" onclick="if(event.target === this) closeWriterModal();">
      <div class="modal-card admin-modal-card" style="max-width:520px;">
        <div class="modal-header">
          <div style="display:flex; align-items:center; gap:10px;">
            <div style="width:36px; height:36px; border-radius:8px; background:#FAF5EC; display:flex; align-items:center; justify-content:center; color:var(--color-gold-warm);">
              ${ADMIN_ICONS.edit}
            </div>
            <div>
              <h3 class="modal-title" style="margin:0; font-size:1.15rem;">Edit Writer Profile</h3>
              <p style="margin:2px 0 0; font-size:12px; color:var(--color-text-muted);">${escapeHtml(writer.name || writer.username)} (@${escapeHtml(writer.username)})</p>
            </div>
          </div>
          <button class="modal-close-btn" onclick="closeWriterModal()" aria-label="Close modal">✕</button>
        </div>

        <div class="modal-body" style="padding:24px;">
          <div id="edit-writer-error" style="display:none; color:#EF4444; background:#FEF2F2; border:1px solid #FCA5A5; padding:10px 14px; border-radius:8px; font-size:13px; margin-bottom:16px; font-weight:600;"></div>

          <form onsubmit="event.preventDefault(); submitEditWriterProfile(${writerId});">
            <div class="form-group" style="margin-bottom:16px;">
              <label class="form-label" style="font-weight:700; color:var(--color-navy-deep); font-size:13px; margin-bottom:6px; display:block;">
                Display Name <span style="color:#DC2626;">*</span>
              </label>
              <input type="text" id="ew-fullname" class="form-input" 
                     value="${escapeHtml(writer.name || writer.username || '')}" required
                     style="width:100%; padding:10px 14px; border:1px solid var(--color-border); border-radius:8px; font-size:14px;">
            </div>

            <div class="form-group" style="margin-bottom:16px;">
              <label class="form-label" style="font-weight:700; color:var(--color-navy-deep); font-size:13px; margin-bottom:6px; display:block;">
                Writer Bio / Author Note
              </label>
              <textarea id="ew-bio" class="form-input" rows="3" 
                        placeholder="Short biography or literary introduction..."
                        style="width:100%; padding:10px 14px; border:1px solid var(--color-border); border-radius:8px; font-size:14px;">${escapeHtml(writer.bio || '')}</textarea>
            </div>

            <div class="form-group" style="margin-bottom:20px;">
              <label class="form-label" style="font-weight:700; color:var(--color-navy-deep); font-size:13px; margin-bottom:6px; display:block;">
                Avatar Image URL
              </label>
              <input type="url" id="ew-avatar" class="form-input" 
                     value="${escapeHtml(writer.avatar || '')}" placeholder="https://example.com/avatar.jpg"
                     style="width:100%; padding:10px 14px; border:1px solid var(--color-border); border-radius:8px; font-size:14px;">
            </div>

            <div style="display:flex; justify-content:flex-end; gap:10px; border-top:1px solid var(--color-border-light); padding-top:16px;">
              <button type="button" class="btn btn-outline" onclick="closeWriterModal()">Cancel</button>
              <button type="submit" id="ew-submit-btn" class="btn btn-gold" style="font-weight:700; padding:10px 20px;">
                Save Profile Changes
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
};

window.submitEditWriterProfile = async (writerId) => {
  const fullName = document.getElementById('ew-fullname')?.value?.trim();
  const bio = document.getElementById('ew-bio')?.value?.trim() || '';
  const avatarUrl = document.getElementById('ew-avatar')?.value?.trim() || null;
  const errorEl = document.getElementById('edit-writer-error');
  const submitBtn = document.getElementById('ew-submit-btn');

  if (!fullName) {
    if (errorEl) {
      errorEl.textContent = 'Display name is required.';
      errorEl.style.display = 'block';
    }
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';
  }

  try {
    const res = await apiFetch(`/api/admin/writers/${writerId}/profile`, {
      method: 'PUT',
      body: JSON.stringify({ fullName, bio, avatarUrl })
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      if (errorEl) {
        errorEl.textContent = data.error || 'Failed to update profile.';
        errorEl.style.display = 'block';
      }
      return;
    }

    showToast('Writer profile updated successfully!');
    closeWriterModal();

    const canvas = document.getElementById('admin-main-canvas');
    if (canvas) renderWritersTab(canvas);
  } catch (err) {
    if (errorEl) {
      errorEl.textContent = err.message || 'Error updating writer profile.';
      errorEl.style.display = 'block';
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Save Profile Changes';
    }
  }
};

// 3. TOGGLE WRITER STATUS (BLOCK / REACTIVATE)
window.toggleWriterStatus = async (writerId, newStatus, writerName) => {
  const isBlocking = newStatus === 'blocked';
  const actionText = isBlocking ? 'temporarily block' : 'reactivate';
  const confirmMsg = isBlocking
    ? `Are you sure you want to temporarily block "${writerName}"?\n\n• The writer's active login sessions will be immediately invalidated.\n• They will be prevented from accessing the Writer Workspace.\n• Their existing novels and episodes will remain safely preserved.`
    : `Reactivate writer "${writerName}"?\n\nThis will restore their ability to log in and access their writing workspace.`;

  if (!confirm(confirmMsg)) return;

  const reason = prompt(`Optional reason for ${actionText}ing this writer:`, isBlocking ? 'Administrative review' : 'Account reactivated');

  try {
    const res = await apiFetch(`/api/admin/writers/${writerId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status: newStatus, reason: reason || null })
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      showToast(data.error || `Failed to ${actionText} writer account.`);
      return;
    }

    showToast(`Writer account "${writerName}" is now ${newStatus}!`);
    const canvas = document.getElementById('admin-main-canvas');
    if (canvas) renderWritersTab(canvas);
  } catch (err) {
    showToast(`Error: ${err.message}`);
  }
};

// 4. CONFIRM DELETE WRITER MODAL (PRESERVES NOVELS)
window.confirmDeleteWriterModal = (writerId) => {
  const mount = document.getElementById('writer-modal-mount');
  if (!mount) return;

  const writer = adminState.writers.find(w => w.id === writerId);
  if (!writer) {
    showToast('Writer not found');
    return;
  }

  mount.innerHTML = `
    <div class="modal-overlay open" id="delete-writer-modal" onclick="if(event.target === this) closeWriterModal();">
      <div class="modal-card admin-modal-card" style="max-width:500px; border-top:4px solid #DC2626;">
        <div class="modal-header">
          <div style="display:flex; align-items:center; gap:10px;">
            <div style="width:36px; height:36px; border-radius:8px; background:#FEE2E2; display:flex; align-items:center; justify-content:center; color:#DC2626;">
              ${ADMIN_ICONS.trash}
            </div>
            <div>
              <h3 class="modal-title" style="margin:0; font-size:1.15rem; color:#991B1B;">Delete Writer Account</h3>
              <p style="margin:2px 0 0; font-size:12px; color:var(--color-text-muted);">Confirm permanent removal of account credentials.</p>
            </div>
          </div>
          <button class="modal-close-btn" onclick="closeWriterModal()" aria-label="Close modal">✕</button>
        </div>

        <div class="modal-body" style="padding:24px;">
          <div style="margin-bottom:16px;">
            <p style="font-size:14px; color:var(--color-navy-deep); line-height:1.6; margin:0 0 12px;">
              You are about to delete the writer account for <strong>${escapeHtml(writer.name || writer.username)}</strong> (<code>${escapeHtml(writer.email)}</code>).
            </p>
          </div>

          <!-- Content Preservation Safeguard Explanation -->
          <div style="background:#F0FDF4; border:1px solid #BBF7D0; border-radius:8px; padding:14px; margin-bottom:20px; font-size:12.5px; color:#166534; line-height:1.6;">
            <div style="font-weight:700; display:flex; align-items:center; gap:6px; margin-bottom:4px;">
              ✓ Content Integrity Safeguard
            </div>
            All <strong>${writer.novelsCount || 0} novels</strong> and associated episodes owned by this writer will <strong>NOT</strong> be deleted. They will be safely reassigned to the primary author (Rudhra Prarthana) so reader comments, bookmarks, and chapters remain intact.
          </div>

          <div style="display:flex; justify-content:flex-end; gap:10px;">
            <button type="button" class="btn btn-outline" onclick="closeWriterModal()">Cancel</button>
            <button type="button" id="delete-writer-confirm-btn" class="btn" 
                    style="background:#DC2626; color:#fff; font-weight:700; padding:10px 20px; border-radius:8px;"
                    onclick="submitDeleteWriterAccount(${writerId})">
              Delete Account & Preserve Content
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
};

window.submitDeleteWriterAccount = async (writerId) => {
  const btn = document.getElementById('delete-writer-confirm-btn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Deleting Safely...';
  }

  try {
    const res = await apiFetch(`/api/admin/writers/${writerId}`, {
      method: 'DELETE'
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      showToast(data.error || 'Failed to delete writer account.');
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Delete Account & Preserve Content';
      }
      return;
    }

    showToast('Writer account deleted safely. Novels preserved! 🛡️');
    closeWriterModal();

    const canvas = document.getElementById('admin-main-canvas');
    if (canvas) renderWritersTab(canvas);
  } catch (err) {
    showToast(`Error: ${err.message}`);
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Delete Account & Preserve Content';
    }
  }
};

// 5. VIEW WRITER AUDIT LOGS MODAL
window.openWriterAuditLogsModal = async (writerId) => {
  const mount = document.getElementById('writer-modal-mount');
  if (!mount) return;

  mount.innerHTML = `
    <div class="modal-overlay open" id="audit-logs-modal" onclick="if(event.target === this) closeWriterModal();">
      <div class="modal-card admin-modal-card" style="max-width:700px;">
        <div class="modal-header">
          <div style="display:flex; align-items:center; gap:10px;">
            <div style="width:36px; height:36px; border-radius:8px; background:#EFF6FF; display:flex; align-items:center; justify-content:center; color:#2563EB;">
              ${ADMIN_ICONS.history}
            </div>
            <div>
              <h3 class="modal-title" style="margin:0; font-size:1.15rem;">Writer Activity & Audit Trail</h3>
              <p style="margin:2px 0 0; font-size:12px; color:var(--color-text-muted);">Real-time database records of writer creations, logins, and status transitions.</p>
            </div>
          </div>
          <button class="modal-close-btn" onclick="closeWriterModal()" aria-label="Close modal">✕</button>
        </div>

        <div class="modal-body" style="padding:24px; max-height:65vh; overflow-y:auto;" id="audit-modal-body">
          <div style="text-align:center; padding:30px 0; color:var(--color-text-muted);">
            <div style="width:32px; height:32px; border:3px solid #E2E8F0; border-top-color:#B88635; border-radius:50%; animation:adminSpinner 0.8s linear infinite; margin:0 auto 10px;"></div>
            Loading audit logs from MySQL...
          </div>
        </div>

        <div class="modal-footer" style="padding:14px 24px; background:#F8FAFC; border-top:1px solid var(--color-border); display:flex; justify-content:flex-end;">
          <button type="button" class="btn btn-outline" onclick="closeWriterModal()">Close</button>
        </div>
      </div>
    </div>
  `;

  try {
    const url = writerId ? `/api/admin/writers/audit-logs?writerId=${writerId}` : '/api/admin/writers/audit-logs';
    const res = await apiFetch(url);
    const data = await res.json();
    const bodyEl = document.getElementById('audit-modal-body');
    if (!bodyEl) return;

    const logs = data.logs || [];
    if (logs.length === 0) {
      bodyEl.innerHTML = `
        <div style="text-align:center; padding:40px 0; color:var(--color-text-muted);">
          <div style="font-size:32px; margin-bottom:8px;">📋</div>
          <div style="font-weight:600; color:var(--color-navy-deep);">No audit events recorded yet</div>
          <div style="font-size:12.5px;">Activity events will be tracked as writer operations take place.</div>
        </div>
      `;
      return;
    }

    bodyEl.innerHTML = `
      <div class="audit-timeline" style="display:flex; flex-direction:column; gap:12px;">
        ${logs.map(log => {
          const dt = new Date(log.createdAt).toLocaleString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
          });

          let actionBadge = `<span style="background:#E2E8F0; color:#334155; font-size:11px; padding:2px 8px; border-radius:10px; font-weight:700;">${escapeHtml(log.action)}</span>`;
          if (log.action.includes('created')) {
            actionBadge = `<span style="background:#DCFCE7; color:#15803D; font-size:11px; padding:2px 8px; border-radius:10px; font-weight:700;">✓ Account Created</span>`;
          } else if (log.action.includes('blocked')) {
            actionBadge = `<span style="background:#FEE2E2; color:#DC2626; font-size:11px; padding:2px 8px; border-radius:10px; font-weight:700;">⛔ Account Blocked</span>`;
          } else if (log.action.includes('reactivated') || log.action.includes('active')) {
            actionBadge = `<span style="background:#DCFCE7; color:#15803D; font-size:11px; padding:2px 8px; border-radius:10px; font-weight:700;">🔓 Reactivated</span>`;
          } else if (log.action.includes('deleted')) {
            actionBadge = `<span style="background:#FEE2E2; color:#991B1B; font-size:11px; padding:2px 8px; border-radius:10px; font-weight:700;">🗑️ Account Deleted</span>`;
          } else if (log.action.includes('login')) {
            actionBadge = `<span style="background:#EFF6FF; color:#1D4ED8; font-size:11px; padding:2px 8px; border-radius:10px; font-weight:700;">🔑 Logged In</span>`;
          } else if (log.action.includes('password')) {
            actionBadge = `<span style="background:#FEF3C7; color:#92400E; font-size:11px; padding:2px 8px; border-radius:10px; font-weight:700;">🔐 Password Reset</span>`;
          }

          return `
            <div style="display:flex; justify-content:space-between; align-items:flex-start; padding:12px; background:#F8FAFC; border:1px solid var(--color-border-light); border-radius:8px; font-size:13px;">
              <div style="flex:1;">
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                  ${actionBadge}
                  <span style="font-weight:700; color:var(--color-navy-deep);">${escapeHtml(log.writerName || 'Writer')}</span>
                  <span style="font-size:11.5px; color:#64748B;">by ${escapeHtml(log.actorName || 'System')}</span>
                </div>
                ${log.details ? `
                  <div style="font-size:12.5px; color:#475569; line-height:1.5;">${escapeHtml(log.details)}</div>
                ` : ''}
              </div>
              <div style="font-size:11.5px; color:#94A3B8; white-space:nowrap; margin-left:12px;">
                ${dt}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  } catch (err) {
    const bodyEl = document.getElementById('audit-modal-body');
    if (bodyEl) {
      bodyEl.innerHTML = `<div style="color:#DC2626; padding:20px; text-align:center;">Failed to load audit logs: ${escapeHtml(err.message)}</div>`;
    }
  }
};

/* ========================================================
   WRITER CHAT HISTORY AUDIT TAB (STRICT PRIVACY BOUNDARY)
   ======================================================== */
let auditWritersCache = [];
let auditSelectedWriterId = null;
let auditConversationsCache = [];
let auditSelectedConvId = null;
let auditMessagesCache = [];

async function renderWriterChatAuditTab(canvas) {
  canvas.innerHTML = `
    <div style="padding:4px 0;">
      <!-- Page Header -->
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px; flex-wrap:wrap; gap:12px;">
        <div>
          <h1 class="admin-page-title" style="display:flex; align-items:center; gap:10px; margin:0 0 6px;">
            ${ADMIN_ICONS.chat}
            <span>Writer Chat History & Compliance Audit</span>
          </h1>
          <p class="admin-page-desc" style="margin:0;">
            Inspect one-to-one messaging history involving registered Writers and Authors. Read-only compliance mode.
          </p>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <span class="badge" style="background:#FEF3C7; color:#92400E; border:1px solid #FDE68A; padding:6px 12px; border-radius:8px; font-weight:700; font-size:12px; display:inline-flex; align-items:center; gap:6px;">
            <span>🛡️</span> Strict Privacy Boundary Active
          </span>
        </div>
      </div>

      <!-- Strict Privacy & Audit Legal Notice Banner -->
      <div style="background:#F0FDF4; border:1px solid #BBF7D0; border-radius:10px; padding:14px 18px; margin-bottom:24px; display:flex; gap:12px; align-items:center; font-size:13px; color:#166534; line-height:1.5;">
        <span style="font-size:22px; flex-shrink:0;">🔒</span>
        <div>
          <strong>Privacy Boundary Enforcement:</strong> Administrators may inspect only conversations involving a registered Author or Writer. Pure member-to-member conversations cannot be audited. Every conversation access is logged in the permanent database audit log (<code>admin_chat_audit_logs</code>).
        </div>
      </div>

      <!-- Main Audit Split Container -->
      <div style="display:grid; grid-template-columns: 320px 1fr; gap:20px; min-height:600px; background:#FFFFFF; border:1px solid var(--color-border); border-radius:12px; overflow:hidden; box-shadow:var(--shadow-sm);">
        <!-- Left: Writers & Conversations Selector -->
        <div style="border-right:1px solid var(--color-border); background:#F8FAFC; display:flex; flex-direction:column;">
          <div style="padding:14px 16px; border-bottom:1px solid var(--color-border); background:#FFFFFF;">
            <div style="font-weight:700; font-size:13.5px; color:var(--color-navy-deep); margin-bottom:8px;">
              Select Writer / Author
            </div>
            <input type="text" id="audit-writer-search" class="form-input" 
                   placeholder="Filter writers..." 
                   style="font-size:12.5px; padding:6px 10px;"
                   oninput="filterAuditWriters(this.value)">
          </div>

          <div id="audit-writers-list" style="max-height:220px; overflow-y:auto; border-bottom:2px solid var(--color-border);">
            <div style="text-align:center; padding:24px; color:var(--color-text-muted); font-size:12.5px;">
              Loading writer accounts...
            </div>
          </div>

          <div style="padding:10px 16px; background:#FFFFFF; border-bottom:1px solid var(--color-border); font-weight:700; font-size:12.5px; color:var(--color-navy-deep); display:flex; justify-content:space-between; align-items:center;">
            <span>Conversations</span>
            <span id="audit-conv-count-badge" class="badge" style="font-size:10.5px; background:#E2E8F0; color:#334155;">0</span>
          </div>

          <div id="audit-conversations-list" style="flex:1; overflow-y:auto;">
            <div style="text-align:center; padding:32px 16px; color:var(--color-text-muted); font-size:12.5px;">
              Select a writer above to inspect conversations.
            </div>
          </div>
        </div>

        <!-- Right: Message History Inspector -->
        <div id="audit-history-panel" style="display:flex; flex-direction:column; background:#FCFAF6;">
          <div style="margin:auto; text-align:center; padding:60px 20px; color:var(--color-text-muted);">
            <div style="font-size:42px; margin-bottom:12px;">💬</div>
            <div style="font-size:15px; font-weight:700; color:var(--color-navy-deep); margin-bottom:4px;">
              Writer Conversation Audit
            </div>
            <div style="font-size:13px; max-width:380px; margin:0 auto; line-height:1.5;">
              Choose a writer and select a conversation from the left panel to inspect the verified message history.
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  await loadAuditWriters();
}

async function loadAuditWriters() {
  const listEl = document.getElementById('audit-writers-list');
  if (!listEl) return;

  try {
    const res = await apiFetch('/api/admin/writer-chats/writers');
    if (!res.ok) throw new Error('Failed to load writers list');
    const data = await res.json();
    auditWritersCache = data.writers || [];
    renderAuditWritersList(auditWritersCache);
  } catch (err) {
    listEl.innerHTML = `
      <div style="text-align:center; padding:16px; color:#DC2626; font-size:12px;">
        ${escapeHtml(err.message)}
      </div>
    `;
  }
}

window.filterAuditWriters = (query) => {
  const q = (query || '').toLowerCase().trim();
  if (!q) {
    renderAuditWritersList(auditWritersCache);
    return;
  }
  const filtered = auditWritersCache.filter(w => 
    (w.display_name || '').toLowerCase().includes(q) || 
    (w.username || '').toLowerCase().includes(q)
  );
  renderAuditWritersList(filtered);
};

function renderAuditWritersList(writers) {
  const listEl = document.getElementById('audit-writers-list');
  if (!listEl) return;

  if (writers.length === 0) {
    listEl.innerHTML = `<div style="text-align:center; padding:16px; color:var(--color-text-muted); font-size:12px;">No writers found</div>`;
    return;
  }

  listEl.innerHTML = writers.map(w => {
    const isSelected = Number(w.id) === Number(auditSelectedWriterId);
    const name = escapeHtml(w.display_name || w.username);
    const avatar = w.avatar || '/profile.png';
    const convCount = w.conversation_count || 0;

    return `
      <div onclick="selectAuditWriter(${w.id})" 
           style="padding:10px 14px; display:flex; align-items:center; gap:10px; cursor:pointer; border-bottom:1px solid #EDF2F7; background:${isSelected ? '#E2E8F0' : '#FFFFFF'}; transition:background 0.15s ease;"
           onmouseover="if(!${isSelected}) this.style.background='#F1F5F9'"
           onmouseout="if(!${isSelected}) this.style.background='#FFFFFF'">
        <img src="${avatar}" style="width:34px; height:34px; border-radius:50%; object-fit:cover; border:1px solid #CBD5E1;" onerror="this.src='/profile.png'">
        <div style="flex:1; min-width:0;">
          <div style="font-weight:700; font-size:13px; color:var(--color-navy-deep); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
            ${name}
          </div>
          <div style="font-size:11px; color:#64748B;">@${escapeHtml(w.username)}</div>
        </div>
        <span class="badge" style="font-size:10.5px; background:#FEF3C7; color:#92400E; border:1px solid #FDE68A;">
          ${convCount} chats
        </span>
      </div>
    `;
  }).join('');
}

window.selectAuditWriter = async (writerId) => {
  auditSelectedWriterId = Number(writerId);
  renderAuditWritersList(auditWritersCache);

  const convListEl = document.getElementById('audit-conversations-list');
  const countBadge = document.getElementById('audit-conv-count-badge');
  if (convListEl) {
    convListEl.innerHTML = `<div style="text-align:center; padding:24px; color:var(--color-text-muted); font-size:12px;">Loading conversations...</div>`;
  }

  try {
    const res = await apiFetch(`/api/admin/writer-chats/conversations?writerId=${writerId}`);
    if (!res.ok) throw new Error('Failed to load conversations');
    const data = await res.json();
    auditConversationsCache = data.conversations || [];
    if (countBadge) countBadge.textContent = auditConversationsCache.length;
    renderAuditConversationsList(auditConversationsCache);
  } catch (err) {
    if (convListEl) {
      convListEl.innerHTML = `<div style="text-align:center; padding:20px; color:#DC2626; font-size:12px;">${escapeHtml(err.message)}</div>`;
    }
  }
};

function renderAuditConversationsList(conversations) {
  const convListEl = document.getElementById('audit-conversations-list');
  if (!convListEl) return;

  if (conversations.length === 0) {
    convListEl.innerHTML = `<div style="text-align:center; padding:28px 16px; color:var(--color-text-muted); font-size:12.5px;">No conversations found for this writer.</div>`;
    return;
  }

  convListEl.innerHTML = conversations.map(c => {
    if (!c) return '';
    const convId = c.id ?? c.conversationId;
    const isSelected = Number(convId) === Number(auditSelectedConvId);
    const other = c.otherParticipant || c.otherUser || c.other_user || {};
    const otherName = escapeHtml(other.display_name || other.displayName || other.username || 'User');
    const otherAvatar = other.avatar || '/profile.png';
    const role = (other.role || '').toLowerCase();
    const snippet = escapeHtml(typeof c.lastMessage === 'string' ? c.lastMessage : (c.lastMessage?.content || c.last_message || 'Conversation started'));
    const lastAt = c.lastMessageAt || c.last_message_at;
    const time = lastAt ? new Date(lastAt).toLocaleDateString([], { month:'short', day:'numeric' }) : '';

    return `
      <div onclick="selectAuditConversation(${convId})" 
           style="padding:10px 14px; border-bottom:1px solid #EDF2F7; cursor:pointer; background:${isSelected ? '#FFF8E6' : '#FFFFFF'}; border-left:${isSelected ? '3px solid #C89B3C' : '3px solid transparent'}; transition:background 0.15s ease;"
           onmouseover="if(!${isSelected}) this.style.background='#FFFDF8'"
           onmouseout="if(!${isSelected}) this.style.background='#FFFFFF'">
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
          <img src="${otherAvatar}" style="width:26px; height:26px; border-radius:50%; object-fit:cover;" onerror="this.src='/profile.png'">
          <span style="font-weight:700; font-size:12.5px; color:var(--color-navy-deep); flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
            ${otherName}
          </span>
          <span style="font-size:10.5px; color:#94A3B8;">${time}</span>
        </div>
        <div style="font-size:11.5px; color:#64748B; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
          ${snippet}
        </div>
      </div>
    `;
  }).join('');
}

window.selectAuditConversation = async (convId) => {
  auditSelectedConvId = Number(convId);
  renderAuditConversationsList(auditConversationsCache);

  const panel = document.getElementById('audit-history-panel');
  if (!panel) return;

  panel.innerHTML = `
    <div style="margin:auto; text-align:center; padding:40px; color:var(--color-text-muted);">
      <div style="font-size:32px; margin-bottom:8px;">⏳</div>
      <div>Retrieving messages from MySQL & Logging Audit Entry...</div>
    </div>
  `;

  try {
    const res = await apiFetch(`/api/admin/writer-chats/history?conversationId=${convId}&writerId=${auditSelectedWriterId || ''}`);
    if (res.status === 403) {
      panel.innerHTML = `
        <div style="margin:auto; text-align:center; padding:40px 20px; color:#DC2626; max-width:440px;">
          <div style="font-size:42px; margin-bottom:12px;">🚫</div>
          <div style="font-size:16px; font-weight:700; margin-bottom:6px;">Privacy Boundary Restriction</div>
          <div style="font-size:13px; line-height:1.5; color:#991B1B;">
            Access to this conversation was blocked. Administrators are strictly forbidden from auditing conversations that do not involve a registered Writer or Author.
          </div>
        </div>
      `;
      return;
    }

    if (!res.ok) throw new Error('Failed to retrieve conversation history');
    const data = await res.json();
    auditMessagesCache = data.messages || [];
    renderAuditMessageHistory(data);
  } catch (err) {
    panel.innerHTML = `
      <div style="margin:auto; text-align:center; padding:40px; color:#DC2626;">
        <div style="font-size:32px; margin-bottom:8px;">⚠️</div>
        <div>${escapeHtml(err.message)}</div>
      </div>
    `;
  }
};

function renderAuditMessageHistory(data) {
  const panel = document.getElementById('audit-history-panel');
  if (!panel) return;

  const conv = data.conversation || {};
  const participants = conv.participants || [];
  const messages = data.messages || [];

  panel.innerHTML = `
    <div style="display:flex; flex-direction:column; height:100%;">
      <!-- Conversation Header -->
      <div style="padding:14px 20px; background:#FFFFFF; border-bottom:1px solid var(--color-border); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
        <div>
          <div style="font-weight:700; font-size:14px; color:var(--color-navy-deep); display:flex; align-items:center; gap:8px;">
            <span>Participants:</span>
            ${participants.map(p => `
              <span class="badge" style="background:#EFF6FF; color:#1E40AF; border:1px solid #BFDBFE; font-size:11.5px; padding:3px 8px;">
                ${escapeHtml(p.display_name || p.username)} (${escapeHtml(p.role)})
              </span>
            `).join(' ↔ ')}
          </div>
          <div style="font-size:11.5px; color:#64748B; margin-top:3px;">
            Conversation ID #${conv.id} • ${messages.length} total messages
          </div>
        </div>

        <!-- Filter Input -->
        <input type="text" id="audit-msg-filter" class="form-input" 
               placeholder="Search messages in thread..." 
               style="font-size:12px; padding:5px 10px; width:200px;"
               oninput="filterAuditMessages(this.value)">
      </div>

      <!-- Messages Stream -->
      <div id="audit-messages-stream" style="flex:1; overflow-y:auto; padding:20px; display:flex; flex-direction:column; gap:14px; background:#F8FAFC;">
        ${renderAuditBubbles(messages)}
      </div>

      <!-- Read-Only Audit Compliance Footer -->
      <div style="padding:10px 18px; background:#FFFFFF; border-top:1px solid var(--color-border); display:flex; align-items:center; justify-content:space-between; font-size:12px; color:#64748B;">
        <div style="display:flex; align-items:center; gap:6px;">
          <span>👁️</span>
          <span><strong>Read-Only Inspection Mode:</strong> Administrative message sending & alteration are blocked.</span>
        </div>
        <span class="badge" style="background:#DCFCE7; color:#15803D; font-size:11px;">
          ✓ Audit Action Logged
        </span>
      </div>
    </div>
  `;

  // Auto scroll to bottom
  setTimeout(() => {
    const stream = document.getElementById('audit-messages-stream');
    if (stream) stream.scrollTop = stream.scrollHeight;
  }, 40);
}

window.filterAuditMessages = (query) => {
  const q = (query || '').toLowerCase().trim();
  const stream = document.getElementById('audit-messages-stream');
  if (!stream) return;

  if (!q) {
    stream.innerHTML = renderAuditBubbles(auditMessagesCache);
    return;
  }
  const filtered = auditMessagesCache.filter(m => (m.content || '').toLowerCase().includes(q));
  stream.innerHTML = renderAuditBubbles(filtered);
};

function renderAuditBubbles(messages) {
  if (!messages || messages.length === 0) {
    return `<div style="text-align:center; padding:30px; color:var(--color-text-muted); font-size:13px;">No messages match your criteria.</div>`;
  }

  return messages.map(m => {
    const timeStr = new Date(m.created_at).toLocaleString([], { dateStyle:'short', timeStyle:'short' });
    const isRead = Boolean(m.is_read);
    const senderName = escapeHtml(m.sender_name || 'User');
    const senderRole = escapeHtml(m.sender_role || 'member');
    const isWriter = (senderRole.toLowerCase() === 'writer' || senderRole.toLowerCase() === 'author' || senderRole.toLowerCase() === 'admin');

    return `
      <div style="display:flex; flex-direction:column; background:#FFFFFF; border:1px solid var(--color-border); border-radius:10px; padding:12px 14px; box-shadow:0 1px 2px rgba(0,0,0,0.04); max-width:75%; align-self:${isWriter ? 'flex-start' : 'flex-end'};">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:6px; font-size:11.5px; border-bottom:1px solid #F1F5F9; padding-bottom:4px;">
          <span style="font-weight:700; color:${isWriter ? '#1E40AF' : '#92400E'};">
            ${senderName} <span style="font-weight:400; font-size:10.5px;">(${senderRole})</span>
          </span>
          <span style="color:#94A3B8;">${timeStr}</span>
        </div>
        <div style="font-size:13.5px; color:var(--color-navy-deep); line-height:1.5; word-break:break-word;">
          ${escapeHtml(m.content)}
        </div>
        <div style="display:flex; justify-content:flex-end; margin-top:4px; font-size:10.5px; color:#94A3B8;">
          ${isRead ? '<span style="color:#0284C7;">✓✓ Read</span>' : '<span>✓ Sent</span>'}
        </div>
      </div>
    `;
  }).join('');
}


/* ========================================================
   UTILITY HELPERS
   ======================================================== */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeQuotes(str) {
  if (!str) return '';
  return String(str).replace(/"/g, '&quot;').replace(/'/g, "\\'");
}

function formatScheduleDate(dateStr) {
  if (!dateStr) return 'Scheduled';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return dateStr;
  }
}

function formatDatetimeLocal(dateStr) {
  if (!dateStr) {
    const now = new Date(Date.now() + 24 * 60 * 60 * 1000); // Default to tomorrow
    now.setMinutes(0, 0, 0);
    return now.toISOString().slice(0, 16);
  }
  try {
    return new Date(dateStr).toISOString().slice(0, 16);
  } catch {
    return '';
  }
}

function getCountdownString(targetDate) {
  const diff = targetDate.getTime() - Date.now();
  if (diff <= 0) return 'Publishing now...';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `In ${days} day${days > 1 ? 's' : ''}`;
  }
  return `In ${hours}h ${mins}m`;
}

/* ========================================================
   10. SECURE MEMBER ACCOUNT MANAGEMENT & AUDIT LOGS
   ======================================================== */
adminState.membersFilter = adminState.membersFilter || {
  search: '',
  status: 'all',
  role: 'all',
  sortBy: 'created_at',
  sortOrder: 'DESC',
  page: 1,
  limit: 25
};
adminState.membersData = adminState.membersData || {
  members: [],
  total: 0,
  metrics: null,
  totalPages: 1
};

let membersSearchTimeout = null;

function formatAdminDateTime(dateStr) {
  if (!dateStr) return 'Never';
  try {
    const normalized = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T') + (dateStr.includes('Z') ? '' : 'Z');
    const d = new Date(normalized);
    if (isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch {
    return String(dateStr);
  }
}

function getMemberRoleBadge(role) {
  const r = (role || 'Member').toLowerCase();
  if (r === 'admin' || r === 'administrator' || r === 'author') {
    return `<span style="display:inline-flex; align-items:center; gap:4px; font-size:11px; font-weight:700; background:#FEF3C7; color:#92400E; padding:3px 8px; border-radius:12px; border:1px solid #FDE68A;">${ADMIN_ICONS.shield} Admin</span>`;
  }
  if (r === 'writer') {
    return `<span style="display:inline-flex; align-items:center; gap:4px; font-size:11px; font-weight:700; background:#EDE9FE; color:#5B21B6; padding:3px 8px; border-radius:12px; border:1px solid #DDD6FE;">${ADMIN_ICONS.writers} Writer</span>`;
  }
  return `<span style="display:inline-flex; align-items:center; gap:4px; font-size:11px; font-weight:600; background:#E0F2FE; color:#0369A1; padding:3px 8px; border-radius:12px; border:1px solid #BAE6FD;">Member</span>`;
}

function getMemberStatusBadge(status, member = null) {
  const s = (status || member?.computedStatus || 'active').toLowerCase();
  if (member?.isTemporarilyBlocked || s === 'temporarily_blocked' || s === 'temp_blocked') {
    const remaining = member?.remainingText ? ` • ${escapeHtml(member.remainingText)}` : '';
    const expiryStr = member?.blockedUntil ? new Date(member.blockedUntil).toLocaleString() : '';
    return `<span class="status-pill scheduled" style="background:#FFF7ED; color:#C2410C; border:1px solid #FFEDD5; font-size:11px; font-weight:700; padding:3px 8px; border-radius:12px; display:inline-flex; align-items:center; gap:4px;" title="Blocked until ${expiryStr}"><span style="width:6px; height:6px; background:#EA580C; border-radius:50%;"></span> Temp Blocked${remaining}</span>`;
  }
  if (s === 'active') {
    return `<span class="status-pill published" style="background:#DCFCE7; color:#15803D; border:1px solid #BBF7D0; font-size:11px; font-weight:700; padding:3px 8px; border-radius:12px; display:inline-flex; align-items:center; gap:4px;"><span style="width:6px; height:6px; background:#16A34A; border-radius:50%;"></span> Active</span>`;
  }
  if (s === 'suspended') {
    return `<span class="status-pill scheduled" style="background:#FEF3C7; color:#B45309; border:1px solid #FDE68A; font-size:11px; font-weight:700; padding:3px 8px; border-radius:12px; display:inline-flex; align-items:center; gap:4px;"><span style="width:6px; height:6px; background:#D97706; border-radius:50%;"></span> Suspended</span>`;
  }
  if (s === 'blocked') {
    return `<span class="status-pill draft" style="background:#FEE2E2; color:#B91C1C; border:1px solid #FECACA; font-size:11px; font-weight:700; padding:3px 8px; border-radius:12px; display:inline-flex; align-items:center; gap:4px;"><span style="width:6px; height:6px; background:#DC2626; border-radius:50%;"></span> Blocked</span>`;
  }
  if (s === 'expired') {
    return `<span class="status-pill" style="background:#EFF6FF; color:#1D4ED8; border:1px solid #DBEAFE; font-size:11px; font-weight:700; padding:3px 8px; border-radius:12px; display:inline-flex; align-items:center; gap:4px;"><span style="width:6px; height:6px; background:#3B82F6; border-radius:50%;"></span> Expired</span>`;
  }
  return `<span class="status-pill" style="background:#F3F4F6; color:#4B5563; border:1px solid #E5E7EB; font-size:11px; font-weight:600; padding:3px 8px; border-radius:12px; display:inline-flex; align-items:center; gap:4px;">Disabled</span>`;
}

function getMemberPermissionsBadges(permissions) {
  if (!permissions) return '';
  const p = permissions;
  return `
    <div style="display:inline-flex; gap:4px; flex-wrap:wrap; font-size:11px;" title="Feature Permissions: Chat, Comments, Forum, Audio">
      <span title="Chat: ${p.can_chat ? 'Allowed' : 'Restricted'}" style="padding:2px 5px; border-radius:6px; font-weight:600; background:${p.can_chat ? '#F0FDF4' : '#FEF2F2'}; color:${p.can_chat ? '#15803D' : '#DC2626'}; border:1px solid ${p.can_chat ? '#DCFCE7' : '#FEE2E2'}; font-size:10px;">
        💬 ${p.can_chat ? '✓' : '✕'}
      </span>
      <span title="Novel Comments: ${p.can_comment ? 'Allowed' : 'Restricted'}" style="padding:2px 5px; border-radius:6px; font-weight:600; background:${p.can_comment ? '#F0FDF4' : '#FEF2F2'}; color:${p.can_comment ? '#15803D' : '#DC2626'}; border:1px solid ${p.can_comment ? '#DCFCE7' : '#FEE2E2'}; font-size:10px;">
        📝 ${p.can_comment ? '✓' : '✕'}
      </span>
      <span title="Forum Discussions: ${p.can_post_forum ? 'Allowed' : 'Restricted'}" style="padding:2px 5px; border-radius:6px; font-weight:600; background:${p.can_post_forum ? '#F0FDF4' : '#FEF2F2'}; color:${p.can_post_forum ? '#15803D' : '#DC2626'}; border:1px solid ${p.can_post_forum ? '#DCFCE7' : '#FEE2E2'}; font-size:10px;">
        🏛️ ${p.can_post_forum ? '✓' : '✕'}
      </span>
      <span title="Audio Novels: ${p.can_access_audio ? 'Allowed' : 'Restricted'}" style="padding:2px 5px; border-radius:6px; font-weight:600; background:${p.can_access_audio ? '#F0FDF4' : '#FEF2F2'}; color:${p.can_access_audio ? '#15803D' : '#DC2626'}; border:1px solid ${p.can_access_audio ? '#DCFCE7' : '#FEE2E2'}; font-size:10px;">
        🎧 ${p.can_access_audio ? '✓' : '✕'}
      </span>
    </div>
  `;
}

export async function renderMembersManagementTab(canvas) {
  canvas.innerHTML = `
    <div style="text-align:center; padding:60px 20px; color:var(--color-text-muted);">
      <div style="width:38px; height:38px; border:3px solid #E2E8F0; border-top-color:#B88635; border-radius:50%; animation:adminSpinner 0.8s linear infinite; margin:0 auto 14px;"></div>
      <div style="font-size:15px; font-weight:600; color:var(--color-navy-deep);">Loading Members Directory & Statistics...</div>
    </div>
  `;

  try {
    const filter = adminState.membersFilter;
    const queryParams = new URLSearchParams({
      search: filter.search || '',
      status: filter.status || 'all',
      role: filter.role || 'all',
      sortBy: filter.sortBy || 'created_at',
      sortOrder: filter.sortOrder || 'DESC',
      page: String(filter.page || 1),
      limit: String(filter.limit || 25)
    });

    const res = await apiFetch(`/api/admin/members?${queryParams.toString()}`);
    if (!res.ok) {
      throw new Error(`Failed to load members (HTTP ${res.status})`);
    }

    const data = await res.json();
    adminState.membersData = data;

    const navBadge = document.getElementById('nav-members-count');
    if (navBadge && data.metrics?.totalMembers !== undefined) {
      navBadge.textContent = data.metrics.totalMembers;
    }

    renderMembersListUI(canvas);
  } catch (err) {
    console.error('Error fetching members list:', err);
    canvas.innerHTML = `
      <div class="admin-card" style="text-align:center; padding:50px 24px; max-width:600px; margin:40px auto;">
        <div style="font-size:40px; margin-bottom:12px;">⚠️</div>
        <h3 style="color:#DC2626; margin-bottom:8px; font-size:18px;">Unable to Load Member Accounts</h3>
        <p style="color:var(--color-text-muted); font-size:14px; margin-bottom:20px;">${escapeHtml(err.message)}</p>
        <button class="btn btn-gold btn-sm" onclick="renderMembersManagementTab(document.getElementById('admin-main-canvas'))">
          ↻ Retry Loading
        </button>
      </div>
    `;
  }
}

function renderMembersListUI(canvas) {
  const data = adminState.membersData || {};
  const metrics = data.metrics || {
    totalMembers: 0,
    activeMembers: 0,
    tempBlockedMembers: 0,
    inactiveMembers: 0,
    recentlyRegistered: 0,
    onlineNow: 0
  };
  const members = data.members || [];
  const filter = adminState.membersFilter || {};
  const page = data.page || 1;
  const total = data.total || 0;
  const limit = data.limit || 25;
  const totalPages = data.totalPages || 1;
  const startIdx = total === 0 ? 0 : (page - 1) * limit + 1;
  const endIdx = Math.min(page * limit, total);

  canvas.innerHTML = `
    <!-- Page Header with Primary Actions -->
    <div class="admin-page-header" style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:16px; margin-bottom:22px;">
      <div>
        <h2 class="admin-page-title" style="margin:0 0 4px; font-size:24px; color:var(--color-navy-deep); font-weight:800;">
          Member Account Management
        </h2>
        <p class="admin-page-subtitle" style="margin:0; font-size:13px; color:var(--color-text-muted);">
          Complete administrative control: Temporary block with auto-expiry, permanent deletion, granular feature permissions, and security audit logs.
        </p>
      </div>
      <div class="admin-header-actions" style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
        <button type="button" class="btn btn-outline btn-sm" onclick="openAdminAuditLogsModal()" title="View Security Audit History" style="display:inline-flex; align-items:center; gap:6px;">
          ${ADMIN_ICONS.history}
          <span>Security Audit Logs</span>
        </button>
        <button type="button" class="btn btn-gold btn-sm" onclick="openAddMemberModal()" title="Create New Member Account" style="display:inline-flex; align-items:center; gap:6px; font-weight:700;">
          ${ADMIN_ICONS.userPlus}
          <span>+ Add Member</span>
        </button>
      </div>
    </div>

    <!-- Real-Time Database KPI Stat Cards -->
    <div class="admin-metrics-grid" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:14px; margin-bottom:22px;">
      <div class="admin-metric-card" style="background:#FFFFFF; border:1px solid #E2E8F0; border-radius:12px; padding:16px 18px; box-shadow:0 1px 3px rgba(0,0,0,0.04);">
        <div class="admin-metric-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <span class="admin-metric-label" style="font-size:12px; font-weight:700; color:#475569; text-transform:uppercase; letter-spacing:0.5px;">Total Members</span>
          <span class="admin-metric-icon" style="color:#0369A1; background:#E0F2FE; padding:6px; border-radius:8px; display:flex;">${ADMIN_ICONS.users}</span>
        </div>
        <div class="admin-metric-value" style="font-size:28px; font-weight:800; color:var(--color-navy-deep);">${metrics.totalMembers}</div>
        <div style="font-size:11px; color:#64748B; margin-top:4px;">Registered Accounts</div>
      </div>

      <div class="admin-metric-card" style="background:#FFFFFF; border:1px solid #E2E8F0; border-radius:12px; padding:16px 18px; box-shadow:0 1px 3px rgba(0,0,0,0.04);">
        <div class="admin-metric-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <span class="admin-metric-label" style="font-size:12px; font-weight:700; color:#475569; text-transform:uppercase; letter-spacing:0.5px;">Active Accounts</span>
          <span class="admin-metric-icon" style="color:#15803D; background:#DCFCE7; padding:6px; border-radius:8px; display:flex;">${ADMIN_ICONS.checkCircle}</span>
        </div>
        <div class="admin-metric-value" style="font-size:28px; font-weight:800; color:#15803D;">${metrics.activeMembers}</div>
        <div style="font-size:11px; color:#64748B; margin-top:4px;">In Good Standing</div>
      </div>

      <div class="admin-metric-card" style="background:#FFFFFF; border:1px solid #E2E8F0; border-radius:12px; padding:16px 18px; box-shadow:0 1px 3px rgba(0,0,0,0.04);">
        <div class="admin-metric-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <span class="admin-metric-label" style="font-size:12px; font-weight:700; color:#475569; text-transform:uppercase; letter-spacing:0.5px;">Temp Blocked</span>
          <span class="admin-metric-icon" style="color:#EA580C; background:#FFF7ED; padding:6px; border-radius:8px; display:flex;">${ADMIN_ICONS.lock}</span>
        </div>
        <div class="admin-metric-value" style="font-size:28px; font-weight:800; color:${metrics.tempBlockedMembers > 0 ? '#EA580C' : '#475569'};">${metrics.tempBlockedMembers || 0}</div>
        <div style="font-size:11px; color:#64748B; margin-top:4px;">Timed Expiry Blocks</div>
      </div>

      <div class="admin-metric-card" style="background:#FFFFFF; border:1px solid #E2E8F0; border-radius:12px; padding:16px 18px; box-shadow:0 1px 3px rgba(0,0,0,0.04);">
        <div class="admin-metric-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <span class="admin-metric-label" style="font-size:12px; font-weight:700; color:#475569; text-transform:uppercase; letter-spacing:0.5px;">Suspended / Inactive</span>
          <span class="admin-metric-icon" style="color:#B91C1C; background:#FEE2E2; padding:6px; border-radius:8px; display:flex;">${ADMIN_ICONS.userX}</span>
        </div>
        <div class="admin-metric-value" style="font-size:28px; font-weight:800; color:${metrics.inactiveMembers > 0 ? '#B91C1C' : '#475569'};">${metrics.inactiveMembers}</div>
        <div style="font-size:11px; color:#64748B; margin-top:4px;">Suspended / Disabled</div>
      </div>

      <div class="admin-metric-card" style="background:#FFFFFF; border:1px solid #E2E8F0; border-radius:12px; padding:16px 18px; box-shadow:0 1px 3px rgba(0,0,0,0.04);">
        <div class="admin-metric-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <span class="admin-metric-label" style="font-size:12px; font-weight:700; color:#475569; text-transform:uppercase; letter-spacing:0.5px;">New in 30 Days</span>
          <span class="admin-metric-icon" style="color:#B88635; background:#FAF5EC; padding:6px; border-radius:8px; display:flex;">${ADMIN_ICONS.clock}</span>
        </div>
        <div class="admin-metric-value" style="font-size:28px; font-weight:800; color:#B88635;">${metrics.recentlyRegistered}</div>
        <div style="font-size:11px; color:#64748B; margin-top:4px;">Recently Registered</div>
      </div>

      <div class="admin-metric-card" style="background:#FFFFFF; border:1px solid #E2E8F0; border-radius:12px; padding:16px 18px; box-shadow:0 1px 3px rgba(0,0,0,0.04);">
        <div class="admin-metric-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <span class="admin-metric-label" style="font-size:12px; font-weight:700; color:#475569; text-transform:uppercase; letter-spacing:0.5px;">Online Readers</span>
          <span class="admin-metric-icon" style="color:#059669; background:#D1FAE5; padding:6px; border-radius:8px; display:flex;">${ADMIN_ICONS.eye}</span>
        </div>
        <div class="admin-metric-value" style="font-size:28px; font-weight:800; color:#059669; display:flex; align-items:center; gap:8px;">
          <span>${metrics.onlineNow}</span>
          <span style="width:8px; height:8px; background:#10B981; border-radius:50%; box-shadow:0 0 0 3px rgba(16,185,129,0.25);"></span>
        </div>
        <div style="font-size:11px; color:#64748B; margin-top:4px;">Active Online Activity</div>
      </div>
    </div>

    <!-- Advanced Search, Filtering, and Sorting Toolbar -->
    <div class="admin-card" style="background:#FFFFFF; border:1px solid #E2E8F0; border-radius:12px; padding:16px 18px; margin-bottom:20px; box-shadow:0 1px 2px rgba(0,0,0,0.03);">
      <div style="display:flex; flex-wrap:wrap; gap:12px; align-items:center; justify-content:space-between;">
        <!-- Search Input -->
        <div style="position:relative; flex:1 1 260px; min-width:220px;">
          <span style="position:absolute; left:12px; top:50%; transform:translateY(-50%); color:#94A3B8; pointer-events:none; display:flex;">
            ${ADMIN_ICONS.search}
          </span>
          <input type="text" id="admin-members-search-input" 
                 class="admin-search-input" 
                 placeholder="Search by name, email, or ID..." 
                 value="${escapeHtml(filter.search || '')}"
                 oninput="handleMembersSearch(event)"
                 style="width:100%; padding:9px 12px 9px 36px; border:1px solid #CBD5E1; border-radius:8px; font-size:13px; outline:none; transition:border-color 0.2s;"
                 onfocus="this.style.borderColor='#B88635'" onblur="this.style.borderColor='#CBD5E1'" />
        </div>

        <!-- Filter Dropdowns -->
        <div style="display:flex; flex-wrap:wrap; gap:10px; align-items:center;">
          <!-- Status Filter -->
          <div style="display:flex; align-items:center; gap:6px;">
            <label for="admin-members-status-filter" style="font-size:12px; font-weight:600; color:#64748B;">Status:</label>
            <select id="admin-members-status-filter" onchange="handleMembersStatusFilter(this.value)"
                    style="padding:8px 12px; border:1px solid #CBD5E1; border-radius:8px; font-size:13px; background:#FFF; color:#334155; outline:none;">
              <option value="all" ${filter.status === 'all' ? 'selected' : ''}>All Statuses</option>
              <option value="active" ${filter.status === 'active' ? 'selected' : ''}>Active</option>
              <option value="temporarily_blocked" ${filter.status === 'temporarily_blocked' ? 'selected' : ''}>Temporarily Blocked</option>
              <option value="blocked" ${filter.status === 'blocked' ? 'selected' : ''}>Blocked (All)</option>
              <option value="suspended" ${filter.status === 'suspended' ? 'selected' : ''}>Suspended</option>
              <option value="disabled" ${filter.status === 'disabled' ? 'selected' : ''}>Disabled</option>
            </select>
          </div>

          <!-- Role Filter -->
          <div style="display:flex; align-items:center; gap:6px;">
            <label for="admin-members-role-filter" style="font-size:12px; font-weight:600; color:#64748B;">Role:</label>
            <select id="admin-members-role-filter" onchange="handleMembersRoleFilter(this.value)"
                    style="padding:8px 12px; border:1px solid #CBD5E1; border-radius:8px; font-size:13px; background:#FFF; color:#334155; outline:none;">
              <option value="all" ${filter.role === 'all' ? 'selected' : ''}>All Roles</option>
              <option value="Member" ${filter.role === 'Member' ? 'selected' : ''}>Member</option>
              <option value="writer" ${filter.role === 'writer' ? 'selected' : ''}>Writer</option>
              <option value="admin" ${filter.role === 'admin' ? 'selected' : ''}>Admin</option>
            </select>
          </div>

          <!-- Sort Filter -->
          <div style="display:flex; align-items:center; gap:6px;">
            <label for="admin-members-sort-filter" style="font-size:12px; font-weight:600; color:#64748B;">Sort:</label>
            <select id="admin-members-sort-filter" onchange="handleMembersSort(this.value)"
                    style="padding:8px 12px; border:1px solid #CBD5E1; border-radius:8px; font-size:13px; background:#FFF; color:#334155; outline:none;">
              <option value="created_at_DESC" ${filter.sortBy === 'created_at' && filter.sortOrder === 'DESC' ? 'selected' : ''}>Registered: Newest</option>
              <option value="created_at_ASC" ${filter.sortBy === 'created_at' && filter.sortOrder === 'ASC' ? 'selected' : ''}>Registered: Oldest</option>
              <option value="name_ASC" ${filter.sortBy === 'name' && filter.sortOrder === 'ASC' ? 'selected' : ''}>Name: A to Z</option>
              <option value="name_DESC" ${filter.sortBy === 'name' && filter.sortOrder === 'DESC' ? 'selected' : ''}>Name: Z to A</option>
              <option value="last_login_DESC" ${filter.sortBy === 'last_login' ? 'selected' : ''}>Last Login</option>
              <option value="email_ASC" ${filter.sortBy === 'email' ? 'selected' : ''}>Email: A to Z</option>
            </select>
          </div>

          <!-- Reset Filter Button -->
          ${(filter.search || filter.status !== 'all' || filter.role !== 'all' || filter.sortBy !== 'created_at') ? `
            <button type="button" class="btn btn-outline btn-sm" onclick="handleResetMembersFilters()" title="Clear all filters" style="font-size:12px; padding:7px 12px;">
              ✕ Reset
            </button>
          ` : ''}
        </div>
      </div>
    </div>

    <!-- Members Table Canvas -->
    <div class="admin-table-wrapper" style="box-shadow:0 1px 3px rgba(0,0,0,0.05); border-radius:12px; overflow-x:auto;">
      <table class="admin-table" style="width:100%; border-collapse:collapse; min-width:980px;">
        <thead>
          <tr style="background:#FAF5EC; border-bottom:1px solid #E2E8F0;">
            <th style="padding:14px 16px; font-size:12px; font-weight:700; color:var(--color-navy-deep); width:50px;">ID</th>
            <th style="padding:14px 16px; font-size:12px; font-weight:700; color:var(--color-navy-deep);">Member</th>
            <th style="padding:14px 16px; font-size:12px; font-weight:700; color:var(--color-navy-deep);">Email Address</th>
            <th style="padding:14px 16px; font-size:12px; font-weight:700; color:var(--color-navy-deep);">Role</th>
            <th style="padding:14px 16px; font-size:12px; font-weight:700; color:var(--color-navy-deep);">Account Status</th>
            <th style="padding:14px 16px; font-size:12px; font-weight:700; color:var(--color-navy-deep);">Permissions</th>
            <th style="padding:14px 16px; font-size:12px; font-weight:700; color:var(--color-navy-deep);">Registered</th>
            <th style="padding:14px 16px; font-size:12px; font-weight:700; color:var(--color-navy-deep);">Last Login</th>
            <th style="padding:14px 16px; font-size:12px; font-weight:700; color:var(--color-navy-deep); text-align:right;">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${members.length === 0 ? `
            <tr>
              <td colspan="9" style="text-align:center; padding:48px 16px; color:#64748B;">
                <div style="font-size:32px; margin-bottom:8px;">🔍</div>
                <div style="font-weight:700; font-size:16px; color:var(--color-navy-deep); margin-bottom:4px;">No Members Found</div>
                <div style="font-size:13px;">No registered accounts match your current filter criteria.</div>
                ${(filter.search || filter.status !== 'all' || filter.role !== 'all') ? `
                  <button type="button" class="btn btn-outline btn-sm" onclick="handleResetMembersFilters()" style="margin-top:14px;">
                    Clear Filter Search
                  </button>
                ` : ''}
              </td>
            </tr>
          ` : members.map(m => {
            const isProtected = m.id === 2 || m.email === 'digitalmarkservices.in@gmail.com';
            const isBlockedOrTemp = m.computedStatus === 'temporarily_blocked' || m.computedStatus === 'blocked';

            return `
              <tr style="border-bottom:1px solid #F1F5F9; transition:background 0.15s;" onmouseover="this.style.background='#FFFDF8'" onmouseout="this.style.background='transparent'">
                <td style="padding:12px 16px; font-size:12px; font-weight:700; color:#64748B;">
                  #${m.id}
                </td>
                <td style="padding:12px 16px;">
                  <div style="display:flex; align-items:center; gap:10px;">
                    <div style="position:relative; width:34px; height:34px; flex-shrink:0;">
                      <img src="${escapeHtml(m.avatar || '/profile.png')}" alt="${escapeHtml(m.displayName)}" 
                           style="width:34px; height:34px; border-radius:50%; object-fit:cover; border:1px solid #E2E8F0;"
                           onerror="this.src='/profile.png'" />
                      ${m.isOnline && m.activityStatusEnabled ? `
                        <span style="position:absolute; bottom:-1px; right:-1px; width:9px; height:9px; background:#10B981; border:2px solid #FFF; border-radius:50%;" title="Online Now"></span>
                      ` : ''}
                    </div>
                    <div>
                      <div style="font-weight:700; font-size:14px; color:var(--color-navy-deep); line-height:1.2;">
                        ${escapeHtml(m.displayName)}
                      </div>
                      <div style="font-size:11px; color:#64748B; margin-top:2px;">
                        @${escapeHtml(m.username)}
                      </div>
                    </div>
                  </div>
                </td>
                <td style="padding:12px 16px; font-size:13px; color:#334155;">
                  <span style="font-family:monospace; font-size:12px;">${escapeHtml(m.email)}</span>
                </td>
                <td style="padding:12px 16px;">
                  ${getMemberRoleBadge(m.role)}
                </td>
                <td style="padding:12px 16px;">
                  ${getMemberStatusBadge(m.status, m)}
                </td>
                <td style="padding:12px 16px;">
                  ${getMemberPermissionsBadges(m.permissions)}
                </td>
                <td style="padding:12px 16px; font-size:12px; color:#64748B; white-space:nowrap;">
                  ${formatAdminDateTime(m.createdAt)}
                </td>
                <td style="padding:12px 16px; font-size:12px; color:#64748B; white-space:nowrap;">
                  ${formatAdminDateTime(m.lastLogin)}
                </td>
                <td style="padding:12px 16px; text-align:right;">
                  <div class="admin-action-btn-group" style="display:inline-flex; gap:5px; align-items:center;">
                    <!-- 1. View Details -->
                    <button type="button" class="member-action-btn btn-view" onclick="openMemberDetailsModal(${m.id})" 
                            title="View Complete Member Profile & Audit Log">
                      ${ADMIN_ICONS.eye}
                    </button>
                    <!-- 2. Edit Profile -->
                    <button type="button" class="member-action-btn btn-edit" onclick="openEditMemberModal(${m.id})" 
                            title="Edit Member Information">
                      ${ADMIN_ICONS.edit}
                    </button>
                    <!-- 3. Feature Permissions -->
                    <button type="button" class="member-action-btn btn-perm" onclick="openManagePermissionsModal(${m.id})" 
                            title="Manage Feature Access Permissions">
                      ${ADMIN_ICONS.sliders || '⚙️'}
                    </button>
                    <!-- 4. Reset Password (No OTP) -->
                    <button type="button" class="member-action-btn btn-key" onclick="openResetMemberPasswordModal(${m.id})" 
                            title="Reset Password Without Member OTP">
                      ${ADMIN_ICONS.key}
                    </button>

                    <!-- 5. Temporarily Block / Early Unblock -->
                    ${!isProtected ? `
                      ${isBlockedOrTemp ? `
                        <button type="button" class="member-action-btn btn-unblock" onclick="openUnblockMemberModal(${m.id})" 
                                title="Unblock Account (Restore Active Access)">
                          ${ADMIN_ICONS.unlock}
                        </button>
                      ` : `
                        <button type="button" class="member-action-btn btn-block" onclick="openTemporaryBlockModal(${m.id})" 
                                title="Temporarily Block Account (Duration / Reason)">
                          ${ADMIN_ICONS.lock}
                        </button>
                      `}
                    ` : ''}

                    <!-- 6. Revoke Active Sessions -->
                    <button type="button" class="member-action-btn btn-revoke" onclick="confirmRevokeMemberSessions(${m.id})" 
                            title="Revoke All Active Sessions (${m.activeSessionsCount} active)">
                      ${ADMIN_ICONS.refresh}
                    </button>

                    <!-- 7. Permanently Delete Account -->
                    ${!isProtected ? `
                      <button type="button" class="member-action-btn btn-delete" onclick="openDeleteMemberModal(${m.id})" 
                              title="Permanently Delete Account (Irreversible)">
                        ${ADMIN_ICONS.trash}
                      </button>
                    ` : ''}
                  </div>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>

    <!-- Pagination Controls -->
    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-top:16px;">
      <div style="font-size:13px; color:#64748B;">
        Showing <strong>${startIdx}</strong> to <strong>${endIdx}</strong> of <strong>${total}</strong> members
      </div>

      <div style="display:flex; align-items:center; gap:8px;">
        <label for="admin-members-page-limit" style="font-size:12px; color:#64748B;">Per Page:</label>
        <select id="admin-members-page-limit" onchange="handleMembersPageLimit(this.value)"
                style="padding:5px 8px; border:1px solid #CBD5E1; border-radius:6px; font-size:12px; background:#FFF;">
          <option value="10" ${limit === 10 ? 'selected' : ''}>10</option>
          <option value="25" ${limit === 25 ? 'selected' : ''}>25</option>
          <option value="50" ${limit === 50 ? 'selected' : ''}>50</option>
        </select>

        <div style="display:inline-flex; gap:4px; margin-left:8px;">
          <button type="button" class="btn btn-outline btn-sm" onclick="handleMembersPageChange(${page - 1})"
                  ${page <= 1 ? 'disabled style="opacity:0.4; cursor:not-allowed;"' : ''}>
            ‹ Prev
          </button>
          
          <span style="font-size:13px; font-weight:700; color:var(--color-navy-deep); padding:5px 10px; display:inline-flex; align-items:center;">
            Page ${page} of ${totalPages}
          </span>

          <button type="button" class="btn btn-outline btn-sm" onclick="handleMembersPageChange(${page + 1})"
                  ${page >= totalPages ? 'disabled style="opacity:0.4; cursor:not-allowed;"' : ''}>
            Next ›
          </button>
        </div>
      </div>
    </div>
  `;
}

/* ========================================================
   FILTER, SEARCH, & PAGINATION HANDLERS
   ======================================================== */
window.handleMembersSearch = (event) => {
  const value = event.target.value;
  if (membersSearchTimeout) clearTimeout(membersSearchTimeout);
  membersSearchTimeout = setTimeout(() => {
    adminState.membersFilter.search = value;
    adminState.membersFilter.page = 1;
    renderMembersManagementTab(document.getElementById('admin-main-canvas'));
  }, 300);
};

window.handleMembersStatusFilter = (status) => {
  adminState.membersFilter.status = status;
  adminState.membersFilter.page = 1;
  renderMembersManagementTab(document.getElementById('admin-main-canvas'));
};

window.handleMembersRoleFilter = (role) => {
  adminState.membersFilter.role = role;
  adminState.membersFilter.page = 1;
  renderMembersManagementTab(document.getElementById('admin-main-canvas'));
};

window.handleMembersSort = (sortVal) => {
  const parts = sortVal.split('_');
  const sortOrder = parts.pop();
  const sortBy = parts.join('_');
  adminState.membersFilter.sortBy = sortBy;
  adminState.membersFilter.sortOrder = sortOrder;
  adminState.membersFilter.page = 1;
  renderMembersManagementTab(document.getElementById('admin-main-canvas'));
};

window.handleMembersPageLimit = (limit) => {
  adminState.membersFilter.limit = parseInt(limit, 10) || 25;
  adminState.membersFilter.page = 1;
  renderMembersManagementTab(document.getElementById('admin-main-canvas'));
};

window.handleMembersPageChange = (newPage) => {
  const totalPages = adminState.membersData?.totalPages || 1;
  if (newPage < 1 || newPage > totalPages) return;
  adminState.membersFilter.page = newPage;
  renderMembersManagementTab(document.getElementById('admin-main-canvas'));
};

window.handleResetMembersFilters = () => {
  adminState.membersFilter = {
    search: '',
    status: 'all',
    role: 'all',
    sortBy: 'created_at',
    sortOrder: 'DESC',
    page: 1,
    limit: 25
  };
  renderMembersManagementTab(document.getElementById('admin-main-canvas'));
};

/* ========================================================
   MODAL CONTROLS: CLOSE HELPER
   ======================================================== */
window.closeMemberModal = () => {
  const modals = document.querySelectorAll('.member-mgmt-modal-wrapper');
  modals.forEach(m => m.remove());
};

window.togglePasswordVisibility = (inputId, btnId) => {
  const input = document.getElementById(inputId);
  const btn = document.getElementById(btnId);
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    if (btn) btn.innerHTML = ADMIN_ICONS.eyeOff || 'Hide';
  } else {
    input.type = 'password';
    if (btn) btn.innerHTML = ADMIN_ICONS.eye || 'Show';
  }
};

/* ========================================================
   MODAL 1: ADD MEMBER ACCOUNT
   ======================================================== */
window.openAddMemberModal = () => {
  window.closeMemberModal();
  const modal = document.createElement('div');
  modal.className = 'modal-overlay open member-mgmt-modal-wrapper';
  modal.id = 'admin-add-member-modal';
  modal.onclick = (e) => { if (e.target === modal) window.closeMemberModal(); };

  modal.innerHTML = `
    <div class="modal-card admin-modal-card" style="max-width:540px; background:#FFF; border-radius:14px; box-shadow:0 16px 48px rgba(0,0,0,0.2); overflow:hidden;">
      <div class="modal-header" style="background:#FAF5EC; padding:18px 24px; border-bottom:1px solid #E2E8F0; display:flex; justify-content:space-between; align-items:center;">
        <div style="display:flex; align-items:center; gap:10px;">
          <div style="color:#B88635; display:flex;">${ADMIN_ICONS.userPlus}</div>
          <div>
            <h3 style="margin:0; font-size:18px; font-weight:800; color:var(--color-navy-deep);">Create Member Account</h3>
            <div style="font-size:12px; color:#64748B;">Add a new community member with administrative authorization.</div>
          </div>
        </div>
        <button type="button" class="modal-close-btn" onclick="closeMemberModal()" style="background:none; border:none; font-size:20px; cursor:pointer; color:#64748B;">✕</button>
      </div>

      <form id="admin-add-member-form" onsubmit="submitAddMemberForm(event)" style="padding:22px 24px;">
        <div id="add-member-error-box" style="display:none; padding:12px; background:#FEE2E2; border:1px solid #FECACA; border-radius:8px; color:#B91C1C; font-size:13px; margin-bottom:16px;"></div>

        <div style="margin-bottom:14px;">
          <label style="display:block; font-size:13px; font-weight:700; color:#334155; margin-bottom:6px;">
            Full Member Name <span style="color:#DC2626;">*</span>
          </label>
          <input type="text" id="new-member-name" required placeholder="e.g. Priya Sundaram"
                 style="width:100%; padding:10px 12px; border:1px solid #CBD5E1; border-radius:8px; font-size:13px; box-sizing:border-box;" />
        </div>

        <div style="margin-bottom:14px;">
          <label style="display:block; font-size:13px; font-weight:700; color:#334155; margin-bottom:6px;">
            Email Address <span style="color:#DC2626;">*</span>
          </label>
          <input type="email" id="new-member-email" required placeholder="e.g. priya@example.com"
                 style="width:100%; padding:10px 12px; border:1px solid #CBD5E1; border-radius:8px; font-size:13px; box-sizing:border-box;" />
        </div>

        <div style="margin-bottom:14px;">
          <label style="display:block; font-size:13px; font-weight:700; color:#334155; margin-bottom:6px;">
            Username <span style="font-size:11px; color:#64748B; font-weight:400;">(Optional — auto-generated from name if empty)</span>
          </label>
          <input type="text" id="new-member-username" placeholder="e.g. priya_s"
                 style="width:100%; padding:10px 12px; border:1px solid #CBD5E1; border-radius:8px; font-size:13px; box-sizing:border-box;" />
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:14px;">
          <div>
            <label style="display:block; font-size:13px; font-weight:700; color:#334155; margin-bottom:6px;">
              Initial Password <span style="color:#DC2626;">*</span>
            </label>
            <div style="position:relative;">
              <input type="password" id="new-member-password" required placeholder="Min 6 characters" minlength="6"
                     style="width:100%; padding:10px 38px 10px 12px; border:1px solid #CBD5E1; border-radius:8px; font-size:13px; box-sizing:border-box;" />
              <button type="button" id="toggle-new-pw-btn" onclick="togglePasswordVisibility('new-member-password', 'toggle-new-pw-btn')"
                      style="position:absolute; right:8px; top:50%; transform:translateY(-50%); background:none; border:none; cursor:pointer; color:#64748B; display:flex;">
                ${ADMIN_ICONS.eye}
              </button>
            </div>
          </div>

          <div>
            <label style="display:block; font-size:13px; font-weight:700; color:#334155; margin-bottom:6px;">
              Confirm Password <span style="color:#DC2626;">*</span>
            </label>
            <input type="password" id="new-member-password-confirm" required placeholder="Confirm password" minlength="6"
                   style="width:100%; padding:10px 12px; border:1px solid #CBD5E1; border-radius:8px; font-size:13px; box-sizing:border-box;" />
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:20px;">
          <div>
            <label style="display:block; font-size:13px; font-weight:700; color:#334155; margin-bottom:6px;">
              Role
            </label>
            <select id="new-member-role" style="width:100%; padding:9px 12px; border:1px solid #CBD5E1; border-radius:8px; font-size:13px; background:#FFF;">
              <option value="Member" selected>Member (Standard Reader)</option>
              <option value="writer">Writer (Author Assistant)</option>
            </select>
          </div>

          <div>
            <label style="display:block; font-size:13px; font-weight:700; color:#334155; margin-bottom:6px;">
              Initial Account Status
            </label>
            <select id="new-member-status" style="width:100%; padding:9px 12px; border:1px solid #CBD5E1; border-radius:8px; font-size:13px; background:#FFF;">
              <option value="active" selected>Active</option>
              <option value="suspended">Suspended</option>
              <option value="blocked">Blocked</option>
            </select>
          </div>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:10px; border-top:1px solid #E2E8F0; padding-top:16px;">
          <button type="button" class="btn btn-outline btn-sm" onclick="closeMemberModal()">Cancel</button>
          <button type="submit" id="submit-add-member-btn" class="btn btn-gold btn-sm" style="font-weight:700;">
            Create Member Account
          </button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);
  document.getElementById('new-member-name')?.focus();
};

window.submitAddMemberForm = async (event) => {
  event.preventDefault();
  const errorBox = document.getElementById('add-member-error-box');
  const submitBtn = document.getElementById('submit-add-member-btn');
  if (errorBox) errorBox.style.display = 'none';

  const displayName = document.getElementById('new-member-name')?.value.trim();
  const email = document.getElementById('new-member-email')?.value.trim();
  const username = document.getElementById('new-member-username')?.value.trim();
  const password = document.getElementById('new-member-password')?.value.trim();
  const confirmPassword = document.getElementById('new-member-password-confirm')?.value.trim();
  const role = document.getElementById('new-member-role')?.value;
  const status = document.getElementById('new-member-status')?.value;

  if (password !== confirmPassword) {
    if (errorBox) {
      errorBox.textContent = 'Passwords do not match. Please re-enter.';
      errorBox.style.display = 'block';
    }
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating Account...';
  }

  try {
    const res = await apiFetch('/api/admin/members', {
      method: 'POST',
      body: JSON.stringify({ displayName, email, username, password, confirmPassword, role, status })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to create member account.');
    }

    showToast(`Member account "${displayName}" created successfully.`);
    window.closeMemberModal();
    renderMembersManagementTab(document.getElementById('admin-main-canvas'));
  } catch (err) {
    if (errorBox) {
      errorBox.textContent = err.message;
      errorBox.style.display = 'block';
    }
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Create Member Account';
    }
  }
};

/* ========================================================
   MODAL 2: EDIT MEMBER DETAILS
   ======================================================== */
window.openEditMemberModal = async (memberId) => {
  window.closeMemberModal();
  const modal = document.createElement('div');
  modal.className = 'modal-overlay open member-mgmt-modal-wrapper';
  modal.id = 'admin-edit-member-modal';
  modal.onclick = (e) => { if (e.target === modal) window.closeMemberModal(); };

  modal.innerHTML = `
    <div class="modal-card admin-modal-card" style="max-width:540px; background:#FFF; border-radius:14px; box-shadow:0 16px 48px rgba(0,0,0,0.2); overflow:hidden;">
      <div style="padding:40px; text-align:center;">
        <div style="width:32px; height:32px; border:3px solid #E2E8F0; border-top-color:#B88635; border-radius:50%; animation:adminSpinner 0.8s linear infinite; margin:0 auto 12px;"></div>
        <div style="font-size:14px; color:#64748B;">Loading member account...</div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  try {
    const res = await apiFetch(`/api/admin/members/${memberId}`);
    if (!res.ok) throw new Error('Could not retrieve member details.');
    const { member } = await res.json();

    const isProtectedAdmin = member.id === 2 || member.email === 'digitalmarkservices.in@gmail.com';

    modal.innerHTML = `
      <div class="modal-card admin-modal-card" style="max-width:540px; background:#FFF; border-radius:14px; box-shadow:0 16px 48px rgba(0,0,0,0.2); overflow:hidden;">
        <div class="modal-header" style="background:#FAF5EC; padding:18px 24px; border-bottom:1px solid #E2E8F0; display:flex; justify-content:space-between; align-items:center;">
          <div style="display:flex; align-items:center; gap:10px;">
            <div style="color:#1D4ED8; display:flex;">${ADMIN_ICONS.edit}</div>
            <div>
              <h3 style="margin:0; font-size:18px; font-weight:800; color:var(--color-navy-deep);">Edit Member Details</h3>
              <div style="font-size:12px; color:#64748B;">Member #${member.id} • ${escapeHtml(member.displayName)}</div>
            </div>
          </div>
          <button type="button" class="modal-close-btn" onclick="closeMemberModal()" style="background:none; border:none; font-size:20px; cursor:pointer; color:#64748B;">✕</button>
        </div>

        <form id="admin-edit-member-form" onsubmit="submitEditMemberForm(event, ${member.id})" style="padding:22px 24px;">
          <div id="edit-member-error-box" style="display:none; padding:12px; background:#FEE2E2; border:1px solid #FECACA; border-radius:8px; color:#B91C1C; font-size:13px; margin-bottom:16px;"></div>

          ${isProtectedAdmin ? `
            <div style="padding:10px 14px; background:#FEF3C7; border:1px solid #FDE68A; border-radius:8px; color:#92400E; font-size:12px; font-weight:700; margin-bottom:16px; display:flex; align-items:center; gap:8px;">
              ${ADMIN_ICONS.shield}
              <span>Primary Author & Administrator Account (Protected System Account)</span>
            </div>
          ` : ''}

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:14px;">
            <div>
              <label style="display:block; font-size:13px; font-weight:700; color:#334155; margin-bottom:6px;">
                Display Name <span style="color:#DC2626;">*</span>
              </label>
              <input type="text" id="edit-member-name" required value="${escapeHtml(member.displayName)}"
                     style="width:100%; padding:9px 12px; border:1px solid #CBD5E1; border-radius:8px; font-size:13px; box-sizing:border-box;" />
            </div>

            <div>
              <label style="display:block; font-size:13px; font-weight:700; color:#334155; margin-bottom:6px;">
                Username <span style="color:#DC2626;">*</span>
              </label>
              <input type="text" id="edit-member-username" required value="${escapeHtml(member.username)}"
                     style="width:100%; padding:9px 12px; border:1px solid #CBD5E1; border-radius:8px; font-size:13px; box-sizing:border-box;" />
            </div>
          </div>

          <div style="margin-bottom:14px;">
            <label style="display:block; font-size:13px; font-weight:700; color:#334155; margin-bottom:6px;">
              Email Address <span style="color:#DC2626;">*</span>
            </label>
            <input type="email" id="edit-member-email" required value="${escapeHtml(member.email)}"
                   style="width:100%; padding:9px 12px; border:1px solid #CBD5E1; border-radius:8px; font-size:13px; box-sizing:border-box;" />
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:14px;">
            <div>
              <label style="display:block; font-size:13px; font-weight:700; color:#334155; margin-bottom:6px;">
                Role
              </label>
              <select id="edit-member-role" ${isProtectedAdmin ? 'disabled' : ''}
                      style="width:100%; padding:9px 12px; border:1px solid #CBD5E1; border-radius:8px; font-size:13px; background:#FFF;">
                <option value="Member" ${member.role === 'Member' ? 'selected' : ''}>Member</option>
                <option value="writer" ${member.role === 'writer' ? 'selected' : ''}>Writer</option>
                <option value="Admin" ${member.role === 'Admin' ? 'selected' : ''}>Admin</option>
              </select>
            </div>

            <div>
              <label style="display:block; font-size:13px; font-weight:700; color:#334155; margin-bottom:6px;">
                Account Status
              </label>
              <select id="edit-member-status" ${isProtectedAdmin ? 'disabled' : ''}
                      style="width:100%; padding:9px 12px; border:1px solid #CBD5E1; border-radius:8px; font-size:13px; background:#FFF;">
                <option value="active" ${member.status === 'active' ? 'selected' : ''}>Active</option>
                <option value="suspended" ${member.status === 'suspended' ? 'selected' : ''}>Suspended</option>
                <option value="blocked" ${member.status === 'blocked' ? 'selected' : ''}>Blocked</option>
                <option value="disabled" ${member.status === 'disabled' ? 'selected' : ''}>Disabled</option>
              </select>
            </div>
          </div>

          <div style="margin-bottom:20px;">
            <label style="display:block; font-size:13px; font-weight:700; color:#334155; margin-bottom:6px;">
              Bio / Literary Description
            </label>
            <textarea id="edit-member-bio" rows="2" placeholder="Optional biography..."
                      style="width:100%; padding:9px 12px; border:1px solid #CBD5E1; border-radius:8px; font-size:13px; box-sizing:border-box; resize:vertical;">${escapeHtml(member.bio || '')}</textarea>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid #E2E8F0; padding-top:16px;">
            <button type="button" class="btn btn-outline btn-sm" onclick="openResetMemberPasswordModal(${member.id})" style="color:#B88635; display:inline-flex; align-items:center; gap:6px;">
              ${ADMIN_ICONS.key} Reset Password
            </button>
            <div style="display:flex; gap:10px;">
              <button type="button" class="btn btn-outline btn-sm" onclick="closeMemberModal()">Cancel</button>
              <button type="submit" id="submit-edit-member-btn" class="btn btn-gold btn-sm" style="font-weight:700;">
                Save Changes
              </button>
            </div>
          </div>
        </form>
      </div>
    `;
  } catch (err) {
    modal.innerHTML = `
      <div class="modal-card admin-modal-card" style="max-width:440px; background:#FFF; border-radius:14px; padding:24px; text-align:center;">
        <div style="font-size:32px; color:#DC2626; margin-bottom:8px;">⚠️</div>
        <div style="font-weight:700; color:#DC2626; margin-bottom:8px;">Error Loading Member</div>
        <p style="font-size:13px; color:#64748B; margin-bottom:16px;">${escapeHtml(err.message)}</p>
        <button type="button" class="btn btn-outline btn-sm" onclick="closeMemberModal()">Close</button>
      </div>
    `;
  }
};

window.submitEditMemberForm = async (event, memberId) => {
  event.preventDefault();
  const errorBox = document.getElementById('edit-member-error-box');
  const submitBtn = document.getElementById('submit-edit-member-btn');
  if (errorBox) errorBox.style.display = 'none';

  const displayName = document.getElementById('edit-member-name')?.value.trim();
  const username = document.getElementById('edit-member-username')?.value.trim();
  const email = document.getElementById('edit-member-email')?.value.trim();
  const role = document.getElementById('edit-member-role')?.value;
  const status = document.getElementById('edit-member-status')?.value;
  const bio = document.getElementById('edit-member-bio')?.value.trim();

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';
  }

  try {
    const res = await apiFetch(`/api/admin/members/${memberId}`, {
      method: 'PUT',
      body: JSON.stringify({ displayName, username, email, role, status, bio })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to update member details.');
    }

    showToast('Member details updated successfully.');
    window.closeMemberModal();
    renderMembersManagementTab(document.getElementById('admin-main-canvas'));
  } catch (err) {
    if (errorBox) {
      errorBox.textContent = err.message;
      errorBox.style.display = 'block';
    }
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Save Changes';
    }
  }
};

/* ========================================================
   MODAL 3: ADMIN PASSWORD RESET WITHOUT MEMBER OTP
   ======================================================== */
window.openResetMemberPasswordModal = (memberId) => {
  window.closeMemberModal();
  const m = adminState.membersData?.members?.find(x => x.id === Number(memberId));
  const memberName = m ? (m.displayName || m.username) : `Member #${memberId}`;
  const memberEmail = m ? m.email : '';

  const modal = document.createElement('div');
  modal.className = 'modal-overlay open member-mgmt-modal-wrapper';
  modal.id = 'admin-reset-password-modal';
  modal.onclick = (e) => { if (e.target === modal) window.closeMemberModal(); };

  modal.innerHTML = `
    <div class="modal-card admin-modal-card" style="max-width:480px; background:#FFF; border-radius:14px; box-shadow:0 16px 48px rgba(0,0,0,0.2); overflow:hidden;">
      <div class="modal-header" style="background:#FAF5EC; padding:18px 24px; border-bottom:1px solid #E2E8F0; display:flex; justify-content:space-between; align-items:center;">
        <div style="display:flex; align-items:center; gap:10px;">
          <div style="color:#B88635; display:flex;">${ADMIN_ICONS.key}</div>
          <div>
            <h3 style="margin:0; font-size:18px; font-weight:800; color:var(--color-navy-deep);">Admin Password Reset</h3>
            <div style="font-size:12px; color:#64748B;">Direct administrative reset without target member OTP.</div>
          </div>
        </div>
        <button type="button" class="modal-close-btn" onclick="closeMemberModal()" style="background:none; border:none; font-size:20px; cursor:pointer; color:#64748B;">✕</button>
      </div>

      <form id="admin-reset-pw-form" onsubmit="submitResetMemberPassword(event, ${memberId})" style="padding:22px 24px;">
        <div id="reset-pw-error-box" style="display:none; padding:12px; background:#FEE2E2; border:1px solid #FECACA; border-radius:8px; color:#B91C1C; font-size:13px; margin-bottom:16px;"></div>

        <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px; padding:12px 14px; margin-bottom:16px;">
          <div style="font-size:11px; text-transform:uppercase; letter-spacing:0.5px; font-weight:700; color:#64748B; margin-bottom:4px;">Target Account</div>
          <div style="font-weight:700; font-size:14px; color:var(--color-navy-deep);">${escapeHtml(memberName)}</div>
          <div style="font-size:12px; font-family:monospace; color:#334155; margin-top:2px;">${escapeHtml(memberEmail)} (ID: #${memberId})</div>
        </div>

        <div style="background:#FEF3C7; border:1px solid #FDE68A; border-radius:8px; padding:12px 14px; margin-bottom:18px; display:flex; align-items:flex-start; gap:10px;">
          <div style="color:#D97706; margin-top:2px; flex-shrink:0;">${ADMIN_ICONS.shield}</div>
          <div style="font-size:12px; color:#92400E; line-height:1.4;">
            <strong>Administrative Direct Override:</strong> The target member is <u>not required</u> to enter an OTP. The new password takes effect immediately, and any existing active login sessions are revoked.
          </div>
        </div>

        <div style="margin-bottom:14px;">
          <label style="display:block; font-size:13px; font-weight:700; color:#334155; margin-bottom:6px;">
            New Password <span style="color:#DC2626;">*</span>
          </label>
          <div style="position:relative;">
            <input type="password" id="admin-reset-new-pw" required placeholder="Min 6 characters" minlength="6"
                   style="width:100%; padding:10px 40px 10px 12px; border:1px solid #CBD5E1; border-radius:8px; font-size:13px; box-sizing:border-box;" />
            <button type="button" id="toggle-reset-pw-btn" onclick="togglePasswordVisibility('admin-reset-new-pw', 'toggle-reset-pw-btn')"
                    style="position:absolute; right:8px; top:50%; transform:translateY(-50%); background:none; border:none; cursor:pointer; color:#64748B; display:flex;">
              ${ADMIN_ICONS.eye}
            </button>
          </div>
        </div>

        <div style="margin-bottom:20px;">
          <label style="display:block; font-size:13px; font-weight:700; color:#334155; margin-bottom:6px;">
            Confirm New Password <span style="color:#DC2626;">*</span>
          </label>
          <input type="password" id="admin-reset-confirm-pw" required placeholder="Confirm new password" minlength="6"
                 style="width:100%; padding:10px 12px; border:1px solid #CBD5E1; border-radius:8px; font-size:13px; box-sizing:border-box;" />
        </div>

        <div style="display:flex; justify-content:flex-end; gap:10px; border-top:1px solid #E2E8F0; padding-top:16px;">
          <button type="button" class="btn btn-outline btn-sm" onclick="closeMemberModal()">Cancel</button>
          <button type="submit" id="submit-reset-pw-btn" class="btn btn-gold btn-sm" style="font-weight:700;">
            Confirm Password Reset
          </button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);
  document.getElementById('admin-reset-new-pw')?.focus();
};

window.submitResetMemberPassword = async (event, memberId) => {
  event.preventDefault();
  const errorBox = document.getElementById('reset-pw-error-box');
  const submitBtn = document.getElementById('submit-reset-pw-btn');
  if (errorBox) errorBox.style.display = 'none';

  const newPassword = document.getElementById('admin-reset-new-pw')?.value.trim();
  const confirmPassword = document.getElementById('admin-reset-confirm-pw')?.value.trim();

  if (newPassword !== confirmPassword) {
    if (errorBox) {
      errorBox.textContent = 'Passwords do not match. Please re-enter.';
      errorBox.style.display = 'block';
    }
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Updating Password...';
  }

  try {
    const res = await apiFetch(`/api/admin/members/${memberId}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ newPassword, confirmPassword })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to reset password.');
    }

    showToast(data.message || 'Password reset successfully without OTP.');
    window.closeMemberModal();
    renderMembersManagementTab(document.getElementById('admin-main-canvas'));
  } catch (err) {
    if (errorBox) {
      errorBox.textContent = err.message;
      errorBox.style.display = 'block';
    }
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Confirm Password Reset';
    }
  }
};

/* ========================================================
   MODAL 4: TEMPORARILY BLOCK MEMBER ACCOUNT
   ======================================================== */
window.openTemporaryBlockModal = (memberId) => {
  window.closeMemberModal();
  const m = adminState.membersData?.members?.find(x => x.id === Number(memberId));
  const username = m ? m.username : `member_${memberId}`;
  const email = m ? m.email : '';

  const modal = document.createElement('div');
  modal.className = 'modal-overlay open member-mgmt-modal-wrapper';
  modal.id = 'admin-block-member-modal';
  modal.onclick = (e) => { if (e.target === modal) window.closeMemberModal(); };

  modal.innerHTML = `
    <div class="modal-card admin-modal-card" style="max-width:520px; background:#FFF; border-radius:14px; box-shadow:0 16px 48px rgba(0,0,0,0.2); overflow:hidden;">
      <div class="modal-header" style="background:#FFF7ED; padding:18px 24px; border-bottom:1px solid #FFEDD5; display:flex; justify-content:space-between; align-items:center;">
        <div style="display:flex; align-items:center; gap:10px;">
          <div style="color:#EA580C; display:flex;">${ADMIN_ICONS.lock}</div>
          <div>
            <h3 style="margin:0; font-size:18px; font-weight:800; color:#9A3412;">Temporarily Block Account</h3>
            <div style="font-size:12px; color:#C2410C;">Restrict member login and API access for a specified duration.</div>
          </div>
        </div>
        <button type="button" class="modal-close-btn" onclick="closeMemberModal()" style="background:none; border:none; font-size:20px; cursor:pointer; color:#64748B;">✕</button>
      </div>

      <form id="admin-block-member-form" onsubmit="submitTemporaryBlock(event, ${memberId})" style="padding:22px 24px;">
        <div id="block-member-error-box" style="display:none; padding:12px; background:#FEE2E2; border:1px solid #FECACA; border-radius:8px; color:#B91C1C; font-size:13px; margin-bottom:16px;"></div>

        <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px; padding:12px 14px; margin-bottom:16px;">
          <div style="font-size:11px; text-transform:uppercase; letter-spacing:0.5px; font-weight:700; color:#64748B; margin-bottom:4px;">Target Member</div>
          <div style="font-weight:700; font-size:14px; color:var(--color-navy-deep);">@${escapeHtml(username)}</div>
          <div style="font-size:12px; font-family:monospace; color:#334155; margin-top:2px;">${escapeHtml(email)} (ID: #${memberId})</div>
        </div>

        <div style="margin-bottom:16px;">
          <label style="display:block; font-size:13px; font-weight:700; color:#334155; margin-bottom:8px;">
            Block Duration <span style="color:#DC2626;">*</span>
          </label>
          <div class="block-duration-grid">
            <div class="block-duration-card" onclick="selectBlockDuration('1h', this)">
              <div style="font-weight:700; font-size:14px; color:#0B1F33;">1 Hour</div>
              <div style="font-size:11px; color:#64748B; margin-top:2px;">Cooling off</div>
            </div>
            <div class="block-duration-card selected" onclick="selectBlockDuration('24h', this)">
              <div style="font-weight:700; font-size:14px; color:#0B1F33;">24 Hours</div>
              <div style="font-size:11px; color:#64748B; margin-top:2px;">Standard 1 day</div>
            </div>
            <div class="block-duration-card" onclick="selectBlockDuration('3d', this)">
              <div style="font-weight:700; font-size:14px; color:#0B1F33;">3 Days</div>
              <div style="font-size:11px; color:#64748B; margin-top:2px;">Short penalty</div>
            </div>
            <div class="block-duration-card" onclick="selectBlockDuration('7d', this)">
              <div style="font-weight:700; font-size:14px; color:#0B1F33;">7 Days</div>
              <div style="font-size:11px; color:#64748B; margin-top:2px;">1 Week</div>
            </div>
            <div class="block-duration-card" onclick="selectBlockDuration('30d', this)">
              <div style="font-weight:700; font-size:14px; color:#0B1F33;">30 Days</div>
              <div style="font-size:11px; color:#64748B; margin-top:2px;">1 Month</div>
            </div>
            <div class="block-duration-card" onclick="selectBlockDuration('indefinite', this)">
              <div style="font-weight:700; font-size:14px; color:#0B1F33;">Manual</div>
              <div style="font-size:11px; color:#64748B; margin-top:2px;">Until unblocked</div>
            </div>
          </div>
          <input type="hidden" id="selected-block-duration" value="24h" />
        </div>

        <div id="custom-block-date-wrap" style="display:none; margin-bottom:16px;">
          <label style="display:block; font-size:13px; font-weight:700; color:#334155; margin-bottom:6px;">
            Custom Expiration Date & Time:
          </label>
          <input type="datetime-local" id="custom-block-datetime" 
                 style="width:100%; padding:9px 12px; border:1px solid #CBD5E1; border-radius:8px; font-size:13px; box-sizing:border-box;" />
        </div>

        <div style="margin-bottom:16px;">
          <label style="display:block; font-size:13px; font-weight:700; color:#334155; margin-bottom:6px;">
            Reason for Blocking <span style="font-size:11px; color:#64748B; font-weight:400;">(Shown to member upon login attempt)</span>
          </label>
          <textarea id="block-member-reason" rows="2" placeholder="e.g. Inappropriate forum comments violating community guidelines."
                    style="width:100%; padding:9px 12px; border:1px solid #CBD5E1; border-radius:8px; font-size:13px; box-sizing:border-box; resize:vertical;"></textarea>
        </div>

        <div style="background:#FFF7ED; border:1px solid #FFEDD5; border-radius:8px; padding:12px 14px; margin-bottom:20px; font-size:12px; color:#9A3412; line-height:1.4;">
          <strong>Security Action Notice:</strong> Blocking this account will automatically revoke all active sessions across all devices. When the timed duration expires, the account will automatically restore to active status.
        </div>

        <div style="display:flex; justify-content:flex-end; gap:10px; border-top:1px solid #E2E8F0; padding-top:16px;">
          <button type="button" class="btn btn-outline btn-sm" onclick="closeMemberModal()">Cancel</button>
          <button type="submit" id="submit-block-btn" class="btn btn-gold btn-sm" style="background:#EA580C; border-color:#C2410C; color:#FFF; font-weight:700;">
            Apply Temporary Block
          </button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);
};

window.selectBlockDuration = (duration, cardElem) => {
  document.querySelectorAll('.block-duration-card').forEach(c => c.classList.remove('selected'));
  if (cardElem) cardElem.classList.add('selected');
  const input = document.getElementById('selected-block-duration');
  if (input) input.value = duration;

  const customWrap = document.getElementById('custom-block-date-wrap');
  if (customWrap) {
    customWrap.style.display = duration === 'custom' ? 'block' : 'none';
  }
};

window.submitTemporaryBlock = async (event, memberId) => {
  event.preventDefault();
  const errorBox = document.getElementById('block-member-error-box');
  const submitBtn = document.getElementById('submit-block-btn');
  if (errorBox) errorBox.style.display = 'none';

  const duration = document.getElementById('selected-block-duration')?.value || '24h';
  const customExpiry = document.getElementById('custom-block-datetime')?.value || null;
  const reason = document.getElementById('block-member-reason')?.value.trim();

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Blocking Account...';
  }

  try {
    const res = await apiFetch(`/api/admin/members/${memberId}/block`, {
      method: 'POST',
      body: JSON.stringify({ duration, customExpiry, reason })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to temporarily block member.');
    }

    showToast(data.message || 'Account blocked successfully.');
    window.closeMemberModal();
    renderMembersManagementTab(document.getElementById('admin-main-canvas'));
  } catch (err) {
    if (errorBox) {
      errorBox.textContent = err.message;
      errorBox.style.display = 'block';
    }
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Apply Temporary Block';
    }
  }
};

/* ========================================================
   MODAL 5: EARLY UNBLOCK MEMBER ACCOUNT
   ======================================================== */
window.openUnblockMemberModal = (memberId) => {
  window.closeMemberModal();
  const m = adminState.membersData?.members?.find(x => x.id === Number(memberId));
  const username = m ? m.username : `member_${memberId}`;
  const email = m ? m.email : '';

  const modal = document.createElement('div');
  modal.className = 'modal-overlay open member-mgmt-modal-wrapper';
  modal.id = 'admin-unblock-member-modal';
  modal.onclick = (e) => { if (e.target === modal) window.closeMemberModal(); };

  modal.innerHTML = `
    <div class="modal-card admin-modal-card" style="max-width:480px; background:#FFF; border-radius:14px; box-shadow:0 16px 48px rgba(0,0,0,0.2); overflow:hidden;">
      <div class="modal-header" style="background:#F0FDF4; padding:18px 24px; border-bottom:1px solid #DCFCE7; display:flex; justify-content:space-between; align-items:center;">
        <div style="display:flex; align-items:center; gap:10px;">
          <div style="color:#16A34A; display:flex;">${ADMIN_ICONS.unlock}</div>
          <div>
            <h3 style="margin:0; font-size:18px; font-weight:800; color:#15803D;">Unblock Member Account</h3>
            <div style="font-size:12px; color:#166534;">Restore full login access and clear restrictions.</div>
          </div>
        </div>
        <button type="button" class="modal-close-btn" onclick="closeMemberModal()" style="background:none; border:none; font-size:20px; cursor:pointer; color:#64748B;">✕</button>
      </div>

      <form id="admin-unblock-member-form" onsubmit="submitUnblockMember(event, ${memberId})" style="padding:22px 24px;">
        <div id="unblock-member-error-box" style="display:none; padding:12px; background:#FEE2E2; border:1px solid #FECACA; border-radius:8px; color:#B91C1C; font-size:13px; margin-bottom:16px;"></div>

        <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px; padding:12px 14px; margin-bottom:16px;">
          <div style="font-size:11px; text-transform:uppercase; letter-spacing:0.5px; font-weight:700; color:#64748B; margin-bottom:4px;">Target Member</div>
          <div style="font-weight:700; font-size:14px; color:var(--color-navy-deep);">@${escapeHtml(username)}</div>
          <div style="font-size:12px; font-family:monospace; color:#334155; margin-top:2px;">${escapeHtml(email)} (ID: #${memberId})</div>
        </div>

        <div style="margin-bottom:16px;">
          <label style="display:block; font-size:13px; font-weight:700; color:#334155; margin-bottom:6px;">
            Optional Reason for Unblocking:
          </label>
          <input type="text" id="unblock-member-reason" placeholder="e.g. Administrative review completed, member resolved issue."
                 style="width:100%; padding:9px 12px; border:1px solid #CBD5E1; border-radius:8px; font-size:13px; box-sizing:border-box;" />
        </div>

        <div style="display:flex; justify-content:flex-end; gap:10px; border-top:1px solid #E2E8F0; padding-top:16px;">
          <button type="button" class="btn btn-outline btn-sm" onclick="closeMemberModal()">Cancel</button>
          <button type="submit" id="submit-unblock-btn" class="btn btn-gold btn-sm" style="background:#16A34A; border-color:#15803D; color:#FFF; font-weight:700;">
            Unblock & Restore Access
          </button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);
};

window.submitUnblockMember = async (event, memberId) => {
  event.preventDefault();
  const errorBox = document.getElementById('unblock-member-error-box');
  const submitBtn = document.getElementById('submit-unblock-btn');
  if (errorBox) errorBox.style.display = 'none';

  const reason = document.getElementById('unblock-member-reason')?.value.trim();

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Unblocking Account...';
  }

  try {
    const res = await apiFetch(`/api/admin/members/${memberId}/unblock`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to unblock member account.');
    }

    showToast(data.message || 'Account unblocked successfully.');
    window.closeMemberModal();
    renderMembersManagementTab(document.getElementById('admin-main-canvas'));
  } catch (err) {
    if (errorBox) {
      errorBox.textContent = err.message;
      errorBox.style.display = 'block';
    }
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Unblock & Restore Access';
    }
  }
};

/* ========================================================
   MODAL 6: MANAGE GRANULAR FEATURE PERMISSIONS
   ======================================================== */
window.openManagePermissionsModal = async (memberId) => {
  window.closeMemberModal();
  const modal = document.createElement('div');
  modal.className = 'modal-overlay open member-mgmt-modal-wrapper';
  modal.id = 'admin-permissions-modal';
  modal.onclick = (e) => { if (e.target === modal) window.closeMemberModal(); };

  modal.innerHTML = `
    <div class="modal-card admin-modal-card" style="max-width:540px; background:#FFF; border-radius:14px; box-shadow:0 16px 48px rgba(0,0,0,0.2); overflow:hidden;">
      <div style="padding:40px; text-align:center;">
        <div style="width:32px; height:32px; border:3px solid #E2E8F0; border-top-color:#B88635; border-radius:50%; animation:adminSpinner 0.8s linear infinite; margin:0 auto 12px;"></div>
        <div style="font-size:14px; color:#64748B;">Loading member permissions...</div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  try {
    const res = await apiFetch(`/api/admin/members/${memberId}/permissions`);
    if (!res.ok) throw new Error('Could not retrieve member permissions.');
    const data = await res.json();
    const p = data.permissions || {};

    modal.innerHTML = `
      <div class="modal-card admin-modal-card" style="max-width:540px; background:#FFF; border-radius:14px; box-shadow:0 16px 48px rgba(0,0,0,0.2); overflow:hidden;">
        <div class="modal-header" style="background:#FAF5EC; padding:18px 24px; border-bottom:1px solid #E2E8F0; display:flex; justify-content:space-between; align-items:center;">
          <div style="display:flex; align-items:center; gap:10px;">
            <div style="color:#7C3AED; display:flex;">${ADMIN_ICONS.sliders || '⚙️'}</div>
            <div>
              <h3 style="margin:0; font-size:18px; font-weight:800; color:var(--color-navy-deep);">Feature Access Permissions</h3>
              <div style="font-size:12px; color:#64748B;">Member #${data.memberId} • @${escapeHtml(data.username)} (${escapeHtml(data.role)})</div>
            </div>
          </div>
          <button type="button" class="modal-close-btn" onclick="closeMemberModal()" style="background:none; border:none; font-size:20px; cursor:pointer; color:#64748B;">✕</button>
        </div>

        <form id="admin-permissions-form" onsubmit="submitManagePermissions(event, ${memberId})" style="padding:22px 24px;">
          <div id="permissions-error-box" style="display:none; padding:12px; background:#FEE2E2; border:1px solid #FECACA; border-radius:8px; color:#B91C1C; font-size:13px; margin-bottom:16px;"></div>

          <div style="margin-bottom:16px;">
            <!-- 1. Novel Comments -->
            <div class="perm-toggle-row">
              <div>
                <div style="font-weight:700; font-size:13px; color:var(--color-navy-deep);">📝 Novel Comments & Replies</div>
                <div style="font-size:11px; color:#64748B;">Allow writing chapter comments, replying to reader threads, and liking posts.</div>
              </div>
              <label class="perm-switch">
                <input type="checkbox" id="perm-comment" ${p.can_comment !== false ? 'checked' : ''} />
                <span class="perm-slider"></span>
              </label>
            </div>

            <!-- 2. Forum Posting -->
            <div class="perm-toggle-row">
              <div>
                <div style="font-weight:700; font-size:13px; color:var(--color-navy-deep);">🏛️ Forum Discussions</div>
                <div style="font-size:11px; color:#64748B;">Allow creating community discussion topics and submitting forum replies.</div>
              </div>
              <label class="perm-switch">
                <input type="checkbox" id="perm-forum" ${p.can_post_forum !== false ? 'checked' : ''} />
                <span class="perm-slider"></span>
              </label>
            </div>

            <!-- 3. Private Messaging -->
            <div class="perm-toggle-row">
              <div>
                <div style="font-weight:700; font-size:13px; color:var(--color-navy-deep);">💬 Direct Private Chat</div>
                <div style="font-size:11px; color:#64748B;">Allow sending real-time direct messages, photos, and voice notes.</div>
              </div>
              <label class="perm-switch">
                <input type="checkbox" id="perm-chat" ${p.can_chat !== false ? 'checked' : ''} />
                <span class="perm-slider"></span>
              </label>
            </div>

            <!-- 4. Audio Novels -->
            <div class="perm-toggle-row">
              <div>
                <div style="font-weight:700; font-size:13px; color:var(--color-navy-deep);">🎧 Audio Novels Access</div>
                <div style="font-size:11px; color:#64748B;">Allow streaming and listening to exclusive narrated audio episodes.</div>
              </div>
              <label class="perm-switch">
                <input type="checkbox" id="perm-audio" ${p.can_access_audio !== false ? 'checked' : ''} />
                <span class="perm-slider"></span>
              </label>
            </div>

            <!-- 5. Novel Publishing (Writers & Admin) -->
            <div class="perm-toggle-row">
              <div>
                <div style="font-weight:700; font-size:13px; color:var(--color-navy-deep);">📖 Novel & Episode Publishing</div>
                <div style="font-size:11px; color:#64748B;">Allow publishing chapters and editing stories in the Writer workspace.</div>
              </div>
              <label class="perm-switch">
                <input type="checkbox" id="perm-novels" ${p.can_publish_novels === true ? 'checked' : ''} />
                <span class="perm-slider"></span>
              </label>
            </div>
          </div>

          <div style="margin-bottom:18px; padding:10px 12px; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px; display:flex; align-items:center; gap:8px;">
            <input type="checkbox" id="perm-revoke-sessions" checked style="cursor:pointer;" />
            <label for="perm-revoke-sessions" style="font-size:12px; color:#475569; cursor:pointer;">
              Revoke active sessions immediately to apply updated permissions right now
            </label>
          </div>

          <div style="display:flex; justify-content:flex-end; gap:10px; border-top:1px solid #E2E8F0; padding-top:16px;">
            <button type="button" class="btn btn-outline btn-sm" onclick="closeMemberModal()">Cancel</button>
            <button type="submit" id="submit-perms-btn" class="btn btn-gold btn-sm" style="font-weight:700;">
              Save Permissions
            </button>
          </div>
        </form>
      </div>
    `;
  } catch (err) {
    modal.innerHTML = `
      <div class="modal-card admin-modal-card" style="max-width:440px; background:#FFF; border-radius:14px; padding:24px; text-align:center;">
        <div style="font-size:32px; color:#DC2626; margin-bottom:8px;">⚠️</div>
        <div style="font-weight:700; color:#DC2626; margin-bottom:8px;">Error Loading Permissions</div>
        <p style="font-size:13px; color:#64748B; margin-bottom:16px;">${escapeHtml(err.message)}</p>
        <button type="button" class="btn btn-outline btn-sm" onclick="closeMemberModal()">Close</button>
      </div>
    `;
  }
};

window.submitManagePermissions = async (event, memberId) => {
  event.preventDefault();
  const errorBox = document.getElementById('permissions-error-box');
  const submitBtn = document.getElementById('submit-perms-btn');
  if (errorBox) errorBox.style.display = 'none';

  const permissions = {
    can_comment: document.getElementById('perm-comment')?.checked ?? true,
    can_post_forum: document.getElementById('perm-forum')?.checked ?? true,
    can_chat: document.getElementById('perm-chat')?.checked ?? true,
    can_access_audio: document.getElementById('perm-audio')?.checked ?? true,
    can_publish_novels: document.getElementById('perm-novels')?.checked ?? false
  };

  const revokeSessions = Boolean(document.getElementById('perm-revoke-sessions')?.checked);

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';
  }

  try {
    const res = await apiFetch(`/api/admin/members/${memberId}/permissions`, {
      method: 'PUT',
      body: JSON.stringify({ permissions, revokeSessions })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to update member permissions.');
    }

    showToast('Member permissions updated successfully.');
    window.closeMemberModal();
    renderMembersManagementTab(document.getElementById('admin-main-canvas'));
  } catch (err) {
    if (errorBox) {
      errorBox.textContent = err.message;
      errorBox.style.display = 'block';
    }
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Save Permissions';
    }
  }
};

/* ========================================================
   MODAL 7: PERMANENTLY DELETE MEMBER ACCOUNT (DANGER)
   ======================================================== */
window.openDeleteMemberModal = (memberId) => {
  window.closeMemberModal();
  const m = adminState.membersData?.members?.find(x => x.id === Number(memberId));
  const username = m ? m.username : `member_${memberId}`;
  const email = m ? m.email : '';

  const modal = document.createElement('div');
  modal.className = 'modal-overlay open member-mgmt-modal-wrapper';
  modal.id = 'admin-delete-member-modal';
  modal.onclick = (e) => { if (e.target === modal) window.closeMemberModal(); };

  modal.innerHTML = `
    <div class="modal-card admin-modal-card" style="max-width:520px; background:#FFF; border-radius:14px; box-shadow:0 16px 48px rgba(0,0,0,0.2); overflow:hidden; border:2px solid #F87171;">
      <div class="modal-header" style="background:#FEF2F2; padding:18px 24px; border-bottom:1px solid #FEE2E2; display:flex; justify-content:space-between; align-items:center;">
        <div style="display:flex; align-items:center; gap:10px;">
          <div style="color:#DC2626; display:flex;">${ADMIN_ICONS.trash}</div>
          <div>
            <h3 style="margin:0; font-size:18px; font-weight:800; color:#991B1B;">Permanently Delete Account</h3>
            <div style="font-size:12px; color:#DC2626; font-weight:600;">Irreversible administrative operation</div>
          </div>
        </div>
        <button type="button" class="modal-close-btn" onclick="closeMemberModal()" style="background:none; border:none; font-size:20px; cursor:pointer; color:#64748B;">✕</button>
      </div>

      <form id="admin-delete-member-form" onsubmit="submitDeleteMember(event, ${memberId})" style="padding:22px 24px;">
        <div id="delete-member-error-box" style="display:none; padding:12px; background:#FEE2E2; border:1px solid #FECACA; border-radius:8px; color:#B91C1C; font-size:13px; margin-bottom:16px;"></div>

        <div style="background:#FEF2F2; border:1px solid #FECACA; border-radius:10px; padding:14px 16px; margin-bottom:18px; color:#991B1B; font-size:13px; line-height:1.5;">
          <strong>⚠️ DANGER: This action cannot be undone.</strong>
          <ul style="margin:6px 0 0 16px; padding:0; font-size:12px; color:#7F1D1D;">
            <li>The user account, authentication credentials, and active sessions will be deleted.</li>
            <li>Reader profile, bookmarks, and reading history will be purged.</li>
            <li>Chapter comments and forum threads will be safely preserved or anonymized according to retention policy.</li>
            <li>Administrative security audit logs will be permanently retained.</li>
          </ul>
        </div>

        <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px; padding:12px 14px; margin-bottom:18px;">
          <div style="font-size:11px; text-transform:uppercase; letter-spacing:0.5px; font-weight:700; color:#64748B; margin-bottom:4px;">Selected Account to Delete</div>
          <div style="font-weight:800; font-size:15px; color:var(--color-navy-deep);">@${escapeHtml(username)}</div>
          <div style="font-size:12px; font-family:monospace; color:#475569; margin-top:2px;">${escapeHtml(email)} (Member ID: #${memberId})</div>
        </div>

        <div style="margin-bottom:16px;">
          <label style="display:block; font-size:13px; font-weight:700; color:#334155; margin-bottom:6px;">
            Optional Reason for Deletion:
          </label>
          <input type="text" id="delete-member-reason" placeholder="e.g. Account owner request / terms of service violation"
                 style="width:100%; padding:9px 12px; border:1px solid #CBD5E1; border-radius:8px; font-size:13px; box-sizing:border-box;" />
        </div>

        <div style="margin-bottom:20px;">
          <label style="display:block; font-size:13px; font-weight:700; color:#991B1B; margin-bottom:6px;">
            Safety Confirmation: Type <span style="font-family:monospace; background:#FEE2E2; padding:1px 6px; border-radius:4px;">${escapeHtml(username)}</span> to confirm:
          </label>
          <input type="text" id="delete-member-confirm-input" required placeholder="Type username exactly to enable deletion"
                 oninput="checkDeleteConfirmation(this.value, '${escapeHtml(username)}')"
                 style="width:100%; padding:10px 12px; border:1.5px solid #F87171; border-radius:8px; font-size:13px; box-sizing:border-box; font-family:monospace;" />
        </div>

        <div style="display:flex; justify-content:flex-end; gap:10px; border-top:1px solid #E2E8F0; padding-top:16px;">
          <button type="button" class="btn btn-outline btn-sm" onclick="closeMemberModal()">Cancel</button>
          <button type="submit" id="submit-delete-member-btn" disabled 
                  class="btn btn-sm" 
                  style="background:#DC2626; border-color:#B91C1C; color:#FFF; font-weight:700; opacity:0.4; cursor:not-allowed;">
            Permanently Delete Account
          </button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);
  document.getElementById('delete-member-confirm-input')?.focus();
};

window.checkDeleteConfirmation = (typedVal, targetUsername) => {
  const btn = document.getElementById('submit-delete-member-btn');
  if (!btn) return;
  const isMatch = (typedVal || '').trim().toLowerCase() === targetUsername.trim().toLowerCase();
  if (isMatch) {
    btn.disabled = false;
    btn.style.opacity = '1';
    btn.style.cursor = 'pointer';
  } else {
    btn.disabled = true;
    btn.style.opacity = '0.4';
    btn.style.cursor = 'not-allowed';
  }
};

window.submitDeleteMember = async (event, memberId) => {
  event.preventDefault();
  const errorBox = document.getElementById('delete-member-error-box');
  const submitBtn = document.getElementById('submit-delete-member-btn');
  if (errorBox) errorBox.style.display = 'none';

  const m = adminState.membersData?.members?.find(x => x.id === Number(memberId));
  const targetUsername = m ? m.username : '';

  const confirmationText = document.getElementById('delete-member-confirm-input')?.value.trim();
  const reason = document.getElementById('delete-member-reason')?.value.trim();

  if (confirmationText.toLowerCase() !== targetUsername.toLowerCase()) {
    if (errorBox) {
      errorBox.textContent = `Confirmation text must match "${targetUsername}" exactly.`;
      errorBox.style.display = 'block';
    }
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Deleting Account Permanently...';
  }

  try {
    const res = await apiFetch(`/api/admin/members/${memberId}/delete`, {
      method: 'POST',
      body: JSON.stringify({ confirmationText, reason })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to delete member account.');
    }

    showToast(data.message || `Account for "${targetUsername}" has been permanently deleted.`);
    window.closeMemberModal();
    renderMembersManagementTab(document.getElementById('admin-main-canvas'));
  } catch (err) {
    if (errorBox) {
      errorBox.textContent = err.message;
      errorBox.style.display = 'block';
    }
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Permanently Delete Account';
    }
  }
};

/* ========================================================
   MODAL 8: REVOKE ALL ACTIVE SESSIONS
   ======================================================== */
window.confirmRevokeMemberSessions = async (memberId) => {
  const m = adminState.membersData?.members?.find(x => x.id === Number(memberId));
  const username = m ? m.username : `Member #${memberId}`;

  if (!confirm(`Revoke all active login sessions for "${username}"?\n\nThis will immediately log them out of all browser tabs, devices, and active API tokens.`)) {
    return;
  }

  try {
    const res = await apiFetch(`/api/admin/members/${memberId}/revoke-sessions`, {
      method: 'POST'
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to revoke sessions.');
    }

    showToast(data.message || 'All active sessions terminated.');
    renderMembersManagementTab(document.getElementById('admin-main-canvas'));
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
};

/* ========================================================
   MODAL 9: COMPLETE MEMBER DETAILS & AUDIT LOGS
   ======================================================== */
window.openMemberDetailsModal = async (memberId) => {
  window.closeMemberModal();
  const modal = document.createElement('div');
  modal.className = 'modal-overlay open member-mgmt-modal-wrapper';
  modal.id = 'admin-member-details-modal';
  modal.onclick = (e) => { if (e.target === modal) window.closeMemberModal(); };

  modal.innerHTML = `
    <div class="modal-card admin-modal-card" style="max-width:680px; background:#FFF; border-radius:14px; box-shadow:0 16px 48px rgba(0,0,0,0.2); overflow:hidden;">
      <div style="padding:40px; text-align:center;">
        <div style="width:32px; height:32px; border:3px solid #E2E8F0; border-top-color:#B88635; border-radius:50%; animation:adminSpinner 0.8s linear infinite; margin:0 auto 12px;"></div>
        <div style="font-size:14px; color:#64748B;">Loading member details...</div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  try {
    const res = await apiFetch(`/api/admin/members/${memberId}`);
    if (!res.ok) throw new Error('Could not retrieve member details.');
    const { member } = await res.json();

    const isProtectedAdmin = member.id === 2 || member.email === 'digitalmarkservices.in@gmail.com';
    const isBlockedOrTemp = member.computedStatus === 'temporarily_blocked' || member.computedStatus === 'blocked';
    const p = member.permissions || {};

    modal.innerHTML = `
      <div class="modal-card admin-modal-card" style="max-width:720px; max-height:90vh; overflow-y:auto; background:#FFF; border-radius:14px; box-shadow:0 16px 48px rgba(0,0,0,0.2);">
        <div class="modal-header" style="background:#FAF5EC; padding:18px 24px; border-bottom:1px solid #E2E8F0; display:flex; justify-content:space-between; align-items:center; position:sticky; top:0; z-index:10;">
          <div style="display:flex; align-items:center; gap:12px;">
            <img src="${escapeHtml(member.avatar || '/profile.png')}" alt="${escapeHtml(member.displayName)}"
                 style="width:42px; height:42px; border-radius:50%; object-fit:cover; border:2px solid #B88635;"
                 onerror="this.src='/profile.png'" />
            <div>
              <div style="display:flex; align-items:center; gap:8px;">
                <h3 style="margin:0; font-size:18px; font-weight:800; color:var(--color-navy-deep);">${escapeHtml(member.displayName)}</h3>
                ${getMemberStatusBadge(member.status, member)}
              </div>
              <div style="font-size:12px; color:#64748B; margin-top:2px;">
                @${escapeHtml(member.username)} • Member ID #${member.id} • ${getMemberRoleBadge(member.role)}
              </div>
            </div>
          </div>
          <button type="button" class="modal-close-btn" onclick="closeMemberModal()" style="background:none; border:none; font-size:20px; cursor:pointer; color:#64748B;">✕</button>
        </div>

        <div style="padding:22px 24px;">
          <!-- Temporary Block Alert Banner if Active -->
          ${member.isTemporarilyBlocked ? `
            <div style="background:#FFF7ED; border:1px solid #FFEDD5; border-radius:10px; padding:14px 16px; margin-bottom:18px; display:flex; justify-content:space-between; align-items:center;">
              <div>
                <div style="font-weight:700; color:#C2410C; font-size:13px;">🔒 Temporarily Blocked</div>
                <div style="font-size:12px; color:#9A3412; margin-top:2px;">
                  Expires: <strong>${new Date(member.blockedUntil).toLocaleString()}</strong> (${member.remainingText || ''})
                  ${member.blockReason ? `<br><span style="color:#7C2D12;">Reason: ${escapeHtml(member.blockReason)}</span>` : ''}
                </div>
              </div>
              <button type="button" class="btn btn-sm" onclick="openUnblockMemberModal(${member.id})" style="background:#16A34A; color:#FFF; font-weight:700;">
                Unblock Now
              </button>
            </div>
          ` : ''}

          <!-- 1. Account Details Grid -->
          <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:10px; padding:16px; margin-bottom:18px;">
            <div style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; color:#475569; margin-bottom:12px;">
              Account Information
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; font-size:13px;">
              <div>
                <span style="color:#64748B;">Email Address:</span>
                <div style="font-weight:600; font-family:monospace; color:var(--color-navy-deep); word-break:break-all;">${escapeHtml(member.email)}</div>
              </div>
              <div>
                <span style="color:#64748B;">Email Verification:</span>
                <div style="font-weight:600; color:${member.emailVerified ? '#15803D' : '#64748B'};">
                  ${member.emailVerified ? '✓ Verified' : 'Unverified'}
                </div>
              </div>
              <div>
                <span style="color:#64748B;">Account Created:</span>
                <div style="font-weight:600; color:var(--color-navy-deep);">${formatAdminDateTime(member.createdAt)}</div>
              </div>
              <div>
                <span style="color:#64748B;">Last Login:</span>
                <div style="font-weight:600; color:var(--color-navy-deep);">${formatAdminDateTime(member.lastLogin)}</div>
              </div>
              <div>
                <span style="color:#64748B;">Active Sessions:</span>
                <div style="font-weight:600; color:var(--color-navy-deep);">${member.activeSessionsCount} device(s) logged in</div>
              </div>
              <div>
                <span style="color:#64748B;">Online Visibility:</span>
                <div style="font-weight:600; color:${member.isOnline ? '#15803D' : '#64748B'};">
                  ${member.isOnline ? '🟢 Online Now' : '⚪ Offline'} ${member.activityStatusEnabled ? '(Enabled)' : '(Hidden)'}
                </div>
              </div>
            </div>
          </div>

          <!-- 2. Feature Access Permissions Summary -->
          <div style="background:#FFFFFF; border:1px solid #E2E8F0; border-radius:10px; padding:16px; margin-bottom:18px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
              <div style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; color:#475569;">
                Feature Permissions
              </div>
              <button type="button" class="btn btn-outline btn-sm" onclick="openManagePermissionsModal(${member.id})" style="font-size:11px; padding:3px 8px;">
                Edit Permissions
              </button>
            </div>
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:8px;">
              <div style="padding:8px 10px; border-radius:8px; border:1px solid #E2E8F0; background:#F8FAFC; text-align:center;">
                <div style="font-size:11px; color:#64748B;">Comments</div>
                <div style="font-weight:700; color:${p.can_comment !== false ? '#15803D' : '#DC2626'}; font-size:13px;">${p.can_comment !== false ? 'Allowed' : 'Restricted'}</div>
              </div>
              <div style="padding:8px 10px; border-radius:8px; border:1px solid #E2E8F0; background:#F8FAFC; text-align:center;">
                <div style="font-size:11px; color:#64748B;">Forum</div>
                <div style="font-weight:700; color:${p.can_post_forum !== false ? '#15803D' : '#DC2626'}; font-size:13px;">${p.can_post_forum !== false ? 'Allowed' : 'Restricted'}</div>
              </div>
              <div style="padding:8px 10px; border-radius:8px; border:1px solid #E2E8F0; background:#F8FAFC; text-align:center;">
                <div style="font-size:11px; color:#64748B;">Private Chat</div>
                <div style="font-weight:700; color:${p.can_chat !== false ? '#15803D' : '#DC2626'}; font-size:13px;">${p.can_chat !== false ? 'Allowed' : 'Restricted'}</div>
              </div>
              <div style="padding:8px 10px; border-radius:8px; border:1px solid #E2E8F0; background:#F8FAFC; text-align:center;">
                <div style="font-size:11px; color:#64748B;">Audio Novels</div>
                <div style="font-weight:700; color:${p.can_access_audio !== false ? '#15803D' : '#DC2626'}; font-size:13px;">${p.can_access_audio !== false ? 'Allowed' : 'Restricted'}</div>
              </div>
              <div style="padding:8px 10px; border-radius:8px; border:1px solid #E2E8F0; background:#F8FAFC; text-align:center;">
                <div style="font-size:11px; color:#64748B;">Publish Novels</div>
                <div style="font-weight:700; color:${p.can_publish_novels ? '#15803D' : '#64748B'}; font-size:13px;">${p.can_publish_novels ? 'Allowed' : 'Disabled'}</div>
              </div>
            </div>
          </div>

          <!-- 3. Literary & Reading Activity Section -->
          <div style="background:#FAF5EC; border:1px solid #FDE68A; border-radius:10px; padding:16px; margin-bottom:18px;">
            <div style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; color:#92400E; margin-bottom:10px; display:flex; align-items:center; gap:6px;">
              ${ADMIN_ICONS.book || '📖'}
              <span>Reading Activity</span>
            </div>
            ${member.currentReading ? `
              <div style="display:flex; align-items:center; gap:12px; background:#FFF; border:1px solid #E2E8F0; border-radius:8px; padding:10px 14px;">
                <div style="font-size:24px;">📖</div>
                <div style="flex:1;">
                  <div style="font-size:11px; font-weight:700; color:#059669; text-transform:uppercase;">Currently Reading Now</div>
                  <div style="font-weight:700; font-size:14px; color:var(--color-navy-deep);">${escapeHtml(member.currentReading.title)} (Chapter ${escapeHtml(member.currentReading.chapterNum)})</div>
                  <div style="font-size:11px; color:#64748B;">Session Duration: ${Math.round((member.currentReading.durationSeconds || 0) / 60)} min</div>
                </div>
              </div>
            ` : member.lastRead ? `
              <div style="display:flex; align-items:center; gap:12px; background:#FFF; border:1px solid #E2E8F0; border-radius:8px; padding:10px 14px;">
                <div style="font-size:24px;">📚</div>
                <div style="flex:1;">
                  <div style="font-size:11px; font-weight:700; color:#475569; text-transform:uppercase;">Recent Story</div>
                  <div style="font-weight:700; font-size:14px; color:var(--color-navy-deep);">${escapeHtml(member.lastRead.title)} (Chapter ${escapeHtml(member.lastRead.chapterNum)})</div>
                  <div style="font-size:11px; color:#64748B;">Last read at: ${formatAdminDateTime(member.lastRead.lastReadAt)}</div>
                </div>
              </div>
            ` : `
              <div style="font-size:13px; color:#78350F;">No reading activity recorded yet.</div>
            `}
          </div>

          <!-- 4. Security Actions Bar -->
          <div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:20px; align-items:center; padding:14px; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:10px;">
            <button type="button" class="btn btn-outline btn-sm" onclick="openResetMemberPasswordModal(${member.id})" style="color:#B88635; display:inline-flex; align-items:center; gap:6px;">
              ${ADMIN_ICONS.key} Reset Password
            </button>
            <button type="button" class="btn btn-outline btn-sm" onclick="confirmRevokeMemberSessions(${member.id})" style="color:#DC2626; display:inline-flex; align-items:center; gap:6px;">
              ${ADMIN_ICONS.refresh} Revoke Sessions (${member.activeSessionsCount})
            </button>
            ${!isProtectedAdmin ? `
              ${isBlockedOrTemp ? `
                <button type="button" class="btn btn-outline btn-sm" onclick="openUnblockMemberModal(${member.id})" style="color:#16A34A; display:inline-flex; align-items:center; gap:6px;">
                  ${ADMIN_ICONS.unlock} Unblock Account
                </button>
              ` : `
                <button type="button" class="btn btn-outline btn-sm" onclick="openTemporaryBlockModal(${member.id})" style="color:#EA580C; display:inline-flex; align-items:center; gap:6px;">
                  ${ADMIN_ICONS.lock} Block Account
                </button>
              `}
              <button type="button" class="btn btn-outline btn-sm" onclick="openDeleteMemberModal(${member.id})" style="color:#991B1B; border-color:#FECACA; display:inline-flex; align-items:center; gap:6px;">
                ${ADMIN_ICONS.trash} Delete Account
              </button>
            ` : ''}
          </div>

          <!-- 5. Security Audit History -->
          <div>
            <div style="font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; color:#475569; margin-bottom:10px; display:flex; align-items:center; gap:6px;">
              ${ADMIN_ICONS.history}
              <span>Security Audit Trail for This Account</span>
            </div>
            ${(!member.auditHistory || member.auditHistory.length === 0) ? `
              <div style="font-size:12px; color:#94A3B8; padding:14px; background:#F8FAFC; border-radius:8px; text-align:center;">
                No administrative actions logged yet for this account.
              </div>
            ` : `
              <div style="max-height:220px; overflow-y:auto; border:1px solid #E2E8F0; border-radius:8px;">
                <table style="width:100%; border-collapse:collapse; font-size:12px;">
                  <thead>
                    <tr style="background:#F1F5F9; border-bottom:1px solid #E2E8F0; text-align:left;">
                      <th style="padding:8px 12px; color:#475569;">Action</th>
                      <th style="padding:8px 12px; color:#475569;">Administrator</th>
                      <th style="padding:8px 12px; color:#475569;">Details</th>
                      <th style="padding:8px 12px; color:#475569;">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${member.auditHistory.map(l => `
                      <tr style="border-bottom:1px solid #F1F5F9;">
                        <td style="padding:8px 12px; font-weight:700; color:var(--color-navy-deep);">${escapeHtml(l.action)}</td>
                        <td style="padding:8px 12px; color:#334155;">${escapeHtml(l.adminName)}</td>
                        <td style="padding:8px 12px; color:#64748B; font-size:11px;">${escapeHtml(l.details)}</td>
                        <td style="padding:8px 12px; color:#94A3B8; font-size:11px; white-space:nowrap;">${formatAdminDateTime(l.createdAt)}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            `}
          </div>
        </div>

        <div style="padding:16px 24px; border-top:1px solid #E2E8F0; background:#FAF5EC; display:flex; justify-content:flex-end;">
          <button type="button" class="btn btn-outline btn-sm" onclick="closeMemberModal()">Close Details</button>
        </div>
      </div>
    `;
  } catch (err) {
    modal.innerHTML = `
      <div class="modal-card admin-modal-card" style="max-width:440px; background:#FFF; border-radius:14px; padding:24px; text-align:center;">
        <div style="font-size:32px; color:#DC2626; margin-bottom:8px;">⚠️</div>
        <div style="font-weight:700; color:#DC2626; margin-bottom:8px;">Error Loading Member</div>
        <p style="font-size:13px; color:#64748B; margin-bottom:16px;">${escapeHtml(err.message)}</p>
        <button type="button" class="btn btn-outline btn-sm" onclick="closeMemberModal()">Close</button>
      </div>
    `;
  }
};

/* ========================================================
   MODAL 10: SECURITY AUDIT LOGS VIEWER
   ======================================================== */
window.openAdminAuditLogsModal = async (targetUserId = null) => {
  window.closeMemberModal();
  const modal = document.createElement('div');
  modal.className = 'modal-overlay open member-mgmt-modal-wrapper';
  modal.id = 'admin-audit-logs-modal';
  modal.onclick = (e) => { if (e.target === modal) window.closeMemberModal(); };

  modal.innerHTML = `
    <div class="modal-card admin-modal-card" style="max-width:880px; max-height:90vh; overflow-y:auto; background:#FFF; border-radius:14px; box-shadow:0 16px 48px rgba(0,0,0,0.2);">
      <div class="modal-header" style="background:#FAF5EC; padding:18px 24px; border-bottom:1px solid #E2E8F0; display:flex; justify-content:space-between; align-items:center; position:sticky; top:0; z-index:10;">
        <div style="display:flex; align-items:center; gap:10px;">
          <div style="color:#B88635; display:flex;">${ADMIN_ICONS.history}</div>
          <div>
            <h3 style="margin:0; font-size:18px; font-weight:800; color:var(--color-navy-deep);">Security Audit Logs</h3>
            <div style="font-size:12px; color:#64748B;">Immutable administrative activity logs for sensitive account operations.</div>
          </div>
        </div>
        <button type="button" class="modal-close-btn" onclick="closeMemberModal()" style="background:none; border:none; font-size:20px; cursor:pointer; color:#64748B;">✕</button>
      </div>

      <div style="padding:22px 24px;">
        <div id="audit-logs-table-container">
          <div style="text-align:center; padding:30px; color:#64748B;">Loading security audit logs...</div>
        </div>
      </div>

      <div style="padding:14px 24px; border-top:1px solid #E2E8F0; background:#FAF5EC; display:flex; justify-content:flex-end;">
        <button type="button" class="btn btn-outline btn-sm" onclick="closeMemberModal()">Done</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  try {
    const url = targetUserId 
      ? `/api/admin/members/audit-logs?targetUserId=${targetUserId}&limit=50`
      : '/api/admin/members/audit-logs?limit=50';

    const res = await apiFetch(url);
    if (!res.ok) throw new Error('Failed to retrieve audit logs.');
    const { logs } = await res.json();

    const container = document.getElementById('audit-logs-table-container');
    if (!container) return;

    if (!logs || logs.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding:40px; color:#64748B;">
          <div style="font-size:32px; margin-bottom:8px;">📜</div>
          <div style="font-weight:700; color:var(--color-navy-deep);">No Audit Logs Recorded Yet</div>
          <div style="font-size:13px; margin-top:4px;">Administrative operations will be automatically logged here.</div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div style="overflow-x:auto; border:1px solid #E2E8F0; border-radius:8px;">
        <table style="width:100%; border-collapse:collapse; font-size:12px; min-width:680px;">
          <thead>
            <tr style="background:#F8FAFC; border-bottom:1px solid #E2E8F0; text-align:left;">
              <th style="padding:10px 14px; color:#475569;">Time</th>
              <th style="padding:10px 14px; color:#475569;">Action</th>
              <th style="padding:10px 14px; color:#475569;">Administrator</th>
              <th style="padding:10px 14px; color:#475569;">Target Member</th>
              <th style="padding:10px 14px; color:#475569;">Status</th>
              <th style="padding:10px 14px; color:#475569;">Details</th>
            </tr>
          </thead>
          <tbody>
            ${logs.map(l => `
              <tr style="border-bottom:1px solid #F1F5F9;" onmouseover="this.style.background='#FFFDF8'" onmouseout="this.style.background='transparent'">
                <td style="padding:10px 14px; color:#64748B; white-space:nowrap; font-size:11px;">${formatAdminDateTime(l.createdAt)}</td>
                <td style="padding:10px 14px; font-weight:700; color:var(--color-navy-deep);">
                  <span style="background:#F1F5F9; padding:2px 8px; border-radius:4px; font-family:monospace; font-size:11px;">${escapeHtml(l.action)}</span>
                </td>
                <td style="padding:10px 14px; font-weight:600; color:#334155;">${escapeHtml(l.adminName)}</td>
                <td style="padding:10px 14px; color:#334155;">
                  ${l.targetName ? `<div>${escapeHtml(l.targetName)}</div>` : ''}
                  ${l.targetEmail ? `<div style="font-size:11px; color:#64748B; font-family:monospace;">${escapeHtml(l.targetEmail)}</div>` : ''}
                </td>
                <td style="padding:10px 14px;">
                  <span style="font-size:11px; font-weight:700; color:${l.status === 'success' ? '#15803D' : '#DC2626'}; background:${l.status === 'success' ? '#DCFCE7' : '#FEE2E2'}; padding:2px 6px; border-radius:6px;">
                    ${escapeHtml(l.status)}
                  </span>
                </td>
                <td style="padding:10px 14px; color:#475569; font-size:11px; max-width:280px; word-break:break-word;">
                  ${escapeHtml(l.details)}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    const container = document.getElementById('audit-logs-table-container');
    if (container) {
      container.innerHTML = `<div style="color:#DC2626; padding:20px; text-align:center;">Failed to load audit logs: ${escapeHtml(err.message)}</div>`;
    }
  }
};

/* ========================================================
   13. FORUM MANAGEMENT TAB (CATEGORIES & OFFICIAL TOPICS)
   ======================================================== */

window.forumAdminState = {
  activeSubTab: 'categories', // 'categories' | 'topics'
  categories: [],
  topics: [],
  selectedCategoryFilter: 'all',
  searchQuery: ''
};


// ============================================================================
// FORMS & CONTENT MANAGEMENT (3-LEVEL HIERARCHY & FINE-GRAINED ACCESS CONTROL)
// Main Title -> Sub Title -> Content Title -> Reading Content
// ============================================================================

window.formsAdminState = {
  mainCategories: [],
  subcategories: [],
  articles: [],
  accessRules: [],
  members: [],
  novels: [],
  expandedMainIds: new Set(),
  expandedSubIds: new Set(),
  searchQuery: '',
  isLoading: false
};

/**
 * Render Redesigned Forms & Content Management Tab
 * Clean, expandable hierarchy: Main Titles -> Sub Titles -> Content Items -> Nested Sub-sub-titles
 */
export async function renderForumManagementTab(canvas) {
  canvas.innerHTML = `
    <div class="admin-page-header" style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px; flex-wrap:wrap; gap:16px;">
      <div>
        <h1 style="font-family:'Playfair Display',serif; font-size:1.85rem; color:#0B1F33; margin:0 0 6px;">
          Forms &amp; Content Management
        </h1>
        <p style="color:#64748B; font-size:13.5px; margin:0; line-height:1.5;">
          Manage the full nested content hierarchy (<strong>Main Titles → Sub-titles → Content Items → Sub-sub-titles</strong>) with rich-text editor and fine-grained access control.
        </p>
      </div>

      <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
        <a href="#forms" target="_blank" class="btn btn-outline btn-sm" style="display:inline-flex; align-items:center; gap:6px;">
          ${ADMIN_ICONS.externalLink} View Live Forms
        </a>
        <button type="button" class="btn btn-gold btn-sm" onclick="window.openCreateMainModal()" style="display:inline-flex; align-items:center; gap:6px;">
          ${ADMIN_ICONS.plus} + Add Main Title
        </button>
      </div>
    </div>

    <!-- Toolbar: Search filter, Expand/Collapse All & Summary Badges -->
    <div class="forms-tree-toolbar">
      <div class="forms-tree-search-wrap">
        <span class="forms-tree-search-icon">🔍</span>
        <input type="text" id="forms-tree-search-input" class="forms-tree-search-input" 
               placeholder="Search main titles, sub-titles, or content..." 
               oninput="window.handleFormsTreeSearch(this.value)">
      </div>

      <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
        <button type="button" class="btn btn-outline btn-xs" onclick="window.toggleAllFormsTree(true)">
          Expand All
        </button>
        <button type="button" class="btn btn-outline btn-xs" onclick="window.toggleAllFormsTree(false)">
          Collapse All
        </button>
        <span class="forms-tree-pill" id="tree-badge-mains">0 Mains</span>
        <span class="forms-tree-pill" id="tree-badge-subs">0 Subs</span>
        <span class="forms-tree-pill" id="tree-badge-arts">0 Contents</span>
      </div>
    </div>

    <!-- Tree Container Canvas -->
    <div id="forms-admin-tree-container">
      <div style="text-align:center; padding:50px 20px; color:#64748B;">
        <div style="width:34px; height:34px; border:3px solid #E2E8F0; border-top-color:#B88635; border-radius:50%; animation:adminSpinner 0.8s linear infinite; margin:0 auto 12px;"></div>
        <div>Loading Forms &amp; Content Management hierarchy...</div>
      </div>
    </div>

    <!-- Modals Mount Point -->
    <div id="forms-admin-modal-container"></div>
  `;

  await window.loadFormsAdminData();
}

/**
 * Load all Forms & Content Data from Database
 */
window.loadFormsAdminData = async () => {
  try {
    const [mainRes, subRes, artRes, accRes, memRes, novRes] = await Promise.all([
      apiFetch('/api/admin/content/main-categories'),
      apiFetch('/api/admin/content/subcategories'),
      apiFetch('/api/admin/content/articles'),
      apiFetch('/api/admin/content/access-rules'),
      apiFetch('/api/admin/members?limit=250'),
      apiFetch('/api/admin/novels')
    ]);

    if (mainRes.ok) {
      const data = await mainRes.json();
      window.formsAdminState.mainCategories = data.categories || [];
    }
    if (subRes.ok) {
      const data = await subRes.json();
      window.formsAdminState.subcategories = data.subcategories || [];
    }
    if (artRes.ok) {
      const data = await artRes.json();
      window.formsAdminState.articles = data.articles || [];
    }
    if (accRes.ok) {
      const data = await accRes.json();
      window.formsAdminState.accessRules = data.rules || [];
    }
    if (memRes.ok) {
      const data = await memRes.json();
      window.formsAdminState.members = data.members || [];
    }
    if (novRes.ok) {
      const data = await novRes.json();
      window.formsAdminState.novels = data.novels || [];
    }

    // Default expand all main and subcategories on first load
    if (window.formsAdminState.expandedMainIds.size === 0) {
      window.formsAdminState.mainCategories.forEach(m => window.formsAdminState.expandedMainIds.add(m.id));
    }
    if (window.formsAdminState.expandedSubIds.size === 0) {
      window.formsAdminState.subcategories.forEach(s => window.formsAdminState.expandedSubIds.add(s.id));
    }

    // Update counter badges
    const mBadge = document.getElementById('tree-badge-mains');
    const sBadge = document.getElementById('tree-badge-subs');
    const aBadge = document.getElementById('tree-badge-arts');
    const sideBadge = document.getElementById('nav-forum-count');

    if (mBadge) mBadge.textContent = `${window.formsAdminState.mainCategories.length} Mains`;
    if (sBadge) sBadge.textContent = `${window.formsAdminState.subcategories.length} Subs`;
    if (aBadge) aBadge.textContent = `${window.formsAdminState.articles.length} Contents`;
    if (sideBadge) sideBadge.textContent = window.formsAdminState.mainCategories.length;

    window.renderFormsHierarchyTree();
  } catch (err) {
    console.error('Error loading forms admin data:', err);
    const container = document.getElementById('forms-admin-tree-container');
    if (container) {
      container.innerHTML = `
        <div style="background:#FEF2F2; border:1px solid #FCA5A5; color:#991B1B; padding:20px; border-radius:10px; text-align:center;">
          <strong>Error loading hierarchy:</strong> ${escapeHtml(err.message)}
          <div style="margin-top:12px;">
            <button type="button" class="btn btn-outline btn-sm" onclick="window.loadFormsAdminData()">Retry</button>
          </div>
        </div>
      `;
    }
  }
};

/**
 * Filter tree search query
 */
window.handleFormsTreeSearch = (val) => {
  window.formsAdminState.searchQuery = (val || '').trim().toLowerCase();
  window.renderFormsHierarchyTree();
};

/**
 * Expand or collapse all sections
 */
window.toggleAllFormsTree = (expand) => {
  if (expand) {
    window.formsAdminState.mainCategories.forEach(m => window.formsAdminState.expandedMainIds.add(m.id));
    window.formsAdminState.subcategories.forEach(s => window.formsAdminState.expandedSubIds.add(s.id));
  } else {
    window.formsAdminState.expandedMainIds.clear();
    window.formsAdminState.expandedSubIds.clear();
  }
  window.renderFormsHierarchyTree();
};

window.toggleFormsMainExpand = (mainId) => {
  if (window.formsAdminState.expandedMainIds.has(mainId)) {
    window.formsAdminState.expandedMainIds.delete(mainId);
  } else {
    window.formsAdminState.expandedMainIds.add(mainId);
  }
  window.renderFormsHierarchyTree();
};

window.toggleFormsSubExpand = (subId) => {
  if (window.formsAdminState.expandedSubIds.has(subId)) {
    window.formsAdminState.expandedSubIds.delete(subId);
  } else {
    window.formsAdminState.expandedSubIds.add(subId);
  }
  window.renderFormsHierarchyTree();
};

/**
 * Render the full expandable tree of Main Titles -> Sub Titles -> Content Items -> Nested Sub-sub-titles
 */
window.renderFormsHierarchyTree = () => {
  const container = document.getElementById('forms-admin-tree-container');
  if (!container) return;

  const mains = window.formsAdminState.mainCategories || [];
  const subs = window.formsAdminState.subcategories || [];
  const allArticles = window.formsAdminState.articles || [];
  const q = window.formsAdminState.searchQuery;

  // Build recursive article tree for each subcategory
  function buildRecursiveArticleTree(artList, parentId = null) {
    return artList
      .filter(a => {
        if (parentId === null) {
          return a.parent_id === null || a.parent_id === 0 || !a.parent_id;
        }
        return Number(a.parent_id) === Number(parentId);
      })
      .map(art => ({
        ...art,
        children: buildRecursiveArticleTree(artList, art.id)
      }));
  }

  // Recursive renderer for content item row & its nested sub-sub-titles
  function renderContentItemRow(art, subItem, mainItem, depth = 0) {
    const isDis = art.is_disabled || art.status === 'disabled';
    const hasChildren = art.children && art.children.length > 0;
    const readLink = `#content?slug=${encodeURIComponent(art.unique_slug || art.id)}`;

    let statusPillClass = 'pill-published';
    if (isDis) statusPillClass = 'pill-disabled';
    else if (art.status === 'draft') statusPillClass = 'pill-draft';
    else if (art.status === 'scheduled') statusPillClass = 'pill-scheduled';

    const accessLabel = (art.access_permission || 'admin_only') === 'admin_only' ? 'Admin Only'
      : (art.access_permission === 'all_writers' ? 'All Writers' : 'Selected Writers');

    return `
      <div class="forms-tree-item-row ${depth > 0 ? 'is-child' : ''}" style="${depth > 0 ? `margin-left:${depth * 24}px; border-radius:6px; margin-top:4px; margin-bottom:4px;` : ''}">
        <div class="forms-tree-item-left">
          <span class="forms-tree-item-icon">${depth > 0 ? '↳ 📄' : '📄'}</span>
          <div class="forms-tree-item-info">
            <div>
              <a href="${readLink}" target="_blank" class="forms-tree-item-title-link" title="Open reading view in new tab">
                ${escapeHtml(art.title)}
              </a>
              ${art.content ? '<span style="font-size:11px; color:#15803D; margin-left:4px;" title="Contains rich text reading content">📖</span>' : ''}
              ${hasChildren ? `<span class="forms-tree-pill" style="margin-left:6px; background:#EDE9FE; color:#5B21B6; font-size:10.5px;">${art.children.length} ${art.children.length === 1 ? 'part' : 'parts'}</span>` : ''}
            </div>
            <div class="forms-tree-item-badges">
              <span class="forms-tree-pill ${statusPillClass}">
                ${isDis ? 'Disabled' : (art.status ? (art.status.charAt(0).toUpperCase() + art.status.slice(1)) : 'Published')}
              </span>
              <span class="forms-tree-pill pill-access" title="Editing Access Permission">
                🛡️ ${accessLabel}
              </span>
              <span class="forms-tree-pill" title="Author">
                ✍️ ${escapeHtml(art.author_name || 'Rudhra Prarthana')}
              </span>
              <span class="forms-tree-pill" title="Comments">
                💬 ${art.comments_count || 0}
              </span>
              <span class="forms-tree-pill" title="Views">
                👁️ ${Number(art.views_count || 0).toLocaleString()}
              </span>
              <span class="forms-tree-pill" title="Updated Date">
                🕒 ${art.updated_at ? new Date(art.updated_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'Recent'}
              </span>
            </div>
          </div>
        </div>

        <div class="forms-tree-item-actions">
          <button type="button" class="btn btn-outline btn-xs" 
                  onclick="window.openCreateArticleModal('${escapeQuotes(mainItem.id)}', '${escapeQuotes(subItem.id)}', ${art.id})" 
                  style="color:#6D28D9; border-color:#DDD6FE; font-weight:700;"
                  title="Add nested child part / sub-sub-title under this item">
            + Add Sub-sub-title
          </button>
          <button type="button" class="btn btn-outline btn-xs" onclick="window.openCreateArticleModal('${escapeQuotes(mainItem.id)}', '${escapeQuotes(subItem.id)}', null, ${art.id})" title="Edit content">
            Edit
          </button>
          <button type="button" class="btn btn-outline btn-xs" 
                  onclick="window.toggleContentArticleStatus(${art.id}, ${isDis ? 'true' : 'false'})"
                  style="${isDis ? 'color:#15803D; border-color:#BBF7D0;' : 'color:#DC2626; border-color:#FECACA;'}"
                  title="Toggle publication status">
            ${isDis ? 'Enable' : 'Disable'}
          </button>
          <button type="button" class="btn btn-outline btn-xs" 
                  onclick="window.openAccessRuleModal('content', '${art.id}', '${escapeQuotes(art.title)}')"
                  style="color:#B88635; border-color:#E8DCCB;"
                  title="Member Access Restriction">
            🛡️
          </button>
          <button type="button" class="btn btn-outline btn-xs" onclick="window.deleteContentArticle(${art.id})" style="color:#DC2626; border-color:#FECACA;" title="Delete">
            ✕
          </button>
        </div>
      </div>

      ${hasChildren ? `
        <div class="forms-tree-nested-container" style="padding-left:12px;">
          ${art.children.map(child => renderContentItemRow(child, subItem, mainItem, depth + 1)).join('')}
        </div>
      ` : ''}
    `;
  }

  // Filter mains and subs based on search query
  let filteredMains = mains;
  if (q) {
    filteredMains = mains.filter(m => {
      const mMatch = m.title.toLowerCase().includes(q) || m.id.toLowerCase().includes(q);
      const subMatch = subs.some(s => String(s.main_category_id) === String(m.id) && (s.title.toLowerCase().includes(q) || s.id.toLowerCase().includes(q)));
      const artMatch = allArticles.some(a => String(a.main_category_id) === String(m.id) && (a.title.toLowerCase().includes(q) || (a.content || '').toLowerCase().includes(q)));
      return mMatch || subMatch || artMatch;
    });
  }

  if (filteredMains.length === 0) {
    container.innerHTML = `
      <div style="background:#ffffff; border:1px solid #E2E8F0; border-radius:12px; padding:48px 20px; text-align:center; color:#64748B;">
        <div style="font-size:36px; margin-bottom:10px;">🔍</div>
        <h3 style="font-family:'Playfair Display',serif; color:#0B1F33; margin:0 0 6px;">No Content Found</h3>
        <p style="font-size:13.5px; margin:0 0 16px;">No main titles or nested content matched your search query "${escapeHtml(q)}".</p>
        <button type="button" class="btn btn-gold btn-sm" onclick="window.handleFormsTreeSearch('')">Clear Search</button>
      </div>
    `;
    return;
  }

  container.innerHTML = filteredMains.map(mainCat => {
    const isMainExpanded = window.formsAdminState.expandedMainIds.has(mainCat.id) || Boolean(q);
    const mainSubs = subs.filter(s => String(s.main_category_id) === String(mainCat.id));
    const mainArticles = allArticles.filter(a => String(a.main_category_id) === String(mainCat.id));
    const isDis = mainCat.is_disabled || mainCat.status === 'disabled';

    return `
      <div class="forms-tree-main-card" id="forms-main-card-${escapeHtml(mainCat.id)}">
        <!-- Main Title Header -->
        <div class="forms-tree-main-header" onclick="window.toggleFormsMainExpand('${escapeQuotes(mainCat.id)}')">
          <div class="forms-tree-main-left">
            <span class="forms-tree-toggle-arrow ${!isMainExpanded ? 'is-collapsed' : ''}">▼</span>
            <span class="forms-tree-main-icon" style="background:${escapeHtml(mainCat.color || '#EDE9FE')}; color:#ffffff;">
              ${mainCat.icon || '💬'}
            </span>
            <div class="forms-tree-main-title-wrap">
              <h2 class="forms-tree-main-title">
                ${escapeHtml(mainCat.title)}
                <span class="forms-tree-pill" style="font-size:11px; font-weight:normal; font-family:monospace;">ID: ${escapeHtml(mainCat.id)}</span>
              </h2>
              <div class="forms-tree-main-meta">
                <span>${mainSubs.length} Sub-titles</span>
                <span>•</span>
                <span>${mainArticles.length} Content items</span>
                <span>•</span>
                <span class="forms-tree-pill ${!isDis ? 'pill-published' : 'pill-disabled'}">
                  ${!isDis ? 'Published' : 'Disabled'}
                </span>
                ${mainCat.description ? `<span style="color:#64748B;">${escapeHtml(mainCat.description)}</span>` : ''}
              </div>
            </div>
          </div>

          <!-- Main Actions Bar -->
          <div class="forms-tree-main-actions" onclick="event.stopPropagation()">
            <button type="button" class="btn btn-gold btn-sm" 
                    onclick="window.openCreateSubModal('${escapeQuotes(mainCat.id)}')"
                    title="Add a new Sub-title directly inside ${escapeQuotes(mainCat.title)}"
                    style="font-weight:700;">
              ${ADMIN_ICONS.plus} + Add Sub-title
            </button>
            <button type="button" class="btn btn-outline btn-sm" onclick="window.openCreateMainModal('${escapeQuotes(mainCat.id)}')">
              Edit
            </button>
            <button type="button" class="btn btn-outline btn-sm" 
                    onclick="window.toggleMainCategoryStatus('${escapeQuotes(mainCat.id)}', ${isDis ? 'true' : 'false'})"
                    style="${isDis ? 'color:#15803D;' : 'color:#DC2626;'}">
              ${isDis ? 'Enable' : 'Disable'}
            </button>
            <button type="button" class="btn btn-outline btn-sm" 
                    onclick="window.openAccessRuleModal('main_category', '${escapeQuotes(mainCat.id)}', '${escapeQuotes(mainCat.title)}')"
                    style="color:#B88635;" title="Member Access Control">
              🛡️ Access
            </button>
            <button type="button" class="btn btn-outline btn-sm" onclick="window.deleteMainCategory('${escapeQuotes(mainCat.id)}')" style="color:#DC2626;" title="Delete">
              Delete
            </button>
          </div>
        </div>

        <!-- Main Body: Sub-titles List -->
        ${isMainExpanded ? `
          <div class="forms-tree-main-body">
            ${mainSubs.length === 0 ? `
              <div class="forms-tree-empty">
                <div>No Sub-titles inside <strong>${escapeHtml(mainCat.title)}</strong> yet.</div>
                <button type="button" class="btn btn-gold btn-sm" style="margin-top:10px;" onclick="window.openCreateSubModal('${escapeQuotes(mainCat.id)}')">
                  + Add First Sub-title
                </button>
              </div>
            ` : mainSubs.map(subItem => {
              const isSubExpanded = window.formsAdminState.expandedSubIds.has(subItem.id) || Boolean(q);
              const subArticlesRaw = allArticles.filter(a => String(a.sub_category_id) === String(subItem.id));
              const subTree = buildRecursiveArticleTree(subArticlesRaw, null);
              const isSubDis = subItem.is_disabled || subItem.status === 'disabled';

              return `
                <div class="forms-tree-sub-card" id="forms-sub-card-${escapeHtml(subItem.id)}">
                  <!-- Sub-title Header -->
                  <div class="forms-tree-sub-header" onclick="window.toggleFormsSubExpand('${escapeQuotes(subItem.id)}')">
                    <div class="forms-tree-sub-left">
                      <span class="forms-tree-toggle-arrow ${!isSubExpanded ? 'is-collapsed' : ''}" style="width:20px; height:20px; font-size:10px;">▼</span>
                      <span style="font-size:16px;">${subItem.icon || '📌'}</span>
                      <div class="forms-tree-sub-title">
                        ${escapeHtml(subItem.title)}
                        <span class="forms-tree-pill" style="font-weight:normal; font-size:11px;">${subArticlesRaw.length} Content ${subArticlesRaw.length === 1 ? 'item' : 'items'}</span>
                        <span class="forms-tree-pill ${!isSubDis ? 'pill-published' : 'pill-disabled'}">
                          ${!isSubDis ? 'Active' : 'Disabled'}
                        </span>
                      </div>
                    </div>

                    <div class="forms-tree-sub-actions" onclick="event.stopPropagation()">
                      <button type="button" class="btn btn-primary btn-xs" 
                              onclick="window.openCreateArticleModal('${escapeQuotes(mainCat.id)}', '${escapeQuotes(subItem.id)}')"
                              style="font-weight:700;"
                              title="Add content item directly inside ${escapeQuotes(subItem.title)}">
                        + Add Content
                      </button>
                      <button type="button" class="btn btn-outline btn-xs" onclick="window.openCreateSubModal('${escapeQuotes(mainCat.id)}', '${escapeQuotes(subItem.id)}')">
                        Edit
                      </button>
                      <button type="button" class="btn btn-outline btn-xs" 
                              onclick="window.toggleSubCategoryStatus('${escapeQuotes(subItem.id)}', ${isSubDis ? 'true' : 'false'})"
                              style="${isSubDis ? 'color:#15803D;' : 'color:#DC2626;'}">
                        ${isSubDis ? 'Enable' : 'Disable'}
                      </button>
                      <button type="button" class="btn btn-outline btn-xs" 
                              onclick="window.openAccessRuleModal('subcategory', '${escapeQuotes(subItem.id)}', '${escapeQuotes(subItem.title)}')"
                              style="color:#B88635;" title="Member Access Control">
                        🛡️
                      </button>
                      <button type="button" class="btn btn-outline btn-xs" onclick="window.deleteSubCategory('${escapeQuotes(subItem.id)}')" style="color:#DC2626;" title="Delete">
                        ✕
                      </button>
                    </div>
                  </div>

                  <!-- Sub-title Body: Content Items -->
                  ${isSubExpanded ? `
                    <div class="forms-tree-content-list">
                      ${subTree.length === 0 ? `
                        <div class="forms-tree-empty" style="padding:16px;">
                          <span>No Content items inside <strong>${escapeHtml(subItem.title)}</strong> yet.</span>
                          <button type="button" class="btn btn-primary btn-xs" style="margin-left:8px;" onclick="window.openCreateArticleModal('${escapeQuotes(mainCat.id)}', '${escapeQuotes(subItem.id)}')">
                            + Add Content
                          </button>
                        </div>
                      ` : subTree.map(art => renderContentItemRow(art, subItem, mainCat, 0)).join('')}
                    </div>
                  ` : ''}
                </div>
              `;
            }).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
};

/**
 * Open Modal to Create or Edit Main Category
 */
window.openCreateMainModal = (editId = null) => {
  const container = document.getElementById('forms-admin-modal-container');
  if (!container) return;

  let existing = null;
  if (editId) {
    existing = (window.formsAdminState.mainCategories || []).find(m => String(m.id) === String(editId));
  }

  container.innerHTML = `
    <div class="admin-modal-backdrop" onclick="window.closeFormsAdminModal(event)" style="position:fixed; inset:0; background:rgba(15,23,42,0.6); z-index:99999; display:flex; align-items:center; justify-content:center; padding:16px;">
      <div class="admin-modal-box" onclick="event.stopPropagation()" style="background:#fff; border-radius:14px; width:100%; max-width:540px; padding:24px; box-shadow:0 20px 40px rgba(0,0,0,0.2);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px;">
          <h3 style="font-family:'Playfair Display',serif; font-size:1.35rem; color:#0B1F33; margin:0;">
            ${existing ? 'Edit Main Title' : 'New Main Category Title'}
          </h3>
          <button type="button" onclick="window.closeFormsAdminModal()" style="border:none; background:none; font-size:20px; cursor:pointer;">✕</button>
        </div>

        <div style="margin-bottom:14px;">
          <label style="font-size:12px; font-weight:700; color:#0B1F33; display:block; margin-bottom:4px;">Main Title Name *</label>
          <input type="text" id="main-form-title" class="form-input" 
                 value="${existing ? escapeQuotes(existing.title) : ''}" 
                 placeholder="e.g. General, Announcements, Readers Lounge" 
                 style="width:100%; box-sizing:border-box;">
        </div>

        <div style="margin-bottom:14px;">
          <label style="font-size:12px; font-weight:700; color:#0B1F33; display:block; margin-bottom:4px;">Unique Slug / ID *</label>
          <input type="text" id="main-form-id" class="form-input" 
                 value="${existing ? escapeQuotes(existing.id) : ''}" 
                 ${existing ? 'disabled style="background:#F1F5F9; cursor:not-allowed; width:100%; box-sizing:border-box;"' : 'style="width:100%; box-sizing:border-box;"'} 
                 placeholder="e.g. general, readers-lounge">
        </div>

        <div style="margin-bottom:14px;">
          <label style="font-size:12px; font-weight:700; color:#0B1F33; display:block; margin-bottom:4px;">Description</label>
          <textarea id="main-form-desc" class="form-input" rows="2" placeholder="Brief subtitle for the forms directory..." style="width:100%; box-sizing:border-box;">${existing ? escapeQuotes(existing.description || '') : ''}</textarea>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:18px;">
          <div>
            <label style="font-size:12px; font-weight:700; color:#0B1F33; display:block; margin-bottom:4px;">Icon Emoji</label>
            <input type="text" id="main-form-icon" class="form-input" value="${existing ? escapeQuotes(existing.icon || '💬') : '💬'}" style="width:100%; box-sizing:border-box;">
          </div>
          <div>
            <label style="font-size:12px; font-weight:700; color:#0B1F33; display:block; margin-bottom:4px;">Accent Color</label>
            <input type="color" id="main-form-color" class="form-input" value="${existing ? (existing.color || '#2E1065') : '#2E1065'}" style="width:100%; height:38px; box-sizing:border-box; cursor:pointer;">
          </div>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:10px;">
          <button type="button" class="btn btn-outline btn-sm" onclick="window.closeFormsAdminModal()">Cancel</button>
          <button type="button" class="btn btn-gold btn-sm" onclick="window.submitMainForm('${existing ? escapeQuotes(existing.id) : ''}')">
            ${existing ? 'Save Changes' : 'Create Main Title'}
          </button>
        </div>
      </div>
    </div>
  `;
};

window.submitMainForm = async (editId = null) => {
  const title = document.getElementById('main-form-title')?.value?.trim();
  const id = document.getElementById('main-form-id')?.value?.trim();
  const description = document.getElementById('main-form-desc')?.value?.trim();
  const icon = document.getElementById('main-form-icon')?.value?.trim() || '💬';
  const color = document.getElementById('main-form-color')?.value || '#2E1065';

  if (!title) {
    showToast('Please enter a main title name.');
    return;
  }
  if (!editId && !id) {
    showToast('Please enter a unique ID.');
    return;
  }

  try {
    const url = editId ? `/api/admin/content/main-categories/${encodeURIComponent(editId)}` : '/api/admin/content/main-categories';
    const method = editId ? 'PUT' : 'POST';
    const res = await apiFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editId || id, title, description, icon, color })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      showToast(data.error || 'Failed to save main category.');
      return;
    }
    showToast(`Main title "${title}" saved successfully! ✓`);
    window.closeFormsAdminModal();
    await window.loadFormsAdminData();
  } catch (err) {
    showToast(err.message || 'Error saving category.');
  }
};

/**
 * Open Modal to Create or Edit Sub-title (Auto-selects Parent Main Title!)
 */
window.openCreateSubModal = (preselectedMainId = null, editId = null) => {
  const container = document.getElementById('forms-admin-modal-container');
  if (!container) return;

  const categories = window.formsAdminState.mainCategories || [];
  let existing = null;
  if (editId) {
    existing = (window.formsAdminState.subcategories || []).find(s => String(s.id) === String(editId));
  }

  const selectedMainId = existing ? existing.main_category_id : (preselectedMainId || categories[0]?.id || '');
  const selectedMain = categories.find(c => String(c.id) === String(selectedMainId));

  container.innerHTML = `
    <div class="admin-modal-backdrop" onclick="window.closeFormsAdminModal(event)" style="position:fixed; inset:0; background:rgba(15,23,42,0.6); z-index:99999; display:flex; align-items:center; justify-content:center; padding:16px;">
      <div class="admin-modal-box" onclick="event.stopPropagation()" style="background:#fff; border-radius:14px; width:100%; max-width:560px; padding:24px; box-shadow:0 20px 40px rgba(0,0,0,0.2);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px;">
          <h3 style="font-family:'Playfair Display',serif; font-size:1.35rem; color:#0B1F33; margin:0;">
            ${existing ? 'Edit Sub-title' : 'New Sub-title Section'}
          </h3>
          <button type="button" onclick="window.closeFormsAdminModal()" style="border:none; background:none; font-size:20px; cursor:pointer;">✕</button>
        </div>

        ${preselectedMainId && !existing ? `
          <div style="background:#FAF5EC; border:1px solid #E8DCCB; border-radius:8px; padding:10px 14px; margin-bottom:14px; font-size:12.5px; color:#B88635;">
            Parent Main Title: <strong>${escapeHtml(selectedMain ? selectedMain.title : preselectedMainId)}</strong>
          </div>
        ` : ''}

        <div style="margin-bottom:14px;">
          <label style="font-size:12px; font-weight:700; color:#0B1F33; display:block; margin-bottom:4px;">Parent Main Title *</label>
          <select id="sub-form-main" class="form-input" style="width:100%; box-sizing:border-box;">
            ${categories.map(c => `
              <option value="${escapeHtml(c.id)}" ${String(c.id) === String(selectedMainId) ? 'selected' : ''}>
                ${escapeHtml(c.icon || '📂')} ${escapeHtml(c.title)}
              </option>
            `).join('')}
          </select>
        </div>

        <div style="margin-bottom:14px;">
          <label style="font-size:12px; font-weight:700; color:#0B1F33; display:block; margin-bottom:4px;">Sub-title Name *</label>
          <input type="text" id="sub-form-title" class="form-input" 
                 value="${existing ? escapeQuotes(existing.title) : ''}" 
                 placeholder="e.g. Welcome Notes, Announcements, Tea Time" 
                 style="width:100%; box-sizing:border-box;">
        </div>

        <div style="margin-bottom:14px;">
          <label style="font-size:12px; font-weight:700; color:#0B1F33; display:block; margin-bottom:4px;">Unique Slug / ID *</label>
          <input type="text" id="sub-form-id" class="form-input" 
                 value="${existing ? escapeQuotes(existing.id) : ''}" 
                 ${existing ? 'disabled style="background:#F1F5F9; cursor:not-allowed; width:100%; box-sizing:border-box;"' : 'style="width:100%; box-sizing:border-box;"'} 
                 placeholder="e.g. welcome-notes, tea-time-chat">
        </div>

        <div style="margin-bottom:14px;">
          <label style="font-size:12px; font-weight:700; color:#0B1F33; display:block; margin-bottom:4px;">Description / Purpose</label>
          <textarea id="sub-form-desc" class="form-input" rows="2" placeholder="Brief description for members..." style="width:100%; box-sizing:border-box;">${existing ? escapeQuotes(existing.description || '') : ''}</textarea>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:18px;">
          <div>
            <label style="font-size:12px; font-weight:700; color:#0B1F33; display:block; margin-bottom:4px;">Icon Emoji</label>
            <input type="text" id="sub-form-icon" class="form-input" value="${existing ? escapeQuotes(existing.icon || '📌') : '📌'}" style="width:100%; box-sizing:border-box;">
          </div>
          <div>
            <label style="font-size:12px; font-weight:700; color:#0B1F33; display:block; margin-bottom:4px;">Display Order</label>
            <input type="number" id="sub-form-order" class="form-input" value="${existing ? (existing.sort_order || 0) : 0}" style="width:100%; box-sizing:border-box;">
          </div>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:10px;">
          <button type="button" class="btn btn-outline btn-sm" onclick="window.closeFormsAdminModal()">Cancel</button>
          <button type="button" class="btn btn-gold btn-sm" onclick="window.submitSubForm('${existing ? escapeQuotes(existing.id) : ''}')">
            ${existing ? 'Save Changes' : 'Create Sub-title'}
          </button>
        </div>
      </div>
    </div>
  `;
};

window.submitSubForm = async (editId = null) => {
  const mainCategoryId = document.getElementById('sub-form-main')?.value;
  const title = document.getElementById('sub-form-title')?.value?.trim();
  const id = document.getElementById('sub-form-id')?.value?.trim();
  const description = document.getElementById('sub-form-desc')?.value?.trim();
  const icon = document.getElementById('sub-form-icon')?.value?.trim() || '📌';
  const sortOrder = parseInt(document.getElementById('sub-form-order')?.value || '0', 10);

  if (!title) {
    showToast('Please enter a sub-title name.');
    return;
  }
  if (!editId && !id) {
    showToast('Please enter a unique ID.');
    return;
  }

  try {
    const url = editId ? `/api/admin/content/subcategories/${encodeURIComponent(editId)}` : '/api/admin/content/subcategories';
    const method = editId ? 'PUT' : 'POST';
    const res = await apiFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editId || id, mainCategoryId, title, description, icon, sortOrder })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      showToast(data.error || 'Failed to save sub-title.');
      return;
    }
    showToast(`Sub-title "${title}" saved successfully! ✓`);
    window.closeFormsAdminModal();
    await window.loadFormsAdminData();
  } catch (err) {
    showToast(err.message || 'Error saving sub-title.');
  }
};

/**
 * Open Modal to Create or Edit Content Article (Auto-selects Parent Main, Sub, and Parent Content Item!)
 */
window.openCreateArticleModal = async (preselectedMainId = null, preselectedSubId = null, preselectedParentId = null, editId = null) => {
  const container = document.getElementById('forms-admin-modal-container');
  if (!container) return;

  const categories = window.formsAdminState.mainCategories || [];
  const subcategories = window.formsAdminState.subcategories || [];
  const allArticles = window.formsAdminState.articles || [];

  let existing = null;
  if (editId) {
    try {
      const res = await apiFetch(`/api/admin/content/articles/${editId}`);
      const data = await res.json();
      if (res.ok && data.success) {
        existing = data.article;
      }
    } catch {}
  }

  const selectedMainId = existing ? existing.mainCategoryId : (preselectedMainId || categories[0]?.id || '');
  const selectedSubId = existing ? existing.subCategoryId : (preselectedSubId || subcategories.find(s => String(s.main_category_id) === String(selectedMainId))?.id || '');
  const selectedParentId = existing ? (existing.parentId || null) : (preselectedParentId || null);

  const parentArticle = selectedParentId ? allArticles.find(a => String(a.id) === String(selectedParentId)) : null;

  container.innerHTML = `
    <div class="admin-modal-backdrop" onclick="window.closeFormsAdminModal(event)" style="position:fixed; inset:0; background:rgba(15,23,42,0.6); z-index:99999; display:flex; align-items:center; justify-content:center; padding:16px;">
      <div class="admin-modal-box" onclick="event.stopPropagation()" style="background:#fff; border-radius:14px; width:100%; max-width:820px; padding:24px; box-shadow:0 20px 40px rgba(0,0,0,0.2); max-height:92vh; overflow-y:auto;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
          <div>
            <h3 style="font-family:'Playfair Display',serif; font-size:1.35rem; color:#0B1F33; margin:0 0 2px;">
              ${existing ? `Edit: ${escapeHtml(existing.title)}` : (selectedParentId ? '+ Add Sub-sub-title (Nested Content)' : '+ Add New Content Article')}
            </h3>
            <span style="font-size:12px; color:#64748B;">
              Publish or schedule rich-text reading content with full permissions and novel-style comments.
            </span>
          </div>
          <button type="button" onclick="window.closeFormsAdminModal()" style="border:none; background:none; font-size:20px; cursor:pointer;">✕</button>
        </div>

        ${parentArticle ? `
          <div style="background:#FAF5FF; border:1px solid #DDD6FE; border-radius:8px; padding:10px 14px; margin-bottom:14px; font-size:12.5px; color:#5B21B6; display:flex; align-items:center; gap:8px;">
            <span>✨</span>
            <div>Nesting under parent content: <strong>${escapeHtml(parentArticle.title)}</strong> (Part / Sub-sub-title)</div>
          </div>
        ` : ''}

        <!-- Parent Hierarchy Selectors (Auto-selected!) -->
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:14px;">
          <div>
            <label style="font-size:12px; font-weight:700; color:#0B1F33; display:block; margin-bottom:4px;">Main Category *</label>
            <select id="art-form-main" class="form-input" style="width:100%; box-sizing:border-box;" onchange="window.updateModalSubOptions(this.value)">
              ${categories.map(c => `
                <option value="${escapeHtml(c.id)}" ${String(c.id) === String(selectedMainId) ? 'selected' : ''}>
                  ${escapeHtml(c.icon || '📂')} ${escapeHtml(c.title)}
                </option>
              `).join('')}
            </select>
          </div>
          <div>
            <label style="font-size:12px; font-weight:700; color:#0B1F33; display:block; margin-bottom:4px;">Sub-title Section *</label>
            <select id="art-form-sub" class="form-input" style="width:100%; box-sizing:border-box;">
              ${subcategories.filter(s => !selectedMainId || String(s.main_category_id) === String(selectedMainId)).map(s => `
                <option value="${escapeHtml(s.id)}" ${String(s.id) === String(selectedSubId) ? 'selected' : ''}>
                  ${escapeHtml(s.icon || '📌')} ${escapeHtml(s.title)}
                </option>
              `).join('')}
            </select>
          </div>
        </div>

        <!-- Title & Slug -->
        <div style="display:grid; grid-template-columns:2fr 1fr; gap:12px; margin-bottom:14px;">
          <div>
            <label style="font-size:12px; font-weight:700; color:#0B1F33; display:block; margin-bottom:4px;">Content Title *</label>
            <input type="text" id="art-form-title" class="form-input" 
                   value="${existing ? escapeQuotes(existing.title) : ''}" 
                   placeholder="" 
                   style="width:100%; box-sizing:border-box; font-weight:600;" 
                   oninput="window.autoFillArticleSlug(this.value)">
          </div>
          <div>
            <label style="font-size:12px; font-weight:700; color:#0B1F33; display:block; margin-bottom:4px;">Slug Identifier</label>
            <input type="text" id="art-form-slug" class="form-input" 
                   value="${existing ? escapeQuotes(existing.uniqueSlug || existing.unique_slug || '') : ''}" 
                   placeholder="" 
                   style="width:100%; box-sizing:border-box; font-family:monospace; font-size:12px;">
          </div>
        </div>

        <div style="margin-bottom:14px;">
          <label style="font-size:12px; font-weight:700; color:#0B1F33; display:block; margin-bottom:4px;">Short Hook / Excerpt (Optional)</label>
          <input type="text" id="art-form-summary" class="form-input" 
                 value="${existing ? escapeQuotes(existing.summary || '') : ''}" 
                 placeholder="" 
                 style="width:100%; box-sizing:border-box;">
        </div>

        <!-- Rich-Text Content Editor with Formatting Toolbar -->
        <div style="margin-bottom:14px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; flex-wrap:wrap; gap:6px;">
            <label style="font-size:12px; font-weight:700; color:#0B1F33;">
              Reading Content (Optional if creating container header)
            </label>
            <div style="display:flex; gap:4px; flex-wrap:wrap;">
              <button type="button" class="btn btn-outline btn-xs" onclick="window.insertEditorFormat('**', '**', 'bold text')" title="Bold"><strong>B</strong></button>
              <button type="button" class="btn btn-outline btn-xs" onclick="window.insertEditorFormat('*', '*', 'italic text')" title="Italic"><em>I</em></button>
              <button type="button" class="btn btn-outline btn-xs" onclick="window.insertEditorFormat('<u>', '</u>', 'underlined text')" title="Underline"><u>U</u></button>
              <button type="button" class="btn btn-outline btn-xs" onclick="window.insertEditorFormat('## ', '', 'Heading')" title="H2">H2</button>
              <button type="button" class="btn btn-outline btn-xs" onclick="window.insertEditorFormat('### ', '', 'Subheading')" title="H3">H3</button>
              <button type="button" class="btn btn-outline btn-xs" onclick="window.insertEditorFormat('> ', '', 'Quote text')" title="Quote">Quote</button>
              <button type="button" class="btn btn-outline btn-xs" onclick="window.insertEditorFormat('- ', '', 'List item')" title="Bullet list">• List</button>
              <button type="button" class="btn btn-outline btn-xs" onclick="window.insertEditorFormat('---', '', '')" title="Divider">Divider</button>
              <button type="button" class="btn btn-outline btn-xs" onclick="window.insertEditorImagePrompt()" title="Insert image URL">🖼️ Image</button>
            </div>
          </div>
          <textarea id="art-form-content" class="form-input" rows="10" 
                    placeholder="" 
                    style="width:100%; box-sizing:border-box; resize:vertical; font-family:Georgia, serif; font-size:14px; line-height:1.7;">${existing ? escapeQuotes(existing.content || '') : ''}</textarea>
        </div>

        <!-- Publishing Status, Visibility & Access Permissions -->
        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; margin-bottom:14px;">
          <div>
            <label style="font-size:12px; font-weight:700; color:#0B1F33; display:block; margin-bottom:4px;">Publication Status</label>
            <select id="art-form-status" class="form-input" style="width:100%; box-sizing:border-box;" onchange="window.toggleScheduledField(this.value)">
              <option value="published" ${(existing?.status === 'published' || !existing) ? 'selected' : ''}>Published (Live)</option>
              <option value="draft" ${existing?.status === 'draft' ? 'selected' : ''}>Draft</option>
              <option value="scheduled" ${existing?.status === 'scheduled' ? 'selected' : ''}>Scheduled</option>
              <option value="disabled" ${existing?.status === 'disabled' ? 'selected' : ''}>Disabled (Hidden)</option>
            </select>
          </div>

          <div>
            <label style="font-size:12px; font-weight:700; color:#0B1F33; display:block; margin-bottom:4px;">Visibility (Readers)</label>
            <select id="art-form-visibility" class="form-input" style="width:100%; box-sizing:border-box;">
              <option value="public" ${(existing?.visibility === 'public' || !existing) ? 'selected' : ''}>Public (All Visitors)</option>
              <option value="members" ${existing?.visibility === 'members' ? 'selected' : ''}>All Logged-in Members</option>
              <option value="selected_members" ${existing?.visibility === 'selected_members' ? 'selected' : ''}>Selected Members</option>
              <option value="admin_only" ${existing?.visibility === 'admin_only' ? 'selected' : ''}>Admin Only</option>
            </select>
          </div>

          <div>
            <label style="font-size:12px; font-weight:700; color:#0B1F33; display:block; margin-bottom:4px;">Access Permission (Writers)</label>
            <select id="art-form-access-perm" class="form-input" style="width:100%; box-sizing:border-box;">
              <option value="admin_only" ${(existing?.accessPermission === 'admin_only' || !existing) ? 'selected' : ''}>Admin Only</option>
              <option value="all_writers" ${existing?.accessPermission === 'all_writers' ? 'selected' : ''}>All Authorized Writers</option>
              <option value="selected_writers" ${existing?.accessPermission === 'selected_writers' ? 'selected' : ''}>Selected Writers</option>
            </select>
          </div>
        </div>

        <div id="art-scheduled-row" style="margin-bottom:14px; display:${existing?.status === 'scheduled' ? 'block' : 'none'};">
          <label style="font-size:12px; font-weight:700; color:#0B1F33; display:block; margin-bottom:4px;">Scheduled Release Date &amp; Time</label>
          <input type="datetime-local" id="art-form-scheduled-at" class="form-input" 
                 value="${existing?.scheduledAt ? new Date(existing.scheduledAt).toISOString().slice(0, 16) : ''}" 
                 style="width:100%; box-sizing:border-box;">
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:18px;">
          <div>
            <label style="font-size:12px; font-weight:700; color:#0B1F33; display:block; margin-bottom:4px;">Author Attribution</label>
            <input type="text" id="art-form-author" class="form-input" 
                   value="${existing ? escapeQuotes(existing.authorName || 'Rudhra Prarthana') : 'Rudhra Prarthana'}" 
                   style="width:100%; box-sizing:border-box;">
          </div>
          <div>
            <label style="font-size:12px; font-weight:700; color:#0B1F33; display:block; margin-bottom:4px;">Sort Order</label>
            <input type="number" id="art-form-order" class="form-input" 
                   value="${existing ? (existing.sortOrder || 0) : 0}" 
                   style="width:100%; box-sizing:border-box;">
          </div>
        </div>

        <!-- Hidden Parent ID Reference -->
        <input type="hidden" id="art-form-parent-id" value="${selectedParentId || ''}">

        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
          <button type="button" class="btn btn-outline btn-sm" onclick="window.previewArticleContent()">
            👁️ Preview
          </button>
          <div style="display:flex; gap:10px;">
            <button type="button" class="btn btn-outline btn-sm" onclick="window.closeFormsAdminModal()">Cancel</button>
            <button type="button" class="btn btn-outline btn-sm" onclick="window.submitArticleForm('${existing ? existing.id : ''}', 'draft')">
              Save Draft
            </button>
            <button type="button" class="btn btn-gold btn-sm" onclick="window.submitArticleForm('${existing ? existing.id : ''}', 'publish')">
              ${existing ? 'Update &amp; Save' : 'Publish Content'}
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
};

window.updateModalSubOptions = (mainId) => {
  const subSelect = document.getElementById('art-form-sub');
  if (!subSelect) return;
  const subs = window.formsAdminState.subcategories || [];
  const filtered = subs.filter(s => String(s.main_category_id) === String(mainId));
  subSelect.innerHTML = filtered.map(s => `
    <option value="${escapeHtml(s.id)}">${escapeHtml(s.icon || '📌')} ${escapeHtml(s.title)}</option>
  `).join('') || '<option value="">No sub-titles available</option>';
};

window.autoFillArticleSlug = (title) => {
  const slugInput = document.getElementById('art-form-slug');
  if (slugInput && !slugInput.dataset.manual) {
    slugInput.value = (title || '')
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
};

window.toggleScheduledField = (status) => {
  const row = document.getElementById('art-scheduled-row');
  if (row) {
    row.style.display = status === 'scheduled' ? 'block' : 'none';
  }
};

window.insertEditorFormat = (prefix, suffix, placeholder) => {
  const textarea = document.getElementById('art-form-content');
  if (!textarea) return;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;
  const selected = text.slice(start, end) || placeholder;
  const replacement = prefix + selected + suffix;
  textarea.value = text.slice(0, start) + replacement + text.slice(end);
  textarea.focus();
  textarea.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
};

window.insertEditorImagePrompt = () => {
  const url = prompt('Enter image URL to insert into article content:');
  if (url && /^https?:\/\//i.test(url)) {
    window.insertEditorFormat(`\n<img src="${url}" alt="Article image" style="max-width:100%; border-radius:8px; margin:16px 0;" />\n`, '', '');
  }
};

/**
 * Preview Formatted Article Content Modal
 */
window.previewArticleContent = () => {
  const title = document.getElementById('art-form-title')?.value || 'Preview Title';
  const author = document.getElementById('art-form-author')?.value || 'Rudhra Prarthana';
  const rawContent = document.getElementById('art-form-content')?.value || 'No content written yet.';

  let formatted = escapeHtml(rawContent)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^### (.*$)/gim, '<h3 style="color:#1A0B2E; margin:18px 0 8px;">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 style="color:#1A0B2E; margin:24px 0 10px;">$1</h2>')
    .replace(/^> (.*$)/gim, '<blockquote style="border-left:4px solid #C89B3C; padding-left:14px; color:#475569; margin:14px 0;">$1</blockquote>')
    .replace(/---/g, '<hr style="border:none; border-top:1px solid #E2E8F0; margin:20px 0;" />')
    .replace(/\n/g, '<br>');

  const previewModal = document.createElement('div');
  previewModal.className = 'admin-modal-backdrop';
  previewModal.style.cssText = 'position:fixed; inset:0; background:rgba(15,23,42,0.7); z-index:100000; display:flex; align-items:center; justify-content:center; padding:16px;';
  previewModal.onclick = () => previewModal.remove();

  previewModal.innerHTML = `
    <div class="admin-modal-box" onclick="event.stopPropagation()" style="background:#fff; border-radius:14px; width:100%; max-width:760px; padding:28px; max-height:90vh; overflow-y:auto; box-shadow:0 25px 50px rgba(0,0,0,0.25);">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; border-bottom:1px solid #E2E8F0; padding-bottom:12px;">
        <span style="font-size:12px; font-weight:700; color:#B88635; letter-spacing:1px;">FORMATTED PREVIEW</span>
        <button type="button" onclick="this.closest('.admin-modal-backdrop').remove()" style="border:none; background:none; font-size:20px; cursor:pointer;">✕</button>
      </div>

      <h1 style="font-family:'Playfair Display',serif; font-size:1.75rem; color:#1A0B2E; margin:0 0 10px;">${escapeHtml(title)}</h1>
      <div style="font-size:12.5px; color:#64748B; margin-bottom:20px; display:flex; gap:10px;">
        <span>✍️ By ${escapeHtml(author)}</span>
        <span>•</span>
        <span>Rudhra Prarthana Novels</span>
      </div>

      <div style="font-family:Georgia,serif; font-size:15px; line-height:1.8; color:#1E293B; margin-bottom:28px;">
        ${formatted}
      </div>

      <div style="text-align:right;">
        <button type="button" class="btn btn-outline btn-sm" onclick="this.closest('.admin-modal-backdrop').remove()">Close Preview</button>
      </div>
    </div>
  `;

  document.body.appendChild(previewModal);
};

window.submitArticleForm = async (editId = null, forceMode = null) => {
  const mainCategoryId = document.getElementById('art-form-main')?.value;
  const subCategoryId = document.getElementById('art-form-sub')?.value;
  const parentId = document.getElementById('art-form-parent-id')?.value || null;
  const title = document.getElementById('art-form-title')?.value?.trim();
  const uniqueSlug = document.getElementById('art-form-slug')?.value?.trim();
  const summary = document.getElementById('art-form-summary')?.value?.trim();
  const content = document.getElementById('art-form-content')?.value || '';
  const statusField = document.getElementById('art-form-status')?.value || 'published';
  const status = forceMode === 'draft' ? 'draft' : statusField;
  const visibility = document.getElementById('art-form-visibility')?.value || 'public';
  const accessPermission = document.getElementById('art-form-access-perm')?.value || 'admin_only';
  const scheduledAt = document.getElementById('art-form-scheduled-at')?.value || null;
  const authorName = document.getElementById('art-form-author')?.value?.trim() || 'Rudhra Prarthana';
  const sortOrder = parseInt(document.getElementById('art-form-order')?.value || '0', 10);

  if (!title) {
    showToast('Please enter a content title.');
    return;
  }
  if (!mainCategoryId || !subCategoryId) {
    showToast('Please select parent main category and sub-title.');
    return;
  }

  try {
    const url = editId ? `/api/admin/content/articles/${editId}` : '/api/admin/content/articles';
    const method = editId ? 'PUT' : 'POST';
    const res = await apiFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: editId,
        mainCategoryId,
        subCategoryId,
        parentId: parentId ? Number(parentId) : null,
        title,
        uniqueSlug,
        summary,
        content,
        status,
        visibility,
        accessPermission,
        scheduledAt,
        authorName,
        sortOrder
      })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      showToast(data.error || 'Failed to save content article.');
      return;
    }
    showToast(`Content "${title}" ${editId ? 'updated' : (status === 'draft' ? 'saved as draft' : 'published')} successfully! ✓`);
    window.closeFormsAdminModal();
    await window.loadFormsAdminData();
  } catch (err) {
    showToast(err.message || 'Error saving content article.');
  }
};

window.toggleMainCategoryStatus = async (id, currentDis) => {
  const newDis = !currentDis;
  try {
    const res = await apiFetch(`/api/admin/content/main-categories/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isDisabled: newDis })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast(`Main title status updated to ${newDis ? 'Disabled' : 'Published'}! ✓`);
      await window.loadFormsAdminData();
    } else {
      showToast(data.error || 'Failed to update status.');
    }
  } catch (err) {
    showToast(err.message || 'Error updating status.');
  }
};

window.toggleSubCategoryStatus = async (id, currentDis) => {
  const newDis = !currentDis;
  try {
    const res = await apiFetch(`/api/admin/content/subcategories/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isDisabled: newDis })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast(`Sub-title status updated to ${newDis ? 'Disabled' : 'Active'}! ✓`);
      await window.loadFormsAdminData();
    } else {
      showToast(data.error || 'Failed to update status.');
    }
  } catch (err) {
    showToast(err.message || 'Error updating status.');
  }
};

window.toggleContentArticleStatus = async (id, currentDis) => {
  const newDis = !currentDis;
  try {
    const res = await apiFetch(`/api/admin/content/articles/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isDisabled: newDis })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast(`Content status updated to ${newDis ? 'Disabled' : 'Published'}! ✓`);
      await window.loadFormsAdminData();
    } else {
      showToast(data.error || 'Failed to update status.');
    }
  } catch (err) {
    showToast(err.message || 'Error updating status.');
  }
};

window.deleteMainCategory = async (id) => {
  const cat = (window.formsAdminState.mainCategories || []).find(m => String(m.id) === String(id));
  const title = cat ? cat.title : id;
  if (!confirm(`Are you sure you want to delete the main category "${title}"?\nAll nested sub-titles and content under it will be removed.`)) {
    return;
  }
  try {
    const res = await apiFetch(`/api/admin/content/main-categories/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmTitle: title })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast(`Category "${title}" deleted successfully. ✓`);
      await window.loadFormsAdminData();
    } else {
      showToast(data.error || 'Failed to delete category.');
    }
  } catch (err) {
    showToast(err.message || 'Error deleting category.');
  }
};

window.deleteSubCategory = async (id) => {
  const sub = (window.formsAdminState.subcategories || []).find(s => String(s.id) === String(id));
  const title = sub ? sub.title : id;
  if (!confirm(`Are you sure you want to delete the sub-title "${title}"?\nAll content under this section will be removed.`)) {
    return;
  }
  try {
    const res = await apiFetch(`/api/admin/content/subcategories/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmTitle: title })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast(`Subcategory "${title}" deleted successfully. ✓`);
      await window.loadFormsAdminData();
    } else {
      showToast(data.error || 'Failed to delete subcategory.');
    }
  } catch (err) {
    showToast(err.message || 'Error deleting subcategory.');
  }
};

window.deleteContentArticle = async (id) => {
  const art = (window.formsAdminState.articles || []).find(a => Number(a.id) === Number(id));
  const title = art ? art.title : `#${id}`;
  if (!confirm(`Are you sure you want to delete "${title}"?\nIf it contains nested parts / sub-sub-titles, they will also be deleted.`)) {
    return;
  }
  try {
    const res = await apiFetch(`/api/admin/content/articles/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmTitle: 'yes' })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast(`Content "${title}" deleted successfully. ✓`);
      await window.loadFormsAdminData();
    } else {
      showToast(data.error || 'Failed to delete content.');
    }
  } catch (err) {
    showToast(err.message || 'Error deleting content.');
  }
};

/**
 * Access Restriction Rules Modal & Handlers
 */
window.openAccessRuleModal = (targetType, targetId, targetTitle) => {
  const container = document.getElementById('forms-admin-modal-container');
  if (!container) return;

  const members = window.formsAdminState.members || [];

  container.innerHTML = `
    <div class="admin-modal-backdrop" onclick="window.closeFormsAdminModal(event)" style="position:fixed; inset:0; background:rgba(15,23,42,0.6); z-index:99999; display:flex; align-items:center; justify-content:center; padding:16px;">
      <div class="admin-modal-box" onclick="event.stopPropagation()" style="background:#fff; border-radius:14px; width:100%; max-width:540px; padding:24px; box-shadow:0 20px 40px rgba(0,0,0,0.2);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
          <h3 style="font-family:'Playfair Display',serif; font-size:1.35rem; color:#0B1F33; margin:0;">
            🛡️ Access Control: ${escapeHtml(targetTitle)}
          </h3>
          <button type="button" onclick="window.closeFormsAdminModal()" style="border:none; background:none; font-size:20px; cursor:pointer;">✕</button>
        </div>

        <p style="font-size:12.5px; color:#64748B; margin-bottom:16px;">
          Apply individual member access restrictions or block specific readers from viewing this content.
        </p>

        <div style="margin-bottom:14px;">
          <label style="font-size:12px; font-weight:700; color:#0B1F33; display:block; margin-bottom:4px;">Restricted Member</label>
          <select id="acc-user-id" class="form-input" style="width:100%; box-sizing:border-box;">
            ${members.map(m => `
              <option value="${m.id}">${escapeHtml(m.username)} (${escapeHtml(m.email || 'ID: ' + m.id)})</option>
            `).join('')}
          </select>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:14px;">
          <div>
            <label style="font-size:12px; font-weight:700; color:#0B1F33; display:block; margin-bottom:4px;">Restriction Type</label>
            <select id="acc-rule-type" class="form-input" style="width:100%; box-sizing:border-box;">
              <option value="block">Block Access (Deny Reading)</option>
              <option value="allow">Explicit Allow</option>
            </select>
          </div>
          <div>
            <label style="font-size:12px; font-weight:700; color:#0B1F33; display:block; margin-bottom:4px;">Duration</label>
            <select id="acc-duration" class="form-input" style="width:100%; box-sizing:border-box;">
              <option value="24h">24 Hours</option>
              <option value="3d">3 Days</option>
              <option value="7d" selected>7 Days (1 Week)</option>
              <option value="30d">30 Days</option>
              <option value="indefinite">Indefinite</option>
            </select>
          </div>
        </div>

        <div style="margin-bottom:18px;">
          <label style="font-size:12px; font-weight:700; color:#0B1F33; display:block; margin-bottom:4px;">Reason for Restriction</label>
          <input type="text" id="acc-reason" class="form-input" value="Violation of reading community guidelines" style="width:100%; box-sizing:border-box;">
        </div>

        <div style="display:flex; justify-content:flex-end; gap:10px;">
          <button type="button" class="btn btn-outline btn-sm" onclick="window.closeFormsAdminModal()">Cancel</button>
          <button type="button" class="btn btn-gold btn-sm" onclick="window.submitAccessRule('${escapeQuotes(targetType)}', '${escapeQuotes(targetId)}')">
            Apply Restriction
          </button>
        </div>
      </div>
    </div>
  `;
};

window.submitAccessRule = async (targetType, targetId) => {
  const userId = document.getElementById('acc-user-id')?.value;
  const ruleType = document.getElementById('acc-rule-type')?.value || 'block';
  const duration = document.getElementById('acc-duration')?.value || '7d';
  const reason = document.getElementById('acc-reason')?.value?.trim() || null;

  try {
    const res = await apiFetch('/api/admin/content/access-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_type: targetType, target_id: targetId, user_id: userId, rule_type: ruleType, duration, reason })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      showToast(data.error || 'Failed to apply access rule.');
      return;
    }
    showToast('Access restriction applied successfully! 🛡️');
    window.closeFormsAdminModal();
    await window.loadFormsAdminData();
  } catch (err) {
    showToast(err.message || 'Error applying restriction.');
  }
};

window.closeFormsAdminModal = (event) => {
  if (event && event.target && !event.target.classList.contains('admin-modal-backdrop') && !event.target.classList.contains('btn-close')) {
    return;
  }
  const container = document.getElementById('forms-admin-modal-container');
  if (container) container.innerHTML = '';
};

// ============================================================================
// SHORT STORIES MANAGEMENT TAB (Admin Dashboard)
// ============================================================================

/**
 * Render Short Stories Management Tab
 */
async function renderShortStoriesTab(canvas) {
  // Reload latest short stories from backend
  try {
    const res = await apiFetch('/api/admin/short-stories');
    if (res.ok) {
      const data = await res.json();
      adminState.shortStories = data.stories || [];
      const badge = document.getElementById('nav-short-stories-count');
      if (badge) badge.textContent = adminState.shortStories.length;
    }
  } catch (err) {
    console.warn('Failed to refresh short stories:', err);
  }

  const stories = adminState.shortStories || [];

  canvas.innerHTML = `
    <div class="admin-page-header">
      <div class="admin-page-title-group">
        <h1 class="admin-page-title">Short Stories</h1>
        <p class="admin-page-subtitle">Create, publish, schedule, disable, and manage standalone short stories.</p>
      </div>
      <div class="admin-page-actions">
        <button type="button" class="btn btn-gold btn-sm" onclick="openShortStoryEditorModal()">
          <span>+ Add Short Story</span>
        </button>
      </div>
    </div>

    <!-- Filters Bar -->
    <div class="admin-filters-bar">
      <div class="admin-search-wrap">
        <span class="admin-search-icon" aria-hidden="true">🔍</span>
        <input type="text" id="story-search-input" class="admin-search-input" 
               placeholder="Search by title, Tamil title, genre, author..." 
               oninput="filterShortStoriesTable(this.value)">
      </div>
      <select id="story-status-filter" class="admin-filter-select" onchange="filterShortStoriesByStatus(this.value)">
        <option value="all">All Statuses</option>
        <option value="published">Published</option>
        <option value="scheduled">Scheduled</option>
        <option value="draft">Draft</option>
        <option value="disabled">Disabled</option>
      </select>
    </div>

    <!-- Stories List Table Card -->
    <div class="admin-card" style="padding:0; overflow:hidden;">
      <div class="admin-table-wrap">
        <table class="admin-table" id="short-stories-table">
          <thead>
            <tr>
              <th style="width:50px;">Cover</th>
              <th>Story Title &amp; Details</th>
              <th>Author</th>
              <th>Status</th>
              <th>Engagement</th>
              <th>Date / Schedule</th>
              <th style="text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody id="short-stories-tbody">
            ${renderShortStoriesTableRows(stories)}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal Mount Container -->
    <div id="short-story-modal-mount"></div>
  `;
}

/**
 * Render table rows for short stories
 */
function renderShortStoriesTableRows(stories) {
  if (!stories || stories.length === 0) {
    return `
      <tr>
        <td colspan="7" style="text-align:center; padding:48px 16px; color:#64748B;">
          <div style="font-size:32px; margin-bottom:8px;">📖</div>
          <div style="font-size:15px; font-weight:600; color:#1A0B2E; margin-bottom:4px;">No Short Stories Found</div>
          <p style="font-size:13px; margin:0 0 16px;">Create your first standalone short story to share with readers.</p>
          <button type="button" class="btn btn-gold btn-sm" onclick="openShortStoryEditorModal()">+ Add Short Story</button>
        </td>
      </tr>
    `;
  }

  return stories.map(s => {
    const isDis = Number(s.is_disabled) === 1 || s.status === 'disabled';
    let statusPill = '';
    if (isDis) {
      statusPill = '<span class="admin-badge badge-warning" style="background:#FEE2E2; color:#991B1B;">⏸️ Disabled</span>';
    } else if (s.status === 'published') {
      statusPill = '<span class="admin-badge badge-success" style="background:#DCFCE7; color:#166534;">✓ Published</span>';
    } else if (s.status === 'scheduled') {
      const schedTime = s.scheduled_at ? new Date(s.scheduled_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
      statusPill = `<span class="admin-badge badge-info" style="background:#E0E7FF; color:#3730A3;">🕒 Scheduled (${schedTime})</span>`;
    } else {
      statusPill = '<span class="admin-badge" style="background:#FEF3C7; color:#92400E;">📝 Draft</span>';
    }

    const coverImg = s.cover_image || '/default-cover.jpg';
    const readDate = s.published_at || s.created_at;

    return `
      <tr id="story-row-${s.id}" data-id="${s.id}" data-status="${s.status}" data-disabled="${s.is_disabled ? '1' : '0'}">
        <td>
          <img src="${coverImg}" alt="" style="width:42px; height:54px; object-fit:cover; border-radius:4px; border:1px solid #E2E8F0;" onerror="this.src='/default-cover.jpg';">
        </td>
        <td>
          <div style="font-weight:600; color:#1A0B2E; font-size:14px; margin-bottom:2px;">
            ${escapeHtml(s.title)}
          </div>
          ${s.title_ta ? `<div style="font-size:12px; color:#B88635; margin-bottom:3px;">${escapeHtml(s.title_ta)}</div>` : ''}
          <div style="display:flex; gap:8px; align-items:center; font-size:11.5px; color:#64748B;">
            <span class="forum-stat-pill" style="font-size:10.5px; padding:1px 6px;">${escapeHtml(s.genre || 'Short Story')}</span>
            <span>•</span>
            <span>${Number(s.word_count || 0).toLocaleString()} words</span>
            <span>•</span>
            <span>${escapeHtml(s.read_time || '10 mins')}</span>
          </div>
        </td>
        <td style="font-size:13px; color:#475569;">
          ✍️ ${escapeHtml(s.author || 'Rudhra Prarthana')}
        </td>
        <td>${statusPill}</td>
        <td>
          <div style="font-size:12px; color:#475569; display:flex; flex-direction:column; gap:2px;">
            <span>👁️ ${Number(s.views_count || 0).toLocaleString()} reads</span>
            <span>💬 ${Number(s.comments_count || 0).toLocaleString()} comments</span>
          </div>
        </td>
        <td style="font-size:12px; color:#64748B;">
          ${readDate ? new Date(readDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
        </td>
        <td style="text-align:right;">
          <div style="display:inline-flex; gap:6px;">
            <button type="button" class="btn btn-outline btn-xs" onclick="openPreviewShortStoryModal(${s.id})" title="Preview Reader View">
              👁️ Preview
            </button>
            <button type="button" class="btn btn-outline btn-xs" onclick="openShortStoryEditorModal(${s.id})" title="Edit Story">
              ✏️ Edit
            </button>
            <button type="button" class="btn btn-outline btn-xs" onclick="toggleShortStoryDisabledAction(${s.id}, ${isDis ? 1 : 0})" title="${isDis ? 'Restore Story' : 'Temporarily Disable'}">
              ${isDis ? '▶️ Restore' : '⏸️ Disable'}
            </button>
            <button type="button" class="btn btn-outline btn-xs" style="color:#DC2626; border-color:#FECACA;" onclick="deleteShortStoryAction(${s.id}, '${escapeQuotes(s.title)}')" title="Delete Story">
              🗑️
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * Filter stories table by search query
 */
window.filterShortStoriesTable = (query) => {
  const q = (query || '').toLowerCase().trim();
  const statusFilter = document.getElementById('story-status-filter')?.value || 'all';

  const filtered = (adminState.shortStories || []).filter(s => {
    const matchesSearch = !q || 
      (s.title || '').toLowerCase().includes(q) ||
      (s.title_ta || '').toLowerCase().includes(q) ||
      (s.author || '').toLowerCase().includes(q) ||
      (s.genre || '').toLowerCase().includes(q) ||
      (s.description || '').toLowerCase().includes(q);

    let matchesStatus = true;
    if (statusFilter === 'disabled') {
      matchesStatus = Number(s.is_disabled) === 1 || s.status === 'disabled';
    } else if (statusFilter !== 'all') {
      matchesStatus = s.status === statusFilter && Number(s.is_disabled) !== 1;
    }

    return matchesSearch && matchesStatus;
  });

  const tbody = document.getElementById('short-stories-tbody');
  if (tbody) {
    tbody.innerHTML = renderShortStoriesTableRows(filtered);
  }
};

/**
 * Filter stories table by status select
 */
window.filterShortStoriesByStatus = (status) => {
  const query = document.getElementById('story-search-input')?.value || '';
  window.filterShortStoriesTable(query);
};

/**
 * Open Short Story Editor Modal (Create or Edit)
 */
window.openShortStoryEditorModal = (storyId = null) => {
  const story = storyId ? (adminState.shortStories || []).find(s => Number(s.id) === Number(storyId)) : null;
  const isEdit = Boolean(story);

  const mount = document.getElementById('short-story-modal-mount') || document.body;

  const currentStatus = story?.status || 'published';
  const isScheduled = currentStatus === 'scheduled';
  const scheduledVal = story?.scheduled_at ? new Date(story.scheduled_at).toISOString().slice(0, 16) : '';

  mount.innerHTML = `
    <div class="modal-overlay open" id="short-story-modal" onclick="if(event.target === this) closeShortStoryModal();">
      <div class="modal-card admin-modal-card" style="max-width:880px; width:95%; max-height:92vh; display:flex; flex-direction:column; overflow:hidden;">
        <div class="modal-header" style="padding:16px 20px; border-bottom:1px solid #E2E8F0; display:flex; justify-content:space-between; align-items:center;">
          <h3 class="modal-title" style="margin:0; font-size:1.15rem; color:#1A0B2E;">
            ${isEdit ? `✏️ Edit Short Story: ${escapeHtml(story.title)}` : '✨ Create New Short Story'}
          </h3>
          <button type="button" class="modal-close-btn" onclick="closeShortStoryModal()">✕</button>
        </div>

        <div class="modal-body" style="padding:20px; overflow-y:auto; flex:1;">
          <form id="short-story-form" onsubmit="event.preventDefault(); submitShortStoryForm(${story ? story.id : 'null'});">
            <div id="story-form-error" class="novel-form-banner-error" style="display:none; margin-bottom:14px; background:#FEE2E2; color:#991B1B; padding:10px 14px; border-radius:8px; font-size:13px;"></div>

            <!-- Basic Info Grid -->
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap:14px; margin-bottom:16px;">
              <div class="form-group">
                <label class="form-label" style="font-weight:700;">Story Title (English) <span style="color:#EF4444;">*</span></label>
                <input type="text" id="story-field-title" class="form-input" value="${escapeHtml(story?.title || '')}" placeholder="e.g. Poongaatru Punnagaikka" required>
              </div>

              <div class="form-group">
                <label class="form-label">Tamil Title (Optional)</label>
                <input type="text" id="story-field-title-ta" class="form-input" value="${escapeHtml(story?.title_ta || '')}" placeholder="e.g. பூங்காற்று புன்னகைக்க">
              </div>

              <div class="form-group">
                <label class="form-label">URL Slug (Identifier)</label>
                <input type="text" id="story-field-slug" class="form-input" value="${escapeHtml(story?.slug || '')}" placeholder="e.g. poongaatru-punnagaikka (auto if empty)">
              </div>

              <div class="form-group">
                <label class="form-label">Author Name</label>
                <input type="text" id="story-field-author" class="form-input" value="${escapeHtml(story?.author || 'Rudhra Prarthana')}" placeholder="Rudhra Prarthana">
              </div>

              <div class="form-group">
                <label class="form-label">Genre</label>
                <input type="text" id="story-field-genre" class="form-input" value="${escapeHtml(story?.genre || 'Romance / Drama')}" placeholder="e.g. Romance / Feel Good">
              </div>

              <div class="form-group">
                <label class="form-label">Publication Status</label>
                <select id="story-field-status" class="form-input" onchange="toggleShortStoryScheduleField(this.value)">
                  <option value="published" ${currentStatus === 'published' ? 'selected' : ''}>Published (Live &amp; Public)</option>
                  <option value="scheduled" ${currentStatus === 'scheduled' ? 'selected' : ''}>Scheduled</option>
                  <option value="draft" ${currentStatus === 'draft' ? 'selected' : ''}>Draft</option>
                </select>
              </div>
            </div>

            <!-- Schedule picker container (toggled when status === 'scheduled') -->
            <div id="story-schedule-box" style="display:${isScheduled ? 'block' : 'none'}; margin-bottom:16px; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px; padding:12px 16px;">
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px;">
                <div class="form-group">
                  <label class="form-label" style="font-weight:600;">Schedule Date &amp; Time</label>
                  <input type="datetime-local" id="story-field-scheduled-at" class="form-input" value="${scheduledVal}">
                </div>
                <div class="form-group">
                  <label class="form-label" style="font-weight:600;">Timezone</label>
                  <input type="text" id="story-field-timezone" class="form-input" value="${escapeHtml(story?.timezone || 'Asia/Kolkata')}" readonly>
                </div>
              </div>
            </div>

            <!-- Cover Image URL -->
            <div class="form-group" style="margin-bottom:16px;">
              <label class="form-label" style="font-weight:700;">Cover Image URL</label>
              <div style="display:flex; gap:12px; align-items:center;">
                <input type="text" id="story-field-cover" class="form-input" style="flex:1;" 
                       value="${escapeHtml(story?.cover_image || '')}" 
                       placeholder="https://... cover image link"
                       oninput="document.getElementById('story-cover-preview').src = this.value || '/default-cover.jpg';">
                <img id="story-cover-preview" src="${story?.cover_image || '/default-cover.jpg'}" alt="" 
                     style="width:48px; height:58px; object-fit:cover; border-radius:6px; border:1px solid #CBD5E1;" 
                     onerror="this.src='/default-cover.jpg';">
              </div>
            </div>

            <!-- Description / Synopsis -->
            <div class="form-group" style="margin-bottom:18px;">
              <label class="form-label">Story Synopsis / Teaser</label>
              <textarea id="story-field-desc" class="form-input" rows="2" placeholder="Brief premise or introductory teaser for readers...">${escapeHtml(story?.description || '')}</textarea>
            </div>

            <!-- Rich-Text Story Content Area -->
            <div class="form-group" style="margin-bottom:18px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                <label class="form-label" style="font-weight:700; margin:0;">Story Content <span style="color:#EF4444;">*</span></label>
                <span id="story-editor-word-count" style="font-size:12px; color:#64748B;">
                  ${Number(story?.word_count || 0).toLocaleString()} words
                </span>
              </div>

              <!-- Rich Text Toolbar -->
              <div class="editor-toolbar" style="background:#F8FAFC; border:1px solid #E2E8F0; border-bottom:none; border-radius:8px 8px 0 0; padding:6px 10px; display:flex; gap:4px; flex-wrap:wrap; align-items:center;">
                <button type="button" class="toolbar-btn" onclick="formatStoryDoc('bold')" title="Bold (Ctrl+B)"><b>B</b></button>
                <button type="button" class="toolbar-btn" onclick="formatStoryDoc('italic')" title="Italic (Ctrl+I)"><i>I</i></button>
                <button type="button" class="toolbar-btn" onclick="formatStoryDoc('underline')" title="Underline (Ctrl+U)"><u>U</u></button>
                <button type="button" class="toolbar-btn" onclick="formatStoryDoc('strikeThrough')" title="Strikethrough"><s>S</s></button>
                <span style="border-left:1px solid #CBD5E1; height:18px; margin:0 4px;"></span>
                <button type="button" class="toolbar-btn" onclick="formatStoryDoc('formatBlock', '<h2>')" title="Heading 2">H2</button>
                <button type="button" class="toolbar-btn" onclick="formatStoryDoc('formatBlock', '<h3>')" title="Heading 3">H3</button>
                <button type="button" class="toolbar-btn" onclick="formatStoryDoc('formatBlock', '<blockquote>')" title="Quote">❝</button>
                <button type="button" class="toolbar-btn" onclick="formatStoryDoc('insertHorizontalRule')" title="Divider">—</button>
                <button type="button" class="toolbar-btn" onclick="formatStoryDoc('removeFormat')" title="Clear Formatting">✕</button>
              </div>

              <!-- Blank Writing Surface (No dummy placeholder) -->
              <div id="story-field-content" contenteditable="true" 
                   style="min-height:280px; max-height:450px; overflow-y:auto; border:1px solid #E2E8F0; border-radius:0 0 8px 8px; padding:16px 20px; font-family:'Lora', 'Georgia', serif; font-size:16px; line-height:1.8; color:#1E293B; background:#FFFFFF; outline:none;"
                   oninput="updateStoryWordCount()">${story?.content || ''}</div>
            </div>
          </form>
        </div>

        <div class="modal-footer" style="padding:14px 20px; border-top:1px solid #E2E8F0; display:flex; justify-content:space-between; align-items:center; background:#F8FAFC;">
          <div>
            <button type="button" class="btn btn-outline btn-sm" onclick="closeShortStoryModal()">Cancel</button>
          </div>
          <div style="display:flex; gap:10px;">
            <button type="button" class="btn btn-outline btn-sm" onclick="saveShortStoryWithStatus('draft', ${story ? story.id : 'null'})">
              Save as Draft
            </button>
            <button type="button" id="story-save-submit-btn" class="btn btn-gold btn-sm" onclick="document.getElementById('short-story-form').requestSubmit();">
              ${isEdit ? 'Save Changes' : 'Publish Story'}
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
};

window.closeShortStoryModal = () => {
  const modal = document.getElementById('short-story-modal');
  if (modal) modal.remove();
};

window.toggleShortStoryScheduleField = (status) => {
  const box = document.getElementById('story-schedule-box');
  const submitBtn = document.getElementById('story-save-submit-btn');
  if (box) {
    box.style.display = status === 'scheduled' ? 'block' : 'none';
  }
  if (submitBtn) {
    if (status === 'scheduled') {
      submitBtn.textContent = 'Schedule Story';
    } else if (status === 'draft') {
      submitBtn.textContent = 'Save Draft';
    } else {
      submitBtn.textContent = 'Publish Story';
    }
  }
};

window.formatStoryDoc = (cmd, val = null) => {
  document.execCommand(cmd, false, val);
  const editor = document.getElementById('story-field-content');
  if (editor) editor.focus();
  window.updateStoryWordCount();
};

window.updateStoryWordCount = () => {
  const editor = document.getElementById('story-field-content');
  const countEl = document.getElementById('story-editor-word-count');
  if (!editor || !countEl) return;
  const text = (editor.innerText || '').trim();
  const words = text ? text.split(/\s+/).length : 0;
  countEl.textContent = `${words.toLocaleString()} words`;
};

window.saveShortStoryWithStatus = (forcedStatus, storyId) => {
  const statusSelect = document.getElementById('story-field-status');
  if (statusSelect) statusSelect.value = forcedStatus;
  window.submitShortStoryForm(storyId);
};

/**
 * Submit Short Story Form (Create or Edit)
 */
window.submitShortStoryForm = async (storyId = null) => {
  const errBanner = document.getElementById('story-form-error');
  const submitBtn = document.getElementById('story-save-submit-btn');
  if (errBanner) errBanner.style.display = 'none';

  const title = (document.getElementById('story-field-title')?.value || '').trim();
  const title_ta = (document.getElementById('story-field-title-ta')?.value || '').trim();
  const slug = (document.getElementById('story-field-slug')?.value || '').trim();
  const author = (document.getElementById('story-field-author')?.value || '').trim();
  const genre = (document.getElementById('story-field-genre')?.value || '').trim();
  const cover_image = (document.getElementById('story-field-cover')?.value || '').trim();
  const description = (document.getElementById('story-field-desc')?.value || '').trim();
  const status = document.getElementById('story-field-status')?.value || 'published';
  const scheduled_at = document.getElementById('story-field-scheduled-at')?.value || null;
  const timezone = document.getElementById('story-field-timezone')?.value || 'Asia/Kolkata';

  const contentEditor = document.getElementById('story-field-content');
  const content = contentEditor ? contentEditor.innerHTML.trim() : '';

  if (!title) {
    if (errBanner) {
      errBanner.textContent = 'Please enter a story title.';
      errBanner.style.display = 'block';
    }
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';
  }

  try {
    const payload = {
      title,
      title_ta,
      slug,
      author: author || 'Rudhra Prarthana',
      genre: genre || 'Short Stories',
      cover_image: cover_image || null,
      description: description || null,
      content,
      status,
      scheduled_at,
      timezone
    };

    const isEdit = Boolean(storyId);
    const url = isEdit ? `/api/admin/short-stories/${storyId}` : '/api/admin/short-stories';
    const method = isEdit ? 'PUT' : 'POST';

    const res = await apiFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      if (errBanner) {
        errBanner.textContent = data.error || 'Failed to save short story.';
        errBanner.style.display = 'block';
      }
      return;
    }

    showToast(isEdit ? '✓ Short story updated successfully!' : '✓ Short story created and published successfully!');
    window.closeShortStoryModal();

    // Reload tab
    const canvas = document.getElementById('admin-main-canvas');
    if (canvas) {
      await renderShortStoriesTab(canvas);
    }
  } catch (err) {
    if (errBanner) {
      errBanner.textContent = err.message || 'Network error while saving.';
      errBanner.style.display = 'block';
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = storyId ? 'Save Changes' : 'Publish Story';
    }
  }
};

/**
 * Preview Short Story in Reader View Modal
 */
window.openPreviewShortStoryModal = (storyId) => {
  const story = (adminState.shortStories || []).find(s => Number(s.id) === Number(storyId));
  if (!story) return;

  const mount = document.getElementById('short-story-modal-mount') || document.body;
  const wordCount = Number(story.word_count || 0);

  mount.innerHTML = `
    <div class="modal-overlay open" id="story-preview-modal" onclick="if(event.target === this) closeShortStoryPreviewModal();">
      <div class="modal-card reader-preview-modal-card" style="max-width:860px; width:95%; max-height:92vh; display:flex; flex-direction:column; overflow:hidden;">
        <!-- Preview Header with Theme Toggles -->
        <div class="preview-header-bar" style="padding:14px 20px; border-bottom:1px solid #E2E8F0; display:flex; justify-content:space-between; align-items:center; background:#FAF7F2;">
          <div style="display:flex; align-items:center; gap:12px;">
            <span style="font-size:16px;">👁️</span>
            <div>
              <strong style="font-size:14px; color:#1A0B2E;">Reader Preview: ${escapeHtml(story.title)}</strong>
              <div style="font-size:11.5px; color:#64748B;">Viewing exact public reader experience</div>
            </div>
          </div>

          <div style="display:flex; gap:10px; align-items:center;">
            <!-- Theme Toggles -->
            <div class="preview-theme-selector" style="display:flex; gap:4px; background:#EDE8DF; padding:3px; border-radius:6px;">
              <button type="button" class="btn-xs" style="border:none; background:#FFF; border-radius:4px; padding:3px 8px; cursor:pointer;" onclick="setPreviewStoryTheme('light')">Light</button>
              <button type="button" class="btn-xs" style="border:none; background:transparent; border-radius:4px; padding:3px 8px; cursor:pointer;" onclick="setPreviewStoryTheme('sepia')">Sepia</button>
              <button type="button" class="btn-xs" style="border:none; background:transparent; border-radius:4px; padding:3px 8px; cursor:pointer;" onclick="setPreviewStoryTheme('dark')">Dark</button>
            </div>
            <button type="button" class="modal-close-btn" onclick="closeShortStoryPreviewModal()">✕</button>
          </div>
        </div>

        <!-- Preview Body Canvas -->
        <div id="story-preview-canvas" style="flex:1; overflow-y:auto; padding:32px 28px; background:#FFFFFF; color:#1E293B;">
          <div style="max-width:720px; margin:0 auto;">
            <div style="display:inline-block; font-size:11.5px; font-weight:700; color:#B88635; background:#FFFDF8; border:1px solid #EAD8B1; border-radius:12px; padding:2px 10px; margin-bottom:12px;">
              📖 ${escapeHtml(story.genre || 'Short Story')}
            </div>

            <h1 style="font-family:'Playfair Display', Georgia, serif; font-size:1.85rem; color:#1A0B2E; margin:0 0 8px;">
              ${escapeHtml(story.title)}
            </h1>

            ${story.title_ta ? `
              <div style="font-size:1.15rem; color:#B88635; margin-bottom:16px; font-weight:600;">
                ${escapeHtml(story.title_ta)}
              </div>
            ` : ''}

            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #F1ECE4; padding-bottom:14px; margin-bottom:24px; font-size:12.5px; color:#64748B; flex-wrap:wrap; gap:8px;">
              <div>✍️ By <strong>${escapeHtml(story.author || 'Rudhra Prarthana')}</strong></div>
              <div style="display:flex; gap:12px;">
                <span>⏳ ${escapeHtml(story.read_time || '10 mins')}</span>
                <span>•</span>
                <span>📝 ${wordCount.toLocaleString()} words</span>
              </div>
            </div>

            ${story.cover_image ? `
              <div style="text-align:center; margin-bottom:28px;">
                <img src="${escapeHtml(story.cover_image)}" alt="" style="max-height:340px; max-width:100%; border-radius:10px; box-shadow:0 8px 20px rgba(0,0,0,0.08); object-fit:cover;">
              </div>
            ` : ''}

            ${story.description ? `
              <div style="background:#FAF7F2; border-left:3px solid #C89B3C; padding:12px 16px; border-radius:0 6px 6px 0; margin-bottom:24px; font-style:italic; color:#475569; font-size:14px; line-height:1.6;">
                ${escapeHtml(story.description)}
              </div>
            ` : ''}

            <div class="preview-reading-text" style="font-family:'Lora', 'Georgia', serif; font-size:1.08rem; line-height:1.85;">
              ${story.content || '<p style="color:#94A3B8; font-style:italic;">No story content has been entered yet.</p>'}
            </div>

            <div style="text-align:center; margin:36px 0 16px; color:#B88635; font-size:24px;">
              ❦
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
};

window.closeShortStoryPreviewModal = () => {
  const modal = document.getElementById('story-preview-modal');
  if (modal) modal.remove();
};

window.setPreviewStoryTheme = (theme) => {
  const canvas = document.getElementById('story-preview-canvas');
  if (!canvas) return;
  if (theme === 'sepia') {
    canvas.style.background = '#FAF4EA';
    canvas.style.color = '#382818';
  } else if (theme === 'dark') {
    canvas.style.background = '#18122B';
    canvas.style.color = '#E2E8F0';
  } else {
    canvas.style.background = '#FFFFFF';
    canvas.style.color = '#1E293B';
  }
};

/**
 * Toggle Short Story Disabled / Restored
 */
window.toggleShortStoryDisabledAction = async (storyId, currentDisabled) => {
  const willDisable = Number(currentDisabled) !== 1;
  const msg = willDisable 
    ? 'Are you sure you want to temporarily disable this short story? It will be hidden from readers.'
    : 'Are you sure you want to restore this short story to public view?';

  if (!confirm(msg)) return;

  try {
    const res = await apiFetch(`/api/admin/short-stories/${storyId}/toggle-disabled`, {
      method: 'POST'
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast(willDisable ? 'Story disabled.' : '✓ Story restored to public view!');
      const canvas = document.getElementById('admin-main-canvas');
      if (canvas) await renderShortStoriesTab(canvas);
    } else {
      showToast(data.error || 'Failed to update story status.');
    }
  } catch (err) {
    showToast(err.message || 'Network error.');
  }
};

/**
 * Delete Short Story Permanently
 */
window.deleteShortStoryAction = async (storyId, title) => {
  if (!confirm(`Are you sure you want to permanently delete "${title}"?\n\nThis action cannot be undone.`)) {
    return;
  }

  try {
    const res = await apiFetch(`/api/admin/short-stories/${storyId}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast('✓ Short story permanently deleted.');
      const canvas = document.getElementById('admin-main-canvas');
      if (canvas) await renderShortStoriesTab(canvas);
    } else {
      showToast(data.error || 'Failed to delete story.');
    }
  } catch (err) {
    showToast(err.message || 'Network error deleting story.');
  }
};


// ============================================================================
// WRITER PERMISSIONS MODAL & REVIEW QUEUE CONTROLLER
// ============================================================================

/**
 * Open Permissions & Content Assignment Modal for a Writer
 */
window.openWriterPermissionsModal = async (writerId) => {
  const mount = document.getElementById('admin-modal-mount') || document.getElementById('short-story-modal-mount') || document.body;

  mount.innerHTML = `
    <div class="modal-overlay open" id="writer-perms-modal" onclick="if(event.target === this) closeWriterPermissionsModal();">
      <div class="modal-card writer-perm-modal-card">
        <div style="text-align:center; padding:60px 20px; color:#64748B;">
          <div style="width:36px; height:36px; border:3px solid #E2E8F0; border-top-color:#C89B3C; border-radius:50%; animation:adminSpinner 0.8s linear infinite; margin:0 auto 12px;"></div>
          <div>Loading Writer Permissions &amp; Assignments...</div>
        </div>
      </div>
    </div>
  `;

  try {
    const [wRes, pRes, aRes, novRes, ssRes, audRes] = await Promise.all([
      apiFetch(`/api/admin/writers/${writerId}`),
      apiFetch(`/api/admin/writers/${writerId}/permissions`),
      apiFetch(`/api/admin/writers/${writerId}/assignments`),
      apiFetch('/api/novels'),
      apiFetch('/api/admin/short-stories'),
      apiFetch('/api/admin/audio-novels')
    ]);

    const wData = await wRes.json();
    const pData = await pRes.json();
    const aData = await aRes.json();
    const novData = await novRes.json();
    const ssData = await ssRes.json();
    const audData = await audRes.json();

    const writer = wData.writer || {};
    const perms = pData.permissions || {
      canNovels: 1,
      canShortStories: 0,
      canAudioNovels: 0,
      canEpisodes: 1,
      accessLevel: 'review_required',
      fullAccess: 0
    };
    const assignments = aData.assignments || [];
    const novelsList = novData.novels || [];
    const storiesList = ssData.stories || [];
    const audioList = audData.audioNovels || [];

    const modal = document.getElementById('writer-perms-modal');
    if (!modal) return;

    modal.innerHTML = `
      <div class="modal-card writer-perm-modal-card" style="max-width:820px; width:95%; max-height:90vh; display:flex; flex-direction:column; overflow:hidden;">
        <!-- Header -->
        <div class="modal-header" style="padding:16px 20px; border-bottom:1px solid #E2E8F0; display:flex; justify-content:space-between; align-items:center; background:#FAF7F2;">
          <div style="display:flex; align-items:center; gap:12px;">
            <img src="${writer.avatar || '/profile.png'}" style="width:40px; height:40px; border-radius:50%; object-fit:cover;" onerror="this.src='/profile.png';" alt="">
            <div>
              <h3 class="modal-title" style="margin:0; font-size:1.15rem; color:#1A0B2E;">
                ⚙️ Permissions &amp; Assignments: ${escapeHtml(writer.displayName || writer.username)}
              </h3>
              <div style="font-size:12px; color:#64748B;">${escapeHtml(writer.email)} • Status: <strong>${writer.status || 'active'}</strong></div>
            </div>
          </div>
          <button type="button" class="modal-close-btn" onclick="closeWriterPermissionsModal()">✕</button>
        </div>

        <!-- Body -->
        <div class="modal-body" style="padding:20px; overflow-y:auto; flex:1;">
          <div id="writer-perms-alert" style="display:none; padding:10px 14px; border-radius:8px; margin-bottom:14px; font-size:13px;"></div>

          <!-- Section 1: Content Type Capabilities -->
          <div class="perm-section-box">
            <h4 class="perm-section-title">
              <span>📚</span>
              <span>Permitted Content Types</span>
            </h4>
            <p style="font-size:12.5px; color:#64748B; margin:0 0 12px 0;">Select which content categories this writer is authorized to access and write:</p>
            <div class="perm-checkbox-grid">
              <label class="perm-checkbox-card">
                <input type="checkbox" id="perm-novels" ${perms.canNovels ? 'checked' : ''}>
                <div>
                  <strong style="font-size:13px; color:#1A0B2E; display:block;">Novels</strong>
                  <span style="font-size:11px; color:#64748B;">Novel titles &amp; books</span>
                </div>
              </label>

              <label class="perm-checkbox-card">
                <input type="checkbox" id="perm-episodes" ${perms.canEpisodes ? 'checked' : ''}>
                <div>
                  <strong style="font-size:13px; color:#1A0B2E; display:block;">Episodes &amp; Sub-episodes</strong>
                  <span style="font-size:11px; color:#64748B;">Chapters &amp; sub-episodes</span>
                </div>
              </label>

              <label class="perm-checkbox-card">
                <input type="checkbox" id="perm-stories" ${perms.canShortStories ? 'checked' : ''}>
                <div>
                  <strong style="font-size:13px; color:#1A0B2E; display:block;">Short Stories</strong>
                  <span style="font-size:11px; color:#64748B;">Standalone short stories</span>
                </div>
              </label>

              <label class="perm-checkbox-card">
                <input type="checkbox" id="perm-audio" ${perms.canAudioNovels ? 'checked' : ''}>
                <div>
                  <strong style="font-size:13px; color:#1A0B2E; display:block;">Audio Novels</strong>
                  <span style="font-size:11px; color:#64748B;">YouTube / direct audio</span>
                </div>
              </label>
            </div>
          </div>

          <!-- Section 2: Publishing & Review Workflow Mode -->
          <div class="perm-section-box">
            <h4 class="perm-section-title">
              <span>⚖️</span>
              <span>Publishing &amp; Review Workflow</span>
            </h4>
            <div class="workflow-radio-list">
              <label class="workflow-radio-card ${perms.accessLevel === 'review_required' ? 'active' : ''}">
                <input type="radio" name="perm-access-level" value="review_required" ${perms.accessLevel === 'review_required' ? 'checked' : ''}>
                <div class="workflow-radio-content">
                  <strong>Workflow A: Admin Review Required (Recommended)</strong>
                  <p>Writer writes drafts and submits for review. Content remains pending until an administrator approves and publishes or requests changes.</p>
                </div>
              </label>

              <label class="workflow-radio-card ${perms.accessLevel === 'independent_publish' ? 'active' : ''}">
                <input type="radio" name="perm-access-level" value="independent_publish" ${perms.accessLevel === 'independent_publish' ? 'checked' : ''}>
                <div class="workflow-radio-content">
                  <strong>Workflow B: Independent Publishing (No Admin Review Required)</strong>
                  <p>Writer can directly publish or schedule content independently without requiring admin approval for each publication.</p>
                </div>
              </label>

              <label class="workflow-radio-card ${perms.accessLevel === 'draft_only' ? 'active' : ''}">
                <input type="radio" name="perm-access-level" value="draft_only" ${perms.accessLevel === 'draft_only' ? 'checked' : ''}>
                <div class="workflow-radio-content">
                  <strong>Drafts Only</strong>
                  <p>Writer can save drafts locally and on server, but cannot submit for review or publish directly.</p>
                </div>
              </label>

              <label class="workflow-radio-card ${perms.accessLevel === 'view_only' ? 'active' : ''}">
                <input type="radio" name="perm-access-level" value="view_only" ${perms.accessLevel === 'view_only' ? 'checked' : ''}>
                <div class="workflow-radio-content">
                  <strong>View Only</strong>
                  <p>Read-only access to assigned content. Editing is completely blocked.</p>
                </div>
              </label>
            </div>
          </div>

          <!-- Section 3: Scope of Access -->
          <div class="perm-section-box">
            <h4 class="perm-section-title">
              <span>🛡️</span>
              <span>Scope &amp; Assignment Mode</span>
            </h4>
            <div style="display:flex; flex-direction:column; gap:8px;">
              <label style="display:flex; align-items:center; gap:8px; font-size:13.5px; cursor:pointer;">
                <input type="radio" name="perm-full-access" value="0" ${!perms.fullAccess ? 'checked' : ''}>
                <span><strong>Restricted Access:</strong> Writer can only access content explicitly assigned by the admin below.</span>
              </label>
              <label style="display:flex; align-items:center; gap:8px; font-size:13.5px; cursor:pointer;">
                <input type="radio" name="perm-full-access" value="1" ${perms.fullAccess ? 'checked' : ''}>
                <span><strong>Full Writing Access:</strong> Writer can create &amp; manage all permitted content of enabled types without individual assignments.</span>
              </label>
            </div>
          </div>

          <!-- Section 4: Specific Content Assignments -->
          <div class="perm-section-box">
            <h4 class="perm-section-title" style="justify-content:space-between;">
              <div style="display:flex; align-items:center; gap:8px;">
                <span>🎯</span>
                <span>Specific Content Assignments (${assignments.length})</span>
              </div>
            </h4>

            <!-- Active Assignments Table -->
            <div id="writer-assignments-list-container" style="margin-bottom:16px;">
              ${renderAssignmentsTable(assignments, writerId)}
            </div>

            <!-- Add Assignment Form -->
            <div style="background:#FAF7F2; border:1px dashed #C89B3C; border-radius:8px; padding:14px;">
              <div style="font-weight:700; font-size:13px; color:#1A0B2E; margin-bottom:10px;">+ Assign Content Item to this Writer</div>
              <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:10px; margin-bottom:10px;">
                <div>
                  <label style="font-size:11.5px; font-weight:600; color:#475569; display:block; margin-bottom:3px;">Content Type</label>
                  <select id="assign-content-type" class="form-input" style="font-size:12.5px; padding:6px 8px;" onchange="updateAssignContentOptions(this.value)">
                    <option value="novel">Novel</option>
                    <option value="short_story">Short Story</option>
                    <option value="audio_novel">Audio Novel</option>
                  </select>
                </div>

                <div>
                  <label style="font-size:11.5px; font-weight:600; color:#475569; display:block; margin-bottom:3px;">Select Item</label>
                  <select id="assign-content-id" class="form-input" style="font-size:12.5px; padding:6px 8px;">
                    ${novelsList.map(n => `<option value="${n.id}">${escapeHtml(n.title)}</option>`).join('')}
                  </select>
                </div>

                <div>
                  <label style="font-size:11.5px; font-weight:600; color:#475569; display:block; margin-bottom:3px;">Deadline (Optional)</label>
                  <input type="date" id="assign-deadline" class="form-input" style="font-size:12.5px; padding:6px 8px;">
                </div>
              </div>

              <div style="margin-bottom:10px;">
                <input type="text" id="assign-instructions" class="form-input" style="font-size:12.5px;" placeholder="Optional notes or instructions for the writer...">
              </div>

              <button type="button" class="btn btn-gold btn-sm" onclick="submitWriterAssignmentAction(${writerId})">
                <span>Assign to Writer</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="modal-footer" style="padding:14px 20px; border-top:1px solid #E2E8F0; display:flex; justify-content:space-between; align-items:center; background:#F8FAFC;">
          <button type="button" class="btn btn-outline btn-sm" onclick="closeWriterPermissionsModal()">Close</button>
          <button type="button" class="btn btn-gold btn-sm" onclick="saveWriterPermissionsAction(${writerId})">
            Save Permissions Changes
          </button>
        </div>
      </div>
    `;

    // Cache items for dynamic dropdown
    window._assignCache = {
      novels: novelsList,
      stories: storiesList,
      audio: audioList
    };
  } catch (err) {
    console.error('Failed to load writer permissions modal:', err);
  }
};

window.closeWriterPermissionsModal = () => {
  const modal = document.getElementById('writer-perms-modal');
  if (modal) modal.remove();
};

window.updateAssignContentOptions = (type) => {
  const select = document.getElementById('assign-content-id');
  if (!select || !window._assignCache) return;
  let items = [];
  if (type === 'novel') {
    items = window._assignCache.novels.map(n => ({ id: n.id, title: n.title }));
  } else if (type === 'short_story') {
    items = window._assignCache.stories.map(s => ({ id: s.id, title: s.title }));
  } else if (type === 'audio_novel') {
    items = window._assignCache.audio.map(a => ({ id: a.id, title: a.title }));
  }
  select.innerHTML = items.map(item => `<option value="${item.id}">${escapeHtml(item.title)}</option>`).join('') || '<option value="">No items available</option>';
};

function renderAssignmentsTable(assignments, writerId) {
  if (!assignments || assignments.length === 0) {
    return '<div style="font-size:12.5px; color:#64748B; font-style:italic; padding:8px 0;">No specific items assigned yet.</div>';
  }
  return `
    <table class="admin-table" style="font-size:12px;">
      <thead>
        <tr>
          <th>Type</th>
          <th>Assigned Title</th>
          <th>Instructions</th>
          <th>Deadline</th>
          <th>Status</th>
          <th style="text-align:right;">Action</th>
        </tr>
      </thead>
      <tbody>
        ${assignments.map(a => `
          <tr>
            <td><span class="assignment-badge ${a.contentType}">${a.contentType.toUpperCase().replace('_', ' ')}</span></td>
            <td><strong>${escapeHtml(a.title)}</strong></td>
            <td style="color:#64748B;">${escapeHtml(a.instructions || '—')}</td>
            <td style="color:#64748B;">${a.deadline ? new Date(a.deadline).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'None'}</td>
            <td><span style="font-size:11px; font-weight:600; color:${a.status === 'active' ? '#166534' : '#64748B'};">${a.status.toUpperCase()}</span></td>
            <td style="text-align:right;">
              ${a.status === 'active' ? `
                <button type="button" class="btn btn-outline btn-xs" style="color:#DC2626; border-color:#FECACA;" onclick="revokeAssignmentAction(${a.id}, ${writerId})" title="Revoke Assignment">
                  Revoke
                </button>
              ` : '<span style="color:#94A3B8;">Revoked</span>'}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

window.saveWriterPermissionsAction = async (writerId) => {
  const canNovels = document.getElementById('perm-novels')?.checked;
  const canEpisodes = document.getElementById('perm-episodes')?.checked;
  const canShortStories = document.getElementById('perm-stories')?.checked;
  const canAudioNovels = document.getElementById('perm-audio')?.checked;
  const accessLevel = document.querySelector('input[name="perm-access-level"]:checked')?.value || 'review_required';
  const fullAccess = document.querySelector('input[name="perm-full-access"]:checked')?.value === '1';

  try {
    const res = await apiFetch(`/api/admin/writers/${writerId}/permissions`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ canNovels, canEpisodes, canShortStories, canAudioNovels, accessLevel, fullAccess })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast('✓ Writer permissions saved successfully!');
      window.closeWriterPermissionsModal();
    } else {
      alert(data.error || 'Failed to update permissions.');
    }
  } catch (err) {
    alert(err.message || 'Error saving permissions.');
  }
};

window.submitWriterAssignmentAction = async (writerId) => {
  const contentType = document.getElementById('assign-content-type')?.value;
  const contentId = document.getElementById('assign-content-id')?.value;
  const deadline = document.getElementById('assign-deadline')?.value || null;
  const instructions = document.getElementById('assign-instructions')?.value?.trim() || null;

  if (!contentId) {
    alert('Please select a content item to assign.');
    return;
  }

  try {
    const res = await apiFetch(`/api/admin/writers/${writerId}/assignments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contentType, contentId, deadline, instructions })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast('✓ Content item assigned to writer!');
      // Refresh modal
      window.openWriterPermissionsModal(writerId);
    } else {
      alert(data.error || 'Failed to assign content.');
    }
  } catch (err) {
    alert(err.message || 'Error assigning content.');
  }
};

window.revokeAssignmentAction = async (assignmentId, writerId) => {
  if (!confirm('Are you sure you want to revoke this assignment? The writer will lose edit access to this item immediately.')) return;

  try {
    const res = await apiFetch(`/api/admin/writers/assignments/${assignmentId}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast('Assignment revoked.');
      window.openWriterPermissionsModal(writerId);
    } else {
      alert(data.error || 'Failed to revoke assignment.');
    }
  } catch (err) {
    alert(err.message || 'Error revoking assignment.');
  }
};

// ============================================================================
// ADMIN WRITER SUBMISSIONS REVIEW QUEUE
// ============================================================================

/**
 * Render Writer Submissions Review Queue
 */
async function renderWriterSubmissionsTab(canvas) {
  canvas.innerHTML = `
    <div style="text-align:center; padding:40px 20px; color:#64748B;">
      <div style="width:36px; height:36px; border:3px solid #E2E8F0; border-top-color:#C89B3C; border-radius:50%; animation:adminSpinner 0.8s linear infinite; margin:0 auto 12px;"></div>
      <div>Loading Writer Submissions Queue...</div>
    </div>
  `;

  try {
    const res = await apiFetch('/api/admin/writers/submissions');
    const data = await res.json();
    const submissions = data.submissions || [];

    const badge = document.getElementById('nav-submissions-count');
    const pendingCount = submissions.filter(s => s.status === 'pending_review').length;
    if (badge) badge.textContent = pendingCount;

    canvas.innerHTML = `
      <div class="admin-page-header">
        <div class="admin-page-title-group">
          <h1 class="admin-page-title">Writer Submissions</h1>
          <p class="admin-page-subtitle">Review, approve, schedule, request changes, or publish writer content.</p>
        </div>
      </div>

      <!-- Filters Bar -->
      <div class="admin-filters-bar">
        <div class="admin-search-wrap">
          <span class="admin-search-icon" aria-hidden="true">🔍</span>
          <input type="text" id="sub-search-input" class="admin-search-input" 
                 placeholder="Search by writer or title..." 
                 oninput="filterSubmissionsTable()">
        </div>
        <select id="sub-status-filter" class="admin-filter-select" onchange="filterSubmissionsTable()">
          <option value="all">All Statuses</option>
          <option value="pending_review" selected>Pending Review</option>
          <option value="changes_requested">Changes Requested</option>
          <option value="approved">Approved &amp; Scheduled</option>
          <option value="published">Published</option>
          <option value="rejected">Rejected</option>
        </select>
        <select id="sub-type-filter" class="admin-filter-select" onchange="filterSubmissionsTable()">
          <option value="all">All Content Types</option>
          <option value="novel">Novels</option>
          <option value="chapter">Chapters / Episodes</option>
          <option value="short_story">Short Stories</option>
          <option value="audio_novel">Audio Novels</option>
        </select>
      </div>

      <!-- Submissions Table Card -->
      <div class="admin-card" style="padding:0; overflow:hidden;">
        <div class="admin-table-wrap">
          <table class="admin-table" id="submissions-table">
            <thead>
              <tr>
                <th>Writer</th>
                <th>Content Item &amp; Details</th>
                <th>Type</th>
                <th>Status</th>
                <th>Submitted Date</th>
                <th>Scheduled Date</th>
                <th style="text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody id="submissions-tbody">
              ${renderSubmissionsTableRows(submissions)}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Mount for review modals -->
      <div id="sub-review-modal-mount"></div>
    `;

    window._adminSubmissionsCache = submissions;
  } catch (err) {
    console.error('Failed to load writer submissions:', err);
    canvas.innerHTML = `<div class="admin-card" style="padding:40px; text-align:center; color:#EF4444;">Failed to load submissions queue.</div>`;
  }
}

function renderSubmissionsTableRows(submissions) {
  if (!submissions || submissions.length === 0) {
    return `
      <tr>
        <td colspan="7" style="text-align:center; padding:48px 16px; color:#64748B;">
          <div style="font-size:32px; margin-bottom:8px;">📬</div>
          <div style="font-size:15px; font-weight:600; color:#1A0B2E; margin-bottom:4px;">No Submissions Found</div>
          <p style="font-size:13px; margin:0;">No writer content submissions match the selected filters.</p>
        </td>
      </tr>
    `;
  }

  return submissions.map(s => {
    let statusPill = '';
    if (s.status === 'pending_review') {
      statusPill = '<span class="sub-status-pill sub-status-pending">⏳ Pending Review</span>';
    } else if (s.status === 'changes_requested') {
      statusPill = '<span class="sub-status-pill sub-status-changes">💬 Changes Requested</span>';
    } else if (s.status === 'approved') {
      statusPill = '<span class="sub-status-pill sub-status-approved">✓ Approved</span>';
    } else if (s.status === 'published') {
      statusPill = '<span class="sub-status-pill sub-status-published">✓ Published</span>';
    } else {
      statusPill = '<span class="sub-status-pill sub-status-rejected">✕ Rejected</span>';
    }

    return `
      <tr id="sub-row-${s.id}" data-id="${s.id}" data-status="${s.status}" data-type="${s.contentType}">
        <td>
          <div style="display:flex; align-items:center; gap:8px;">
            <img src="${s.writerAvatar || '/profile.png'}" style="width:32px; height:32px; border-radius:50%; object-fit:cover;" onerror="this.src='/profile.png';" alt="">
            <div>
              <strong style="color:#1A0B2E; font-size:13px; display:block;">${escapeHtml(s.writerName)}</strong>
              <span style="font-size:11px; color:#64748B;">Writer ID: #${s.writerId}</span>
            </div>
          </div>
        </td>
        <td>
          <div style="font-weight:600; color:#1A0B2E; font-size:13.5px; margin-bottom:2px;">
            ${escapeHtml(s.title)}
          </div>
          ${s.adminNotes ? `<div style="font-size:11.5px; color:#B45309;">Note: ${escapeHtml(s.adminNotes)}</div>` : ''}
        </td>
        <td>
          <span class="assignment-badge ${s.contentType}">${s.contentType.toUpperCase().replace('_', ' ')}</span>
        </td>
        <td>${statusPill}</td>
        <td style="font-size:12px; color:#64748B;">
          ${s.submittedAt ? new Date(s.submittedAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
        </td>
        <td style="font-size:12px; color:#64748B;">
          ${s.scheduledAt ? new Date(s.scheduledAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
        </td>
        <td style="text-align:right;">
          <div style="display:inline-flex; gap:6px; flex-wrap:wrap; justify-content:flex-end;">
            <button type="button" class="btn btn-outline btn-xs" onclick="previewSubmissionAction(${s.id})" title="Preview complete content">
              👁️ Preview
            </button>
            ${s.status === 'pending_review' || s.status === 'changes_requested' ? `
              <button type="button" class="btn btn-gold btn-xs" onclick="approveAndPublishSubmissionAction(${s.id})" title="Approve & Publish Immediately">
                ✓ Publish
              </button>
              <button type="button" class="btn btn-outline btn-xs" onclick="openApproveScheduleModal(${s.id})" title="Approve & Schedule">
                🕒 Schedule
              </button>
              <button type="button" class="btn btn-outline btn-xs" onclick="openRequestChangesModal(${s.id})" title="Request revisions">
                💬 Request Changes
              </button>
              <button type="button" class="btn btn-outline btn-xs" style="color:#DC2626; border-color:#FECACA;" onclick="openRejectSubmissionModal(${s.id})" title="Reject submission">
                ✕ Reject
              </button>
            ` : `
              <button type="button" class="btn btn-outline btn-xs" onclick="approveAndPublishSubmissionAction(${s.id})" title="Publish directly">
                Publish
              </button>
            `}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

window.filterSubmissionsTable = () => {
  const q = (document.getElementById('sub-search-input')?.value || '').toLowerCase().trim();
  const statusFilter = document.getElementById('sub-status-filter')?.value || 'all';
  const typeFilter = document.getElementById('sub-type-filter')?.value || 'all';

  const filtered = (window._adminSubmissionsCache || []).filter(s => {
    const matchesSearch = !q || (s.title || '').toLowerCase().includes(q) || (s.writerName || '').toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    const matchesType = typeFilter === 'all' || s.contentType === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  const tbody = document.getElementById('submissions-tbody');
  if (tbody) tbody.innerHTML = renderSubmissionsTableRows(filtered);
};

window.approveAndPublishSubmissionAction = async (submissionId) => {
  if (!confirm('Approve and publish this submission immediately to the website?')) return;
  try {
    const res = await apiFetch(`/api/admin/writers/submissions/${submissionId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve_publish' })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast('✓ Submission approved and published successfully!');
      const canvas = document.getElementById('admin-main-canvas');
      if (canvas) await renderWriterSubmissionsTab(canvas);
    } else {
      alert(data.error || 'Failed to approve submission.');
    }
  } catch (err) {
    alert(err.message || 'Error executing approval.');
  }
};

window.openApproveScheduleModal = (submissionId) => {
  const mount = document.getElementById('sub-review-modal-mount') || document.body;
  const nowStr = new Date(Date.now() + 3600000).toISOString().slice(0, 16);

  mount.innerHTML = `
    <div class="modal-overlay open" id="schedule-sub-modal" onclick="if(event.target === this) this.remove();">
      <div class="modal-card admin-modal-card" style="max-width:480px;">
        <div class="modal-header">
          <h3 class="modal-title">🕒 Approve &amp; Schedule Publication</h3>
          <button type="button" class="modal-close-btn" onclick="document.getElementById('schedule-sub-modal').remove();">✕</button>
        </div>
        <div class="modal-body" style="padding:20px;">
          <p style="font-size:13px; color:#64748B; margin:0 0 14px 0;">Content will be approved and automatically released at the chosen date and time:</p>
          <div class="form-group" style="margin-bottom:14px;">
            <label class="form-label">Publication Date &amp; Time (Asia/Kolkata)</label>
            <input type="datetime-local" id="sub-schedule-datetime" class="form-input" value="${nowStr}">
          </div>
          <div class="form-group">
            <label class="form-label">Optional Admin Note for Writer</label>
            <input type="text" id="sub-schedule-note" class="form-input" placeholder="e.g. Scheduled for Wednesday evening release">
          </div>
        </div>
        <div class="modal-footer" style="padding:14px 20px; display:flex; justify-content:space-between;">
          <button type="button" class="btn btn-outline btn-sm" onclick="document.getElementById('schedule-sub-modal').remove();">Cancel</button>
          <button type="button" class="btn btn-gold btn-sm" onclick="submitApproveScheduleAction(${submissionId})">Approve &amp; Schedule</button>
        </div>
      </div>
    </div>
  `;
};

window.submitApproveScheduleAction = async (submissionId) => {
  const scheduledAt = document.getElementById('sub-schedule-datetime')?.value;
  const adminNotes = document.getElementById('sub-schedule-note')?.value?.trim() || '';
  if (!scheduledAt) {
    alert('Please choose a publication date and time.');
    return;
  }
  try {
    const res = await apiFetch(`/api/admin/writers/submissions/${submissionId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve_schedule', scheduledAt, adminNotes })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast('✓ Submission approved and scheduled!');
      document.getElementById('schedule-sub-modal')?.remove();
      const canvas = document.getElementById('admin-main-canvas');
      if (canvas) await renderWriterSubmissionsTab(canvas);
    } else {
      alert(data.error || 'Failed to schedule submission.');
    }
  } catch (err) {
    alert(err.message || 'Error scheduling submission.');
  }
};

window.openRequestChangesModal = (submissionId) => {
  const mount = document.getElementById('sub-review-modal-mount') || document.body;
  mount.innerHTML = `
    <div class="modal-overlay open" id="changes-sub-modal" onclick="if(event.target === this) this.remove();">
      <div class="modal-card admin-modal-card" style="max-width:520px;">
        <div class="modal-header">
          <h3 class="modal-title">💬 Request Revisions from Writer</h3>
          <button type="button" class="modal-close-btn" onclick="document.getElementById('changes-sub-modal').remove();">✕</button>
        </div>
        <div class="modal-body" style="padding:20px;">
          <p style="font-size:13px; color:#64748B; margin:0 0 14px 0;">Specify feedback or required changes. The writer will see this guidance and can edit and resubmit:</p>
          <div class="form-group">
            <label class="form-label" style="font-weight:700;">Revision Notes / Feedback <span style="color:#EF4444;">*</span></label>
            <textarea id="sub-feedback-input" class="form-input" rows="4" placeholder="Detail the requested changes, dialogue polishes, or pacing adjustments required..."></textarea>
          </div>
        </div>
        <div class="modal-footer" style="padding:14px 20px; display:flex; justify-content:space-between;">
          <button type="button" class="btn btn-outline btn-sm" onclick="document.getElementById('changes-sub-modal').remove();">Cancel</button>
          <button type="button" class="btn btn-gold btn-sm" onclick="submitRequestChangesAction(${submissionId})">Send Revision Request</button>
        </div>
      </div>
    </div>
  `;
};

window.submitRequestChangesAction = async (submissionId) => {
  const notes = document.getElementById('sub-feedback-input')?.value?.trim();
  if (!notes) {
    alert('Please enter feedback notes for the writer.');
    return;
  }
  try {
    const res = await apiFetch(`/api/admin/writers/submissions/${submissionId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'request_changes', adminNotes: notes })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast('✓ Revision request sent to writer.');
      document.getElementById('changes-sub-modal')?.remove();
      const canvas = document.getElementById('admin-main-canvas');
      if (canvas) await renderWriterSubmissionsTab(canvas);
    } else {
      alert(data.error || 'Failed to request changes.');
    }
  } catch (err) {
    alert(err.message || 'Error requesting changes.');
  }
};

window.openRejectSubmissionModal = (submissionId) => {
  const mount = document.getElementById('sub-review-modal-mount') || document.body;
  mount.innerHTML = `
    <div class="modal-overlay open" id="reject-sub-modal" onclick="if(event.target === this) this.remove();">
      <div class="modal-card admin-modal-card" style="max-width:480px;">
        <div class="modal-header">
          <h3 class="modal-title" style="color:#DC2626;">✕ Reject Submission</h3>
          <button type="button" class="modal-close-btn" onclick="document.getElementById('reject-sub-modal').remove();">✕</button>
        </div>
        <div class="modal-body" style="padding:20px;">
          <p style="font-size:13px; color:#64748B; margin:0 0 14px 0;">Provide a clear reason for rejection. Content will remain as an unpublished draft:</p>
          <div class="form-group">
            <label class="form-label" style="font-weight:700;">Rejection Reason</label>
            <textarea id="sub-reject-reason" class="form-input" rows="3" placeholder="Explain why this submission cannot be accepted..."></textarea>
          </div>
        </div>
        <div class="modal-footer" style="padding:14px 20px; display:flex; justify-content:space-between;">
          <button type="button" class="btn btn-outline btn-sm" onclick="document.getElementById('reject-sub-modal').remove();">Cancel</button>
          <button type="button" class="btn btn-outline btn-sm" style="color:#DC2626; border-color:#FECACA;" onclick="submitRejectAction(${submissionId})">Confirm Rejection</button>
        </div>
      </div>
    </div>
  `;
};

window.submitRejectAction = async (submissionId) => {
  const reason = document.getElementById('sub-reject-reason')?.value?.trim() || 'Submission rejected by administrator.';
  try {
    const res = await apiFetch(`/api/admin/writers/submissions/${submissionId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reject', adminNotes: reason })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast('Submission rejected.');
      document.getElementById('reject-sub-modal')?.remove();
      const canvas = document.getElementById('admin-main-canvas');
      if (canvas) await renderWriterSubmissionsTab(canvas);
    } else {
      alert(data.error || 'Failed to reject submission.');
    }
  } catch (err) {
    alert(err.message || 'Error rejecting submission.');
  }
};

window.previewSubmissionAction = async (submissionId) => {
  const sub = (window._adminSubmissionsCache || []).find(s => Number(s.id) === Number(submissionId));
  if (!sub) return;

  const mount = document.getElementById('sub-review-modal-mount') || document.body;

  let contentHtml = '<p style="color:#64748B; font-style:italic;">Loading preview content...</p>';
  try {
    if (sub.contentType === 'chapter' || sub.contentType === 'episode') {
      const epRes = await apiFetch(`/api/episodes/${sub.contentId}`);
      if (epRes.ok) {
        const epData = await epRes.json();
        contentHtml = epData.episode?.content || 'No content entered.';
      }
    } else if (sub.contentType === 'short_story') {
      const ssRes = await apiFetch(`/api/short-stories/${sub.contentId}`);
      if (ssRes.ok) {
        const ssData = await ssRes.json();
        contentHtml = ssData.story?.content || 'No story content entered.';
      }
    } else if (sub.contentType === 'novel') {
      const novRes = await apiFetch(`/api/novels/${sub.contentId}`);
      if (novRes.ok) {
        const novData = await novRes.json();
        contentHtml = `<h3>${escapeHtml(novData.novel?.title)}</h3><p>${escapeHtml(novData.novel?.description)}</p>`;
      }
    }
  } catch (err) {
    contentHtml = `<p style="color:#EF4444;">Error loading content: ${escapeHtml(err.message)}</p>`;
  }

  mount.innerHTML = `
    <div class="modal-overlay open" id="preview-sub-modal" onclick="if(event.target === this) this.remove();">
      <div class="modal-card reader-preview-modal-card" style="max-width:840px; width:95%; max-height:90vh; display:flex; flex-direction:column; overflow:hidden;">
        <div class="preview-header-bar" style="padding:14px 20px; border-bottom:1px solid #E2E8F0; display:flex; justify-content:space-between; align-items:center; background:#FAF7F2;">
          <div>
            <strong style="font-size:14px; color:#1A0B2E;">Preview: ${escapeHtml(sub.title)}</strong>
            <div style="font-size:11.5px; color:#64748B;">Submitted by <strong>${escapeHtml(sub.writerName)}</strong> • Type: ${sub.contentType}</div>
          </div>
          <button type="button" class="modal-close-btn" onclick="document.getElementById('preview-sub-modal').remove();">✕</button>
        </div>
        <div style="flex:1; overflow-y:auto; padding:28px; background:#FFFFFF;">
          <div style="max-width:700px; margin:0 auto; font-family:'Lora', Georgia, serif; font-size:1.05rem; line-height:1.8; color:#1E293B;">
            ${contentHtml}
          </div>
        </div>
        <div style="padding:12px 20px; border-top:1px solid #E2E8F0; display:flex; justify-content:flex-end; gap:8px; background:#F8FAFC;">
          <button type="button" class="btn btn-outline btn-sm" onclick="document.getElementById('preview-sub-modal').remove();">Close</button>
          <button type="button" class="btn btn-gold btn-sm" onclick="document.getElementById('preview-sub-modal').remove(); approveAndPublishSubmissionAction(${sub.id});">Approve &amp; Publish</button>
        </div>
      </div>
    </div>
  `;
};

// ============================================================================
// AUDIO EPISODE MODAL (Add/Edit Episode, Chapter, or Sub-episode)
// ============================================================================
window.openAudioEpisodeModal = async ({ novelId, parentId = null, episodeId = null, isChapter = false } = {}) => {
  const mount = document.getElementById('audio-modal-mount');
  if (!mount) return;

  let existingEp = null;
  if (episodeId) {
    try {
      const res = await apiFetch(`/api/admin/audio-episodes?novel=${encodeURIComponent(novelId)}`);
      const data = await res.json();
      const flatten = (arr) => {
        let r = [];
        arr.forEach(item => {
          r.push(item);
          if (item.subEpisodes) r = r.concat(flatten(item.subEpisodes));
        });
        return r;
      };
      existingEp = flatten(data.episodes || []).find(e => Number(e.id) === Number(episodeId)) || null;
    } catch {}
  }

  const isEdit = Boolean(existingEp);
  const targetParentId = isEdit ? existingEp.parentId : parentId;
  const initialSourceType = existingEp ? (existingEp.hasAudio && existingEp.hasYouTube ? 'both' : (existingEp.hasYouTube ? 'youtube' : 'audio_file')) : 'both';

  mount.innerHTML = `
    <div class="modal-overlay open" id="audio-episode-form-modal" onclick="if(event.target === this) closeAudioEpisodeModal();">
      <div class="modal-card admin-modal-card" style="max-width:720px; max-height:92vh; overflow-y:auto;">
        <div class="modal-header">
          <h3 class="modal-title">
            ${isEdit ? `Edit Episode: ${escapeHtml(existingEp.title)}` : (isChapter ? '+ Add Root Chapter' : '+ Add Audio Episode')}
          </h3>
          <button class="modal-close-btn" onclick="closeAudioEpisodeModal()">✕</button>
        </div>
        <div class="modal-body" style="padding:20px 24px;">
          <form id="audio-episode-form" onsubmit="event.preventDefault(); submitAudioEpisodeForm();">
            <input type="hidden" id="aep-novel-id" value="${escapeHtml(novelId)}">
            <input type="hidden" id="aep-episode-id" value="${existingEp ? existingEp.id : ''}">
            <input type="hidden" id="aep-parent-id" value="${targetParentId ? targetParentId : ''}">

            <div id="aep-form-error" class="novel-form-banner-error" style="display:none; margin-bottom:14px;"></div>

            ${targetParentId ? `
              <div style="background:#FAF5FF; border:1px solid #E9D5FF; padding:10px 14px; border-radius:8px; margin-bottom:16px; font-size:12.5px; color:#581C87;">
                📌 Hierarchical Placement: Under Parent ID <strong>#${targetParentId}</strong> (Numbering automatically generated)
              </div>
            ` : (isChapter ? `
              <div style="background:#FFFDF8; border:1px solid #FDE68A; padding:10px 14px; border-radius:8px; margin-bottom:16px; font-size:12.5px; color:#92400E;">
                📖 Creating a Root Chapter (e.g. Chapter 1, Chapter 2)
              </div>
            ` : '')}

            <div class="admin-form-grid">
              <div class="form-group" style="grid-column: 1 / -1;">
                <label class="form-label" style="font-weight:700;">Episode / Chapter Title <span style="color:#EF4444;">*</span></label>
                <input type="text" id="aep-title" class="form-input" value="${escapeHtml(existingEp?.title || '')}" placeholder="e.g. Episode 1.1 — The Mysterious Journey Begins" required>
              </div>

              <div class="form-group">
                <label class="form-label">Episode Number (Auto or Custom)</label>
                <input type="text" id="aep-number" class="form-input" value="${escapeHtml(existingEp?.episodeNumber || '')}" placeholder="Leave blank to auto-calculate (e.g. 1.1, 1.1.1)">
              </div>

              <div class="form-group">
                <label class="form-label">Audio Duration</label>
                <input type="text" id="aep-duration" class="form-input" value="${escapeHtml(existingEp?.audioDuration || '')}" placeholder="e.g. 24:15 (auto-detected on upload)">
              </div>

              <div class="form-group">
                <label class="form-label">Publication Status</label>
                <select id="aep-status" class="form-input" onchange="toggleEpisodeScheduleField(this.value)">
                  <option value="published" ${(!existingEp || existingEp.status === 'published') ? 'selected' : ''}>Published (Live)</option>
                  <option value="draft" ${existingEp?.status === 'draft' ? 'selected' : ''}>Draft</option>
                  <option value="disabled" ${existingEp?.status === 'disabled' ? 'selected' : ''}>Disabled (Temporarily Hidden)</option>
                  <option value="scheduled" ${existingEp?.status === 'scheduled' ? 'selected' : ''}>Scheduled</option>
                </select>
              </div>

              <div class="form-group" id="aep-schedule-wrap" style="display:${existingEp?.status === 'scheduled' ? 'block' : 'none'};">
                <label class="form-label">Schedule Date & Time</label>
                <input type="datetime-local" id="aep-scheduled-at" class="form-input" value="${existingEp?.scheduledAt ? existingEp.scheduledAt.slice(0, 16) : ''}">
              </div>
            </div>

            <!-- Media Options: Audio, YouTube, or Both -->
            <div style="margin-top:18px; padding:16px; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:10px;">
              <label class="form-label" style="font-weight:700; font-size:14px; margin-bottom:8px; display:block;">
                Media Playback Configuration <span style="color:#EF4444;">*</span>
              </label>
              <div style="display:flex; gap:10px; margin-bottom:14px; flex-wrap:wrap;">
                <label style="display:inline-flex; align-items:center; gap:6px; cursor:pointer; font-size:13px; font-weight:600; padding:6px 12px; background:#FFF; border:1px solid #CBD5E1; border-radius:6px;">
                  <input type="radio" name="aep-source-type" value="both" ${initialSourceType === 'both' ? 'checked' : ''} onchange="toggleAepMediaSections('both')">
                  <span>🎧+🎥 Audio + YouTube (Both)</span>
                </label>
                <label style="display:inline-flex; align-items:center; gap:6px; cursor:pointer; font-size:13px; font-weight:600; padding:6px 12px; background:#FFF; border:1px solid #CBD5E1; border-radius:6px;">
                  <input type="radio" name="aep-source-type" value="audio_file" ${initialSourceType === 'audio_file' ? 'checked' : ''} onchange="toggleAepMediaSections('audio_file')">
                  <span>🎧 Audio Only</span>
                </label>
                <label style="display:inline-flex; align-items:center; gap:6px; cursor:pointer; font-size:13px; font-weight:600; padding:6px 12px; background:#FFF; border:1px solid #CBD5E1; border-radius:6px;">
                  <input type="radio" name="aep-source-type" value="youtube" ${initialSourceType === 'youtube' ? 'checked' : ''} onchange="toggleAepMediaSections('youtube')">
                  <span>🎥 YouTube Only</span>
                </label>
              </div>

              <!-- Direct Audio Upload Field -->
              <div id="aep-audio-section" style="display:${initialSourceType === 'youtube' ? 'none' : 'block'}; margin-bottom:14px; padding:12px; background:#FFF; border:1px solid #E2E8F0; border-radius:8px;">
                <label class="form-label" style="font-weight:700; font-size:13px;">Upload Audio File (MP3, M4A, WAV up to 50MB)</label>
                <div class="admin-audio-upload-dropzone" onclick="document.getElementById('aep-audio-file-input').click();" style="padding:14px; text-align:center; cursor:pointer; border:1px dashed #CBD5E1; border-radius:6px; background:#FAF8F5;">
                  <div style="font-size:22px; margin-bottom:4px;">🎧</div>
                  <div id="aep-audio-filename" style="font-size:13px; font-weight:600; color:var(--color-navy-deep);">
                    ${existingEp?.audioFileUrl ? `Current File: ${existingEp.audioFileUrl.split('/').pop()}` : 'Click to select audio file'}
                  </div>
                </div>
                <input type="file" id="aep-audio-file-input" accept="audio/*" style="display:none;" onchange="handleAepAudioSelected(this.files[0])">
                <input type="hidden" id="aep-audio-file-url" value="${existingEp?.audioFileUrl || ''}">
                <input type="hidden" id="aep-audio-base64" value="">

                <div id="aep-audio-preview-wrap" style="display:${existingEp?.audioFileUrl ? 'block' : 'none'}; margin-top:10px;">
                  <audio id="aep-audio-preview" controls src="${existingEp?.audioFileUrl || ''}" style="width:100%;"></audio>
                </div>
              </div>

              <!-- YouTube Link Field -->
              <div id="aep-yt-section" style="display:${initialSourceType === 'audio_file' ? 'none' : 'block'}; padding:12px; background:#FFF; border:1px solid #E2E8F0; border-radius:8px;">
                <label class="form-label" style="font-weight:700; font-size:13px;">YouTube Video Link</label>
                <input type="url" id="aep-youtube-url" class="form-input" 
                       value="${escapeHtml(existingEp?.youtubeUrl || '')}" 
                       placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..." 
                       oninput="handleAepYouTubeInput(this.value)">
                
                <div id="aep-yt-preview-wrap" style="display:${existingEp?.embedUrl ? 'block' : 'none'}; margin-top:10px;">
                  <div style="position:relative; width:100%; aspect-ratio:16/9; background:#000; border-radius:6px; overflow:hidden;">
                    <iframe id="aep-yt-preview-iframe" src="${existingEp?.embedUrl || ''}" style="position:absolute; inset:0; width:100%; height:100%; border:0;" allowfullscreen></iframe>
                  </div>
                </div>
              </div>
            </div>

            <!-- Description -->
            <div class="form-group" style="margin-top:14px;">
              <label class="form-label">Episode Notes / Description (Optional)</label>
              <textarea id="aep-desc" class="form-input" rows="2" placeholder="Brief notes for listeners...">${escapeHtml(existingEp?.description || '')}</textarea>
            </div>

            <div style="display:flex; gap:10px; margin-top:20px; justify-content:flex-end;">
              <button type="button" class="btn btn-outline" onclick="closeAudioEpisodeModal()">Cancel</button>
              <button type="submit" id="aep-submit-btn" class="btn btn-gold">
                ${isEdit ? 'Save Changes' : '+ Save Episode'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;

  window.toggleEpisodeScheduleField = (status) => {
    const wrap = document.getElementById('aep-schedule-wrap');
    if (wrap) wrap.style.display = status === 'scheduled' ? 'block' : 'none';
  };

  window.toggleAepMediaSections = (type) => {
    const aSec = document.getElementById('aep-audio-section');
    const ySec = document.getElementById('aep-yt-section');
    if (aSec) aSec.style.display = type === 'youtube' ? 'none' : 'block';
    if (ySec) ySec.style.display = type === 'audio_file' ? 'none' : 'block';
  };

  window.handleAepYouTubeInput = (url) => {
    const wrap = document.getElementById('aep-yt-preview-wrap');
    const iframe = document.getElementById('aep-yt-preview-iframe');
    const match = (url || '').trim().match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/i);
    const videoId = match ? match[1] : null;
    if (videoId && wrap && iframe) {
      iframe.src = `https://www.youtube-nocookie.com/embed/${videoId}?rel=0`;
      wrap.style.display = 'block';
    } else if (wrap) {
      wrap.style.display = 'none';
    }
  };

  window.handleAepAudioSelected = (file) => {
    if (!file) return;
    const nameDisplay = document.getElementById('aep-audio-filename');
    const base64Input = document.getElementById('aep-audio-base64');
    const previewWrap = document.getElementById('aep-audio-preview-wrap');
    const previewPlayer = document.getElementById('aep-audio-preview');

    if (nameDisplay) nameDisplay.textContent = `${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)`;

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      if (base64Input) base64Input.value = dataUrl;
      if (previewWrap && previewPlayer) {
        previewPlayer.src = dataUrl;
        previewWrap.style.display = 'block';
      }
      const tempA = new Audio();
      tempA.src = dataUrl;
      tempA.onloadedmetadata = () => {
        if (tempA.duration && isFinite(tempA.duration)) {
          const m = Math.floor(tempA.duration / 60);
          const s = Math.floor(tempA.duration % 60);
          const durInput = document.getElementById('aep-duration');
          if (durInput && !durInput.value) {
            durInput.value = `${m}:${s < 10 ? '0' : ''}${s}`;
          }
        }
      };
    };
    reader.readAsDataURL(file);
  };
};

window.closeAudioEpisodeModal = () => {
  document.getElementById('audio-episode-form-modal')?.remove();
};

window.submitAudioEpisodeForm = async () => {
  const novelId = document.getElementById('aep-novel-id')?.value;
  const episodeId = document.getElementById('aep-episode-id')?.value;
  const parentId = document.getElementById('aep-parent-id')?.value || null;
  const title = (document.getElementById('aep-title')?.value || '').trim();
  const episodeNumber = (document.getElementById('aep-number')?.value || '').trim();
  const audioDuration = (document.getElementById('aep-duration')?.value || '').trim();
  const status = document.getElementById('aep-status')?.value || 'published';
  const scheduledAt = document.getElementById('aep-scheduled-at')?.value || null;
  const description = (document.getElementById('aep-desc')?.value || '').trim();

  const sourceType = document.querySelector('input[name="aep-source-type"]:checked')?.value || 'both';
  const youtubeUrl = (document.getElementById('aep-youtube-url')?.value || '').trim();
  const audioData = document.getElementById('aep-audio-base64')?.value || '';
  const audioFileUrl = document.getElementById('aep-audio-file-url')?.value || '';

  const errorEl = document.getElementById('aep-form-error');
  const submitBtn = document.getElementById('aep-submit-btn');

  if (!title) {
    if (errorEl) { errorEl.textContent = 'Title is required.'; errorEl.style.display = 'block'; }
    return;
  }

  const payload = {
    novelId,
    parentId: parentId ? Number(parentId) : null,
    title,
    episodeNumber,
    audioDuration,
    status,
    scheduledAt,
    description,
    sourceType,
    youtubeUrl: (sourceType === 'youtube' || sourceType === 'both') ? youtubeUrl : null,
    audioData: (sourceType === 'audio_file' || sourceType === 'both') ? audioData : null,
    audioFileUrl: (sourceType === 'audio_file' || sourceType === 'both') ? audioFileUrl : null
  };

  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Saving...'; }

  try {
    const isEdit = Boolean(episodeId);
    const endpoint = isEdit ? `/api/admin/audio-episodes/${episodeId}` : '/api/admin/audio-episodes';
    const method = isEdit ? 'PUT' : 'POST';

    const res = await apiFetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      if (errorEl) { errorEl.textContent = data.error || 'Failed to save episode.'; errorEl.style.display = 'block'; }
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Save Episode'; }
      return;
    }

    showToast(isEdit ? 'Episode updated successfully!' : 'Episode created successfully!');
    closeAudioEpisodeModal();
    loadAndRenderAudioTree(novelId);
  } catch (err) {
    if (errorEl) { errorEl.textContent = err.message; errorEl.style.display = 'block'; }
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Save Episode'; }
  }
};

window.previewAudioEpisodeModal = async (episodeId) => {
  let prevModal = document.getElementById('audio-preview-modal');
  if (!prevModal) {
    prevModal = document.createElement('div');
    prevModal.id = 'audio-preview-modal';
    prevModal.className = 'modal-overlay open';
    document.body.appendChild(prevModal);
  }

  prevModal.innerHTML = `
    <div class="modal-card" style="max-width:680px; max-height:90vh; overflow-y:auto; padding:0;">
      <div class="modal-header" style="background:#FFFDF8; border-bottom:1px solid #E2E8F0; padding:16px 20px;">
        <h3 class="modal-title">🎧 Media Playback Preview</h3>
        <button class="modal-close-btn" onclick="document.getElementById('audio-preview-modal')?.remove()">✕</button>
      </div>
      <div id="audio-prev-body" style="padding:20px; text-align:center;">
        Loading episode preview...
      </div>
    </div>
  `;

  try {
    const selectedNovelId = adminState.selectedAudioNovelId;
    const res = await apiFetch(`/api/admin/audio-episodes?novel=${encodeURIComponent(selectedNovelId)}`);
    const data = await res.json();
    const flatten = (arr) => {
      let r = [];
      arr.forEach(item => {
        r.push(item);
        if (item.subEpisodes) r = r.concat(flatten(item.subEpisodes));
      });
      return r;
    };
    const ep = flatten(data.episodes || []).find(e => Number(e.id) === Number(episodeId));
    const bodyEl = document.getElementById('audio-prev-body');
    if (!ep || !bodyEl) return;

    const hasAudio = Boolean(ep.audioFileUrl);
    const hasYt = Boolean(ep.embedUrl || ep.youtubeVideoId);

    bodyEl.innerHTML = `
      <div style="text-align:left; margin-bottom:16px;">
        <span class="admin-audio-badge-sm">Episode ${escapeHtml(ep.episodeNumber)}</span>
        <h3 style="margin:6px 0 2px; font-size:17px; color:#0B1F33;">${escapeHtml(ep.title)}</h3>
        <div style="font-size:12px; color:#64748B;">${ep.audioDuration ? `⏱ Duration: ${ep.audioDuration}` : ''} • Status: <strong>${ep.status}</strong></div>
      </div>

      ${hasYt ? `
        <div style="margin-bottom:16px;">
          <div style="font-size:12px; font-weight:700; color:#475569; margin-bottom:6px; text-align:left;">🎥 YouTube Video Player</div>
          <div style="position:relative; width:100%; aspect-ratio:16/9; background:#000; border-radius:8px; overflow:hidden;">
            <iframe src="${ep.embedUrl || `https://www.youtube-nocookie.com/embed/${ep.youtubeVideoId}?rel=0`}" style="position:absolute; inset:0; width:100%; height:100%; border:0;" allowfullscreen></iframe>
          </div>
        </div>
      ` : ''}

      ${hasAudio ? `
        <div style="padding:14px; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px; margin-top:12px; text-align:left;">
          <div style="font-size:12px; font-weight:700; color:#475569; margin-bottom:8px;">🎧 Direct Audio Stream Player</div>
          <audio controls src="${ep.audioFileUrl}" style="width:100%;"></audio>
        </div>
      ` : ''}

      ${!hasAudio && !hasYt ? `
        <div style="padding:24px; color:#64748B;">No media file or video attached to this episode.</div>
      ` : ''}
    `;
  } catch (err) {
    const bodyEl = document.getElementById('audio-prev-body');
    if (bodyEl) bodyEl.innerHTML = `<div style="color:#EF4444;">Failed to load preview: ${err.message}</div>`;
  }
};

window.toggleAudioEpisodeStatusPrompt = async (id) => {
  try {
    const res = await apiFetch(`/api/admin/audio-episodes/${id}/toggle-status`, { method: 'POST' });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast(`Status changed to: ${data.status}`);
      if (adminState.selectedAudioNovelId) {
        loadAndRenderAudioTree(adminState.selectedAudioNovelId);
      }
    }
  } catch (err) {
    showToast('Failed to toggle status: ' + err.message);
  }
};

window.deleteAudioEpisodePrompt = async (id) => {
  if (!confirm('Are you sure you want to delete this episode and all its sub-episodes?\n\nThis action cannot be undone.')) {
    return;
  }
  try {
    const res = await apiFetch(`/api/admin/audio-episodes/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast('Episode deleted successfully.');
      if (adminState.selectedAudioNovelId) {
        loadAndRenderAudioTree(adminState.selectedAudioNovelId);
      }
    }
  } catch (err) {
    showToast('Failed to delete episode: ' + err.message);
  }
};

