// Authentication & User Session Manager

import { showToast } from './reader.js';
import { t } from './i18n.js';
import { apiFetch } from './errors.js';
import { connectRealtimeNotificationStream, updateNotificationBadge } from './notifications.js';
import { updateUnreadMessageBadge } from './messaging.js';
import { updateAuthorWriterHeader } from './author-header.js';

window.IS_LOGGED_IN = Boolean(localStorage.getItem('rp_auth_token'));
try {
  const cachedUser = localStorage.getItem('rp_user');
  window.CURRENT_USER = cachedUser ? JSON.parse(cachedUser) : null;
} catch (e) {
  window.CURRENT_USER = null;
}

export function initAuth() {
  window.requireAuthOrRedirect = (message = 'Please log in to continue.', targetRedirect = null) => {
    const token = localStorage.getItem('rp_auth_token');
    if (token && window.IS_LOGGED_IN) {
      return true;
    }

    const displayMsg = message || 'Please log in to continue.';
    try {
      sessionStorage.setItem('rp_auth_msg', displayMsg);
    } catch {}

    if (typeof window.showToast === 'function') {
      window.showToast(displayMsg);
    }

    const dest = targetRedirect || window.location.hash || '#forum';
    try {
      sessionStorage.setItem('rp_auth_redirect', dest);
    } catch {}

    const redirectParam = encodeURIComponent(dest);
    window.location.hash = `#login?redirect=${redirectParam}`;
    return false;
  };

  window.openAuthModal = (view = 'login') => {
    const modal = document.getElementById('auth-modal');
    if (modal) {
      modal.classList.add('open');
      const target = document.getElementById('auth-form-container') || document.getElementById('auth-modal-form-container');
      switchAuthView(view, target);
    } else {
      window.location.hash = view === 'register' ? '#register' : '#login';
    }
  };

  window.openLoginModal = (view = 'login') => {
    window.openAuthModal(view);
  };

  window.closeAuthModal = () => {
    const modal = document.getElementById('auth-modal');
    if (modal) modal.classList.remove('open');
  };

  window.togglePasswordVisibility = (inputId, btn) => {
    const input = document.getElementById(inputId);
    if (!input) return;
    if (input.type === 'password') {
      input.type = 'text';
      btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>`;
      btn.setAttribute('title', 'Hide Password');
      btn.setAttribute('aria-label', 'Hide Password');
    } else {
      input.type = 'password';
      btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`;
      btn.setAttribute('title', 'Show Password');
      btn.setAttribute('aria-label', 'Show Password');
    }
  };

  window.switchAuthView = (view, targetContainer = null) => {
    let container = targetContainer;
    if (!container) {
      const pageContainer = document.getElementById('auth-page-form-container');
      const modalContainer = document.getElementById('auth-form-container');
      const modal = document.getElementById('auth-modal');
      if (modal && modal.classList.contains('open')) {
        container = modalContainer || pageContainer;
      } else {
        container = pageContainer || modalContainer;
      }
    }
    if (!container) return;

    if (view === 'login') {
      container.innerHTML = `
        <div class="auth-card-body">
          <!-- 1. RP Novels Logo -->
          <div class="auth-center-logo">
            <img src="/images/logo.png" alt="RP Novels" onerror="this.src='/profile.png'">
          </div>

          <!-- 2. Member Login Heading -->
          <h2 class="auth-center-title" id="auth-modal-title">Member Login</h2>

          <!-- Minimal Subtitle -->
          <p class="auth-center-subtitle">Welcome back! Please enter your details.</p>

          <div id="auth-error-msg" class="auth-error-alert" style="display:none;"></div>

          <form onsubmit="event.preventDefault(); handleLoginSubmit();" class="auth-modal-form">
            <!-- 3. Email Address -->
            <div class="auth-form-group">
              <label class="auth-field-label" for="login-username">Email Address</label>
              <div class="auth-input-wrapper">
                <svg class="auth-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                </svg>
                <input type="text" id="login-username" class="auth-input" placeholder="name@example.com or username" required autocomplete="username">
              </div>
            </div>

            <!-- 4. Password -->
            <div class="auth-form-group">
              <label class="auth-field-label" for="login-password">Password</label>
              <div class="auth-input-wrapper has-toggle">
                <svg class="auth-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <input type="password" id="login-password" class="auth-input" placeholder="••••••••" required autocomplete="current-password">
                <button type="button" class="auth-password-toggle" onclick="togglePasswordVisibility('login-password', this)" title="Show/Hide Password" aria-label="Toggle password visibility">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>
                  </svg>
                </button>
              </div>
            </div>

            <!-- 5. Remember Me and Forgot Password (aligned horizontally) -->
            <div class="auth-options-row">
              <label class="auth-remember-row">
                <input type="checkbox" id="auth-remember-check" checked>
                <span>Remember Me</span>
              </label>
              <a href="javascript:void(0)" onclick="switchAuthView('forgot')" class="auth-forgot-link">Forgot Password?</a>
            </div>

            <!-- 6. Gold Log In button -->
            <button type="submit" id="login-submit-btn" class="btn btn-gold auth-btn-gold auth-submit-btn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><polyline points="10 17 15 12 10 7"></polyline><line x1="15" y1="12" x2="3" y2="12"></line>
              </svg>
              <span>Log In</span>
            </button>
          </form>

          <!-- 7. Divider -->
          <div class="auth-thin-divider"></div>

          <!-- 8. “New here? Register Now” -->
          <div class="auth-register-text">
            New here? <a href="javascript:void(0)" onclick="switchAuthView('register')" class="auth-gold-link">Register Now</a>
          </div>

          <!-- 9. Small clickable “Admin / Writer Login” redirect text -->
          <div class="auth-admin-redirect-wrap">
            <a href="#admin-login" onclick="closeAuthModal()" class="auth-admin-redirect-link">Admin / Writer Login &rarr;</a>
          </div>
        </div>
      `;
    } else if (view === 'register') {
      container.innerHTML = `
        <div class="auth-card-body">
          <div class="auth-center-logo">
            <img src="/images/logo.png" alt="RP Novels" onerror="this.src='/profile.png'">
          </div>
          <h2 class="auth-center-title" id="auth-modal-title">Create Account</h2>
          <p class="auth-center-subtitle">Join the Rudhra Prarthana novel community</p>

          <div id="auth-error-msg" class="auth-error-alert" style="display:none;"></div>

          <form onsubmit="event.preventDefault(); handleRegisterSubmit();" class="auth-modal-form">
            <div class="auth-form-group">
              <label class="auth-field-label">Username <span class="required-star">*</span></label>
              <div class="auth-input-wrapper">
                <svg class="auth-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
                <input type="text" id="reg-username" class="auth-input" placeholder="e.g. priya_reader" required autocomplete="username">
              </div>
            </div>

            <div class="auth-form-group">
              <label class="auth-field-label">Display Name</label>
              <div class="auth-input-wrapper">
                <svg class="auth-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
                <input type="text" id="reg-displayname" class="auth-input" placeholder="Your display name (Optional)">
              </div>
            </div>

            <div class="auth-form-group">
              <label class="auth-field-label">Email Address <span class="required-star">*</span></label>
              <div class="auth-input-wrapper">
                <svg class="auth-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                </svg>
                <input type="email" id="reg-email" class="auth-input" placeholder="name@example.com" required autocomplete="email">
              </div>
            </div>

            <div class="auth-form-group">
              <label class="auth-field-label">Password <span class="required-star">*</span></label>
              <div class="auth-input-wrapper has-toggle">
                <svg class="auth-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <input type="password" id="reg-password" class="auth-input" placeholder="••••••••" required minlength="6" autocomplete="new-password">
                <button type="button" class="auth-password-toggle" onclick="togglePasswordVisibility('reg-password', this)" title="Show/Hide Password" aria-label="Toggle password visibility">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>
                  </svg>
                </button>
              </div>
            </div>

            <div class="auth-form-group">
              <label class="auth-field-label">Confirm Password <span class="required-star">*</span></label>
              <div class="auth-input-wrapper has-toggle">
                <svg class="auth-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <input type="password" id="reg-confirm-password" class="auth-input" placeholder="••••••••" required minlength="6" autocomplete="new-password">
                <button type="button" class="auth-password-toggle" onclick="togglePasswordVisibility('reg-confirm-password', this)" title="Show/Hide Password" aria-label="Toggle password visibility">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>
                  </svg>
                </button>
              </div>
            </div>

            <button type="submit" id="register-submit-btn" class="auth-btn-gold">
              <span>Register</span>
            </button>
          </form>

          <div class="auth-thin-divider"></div>

          <div class="auth-register-text">
            Already have an account? <a href="javascript:void(0)" onclick="switchAuthView('login')" class="auth-gold-link">Log In</a>
          </div>
        </div>
      `;
    } else if (view === 'forgot' || view === 'forgot-email') {
      const currentEmail = window.FORGOT_STATE?.email || '';
      container.innerHTML = `
        <div class="auth-card-body">
          <div class="auth-center-logo">
            <img src="/images/logo.png" alt="RP Novels" onerror="this.src='/profile.png'">
          </div>
          <h2 class="auth-center-title" id="auth-modal-title">Reset Password</h2>
          <p class="auth-center-subtitle">Enter your email to receive a verification OTP</p>

          <div id="auth-error-msg" class="auth-error-alert" style="display:none;"></div>

          <form onsubmit="event.preventDefault(); handleForgotRequestOtpSubmit();" class="auth-modal-form">
            <div class="auth-form-group">
              <label class="auth-field-label">Registered Email <span class="required-star">*</span></label>
              <div class="auth-input-wrapper">
                <svg class="auth-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                </svg>
                <input type="email" id="forgot-email" class="auth-input" placeholder="name@example.com" value="${currentEmail}" required autocomplete="email" autofocus>
              </div>
            </div>

            <button type="submit" id="forgot-send-btn" class="auth-btn-gold">
              <span>Send Verification Code</span>
            </button>
          </form>

          <div class="auth-thin-divider"></div>

          <div class="auth-admin-redirect-wrap">
            <a href="javascript:void(0)" onclick="switchAuthView('login')" class="auth-admin-redirect-link">&larr; Back to Member Login</a>
          </div>
        </div>
      `;
    } else if (view === 'forgot-otp') {
      const email = window.FORGOT_STATE?.email || '';
      container.innerHTML = `
        <div class="auth-card-body">
          <div class="auth-center-logo">
            <img src="/images/logo.png" alt="RP Novels" onerror="this.src='/profile.png'">
          </div>
          <h2 class="auth-center-title" id="auth-modal-title">Verify OTP</h2>
          <p class="auth-center-subtitle">Enter the 6-digit code sent to ${email}</p>

          <div id="auth-error-msg" class="auth-error-alert" style="display:none;"></div>

          <form onsubmit="event.preventDefault(); handleForgotVerifyOtpSubmit();" class="auth-modal-form">
            <div class="otp-inputs-row" id="otp-inputs-container" style="display:flex; justify-content:center; gap:8px; margin-bottom:16px;">
              <input type="text" maxlength="1" class="otp-digit" id="otp-1" inputmode="numeric" pattern="[0-9]*" autofocus autocomplete="off">
              <input type="text" maxlength="1" class="otp-digit" id="otp-2" inputmode="numeric" pattern="[0-9]*" autocomplete="off">
              <input type="text" maxlength="1" class="otp-digit" id="otp-3" inputmode="numeric" pattern="[0-9]*" autocomplete="off">
              <input type="text" maxlength="1" class="otp-digit" id="otp-4" inputmode="numeric" pattern="[0-9]*" autocomplete="off">
              <input type="text" maxlength="1" class="otp-digit" id="otp-5" inputmode="numeric" pattern="[0-9]*" autocomplete="off">
              <input type="text" maxlength="1" class="otp-digit" id="otp-6" inputmode="numeric" pattern="[0-9]*" autocomplete="off">
            </div>

            <div class="otp-timer-box" style="text-align:center; margin:10px 0 16px;">
              <span>Expires in: </span>
              <span id="otp-timer-countdown" class="otp-countdown" style="font-weight:700; color:#B88635;">⏱ 05:00</span>
            </div>

            <button type="submit" id="verify-otp-btn" class="auth-btn-gold" style="margin-bottom:10px;">
              <span>Verify OTP &amp; Proceed</span>
            </button>

            <button type="button" id="resend-otp-btn" class="btn btn-outline" style="width:100%; border-radius:12px; height:44px;" onclick="handleForgotResendOtp();">
              <span>Resend Code</span>
            </button>
          </form>

          <div class="auth-thin-divider"></div>

          <div class="auth-admin-redirect-wrap">
            <a href="javascript:void(0)" onclick="switchAuthView('login')" class="auth-admin-redirect-link">&larr; Back to Member Login</a>
          </div>
        </div>
      `;
      setupOtpInputListeners();
      startOtpExpiryTimer();
      startOtpCooldownTimer();
    } else if (view === 'forgot-new-password') {
      container.innerHTML = `
        <div class="auth-card-body">
          <div class="auth-center-logo">
            <img src="/images/logo.png" alt="RP Novels" onerror="this.src='/profile.png'">
          </div>
          <h2 class="auth-center-title" id="auth-modal-title">New Password</h2>
          <p class="auth-center-subtitle">Create a new secure password</p>

          <div id="auth-error-msg" class="auth-error-alert" style="display:none;"></div>

          <form onsubmit="event.preventDefault(); handleForgotResetPasswordSubmit();" class="auth-modal-form">
            <div class="auth-form-group">
              <label class="auth-field-label">New Password <span class="required-star">*</span></label>
              <div class="auth-input-wrapper has-toggle">
                <svg class="auth-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <input type="password" id="reset-new-password" class="auth-input" placeholder="••••••••" required minlength="6" autocomplete="new-password" autofocus>
                <button type="button" class="auth-password-toggle" onclick="togglePasswordVisibility('reset-new-password', this)" title="Show/Hide Password" aria-label="Toggle password visibility">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>
                  </svg>
                </button>
              </div>
            </div>

            <div class="auth-form-group">
              <label class="auth-field-label">Confirm Password <span class="required-star">*</span></label>
              <div class="auth-input-wrapper has-toggle">
                <svg class="auth-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <input type="password" id="reset-confirm-password" class="auth-input" placeholder="••••••••" required minlength="6" autocomplete="new-password">
                <button type="button" class="auth-password-toggle" onclick="togglePasswordVisibility('reset-confirm-password', this)" title="Show/Hide Password" aria-label="Toggle password visibility">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>
                  </svg>
                </button>
              </div>
            </div>

            <button type="submit" id="reset-password-submit-btn" class="auth-btn-gold">
              <span>Save New Password</span>
            </button>
          </form>

          <div class="auth-thin-divider"></div>

          <div class="auth-admin-redirect-wrap">
            <a href="javascript:void(0)" onclick="switchAuthView('login')" class="auth-admin-redirect-link">&larr; Back to Member Login</a>
          </div>
        </div>
      `;
    } else if (view === 'forgot-success') {
      const email = window.FORGOT_STATE?.email || '';
      container.innerHTML = `
        <div class="auth-card-body" style="text-align:center;">
          <div class="auth-center-logo">
            <img src="/images/logo.png" alt="RP Novels" onerror="this.src='/profile.png'">
          </div>
          <div style="font-size:36px; margin-bottom:8px;">✨</div>
          <h3 class="auth-center-title">Password Reset Complete!</h3>
          <p class="auth-center-subtitle">Your account password has been updated. You can now log in using your new credentials.</p>

          <button class="auth-btn-gold" onclick="switchAuthView('login'); const el = document.getElementById('login-username'); if(el) el.value = '${email}';">
            <span>Proceed to Login &rarr;</span>
          </button>
        </div>
      `;
    }
  };

window.handleLoginSubmit = async (event) => {
    const e = event || window.event;
    const form = e?.target?.closest ? e.target.closest('form') : document.querySelector('.auth-modal-form');
    const usernameInput = form ? form.querySelector('#login-username, input[type="text"]') : document.getElementById('login-username');
    const passwordInput = form ? form.querySelector('#login-password, input[type="password"]') : document.getElementById('login-password');
    const submitBtn = form ? form.querySelector('#login-submit-btn, button[type="submit"]') : document.getElementById('login-submit-btn');
    const errorEl = form ? (form.querySelector('#auth-error-msg') || form.closest('.rp-auth-card')?.querySelector('#auth-error-msg')) : document.getElementById('auth-error-msg');
    if (errorEl) errorEl.style.display = 'none';

    const username = usernameInput?.value?.trim();
    const password = passwordInput?.value;
    if (!username || !password) {
      if (errorEl) {
        errorEl.textContent = 'Please enter both email/username and password.';
        errorEl.style.display = 'block';
      }
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.classList.add('btn-loading');
    }

    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      let data = {};
      try {
        data = await res.json();
      } catch (jsonErr) {
        data = { error: 'Invalid response from server. Please try again.' };
      }

      if (!res.ok || !data.success) {
        const errorText = data.error || (res.status === 401 ? 'Invalid email or password.' : 'Login failed. Please try again.');
        if (errorEl) {
          errorEl.textContent = errorText;
          errorEl.style.display = 'block';
        }
        showToast(errorText);
        return;
      }

      localStorage.setItem('rp_auth_token', data.token);
      if (data.user) {
        localStorage.setItem('rp_user', JSON.stringify(data.user));
      }
      window.CURRENT_USER = data.user;
      window.IS_LOGGED_IN = true;
      window.closeAuthModal();

      showToast('Logged in successfully! Welcome! ✨');
      updateHeaderUserArea();
      connectRealtimeNotificationStream();
      updateNotificationBadge();
      updateUnreadMessageBadge();

      // Check redirect destination (e.g. from restricted chapter, thread, or comment)
      const urlParams = new URLSearchParams(window.location.hash.includes('?') ? window.location.hash.split('?')[1] : '');
      const redirectFromUrl = urlParams.get('redirect');
      const redirectHash = sessionStorage.getItem('rp_auth_redirect') || (redirectFromUrl ? decodeURIComponent(redirectFromUrl) : null);
      sessionStorage.removeItem('rp_auth_redirect');
      sessionStorage.removeItem('rp_auth_msg');

      if (redirectHash && !redirectHash.startsWith('#login') && !redirectHash.startsWith('#auth') && !redirectHash.startsWith('#register')) {
        window.location.hash = redirectHash;
        if (window.renderAppView) window.renderAppView();
      } else {
        window.location.hash = '#forum';
        if (window.renderAppView) window.renderAppView();
      }
    } catch (err) {
      console.error('Login error:', err);
      const errMsg = err?.message || 'Unable to connect to the server. Please check your internet connection.';
      if (errorEl) {
        errorEl.textContent = errMsg;
        errorEl.style.display = 'block';
      }
      showToast(errMsg);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.classList.remove('btn-loading');
        submitBtn.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><polyline points="10 17 15 12 10 7"></polyline><line x1="15" y1="12" x2="3" y2="12"></line>
          </svg>
          <span>Log In</span>
        `;
      }
    }
  };

  window.handleRegisterSubmit = async () => {
    const usernameInput = document.getElementById('reg-username');
    const displayNameInput = document.getElementById('reg-displayname');
    const emailInput = document.getElementById('reg-email');
    const passwordInput = document.getElementById('reg-password');
    const confirmPasswordInput = document.getElementById('reg-confirm-password');
    const submitBtn = document.getElementById('register-submit-btn');
    const errorEl = document.getElementById('auth-error-msg');
    if (errorEl) errorEl.style.display = 'none';

    const username = usernameInput?.value?.trim();
    const displayName = displayNameInput?.value?.trim() || username;
    const email = emailInput?.value?.trim();
    const password = passwordInput?.value;
    const confirmPassword = confirmPasswordInput?.value;

    if (!username || !email || !password) return;

    if (password !== confirmPassword) {
      const errMatch = 'Passwords do not match!';
      if (errorEl) {
        errorEl.textContent = errMatch;
        errorEl.style.display = 'block';
      }
      showToast(errMatch);
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.classList.add('btn-loading');
    }

    try {
      const res = await apiFetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, displayName, email, password })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        const errorText = data.error || 'Registration failed.';
        if (errorEl) {
          errorEl.textContent = errorText;
          errorEl.style.display = 'block';
        }
        showToast(errorText);
        return;
      }

      localStorage.setItem('rp_auth_token', data.token);
      if (data.user) {
        localStorage.setItem('rp_user', JSON.stringify(data.user));
      }
      window.CURRENT_USER = data.user;
      window.IS_LOGGED_IN = true;
      window.closeAuthModal();

      showToast('Account created successfully! 🎉');
      updateHeaderUserArea();
      connectRealtimeNotificationStream();
      updateNotificationBadge();

      // Check redirect destination
      const redirectHash = sessionStorage.getItem('rp_auth_redirect');
      if (redirectHash) {
        sessionStorage.removeItem('rp_auth_redirect');
        window.location.hash = redirectHash;
        if (window.renderAppView) window.renderAppView();
      } else if (window.renderAppView) {
        window.renderAppView();
      }
    } catch (err) {
      console.error('Registration error:', err);
      const errMsg = 'Network error during registration.';
      if (errorEl) {
        errorEl.textContent = errMsg;
        errorEl.style.display = 'block';
      }
      showToast(errMsg);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.classList.remove('btn-loading');
      }
    }
  };

  // Forgot Password State & Handlers
  window.FORGOT_STATE = {
    email: '',
    resetToken: '',
    timerInterval: null,
    cooldownInterval: null,
    remainingSeconds: 300,
    cooldownRemaining: 60
  };

  function startOtpExpiryTimer() {
    if (window.FORGOT_STATE.timerInterval) {
      clearInterval(window.FORGOT_STATE.timerInterval);
    }
    const updateDisplay = () => {
      const countdownEl = document.getElementById('otp-timer-countdown');
      if (!countdownEl) return;
      const mins = Math.floor(window.FORGOT_STATE.remainingSeconds / 60);
      const secs = window.FORGOT_STATE.remainingSeconds % 60;
      countdownEl.textContent = `⏱ ${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      if (window.FORGOT_STATE.remainingSeconds <= 0) {
        clearInterval(window.FORGOT_STATE.timerInterval);
        countdownEl.textContent = 'Expired!';
        countdownEl.style.color = '#EF4444';
        const verifyBtn = document.getElementById('verify-otp-btn');
        if (verifyBtn) verifyBtn.disabled = true;
      }
    };
    updateDisplay();
    window.FORGOT_STATE.timerInterval = setInterval(() => {
      if (window.FORGOT_STATE.remainingSeconds > 0) {
        window.FORGOT_STATE.remainingSeconds--;
        updateDisplay();
      } else {
        clearInterval(window.FORGOT_STATE.timerInterval);
      }
    }, 1000);
  }

  function startOtpCooldownTimer() {
    if (window.FORGOT_STATE.cooldownInterval) {
      clearInterval(window.FORGOT_STATE.cooldownInterval);
    }
    const resendBtn = document.getElementById('resend-otp-btn');
    if (!resendBtn) return;

    const updateBtn = () => {
      const btn = document.getElementById('resend-otp-btn');
      if (!btn) return;
      if (window.FORGOT_STATE.cooldownRemaining > 0) {
        btn.disabled = true;
        btn.textContent = `Resend OTP (${window.FORGOT_STATE.cooldownRemaining}s)`;
        btn.style.opacity = '0.6';
      } else {
        btn.disabled = false;
        btn.textContent = t('auth_resend_otp_btn');
        btn.style.opacity = '1';
        clearInterval(window.FORGOT_STATE.cooldownInterval);
      }
    };
    updateBtn();
    window.FORGOT_STATE.cooldownInterval = setInterval(() => {
      if (window.FORGOT_STATE.cooldownRemaining > 0) {
        window.FORGOT_STATE.cooldownRemaining--;
        updateBtn();
      } else {
        clearInterval(window.FORGOT_STATE.cooldownInterval);
      }
    }, 1000);
  }

  function setupOtpInputListeners() {
    const inputs = document.querySelectorAll('#otp-inputs-container .otp-digit');
    if (!inputs.length) return;

    inputs.forEach((input, idx) => {
      input.addEventListener('input', (e) => {
        const val = e.target.value.replace(/\D/g, '');
        e.target.value = val ? val[val.length - 1] : '';
        if (e.target.value && idx < inputs.length - 1) {
          inputs[idx + 1].focus();
        }
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !e.target.value && idx > 0) {
          inputs[idx - 1].focus();
        }
      });

      input.addEventListener('paste', (e) => {
        e.preventDefault();
        const pasted = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '');
        if (pasted) {
          for (let i = 0; i < inputs.length && i < pasted.length; i++) {
            inputs[i].value = pasted[i];
          }
          const nextFocus = Math.min(pasted.length, inputs.length - 1);
          inputs[nextFocus].focus();
        }
      });
    });

    setTimeout(() => {
      if (inputs[0]) inputs[0].focus();
    }, 100);
  }

  window.handleForgotRequestOtpSubmit = async () => {
    const emailInput = document.getElementById('forgot-email');
    const sendBtn = document.getElementById('forgot-send-btn');
    const errorEl = document.getElementById('auth-error-msg');
    if (errorEl) errorEl.style.display = 'none';

    const email = emailInput?.value?.trim().toLowerCase();
    if (!email) return;

    if (sendBtn) {
      sendBtn.disabled = true;
      sendBtn.classList.add('btn-loading');
    }

    try {
      const res = await apiFetch('/api/auth/forgot-password/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        const errMsg = data.error || 'Failed to send OTP.';
        if (errorEl) {
          errorEl.textContent = errMsg;
          errorEl.style.display = 'block';
        }
        showToast(errMsg);
        return;
      }

      window.FORGOT_STATE.email = email;
      window.FORGOT_STATE.remainingSeconds = data.expiresInSeconds || 300;
      window.FORGOT_STATE.cooldownRemaining = data.cooldownSeconds || 60;

      showToast('Verification code sent to email! 📩');
      switchAuthView('forgot-otp');
    } catch (err) {
      console.error('Request OTP error:', err);
      const errMsg = 'Network error. Please try again.';
      if (errorEl) {
        errorEl.textContent = errMsg;
        errorEl.style.display = 'block';
      }
      showToast(errMsg);
    } finally {
      if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.classList.remove('btn-loading');
      }
    }
  };

  window.handleForgotVerifyOtpSubmit = async () => {
    const inputs = document.querySelectorAll('#otp-inputs-container .otp-digit');
    const verifyBtn = document.getElementById('verify-otp-btn');
    const errorEl = document.getElementById('auth-error-msg');
    if (errorEl) errorEl.style.display = 'none';

    let otp = '';
    inputs.forEach(input => {
      otp += input.value.trim();
    });

    if (otp.length !== 6) {
      const errMsg = 'Please enter the complete 6-digit OTP code.';
      if (errorEl) {
        errorEl.textContent = errMsg;
        errorEl.style.display = 'block';
      }
      showToast(errMsg);
      return;
    }

    if (verifyBtn) {
      verifyBtn.disabled = true;
      verifyBtn.classList.add('btn-loading');
    }

    try {
      const res = await apiFetch('/api/auth/forgot-password/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: window.FORGOT_STATE.email, otp })
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        const errMsg = data.error || 'Invalid OTP code.';
        if (errorEl) {
          errorEl.textContent = errMsg;
          errorEl.style.display = 'block';
        }
        showToast(errMsg);
        inputs.forEach(input => { input.value = ''; });
        if (inputs[0]) inputs[0].focus();
        return;
      }

      window.FORGOT_STATE.resetToken = data.resetToken;
      if (window.FORGOT_STATE.timerInterval) clearInterval(window.FORGOT_STATE.timerInterval);
      if (window.FORGOT_STATE.cooldownInterval) clearInterval(window.FORGOT_STATE.cooldownInterval);

      showToast('OTP verified successfully! ✨');
      switchAuthView('forgot-new-password');
    } catch (err) {
      console.error('Verify OTP error:', err);
      const errMsg = 'Error verifying OTP.';
      if (errorEl) {
        errorEl.textContent = errMsg;
        errorEl.style.display = 'block';
      }
      showToast(errMsg);
    } finally {
      if (verifyBtn) {
        verifyBtn.disabled = false;
        verifyBtn.classList.remove('btn-loading');
      }
    }
  };

  window.handleForgotResendOtp = async () => {
    const resendBtn = document.getElementById('resend-otp-btn');
    const errorEl = document.getElementById('auth-error-msg');
    if (errorEl) errorEl.style.display = 'none';

    if (window.FORGOT_STATE.cooldownRemaining > 0) {
      return;
    }

    if (resendBtn) {
      resendBtn.disabled = true;
      resendBtn.classList.add('btn-loading');
    }

    try {
      const res = await apiFetch('/api/auth/forgot-password/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: window.FORGOT_STATE.email })
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        const errMsg = data.error || 'Failed to resend OTP.';
        if (errorEl) {
          errorEl.textContent = errMsg;
          errorEl.style.display = 'block';
        }
        showToast(errMsg);
        return;
      }

      window.FORGOT_STATE.remainingSeconds = data.expiresInSeconds || 300;
      window.FORGOT_STATE.cooldownRemaining = data.cooldownSeconds || 60;

      const verifyBtn = document.getElementById('verify-otp-btn');
      if (verifyBtn) verifyBtn.disabled = false;
      const inputs = document.querySelectorAll('#otp-inputs-container .otp-digit');
      inputs.forEach(input => { input.value = ''; });
      if (inputs[0]) inputs[0].focus();

      startOtpExpiryTimer();
      startOtpCooldownTimer();

      showToast('New OTP code sent! 📩');
    } catch (err) {
      console.error('Resend OTP error:', err);
      showToast('Error resending OTP.');
    } finally {
      if (resendBtn) {
        resendBtn.disabled = false;
        resendBtn.classList.remove('btn-loading');
      }
    }
  };

  window.handleForgotResetPasswordSubmit = async () => {
    const newPassInput = document.getElementById('reset-new-password');
    const confirmPassInput = document.getElementById('reset-confirm-password');
    const submitBtn = document.getElementById('reset-password-submit-btn');
    const errorEl = document.getElementById('auth-error-msg');
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
      submitBtn.classList.add('btn-loading');
    }

    try {
      const res = await apiFetch('/api/auth/forgot-password/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: window.FORGOT_STATE.email,
          resetToken: window.FORGOT_STATE.resetToken,
          newPassword,
          confirmPassword
        })
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        const errMsg = data.error || 'Failed to reset password.';
        if (errorEl) {
          errorEl.textContent = errMsg;
          errorEl.style.display = 'block';
        }
        showToast(errMsg);
        return;
      }

      showToast('Password reset successfully! 🎉');
      switchAuthView('forgot-success');
    } catch (err) {
      console.error('Reset password error:', err);
      const errMsg = 'Error resetting password.';
      if (errorEl) {
        errorEl.textContent = errMsg;
        errorEl.style.display = 'block';
      }
      showToast(errMsg);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.classList.remove('btn-loading');
      }
    }
  };

  window.handleLogout = async () => {
    const token = localStorage.getItem('rp_auth_token');
    if (token) {
      try {
        await apiFetch('/api/auth/logout', {
          method: 'POST'
        });
      } catch { }
    }
    localStorage.removeItem('rp_auth_token');
    localStorage.removeItem('rp_user_role');
    localStorage.removeItem('rp_user');
    sessionStorage.clear();
    window.CURRENT_USER = null;
    window.IS_LOGGED_IN = false;
    updateHeaderUserArea();
    updateNotificationBadge();
    updateUnreadMessageBadge();
    showToast('Logged out successfully.');

    // Protect private pages against access through browser history after logout
    if (window.history.replaceState) {
      window.history.replaceState(null, '', '#forms');
    }
    window.location.hash = '#forms';

    if (window.renderAppView) window.renderAppView();

    // Prompt user with login modal per requirement
    setTimeout(() => {
      if (typeof window.openAuthModal === 'function') {
        window.openAuthModal('login');
      }
    }, 150);
  };

  window.updateProfile = async (formData) => {
    const token = localStorage.getItem('rp_auth_token');
    if (!token) {
      showToast('Please log in to edit profile.');
      return { success: false };
    }

    const saveBtn = document.getElementById('save-profile-btn');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.classList.add('btn-loading');
    }

    try {
      const res = await apiFetch('/api/user/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        const errMsg = data.error || 'Failed to update profile.';
        showToast(errMsg);
        return { success: false, error: errMsg };
      }

      window.CURRENT_USER = data.user;
      updateHeaderUserArea();
      showToast('Profile updated successfully! ✨');
      if (window.renderAppView) window.renderAppView();
      return { success: true, user: data.user };
    } catch (err) {
      console.error('Update profile error:', err);
      showToast('Network error updating profile.');
      return { success: false, error: err.message };
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.classList.remove('btn-loading');
      }
    }
  };

  window.toggleActivityStatus = async (enabled) => {
    const token = localStorage.getItem('rp_auth_token');
    if (!token) return;

    try {
      const res = await apiFetch('/api/user/activity-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ enabled })
      });
      const data = await res.json();
      if (data.success) {
        if (window.CURRENT_USER) {
          window.CURRENT_USER.activityStatusEnabled = enabled;
          try {
            localStorage.setItem('rp_user', JSON.stringify(window.CURRENT_USER));
          } catch {}
        }
        const lbl = document.getElementById('activity-status-label');
        if (lbl) {
          lbl.textContent = enabled ? 'Enabled' : 'Hidden';
          lbl.className = `activity-status-badge ${enabled ? 'enabled' : 'hidden'}`;
        }
        const iconEl = document.querySelector('.activity-status-icon');
        if (iconEl) {
          iconEl.textContent = enabled ? '🟢' : '🔒';
        }
        const descEl = document.getElementById('activity-status-desc-text');
        if (descEl) {
          descEl.textContent = enabled
            ? 'When enabled, other readers can see when you are online, your reading duration, and your current or last read story.'
            : 'When hidden, your online status, current story, duration, and last-read activity remain completely private.';
        }
        const toggle = document.getElementById('profile-activity-toggle');
        if (toggle) {
          toggle.checked = enabled;
        }

        showToast(enabled ? 'Active Status is now ON! Other members can view permitted reading activity.' : 'Active Status is now OFF! Your online status and reading activity are completely private.');

        // Dispatch live event to notify open pages/components
        window.dispatchEvent(new CustomEvent('rp:activity-status-changed', { detail: { enabled } }));
      }
    } catch (err) {
      console.warn('Failed to update activity status', err);
      showToast('Could not update activity status');
    }
  };

  checkAuthSession();
}

