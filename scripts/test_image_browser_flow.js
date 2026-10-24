// End-to-End Image Browser & Media Workflow Verification Script
// Tests: Media API auth, image uploads, library browsing, selection into Novel Cover & Episode Rich-Text, MySQL persistence

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { query, queryOne } from '../backend/db.js';
import { createSession } from '../backend/auth.js';

const API_BASE = 'http://localhost:3000';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEBUG_PORT = 9222;
const USER_DATA_DIR = path.resolve('scratch/chrome_profile_flow');

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

let passed = 0;
let failed = 0;

function assert(description, condition, details = '') {
  if (condition) {
    passed++;
    console.log(`  [PASS] ${description}`);
  } else {
    failed++;
    console.error(`  [FAIL] ${description} ${details}`);
  }
}

async function getWsUrl() {
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
      if (res.ok) {
        const list = await res.json();
        const page = list.find(t => t.type === 'page');
        if (page && page.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
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
  console.log('======================================================================');
  console.log('E2E TEST: Integrated Image Browser, Media API & Novel Cover Workflow');
  console.log('======================================================================\n');

  // Step 1: Check admin credentials and create session
  const adminUser = await queryOne(`SELECT * FROM users WHERE email = 'digitalmarkservices.in@gmail.com' LIMIT 1;`);
  if (!adminUser) {
    console.error('Admin user digitalmarkservices.in@gmail.com not found!');
    process.exit(1);
  }

  const sessionToken = await createSession(adminUser.id, 'author');
  console.log(`Admin session created: ${sessionToken.slice(0, 16)}...`);

  // Step 2: Test API Authorization on Media Endpoints
  console.log('\n--- 1. Testing Media API Authorization ---');
  
  // Unauthenticated request should be rejected
  const unauthRes = await fetch(`${API_BASE}/api/admin/media`);
  assert('Unauthorized GET /api/admin/media rejected', unauthRes.status === 401 || unauthRes.status === 403);

  const unauthUploadRes = await fetch(`${API_BASE}/api/admin/media/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: 'invalid', filename: 'test.jpg' })
  });
  assert('Unauthorized POST /api/admin/media/upload rejected', unauthUploadRes.status === 401 || unauthUploadRes.status === 403);

  // Authenticated GET media
  const authHeaders = {
    'Authorization': `Bearer ${sessionToken}`,
    'Content-Type': 'application/json'
  };

  const getMediaRes = await fetch(`${API_BASE}/api/admin/media?limit=10`, { headers: authHeaders });
  assert('Authorized GET /api/admin/media returns 200', getMediaRes.status === 200);
  const mediaData = await getMediaRes.json();
  assert('GET /api/admin/media returns success: true', mediaData.success === true);
  assert('GET /api/admin/media returns media array', Array.isArray(mediaData.media));

  // Step 3: Test Upload Validation & Image Persistence
  console.log('\n--- 2. Testing Media Upload & Validation ---');
  
  // Test invalid file data
  const invalidDataRes = await fetch(`${API_BASE}/api/admin/media/upload`, {
    headers: authHeaders,
    method: 'POST',
    body: JSON.stringify({ data: 'data:text/plain;base64,SGVsbG8=', filename: 'test.txt' })
  });
  const invalidDataJson = await invalidDataRes.json();
  assert('Rejects non-image MIME type', invalidDataJson.success === false);

  // Upload a valid 1x1 PNG data URL
  const samplePngBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const testFileName = `test-cover-${Date.now()}.png`;

  const uploadRes = await fetch(`${API_BASE}/api/admin/media/upload`, {
    headers: authHeaders,
    method: 'POST',
    body: JSON.stringify({ data: samplePngBase64, filename: testFileName })
  });
  assert('Upload valid image returns 200 or 201', uploadRes.status === 200 || uploadRes.status === 201);
  const uploadJson = await uploadRes.json();
  assert('Upload response success is true', uploadJson.success === true);
  assert('Upload returns media object with URL', Boolean(uploadJson.media?.url));
  const uploadedUrl = uploadJson.media?.url;
  console.log(`  Uploaded image URL: ${uploadedUrl}`);

  // Step 4: Verify Image in MySQL media table
  console.log('\n--- 3. Verifying MySQL Media Record ---');
  const mediaDbRecord = await queryOne('SELECT * FROM media WHERE url = ? LIMIT 1;', [uploadedUrl]);
  assert('Media record stored in MySQL media table', Boolean(mediaDbRecord));
  assert('Media filename matches uploaded file', mediaDbRecord?.original_name === testFileName);

  // Step 5: Test Novel Cover Persistence using the Uploaded Image
  console.log('\n--- 4. Testing Novel Cover Integration with MySQL ---');
  const testNovelSlug = `test-novel-browser-${Date.now()}`;
  const testNovelTitle = `Image Browser Test Novel ${Date.now()}`;

  const createNovelRes = await fetch(`${API_BASE}/api/admin/novels`, {
    headers: authHeaders,
    method: 'POST',
    body: JSON.stringify({
      id: testNovelSlug,
      slug: testNovelSlug,
      title: testNovelTitle,
      author: 'Rudhra Prarthana',
      genre: 'Romance',
      blurb: 'Testing integrated image browser cover persistence',
      cover: uploadedUrl,
      visibility: 'draft',
      isPublished: false
    })
  });

  const createNovelData = await createNovelRes.json();
  assert('POST /api/admin/novels succeeds', createNovelData.success === true);
  const createdNovelId = createNovelData.novel?.id || testNovelSlug;
  assert('Novel created with ID', Boolean(createdNovelId));

  // Verify Cover in MySQL novels table
  const novelDb = await queryOne('SELECT id, title, cover FROM novels WHERE id = ?;', [createdNovelId]);
  assert('Novel cover in MySQL matches uploaded URL', novelDb?.cover === uploadedUrl);

  // Step 6: Test in Browser UI via CDP
  console.log('\n--- 5. Testing Browser UI Integration (Sidebar & Modal) ---');
  if (!fs.existsSync(USER_DATA_DIR)) fs.mkdirSync(USER_DATA_DIR, { recursive: true });

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
    const ws = new WebSocket(wsUrl);
    await new Promise(r => ws.onopen = r);
    const cdp = new CdpClient(ws);

    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('DOM.enable');

    await cdp.send('Page.navigate', { url: 'http://localhost:5173/' });
    await sleep(2000);

    // Perform real admin login in page context
    const loginResult = await cdp.eval(`
      (async () => {
        try {
          const res = await fetch('http://localhost:3000/api/admin/login', {
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

    // Check 1: Media Library NOT in Sidebar Navigation
    const sidebarNavCheck = await cdp.eval(`
      (() => {
        const sidebar = document.getElementById('admin-sidebar-nav');
        if (!sidebar) return { found: false, text: '' };
        const navButtons = Array.from(sidebar.querySelectorAll('.admin-nav-item span'));
        const labels = navButtons.map(s => s.textContent.trim().toLowerCase());
        const hasMedia = labels.some(l => l.includes('media'));
        return {
          hasMedia,
          labels
        };
      })()
    `);
    assert('Media Library removed from dashboard sidebar navigation', !sidebarNavCheck.hasMedia, `(Nav labels: ${sidebarNavCheck.labels?.join(', ')})`);

    // Check 2: Navigate to Create Novel page
    await cdp.eval(`navigateToCreateNovel()`);
    await sleep(600);

    const chooseBtnCheck = await cdp.eval(`
      (() => {
        const chooseBtn = document.getElementById('nc-choose-cover-btn');
        return Boolean(chooseBtn && chooseBtn.offsetParent !== null);
      })()
    `);
    assert('"Choose Cover Image" button is visible on Create Novel page', chooseBtnCheck);

    // Check 3: Open Image Browser Modal
    await cdp.eval(`chooseCoverImageForCreateNovel()`);
    await sleep(600);

    const modalOpenCheck = await cdp.eval(`
      (() => {
        const modal = document.getElementById('image-browser-modal');
        const title = document.getElementById('img-browser-modal-title');
        const tabBrowse = document.getElementById('tab-btn-browse');
        const tabUpload = document.getElementById('tab-btn-upload');
        const grid = document.querySelector('.browser-grid');
        const gridItems = document.querySelectorAll('.browser-grid-item').length;
        return {
          isOpen: Boolean(modal),
          titleText: title?.textContent,
          tabBrowse: Boolean(tabBrowse),
          tabUpload: Boolean(tabUpload),
          gridExists: Boolean(grid),
          gridItems
        };
      })()
    `);
    assert('Image Browser modal opens smoothly', modalOpenCheck.isOpen);
    assert('Image Browser shows "Browse Existing Images" tab', modalOpenCheck.tabBrowse);
    assert('Image Browser shows "Upload New Image" tab', modalOpenCheck.tabUpload);
    assert('Image Browser displays media thumbnails grid', modalOpenCheck.gridItems > 0, `(Found ${modalOpenCheck.gridItems} images)`);

    // Check 4: Select an existing image and click "Use This Image"
    const selectResult = await cdp.eval(`
      (() => {
        const firstItem = document.querySelector('.browser-grid-item');
        if (!firstItem) return { selected: false };
        firstItem.click();
        const useBtn = document.getElementById('browser-use-btn');
        const isDisabled = useBtn ? useBtn.disabled : true;
        if (!isDisabled) {
          useBtn.click();
        }
        return {
          selected: true,
          useBtnDisabled: isDisabled
        };
      })()
    `);
    await sleep(400);

    assert('Can select an existing image from the grid', selectResult.selected && !selectResult.useBtnDisabled);

    // Check 5: Cover input in Create Novel form is populated
    const formCoverValue = await cdp.eval(`
      (() => {
        const input = document.getElementById('nc-cover-url-input');
        const preview = document.getElementById('nc-cover-preview-img');
        const modal = document.getElementById('image-browser-modal');
        return {
          inputValue: input?.value,
          previewSrc: preview?.src,
          modalClosed: !modal
        };
      })()
    `);
    assert('Image browser closes after selection', formCoverValue.modalClosed);
    assert('Cover input populated with selected image URL', Boolean(formCoverValue.inputValue && formCoverValue.inputValue.includes('/uploads/media/')));

    // Check 6: Switch to Editor and check Rich-Text Insert Image
    await cdp.eval(`switchAdminTab('editor')`);
    await sleep(600);

    await cdp.eval(`promptInsertImage()`);
    await sleep(500);

    const editorModalCheck = await cdp.eval(`
      (() => {
        const modal = document.getElementById('image-browser-modal');
        const title = document.getElementById('img-browser-modal-title');
        return {
          isOpen: Boolean(modal),
          title: title?.textContent
        };
      })()
    `);
    assert('Rich-Text Editor 🖼️ Image action opens Image Browser modal', editorModalCheck.isOpen);
    assert('Rich-Text modal title is "Insert Image into Episode"', editorModalCheck.title === 'Insert Image into Episode');

    // Clean up: Close modal
    await cdp.eval(`closeImageBrowserModal()`);
    ws.close();
  } finally {
    try {
      chromeProc.kill('SIGKILL');
    } catch {}
  }

  // Clean up test novel
  if (createdNovelId) {
    await query('DELETE FROM novels WHERE id = ?;', [createdNovelId]);
    console.log(`\nCleaned up test novel ${createdNovelId}`);
  }

  console.log('\n======================================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================================');

  if (failed > 0) process.exit(1);
}

run().catch(err => {
  console.error('Test script crashed:', err);
  process.exit(1);
});
