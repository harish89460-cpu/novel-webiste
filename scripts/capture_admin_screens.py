import subprocess
import time
import json
import asyncio
import websockets
import urllib.request
import base64
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

artifact_dir = r"C:\Users\Harish V\.gemini\antigravity-ide\brain\dfe69dbc-9051-4397-8d5c-cb97e7635e24"
edge_path = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if not os.path.exists(edge_path):
    edge_path = r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"

os.makedirs(artifact_dir, exist_ok=True)

proc = subprocess.Popen([
    edge_path,
    "--headless=new",
    "--remote-debugging-port=9224",
    "--window-size=1440,900",
    "http://localhost:3000/#admin-login"
])

time.sleep(3)

try:
    resp = urllib.request.urlopen("http://localhost:9224/json")
    tabs = json.loads(resp.read().decode())
    target_tab = None
    for tab in tabs:
        if tab.get("type") == "page":
            target_tab = tab
            break
    if not target_tab:
        target_tab = tabs[0]

    ws_url = target_tab["webSocketDebuggerUrl"]

    async def run():
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

            await send("Page.enable")
            await send("Runtime.enable")

            async def wait_for(expr, timeout=10):
                start = time.time()
                while time.time() - start < timeout:
                    res = await send("Runtime.evaluate", {"expression": expr, "returnByValue": True})
                    if res.get("result", {}).get("value"):
                        return True
                    await asyncio.sleep(0.3)
                return False

            async def screenshot(name):
                res = await send("Page.captureScreenshot", {"format": "png"})
                data = base64.b64decode(res["data"])
                path = os.path.join(artifact_dir, name)
                with open(path, "wb") as f:
                    f.write(data)
                print(f"[Captured] {name} ({len(data)} bytes)")

            # 1. Admin Login View
            await wait_for("document.readyState === 'complete' && !!document.getElementById('admin-username-input')")
            await asyncio.sleep(1)
            await screenshot("admin_login_screen.png")

            # 2. Perform Login
            login_js = """
            (function() {
                var u = document.getElementById('admin-username-input');
                var p = document.getElementById('admin-password-input');
                if (u && p) {
                    u.value = 'rudhra_author';
                    p.value = 'Password123!';
                    window.submitAdminLoginForm();
                }
            })()
            """
            await send("Runtime.evaluate", {"expression": login_js})
            await wait_for("location.hash === '#admin' && !!document.querySelector('.admin-sidebar')", 15)
            await asyncio.sleep(2)

            # 3. Overview Tab
            await screenshot("admin_overview_screen.png")

            # 4. Novels Tab
            await send("Runtime.evaluate", {"expression": "window.switchAdminTab('novels')"})
            await asyncio.sleep(1.2)
            await screenshot("admin_novels_screen.png")

            # 5. Episodes Tab
            await send("Runtime.evaluate", {"expression": "window.switchAdminTab('episodes')"})
            await asyncio.sleep(1.2)
            await screenshot("admin_episodes_screen.png")

            # 6. Editor Tab
            await send("Runtime.evaluate", {"expression": "window.switchAdminTab('editor')"})
            await asyncio.sleep(1.2)
            await screenshot("admin_editor_screen.png")

            # 7. Scheduler Tab
            await send("Runtime.evaluate", {"expression": "window.switchAdminTab('scheduler')"})
            await asyncio.sleep(1.2)
            await screenshot("admin_scheduler_screen.png")

            # 8. Media Tab
            await send("Runtime.evaluate", {"expression": "window.switchAdminTab('media')"})
            await asyncio.sleep(1.2)
            await screenshot("admin_media_screen.png")

            # 9. Settings Tab
            await send("Runtime.evaluate", {"expression": "window.switchAdminTab('settings')"})
            await asyncio.sleep(1.2)
            await screenshot("admin_settings_screen.png")

            # 10. User profile with Logout button
            await send("Page.navigate", {"url": "http://localhost:3000/#member?id=me"})
            await wait_for("document.readyState === 'complete' && !!document.querySelector('.member-header-actions')", 8)
            await asyncio.sleep(1.2)
            await screenshot("member_profile_screen.png")

            print("[Success] All screenshots captured successfully!")

    asyncio.run(run())

finally:
    proc.terminate()