export async function checkAuthSession() {
  const token = localStorage.getItem('rp_auth_token');
  if (!token) {
    window.IS_LOGGED_IN = false;
    window.CURRENT_USER = null;
    return;
  }
  try {
    const res = await apiFetch('/api/auth/me');
    if (res.ok) {
      const data = await res.json();
      if (data.authenticated && data.user) {
        window.CURRENT_USER = data.user;
        window.IS_LOGGED_IN = true;
        try {
          localStorage.setItem('rp_user', JSON.stringify(data.user));
        } catch (e) {}
        updateHeaderUserArea();
        connectRealtimeNotificationStream();
        updateNotificationBadge();
        updateUnreadMessageBadge();
      } else {
        localStorage.removeItem('rp_auth_token');
        localStorage.removeItem('rp_user');
        window.IS_LOGGED_IN = false;
        window.CURRENT_USER = null;
      }
    }
  } catch (e) {
    console.warn('Auth session check failed', e);
  }
}

export function updateHeaderUserArea() {
  if (document.body.classList.contains('author-page-view')) {
    updateAuthorWriterHeader(true);
    return;
  }

  const container = document.getElementById('header-auth-container');
  const drawerContainer = document.getElementById('drawer-auth-container');

  const isGuest = !window.IS_LOGGED_IN;

  // 2. Desktop Header Auth Area
  if (container) {
    if (isGuest) {
      container.innerHTML = `
        <button class="btn btn-gold btn-sm" onclick="openAuthModal('login')">${t('btn_login')}</button>
        <button class="btn btn-outline btn-sm" onclick="openAuthModal('register')">${t('btn_register')}</button>
      `;
    } else {
      const user = window.CURRENT_USER;
      const displayName = user ? (user.displayName || user.username) : 'Member';
      const rawAvatar = user?.avatar;
      const avatar = (rawAvatar && !rawAvatar.includes('images.unsplash.com') && !rawAvatar.includes('ui-avatars.com')) ? rawAvatar : '/profile.png';
      const memberParam = user?.username || (user?.id ? String(user.id) : 'me');

      container.innerHTML = `
        <div class="user-profile-trigger" onclick="window.location.hash = '#member?id=${memberParam}';" title="View Profile">
          <img src="${avatar}" class="user-avatar-sm" alt="${displayName}" onerror="this.src='/profile.png'">
          <div style="display:flex; flex-direction:column; line-height:1.1;">
            <span class="user-name-sm">${displayName}</span>
          </div>
        </div>
        ${(user?.isAdmin || user?.role === 'Admin' || user?.isAuthorSession) ? `
          <button class="btn btn-gold btn-sm" onclick="window.location.hash='#admin';" style="padding:4px 9px; font-size:11.5px; font-weight:700; gap:3px; border-radius:6px; letter-spacing:0.3px; white-space:nowrap; flex-shrink:0;" title="Author & Admin Dashboard">
            👑 AD
          </button>
        ` : (user?.isWriter || user?.role === 'writer') ? `
          <button class="btn btn-gold btn-sm" onclick="window.location.hash='#writer';" style="padding:4px 9px; font-size:11.5px; font-weight:700; gap:3px; border-radius:6px; letter-spacing:0.3px; white-space:nowrap; flex-shrink:0;" title="Writer Workspace">
            ✍️ WD
          </button>
        ` : ''}
        <button class="action-btn" onclick="handleLogout()" title="${t('btn_logout')} (Logout)" style="width:34px; height:34px; font-size:12px;">
          ✕
        </button>
      `;
    }
  }

  // 3. Mobile Drawer Guest / User Card
  if (drawerContainer) {
    if (isGuest) {
      drawerContainer.innerHTML = `
        <div class="drawer-guest-card">
          <div class="drawer-guest-greeting">${t('guest_welcome_title')} 👋</div>
          <p class="drawer-guest-text">${t('guest_welcome_desc')}</p>
          <button class="btn btn-gold btn-sm" style="width:100%;" onclick="openAuthModal('login'); closeMobileDrawer();">
            ${t('btn_login')}
          </button>
          <button class="btn btn-outline btn-sm" style="width:100%; margin-top:8px;" onclick="openAuthModal('register'); closeMobileDrawer();">
            ${t('btn_register')}
          </button>
        </div>
      `;
    } else {
      const user = window.CURRENT_USER;
      const displayName = user ? (user.displayName || user.username) : 'Member';
      const rawAvatar = user?.avatar;
      const avatar = (rawAvatar && !rawAvatar.includes('images.unsplash.com') && !rawAvatar.includes('ui-avatars.com')) ? rawAvatar : '/profile.png';
      const memberParam = user?.username || (user?.id ? String(user.id) : 'me');

      drawerContainer.innerHTML = `
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px; padding:4px; cursor:pointer;" onclick="window.location.hash='#member?id=${memberParam}'; closeMobileDrawer();">
          <img src="${avatar}" 
               class="user-avatar-sm" style="width:40px; height:40px;" alt="${displayName}" onerror="this.src='/profile.png'">
          <div>
            <div style="font-weight:700; font-size:14px; color:var(--color-navy-deep);">${displayName}</div>
          </div>
        </div>
        ${(user?.isAdmin && user?.isAuthorSession) ? `
          <button class="btn btn-gold btn-sm" style="width:100%; margin-bottom:8px;" onclick="window.location.hash='#admin'; closeMobileDrawer();">
            👑 Author & AD
          </button>
        ` : ''}
        <button class="btn btn-outline btn-sm" style="width:100%;" onclick="handleLogout(); closeMobileDrawer();">
          ${t('btn_logout')}
        </button>
      `;
    }
  }
}


