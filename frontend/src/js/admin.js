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
  episodes: [],
  editingEpisode: null, // Episode currently loaded in the rich-text editor
  scheduledEpisodes: [],
  writers: [],
  selectedWriterId: null,
  writersFilter: { search: '', status: 'all' },
  homepageSections: [],
  homepageSectionsDirty: false,
  mediaList: [],
  settings: {
    author_name: 'Rudhra Prarthana',
    default_timezone: 'Asia/Kolkata',
    site_title: 'Rudhra Prarthana Novels'
  },
  editorDirty: false,
  autosaveTimer: null,
  previewMode: 'split' // 'split' | 'edit-only' | 'preview-only'
};
window.adminState = adminState;

// Clean, consistent modern SVG icons (Feather/Lucide style)
export const ADMIN_ICONS = {
  grid: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>`,
  book: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>`,
  headphones: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 18v-6a9 9 0 0 1 18 0v6"></path><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path></svg>`,
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
  plus: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`
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

  // Admin Forgot Password state
  window.ADMIN_FORGOT_STATE = {
    view: 'login', // 'login' | 'forgot-request' | 'forgot-otp' | 'forgot-password' | 'forgot-success'
    email: '',
    resetToken: null,
    expirySeconds: 300,
    cooldownSeconds: 60,
    timerInterval: null,
    cooldownInterval: null
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
      if (titleEl) titleEl.textContent = 'Author & Admin Portal';
      if (subtitleEl) subtitleEl.textContent = 'Rudhra Prarthana Novels';

      cardBody.innerHTML = `
        <div id="admin-login-error" style="display:none; color:#EF4444; background:#FEF2F2; border:1px solid #FCA5A5; padding:10px 14px; border-radius:8px; font-size:13px; margin-bottom:16px; font-weight:600;"></div>
        <div id="admin-login-success" style="display:none; color:#15803D; background:#F0FDF4; border:1px solid #86EFAC; padding:10px 14px; border-radius:8px; font-size:13px; margin-bottom:16px; font-weight:600;"></div>

        <form onsubmit="event.preventDefault(); submitAdminLoginForm();">
          <div class="form-group" style="margin-bottom:16px;">
            <label class="form-label" style="font-weight:700; color:var(--color-navy-deep); font-size:13px; margin-bottom:6px; display:block;">
              Admin Username or Email
            </label>
            <input type="text" id="admin-username-input" class="form-input" 
                   value="${window.ADMIN_FORGOT_STATE.email || ''}"
                   placeholder="Enter username or email" required autocomplete="off"
                   style="width:100%; padding:10px 14px; border:1px solid var(--color-border); border-radius:8px; font-size:14px;">
          </div>

          <div class="form-group" style="margin-bottom:20px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
              <label class="form-label" style="font-weight:700; color:var(--color-navy-deep); font-size:13px; margin:0; display:block;">
                Admin Password
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
                  style="width:100%; padding:12px; font-size:15px; font-weight:700; letter-spacing:0.5px; border-radius:8px;">
            🔒 Authenticate & Access Dashboard
          </button>
        </form>

        <div style="text-align:center; margin-top:20px; font-size:12px; color:var(--color-text-muted);">
          <span>Authorized access only. Session activity is cryptographically logged.</span>
          <div style="margin-top:10px;">
            <a href="#home" style="color:var(--color-gold-warm); text-decoration:none; font-weight:600;">« Return to Public Website</a>
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
          <h1 class="admin-login-title" id="admin-login-title-text">Author & Admin Portal</h1>
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
            <a href="#home" class="btn btn-outline">« Back to Reader Home</a>
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
    adminState.activeTab = requestedTab;
  }

  const TAB_TITLES = {
    overview: 'Dashboard',
    novels: 'Novels',
    'novel-create': 'Create New Novel',
    audio: 'Audio Novels',
    episodes: 'Episodes',
    editor: 'Editor',
    scheduler: 'Schedule',
    homepage: 'Homepage Management',
    writers: 'Writer Management',
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

        <a href="#home" class="admin-mobile-site-btn" title="View Reader Site">
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

            <button type="button" class="admin-nav-item ${adminState.activeTab === 'homepage' ? 'active' : ''}" 
                    onclick="switchAdminTab('homepage')">
              <span class="admin-nav-item-content">
                ${ADMIN_ICONS.layout}
                <span>Homepage Management</span>
              </span>
              <span class="admin-nav-pill" id="nav-homepage-count">-</span>
            </button>

            <button type="button" class="admin-nav-item ${adminState.activeTab === 'writers' ? 'active' : ''}" 
                    onclick="switchAdminTab('writers')">
              <span class="admin-nav-item-content">
                ${ADMIN_ICONS.writers}
                <span>Writer Management</span>
              </span>
              <span class="admin-nav-pill" id="nav-writers-count">-</span>
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
            <a href="#home" class="admin-sidebar-action-btn" title="Open Public Reader Website">
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
    const [novelsRes, overviewRes, audioRes, writersRes, homepageRes] = await Promise.all([
      apiFetch('/api/admin/novels'),
      apiFetch('/api/admin/overview'),
      apiFetch('/api/admin/audio-novels'),
      apiFetch('/api/admin/writers'),
      apiFetch('/api/admin/homepage-sections')
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

    if (writersRes && writersRes.ok) {
      const writersData = await writersRes.json();
      adminState.writers = writersData.writers || [];
      const writersCountBadge = document.getElementById('nav-writers-count');
      if (writersCountBadge) {
        writersCountBadge.textContent = writersData.total !== undefined ? writersData.total : adminState.writers.length;
      }
    }

    if (homepageRes && homepageRes.ok) {
      const homepageData = await homepageRes.json();
      adminState.homepageSections = homepageData.sections || [];
      const homepageCountBadge = document.getElementById('nav-homepage-count');
      if (homepageCountBadge) homepageCountBadge.textContent = adminState.homepageSections.length;
    }

    if (overviewRes.ok) {
      const overview = await overviewRes.json();
      const stats = overview.stats;
      const novelsCountBadge = document.getElementById('nav-novels-count');
      const episodesCountBadge = document.getElementById('nav-episodes-count');
      const schedCountBadge = document.getElementById('nav-sched-count');

      if (novelsCountBadge && stats?.novels) novelsCountBadge.textContent = stats.novels.total;
      if (episodesCountBadge && stats?.episodes) episodesCountBadge.textContent = stats.episodes.total;
      if (schedCountBadge && stats?.episodes) schedCountBadge.textContent = stats.episodes.scheduled;
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
    case 'episodes':
      renderEpisodesTab(canvas);
      break;
    case 'editor':
      renderEditorTab(canvas);
      break;
    case 'scheduler':
      renderSchedulerTab(canvas);
      break;
    case 'homepage':
      renderHomepageManagementTab(canvas);
      break;
    case 'writers':
      renderWritersTab(canvas);
      break;
    case 'media':
      renderMediaTab(canvas);
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
async function renderNovelCreatePage(canvas) {
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

      <form id="novel-create-form" onsubmit="event.preventDefault(); submitNovelCreateForm(false);" novalidate>
        <!-- Section 1 — Basic Information -->
        <div class="admin-card novel-form-section">
          <div class="admin-card-header">
            <h2 class="admin-card-title">Section 1 — Basic Information</h2>
          </div>
          <div class="admin-card-body">
            <div class="novel-form-two-col">
              <!-- Left Column: Primary Text & Categorization -->
              <div class="novel-form-fields">
                <div class="form-group">
                  <label class="form-label" for="nc-title">
                    Novel Title <span class="required-star" aria-hidden="true">*</span>
                  </label>
                  <input type="text" id="nc-title" class="form-input" 
                         placeholder="e.g. Nenjam Marappadhillai (நெஞ்சம் மறப்பதில்லை)" 
                         required 
                         oninput="handleNovelTitleInput(this.value)">
                  <div class="form-field-error" id="nc-title-error" style="display:none;" role="alert"></div>
                </div>

                <div class="form-group">
                  <label class="form-label" for="nc-short-desc">Short Description</label>
                  <textarea id="nc-short-desc" class="form-input" rows="2" 
                            placeholder="A brief 1-2 sentence hook for catalog cards and preview lists..."></textarea>
                  <div class="form-field-hint">Displayed in catalog cards and search summaries.</div>
                </div>

                <div class="form-group">
                  <label class="form-label" for="nc-synopsis">Full Synopsis</label>
                  <textarea id="nc-synopsis" class="form-input" rows="6" 
                            placeholder="Comprehensive story synopsis introducing characters, conflicts, and the romance journey..."></textarea>
                  <div class="form-field-hint">Displayed prominently on the reader's novel detail page.</div>
                </div>

                <div class="form-row-2col">
                  <div class="form-group">
                    <label class="form-label" for="nc-genre">Genre / Category</label>
                    <select id="nc-genre" class="form-input">
                      <option value="Romance / Drama" selected>Romance / Drama (காதல் / குடும்ப நாவல்)</option>
                      <option value="Family Drama">Family Drama (குடும்பக் கதை)</option>
                      <option value="Romantic Thriller">Romantic Thriller (திகில் காதல்)</option>
                      <option value="Historical Fiction">Historical Fiction (வரலாற்று நாவல்)</option>
                      <option value="Social / Contemporary">Social / Contemporary (சமூக நாவல்)</option>
                      <option value="Mystery / Suspense">Mystery / Suspense (மர்ம நாவல்)</option>
                    </select>
                  </div>

                  <div class="form-group">
                    <label class="form-label" for="nc-language">Language</label>
                    <select id="nc-language" class="form-input">
                      <option value="Tamil" selected>Tamil (தமிழ்)</option>
                      <option value="English">English</option>
                      <option value="Bilingual">Bilingual (Tamil / English)</option>
                    </select>
                  </div>
                </div>
              </div>

              <!-- Right Column: Live 2:3 Cover Preview & Direct Upload -->
              <div class="novel-cover-upload-panel">
                <label class="form-label" style="font-weight:700; color:var(--color-navy-deep); font-size:13px; margin-bottom:8px; display:block;">Novel Cover Image</label>
                <div class="novel-cover-preview-card clean-cover-card">
                  <!-- Cover Image Preview Wrapper (Clicking opens native file picker directly) -->
                  <div class="novel-cover-img-wrapper" id="nc-cover-wrapper" onclick="triggerNovelCoverFilePicker()" title="Click to choose or replace cover image">
                    <img id="nc-cover-preview-img" src="/default-cover.jpg" alt="Novel Cover Preview" onerror="this.onerror=null;this.src='/default-cover.jpg';">
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
                  <input type="hidden" id="nc-cover-url-input" value="/default-cover.jpg">

                  <!-- Actions Container: One Button (+ Remove Image if set) -->
                  <div class="novel-cover-single-action" style="width:100%; margin-top:12px;">
                    <button type="button" id="nc-choose-cover-btn" class="btn btn-gold btn-sm" style="width:100%; justify-content:center; gap:8px;" onclick="triggerNovelCoverFilePicker()">
                      ${ADMIN_ICONS.upload}
                      <span id="nc-choose-cover-text">Choose Cover Image</span>
                    </button>
                    <button type="button" id="nc-remove-cover-btn" class="btn btn-outline btn-sm btn-danger-subtle" style="display:none; width:100%; justify-content:center; gap:6px; margin-top:8px;" onclick="removeNovelCoverImage()">
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
              <div class="form-group">
                <label class="form-label" for="nc-status">Novel Status</label>
                <select id="nc-status" class="form-input">
                  <option value="Ongoing" selected>Ongoing (தொடர்கதை)</option>
                  <option value="Completed">Completed (முழு நாவல்)</option>
                </select>
                <div class="form-field-hint">Indicates whether new episodes will be published.</div>
              </div>

              <div class="form-group">
                <label class="form-label" for="nc-author">Author / Creator</label>
                <input type="text" id="nc-author" class="form-input" value="Rudhra Prarthana" required>
                <div class="form-field-hint">Pre-filled with authenticated author identity.</div>
              </div>

              <div class="form-group">
                <label class="form-label" for="nc-visibility">Visibility & Access</label>
                <select id="nc-visibility" class="form-input">
                  <option value="public" selected>Public (Live on Website for Readers)</option>
                  <option value="draft">Draft (Hidden from Readers)</option>
                  <option value="private">Private (Admin & Author Only)</option>
                </select>
                <div class="form-field-hint">Controls who can discover and read this novel.</div>
              </div>

              <div class="form-group">
                <label class="form-label" for="nc-featured">Homepage Placement</label>
                <select id="nc-featured" class="form-input">
                  <option value="0" selected>Standard Catalog Placement</option>
                  <option value="1">★ Feature in Homepage Hero / Highlights</option>
                </select>
                <div class="form-field-hint">Feature this novel on the reader home landing page.</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Submission Status Banner -->
        <div id="nc-form-error" class="novel-form-banner-error" style="display:none;" role="alert"></div>

        <!-- Form Actions Bar -->
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
    </div>
  `;

  // Focus title input on render
  setTimeout(() => {
    document.getElementById('nc-title')?.focus();
  }, 100);
}

window.handleNovelTitleInput = (title) => {
  const titleError = document.getElementById('nc-title-error');
  if (titleError) titleError.style.display = 'none';
};

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
  const urlInput = document.getElementById('nc-cover-url-input');
  const removeBtn = document.getElementById('nc-remove-cover-btn');
  const chooseBtnText = document.getElementById('nc-choose-cover-text');

  if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }

  // 1. Validate file type & size
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

  // 2. Read local file for immediate preview
  const reader = new FileReader();
  reader.onload = async (e) => {
    const localDataUrl = e.target.result;
    if (previewImg) previewImg.src = localDataUrl;
    if (spinner) spinner.style.display = 'flex';

    try {
      // 3. Direct upload to existing backend
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

      // 4. Update form hidden input & controls
      if (urlInput) {
        urlInput.value = data.media.url;
        urlInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (previewImg) previewImg.src = data.media.url;
      if (removeBtn) removeBtn.style.display = 'inline-flex';
      if (chooseBtnText) chooseBtnText.textContent = 'Replace Cover Image';
      showToast('Cover image selected and uploaded! ✨');
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
  const urlInput = document.getElementById('nc-cover-url-input');
  const fileInput = document.getElementById('nc-cover-file-input');
  const removeBtn = document.getElementById('nc-remove-cover-btn');
  const chooseBtnText = document.getElementById('nc-choose-cover-text');
  const errEl = document.getElementById('nc-cover-error');

  if (previewImg) previewImg.src = '/default-cover.jpg';
  if (urlInput) {
    urlInput.value = '/default-cover.jpg';
    urlInput.dispatchEvent(new Event('input', { bubbles: true }));
  }
  if (fileInput) fileInput.value = '';
  if (removeBtn) removeBtn.style.display = 'none';
  if (chooseBtnText) chooseBtnText.textContent = 'Choose Cover Image';
  if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
  showToast('Cover image removed from novel.');
};

window.removeCoverImage = () => {
  window.removeNovelCoverImage();
};

const TAMIL_MAP = {
  // Independent vowels
  'அ': 'a', 'ஆ': 'aa', 'இ': 'i', 'ஈ': 'ee', 'உ': 'u', 'ஊ': 'oo',
  'எ': 'e', 'ஏ': 'ae', 'ஐ': 'ai', 'ஒ': 'o', 'ஓ': 'oa', 'ஔ': 'au', 'ஃ': 'akh',
  // Consonants
  'க': 'k', 'ங': 'ng', 'ச': 's', 'ஞ': 'ny', 'ட': 't', 'ண': 'n',
  'த': 'th', 'ந': 'n', 'ப': 'p', 'ம': 'm', 'ய': 'y', 'ர': 'r',
  'ல': 'l', 'வ': 'v', 'ழ': 'zh', 'ள': 'l', 'ற': 'r', 'ன': 'n',
  'ஜ': 'j', 'ஷ': 'sh', 'ஸ': 's', 'ஹ': 'h', 'க்ஷ': 'ksh'
};

const TAMIL_VOWEL_SIGNS = {
  'ா': 'aa', 'ி': 'i', 'ீ': 'ee', 'ு': 'u', 'ூ': 'oo',
  'ெ': 'e', 'ே': 'ae', 'ை': 'ai', 'ொ': 'o', 'ோ': 'oa', 'ௌ': 'au'
};

/**
 * Transliterates Tamil script into readable phonetic Latin characters
 */
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
      // stray virama ignored
    } else {
      res += ch;
    }
  }
  return res;
}

/**
 * Automatically generate a clean, URL-safe slug from a novel title.
 */
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

window.submitNovelCreateForm = async (isDraft = false) => {
  const titleInput = document.getElementById('nc-title');
  const titleError = document.getElementById('nc-title-error');
  const formError = document.getElementById('nc-form-error');

  if (titleError) titleError.style.display = 'none';
  if (formError) formError.style.display = 'none';

  const title = titleInput?.value?.trim() || '';
  const shortDesc = document.getElementById('nc-short-desc')?.value?.trim() || '';
  const synopsis = document.getElementById('nc-synopsis')?.value?.trim() || '';
  const genre = document.getElementById('nc-genre')?.value || 'Romance / Drama';
  const language = document.getElementById('nc-language')?.value || 'Tamil';
  const cover = document.getElementById('nc-cover-url-input')?.value?.trim() || '/default-cover.jpg';
  const status = document.getElementById('nc-status')?.value || 'Ongoing';
  const author = document.getElementById('nc-author')?.value?.trim() || 'Rudhra Prarthana';
  let visibility = document.getElementById('nc-visibility')?.value || 'public';
  const featured = document.getElementById('nc-featured')?.value === '1';

  // Validation: Author only enters the Novel Title
  if (!title) {
    if (titleError) {
      titleError.textContent = 'Please enter a novel title.';
      titleError.style.display = 'block';
    }
    if (titleInput) titleInput.focus();
    return;
  }

  // Automatically generate URL slug from title
  const slug = generateNovelSlug(title);

  // If "Save Draft" clicked, force visibility to draft
  if (isDraft) {
    visibility = 'draft';
  }

  const isPublished = visibility === 'public' ? 1 : 0;
  const description = synopsis || shortDesc || '';

  // Prevent accidental duplicate submissions
  const submitBtn = document.getElementById('nc-submit-btn');
  const draftBtn = document.getElementById('nc-save-draft-btn');
  if (submitBtn) submitBtn.disabled = true;
  if (draftBtn) draftBtn.disabled = true;

  if (isDraft && draftBtn) {
    draftBtn.textContent = 'Saving Draft...';
  } else if (submitBtn) {
    submitBtn.textContent = 'Creating Novel...';
  }

  try {
    const res = await apiFetch('/api/novels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug,
        title,
        author,
        genre,
        category: `${status} Novels`,
        status,
        visibility,
        isPublished,
        featured: featured ? 1 : 0,
        cover,
        description,
        language
      })
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
    
    // Refresh admin data and navigate to Novels tab
    await loadAdminInitialData();
    switchAdminTab('novels');
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

  canvas.innerHTML = `
    <div class="admin-page-header">
      <div class="admin-page-title-group">
        <h1 class="admin-page-title">Audio Novels</h1>
        <p class="admin-page-subtitle">Listen & Enjoy — Manage YouTube videos and direct audio uploads.</p>
      </div>
      <div class="admin-page-actions">
        <button type="button" class="btn btn-gold btn-sm" onclick="openAudioNovelModal()">+ Add Audio Novel</button>
      </div>
    </div>

    <div class="admin-filters-bar">
      <div class="admin-search-wrap">
        <span class="admin-search-icon" aria-hidden="true">🔍</span>
        <input type="text" id="audio-search-input" class="admin-search-input" 
               placeholder="Search by title, description, or linked novel..." 
               oninput="filterAudioNovelsTable(this.value)">
      </div>
      <select id="audio-source-filter" class="admin-filter-select" onchange="filterAudioNovelsByFilters()">
        <option value="all">All Sources</option>
        <option value="youtube">YouTube Embed</option>
        <option value="audio_file">Direct Audio File</option>
      </select>
      <select id="audio-status-filter" class="admin-filter-select" onchange="filterAudioNovelsByFilters()">
        <option value="all">All Statuses</option>
        <option value="published">Published</option>
        <option value="draft">Draft</option>
      </select>
      <select id="audio-language-filter" class="admin-filter-select" onchange="filterAudioNovelsByFilters()">
        <option value="all">All Languages</option>
        <option value="tamil">Tamil</option>
        <option value="english">English</option>
      </select>
    </div>

    <div class="admin-table-wrapper">
      <table class="admin-table">
        <thead>
          <tr>
            <th>Audio Novel</th>
            <th>Source</th>
            <th>Linked Novel</th>
            <th>Part / Ep</th>
            <th>Language</th>
            <th>Status</th>
            <th>Views</th>
            <th style="text-align:right;">Actions</th>
          </tr>
        </thead>
        <tbody id="audio-novels-table-body">
          ${adminState.audioNovels.length === 0 ? `
            <tr>
              <td colspan="8" style="text-align:center; padding:48px 16px; color:var(--color-text-muted);">
                <div style="font-size:32px; margin-bottom:8px;">🎧</div>
                <div style="font-size:16px; font-weight:600; color:var(--color-navy-deep); margin-bottom:6px;">No audio novels yet</div>
                <div style="font-size:13px; margin-bottom:16px;">Add your first audio novel using a direct audio file upload or YouTube link.</div>
                <button type="button" class="btn btn-gold btn-sm" onclick="openAudioNovelModal()">+ Add Audio Novel</button>
              </td>
            </tr>
          ` : adminState.audioNovels.map(an => renderAudioNovelTableRow(an)).join('')}
        </tbody>
      </table>
    </div>

    <!-- Modal mount container for Add/Edit Audio Novel -->
    <div id="audio-modal-mount"></div>
  `;

  window.filterAudioNovelsTable = (query) => {
    window.filterAudioNovelsByFilters();
  };

  window.filterAudioNovelsByFilters = () => {
    const q = (document.getElementById('audio-search-input')?.value || '').toLowerCase().trim();
    const source = (document.getElementById('audio-source-filter')?.value || 'all').toLowerCase();
    const status = (document.getElementById('audio-status-filter')?.value || 'all').toLowerCase();
    const lang = (document.getElementById('audio-language-filter')?.value || 'all').toLowerCase();

    const rows = document.querySelectorAll('.audio-table-row');
    rows.forEach(row => {
      const rowText = row.textContent.toLowerCase();
      const rowSource = (row.getAttribute('data-source') || '').toLowerCase();
      const rowStatus = (row.getAttribute('data-status') || '').toLowerCase();
      const rowLang = (row.getAttribute('data-lang') || '').toLowerCase();

      const matchesQ = !q || rowText.includes(q);
      const matchesSource = source === 'all' || rowSource === source;
      const matchesStatus = status === 'all' || rowStatus === status;
      const matchesLang = lang === 'all' || rowLang === lang;

      row.style.display = (matchesQ && matchesSource && matchesStatus && matchesLang) ? '' : 'none';
    });
  };
}

function renderAudioNovelTableRow(an) {
  const isPub = an.status === 'published';
  const isYouTube = an.sourceType === 'youtube';
  const sourceLabel = isYouTube ? '▶ YouTube' : '🎧 Direct Audio';
  const sourceBadgeClass = isYouTube ? 'youtube' : 'audio_file';

  return `
    <tr class="audio-table-row" data-source="${escapeHtml(an.sourceType)}" data-status="${escapeHtml(an.status)}" data-lang="${escapeHtml(an.language)}">
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
        <span class="admin-source-badge ${sourceBadgeClass}">
          ${sourceLabel}
        </span>
      </td>
      <td>
        ${an.linkedNovelTitle ? `
          <strong style="color:var(--color-navy-deep);">${escapeHtml(an.linkedNovelTitle)}</strong>
        ` : `<span style="color:#94A3B8;">—</span>`}
      </td>
      <td><strong>${escapeHtml(an.episodeNumber || `Part ${an.partNumber || 1}`)}</strong></td>
      <td>${escapeHtml(an.language || 'Tamil')}</td>
      <td>
        <button type="button" class="status-pill ${isPub ? 'published' : 'draft'}" 
                style="cursor:pointer; border:none;" 
                onclick="toggleAudioNovelStatus('${an.id}', '${an.status}')" 
                title="Click to toggle publish status">
          ${isPub ? '🟢 Published' : '🔒 Draft'}
        </button>
      </td>
      <td>${an.views || 0}</td>
      <td style="text-align:right;">
        <div class="admin-action-btn-group">
          <a href="#audio?id=${an.slug || an.id}" class="btn btn-outline btn-sm" target="_blank" title="Listen / Watch Playback">
            ▶ <span class="hide-xs">Play</span>
          </a>
          <button type="button" class="btn btn-outline btn-sm" onclick="openAudioNovelModal('${an.id}')" title="Edit Audio Novel">
            ✏️
          </button>
          <button type="button" class="btn btn-outline btn-sm" onclick="deleteAudioNovelPrompt('${an.id}')" style="color:#DC2626; border-color:#FECACA;" title="Delete Audio Novel">
            🗑️
          </button>
        </div>
      </td>
    </tr>
  `;
}

/**
 * Open Modal to Add or Edit Audio Novel
 */
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
        <h1 class="admin-page-title">Episodes</h1>
        <p class="admin-page-subtitle">Manage chapter hierarchy, sub-episodes, and publication status.</p>
      </div>
      <div class="admin-page-actions">
        <button type="button" class="btn btn-gold btn-sm" onclick="startNewEpisodeInEditor('${currentNovelId}')">+ New Episode</button>
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
        Loading episodes for ${escapeHtml(currentNovel?.title || 'novel')}...
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
          <h3 style="font-family:var(--font-serif); color:var(--color-navy-deep); margin:0 0 8px;">No Episodes Created Yet</h3>
          <p style="color:var(--color-text-muted); font-size:14px; max-width:440px; margin:0 auto 18px;">
            Start writing the first chapter of this novel. You can add unlimited episodes and nested sub-episodes (e.g. Episode 1.1, 1.2).
          </p>
          <button type="button" class="btn btn-gold btn-sm" onclick="startNewEpisodeInEditor('${novelId}')">+ Write Episode 1</button>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="admin-episodes-tree">
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
 * Render an individual episode tree item and its nested sub-episodes
 */
function renderEpisodeTreeItem(ep) {
  const subs = ep.subEpisodes || [];
  const statusClass = ep.status === 'published' ? 'published' : (ep.status === 'scheduled' ? 'scheduled' : 'draft');
  const statusLabel = ep.status === 'published' ? 'Published' : (ep.status === 'scheduled' ? `Scheduled (${formatScheduleDate(ep.scheduledAt)})` : 'Draft');

  return `
    <div class="episode-tree-root" id="ep-item-${ep.id}">
      <div class="episode-root-row">
        <div class="episode-item-info">
          <span class="episode-number-badge">Ep ${escapeHtml(ep.episodeNumber)}</span>
          <div>
            <div class="episode-item-title">${escapeHtml(ep.title)}</div>
            <div class="episode-item-meta">
              <span>📅 ${ep.releaseDate || 'Recent'}</span>
              <span>•</span>
              <span>⏱ ${ep.readTime || '8 mins'}</span>
              <span>•</span>
              <span class="status-pill ${statusClass}" style="font-size:10px;">${statusLabel}</span>
              ${subs.length > 0 ? `<span style="font-weight:700; color:var(--color-gold-warm);">(${subs.length} sub-episodes)</span>` : ''}
            </div>
          </div>
        </div>

        <div class="episode-item-actions">
          <button type="button" class="btn btn-outline btn-sm" onclick="startNewSubEpisodeInEditor(${ep.id}, '${escapeHtml(ep.episodeNumber)}')" title="Add Sub-Episode (e.g. ${ep.episodeNumber}.1)">
            ➕ <span class="hide-sm">Sub-Ep</span>
          </button>
          <button type="button" class="btn btn-outline btn-sm" onclick="editEpisodeInEditor(${ep.id})" title="Edit in Rich-Text Editor">
            ✏️ Edit
          </button>
          <button type="button" class="btn btn-outline btn-sm" onclick="duplicateEpisodeAction(${ep.id})" title="Duplicate Episode">
            📋 <span class="hide-sm">Copy</span>
          </button>
          <button type="button" class="btn btn-outline btn-sm" onclick="previewEpisodeModal(${ep.id})" title="Preview Reader View">
            👁️
          </button>
          <button type="button" class="btn btn-outline btn-sm" onclick="deleteEpisodeAction(${ep.id}, '${escapeHtml(ep.title)}')" style="color:#DC2626; border-color:#FECACA;" title="Delete Episode">
            🗑️
          </button>
        </div>
      </div>

      <!-- Nested Sub-Episodes Container -->
      ${subs.length > 0 ? `
        <div class="sub-episodes-list">
          ${subs.map(sub => `
            <div class="sub-episode-row">
              <div style="display:flex; align-items:center; gap:10px;">
                <span class="sub-episode-badge">Sub-Ep ${escapeHtml(sub.episodeNumber)}</span>
                <div>
                  <div style="font-weight:700; font-size:13px; color:var(--color-navy-deep);">${escapeHtml(sub.title)}</div>
                  <div style="font-size:11px; color:var(--color-text-muted);">
                    ${sub.readTime} • <span class="status-pill ${sub.status === 'published' ? 'published' : (sub.status === 'scheduled' ? 'scheduled' : 'draft')}" style="font-size:9px; padding:1px 6px;">${sub.status}</span>
                  </div>
                </div>
              </div>

              <div style="display:flex; gap:4px;">
                <button class="btn btn-outline btn-sm" style="font-size:11px; padding:3px 8px;" onclick="editEpisodeInEditor(${sub.id})">✏️ Edit</button>
                <button class="btn btn-outline btn-sm" style="font-size:11px; padding:3px 8px;" onclick="duplicateEpisodeAction(${sub.id})">📋</button>
                <button class="btn btn-outline btn-sm" style="font-size:11px; padding:3px 8px;" onclick="previewEpisodeModal(${sub.id})">👁️</button>
                <button class="btn btn-outline btn-sm" style="font-size:11px; padding:3px 8px; color:#EF4444;" onclick="deleteEpisodeAction(${sub.id}, '${escapeHtml(sub.title)}')">🗑️</button>
              </div>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

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
  if (!confirm(`Are you sure you want to delete episode "${title}"?`)) {
    return;
  }
  try {
    const res = await apiFetch(`/api/admin/episodes/${episodeId}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok || !data.success) {
      showToast(data.error || 'Failed to delete episode.');
      return;
    }
    showToast(`Episode "${title}" deleted.`);
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
window.startNewEpisodeInEditor = (novelId) => {
  adminState.editingEpisode = {
    id: null,
    novelId: novelId || adminState.selectedNovelId || adminState.novels[0]?.id,
    parentId: null,
    episodeNumber: '',
    title: '',
    content: '<p>The story begins here...</p>',
    status: 'published',
    scheduledAt: null,
    timezone: 'Asia/Kolkata'
  };
  switchAdminTab('editor');
};

window.startNewSubEpisodeInEditor = (parentId, parentNumber) => {
  adminState.editingEpisode = {
    id: null,
    novelId: adminState.selectedNovelId,
    parentId: parentId,
    episodeNumber: '',
    title: '',
    content: '<p>Sub-episode narrative unfolds here...</p>',
    status: 'published',
    scheduledAt: null,
    timezone: 'Asia/Kolkata'
  };
  switchAdminTab('editor');
};

window.editEpisodeInEditor = async (episodeId) => {
  try {
    const res = await apiFetch(`/api/admin/episodes/${episodeId}`);
    const data = await res.json();
    if (res.ok && data.episode) {
      adminState.editingEpisode = data.episode;
      adminState.selectedNovelId = data.episode.novelId;
      switchAdminTab('editor');
    }
  } catch (err) {
    showToast('Failed to load episode for editing: ' + err.message);
  }
};

function renderEditorTab(canvas) {
  const ep = adminState.editingEpisode || {
    id: null,
    novelId: adminState.selectedNovelId || adminState.novels[0]?.id,
    parentId: null,
    episodeNumber: '',
    title: '',
    content: '<p>Write your novel chapter here...</p>',
    status: 'published',
    scheduledAt: null,
    timezone: 'Asia/Kolkata'
  };

  const isEditing = Boolean(ep.id);
  const currentNovelId = ep.novelId || adminState.selectedNovelId;

  // Flatten current novel's episodes for parent selector
  const potentialParents = adminState.episodes.filter(item => !item.parentId && item.id !== ep.id);

  canvas.innerHTML = `
    <div class="admin-page-header">
      <div class="admin-page-title-group">
        <h1 class="admin-page-title">${isEditing ? `Edit Episode: ${escapeHtml(ep.title || 'Untitled')}` : 'Write New Episode'}</h1>
        <p class="admin-page-subtitle">Rich-text writing and live reader preview.</p>
      </div>
      <div class="admin-page-actions">
        <button type="button" class="btn btn-outline btn-sm" onclick="toggleEditorPreviewMode()">
          Live Preview
        </button>
        <button type="button" class="btn btn-outline btn-sm" onclick="saveEditorDraft(false)">
          Save Draft
        </button>
        <button type="button" class="btn btn-gold btn-sm" onclick="saveEditorPublish()">
          ${ep.status === 'scheduled' ? 'Schedule Release' : 'Publish Episode'}
        </button>
      </div>
    </div>

    <div class="editor-container">
      <!-- Top Meta Controls Grid -->
      <div class="editor-meta-grid">
        <div class="form-group">
          <label class="form-label" style="font-weight:700; color:var(--color-navy-deep); font-size:13px; margin-bottom:4px; display:block;">
            Episode Title <span style="color:#EF4444;">*</span>
          </label>
          <input type="text" id="editor-title-input" class="form-input" 
                 placeholder="e.g. Chapter 01 — Beginning of Dawn" 
                 value="${escapeHtml(ep.title || '')}"
                 oninput="onEditorContentChange()"
                 style="font-size:15px; font-weight:700;">
        </div>

        <div class="form-group">
          <label class="form-label" style="font-weight:700; color:var(--color-navy-deep); font-size:13px; margin-bottom:4px; display:block;">
            Novel
          </label>
          <select id="editor-novel-select" class="form-input" onchange="onEditorNovelChange(this.value)">
            ${adminState.novels.map(n => `
              <option value="${n.id}" ${n.id === currentNovelId ? 'selected' : ''}>${escapeHtml(n.title)}</option>
            `).join('')}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label" style="font-weight:700; color:var(--color-navy-deep); font-size:13px; margin-bottom:4px; display:block;">
            Hierarchy / Parent
          </label>
          <select id="editor-parent-select" class="form-input" onchange="onEditorParentChange(this.value)">
            <option value="" ${!ep.parentId ? 'selected' : ''}>Root Episode (e.g. Ep 1, Ep 2)</option>
            ${potentialParents.map(p => `
              <option value="${p.id}" ${ep.parentId === p.id ? 'selected' : ''}>Sub-Episode of: Ep ${escapeHtml(p.episodeNumber)} — ${escapeHtml(p.title)}</option>
            `).join('')}
          </select>
        </div>
      </div>

      <!-- Episode Numbering & Scheduling Strip -->
      <div class="editor-meta-strip">
        <div class="editor-num-wrap">
          <span class="editor-strip-label">Episode #:</span>
          <input type="text" id="editor-num-input" class="editor-num-input" placeholder="e.g. 1 or 1.1" 
                 value="${escapeHtml(ep.episodeNumber || '')}"
                 oninput="onEditorContentChange()">
          <span class="editor-strip-hint">(Leave blank to auto-calculate)</span>
        </div>

        <!-- Publishing Status & Schedule Controls -->
        <div class="editor-status-wrap">
          <span class="editor-strip-label">Status:</span>
          <select id="editor-status-select" class="form-input editor-status-select" onchange="onEditorStatusToggle(this.value)">
            <option value="published" ${ep.status === 'published' ? 'selected' : ''}>🚀 Published (Live Now)</option>
            <option value="scheduled" ${ep.status === 'scheduled' ? 'selected' : ''}>⏰ Scheduled Release</option>
            <option value="draft" ${ep.status === 'draft' ? 'selected' : ''}>📝 Draft (Private)</option>
          </select>

          <!-- Scheduled Date/Time Picker Container -->
          <div id="editor-schedule-picker-box" class="editor-schedule-picker-box" style="display:${ep.status === 'scheduled' ? 'flex' : 'none'};">
            <input type="datetime-local" id="editor-sched-datetime" class="form-input" 
                   value="${formatDatetimeLocal(ep.scheduledAt)}">
            <select id="editor-sched-timezone" class="form-input">
              <option value="Asia/Kolkata" selected>IST (Asia/Kolkata)</option>
              <option value="UTC">UTC</option>
              <option value="America/New_York">EST (New York)</option>
              <option value="Europe/London">GMT (London)</option>
            </select>
          </div>
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
          <button type="button" class="toolbar-btn" onclick="promptInsertImage()" title="Insert Image from URL or Media">🖼️ Image</button>
          <button type="button" class="toolbar-btn" onclick="execCmd('removeFormat')" title="Clear Formatting">🧹 Clear</button>
        </div>
      </div>

      <!-- Writing & Live Reader Preview Surfaces -->
      <div class="editor-canvas-wrap split-preview" id="editor-canvas-wrap">
        <!-- Writing Surface (contenteditable) -->
        <div style="display:flex; flex-direction:column; gap:6px;">
          <span style="font-weight:700; font-size:12px; color:var(--color-navy-deep); text-transform:uppercase; letter-spacing:0.5px;">
            ✍️ Writing Surface
          </span>
          <div class="editor-writing-surface" id="editor-surface" contenteditable="true" 
               oninput="onEditorContentChange()" role="textbox" aria-multiline="true">
            ${ep.content || '<p>Write your novel chapter here...</p>'}
          </div>
        </div>

        <!-- Exact Live Reader Preview Surface -->
        <div style="display:flex; flex-direction:column; gap:6px;" id="editor-preview-column">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-weight:700; font-size:12px; color:var(--color-gold-warm); text-transform:uppercase; letter-spacing:0.5px;">
              📖 Live Reader View (What Readers See)
            </span>
            <div style="display:flex; gap:4px;">
              <button class="mode-pill mode-pill-light active" style="font-size:10px; padding:2px 6px;" onclick="setEditorPreviewTheme('light')">Light</button>
              <button class="mode-pill mode-pill-sepia" style="font-size:10px; padding:2px 6px;" onclick="setEditorPreviewTheme('sepia')">Sepia</button>
              <button class="mode-pill mode-pill-dark" style="font-size:10px; padding:2px 6px;" onclick="setEditorPreviewTheme('dark')">Dark</button>
            </div>
          </div>
          <div class="editor-preview-surface" id="editor-preview-surface">
            <!-- Dynamic reader preview rendered here -->
          </div>
        </div>
      </div>

      <!-- Status Bar with Live Counters & Autosave -->
      <div class="editor-status-bar">
        <div style="display:flex; align-items:center; gap:16px;">
          <span id="editor-word-count">0 words</span>
          <span>•</span>
          <span id="editor-read-time">1 min read</span>
        </div>

        <div style="display:flex; align-items:center; gap:12px;">
          <div class="editor-autosave-badge">
            <span class="editor-autosave-dot" id="autosave-dot"></span>
            <span id="autosave-text">All changes saved</span>
          </div>
        </div>
      </div>
    </div>
  `;

  // Attach global editor helper functions
  setupEditorHelpers(ep);
  updateLivePreview();
  updateWordCounters();
}

/**
 * Setup Editor commands and helpers
 */
function setupEditorHelpers(currentEp) {
  window.execCmd = (command, value = null) => {
    document.execCommand(command, false, value);
    const surface = document.getElementById('editor-surface');
    if (surface) surface.focus();
    onEditorContentChange();
  };

  window.execFormatBlock = (tag) => {
    document.execCommand('formatBlock', false, tag);
    onEditorContentChange();
  };

  window.execFontSize = (size) => {
    if (size) document.execCommand('fontSize', false, size);
    onEditorContentChange();
  };

  window.promptInsertLink = () => {
    const url = prompt('Enter the link destination URL (https://...):');
    if (url) {
      document.execCommand('createLink', false, url);
      onEditorContentChange();
    }
  };

  window.promptInsertImage = () => {
    // Preserve cursor selection inside the editor surface before opening the modal
    let savedRange = null;
    const surface = document.getElementById('editor-surface');
    if (surface) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        if (surface.contains(range.commonAncestorContainer)) {
          savedRange = range.cloneRange();
        }
      }
    }

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/jpeg,image/png,image/webp,image/gif';
    fileInput.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        showToast('Please select a valid image file.');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        showToast('Image file size must be under 10MB.');
        return;
      }

      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          showToast('Uploading image for episode...');
          const res = await apiFetch('/api/admin/media/upload', {
            method: 'POST',
            body: JSON.stringify({ data: evt.target.result, filename: file.name })
          });
          const data = await res.json();
          if (res.ok && data.media?.url) {
            const surface = document.getElementById('editor-surface');
            if (surface) {
              surface.focus();
              const sel = window.getSelection();
              if (savedRange && sel) {
                try {
                  sel.removeAllRanges();
                  sel.addRange(savedRange);
                } catch (err) {}
              }
            }

            const altText = escapeHtml(file.name);
            const imgHtml = `<figure class="episode-inline-figure" style="margin:20px auto; text-align:center;"><img src="${escapeHtml(data.media.url)}" alt="${altText}" style="max-width:100%; height:auto; border-radius:8px; display:inline-block; box-shadow:0 4px 14px rgba(0,0,0,0.12);" /><figcaption style="font-size:12px; color:var(--color-text-muted); margin-top:6px; font-style:italic;">${altText}</figcaption></figure><p><br></p>`;

            let inserted = false;
            try {
              if (document.queryCommandSupported('insertHTML')) {
                inserted = document.execCommand('insertHTML', false, imgHtml);
              }
            } catch (err) {}

            if (!inserted) {
              try {
                document.execCommand('insertImage', false, data.media.url);
              } catch (err) {
                if (surface) surface.insertAdjacentHTML('beforeend', imgHtml);
              }
            }

            onEditorContentChange();
            showToast('Image inserted into story! ✨');
          } else {
            showToast(data.error || 'Failed to upload image.');
          }
        } catch (err) {
          showToast('Failed to upload image: ' + err.message);
        }
      };
      reader.readAsDataURL(file);
    };
    fileInput.click();
  };

  window.onEditorContentChange = () => {
    adminState.editorDirty = true;
    const dot = document.getElementById('autosave-dot');
    const text = document.getElementById('autosave-text');
    if (dot) dot.classList.add('dirty');
    if (text) text.textContent = 'Unsaved changes...';

    updateLivePreview();
    updateWordCounters();

    // Trigger local autosave debounce (every 10s)
    clearTimeout(adminState.autosaveTimer);
    adminState.autosaveTimer = setTimeout(() => {
      saveEditorLocalDraft();
    }, 10000);
  };

  window.onEditorStatusToggle = (status) => {
    const pickerBox = document.getElementById('editor-schedule-picker-box');
    if (pickerBox) {
      pickerBox.style.display = status === 'scheduled' ? 'flex' : 'none';
    }
    onEditorContentChange();
  };

  window.toggleEditorPreviewMode = () => {
    const wrap = document.getElementById('editor-canvas-wrap');
    const prevCol = document.getElementById('editor-preview-column');
    if (!wrap || !prevCol) return;

    if (wrap.classList.contains('split-preview')) {
      wrap.classList.remove('split-preview');
      prevCol.style.display = 'none';
      showToast('Full writing canvas enabled.');
    } else {
      wrap.classList.add('split-preview');
      prevCol.style.display = 'flex';
      showToast('Split live preview enabled.');
    }
  };

  window.setEditorPreviewTheme = (theme) => {
    const prevSurface = document.getElementById('editor-preview-surface');
    if (!prevSurface) return;
    prevSurface.classList.remove('mode-light', 'mode-sepia', 'mode-dark');
    prevSurface.classList.add(`mode-${theme}`);
  };

  window.saveEditorLocalDraft = () => {
    const content = document.getElementById('editor-surface')?.innerHTML || '';
    const title = document.getElementById('editor-title-input')?.value || '';
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

  window.saveEditorPublish = async () => {
    const status = document.getElementById('editor-status-select')?.value || 'published';
    await saveEpisodePayload(status, true);
  };
}

/**
 * Update the Live Reader Preview container with exact reader typography
 */
function updateLivePreview() {
  const surface = document.getElementById('editor-surface');
  const preview = document.getElementById('editor-preview-surface');
  const title = document.getElementById('editor-title-input')?.value || 'Untitled Episode';
  if (!surface || !preview) return;

  preview.innerHTML = `
    <div style="font-family:var(--font-serif); border-bottom:1px solid rgba(200,155,60,0.25); padding-bottom:12px; margin-bottom:20px;">
      <div style="font-size:12px; letter-spacing:1px; text-transform:uppercase; color:var(--color-gold-warm); font-weight:700;">Rudhra Prarthana Novels</div>
      <h2 style="font-size:1.8rem; margin:6px 0 4px; color:inherit; font-weight:700;">${escapeHtml(title)}</h2>
      <div style="font-size:12px; opacity:0.75;">✍️ Rudhra Prarthana • ⏱ Just now • Protected Reading</div>
    </div>
    <div class="reader-body-content" style="font-family:var(--font-serif); font-size:1.15rem; line-height:1.9;">
      ${surface.innerHTML}
    </div>
    <div style="text-align:center; margin-top:30px; font-size:1.5rem; color:var(--color-gold);">❦</div>
  `;
}

/**
 * Calculate Word Count and Read Time
 */
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

/**
 * Dispatch API payload to create or update an episode
 */
async function saveEpisodePayload(forcedStatus, redirectAfterSave = true) {
  const title = document.getElementById('editor-title-input')?.value?.trim();
  const novelId = document.getElementById('editor-novel-select')?.value;
  const parentIdVal = document.getElementById('editor-parent-select')?.value;
  const episodeNumber = document.getElementById('editor-num-input')?.value?.trim();
  const content = document.getElementById('editor-surface')?.innerHTML?.trim();
  const status = forcedStatus || document.getElementById('editor-status-select')?.value || 'published';

  if (!title) {
    showToast('Please enter an episode title.');
    document.getElementById('editor-title-input')?.focus();
    return;
  }
  if (!content) {
    showToast('Episode story content cannot be empty.');
    return;
  }

  let scheduledAt = null;
  let timezone = 'Asia/Kolkata';

  if (status === 'scheduled') {
    const dtVal = document.getElementById('editor-sched-datetime')?.value;
    if (!dtVal) {
      showToast('Please pick a publication date and time to schedule this episode.');
      return;
    }
    scheduledAt = new Date(dtVal).toISOString();
    timezone = document.getElementById('editor-sched-timezone')?.value || 'Asia/Kolkata';
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

  const isEditing = Boolean(adminState.editingEpisode?.id);
  const endpoint = isEditing ? `/api/admin/episodes/${adminState.editingEpisode.id}` : '/api/admin/episodes';
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

    showToast(`Episode "${title}" saved as ${status}!`);
    adminState.editorDirty = false;
    localStorage.removeItem('rp_admin_editor_draft');

    if (redirectAfterSave) {
      adminState.selectedNovelId = novelId;
      switchAdminTab(status === 'scheduled' ? 'scheduler' : 'episodes');
    }
  } catch (err) {
    showToast('Error saving episode: ' + err.message);
  }
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
   HOMEPAGE SECTION MANAGEMENT
   ======================================================== */

const SECTION_TYPE_LABELS = {
  trending: 'Trending Novels',
  completed: 'Completed Novels',
  latest: 'Latest Novels',
  forum: 'Reader Forum / Discussions',
  continue_reading: 'Continue Reading Progress',
  audio: 'Audio Novels',
  author_spotlight: 'Author Spotlight',
  curated: 'Curated Collection',
  community_cta: 'Community Call-to-Action'
};

const SECTION_TYPE_ICONS = {
  trending: '🔥',
  completed: '🏆',
  latest: '✨',
  forum: '💬',
  continue_reading: '📖',
  audio: '🎧',
  author_spotlight: '✍️',
  curated: '💎',
  community_cta: '📢'
};

export async function renderHomepageManagementTab(canvas) {
  if (!canvas) {
    canvas = document.getElementById('admin-main-canvas') || document.getElementById('admin-tab-content');
  }
  if (!canvas) return;

  // Ensure sections are loaded
  if (!adminState.homepageSections || adminState.homepageSections.length === 0) {
    try {
      const res = await apiFetch('/api/admin/homepage-sections');
      const data = await res.json();
      if (data.success && data.sections) {
        adminState.homepageSections = data.sections;
      }
    } catch (err) {
      console.error('Failed to load homepage sections:', err);
    }
  }

  const sections = adminState.homepageSections || [];
  const visibleCount = sections.filter(s => s.is_visible).length;
  const hiddenCount = sections.length - visibleCount;
  const isDirty = adminState.homepageSectionsDirty === true;

  canvas.innerHTML = `
    <div class="homepage-mgmt-container">
      <!-- Header -->
      <div class="homepage-mgmt-header" style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:16px; margin-bottom:24px;">
        <div>
          <h1 class="admin-page-title" style="margin:0 0 6px;">Homepage Management</h1>
          <p class="admin-page-subtitle" style="margin:0;">Control homepage section order, visibility, titles, priority, and create custom novel collections.</p>
        </div>
        <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
          <button type="button" class="btn btn-outline btn-sm" onclick="openHomepagePreviewModal()" title="Preview how the homepage looks with this layout">
            👁️ Preview
          </button>
          <button type="button" class="btn btn-outline btn-sm" onclick="openResetOrderConfirmModal()" title="Reset order to default system configuration">
            🔄 Reset to Default
          </button>
          <button type="button" class="btn btn-gold btn-sm" onclick="openCreateSectionModal()">
            + Create Section
          </button>
        </div>
      </div>

      <!-- Unsaved Changes Alert Banner -->
      <div id="homepage-unsaved-banner" class="admin-alert-banner" style="display:${isDirty ? 'flex' : 'none'}; justify-content:space-between; align-items:center; background:#FEF3C7; border:1px solid #F59E0B; color:#92400E; padding:12px 18px; border-radius:10px; margin-bottom:20px;">
        <div style="display:flex; align-items:center; gap:10px; font-weight:600; font-size:14px;">
          <span>⚠️ You have unsaved order changes!</span>
          <span style="font-weight:400; font-size:13px; color:#78350F;">Save your changes to update the live public homepage.</span>
        </div>
        <div style="display:flex; gap:8px;">
          <button type="button" class="btn btn-outline btn-sm" style="border-color:#D97706; color:#92400E;" onclick="revertHomepageSectionOrder()">
            Discard
          </button>
          <button type="button" class="btn btn-gold btn-sm" onclick="saveHomepageSectionOrder()">
            💾 Save Order Now
          </button>
        </div>
      </div>

      <!-- Quick Summary Stats Bar -->
      <div class="admin-stats-bar" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:16px; margin-bottom:24px;">
        <div class="admin-stat-card" style="background:#FFFFFF; border:1px solid var(--color-border-light); border-radius:10px; padding:14px 18px;">
          <div style="font-size:12px; color:var(--color-text-muted); text-transform:uppercase; letter-spacing:0.5px; font-weight:600;">Total Sections</div>
          <div style="font-size:24px; font-weight:700; color:var(--color-navy-deep); margin-top:4px;">${sections.length}</div>
        </div>
        <div class="admin-stat-card" style="background:#FFFFFF; border:1px solid var(--color-border-light); border-radius:10px; padding:14px 18px;">
          <div style="font-size:12px; color:#059669; text-transform:uppercase; letter-spacing:0.5px; font-weight:600;">Visible on Homepage</div>
          <div style="font-size:24px; font-weight:700; color:#059669; margin-top:4px;">${visibleCount}</div>
        </div>
        <div class="admin-stat-card" style="background:#FFFFFF; border:1px solid var(--color-border-light); border-radius:10px; padding:14px 18px;">
          <div style="font-size:12px; color:#6B7280; text-transform:uppercase; letter-spacing:0.5px; font-weight:600;">Hidden Sections</div>
          <div style="font-size:24px; font-weight:700; color:#6B7280; margin-top:4px;">${hiddenCount}</div>
        </div>
      </div>

      <!-- Drag & Drop Instructions and Action Button -->
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:10px;">
        <div style="font-size:13px; color:var(--color-text-muted);">
          Drag cards to reorder, use <strong>Move Up</strong> / <strong>Move Down</strong>, or select a priority from the dropdown. Position <strong>#1</strong> renders at the top of the homepage.
        </div>
        ${isDirty ? `
          <button type="button" class="btn btn-gold btn-sm" onclick="saveHomepageSectionOrder()">
            💾 Save Changes
          </button>
        ` : ''}
      </div>

      <!-- Sections List -->
      <div id="homepage-sections-list" class="homepage-sections-list" style="display:flex; flex-direction:column; gap:12px;">
        ${sections.length === 0 ? `
          <div class="admin-card" style="text-align:center; padding:40px 16px;">
            <p style="color:var(--color-text-muted); margin:0 0 12px;">No homepage sections configured.</p>
            <button type="button" class="btn btn-gold btn-sm" onclick="openResetOrderConfirmModal()">Reset to Default Sections</button>
          </div>
        ` : sections.map((sec, idx) => renderHomepageSectionCard(sec, idx, sections.length)).join('')}
      </div>
    </div>

    <!-- Modal Mount Container -->
    <div id="homepage-modal-mount"></div>
  `;
}

function renderHomepageSectionCard(sec, index, total) {
  const isFirst = index === 0;
  const isLast = index === total - 1;
  const isVis = Boolean(sec.is_visible);
  const typeLabel = SECTION_TYPE_LABELS[sec.section_type] || sec.section_type;
  const typeIcon = SECTION_TYPE_ICONS[sec.section_type] || '📄';
  const isCurated = sec.section_type === 'curated';
  const customItemsCount = sec.item_count || (sec.items ? sec.items.length : 0);
  const sections = adminState.homepageSections || [];

  return `
    <div class="homepage-section-card ${!isVis ? 'is-hidden-section' : ''}" 
         data-section-key="${escapeHtml(sec.section_key)}" 
         data-index="${index}"
         draggable="true"
         ondragstart="handleSectionDragStart(event)"
         ondragover="handleSectionDragOver(event)"
         ondrop="handleSectionDrop(event)"
         ondragend="handleSectionDragEnd(event)"
         style="background:#FFFFFF; border:1px solid ${isVis ? 'var(--color-border-light)' : '#E5E7EB'}; border-left:4px solid ${isVis ? 'var(--color-gold)' : '#9CA3AF'}; border-radius:10px; padding:16px 20px; display:flex; align-items:center; gap:16px; box-shadow:0 1px 3px rgba(0,0,0,0.04); transition:all 0.15s ease;">
      
      <!-- Drag Handle -->
      <div class="homepage-drag-handle" title="Drag to reorder" style="cursor:grab; color:#9CA3AF; font-size:18px; padding:4px 6px; user-select:none;">
        ⋮⋮
      </div>

      <!-- Priority Badge & Direct Position Dropdown -->
      <div style="display:flex; flex-direction:column; align-items:center; gap:4px; flex-shrink:0;">
        <div class="homepage-priority-badge" style="min-width:40px; height:34px; border-radius:8px; background:${isVis ? 'var(--color-cream-light, #FFF8EC)' : '#F3F4F6'}; border:1px solid ${isVis ? 'var(--color-gold-light, #FDE68A)' : '#E5E7EB'}; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:13.5px; color:${isVis ? 'var(--color-navy-deep, #0B1F33)' : '#6B7280'};">
          #${index + 1}
        </div>
        <select class="form-input homepage-pos-select" style="padding:2px 4px; font-size:11px; height:24px; min-width:54px; border-radius:5px; font-weight:600; text-align:center; background:#FAF5EC; cursor:pointer;" title="Change display order position" onchange="changeSectionPriority(${index}, this.value)">
          ${sections.map((_, pIdx) => `<option value="${pIdx + 1}" ${pIdx === index ? 'selected' : ''}>#${pIdx + 1}</option>`).join('')}
        </select>
      </div>

      <!-- Section Details -->
      <div style="flex:1; min-width:0;">
        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:4px;">
          <h3 style="margin:0; font-size:16px; font-weight:700; color:var(--color-navy-deep); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
            ${escapeHtml(sec.title || sec.name)}
          </h3>
          <span style="font-size:11px; font-weight:600; padding:2px 8px; border-radius:12px; background:#F3F4F6; color:#4B5563;">
            ${typeIcon} ${escapeHtml(typeLabel)}
          </span>
          ${sec.is_system ? `
            <span style="font-size:11px; font-weight:600; padding:2px 8px; border-radius:12px; background:#EFF6FF; color:#1D4ED8; border:1px solid #DBEAFE;">
              Core Section
            </span>
          ` : `
            <span style="font-size:11px; font-weight:600; padding:2px 8px; border-radius:12px; background:#FDF2F8; color:#9D174D; border:1px solid #FCE7F3;">
              Custom Section
            </span>
          `}
          <span class="status-pill ${isVis ? 'published' : 'draft'}" style="font-size:11px; padding:2px 8px;">
            ${isVis ? '🟢 Visible' : '🔒 Hidden'}
          </span>
        </div>

        <div style="font-size:13px; color:var(--color-text-muted); display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
          ${sec.subtitle ? `<span style="max-width:320px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(sec.subtitle)}</span>` : ''}
          <span style="font-size:11px; color:#9CA3AF;">Key: <code>${escapeHtml(sec.section_key)}</code></span>
          ${sec.content_limit ? `<span style="font-size:11px; color:#9CA3AF;">Limit: <strong>${sec.content_limit}</strong></span>` : ''}
          ${isCurated ? `<span style="font-size:11px; color:#9D174D; font-weight:600;">Items: <strong>${customItemsCount}</strong> novels</span>` : ''}
        </div>
      </div>

      <!-- Quick Action Controls -->
      <div class="homepage-section-actions" style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
        <!-- Move Up -->
        <button type="button" class="btn btn-outline btn-sm" onclick="moveSectionUp(${index})" ${isFirst ? 'disabled style="opacity:0.4; cursor:not-allowed;"' : ''} title="Move Up">
          ↑
        </button>
        <!-- Move Down -->
        <button type="button" class="btn btn-outline btn-sm" onclick="moveSectionDown(${index})" ${isLast ? 'disabled style="opacity:0.4; cursor:not-allowed;"' : ''} title="Move Down">
          ↓
        </button>
        <!-- Toggle Visibility -->
        <button type="button" class="btn btn-outline btn-sm" onclick="toggleSectionVisibility('${escapeQuotes(sec.section_key)}', ${isVis ? 0 : 1})" title="${isVis ? 'Hide this section from public homepage' : 'Show this section on public homepage'}">
          ${isVis ? '👁️ Hide' : '👁️ Show'}
        </button>
        <!-- Edit -->
        <button type="button" class="btn btn-outline btn-sm" onclick="openEditSectionModal('${escapeQuotes(sec.section_key)}')" title="Edit title, subtitle, and settings">
          ✏️ Edit
        </button>
        <!-- Delete (custom sections only) -->
        ${!sec.is_system ? `
          <button type="button" class="btn btn-outline btn-sm" onclick="openDeleteSectionModal('${escapeQuotes(sec.section_key)}')" style="color:#DC2626; border-color:#FECACA;" title="Delete this custom section">
            🗑️
          </button>
        ` : `
          <button type="button" class="btn btn-outline btn-sm" disabled style="opacity:0.3; cursor:not-allowed;" title="Core system sections cannot be deleted">
            🔒
          </button>
        `}
      </div>
    </div>
  `;
}

/* ========================================================
   REORDERING ACTIONS & DRAG AND DROP
   ======================================================== */

let draggedSectionIndex = null;

window.handleSectionDragStart = (e) => {
  const card = e.currentTarget;
  draggedSectionIndex = parseInt(card.getAttribute('data-index'), 10);
  card.style.opacity = '0.5';
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', draggedSectionIndex);
};

window.handleSectionDragOver = (e) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const card = e.currentTarget;
  card.style.background = '#FEF9EE';
};

window.handleSectionDrop = (e) => {
  e.preventDefault();
  const card = e.currentTarget;
  card.style.background = '#FFFFFF';
  const targetIndex = parseInt(card.getAttribute('data-index'), 10);

  if (draggedSectionIndex !== null && draggedSectionIndex !== targetIndex) {
    const sections = [...adminState.homepageSections];
    const [moved] = sections.splice(draggedSectionIndex, 1);
    sections.splice(targetIndex, 0, moved);

    // Update sort_order numbers
    sections.forEach((sec, idx) => {
      sec.sort_order = idx + 1;
    });

    adminState.homepageSections = sections;
    adminState.homepageSectionsDirty = true;
    renderHomepageManagementTab(document.getElementById('admin-main-canvas'));
  }
};

window.handleSectionDragEnd = (e) => {
  e.currentTarget.style.opacity = '1';
  document.querySelectorAll('.homepage-section-card').forEach(c => {
    c.style.background = '#FFFFFF';
  });
  draggedSectionIndex = null;
};

window.changeSectionPriority = (fromIndex, toPriorityStr) => {
  const toPriority = parseInt(toPriorityStr, 10);
  if (isNaN(toPriority) || toPriority < 1) return;
  const targetIndex = toPriority - 1;
  if (targetIndex === fromIndex) return;

  const sections = [...adminState.homepageSections];
  if (targetIndex >= sections.length) return;

  const [moved] = sections.splice(fromIndex, 1);
  sections.splice(targetIndex, 0, moved);

  sections.forEach((sec, idx) => {
    sec.sort_order = idx + 1;
  });

  adminState.homepageSections = sections;
  adminState.homepageSectionsDirty = true;
  renderHomepageManagementTab(document.getElementById('admin-main-canvas'));
};

window.moveSectionUp = (index) => {
  if (index <= 0) return;
  const sections = [...adminState.homepageSections];
  const temp = sections[index];
  sections[index] = sections[index - 1];
  sections[index - 1] = temp;

  sections.forEach((sec, idx) => {
    sec.sort_order = idx + 1;
  });

  adminState.homepageSections = sections;
  adminState.homepageSectionsDirty = true;
  renderHomepageManagementTab(document.getElementById('admin-main-canvas'));
};

window.moveSectionDown = (index) => {
  const sections = [...adminState.homepageSections];
  if (index >= sections.length - 1) return;
  const temp = sections[index];
  sections[index] = sections[index + 1];
  sections[index + 1] = temp;

  sections.forEach((sec, idx) => {
    sec.sort_order = idx + 1;
  });

  adminState.homepageSections = sections;
  adminState.homepageSectionsDirty = true;
  renderHomepageManagementTab(document.getElementById('admin-main-canvas'));
};

window.saveHomepageSectionOrder = async () => {
  const sections = adminState.homepageSections || [];
  const orders = sections.map((sec, idx) => ({
    section_key: sec.section_key,
    sort_order: idx + 1
  }));

  try {
    const res = await apiFetch('/api/admin/homepage-sections/reorder', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orders })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      showToast(data.error || 'Failed to save order to database.');
      return;
    }

    adminState.homepageSectionsDirty = false;
    clearHomepageCache();
    showToast('Homepage order saved and published successfully! ✨');
    renderHomepageManagementTab(document.getElementById('admin-main-canvas'));
  } catch (err) {
    console.error('Failed to save order:', err);
    showToast('Network error while saving order.');
  }
};

window.revertHomepageSectionOrder = async () => {
  try {
    const res = await apiFetch('/api/admin/homepage-sections');
    const data = await res.json();
    if (data.success && data.sections) {
      adminState.homepageSections = data.sections;
    }
    adminState.homepageSectionsDirty = false;
    showToast('Changes discarded.');
    renderHomepageManagementTab(document.getElementById('admin-main-canvas'));
  } catch (err) {
    console.error('Failed to reload sections:', err);
  }
};

window.toggleSectionVisibility = async (sectionKey, isVisible) => {
  try {
    const res = await apiFetch(`/api/admin/homepage-sections/${encodeURIComponent(sectionKey)}/visibility`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_visible: isVisible })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      showToast(data.error || 'Failed to update visibility.');
      return;
    }

    // Update in-memory state
    const sec = adminState.homepageSections.find(s => s.section_key === sectionKey);
    if (sec) sec.is_visible = isVisible ? 1 : 0;

    clearHomepageCache();
    showToast(`Section "${sec ? sec.name : sectionKey}" is now ${isVisible ? 'visible' : 'hidden'} on homepage.`);
    renderHomepageManagementTab(document.getElementById('admin-main-canvas'));
  } catch (err) {
    console.error('Failed to toggle visibility:', err);
    showToast('Network error while updating visibility.');
  }
};

/* ========================================================
   MODALS: CREATE, EDIT, DELETE, RESET, PREVIEW
   ======================================================== */

window.closeHomepageModal = () => {
  const mount = document.getElementById('homepage-modal-mount');
  if (mount) mount.innerHTML = '';
};

/**
 * Create New Section Modal
 */
window.openCreateSectionModal = () => {
  const mount = document.getElementById('homepage-modal-mount');
  if (!mount) return;

  const novels = adminState.novels || [];
  const sections = adminState.homepageSections || [];

  mount.innerHTML = `
    <div class="modal-overlay open" id="homepage-create-modal" onclick="if(event.target === this) closeHomepageModal();">
      <div class="modal-card admin-modal-card" style="max-width:680px; max-height:90vh; overflow-y:auto;">
        <div class="modal-header">
          <h3 class="modal-title">+ Create Homepage Section</h3>
          <button class="modal-close-btn" onclick="closeHomepageModal()">✕</button>
        </div>
        <div class="modal-body">
          <form onsubmit="event.preventDefault(); submitCreateHomepageSectionForm();">
            <div class="admin-form-grid">
              <!-- Section Name -->
              <div class="form-group">
                <label class="form-label" for="hcs-name">Section Name (Internal) <span class="required-star">*</span></label>
                <input type="text" id="hcs-name" class="form-input" placeholder="e.g. Editors Choice Romance" required oninput="handleCreateSectionNameInput(this.value)">
                <div class="form-field-hint">Internal management identifier.</div>
              </div>

              <!-- Section Key -->
              <div class="form-group">
                <label class="form-label" for="hcs-key">Section Key (Slug) <span class="required-star">*</span></label>
                <input type="text" id="hcs-key" class="form-input" placeholder="e.g. editors_choice" required pattern="[a-z0-9_]+" title="Only lowercase letters, numbers, and underscores">
                <div class="form-field-hint">Unique database identifier (alphanumeric and underscores).</div>
              </div>

              <!-- Section Heading -->
              <div class="form-group" style="grid-column:span 2;">
                <label class="form-label" for="hcs-title">Homepage Heading (Title) <span class="required-star">*</span></label>
                <input type="text" id="hcs-title" class="form-input" placeholder="e.g. Editor's Choice — Handpicked Stories" required>
                <div class="form-field-hint">The main headline readers see on the homepage.</div>
              </div>

              <!-- Subtitle -->
              <div class="form-group" style="grid-column:span 2;">
                <label class="form-label" for="hcs-subtitle">Subtitle / Description (Optional)</label>
                <textarea id="hcs-subtitle" class="form-input" rows="2" placeholder="e.g. Specially curated romantic tales chosen by our editorial team."></textarea>
              </div>

              <!-- Section Type -->
              <div class="form-group">
                <label class="form-label" for="hcs-type">Section Type <span class="required-star">*</span></label>
                <select id="hcs-type" class="form-input" onchange="handleCreateSectionTypeChange(this.value)">
                  <option value="curated" selected>💎 Curated Collection (Admin-Selected Novels)</option>
                  <option value="trending">🔥 Trending Novels</option>
                  <option value="completed">🏆 Completed Novels</option>
                  <option value="latest">✨ Latest Novels</option>
                  <option value="audio">🎧 Audio Novels</option>
                  <option value="forum">💬 Reader Forum / Discussions</option>
                  <option value="continue_reading">📖 Continue Reading</option>
                  <option value="author_spotlight">✍️ Author Spotlight</option>
                  <option value="community_cta">📢 Community Call-to-Action</option>
                </select>
              </div>

              <!-- Display Position (Priority) -->
              <div class="form-group">
                <label class="form-label" for="hcs-position">Display Position (Priority)</label>
                <select id="hcs-position" class="form-input">
                  <option value="1">At Top (Priority #1)</option>
                  <option value="${sections.length + 1}" selected>At Bottom (Priority #${sections.length + 1})</option>
                  ${sections.map((s, idx) => `<option value="${idx + 1}">Position #${idx + 1} (Before ${escapeHtml(s.title || s.name)})</option>`).join('')}
                </select>
                <div class="form-field-hint">Initial position on the public homepage.</div>
              </div>

              <!-- Display Style -->
              <div class="form-group" id="hcs-style-group">
                <label class="form-label" for="hcs-style">Display Layout</label>
                <select id="hcs-style" class="form-input">
                  <option value="grid" selected>Grid Layout</option>
                  <option value="carousel">Carousel / Horizontal Scroll</option>
                  <option value="compact">Compact List</option>
                </select>
              </div>

              <!-- Content Limit -->
              <div class="form-group" id="hcs-limit-group">
                <label class="form-label" for="hcs-limit">Content Limit</label>
                <input type="number" id="hcs-limit" class="form-input" value="6" min="1" max="50">
                <div class="form-field-hint">Maximum items displayed in this section.</div>
              </div>

              <!-- View All Link -->
              <div class="form-group" id="hcs-link-group">
                <label class="form-label" for="hcs-link">View All Link (Optional)</label>
                <input type="text" id="hcs-link" class="form-input" placeholder="e.g. #novels or #audio" value="#novels">
                <div class="form-field-hint">Valid site route (e.g. #novels, #audio, #forum).</div>
              </div>

              <!-- Initial Visibility -->
              <div class="form-group">
                <label class="form-label" for="hcs-vis">Visibility</label>
                <select id="hcs-vis" class="form-input">
                  <option value="1" selected>🟢 Visible Immediately</option>
                  <option value="0">🔒 Hidden (Draft)</option>
                </select>
              </div>
            </div>

            <!-- Curated Collection Novel Picker -->
            <div id="hcs-curated-container" class="curated-novel-picker" style="margin-top:20px; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:10px; padding:16px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <label class="form-label" style="margin:0; font-weight:700; color:var(--color-navy-deep);">
                  Select Novels from Database (<span id="hcs-selected-count">0</span> selected)
                </label>
                <input type="text" placeholder="Search novels..." class="form-input" style="width:200px; padding:4px 10px; font-size:12px;" oninput="filterCuratedNovelPicker(this.value)">
              </div>
              <div class="novel-picker-list" style="max-height:220px; overflow-y:auto; display:flex; flex-direction:column; gap:6px;">
                ${novels.map(n => `
                  <label class="curated-novel-item" data-title="${escapeHtml(n.title.toLowerCase())}" style="display:flex; align-items:center; gap:10px; padding:8px 12px; background:#FFFFFF; border:1px solid #E2E8F0; border-radius:6px; cursor:pointer;">
                    <input type="checkbox" name="hcs-selected-novels" value="${escapeHtml(n.id)}" onchange="updateCuratedSelectedCount()">
                    <img src="${n.cover || '/default-cover.jpg'}" style="width:28px; height:38px; object-fit:cover; border-radius:4px;" alt="${escapeHtml(n.title)}">
                    <div style="flex:1; min-width:0;">
                      <div style="font-weight:600; font-size:13px; color:var(--color-navy-deep);">${escapeHtml(n.title)}</div>
                      <div style="font-size:11px; color:var(--color-text-muted);">${escapeHtml(n.genre || 'Novel')} · ${n.chaptersCount || 0} episodes</div>
                    </div>
                  </label>
                `).join('')}
              </div>
            </div>

            <!-- Error container -->
            <div id="hcs-error" style="display:none; color:#DC2626; font-size:13px; margin-top:14px; padding:8px 12px; background:#FEE2E2; border-radius:6px;"></div>

            <!-- Actions -->
            <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;">
              <button type="button" class="btn btn-outline" onclick="closeHomepageModal()">Cancel</button>
              <button type="submit" id="hcs-submit-btn" class="btn btn-gold">Create Section</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
};

window.handleCreateSectionNameInput = (val) => {
  const keyInput = document.getElementById('hcs-key');
  const titleInput = document.getElementById('hcs-title');
  if (keyInput && (!keyInput.dataset.manualEdit)) {
    keyInput.value = val.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  }
  if (titleInput && (!titleInput.dataset.manualEdit)) {
    titleInput.value = val;
  }
};

window.handleCreateSectionTypeChange = (type) => {
  const curatedContainer = document.getElementById('hcs-curated-container');
  const limitGroup = document.getElementById('hcs-limit-group');
  const styleGroup = document.getElementById('hcs-style-group');
  const linkGroup = document.getElementById('hcs-link-group');
  const linkInput = document.getElementById('hcs-link');

  // Novel picker only for curated
  if (curatedContainer) {
    curatedContainer.style.display = type === 'curated' ? 'block' : 'none';
  }

  // Single-banner / spotlight cards do not require content limits or layouts
  const isBanner = type === 'author_spotlight' || type === 'community_cta';
  if (limitGroup) limitGroup.style.display = isBanner ? 'none' : 'block';
  if (styleGroup) styleGroup.style.display = (isBanner || type === 'forum') ? 'none' : 'block';
  if (linkGroup) linkGroup.style.display = 'block';

  // Suggest default view all links
  if (linkInput) {
    if (type === 'audio') linkInput.value = '#audio';
    else if (type === 'forum') linkInput.value = '#forum';
    else if (type === 'completed') linkInput.value = '#novels?status=completed';
    else if (type === 'trending' || type === 'latest' || type === 'featured' || type === 'curated') linkInput.value = '#novels';
    else if (type === 'continue_reading') linkInput.value = '#novels?status=ongoing';
    else if (type === 'author_spotlight') linkInput.value = '#member?id=rudhra';
    else if (type === 'community_cta') linkInput.value = '#forum';
  }
};

window.updateCuratedSelectedCount = () => {
  const checked = document.querySelectorAll('input[name="hcs-selected-novels"]:checked');
  const countEl = document.getElementById('hcs-selected-count');
  if (countEl) countEl.textContent = checked.length;
};

window.filterCuratedNovelPicker = (query) => {
  const q = query.toLowerCase().trim();
  document.querySelectorAll('.curated-novel-item').forEach(item => {
    const title = item.getAttribute('data-title') || '';
    item.style.display = title.includes(q) ? 'flex' : 'none';
  });
};

window.submitCreateHomepageSectionForm = async () => {
  const name = document.getElementById('hcs-name')?.value?.trim();
  const section_key = document.getElementById('hcs-key')?.value?.trim().toLowerCase();
  const title = document.getElementById('hcs-title')?.value?.trim();
  const subtitle = document.getElementById('hcs-subtitle')?.value?.trim() || '';
  const section_type = document.getElementById('hcs-type')?.value;
  const sort_order = parseInt(document.getElementById('hcs-position')?.value || '999', 10);
  const display_style = document.getElementById('hcs-style')?.value || 'grid';
  const content_limit = parseInt(document.getElementById('hcs-limit')?.value || '6', 10);
  const view_all_link = document.getElementById('hcs-link')?.value?.trim() || '';
  const is_visible = parseInt(document.getElementById('hcs-vis')?.value || '1', 10);
  const errorEl = document.getElementById('hcs-error');
  const submitBtn = document.getElementById('hcs-submit-btn');

  if (errorEl) errorEl.style.display = 'none';

  if (!name || !section_key || !title) {
    if (errorEl) {
      errorEl.textContent = 'Please fill in all required fields (Name, Key, Title).';
      errorEl.style.display = 'block';
    }
    return;
  }

  // Validate route format if provided
  if (view_all_link && !view_all_link.startsWith('#') && !view_all_link.startsWith('/') && !view_all_link.startsWith('http')) {
    if (errorEl) {
      errorEl.textContent = 'View All Link must be a valid site route starting with # or / (e.g. #novels, #audio, #forum).';
      errorEl.style.display = 'block';
    }
    return;
  }

  // Get curated items if applicable
  const novel_ids = [];
  if (section_type === 'curated') {
    document.querySelectorAll('input[name="hcs-selected-novels"]:checked').forEach(cb => {
      novel_ids.push(cb.value);
    });
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating...';
  }

  try {
    const res = await apiFetch('/api/admin/homepage-sections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        section_key,
        name,
        title,
        subtitle,
        section_type,
        sort_order,
        display_style,
        content_limit,
        view_all_link,
        is_visible,
        novel_ids
      })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      if (errorEl) {
        errorEl.textContent = data.error || 'Failed to create homepage section.';
        errorEl.style.display = 'block';
      }
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Section';
      }
      return;
    }

    closeHomepageModal();
    clearHomepageCache();
    showToast(`Homepage section "${title}" created successfully! 🎉`);

    // Reload sections list
    const getRes = await apiFetch('/api/admin/homepage-sections');
    const getData = await getRes.json();
    if (getData.success && getData.sections) {
      adminState.homepageSections = getData.sections;
    }
    renderHomepageManagementTab(document.getElementById('admin-main-canvas'));
  } catch (err) {
    console.error('Error creating section:', err);
    if (errorEl) {
      errorEl.textContent = err.message || 'Network error while creating section.';
      errorEl.style.display = 'block';
    }
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Create Section';
    }
  }
};

/**
 * Edit Section Modal
 */
window.openEditSectionModal = (sectionKey) => {
  const sec = adminState.homepageSections.find(s => s.section_key === sectionKey);
  if (!sec) return;

  const mount = document.getElementById('homepage-modal-mount');
  if (!mount) return;

  const novels = adminState.novels || [];
  const selectedIds = new Set(sec.items ? sec.items.map(i => i.novel_id || i.id) : []);
  const isBanner = sec.section_type === 'author_spotlight' || sec.section_type === 'community_cta';

  mount.innerHTML = `
    <div class="modal-overlay open" id="homepage-edit-modal" onclick="if(event.target === this) closeHomepageModal();">
      <div class="modal-card admin-modal-card" style="max-width:680px; max-height:90vh; overflow-y:auto;">
        <div class="modal-header">
          <h3 class="modal-title">Edit Section: ${escapeHtml(sec.name || sec.title)}</h3>
          <button class="modal-close-btn" onclick="closeHomepageModal()">✕</button>
        </div>
        <div class="modal-body">
          <form onsubmit="event.preventDefault(); submitEditHomepageSectionForm('${escapeQuotes(sec.section_key)}');">
            ${sec.is_system ? `
              <div style="background:#EFF6FF; border:1px solid #DBEAFE; color:#1E40AF; padding:10px 14px; border-radius:8px; font-size:12px; margin-bottom:16px;">
                ℹ️ <strong>Core System Section:</strong> The internal key and underlying data source are protected. You can safely customize the homepage heading, subtitle, content limit, layout, and visibility.
              </div>
            ` : ''}

            <div class="admin-form-grid">
              <!-- Section Name -->
              <div class="form-group">
                <label class="form-label" for="hes-name">Section Name (Internal)</label>
                <input type="text" id="hes-name" class="form-input" value="${escapeHtml(sec.name || '')}" required>
              </div>

              <!-- Section Key (Read-only) -->
              <div class="form-group">
                <label class="form-label">Section Key</label>
                <input type="text" class="form-input" value="${escapeHtml(sec.section_key)}" disabled style="background:#F3F4F6; cursor:not-allowed;">
              </div>

              <!-- Section Heading -->
              <div class="form-group" style="grid-column:span 2;">
                <label class="form-label" for="hes-title">Homepage Heading (Title) <span class="required-star">*</span></label>
                <input type="text" id="hes-title" class="form-input" value="${escapeHtml(sec.title || '')}" required>
              </div>

              <!-- Subtitle -->
              <div class="form-group" style="grid-column:span 2;">
                <label class="form-label" for="hes-subtitle">Subtitle / Description</label>
                <textarea id="hes-subtitle" class="form-input" rows="2">${escapeHtml(sec.subtitle || '')}</textarea>
              </div>

              <!-- Display Style -->
              <div class="form-group" style="${(isBanner || sec.section_type === 'forum') ? 'display:none;' : ''}">
                <label class="form-label" for="hes-style">Display Layout</label>
                <select id="hes-style" class="form-input">
                  <option value="grid" ${sec.display_style === 'grid' ? 'selected' : ''}>Grid Layout</option>
                  <option value="carousel" ${sec.display_style === 'carousel' ? 'selected' : ''}>Carousel / Horizontal Scroll</option>
                  <option value="compact" ${sec.display_style === 'compact' ? 'selected' : ''}>Compact List</option>
                </select>
              </div>

              <!-- Content Limit -->
              <div class="form-group" style="${isBanner ? 'display:none;' : ''}">
                <label class="form-label" for="hes-limit">Content Limit</label>
                <input type="number" id="hes-limit" class="form-input" value="${sec.content_limit || 6}" min="1" max="50">
              </div>

              <!-- View All Link -->
              <div class="form-group">
                <label class="form-label" for="hes-link">View All Link</label>
                <input type="text" id="hes-link" class="form-input" value="${escapeHtml(sec.view_all_link || '')}" placeholder="e.g. #novels or #audio">
              </div>

              <!-- Visibility -->
              <div class="form-group">
                <label class="form-label" for="hes-vis">Visibility</label>
                <select id="hes-vis" class="form-input">
                  <option value="1" ${sec.is_visible ? 'selected' : ''}>🟢 Visible on Homepage</option>
                  <option value="0" ${!sec.is_visible ? 'selected' : ''}>🔒 Hidden from Readers</option>
                </select>
              </div>
            </div>

            <!-- Curated Collection Novel Picker (if curated) -->
            ${sec.section_type === 'curated' ? `
              <div class="curated-novel-picker" style="margin-top:20px; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:10px; padding:16px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                  <label class="form-label" style="margin:0; font-weight:700; color:var(--color-navy-deep);">
                    Curated Collection Novels (<span id="hes-selected-count">${selectedIds.size}</span> selected)
                  </label>
                  <input type="text" placeholder="Search novels..." class="form-input" style="width:200px; padding:4px 10px; font-size:12px;" oninput="filterEditCuratedNovelPicker(this.value)">
                </div>
                <div class="novel-picker-list" style="max-height:220px; overflow-y:auto; display:flex; flex-direction:column; gap:6px;">
                  ${novels.map(n => `
                    <label class="edit-curated-novel-item" data-title="${escapeHtml(n.title.toLowerCase())}" style="display:flex; align-items:center; gap:10px; padding:8px 12px; background:#FFFFFF; border:1px solid #E2E8F0; border-radius:6px; cursor:pointer;">
                      <input type="checkbox" name="hes-selected-novels" value="${escapeHtml(n.id)}" ${selectedIds.has(n.id) ? 'checked' : ''} onchange="updateEditCuratedSelectedCount()">
                      <img src="${n.cover || '/default-cover.jpg'}" style="width:28px; height:38px; object-fit:cover; border-radius:4px;" alt="${escapeHtml(n.title)}">
                      <div style="flex:1; min-width:0;">
                        <div style="font-weight:600; font-size:13px; color:var(--color-navy-deep);">${escapeHtml(n.title)}</div>
                        <div style="font-size:11px; color:var(--color-text-muted);">${escapeHtml(n.genre || 'Novel')} · ${n.chaptersCount || 0} episodes</div>
                      </div>
                    </label>
                  `).join('')}
                </div>
              </div>
            ` : ''}

            <!-- Error container -->
            <div id="hes-error" style="display:none; color:#DC2626; font-size:13px; margin-top:14px; padding:8px 12px; background:#FEE2E2; border-radius:6px;"></div>

            <!-- Actions -->
            <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;">
              <button type="button" class="btn btn-outline" onclick="closeHomepageModal()">Cancel</button>
              <button type="submit" id="hes-submit-btn" class="btn btn-gold">Save Changes</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
};

window.updateEditCuratedSelectedCount = () => {
  const checked = document.querySelectorAll('input[name="hes-selected-novels"]:checked');
  const countEl = document.getElementById('hes-selected-count');
  if (countEl) countEl.textContent = checked.length;
};

window.filterEditCuratedNovelPicker = (query) => {
  const q = query.toLowerCase().trim();
  document.querySelectorAll('.edit-curated-novel-item').forEach(item => {
    const title = item.getAttribute('data-title') || '';
    item.style.display = title.includes(q) ? 'flex' : 'none';
  });
};

window.submitEditHomepageSectionForm = async (sectionKey) => {
  const name = document.getElementById('hes-name')?.value?.trim();
  const title = document.getElementById('hes-title')?.value?.trim();
  const subtitle = document.getElementById('hes-subtitle')?.value?.trim() || '';
  const display_style = document.getElementById('hes-style')?.value || 'grid';
  const content_limit = parseInt(document.getElementById('hes-limit')?.value || '6', 10);
  const view_all_link = document.getElementById('hes-link')?.value?.trim() || '';
  const is_visible = parseInt(document.getElementById('hes-vis')?.value || '1', 10);
  const errorEl = document.getElementById('hes-error');
  const submitBtn = document.getElementById('hes-submit-btn');

  if (errorEl) errorEl.style.display = 'none';

  if (!name || !title) {
    if (errorEl) {
      errorEl.textContent = 'Please enter both section name and title.';
      errorEl.style.display = 'block';
    }
    return;
  }

  // Validate route format if provided
  if (view_all_link && !view_all_link.startsWith('#') && !view_all_link.startsWith('/') && !view_all_link.startsWith('http')) {
    if (errorEl) {
      errorEl.textContent = 'View All Link must be a valid site route starting with # or / (e.g. #novels, #audio, #forum).';
      errorEl.style.display = 'block';
    }
    return;
  }

  const novel_ids = [];
  document.querySelectorAll('input[name="hes-selected-novels"]:checked').forEach(cb => {
    novel_ids.push(cb.value);
  });

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';
  }

  try {
    const res = await apiFetch(`/api/admin/homepage-sections/${encodeURIComponent(sectionKey)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        title,
        subtitle,
        display_style,
        content_limit,
        view_all_link,
        is_visible,
        novel_ids
      })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      if (errorEl) {
        errorEl.textContent = data.error || 'Failed to update section.';
        errorEl.style.display = 'block';
      }
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save Changes';
      }
      return;
    }

    closeHomepageModal();
    clearHomepageCache();
    showToast(`Homepage section "${title}" updated! ✨`);

    // Reload sections list
    const getRes = await apiFetch('/api/admin/homepage-sections');
    const getData = await getRes.json();
    if (getData.success && getData.sections) {
      adminState.homepageSections = getData.sections;
    }
    renderHomepageManagementTab(document.getElementById('admin-main-canvas'));
  } catch (err) {
    console.error('Error updating section:', err);
    if (errorEl) {
      errorEl.textContent = err.message || 'Network error while updating section.';
      errorEl.style.display = 'block';
    }
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Save Changes';
    }
  }
};

/**
 * Delete Custom Section Modal
 */
window.openDeleteSectionModal = (sectionKey) => {
  const sec = adminState.homepageSections.find(s => s.section_key === sectionKey);
  if (!sec) return;

  if (sec.is_system) {
    showToast('Core system sections cannot be deleted.');
    return;
  }

  const mount = document.getElementById('homepage-modal-mount');
  if (!mount) return;

  mount.innerHTML = `
    <div class="modal-overlay open" id="homepage-delete-modal" onclick="if(event.target === this) closeHomepageModal();">
      <div class="modal-card admin-modal-card" style="max-width:480px;">
        <div class="modal-header">
          <h3 class="modal-title" style="color:#DC2626;">Delete Homepage Section?</h3>
          <button class="modal-close-btn" onclick="closeHomepageModal()">✕</button>
        </div>
        <div class="modal-body">
          <p style="margin:0 0 14px; font-size:14px; color:var(--color-navy-deep);">
            Are you sure you want to remove the section <strong>"${escapeHtml(sec.title || sec.name)}"</strong> from the homepage?
          </p>
          <div style="background:#FEF2F2; border:1px solid #FCA5A5; color:#991B1B; padding:12px; border-radius:8px; font-size:12px; margin-bottom:16px;">
            🛡️ <strong>Safety Guarantee:</strong> Deleting this section will <strong>NOT</strong> delete any novels, episodes, forum topics, or comments from the database. It only removes this section placement from the homepage.
          </div>
          <div style="display:flex; justify-content:flex-end; gap:10px;">
            <button type="button" class="btn btn-outline" onclick="closeHomepageModal()">Cancel</button>
            <button type="button" class="btn btn-gold" style="background:#DC2626; border-color:#DC2626; color:#FFF;" onclick="confirmDeleteHomepageSection('${escapeQuotes(sec.section_key)}')">
              Yes, Delete Section
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
};

window.confirmDeleteHomepageSection = async (sectionKey) => {
  try {
    const res = await apiFetch(`/api/admin/homepage-sections/${encodeURIComponent(sectionKey)}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      showToast(data.error || 'Failed to delete section.');
      return;
    }

    closeHomepageModal();
    clearHomepageCache();
    showToast('Section deleted from homepage. Database records are preserved.');

    // Reload sections list
    const getRes = await apiFetch('/api/admin/homepage-sections');
    const getData = await getRes.json();
    if (getData.success && getData.sections) {
      adminState.homepageSections = getData.sections;
    }
    renderHomepageManagementTab(document.getElementById('admin-main-canvas'));
  } catch (err) {
    console.error('Error deleting section:', err);
    showToast('Network error while deleting section.');
  }
};

