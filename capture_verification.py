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

artifact_dir = r"C:\Users\Harish V\.gemini\antigravity-ide\brain\b5bf7e58-27e2-42b2-bd16-ced0dd383407"
edge_path = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

proc = subprocess.Popen([
    edge_path,
    "--headless=new",
    "--remote-debugging-port=9223",
    "--window-size=1440,900",
    "http://localhost:3000/#home"
])

time.sleep(3)

try:
    resp = urllib.request.urlopen("http://localhost:9223/json")
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

            # Wait for document ready
            for _ in range(20):
                res = await send("Runtime.evaluate", {"expression": "document.readyState === 'complete' && !!document.querySelector('.site-header')", "returnByValue": True})
                if res.get("result", {}).get("value"):
                    break
                await asyncio.sleep(0.5)

            async def capture(name, w, h, lang, mobile=False):
                await send("Emulation.setDeviceMetricsOverride", {
                    "width": w,
                    "height": h,
                    "deviceScaleFactor": 1,
                    "mobile": mobile
                })
                await send("Runtime.evaluate", {"expression": f"window.setLanguage('{lang}');"})
                await asyncio.sleep(0.5)

                res = await send("Page.captureScreenshot", {"format": "png"})
                img_data = base64.b64decode(res.get("data", ""))
                out_path = os.path.join(artifact_dir, f"{name}.png")
                with open(out_path, "wb") as f:
                    f.write(img_data)
                print(f"Captured {name}: {out_path} ({len(img_data)} bytes)")

            await capture("desktop_1440_en", 1440, 850, "en", mobile=False)
            await capture("desktop_1440_ta", 1440, 850, "ta", mobile=False)
            await capture("desktop_1024_ta", 1024, 768, "ta", mobile=False)
            await capture("mobile_390_ta", 390, 844, "ta", mobile=True)

    asyncio.run(run())

finally:
    proc.terminate()