/**
 * Dedicated Full-Page Member Login View (matches reference image)
 */
export async function renderMemberLoginView(container) {
  if (window.IS_LOGGED_IN) {
    window.location.hash = '#member?id=me';
    return;
  }

  const urlParams = new URLSearchParams(window.location.hash.includes('?') ? window.location.hash.split('?')[1] : '');
  const redirectParam = urlParams.get('redirect');
  if (redirectParam) {
    try {
      sessionStorage.setItem('rp_auth_redirect', decodeURIComponent(redirectParam));
    } catch {}
  }

  const authMsg = sessionStorage.getItem('rp_auth_msg');
  // Clear one-time message so it doesn't linger across unrelated pages
  if (authMsg) {
    sessionStorage.removeItem('rp_auth_msg');
  }

  const isRegister = window.location.hash.includes('register') || window.location.hash.includes('signup');
  const isForgot = window.location.hash.includes('forgot');

  container.innerHTML = `
    <div class="auth-page-wrapper">
      <div class="auth-page-container">
        <div class="rp-auth-card">
          <div class="auth-card-accent-bar"></div>
          ${authMsg ? `
            <div class="auth-restriction-banner" style="margin:20px 24px 0 24px; padding:12px 16px; background:#FEF3C7; border:1px solid #FCD34D; border-radius:10px; color:#92400E; font-size:13.5px; font-weight:600; display:flex; align-items:center; gap:8px;">
              <span style="font-size:16px;">🔒</span>
              <span>${escapeHtml(authMsg)}</span>
            </div>
          ` : ''}
          <div id="auth-page-form-container"></div>
        </div>
      </div>
    </div>
  `;

  const targetFormContainer = document.getElementById('auth-page-form-container');
  if (isForgot) {
    window.switchAuthView('forgot', targetFormContainer);
  } else if (isRegister) {
    window.switchAuthView('register', targetFormContainer);
  } else {
    window.switchAuthView('login', targetFormContainer);
  }
}