/**
 * Reset to Default Order Confirmation Modal
 */
window.openResetOrderConfirmModal = () => {
  const mount = document.getElementById('homepage-modal-mount');
  if (!mount) return;

  mount.innerHTML = `
    <div class="modal-overlay open" id="homepage-reset-modal" onclick="if(event.target === this) closeHomepageModal();">
      <div class="modal-card admin-modal-card" style="max-width:480px;">
        <div class="modal-header">
          <h3 class="modal-title">Reset to Default Order?</h3>
          <button class="modal-close-btn" onclick="closeHomepageModal()">✕</button>
        </div>
        <div class="modal-body">
          <p style="margin:0 0 14px; font-size:14px; color:var(--color-navy-deep);">
            This will reset the homepage section display priority back to the standard system order:
          </p>
          <ol style="margin:0 0 16px 20px; font-size:13px; color:var(--color-text-muted); line-height:1.6;">
            <li>Featured Ongoing Novels</li>
            <li>Pick Up Where You Left Off (Continue Reading)</li>
            <li>Listen & Enjoy — Audio Novels</li>
            <li>Reader Favorites — Trending Novels</li>
            <li>Completed Works — Completed Novels</li>
            <li>Reader Discussions & Community — Reader Forum</li>
            <li>Author Spotlight</li>
            <li>Community Call-to-Action</li>
          </ol>
          <div style="display:flex; justify-content:flex-end; gap:10px;">
            <button type="button" class="btn btn-outline" onclick="closeHomepageModal()">Cancel</button>
            <button type="button" class="btn btn-gold" onclick="confirmResetHomepageOrder()">Reset Order</button>
          </div>
        </div>
      </div>
    </div>
  `;
};

