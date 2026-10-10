import subprocess
import time
import json
import asyncio
import websockets
import urllib.request
import base64
import os
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

artifact_dir = r"C:\Users\Harish V\.gemini\antigravity-ide\brain\b5bf7e58-27e2-42b2-bd16-ced0dd383407"
edge_path = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

proc = subprocess.Popen([
    edge_path,
    "--headless=new",
    "--remote-debugging-port=9225",
    "--window-size=1440,900",
    "http://localhost:3000/#home"
])

time.sleep(3)

async def main():
    resp = urllib.request.urlopen("http://localhost:9225/json")
    tabs = json.loads(resp.read().decode())
    target_tab = next((tab for tab in tabs if tab.get("type") == "page"), tabs[0])
    ws_url = target_tab["webSocketDebuggerUrl"]

    async with websockets.connect(ws_url, max_size=20_000_000) as ws:
        msg_id = 1
        async def send(method, params=None):
            nonlocal msg_id
            msg_id += 1
            payload = {"id": msg_id, "method": method}
            if params:
                payload["params"] = params
            await ws.send(json.dumps(payload))
            while True:
                r = await ws.recv()
                data = json.loads(r)
                if data.get("id") == msg_id:
                    return data.get("result", {})

        async def evaluate(expr):
            res = await send("Runtime.evaluate", {"expression": expr, "returnByValue": True, "awaitPromise": True})
            return res.get("result", {}).get("value")

        async def capture_screenshot(filename):
            res = await send("Page.captureScreenshot", {"format": "png"})
            img_data = base64.b64decode(res.get("data", ""))
            out_path = os.path.join(artifact_dir, filename)
            with open(out_path, "wb") as f:
                f.write(img_data)
            print(f"  [SCREENSHOT] Saved: {filename} ({len(img_data)} bytes)")
            return out_path

        await send("Page.enable")
        await send("Runtime.enable")

        print("=== 1. VERIFYING LOGIN TO FORGOT PASSWORD TRANSITION ===")
        # Open Login modal
        await evaluate("window.openAuthModal('login')")
        await asyncio.sleep(0.5)

        # Click "Forgot password?" link
        await evaluate("document.querySelector('.form-checkbox-row a').click()")
        await asyncio.sleep(0.5)

        forgot_title = await evaluate("document.getElementById('auth-modal-title').innerText")
        print(f"  Title in Forgot View: '{forgot_title}'")
        assert "Reset Password" in forgot_title or "கடவுச்சொல்" in forgot_title

        # Capture step 1: Email Input Screen
        await capture_screenshot("forgot_step1_email_input.png")

        print("\n=== 2. VERIFYING NON-EXISTENT EMAIL VALIDATION ===")
        await evaluate("""
        (async () => {
            document.getElementById('forgot-email').value = 'notregistered@example.com';
            await window.handleForgotRequestOtpSubmit();
        })()
        """)
        await asyncio.sleep(0.8)

        err_banner = await evaluate("document.getElementById('auth-error-msg')?.innerText")
        print(f"  Error banner for unregistered email: '{err_banner}'")
        assert "No registered account found" in err_banner
        print("  PASS: Unregistered email properly blocked with friendly error.")

        print("\n=== 3. REQUESTING OTP FOR REGISTERED USER (meera@novels.com) ===")
        # Clean previous cooldown for fresh test
        import sqlite3
        conn = sqlite3.connect('database.sqlite')
        conn.cursor().execute("DELETE FROM password_resets WHERE email = 'meera@novels.com'")
        conn.commit()

        await evaluate("""
        (async () => {
            document.getElementById('forgot-email').value = 'meera@novels.com';
            await window.handleForgotRequestOtpSubmit();
        })()
        """)
        await asyncio.sleep(1.0)

        # Check OTP view loaded
        otp_title = await evaluate("document.getElementById('auth-modal-title').innerText")
        print(f"  Title in OTP View: '{otp_title}'")
        assert "Verification Code" in otp_title or "சரிபார்ப்புக்" in otp_title

        # Check 6 digit inputs presence
        digit_count = await evaluate("document.querySelectorAll('#otp-inputs-container .otp-digit').length")
        assert digit_count == 6, f"Expected 6 OTP digit inputs, got {digit_count}"
        print("  PASS: 6-digit OTP input boxes present.")

        # Check countdown timer active
        timer_text = await evaluate("document.getElementById('otp-timer-countdown')?.innerText")
        print(f"  Countdown timer text: '{timer_text}'")
        assert "05:" in timer_text or "04:" in timer_text

        # Check Resend OTP cooldown
        resend_text = await evaluate("document.getElementById('resend-otp-btn')?.innerText")
        print(f"  Resend OTP cooldown status: '{resend_text}'")
        assert "Resend OTP (" in resend_text or "மீண்டும் அனுப்ப" in resend_text

        await capture_screenshot("forgot_step2_otp_screen.png")

        print("\n=== 4. TESTING INVALID OTP INPUT ===")
        await evaluate("""
        (async () => {
            for (let i = 1; i <= 6; i++) {
                document.getElementById(`otp-${i}`).value = '9';
            }
            await window.handleForgotVerifyOtpSubmit();
        })()
        """)
        await asyncio.sleep(0.8)

        invalid_err = await evaluate("document.getElementById('auth-error-msg')?.innerText")
        print(f"  Error banner on wrong OTP: '{invalid_err}'")
        assert "Invalid OTP code" in invalid_err or "attempt(s) remaining" in invalid_err
        print("  PASS: Invalid OTP shows remaining attempts error.")

        print("\n=== 5. TESTING CORRECT OTP VERIFICATION ===")
        # Read the generated OTP from .last_otp.txt
        with open('.last_otp.txt', 'r') as f:
            correct_otp = f.read().strip()
        print(f"  Entering correct OTP: {correct_otp}")

        await evaluate(f"""
        (async () => {{
            const code = '{correct_otp}';
            for (let i = 0; i < 6; i++) {{
                document.getElementById(`otp-${{i+1}}`).value = code[i];
            }}
            await window.handleForgotVerifyOtpSubmit();
        }})()
        """)
        await asyncio.sleep(1.0)

        new_pass_title = await evaluate("document.getElementById('auth-modal-title').innerText")
        print(f"  Title in New Password View: '{new_pass_title}'")
        assert "New Password" in new_pass_title or "புதிய கடவுச்சொல்" in new_pass_title
        print("  PASS: Correct OTP verified and transitioned to New Password screen.")

        await capture_screenshot("forgot_step3_new_password.png")

        print("\n=== 6. VERIFYING PASSWORD VISIBILITY TOGGLE IN NEW PASSWORD SCREEN ===")
        # Check initial type is password
        new_type = await evaluate("document.getElementById('reset-new-password').type")
        assert new_type == "password"
        # Toggle eye icon
        await evaluate("document.querySelectorAll('#auth-form-container .password-toggle-btn')[0].click()")
        await asyncio.sleep(0.2)
        new_type_toggled = await evaluate("document.getElementById('reset-new-password').type")
        assert new_type_toggled == "text"
        print("  PASS: Eye toggle switches new password visibility.")
        # Revert
        await evaluate("document.querySelectorAll('#auth-form-container .password-toggle-btn')[0].click()")

        print("\n=== 7. SUBMITTING NEW PASSWORD & VERIFYING SUCCESS ===")
        await evaluate("""
        (async () => {
            document.getElementById('reset-new-password').value = 'UpdatedPassword2026!';
            document.getElementById('reset-confirm-password').value = 'UpdatedPassword2026!';
            await window.handleForgotResetPasswordSubmit();
        })()
        """)
        await asyncio.sleep(1.0)

        success_title = await evaluate("document.getElementById('auth-modal-title').innerText")
        print(f"  Title in Success View: '{success_title}'")
        assert "Complete" in success_title or "மாற்றப்பட்டது" in success_title or "Success" in success_title

        await capture_screenshot("forgot_step4_success_screen.png")

        print("\n=== 8. LOGGING IN WITH NEWLY SET PASSWORD ===")
        # Click Proceed to Login button
        await evaluate("document.querySelector('#auth-form-container button').click()")
        await asyncio.sleep(0.5)

        # Verify email is prefilled
        login_user_val = await evaluate("document.getElementById('login-username').value")
        print(f"  Prefilled login username/email: '{login_user_val}'")
        assert login_user_val == "meera@novels.com"

        # Enter the newly set password and submit
        await evaluate("""
        (async () => {
            document.getElementById('login-password').value = 'UpdatedPassword2026!';
            await window.handleLoginSubmit();
        })()
        """)
        await asyncio.sleep(1.0)

        # Verify logged in
        is_logged_in = await evaluate("window.IS_LOGGED_IN")
        current_name = await evaluate("window.CURRENT_USER?.displayName")
        print(f"  Login result: IS_LOGGED_IN={is_logged_in}, User='{current_name}'")
        assert is_logged_in is True
        assert "Meera" in current_name
        print("  PASS: Successfully logged in with new password!")

        print("\n=== 9. VERIFYING TAMIL MODE FORGOT PASSWORD & MOBILE VIEW ===")
        # Logout
        await evaluate("window.handleLogout()")
        await asyncio.sleep(0.5)

        # Switch to Tamil
        await evaluate("window.setLanguage('ta')")
        await asyncio.sleep(0.5)

        # Set mobile viewport
        await send("Emulation.setDeviceMetricsOverride", {
            "width": 390,
            "height": 844,
            "deviceScaleFactor": 1,
            "mobile": True
        })
        await asyncio.sleep(0.5)

        # Open Forgot password in Tamil
        await evaluate("window.openAuthModal('forgot')")
        await asyncio.sleep(0.5)

        ta_title = await evaluate("document.getElementById('auth-modal-title').innerText")
        print(f"  Tamil Forgot Title: '{ta_title}'")
        assert "கடவுச்சொல்" in ta_title

        await capture_screenshot("forgot_tamil_mobile.png")
        print("  PASS: Tamil language UI and mobile responsiveness verified.")

        print("\n=======================================================")
        print("FORGOT PASSWORD FULL E2E BROWSER VALIDATION PASSED!")
        print("=======================================================")

if __name__ == '__main__':
    try:
        asyncio.run(main())
    finally:
        proc.terminate()
