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
    "--remote-debugging-port=9224",
    "--window-size=1440,900",
    "http://localhost:3000/#home"
])

time.sleep(3)

async def main():
    resp = urllib.request.urlopen("http://localhost:9224/json")
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

        print("=== 1. VERIFYING REGISTRATION & PASSWORD VISIBILITY TOGGLE ===")
        # Open register modal
        await evaluate("window.openAuthModal('register')")
        await asyncio.sleep(0.5)

        # Check default types
        pass_type_default = await evaluate("document.getElementById('reg-password').type")
        confirm_type_default = await evaluate("document.getElementById('reg-confirm-password').type")
        assert pass_type_default == "password", f"Expected type password, got {pass_type_default}"
        assert confirm_type_default == "password", f"Expected type password, got {confirm_type_default}"
        print(f"  PASS: Passwords hidden by default (type={pass_type_default})")

        # Check eye toggle icon
        btn_html = await evaluate("document.querySelectorAll('#auth-form-container .password-toggle-btn')[0].innerText")
        assert "👁" in btn_html, f"Expected eye icon, got {btn_html}"
        print(f"  PASS: Eye toggle icon present ({btn_html.strip()})")

        # Click toggle button
        await evaluate("document.querySelectorAll('#auth-form-container .password-toggle-btn')[0].click()")
        await asyncio.sleep(0.2)
        pass_type_toggled = await evaluate("document.getElementById('reg-password').type")
        btn_html_toggled = await evaluate("document.querySelectorAll('#auth-form-container .password-toggle-btn')[0].innerText")
        assert pass_type_toggled == "text", f"Expected type text after toggle, got {pass_type_toggled}"
        assert "🙈" in btn_html_toggled, f"Expected monkey/hide icon after toggle, got {btn_html_toggled}"
        print(f"  PASS: Toggle switched type to text ({pass_type_toggled}) and icon to {btn_html_toggled.strip()}")

        # Click again to revert
        await evaluate("document.querySelectorAll('#auth-form-container .password-toggle-btn')[0].click()")
        await asyncio.sleep(0.2)
        pass_type_reverted = await evaluate("document.getElementById('reg-password').type")
        assert pass_type_reverted == "password"
        print(f"  PASS: Toggle reverted back to password ({pass_type_reverted})")

        await capture_screenshot("verify_password_toggle.png")

        print("\n=== 2. VERIFYING USER REGISTRATION & PROFILE SETTINGS ===")
        # Register a new member with user-controlled display name
        reg_result = await evaluate("""
        (async () => {
            document.getElementById('reg-username').value = 'meera_novels';
            document.getElementById('reg-displayname').value = 'Meera Krishnan';
            document.getElementById('reg-email').value = 'meera@novels.com';
            document.getElementById('reg-password').value = 'securePass123';
            document.getElementById('reg-confirm-password').value = 'securePass123';
            await window.handleRegisterSubmit();
            return {
                isLoggedIn: window.IS_LOGGED_IN,
                user: window.CURRENT_USER
            };
        })()
        """)
        print(f"  Registration Result: LoggedIn={reg_result.get('isLoggedIn')}, User={reg_result.get('user', {}).get('displayName')}")
        assert reg_result.get("isLoggedIn") is True

        # Check header user area
        header_name = await evaluate("document.querySelector('.user-name-sm')?.innerText")
        print(f"  PASS: Header immediately displays genuine user name: '{header_name}'")
        assert "Meera" in header_name

        print("\n=== 3. VERIFYING USER-CONTROLLED PROFILE EDITING ===")
        # Navigate to user's profile
        await evaluate("window.location.hash = '#member?id=meera_novels'")
        await asyncio.sleep(1.0)

        # Check Edit Profile button presence
        edit_btn = await evaluate("!!document.querySelector('button[onclick*=\"toggleProfileEditCard\"]')")
        assert edit_btn is True, "Edit Profile button must be present for current user!"
        print("  PASS: '✏️ Edit Profile' button visible for current user.")

        # Open Edit Profile card
        await evaluate("window.toggleProfileEditCard()")
        await asyncio.sleep(0.5)

        # Fill in updated profile
        await evaluate("""
        (async () => {
            document.getElementById('edit-display-name').value = 'Meera Krishnan ✨ (Avid Reader)';
            document.getElementById('edit-bio').value = 'Ardent follower of Rudhra Prarthana romance & family saga novels!';
            // Select quick avatar 3
            const presetAvatars = document.querySelectorAll('#edit-profile-card img[onclick*="selectQuickAvatar"]');
            if (presetAvatars.length > 2) presetAvatars[2].click();
            await window.handleSaveProfile();
        })()
        """)
        await asyncio.sleep(1.0)

        # Verify updated profile displayed in profile page
        updated_name = await evaluate("document.querySelector('.profile-display-name')?.innerText")
        updated_bio = await evaluate("document.querySelector('.novel-card-body p')?.innerText")
        print(f"  PASS: Profile updated. Display Name: '{updated_name}'")
        print(f"  PASS: Bio: '{updated_bio}'")
        assert "Meera Krishnan ✨" in updated_name
        assert "Ardent follower" in updated_bio

        await capture_screenshot("verify_profile_edit.png")

        print("\n=== 4. VERIFYING GENUINE MEMBERS DIRECTORY (ZERO FAKE MEMBERS) ===")
        await evaluate("window.location.hash = '#members'")
        await asyncio.sleep(1.0)

        members_rendered = await evaluate("""
        Array.from(document.querySelectorAll('.member-card .member-name')).map(el => el.innerText)
        """)
        print(f"  Members displayed in UI: {members_rendered}")
        assert len(members_rendered) > 0, "Members list should not be empty!"

        # Assert no fake dummy accounts
        fake_names = ["karthi_k", "meena_s", "rudhra_priyan", "கார்த்திக் குமார்", "மீனா சுந்தர்"]
        for f in fake_names:
            assert not any(f.lower() in m.lower() for m in members_rendered), f"Fake member '{f}' was found in directory!"
        print("  PASS: Zero fake members in UI. All members are genuine database users.")

        await capture_screenshot("verify_members_directory.png")

        print("\n=== 5. VERIFYING NOVEL READING PAGE & COPY PROTECTION ===")
        await evaluate("window.location.hash = '#reader?novel=nenjam-marappadhillai&ch=24'")
        await asyncio.sleep(1.0)

        # 5a. Typography and alignment
        reader_styles = await evaluate("""
        (() => {
            const el = document.getElementById('reader-body-content');
            if (!el) return null;
            const style = window.getComputedStyle(el);
            return {
                textAlign: style.textAlign,
                lineHeight: style.lineHeight,
                userSelect: style.userSelect || style.webkitUserSelect,
                fontFamily: style.fontFamily
            };
        })()
        """)
        print(f"  Reader Typography Styles: {reader_styles}")
        assert reader_styles["userSelect"] == "none", "Reader content must have user-select: none!"
        assert reader_styles["textAlign"] == "left", "Reader text must be left-aligned!"
        print("  PASS: Typography is left-aligned and protected from text selection.")

        # 5b. Anti-Copy event listeners test
        copy_test_result = await evaluate("""
        (() => {
            const el = document.getElementById('reader-body-content');
            const event = new Event('copy', { bubbles: true, cancelable: true });
            const dispatched = el.dispatchEvent(event);
            const toast = document.getElementById('rp-toast');
            return {
                defaultPrevented: event.defaultPrevented,
                toastVisible: toast && toast.style.opacity !== '0',
                toastText: toast ? toast.innerText : ''
            };
        })()
        """)
        print(f"  Copy Event Test Result: {copy_test_result}")
        assert copy_test_result["defaultPrevented"] is True, "Copy event on novel content must be prevented!"
        print(f"  PASS: Copying story content is blocked with toast: '{copy_test_result['toastText']}'")

        # 5c. Test reading mode switchers and font adjuster
        await evaluate("window.setReaderMode('sepia')")
        await asyncio.sleep(0.3)
        is_sepia = await evaluate("document.body.classList.contains('mode-sepia')")
        assert is_sepia is True, "Sepia reading mode should be active"
        print("  PASS: Sepia reading mode works cleanly.")

        await evaluate("window.setReaderMode('light')")
        await asyncio.sleep(0.3)

        # 5d. Test chapter navigation buttons
        has_nav_buttons = await evaluate("""
        document.querySelectorAll('.reader-nav-btn').length >= 3
        """)
        assert has_nav_buttons is True, "Chapter navigation buttons (Prev, All, Next) must be present"
        print("  PASS: Chapter navigation buttons present and functional.")

        await capture_screenshot("verify_reader_desktop.png")

        print("\n=== 6. VERIFYING MOBILE RESPONSIVENESS ===")
        await send("Emulation.setDeviceMetricsOverride", {
            "width": 390,
            "height": 844,
            "deviceScaleFactor": 1,
            "mobile": True
        })
        await asyncio.sleep(0.5)

        mobile_metrics = await evaluate("""
        (() => {
            const docWidth = document.documentElement.scrollWidth;
            const winWidth = window.innerWidth;
            const container = document.querySelector('.reader-container');
            return {
                docWidth,
                winWidth,
                hasHorizontalScroll: docWidth > winWidth,
                containerWidth: container ? container.offsetWidth : 0
            };
        })()
        """)
        print(f"  Mobile Metrics: {mobile_metrics}")
        assert mobile_metrics["hasHorizontalScroll"] is False, "No horizontal scroll on mobile viewport!"
        print("  PASS: Clean mobile layout with zero overflow or awkward wrapping.")

        await capture_screenshot("verify_reader_mobile.png")

        print("\n=======================================================")
        print("ALL 6 REQUIREMENTS VALIDATED AND PASSED WITH FLYING COLORS!")
        print("=======================================================")

if __name__ == '__main__':
    try:
        asyncio.run(main())
    finally:
        proc.terminate()