window.confirmResetHomepageOrder = async () => {
  try {
    const res = await apiFetch('/api/admin/homepage-sections/reset-order', {
      method: 'POST'
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      showToast(data.error || 'Failed to reset order.');
      return;
    }

    closeHomepageModal();
    clearHomepageCache();
    adminState.homepageSectionsDirty = false;
    showToast('Homepage order reset to default system configuration! ✨');

    // Reload sections list
    const getRes = await apiFetch('/api/admin/homepage-sections');
    const getData = await getRes.json();
    if (getData.success && getData.sections) {
      adminState.homepageSections = getData.sections;
    }
    renderHomepageManagementTab(document.getElementById('admin-main-canvas'));
  } catch (err) {
    console.error('Error resetting order:', err);
    showToast('Network error while resetting order.');
  }
};

/**
 * Preview Homepage Modal
 */
window.openHomepagePreviewModal = () => {
  const mount = document.getElementById('homepage-modal-mount');
  if (!mount) return;

  const sections = adminState.homepageSections || [];
  const visibleSections = sections.filter(s => s.is_visible);
  const isDirty = adminState.homepageSectionsDirty === true;

  mount.innerHTML = `
    <div class="modal-overlay open" id="homepage-preview-modal" onclick="if(event.target === this) closeHomepageModal();">
      <div class="modal-card admin-modal-card" style="max-width:960px; max-height:90vh; overflow-y:auto; padding:24px;">
        <div class="modal-header" style="border-bottom:1px solid #E5E7EB; padding-bottom:14px; margin-bottom:16px;">
          <div>
            <div style="display:flex; align-items:center; gap:8px;">
              <h3 class="modal-title" style="margin:0;">Homepage Layout Preview</h3>
              ${isDirty ? `
                <span style="font-size:11px; font-weight:700; background:#FEF3C7; color:#92400E; border:1px solid #F59E0B; padding:2px 8px; border-radius:12px;">
                  Unsaved Draft Layout
                </span>
              ` : `
                <span style="font-size:11px; font-weight:700; background:#D1FAE5; color:#065F46; border:1px solid #A7F3D0; padding:2px 8px; border-radius:12px;">
                  Published Live Layout
                </span>
              `}
            </div>
            <div style="font-size:12px; color:var(--color-text-muted); margin-top:4px;">
              ${visibleSections.length} visible sections rendered in order. ${sections.length - visibleSections.length} hidden sections excluded.
            </div>
          </div>
          <div style="display:flex; gap:8px; align-items:center;">
            ${isDirty ? `
              <button type="button" class="btn btn-gold btn-sm" onclick="closeHomepageModal(); saveHomepageSectionOrder();">
                💾 Save & Publish Now
              </button>
            ` : ''}
            <a href="#home" target="_blank" class="btn btn-outline btn-sm">Open Live Site ↗</a>
            <button class="modal-close-btn" onclick="closeHomepageModal()">✕</button>
          </div>
        </div>

        <div class="modal-body" style="padding:0;">
          <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:10px; padding:16px; display:flex; flex-direction:column; gap:12px;">
            ${visibleSections.length === 0 ? `
              <div style="text-align:center; padding:30px; color:#6B7280;">No visible sections enabled. The homepage will appear empty.</div>
            ` : visibleSections.map((sec, idx) => `
              <div style="background:#FFFFFF; border:1px solid #E2E8F0; border-radius:8px; padding:14px 18px; display:flex; align-items:center; justify-content:space-between; box-shadow:0 1px 2px rgba(0,0,0,0.03);">
                <div style="display:flex; align-items:center; gap:12px;">
                  <span style="font-size:12px; font-weight:700; color:#1D4ED8; background:#DBEAFE; padding:4px 8px; border-radius:6px;">
                    Position #${idx + 1}
                  </span>
                  <div>
                    <div style="font-weight:700; font-size:15px; color:var(--color-navy-deep);">${escapeHtml(sec.title || sec.name)}</div>
                    <div style="font-size:12px; color:var(--color-text-muted);">${escapeHtml(sec.subtitle || SECTION_TYPE_LABELS[sec.section_type] || sec.section_type)}</div>
                  </div>
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                  <span style="font-size:12px; color:#4B5563; background:#F3F4F6; padding:3px 10px; border-radius:12px;">
                    Type: <strong>${SECTION_TYPE_LABELS[sec.section_type] || sec.section_type}</strong>
                  </span>
                  ${sec.display_style ? `<span style="font-size:11px; color:#6B7280; background:#F9FAFB; padding:2px 8px; border-radius:8px; border:1px solid #E5E7EB;">Layout: ${escapeHtml(sec.display_style)}</span>` : ''}
                </div>
              </div>
            `).join('')}
          </div>
          <div style="margin-top:16px; text-align:right;">
            <button type="button" class="btn btn-gold btn-sm" onclick="closeHomepageModal()">Done Previewing</button>
          </div>
        </div>
      </div>
    </div>
  `;
};

