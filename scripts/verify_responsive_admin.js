// Automated Responsive Verification Script for Rudhra Prarthana Admin Dashboard
// Tests Viewports: 360px, 375px, 390px, 430px, 768px, 1024px, 1366px, 1920px

import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createSession } from '../server/auth.js';

const VIEWPORTS = [
  { name: 'Ultra Compact Mobile', width: 320, height: 568, isMobile: true },
  { name: 'Mobile Mini', width: 360, height: 740, isMobile: true },
  { name: 'iPhone SE', width: 375, height: 667, isMobile: true },
  { name: 'iPhone 12/13/14', width: 390, height: 844, isMobile: true },
  { name: 'iPhone 14/15 Pro Max', width: 430, height: 932, isMobile: true },
  { name: 'Tablet Portrait (iPad)', width: 768, height: 1024, isMobile: true },
  { name: 'Tablet Landscape / Laptop', width: 1024, height: 768, isMobile: false },
  { name: 'Standard Desktop (1280px)', width: 1280, height: 800, isMobile: false },
  { name: 'Wide Desktop (1440px)', width: 1440, height: 900, isMobile: false },
  { name: 'Full HD Desktop (1920px)', width: 1920, height: 1080, isMobile: false }
];

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEBUG_PORT = 9222;
const USER_DATA_DIR = path.resolve('scratch/chrome_profile');

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function getWsUrl() {
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
      if (res.ok) {
        const list = await res.json();
        const page = list.find(t => t.type === 'page');
        if (page && page.webSocketDebuggerUrl) {
          return page.webSocketDebuggerUrl;
        }
      }
    } catch {}
    await sleep(250);
  }
  const newRes = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/new?about:blank`, { method: 'PUT' });
  const data = await newRes.json();
  return data.webSocketDebuggerUrl;
}

class CdpClient {
  constructor(ws) {
    this.ws = ws;
    this.id = 1;
    this.callbacks = new Map();

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.callbacks.has(msg.id)) {
        const cb = this.callbacks.get(msg.id);
        this.callbacks.delete(msg.id);
        if (msg.error) cb.reject(new Error(msg.error.message));
        else cb.resolve(msg.result);
      }
    };
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    return res.result?.value;
  }
}

async function run() {
  console.log('='.repeat(70));
  console.log('STARTING AUTOMATED RESPONSIVE VERIFICATION FOR ADMIN DASHBOARD');
  console.log('='.repeat(70));

  // 1. Create fresh author session
  const token = await createSession(2, 'author');
  console.log(`Generated Author Test Session Token: ${token.slice(0, 16)}...`);

  // Ensure scratch dir
  if (!fs.existsSync('scratch')) fs.mkdirSync('scratch', { recursive: true });

  // 2. Launch Chrome Headless
  const chromeProc = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${USER_DATA_DIR}`,
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank'
  ]);

  try {
    const wsUrl = await getWsUrl();
    console.log(`Connected to Chrome DevTools Protocol at port ${DEBUG_PORT}`);

    const ws = new WebSocket(wsUrl);
    await new Promise(res => ws.onopen = res);
    const cdp = new CdpClient(ws);

    // Enable Page & Runtime
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('DOM.enable');

    // Initial navigation to localhost:5173
    await cdp.send('Page.navigate', { url: 'http://localhost:5173/' });
    await sleep(1500);

    // Perform real admin login in page context
    const loginResult = await cdp.eval(`
      (async () => {
        try {
          const res = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username: 'digitalmarkservices.in@gmail.com',
              password: 'Rudhra.pass'
            })
          });
          const data = await res.json();
          if (data.success && data.token) {
            localStorage.setItem('rp_auth_token', data.token);
            window.IS_LOGGED_IN = true;
            window.CURRENT_USER = data.user;
            window.location.hash = '#admin';
            if (typeof window.renderAppView === 'function') {
              await window.renderAppView();
            }
            return { success: true, user: data.user.displayName };
          }
          return { success: false, error: data.error };
        } catch (err) {
          return { success: false, error: err.message };
        }
      })()
    `);
    console.log('Browser Admin Login Result:', loginResult);
    await sleep(2000);

    let totalPassed = 0;
    let totalChecks = 0;

    function assert(title, condition, extra = '') {
      totalChecks++;
      if (condition) {
        totalPassed++;
        console.log(`  [PASS] ${title} ${extra}`);
      } else {
        console.error(`  [FAIL] ${title} ${extra}`);
      }
    }

    // Iterate through all 8 target viewports
    for (const vp of VIEWPORTS) {
      console.log(`\n--- Testing Viewport: ${vp.name} (${vp.width}px x ${vp.height}px) ---`);

      // Set viewport dimensions
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: 1,
        mobile: vp.isMobile
      });
      await sleep(400);

      // Check 1: Horizontal Overflow
      const overflowInfo = await cdp.eval(`
        (() => {
          const docEl = document.documentElement;
          const body = document.body;
          const scrollW = Math.max(docEl.scrollWidth, body.scrollWidth);
          const clientW = window.innerWidth;
          const container = document.querySelector('.admin-dashboard-container');
          const containerW = container ? container.scrollWidth : 0;
          return {
            hasOverflow: scrollW > clientW + 1,
            scrollW,
            clientW,
            containerW
          };
        })()
      `);
      assert(
        `${vp.width}px: Zero Horizontal Overflow`,
        !overflowInfo.hasOverflow,
        `(scrollWidth: ${overflowInfo.scrollW}px, viewport: ${overflowInfo.clientW}px)`
      );

      // Check 2: Top Bar & Navigation Layout Verification
      const navVisibility = await cdp.eval(`
        (() => {
          const topBar = document.querySelector('.admin-top-bar');
          const toggleBtn = document.getElementById('admin-mobile-toggle');
          const sidebar = document.querySelector('.admin-sidebar');
          
          const topBarVisible = topBar && window.getComputedStyle(topBar).display !== 'none';
          const toggleComputed = toggleBtn ? window.getComputedStyle(toggleBtn).display : 'none';
          const toggleVisible = toggleComputed !== 'none';
          const sidebarVisible = sidebar && window.getComputedStyle(sidebar).display !== 'none';
          
          return {
            topBarVisible,
            toggleVisible,
            toggleComputed,
            sidebarVisible
          };
        })()
      `);

      if (vp.isMobile) {
        assert(
          `${vp.width}px: Mobile Bar Visible`,
          navVisibility.topBarVisible
        );
        assert(
          `${vp.width}px (Mobile/Tablet <= 992px): Hamburger Toggle Visible`,
          navVisibility.toggleVisible,
          `(computed: ${navVisibility.toggleComputed})`
        );

        // Test Drawer Opening & Closing
        await cdp.eval(`toggleAdminMobileNav(true)`);
        await sleep(300);

        const drawerOpenState = await cdp.eval(`
          (() => {
            const sidebar = document.querySelector('.admin-sidebar');
            const backdrop = document.getElementById('admin-sidebar-backdrop');
            return {
              isDrawerOpen: sidebar && sidebar.classList.contains('drawer-open'),
              isBackdropActive: backdrop && backdrop.classList.contains('active')
            };
          })()
        `);

        assert(
          `${vp.width}px: Mobile Drawer slides in with active backdrop`,
          drawerOpenState.isDrawerOpen && drawerOpenState.isBackdropActive
        );

        // Close drawer
        await cdp.eval(`toggleAdminMobileNav(false)`);
        await sleep(200);

        const drawerClosedState = await cdp.eval(`
          (() => {
            const sidebar = document.querySelector('.admin-sidebar');
            return !sidebar.classList.contains('drawer-open');
          })()
        `);
        assert(`${vp.width}px: Drawer closes cleanly on dismiss`, drawerClosedState);
      } else {
        assert(
          `${vp.width}px (Desktop >= 1024px): Duplicate Top Bar Removed`,
          !navVisibility.topBarVisible
        );
        assert(
          `${vp.width}px (Desktop >= 1024px): Full Desktop Sidebar Visible Directly`,
          navVisibility.sidebarVisible
        );
        assert(
          `${vp.width}px (Desktop >= 1024px): Hamburger Toggle Hidden (Full Sidebar Mode)`,
          !navVisibility.toggleVisible,
          `(computed: ${navVisibility.toggleComputed})`
        );
      }

      // Check 3: Tab Switching Responsiveness & Layout Fit
      const tabsToTest = ['novels', 'novel-create', 'episodes', 'editor', 'scheduler', 'settings', 'overview'];
      for (const tab of tabsToTest) {
        await cdp.eval(`switchAdminTab('${tab}')`);
        await sleep(250);

        const tabFit = await cdp.eval(`
          (() => {
            const docEl = document.documentElement;
            const body = document.body;
            const scrollW = Math.max(docEl.scrollWidth, body.scrollWidth);
            const clientW = window.innerWidth;
            const main = document.getElementById('admin-main-canvas');
            return {
              hasOverflow: scrollW > clientW + 1,
              mainRendered: Boolean(main && main.children.length > 0)
            };
          })()
        `);

        assert(
          `${vp.width}px: Tab '${tab}' renders without overflow`,
          !tabFit.hasOverflow && tabFit.mainRendered
        );
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log(`RESPONSIVE TEST RESULTS: ${totalPassed} / ${totalChecks} CHECKS PASSED`);
    console.log('='.repeat(70));

    ws.close();
  } finally {
    chromeProc.kill();
    // Clean scratch chrome profile
    try {
      fs.rmSync(USER_DATA_DIR, { recursive: true, force: true });
    } catch {}
  }
}

run().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('[TEST ERROR]:', err);
  process.exit(1);
});
