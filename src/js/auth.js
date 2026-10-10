// Authentication & User Role Manager

import { showToast } from './reader.js';
import { t, getLanguage } from './i18n.js';
import { apiFetch } from './errors.js';

window.CURRENT_USER_ROLE = localStorage.getItem('rp_user_role') || 'Registered Member';
window.IS_LOGGED_IN = window.CURRENT_USER_ROLE !== 'Guest';

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
    const isTa = getLanguage() === 'ta';
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
            <span>🔒 SSL Encrypted & Local Database Protected</span>
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
            <label class="form-label">${isTa ? 'காட்சிப் பெயர் (Display Name)' : 'Display Name'}</label>
            <input type="text" id="reg-displayname" class="form-input" placeholder="${isTa ? 'உங்கள் விருப்பப் பெயர்' : 'Your display name (Optional)'}">
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
            <label class="form-label">${isTa ? 'கடவுச்சொல்லை உறுதிப்படுத்துக' : 'Confirm Password'} <span style="color:#EF4444;">*</span></label>
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
              ${isTa ? 'குறைந்தது 6 எழுத்துக்கள் இருக்க வேண்டும்.' : 'Must be at least 6 characters long.'}
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
      if (title) title.innerText = isTa ? 'கடவுச்சொல் மாற்றப்பட்டது!' : 'Success!';
      const email = window.FORGOT_STATE?.email || '';
      container.innerHTML = `
        <div style="text-align:center; padding:16px 8px;">
          <div style="font-size:52px; margin-bottom:12px; line-height:1;">🎉</div>
          <h3 style="color:var(--color-navy-deep); font-size:1.3rem; margin-bottom:8px; font-family:var(--font-serif);">
            ${isTa ? 'கடவுச்சொல் வெற்றிகரமாக மாற்றப்பட்டது!' : 'Password Reset Complete!'}
          </h3>
          <p style="color:var(--color-text-muted); font-size:14px; line-height:1.6; margin-bottom:24px;">
            ${isTa ? 'உங்கள் கணக்கிற்கான புதிய கடவுச்சொல் வெற்றிகரமாகப் புதுப்பிக்கப்பட்டது. இப்போது உங்கள் புதிய கடவுச்சொல்லுடன் உள்நுழையலாம்.' : 'Your account password has been updated. You can now log in using your new password.'}
          </p>

          <button class="btn btn-gold" style="width:100%;" onclick="switchAuthView('login'); const el = document.getElementById('login-username'); if(el) el.value = '${email}';">
            ${isTa ? 'உள்நுழைய செல்லவும் ➔' : 'Proceed to Login ➔'}
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
        const errorText = data.error || (getLanguage() === 'ta' ? 'உள்நுழைவு தோல்வியடைந்தது.' : 'Login failed.');
        if (errorEl) {
          errorEl.textContent = errorText;
          errorEl.style.display = 'block';
        }
        showToast(errorText);
        return;
      }

      localStorage.setItem('rp_auth_token', data.token);
      localStorage.setItem('rp_user_role', data.user.role);
      window.CURRENT_USER = data.user;
      window.CURRENT_USER_ROLE = data.user.role;
      window.IS_LOGGED_IN = true;
      window.closeAuthModal();

      const msg = getLanguage() === 'ta' ? 'வெற்றிகரமாக உள்நுழைந்துள்ளீர்கள்! ✨' : 'Logged in successfully! Welcome! ✨';
      showToast(msg);
      updateHeaderUserArea();

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
      const errMsg = getLanguage() === 'ta' ? 'பிணையப் பிழை. மீண்டும் முயற்சிக்கவும்.' : 'Network error during login.';
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
    const isTa = getLanguage() === 'ta';
    if (errorEl) errorEl.style.display = 'none';

    const username = usernameInput?.value?.trim();
    const displayName = displayNameInput?.value?.trim() || username;
    const email = emailInput?.value?.trim();
    const password = passwordInput?.value;
    const confirmPassword = confirmPasswordInput?.value;

    if (!username || !email || !password) return;

    if (password !== confirmPassword) {
      const errMatch = isTa ? 'கடவுச்சொற்கள் பொருந்தவில்லை!' : 'Passwords do not match!';
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
        const errorText = data.error || (isTa ? 'பதிவு தோல்வியடைந்தது.' : 'Registration failed.');
        if (errorEl) {
          errorEl.textContent = errorText;
          errorEl.style.display = 'block';
        }
        showToast(errorText);
        return;
      }

      localStorage.setItem('rp_auth_token', data.token);
      localStorage.setItem('rp_user_role', data.user.role);
      window.CURRENT_USER = data.user;
      window.CURRENT_USER_ROLE = data.user.role;
      window.IS_LOGGED_IN = true;
      window.closeAuthModal();

      const msg = isTa ? 'உங்கள் கணக்கு உருவாக்கப்பட்டது! 🎉' : 'Account created successfully! 🎉';
      showToast(msg);
      updateHeaderUserArea();

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
      const errMsg = isTa ? 'பிணையப் பிழை. மீண்டும் முயற்சிக்கவும்.' : 'Network error during registration.';
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
        countdownEl.textContent = getLanguage() === 'ta' ? 'காலாவதியாகிவிட்டது!' : 'Expired!';
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
    const isTa = getLanguage() === 'ta';

    const updateBtn = () => {
      const btn = document.getElementById('resend-otp-btn');
      if (!btn) return;
      if (window.FORGOT_STATE.cooldownRemaining > 0) {
        btn.disabled = true;
        btn.textContent = isTa 
          ? `மீண்டும் அனுப்ப (${window.FORGOT_STATE.cooldownRemaining}வி)` 
          : `Resend OTP (${window.FORGOT_STATE.cooldownRemaining}s)`;
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
    const isTa = getLanguage() === 'ta';
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
        const errMsg = isTa && data.errorTa ? data.errorTa : (data.error || 'Failed to send OTP.');
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

      const successMsg = isTa ? 'சரிபார்ப்புக் குறியீடு அனுப்பப்பட்டது! 📩' : 'Verification code sent to email! 📩';
      showToast(successMsg);
      switchAuthView('forgot-otp');
    } catch (err) {
      console.error('Request OTP error:', err);
      const errMsg = isTa ? 'பிணையப் பிழை. மீண்டும் முயற்சிக்கவும்.' : 'Network error. Please try again.';
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
    const isTa = getLanguage() === 'ta';
    if (errorEl) errorEl.style.display = 'none';

    let otp = '';
    inputs.forEach(input => {
      otp += input.value.trim();
    });

    if (otp.length !== 6) {
      const errMsg = isTa ? 'முழுமையான 6 இலக்க OTP குறியீட்டை உள்ளிடவும்.' : 'Please enter the complete 6-digit OTP code.';
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
        const errMsg = isTa && data.errorTa ? data.errorTa : (data.error || 'Invalid OTP code.');
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

      showToast(isTa ? 'OTP சரிபார்க்கப்பட்டது! ✨' : 'OTP verified successfully! ✨');
      switchAuthView('forgot-new-password');
    } catch (err) {
      console.error('Verify OTP error:', err);
      const errMsg = isTa ? 'சரிபார்ப்பில் பிழை ஏற்பட்டது.' : 'Error verifying OTP.';
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
    const isTa = getLanguage() === 'ta';
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
        const errMsg = isTa && data.errorTa ? data.errorTa : (data.error || 'Failed to resend OTP.');
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

      showToast(isTa ? 'புதிய OTP குறியீடு அனுப்பப்பட்டது! 📩' : 'New OTP code sent! 📩');
    } catch (err) {
      console.error('Resend OTP error:', err);
      showToast(isTa ? 'மீண்டும் அனுப்புவதில் பிழை.' : 'Error resending OTP.');
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
    const isTa = getLanguage() === 'ta';
    if (errorEl) errorEl.style.display = 'none';

    const newPassword = newPassInput?.value;
    const confirmPassword = confirmPassInput?.value;

    if (!newPassword || newPassword.length < 6) {
      const errMsg = isTa ? 'கடவுச்சொல் குறைந்தது 6 எழுத்துகள் கொண்டதாக இருக்க வேண்டும்.' : 'Password must be at least 6 characters long.';
      if (errorEl) {
        errorEl.textContent = errMsg;
        errorEl.style.display = 'block';
      }
      showToast(errMsg);
      return;
    }

    if (newPassword !== confirmPassword) {
      const errMsg = isTa ? 'கடவுச்சொற்கள் பொருந்தவில்லை!' : 'Passwords do not match!';
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
        const errMsg = isTa && data.errorTa ? data.errorTa : (data.error || 'Failed to reset password.');
        if (errorEl) {
          errorEl.textContent = errMsg;
          errorEl.style.display = 'block';
        }
        showToast(errMsg);
        return;
      }

      showToast(isTa ? 'கடவுச்சொல் மாற்றப்பட்டது! 🎉' : 'Password reset successfully! 🎉');
      switchAuthView('forgot-success');
    } catch (err) {
      console.error('Reset password error:', err);
      const errMsg = isTa ? 'கடவுச்சொல்லை மாற்றுவதில் பிழை.' : 'Error resetting password.';
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
      } catch {}
    }
    localStorage.removeItem('rp_auth_token');
    window.CURRENT_USER = null;
    window.setUserRole('Guest');
    const msg = getLanguage() === 'ta' ? 'வெளியேறிவிட்டீர்கள்.' : 'Logged out successfully.';
    showToast(msg);
  };

  window.updateProfile = async (formData) => {
    const token = localStorage.getItem('rp_auth_token');
    const isTa = getLanguage() === 'ta';
    if (!token) {
      showToast(isTa ? 'தயவுசெய்து உள்நுழையவும்.' : 'Please log in to edit profile.');
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
        const errMsg = data.error || (isTa ? 'சுயவிவரத்தைப் புதுப்பிக்க முடியவில்லை.' : 'Failed to update profile.');
        showToast(errMsg);
        return { success: false, error: errMsg };
      }

      window.CURRENT_USER = data.user;
      updateHeaderUserArea();
      showToast(isTa ? 'சுயவிவரம் வெற்றிகரமாக புதுப்பிக்கப்பட்டது! ✨' : 'Profile updated successfully! ✨');
      if (window.renderAppView) window.renderAppView();
      return { success: true, user: data.user };
    } catch (err) {
      console.error('Update profile error:', err);
      showToast(isTa ? 'பிணையப் பிழை ஏற்பட்டது.' : 'Network error updating profile.');
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
    const isTa = getLanguage() === 'ta';
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
        }
        const lbl = document.getElementById('activity-status-label');
        if (lbl) {
          lbl.textContent = enabled ? (isTa ? 'செயலில்' : 'Enabled') : (isTa ? 'மறைக்கப்பட்டது' : 'Hidden');
        }
        showToast(enabled ? (isTa ? 'செயல்பாடு நிலை இயக்கப்பட்டது 🟢' : 'Activity status enabled 🟢') : (isTa ? 'செயல்பாடு நிலை மறைக்கப்பட்டது 🔒' : 'Activity status hidden 🔒'));
      }
    } catch (err) {
      console.warn('Failed to update activity status', err);
    }
  };

  window.setUserRole = setUserRole;
  checkAuthSession();
}

export async function checkAuthSession() {
  const token = localStorage.getItem('rp_auth_token');
  if (!token) {
    if (!localStorage.getItem('rp_user_role')) {
      window.CURRENT_USER_ROLE = 'Guest';
      window.IS_LOGGED_IN = false;
    }
    return;
  }
  try {
    const res = await apiFetch('/api/auth/me');
    if (res.ok) {
      const data = await res.json();
      if (data.authenticated && data.user) {
        window.CURRENT_USER = data.user;
        window.CURRENT_USER_ROLE = data.user.role;
        window.IS_LOGGED_IN = true;
        updateHeaderUserArea();
      } else {
        localStorage.removeItem('rp_auth_token');
      }
    }
  } catch (e) {
    console.warn('Auth session check failed', e);
  }
}

export function setUserRole(role) {
  window.CURRENT_USER_ROLE = role;
  window.IS_LOGGED_IN = role !== 'Guest';
  localStorage.setItem('rp_user_role', role);
  
  // Update all role select dropdowns in announcement bar & mobile drawer
  document.querySelectorAll('.role-select').forEach(select => {
    select.value = role;
  });

  updateHeaderUserArea();
  const isTa = getLanguage() === 'ta';
  let roleToast = '';
  if (role === 'Admin' || role === 'Moderator') {
    roleToast = isTa ? 'அணுகல் புதுப்பிக்கப்பட்டது' : 'Access updated';
  } else if (role === 'Guest') {
    roleToast = isTa ? 'விருந்தினர் பயன்முறை' : 'Switched to Guest mode';
  } else if (role === 'Author') {
    roleToast = isTa ? 'எழுத்தாளர் பயன்முறை' : 'Switched to Author mode';
  } else {
    roleToast = isTa ? 'உறுப்பினர் பயன்முறை' : 'Switched to Member mode';
  }
  showToast(roleToast);

  // Re-render current app view to apply any role permissions
  if (window.renderAppView) {
    window.renderAppView();
  }

  if (window.updateNotificationBadge) {
    window.updateNotificationBadge();
  }
}
window.setUserRole = setUserRole;

export function updateHeaderUserArea() {
  const container = document.getElementById('header-auth-container');
  const drawerContainer = document.getElementById('drawer-auth-container');
  const topTicker = document.getElementById('top-ticker-content');
  const adminLinks = document.querySelectorAll('.admin-only-link');

  const isGuest = !window.IS_LOGGED_IN || window.CURRENT_USER_ROLE === 'Guest';
  const isTa = getLanguage() === 'ta';

  // Synchronize any role select dropdowns
  document.querySelectorAll('.role-select').forEach(select => {
    select.value = window.CURRENT_USER_ROLE;
  });

  let roleBadge = '';
  if (window.CURRENT_USER_ROLE !== 'Admin' && window.CURRENT_USER_ROLE !== 'Moderator') {
    roleBadge = isTa 
      ? (window.CURRENT_USER_ROLE === 'Author' ? 'எழுத்தாளர்' : 'உறுப்பினர்')
      : (window.CURRENT_USER_ROLE === 'Author' ? 'Author' : 'Member');
  }

  // Admin link visibility (preserve permissions)
  adminLinks.forEach(link => {
    link.style.display = window.CURRENT_USER_ROLE === 'Admin' ? 'flex' : 'none';
  });

  // 1. Top Ticker Content (Desktop only)
  if (topTicker) {
    if (isGuest) {
      topTicker.innerHTML = `
        <span class="announcement-badge">${t('welcome_badge')}</span>
        <div class="guest-top-welcome">
          <span>${t('guest_welcome_banner')}</span>
          <button class="guest-top-btn" onclick="openAuthModal('login')">${t('btn_login')}</button>
        </div>
      `;
    } else {
      topTicker.innerHTML = `
        <span class="announcement-badge">${t('announcement_badge')}</span>
        <a href="#reader?novel=nenjam-marappadhillai&ch=24" style="color:var(--color-parchment); text-decoration:none;">
          ${isTa ? "ருத்ரா பிரார்த்தனாவின் 'நெஞ்சம் மறப்பதில்லை' அத்தியாயம் 24 வெளியானது! ➔" : "Rudhra Prarthana's 'Nenjam Marappadhillai' Chapter 24 is now live! ➔"}
        </a>
      `;
    }
  }

  // 2. Desktop Header Auth Area
  if (container) {
    if (isGuest) {
      container.innerHTML = `
        <button class="btn btn-gold btn-sm" onclick="openAuthModal('login')">${t('btn_login')}</button>
        <button class="btn btn-outline btn-sm" onclick="openAuthModal('register')">${t('btn_register')}</button>
      `;
    } else {
      const user = window.CURRENT_USER;
      const displayName = user 
        ? (isTa ? (user.displayNameTa || user.displayName || user.username) : (user.displayName || user.username))
        : (isTa ? 'பயனர்' : 'Member');
      const rawAvatar = user?.avatar;
      const avatar = (rawAvatar && !rawAvatar.includes('images.unsplash.com') && !rawAvatar.includes('ui-avatars.com')) ? rawAvatar : '/profile.png';
      const memberParam = user?.username || (user?.id ? String(user.id) : 'me');
      const roleBadgeHtml = roleBadge 
        ? `<span class="user-role-badge" style="font-size:9px; color:var(--color-gold-warm); font-weight:700;">${roleBadge}</span>`
        : '';
      container.innerHTML = `
        <div class="user-profile-trigger" onclick="window.location.hash = '#member?id=${memberParam}';">
          <img src="${avatar}" class="user-avatar-sm" alt="${displayName}" onerror="this.src='/profile.png'">
          <div style="display:flex; flex-direction:column; line-height:1.1;">
            <span class="user-name-sm">${displayName}</span>
            ${roleBadgeHtml}
          </div>
        </div>
        <button class="action-btn" onclick="handleLogout()" title="${t('btn_logout')}" style="width:34px; height:34px; font-size:12px;">
          ✕
        </button>
      `;
    }
  }

  // 3. Mobile Drawer Guest / User Card (With Role Switcher)
  if (drawerContainer) {
    const roleSwitcherHtml = `
      <div class="drawer-role-switcher" style="display:flex; align-items:center; justify-content:space-between; margin-top:10px; padding-top:8px; border-top:1px solid rgba(0,0,0,0.08); font-size:12px;">
        <span style="font-weight:600; color:var(--color-navy-deep);">${isTa ? 'பார்வை:' : 'View As:'}</span>
        <select class="role-select" style="background:#fff; color:var(--color-navy-deep); border:1px solid var(--color-border); padding:3px 8px; border-radius:var(--radius-sm); font-size:11px; cursor:pointer;" onchange="setUserRole(this.value)">
          <option value="Guest" ${window.CURRENT_USER_ROLE === 'Guest' ? 'selected' : ''}>${isTa ? 'விருந்தினர்' : 'Guest'}</option>
          <option value="Registered Member" ${window.CURRENT_USER_ROLE === 'Registered Member' ? 'selected' : ''}>${isTa ? 'உறுப்பினர்' : 'Member'}</option>
          <option value="Author" ${window.CURRENT_USER_ROLE === 'Author' ? 'selected' : ''}>${isTa ? 'எழுத்தாளர்' : 'Author'}</option>
          <option value="Moderator" ${window.CURRENT_USER_ROLE === 'Moderator' ? 'selected' : ''}>Moderator</option>
          <option value="Admin" ${window.CURRENT_USER_ROLE === 'Admin' ? 'selected' : ''}>Admin</option>
        </select>
      </div>
    `;

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
          ${roleSwitcherHtml}
        </div>
      `;
    } else {
      const user = window.CURRENT_USER;
      const displayName = user 
        ? (isTa ? (user.displayNameTa || user.displayName || user.username) : (user.displayName || user.username))
        : (isTa ? 'பயனர்' : 'Member');
      const rawAvatar = user?.avatar;
      const avatar = (rawAvatar && !rawAvatar.includes('images.unsplash.com') && !rawAvatar.includes('ui-avatars.com')) ? rawAvatar : '/profile.png';
      const memberParam = user?.username || (user?.id ? String(user.id) : 'me');
      const drawerRoleBadgeHtml = roleBadge 
        ? `<div style="font-size:11px; color:var(--color-gold-warm); font-weight:700;">${roleBadge}</div>`
        : '';
      drawerContainer.innerHTML = `
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px; padding:4px; cursor:pointer;" onclick="window.location.hash='#member?id=${memberParam}'; closeMobileDrawer();">
          <img src="${avatar}" 
               class="user-avatar-sm" style="width:40px; height:40px;" alt="${displayName}" onerror="this.src='/profile.png'">
          <div>
            <div style="font-weight:700; font-size:14px; color:var(--color-navy-deep);">${displayName}</div>
            ${drawerRoleBadgeHtml}
          </div>
        </div>
        <button class="btn btn-outline btn-sm" style="width:100%;" onclick="handleLogout(); closeMobileDrawer();">
          ${t('btn_logout')}
        </button>
        ${roleSwitcherHtml}
      `;
    }
  }
}
