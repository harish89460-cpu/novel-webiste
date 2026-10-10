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
    "--remote-debugging-port=9222",
    "--window-size=1440,900",
    "http://localhost:3000/#home"
])

time.sleep(3)

try:
    resp = urllib.request.urlopen("http://localhost:9222/json")
    tabs = json.loads(resp.read().decode())
    target_tab = None
    for tab in tabs:
        if tab.get("type") == "page":
            target_tab = tab
            break
    if not target_tab:
        target_tab = tabs[0]

    ws_url = target_tab["webSocketDebuggerUrl"]
    print(f"Connected to tab: {target_tab.get('url')}")

    async def run():
        async with websockets.connect(ws_url) as ws:
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

            # Function to test a specific viewport and language
            async def test_vp(w, h, lang):
                await send("Emulation.setDeviceMetricsOverride", {
                    "width": w,
                    "height": h,
                    "deviceScaleFactor": 1,
                    "mobile": w <= 768
                })
                # Switch language
                await send("Runtime.evaluate", {"expression": f"window.setLanguage('{lang}');"})
                await asyncio.sleep(0.3)

                eval_code = f"""
                (() => {{
                    const vw = window.innerWidth;
                    const vh = window.innerHeight;
                    const docEl = document.documentElement;
                    const body = document.body;

                    const header = document.querySelector('.site-header');
                    const headerInner = document.querySelector('.header-inner');
                    const brand = document.querySelector('.brand-link');
                    const brandTitles = document.querySelector('.brand-titles');
                    const brandName = document.querySelector('.brand-name');
                    const brandTagline = document.querySelector('.brand-tagline');
                    const nav = document.querySelector('.nav-desktop');
                    const actions = document.querySelector('.header-actions');
                    const langBtn = document.querySelector('.lang-toggle-btn');
                    const hero = document.querySelector('.hero-section');
                    const heroTitle = document.querySelector('.hero-title');
                    const heroStats = document.querySelector('.hero-stats-strip');

                    // Check horizontal overflow
                    const allEls = Array.from(document.querySelectorAll('*'));
                    const overflowing = [];
                    allEls.forEach(el => {{
                        const s = window.getComputedStyle(el);
                        if (s.display === 'none' || s.visibility === 'hidden') return;
                        if (el.offsetParent === null && s.position !== 'fixed') return;

                        const rect = el.getBoundingClientRect();
                        if (rect.right > vw + 1) {{
                            overflowing.push({{
                                tag: el.tagName,
                                id: el.id,
                                cls: (el.className && typeof el.className === 'string') ? el.className.slice(0, 40) : '',
                                right: Math.round(rect.right),
                                width: Math.round(rect.width),
                                text: (el.innerText || '').slice(0, 25).trim()
                            }});
                        }}
                    }});

                    // Check elements with custom scrollbars or inner overflow
                    const scrollbars = [];
                    allEls.forEach(el => {{
                        const s = window.getComputedStyle(el);
                        if (s.display === 'none' || s.visibility === 'hidden') return;
                        if (el !== docEl && el !== body) {{
                            if ((s.overflowX === 'scroll' || s.overflowX === 'auto') && el.scrollWidth > el.clientWidth) {{
                                scrollbars.push({{ type: 'X', tag: el.tagName, cls: el.className, scrollW: el.scrollWidth, clientW: el.clientWidth }});
                            }}
                            if ((s.overflowY === 'scroll' || s.overflowY === 'auto') && el.scrollHeight > el.clientHeight) {{
                                scrollbars.push({{ type: 'Y', tag: el.tagName, cls: el.className, scrollH: el.scrollHeight, clientH: el.clientHeight }});
                            }}
                        }}
                    }});

                    return {{
                        vpWidth: vw,
                        docScrollWidth: docEl.scrollWidth,
                        docClientWidth: docEl.clientWidth,
                        bodyScrollWidth: body.scrollWidth,
                        bodyClientWidth: body.clientWidth,
                        hasHOverflow: docEl.scrollWidth > docEl.clientWidth,
                        overflowDiff: docEl.scrollWidth - docEl.clientWidth,
                        overflowCount: overflowing.length,
                        overflowing: overflowing.slice(0, 5),
                        innerScrollbars: scrollbars,
                        header: {{
                            headerHeight: header ? Math.round(header.getBoundingClientRect().height) : 0,
                            headerInnerHeight: headerInner ? Math.round(headerInner.getBoundingClientRect().height) : 0,
                            brandWidth: brand ? Math.round(brand.getBoundingClientRect().width) : 0,
                            navDisplay: nav ? window.getComputedStyle(nav).display : 'none',
                            navWidth: nav ? Math.round(nav.getBoundingClientRect().width) : 0,
                            navScrollWidth: nav ? nav.scrollWidth : 0,
                            actionsWidth: actions ? Math.round(actions.getBoundingClientRect().width) : 0,
                            langBtnText: langBtn ? langBtn.innerText.trim() : ''
                        }},
                        heroStatsWidth: heroStats ? Math.round(heroStats.getBoundingClientRect().width) : 0
                    }};
                }})()
                """
                res = await send("Runtime.evaluate", {"expression": eval_code, "returnByValue": True})
                return res.get("result", {}).get("value", {})

            viewports = [1920, 1440, 1200, 1024, 768, 430, 390, 360]
            print("\n================== DETAILED REPORT ==================")
            for lang in ["en", "ta"]:
                print(f"\n--- TESTING LANGUAGE: {lang.upper()} ---")
                for w in viewports:
                    data = await test_vp(w, 800, lang)
                    h_info = data.get("header", {})
                    print(f"[{w}px {lang.upper()}] scrollW={data.get('docScrollWidth')} clientW={data.get('docClientWidth')} diff={data.get('overflowDiff')} | headerH={h_info.get('headerHeight')} nav={h_info.get('navDisplay')}(w={h_info.get('navWidth')}, scrollW={h_info.get('navScrollWidth')}) actionsW={h_info.get('actionsWidth')} btn='{h_info.get('langBtnText')}' | ofCount={data.get('overflowCount')}")
                    if data.get("overflowing"):
                        print(f"   --> Overflowing elements: {json.dumps(data.get('overflowing'), ensure_ascii=False)}")
                    if data.get("innerScrollbars"):
                        print(f"   --> Inner scrollbars: {json.dumps(data.get('innerScrollbars'), ensure_ascii=False)}")

    asyncio.run(run())

finally:
    proc.terminate()
