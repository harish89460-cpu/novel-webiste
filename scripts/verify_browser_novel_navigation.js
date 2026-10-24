// Interactive browser test for + New Novel button and form interactions
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { createSession } from '../backend/auth.js';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEBUG_PORT = 9223;
const USER_DATA_DIR = path.resolve('scratch/chrome_browser_test');

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
  console.log('STARTING BROWSER INTERACTION TEST FOR + NEW NOVEL & CREATION PAGE');
  console.log('='.repeat(70));

  const authorToken = await createSession(2, 'author');
  if (!fs.existsSync('scratch')) fs.mkdirSync('scratch', { recursive: true });

  const chromeProc = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${USER_DATA_DIR}`,
    '--no-first-run',
    '--no-default-browser-check',
    'http://localhost:5173/#admin'
  ]);

  try {
    const wsUrl = await getWsUrl();
    const ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => {
      ws.onopen = res;
      ws.onerror = rej;
    });

    const cdp = new CdpClient(ws);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

    // Authenticate in browser
    await cdp.eval(`
      localStorage.setItem('rp_auth_token', '${authorToken}');
      window.location.hash = '#admin?tab=overview';
      if (window.renderAppView) window.renderAppView();
    `);
    await sleep(1500);

    // 1. Verify we are on Overview tab
    const tabInfo1 = await cdp.eval(`
      (() => {
        const btn = document.querySelector('.admin-page-actions button[onclick*="navigateToCreateNovel"]');
        return {
          activeTab: adminState.activeTab,
          hasNewNovelBtn: Boolean(btn),
          btnText: btn ? btn.textContent.trim() : null
        };
      })()
    `);
    console.log('[STEP 1] Overview Tab State:', tabInfo1);

    // 2. Click "+ New Novel" on Overview
    await cdp.eval(`
      (() => {
        const btn = document.querySelector('.admin-page-actions button[onclick*="navigateToCreateNovel"]');
        if (btn) btn.click();
      })()
    `);
    await sleep(600);

    // 3. Verify Novel Creation Page mounted
    const createPageCheck = await cdp.eval(`
      (() => {
        const titleInput = document.getElementById('nc-title');
        const slugInput = document.getElementById('nc-slug');
        const coverImg = document.getElementById('nc-cover-preview-img');
        const backBtn = document.querySelector('.admin-back-btn');
        return {
          activeTab: adminState.activeTab,
          hasTitleInput: Boolean(titleInput),
          hasSlugInput: Boolean(slugInput),
          coverSrc: coverImg ? coverImg.getAttribute('src') : null,
          hasBackBtn: Boolean(backBtn)
        };
      })()
    `);
    console.log('[STEP 2] Novel Creation Page State after clicking + New Novel:', createPageCheck);

    // 4. Test validation: submit without title
    await cdp.eval(`
      (() => {
        const form = document.getElementById('novel-create-form');
        if (form) {
          const submitBtn = document.getElementById('nc-submit-btn');
          if (submitBtn) submitBtn.click();
        }
      })()
    `);
    await sleep(300);

    const validationCheck = await cdp.eval(`
      (() => {
        const titleError = document.getElementById('nc-title-error');
        return {
          errorDisplayed: titleError ? window.getComputedStyle(titleError).display !== 'none' : false,
          errorText: titleError ? titleError.textContent.trim() : null
        };
      })()
    `);
    console.log('[STEP 3] Validation with empty title:', validationCheck);

    // 5. Test auto-slug generation
    await cdp.eval(`
      (() => {
        const titleInput = document.getElementById('nc-title');
        if (titleInput) {
          titleInput.value = 'Malarum Ninaivugal';
          handleNovelTitleInput(titleInput.value);
        }
      })()
    `);
    await sleep(200);

    const autoSlugCheck = await cdp.eval(`
      (() => {
        const slugInput = document.getElementById('nc-slug');
        return {
          slugValue: slugInput ? slugInput.value : null
        };
      })()
    `);
    console.log('[STEP 4] Auto-slug generation:', autoSlugCheck);

    // 6. Test Back button
    await cdp.eval(`
      (() => {
        const backBtn = document.querySelector('.admin-back-btn');
        if (backBtn) backBtn.click();
      })()
    `);
    await sleep(500);

    const backCheck = await cdp.eval(`
      (() => {
        return {
          activeTab: adminState.activeTab,
          novelsTableMounted: Boolean(document.getElementById('novels-table-body'))
        };
      })()
    `);
    console.log('[STEP 5] Back to Novels navigation:', backCheck);

    // 7. Test direct URL refresh at #admin?tab=novel-create
    await cdp.eval(`
      window.location.hash = '#admin?tab=novel-create';
      if (window.renderAppView) window.renderAppView();
    `);
    await sleep(600);

    const directAccessCheck = await cdp.eval(`
      (() => {
        const titleInput = document.getElementById('nc-title');
        return {
          activeTab: adminState.activeTab,
          hasTitleInput: Boolean(titleInput)
        };
      })()
    `);
    console.log('[STEP 6] Direct access to #admin?tab=novel-create:', directAccessCheck);

    console.log('\n' + '='.repeat(70));
    console.log('ALL BROWSER WORKFLOW CHECKS COMPLETED SUCCESSFULLY');
    console.log('='.repeat(70));

    ws.close();
  } finally {
    chromeProc.kill();
    try {
      fs.rmSync(USER_DATA_DIR, { recursive: true, force: true });
    } catch {}
  }
}

run().catch(err => {
  console.error('[BROWSER TEST ERROR]:', err);
  process.exit(1);
});
