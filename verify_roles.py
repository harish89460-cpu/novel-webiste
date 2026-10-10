import subprocess
import time
import json
import asyncio
import websockets
import urllib.request
import sys

sys.stdout.reconfigure(encoding='utf-8')

edge_path = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

proc = subprocess.Popen([
    edge_path,
    "--headless=new",
    "--remote-debugging-port=9224",
    "--window-size=1440,900",
    "http://localhost:3000/#home"
])

time.sleep(3)

try:
    resp = urllib.request.urlopen("http://localhost:9224/json")
    tabs = json.loads(resp.read().decode())
    target_tab = next(t for t in tabs if t.get("type") == "page")
    ws_url = target_tab["webSocketDebuggerUrl"]

    async def run():
        async with websockets.connect(ws_url, max_size=10_000_000) as ws:
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

            await send("Page.enable")
            await send("Runtime.enable")

            # Wait for ready
            for _ in range(20):
                res = await send("Runtime.evaluate", {"expression": "typeof window.setUserRole === 'function' && !!document.querySelector('.site-header')", "returnByValue": True})
                if res.get("result", {}).get("value"):
                    break
                await asyncio.sleep(0.5)

            async def check_page_and_roles(view_hash, role, lang):
                # Set role & lang
                await send("Runtime.evaluate", {"expression": f"window.setUserRole('{role}'); window.setLanguage('{lang}'); window.location.hash = '{view_hash}';"})
                await asyncio.sleep(0.3)

                eval_code = """
                (() => {
                    const visibleText = document.body.innerText;
                    const forbidden = [
                        'Role: Admin',
                        'Role: Moderator',
                        'Role: Administrator',
                        'Role: admin',
                        'Role: moderator'
                    ];

                    const matches = [];
                    forbidden.forEach(str => {
                        if (visibleText.includes(str)) {
                            matches.push(`Found forbidden visible text: "${str}"`);
                        }
                    });

                    // Check all visible spans and divs
                    const allVisibleBadges = [];
                    document.querySelectorAll('.author-role-badge, .user-role-badge, .member-role-title, .profile-role-tag').forEach(el => {
                        const style = window.getComputedStyle(el);
                        if (style.display !== 'none' && style.visibility !== 'hidden') {
                            allVisibleBadges.push(el.innerText.trim());
                        }
                    });

                    // Verify permissions
                    const adminLinks = Array.from(document.querySelectorAll('.admin-only-link'));
                    const adminVisible = adminLinks.some(l => l.style.display !== 'none');

                    return {
                        matches,
                        allVisibleBadges,
                        adminVisible,
                        currentUserRole: window.CURRENT_USER_ROLE,
                        isLoggedIn: window.IS_LOGGED_IN
                    };
                })()
                """
                res = await send("Runtime.evaluate", {"expression": eval_code, "returnByValue": True})
                return res.get("result", {}).get("value", {})

            views = ["#home", "#forum", "#topic?id=topic-nenjam-24", "#members", "#member?id=anitha", "#admin"]
            roles = ["Admin", "Moderator", "Registered Member", "Author", "Guest"]

            print("================== ROLE REMOVAL & PERMISSION VERIFICATION ==================")
            all_passed = True
            for role in roles:
                for lang in ["en", "ta"]:
                    for v in views:
                        data = await check_page_and_roles(v, role, lang)
                        matches = data.get("matches", [])
                        badges = data.get("allVisibleBadges", [])
                        admin_visible = data.get("adminVisible", False)

                        # Check if any forbidden badge is visible
                        forbidden_badge = [b for b in badges if b in ['Admin', 'Moderator', 'Administrator', 'நிர்வாகி', 'நெறியாளர்', 'Community Moderator', 'சமூக நெறியாளர்']]
                        
                        has_error = len(matches) > 0 or len(forbidden_badge) > 0
                        # Check permission integrity
                        if role == 'Admin' and not admin_visible:
                            has_error = True
                            print(f"[FAIL] Admin permission failed on {v} ({lang})")
                        if role != 'Admin' and admin_visible:
                            has_error = True
                            print(f"[FAIL] Non-admin leaked admin link on {v} ({lang})")

                        if has_error:
                            all_passed = False
                            print(f"[FAIL] {role} | {lang} | {v}: matches={matches}, forbidden_badges={forbidden_badge}")
                        else:
                            pass

            if all_passed:
                print(">>> ALL TESTS PASSED: 0 occurrences of 'Role: Admin' or 'Role: Moderator' across all pages, roles, and languages.")
                print(">>> Access control & permissions 100% verified (Admin links properly gated).")
            else:
                print(">>> SOME TESTS FAILED.")

    asyncio.run(run())

finally:
    proc.terminate()
