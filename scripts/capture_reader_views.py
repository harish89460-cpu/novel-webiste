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

proc = subprocess.Popen([
    edge_path,
    "--headless=new",
    "--remote-debugging-port=9225",
    "--window-size=1440,900",
    "http://localhost:3000/#home"
])

time.sleep(3)

try:
    resp = urllib.request.urlopen("http://localhost:9225/json")
    tabs = json.loads(resp.read().decode())
    target_tab = next((t for t in tabs if t.get("type") == "page"), tabs[0])
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

            async def screenshot(name):
                res = await send("Page.captureScreenshot", {"format": "png"})
                data = base64.b64decode(res["data"])
                path = os.path.join(artifact_dir, name)
                with open(path, "wb") as f:
                    f.write(data)
                print(f"[Captured] {name} ({len(data)} bytes)")

            # 1. Login as standard reader via API and inject token into localStorage
            reader_login_code = """
            (async function() {
                let res = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        username: 'kavitha_reader',
                        email: 'kavitha@example.com',
                        password: 'Password123!',
                        displayName: 'Kavitha Reader'
                    })
                });
                let data = await res.json();
                if (!data.token) {
                    res = await fetch('/api/auth/login', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({username: 'kavitha_reader', password: 'Password123!'})
                    });
                    data = await res.json();
                }
                if (data.token) {
                    localStorage.setItem('rp_auth_token', data.token);
                    window.IS_LOGGED_IN = true;
                    window.CURRENT_USER = data.user;
                    if (window.updateHeaderUserArea) window.updateHeaderUserArea();
                }
                return data;
            })()
            """
            await send("Runtime.evaluate", {"expression": reader_login_code, "awaitPromise": True})
            await asyncio.sleep(1)

            # 2. Navigate to member profile as reader
            await send("Page.navigate", {"url": "http://localhost:3000/#member?id=me"})
            await asyncio.sleep(2)
            await screenshot("normal_reader_dashboard.png")

            # 3. Direct URL access attempt to #admin while logged in as normal reader
            await send("Page.navigate", {"url": "http://localhost:3000/#admin"})
            await asyncio.sleep(2)
            await screenshot("reader_admin_access_denied.png")

            print("[Success] Reader access control screenshots captured successfully!")

    asyncio.run(run())

finally:
    proc.terminate()
