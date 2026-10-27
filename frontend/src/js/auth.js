// Authentication & User Session Manager

import { showToast } from './reader.js';
import { t } from './i18n.js';
import { apiFetch } from './errors.js';
import { connectRealtimeNotificationStream, updateNotificationBadge } from './notifications.js';
import { updateUnreadMessageBadge } from './messaging.js';
import { updateAuthorWriterHeader } from './author-header.js';

window.IS_LOGGED_IN = Boolean(localStorage.getItem('rp_auth_token'));
window.CURRENT_USER = null;

export function initAuth() {
  window.openAuthModal = (view = 'login') => {
    const modal = document.getElementById('auth-modal');
    if (modal) {
      modal.classList.add('open');
      switchAuthView(view);
    }
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
      btn.innerHTML = '🙈';
      btn.setAttribute('title', 'Hide Password');
      btn.setAttribute('aria-label', 'Hide Password');
    } else {
      input.type = 'password';
      btn.innerHTML = '👁️';
      btn.setAttribute('title', 'Show Password');
      btn.setAttribute('aria-label', 'Show Password');
    }
  };

  window.switchAuthView = (view) => {
    const container = document.getElementById('auth-form-container');
    const title = document.getElementById('auth-modal-title');
    if (!container) return;

    if (view === 'login') {
      if (title) title.innerText = t('auth_login_title');
      container.innerHTML = `
        <form onsubmit="event.preventDefault(); handleLoginSubmit();">
          <div id="auth-error-msg" style="display:none; color:#EF4444; background:#FEF2F2; border:1px solid #FCA5A5; padding:8px 12px; border-radius:6px; font-size:13px; margin-bottom:12px;"></div>
          <div class="form-group">
            <label class="form-label">${t('auth_username_label')}</label>
            <input type="text" id="login-username" class="form-input" placeholder="${t('auth_username_label')}" required autocomplete="username">
          </div>
          <div class="form-group">
            <label class="form-label">${t('auth_password_label')}</label>
            <div style="position:relative; display:flex; align-items:center;">
              <input type="password" id="login-password" class="form-input" placeholder="••••••••" style="padding-right:44px;" required autocomplete="current-password">
              <button type="button" class="password-toggle-btn" onclick="togglePasswordVisibility('login-password', this)" title="Show/Hide Password" aria-label="Toggle password visibility" style="position:absolute; right:8px; background:none; border:none; cursor:pointer; font-size:18px; color:var(--color-text-muted); padding:4px 8px; line-height:1; display:flex; align-items:center; justify-content:center;">
                👁️
              </button>
            </div>
          </div>
          <div class="form-checkbox-row">
            <label class="checkbox-label">
              <input type="checkbox" checked> ${t('auth_remember_me')}
            </label>
            <a onclick="switchAuthView('forgot')" style="color:var(--color-gold-warm); cursor:pointer;">${t('auth_forgot_link')}</a>
          </div>
          <button type="submit" id="login-submit-btn" class="btn btn-gold" style="width:100%;">${t('btn_login')}</button>
          
          <div class="auth-security-note">
            <span>🔒 SSL Encrypted & Protected Session</span>
          </div>

          <div class="auth-switch-links">
            ${t('auth_no_account')} <a onclick="switchAuthView('register')">${t('auth_create_link')}</a>
          </div>
        </form>
      `;
    } else if (view === 'register') {
      if (title) title.innerText = t('auth_register_title');
      container.innerHTML = `
        <form onsubmit="event.preventDefault(); handleRegisterSubmit();">
          <div id="auth-error-msg" style="display:none; color:#EF4444; background:#FEF2F2; border:1px solid #FCA5A5; padding:8px 12px; border-radius:6px; font-size:13px; margin-bottom:12px;"></div>
          <div class="form-group">
            <label class="form-label">${t('auth_username_label')} <span style="color:#EF4444;">*</span></label>
            <input type="text" id="reg-username" class="form-input" placeholder="e.g. priya_reader" required autocomplete="username">
          </div>
          <div class="form-group">
            <label class="form-label">Display Name</label>
            <input type="text" id="reg-displayname" class="form-input" placeholder="Your display name (Optional)">
          </div>
          <div class="form-group">
            <label class="form-label">${t('auth_email_label')} <span style="color:#EF4444;">*</span></label>
            <input type="email" id="reg-email" class="form-input" placeholder="name@example.com" required autocomplete="email">
          </div>
          <div class="form-group">
            <label class="form-label">${t('auth_password_label')} <span style="color:#EF4444;">*</span></label>
            <div style="position:relative; display:flex; align-items:center;">
              <input type="password" id="reg-password" class="form-input" placeholder="••••••••" style="padding-right:44px;" required minlength="6" autocomplete="new-password">
              <button type="button" class="password-toggle-btn" onclick="togglePasswordVisibility('reg-password', this)" title="Show/Hide Password" aria-label="Toggle password visibility" style="position:absolute; right:8px; background:none; border:none; cursor:pointer; font-size:18px; color:var(--color-text-muted); padding:4px 8px; line-height:1; display:flex; align-items:center; justify-content:center;">
                👁️
              </button>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Confirm Password <span style="color:#EF4444;">*</span></label>
            <div style="position:relative; display:flex; align-items:center;">
              <input type="password" id="reg-confirm-password" class="form-input" placeholder="••••••••" style="padding-right:44px;" required minlength="6" autocomplete="new-password">
              <button type="button" class="password-toggle-btn" onclick="togglePasswordVisibility('reg-confirm-password', this)" title="Show/Hide Password" aria-label="Toggle password visibility" style="position:absolute; right:8px; background:none; border:none; cursor:pointer; font-size:18px; color:var(--color-text-muted); padding:4px 8px; line-height:1; display:flex; align-items:center; justify-content:center;">
                👁️
              </button>
            </div>
          </div>
          <div class="form-checkbox-row">
            <label class="checkbox-label">
              <input type="checkbox" checked required> ${t('footer_terms')}
            </label>
          </div>
          <button type="submit" id="register-submit-btn" class="btn btn-gold" style="width:100%;">${t('btn_register')}</button>

          <div class="auth-switch-links">
            ${t('auth_have_account')} <a onclick="switchAuthView('login')">${t('auth_login_link')}</a>
          </div>
        </form>
      `;
    } else if (view === 'forgot' || view === 'forgot-email') {
      if (title) title.innerText = t('auth_forgot_title');
      const currentEmail = window.FORGOT_STATE?.email || '';
      container.innerHTML = `
        <form onsubmit="event.preventDefault(); handleForgotRequestOtpSubmit();">
          <div id="auth-error-msg" style="display:none; color:#EF4444; background:#FEF2F2; border:1px solid #FCA5A5; padding:8px 12px; border-radius:6px; font-size:13px; margin-bottom:12px;"></div>
          <div class="form-group">
            <label class="form-label">${t('auth_email_label')} <span style="color:#EF4444;">*</span></label>
            <input type="email" id="forgot-email" class="form-input" placeholder="name@example.com" value="${currentEmail}" required autocomplete="email" autofocus>
          </div>
          <p style="font-size:12px; color:var(--color-text-muted); margin-bottom:18px; line-height:1.5;">
            ${t('auth_reset_instructions')}
          </p>
          <button type="submit" id="forgot-send-btn" class="btn btn-gold" style="width:100%;">${t('auth_send_reset_btn')}</button>

          <div class="auth-switch-links">
            <a onclick="switchAuthView('login')">${t('auth_back_to_login')}</a>
          </div>
        </form>
      `;
    } else if (view === 'forgot-otp') {
      if (title) title.innerText = t('auth_forgot_otp_title');
      const email = window.FORGOT_STATE?.email || '';
      container.innerHTML = `
        <form onsubmit="event.preventDefault(); handleForgotVerifyOtpSubmit();">
          <div id="auth-error-msg" style="display:none; color:#EF4444; background:#FEF2F2; border:1px solid #FCA5A5; padding:8px 12px; border-radius:6px; font-size:13px; margin-bottom:12px;"></div>
          <div style="font-size:13px; color:var(--color-navy-deep); margin-bottom:12px;">
            ${t('auth_forgot_instructions_otp')} <strong style="color:var(--color-gold-warm);">${email}</strong>
            <a onclick="switchAuthView('forgot-email')" style="margin-left:6px; font-size:12px; color:var(--color-text-muted); text-decoration:underline; cursor:pointer;">(${t('auth_change_email')})</a>
          </div>

          <div class="otp-inputs-row" id="otp-inputs-container">
            <input type="text" maxlength="1" class="otp-digit" id="otp-1" inputmode="numeric" pattern="[0-9]*" autofocus autocomplete="off">
            <input type="text" maxlength="1" class="otp-digit" id="otp-2" inputmode="numeric" pattern="[0-9]*" autocomplete="off">
            <input type="text" maxlength="1" class="otp-digit" id="otp-3" inputmode="numeric" pattern="[0-9]*" autocomplete="off">
            <input type="text" maxlength="1" class="otp-digit" id="otp-4" inputmode="numeric" pattern="[0-9]*" autocomplete="off">
            <input type="text" maxlength="1" class="otp-digit" id="otp-5" inputmode="numeric" pattern="[0-9]*" autocomplete="off">
            <input type="text" maxlength="1" class="otp-digit" id="otp-6" inputmode="numeric" pattern="[0-9]*" autocomplete="off">
          </div>

          <div class="otp-timer-box">
            <span>${t('auth_otp_expires_in')}</span>
            <span id="otp-timer-countdown" class="otp-countdown">⏱ 05:00</span>
          </div>

          <button type="submit" id="verify-otp-btn" class="btn btn-gold" style="width:100%; margin-bottom:10px;">
            ${t('auth_verify_otp_btn')}
          </button>

          <button type="button" id="resend-otp-btn" class="btn btn-outline" style="width:100%; font-size:13px;" onclick="handleForgotResendOtp();">
            ${t('auth_resend_otp_btn')}
          </button>

          <div class="auth-switch-links">
            <a onclick="switchAuthView('login')">${t('auth_back_to_login')}</a>
          </div>
        </form>
      `;
      setupOtpInputListeners();
      startOtpExpiryTimer();
      startOtpCooldownTimer();
    } else if (view === 'forgot-new-password') {
      if (title) title.innerText = t('auth_forgot_new_title');
      container.innerHTML = `
        <form onsubmit="event.preventDefault(); handleForgotResetPasswordSubmit();">
          <div id="auth-error-msg" style="display:none; color:#EF4444; background:#FEF2F2; border:1px solid #FCA5A5; padding:8px 12px; border-radius:6px; font-size:13px; margin-bottom:12px;"></div>
          
          <div class="form-group">
            <label class="form-label">${t('auth_new_password_label')} <span style="color:#EF4444;">*</span></label>
            <div style="position:relative; display:flex; align-items:center;">
              <input type="password" id="reset-new-password" class="form-input" placeholder="••••••••" style="padding-right:44px;" required minlength="6" autocomplete="new-password" autofocus>
              <button type="button" class="password-toggle-btn" onclick="togglePasswordVisibility('reset-new-password', this)" title="Show/Hide Password" aria-label="Toggle password visibility" style="position:absolute; right:8px; background:none; border:none; cursor:pointer; font-size:18px; color:var(--color-text-muted); padding:4px 8px; line-height:1; display:flex; align-items:center; justify-content:center;">
                👁️
              </button>
            </div>
            <small style="font-size:11px; color:var(--color-text-muted); margin-top:2px;">
              Must be at least 6 characters long.
            </small>
          </div>

          <div class="form-group">
            <label class="form-label">${t('auth_confirm_new_password_label')} <span style="color:#EF4444;">*</span></label>
            <div style="position:relative; display:flex; align-items:center;">
              <input type="password" id="reset-confirm-password" class="form-input" placeholder="••••••••" style="padding-right:44px;" required minlength="6" autocomplete="new-password">
              <button type="button" class="password-toggle-btn" onclick="togglePasswordVisibility('reset-confirm-password', this)" title="Show/Hide Password" aria-label="Toggle password visibility" style="position:absolute; right:8px; background:none; border:none; cursor:pointer; font-size:18px; color:var(--color-text-muted); padding:4px 8px; line-height:1; display:flex; align-items:center; justify-content:center;">
                👁️
              </button>
            </div>
          </div>

          <button type="submit" id="reset-password-submit-btn" class="btn btn-gold" style="width:100%; margin-top:8px;">
            ${t('auth_reset_password_btn')}
          </button>

          <div class="auth-switch-links">
            <a onclick="switchAuthView('login')">${t('auth_back_to_login')}</a>
          </div>
        </form>
      `;
    } else if (view === 'forgot-success') {
      if (title) title.innerText = 'Success!';
      const email = window.FORGOT_STATE?.email || '';
      container.innerHTML = `
        <div style="text-align:center; padding:16px 8px;">
          <div style="font-size:52px; margin-bottom:12px; line-height:1;">🎉</div>
          <h3 style="color:var(--color-navy-deep); font-size:1.3rem; margin-bottom:8px; font-family:var(--font-serif);">
            Password Reset Complete!
          </h3>
          <p style="color:var(--color-text-muted); font-size:14px; line-height:1.6; margin-bottom:24px;">
            Your account password has been updated. You can now log in using your new password.
          </p>

          <button class="btn btn-gold" style="width:100%;" onclick="switchAuthView('login'); const el = document.getElementById('login-username'); if(el) el.value = '${email}';">
            Proceed to Login ➔
          </button>
        </div>
      `;
    }
  };

  window.handleLoginSubmit = async () => {
    const usernameInput = document.getElementById('login-username');
    const passwordInput = document.getElementById('login-password');
    const submitBtn = document.getElementById('login-submit-btn');
    const errorEl = document.getElementById('auth-error-msg');
    if (errorEl) errorEl.style.display = 'none';

    const username = usernameInput?.value?.trim();
    const password = passwordInput?.value;
    if (!username || !password) return;

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
      const data = await res.json();
      if (!res.ok || !data.success) {
        const errorText = data.error || 'Login failed.';
        if (errorEl) {
          errorEl.textContent = errorText;
          errorEl.style.display = 'block';
        }
        showToast(errorText);
        return;
      }

      localStorage.setItem('rp_auth_token', data.token);
      window.CURRENT_USER = data.user;
      window.IS_LOGGED_IN = true;
      window.closeAuthModal();

      showToast('Logged in successfully! Welcome! ✨');
      updateHeaderUserArea();
      connectRealtimeNotificationStream();
      updateNotificationBadge();
      updateUnreadMessageBadge();

      // Check redirect destination (e.g. from restricted chapter or audio)
      const redirectHash = sessionStorage.getItem('rp_auth_redirect');
      if (redirectHash) {
        sessionStorage.removeItem('rp_auth_redirect');
        window.location.hash = redirectHash;
        if (window.renderAppView) window.renderAppView();
      } else if (window.renderAppView) {
        window.renderAppView();
      }
    } catch (err) {
      console.error('Login error:', err);
      const errMsg = 'Network error during login.';
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
        updateHeaderUserArea();
        connectRealtimeNotificationStream();
        updateNotificationBadge();
      } else {
        localStorage.removeItem('rp_auth_token');
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
        ${(user?.isAdmin && user?.isAuthorSession) ? `
          <button class="btn btn-gold btn-sm" onclick="window.location.hash='#admin';" style="padding:4px 10px; font-size:12px; gap:4px;" title="Author & Admin Dashboard">
            👑 Author Dashboard
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
            👑 Author & Admin Dashboard
          </button>
        ` : ''}
        <button class="btn btn-outline btn-sm" style="width:100%;" onclick="handleLogout(); closeMobileDrawer();">
          ${t('btn_logout')}
        </button>
      `;
    }
  }
}
