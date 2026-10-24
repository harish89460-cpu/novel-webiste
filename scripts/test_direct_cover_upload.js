// Verification script for Simple Direct Novel Cover Upload Workflow
// Tests: Direct native file picker trigger, preview display, direct backend upload,
// Remove Image action, MySQL persistence, and absence of custom image browser modals/tabs.

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { query, queryOne } from '../server/db.js';
import { createSession } from '../server/auth.js';

const API_BASE = 'http://localhost:3000';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEBUG_PORT = 9222;
const USER_DATA_DIR = path.resolve('scratch/chrome_profile_direct');

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
  console.log('TEST: Direct Novel Cover Upload Workflow (No Custom Modals)');
  console.log('======================================================================\n');

  const adminUser = await queryOne(`SELECT * FROM users WHERE email = 'digitalmarkservices.in@gmail.com' LIMIT 1;`);
  if (!adminUser) {
    console.error('Admin user digitalmarkservices.in@gmail.com not found!');
    process.exit(1);
  }

  const sessionToken = await createSession(adminUser.id, 'author');
  console.log(`Admin session: ${sessionToken.slice(0, 16)}...`);

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

  let createdNovelId = null;

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

    // 1. Authenticate admin in page
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
            return { success: true };
          }
          return { success: false, error: data.error };
        } catch (err) {
          return { success: false, error: err.message };
        }
      })()
    `);
    assert('Admin login succeeded in page', loginResult?.success);
    await sleep(2000);

    // 2. Navigate to Create Novel page
    await cdp.eval(`switchAdminTab('novel-create')`);
    await sleep(1000);

    // 3. Verify Minimal Cover Section Structure
    console.log('\n--- 1. Verifying Clean Cover Control (No Old Clutter) ---');
    const coverSectionInspection = await cdp.eval(`
      (() => {
        const chooseBtn = document.getElementById('nc-choose-cover-btn');
        const chooseText = document.getElementById('nc-choose-cover-text')?.textContent.trim();
        const removeBtn = document.getElementById('nc-remove-cover-btn');
        const previewImg = document.getElementById('nc-cover-preview-img');
        const fileInput = document.getElementById('nc-cover-file-input');
        const hiddenUrl = document.getElementById('nc-cover-url-input');

        // Check that old unwanted elements are completely gone
        const oldDropzoneText = document.querySelector('.dropzone-text');
        const oldDropzoneSub = document.querySelector('.dropzone-sub');
        const oldUrlFallback = document.querySelector('.cover-url-fallback');
        const oldModal = document.getElementById('image-browser-modal');

        return {
          hasChooseBtn: Boolean(chooseBtn),
          chooseText,
          hasRemoveBtn: Boolean(removeBtn),
          removeBtnHidden: removeBtn ? window.getComputedStyle(removeBtn).display === 'none' : true,
          hasPreviewImg: Boolean(previewImg),
          previewSrc: previewImg?.src,
          hasFileInput: Boolean(fileInput && fileInput.type === 'file'),
          hasHiddenUrl: Boolean(hiddenUrl && hiddenUrl.type === 'hidden'),
          oldDropzoneTextExists: Boolean(oldDropzoneText),
          oldDropzoneSubExists: Boolean(oldDropzoneSub),
          oldUrlFallbackExists: Boolean(oldUrlFallback),
          oldModalExists: Boolean(oldModal)
        };
      })()
    `);

    assert('One clear button "Choose Cover Image" exists', coverSectionInspection.hasChooseBtn && coverSectionInspection.chooseText === 'Choose Cover Image');
    assert('Cover preview image exists', coverSectionInspection.hasPreviewImg);
    assert('Cover preview starts with default cover', coverSectionInspection.previewSrc.includes('/default-cover.jpg'));
    assert('Native file input exists', coverSectionInspection.hasFileInput);
    assert('Remove Image button is hidden initially', coverSectionInspection.removeBtnHidden);
    assert('Old dropzone text removed', !coverSectionInspection.oldDropzoneTextExists);
    assert('Old "Upload from computer or reuse media" removed', !coverSectionInspection.oldDropzoneSubExists);
    assert('Old "Or paste Cover Image URL:" input removed', !coverSectionInspection.oldUrlFallbackExists);
    assert('Custom image browser modal does not exist', !coverSectionInspection.oldModalExists);

    // 4. Test Native File Picker Trigger
    console.log('\n--- 2. Testing Direct Native File Picker Trigger ---');
    const filePickerTriggerCheck = await cdp.eval(`
      (() => {
        let clicked = 0;
        const fileInput = document.getElementById('nc-cover-file-input');
        if (!fileInput) return { success: false, reason: 'no input' };
        
        const originalClick = fileInput.click;
        fileInput.click = () => { clicked++; };

        // Click button
        document.getElementById('nc-choose-cover-btn')?.click();

        // Click preview wrapper
        document.getElementById('nc-cover-wrapper')?.click();

        fileInput.click = originalClick;
        return {
          success: true,
          clickCount: clicked
        };
      })()
    `);

    assert('Clicking both button and preview immediately triggers fileInput.click()', filePickerTriggerCheck.success && filePickerTriggerCheck.clickCount === 2);

    // 5. Test Selecting Image & Direct Upload
    console.log('\n--- 3. Testing Direct Upload & Staging Workflow ---');
    const uploadSimResult = await cdp.eval(`
      (async () => {
        // Create 1x1 test PNG File object
        const base64Data = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
        const res = await fetch(base64Data);
        const blob = await res.blob();
        const testFile = new File([blob], 'direct-upload-cover.png', { type: 'image/png' });

        // Trigger handler directly as if user picked file in native dialog
        await handleNovelCoverFileSelected(testFile);
        await new Promise(r => setTimeout(r, 600));

        const previewImg = document.getElementById('nc-cover-preview-img');
        const hiddenUrl = document.getElementById('nc-cover-url-input');
        const removeBtn = document.getElementById('nc-remove-cover-btn');
        const chooseText = document.getElementById('nc-choose-cover-text')?.textContent.trim();

        return {
          previewSrc: previewImg?.src,
          hiddenUrlValue: hiddenUrl?.value,
          removeBtnVisible: removeBtn ? window.getComputedStyle(removeBtn).display !== 'none' : false,
          chooseText
        };
      })()
    `);

    assert('Image uploaded directly and URL saved in hidden input', uploadSimResult.hiddenUrlValue && uploadSimResult.hiddenUrlValue.includes('/uploads/media/'));
    assert('Preview image displays the uploaded URL', uploadSimResult.previewSrc.includes(uploadSimResult.hiddenUrlValue));
    assert('Remove Image button is now visible', uploadSimResult.removeBtnVisible);
    assert('Button text updated to "Replace Cover Image"', uploadSimResult.chooseText === 'Replace Cover Image');

    // 6. Test Remove Image button
    console.log('\n--- 4. Testing Remove Image Action ---');
    const removeResult = await cdp.eval(`
      (() => {
        document.getElementById('nc-remove-cover-btn')?.click();
        const previewImg = document.getElementById('nc-cover-preview-img');
        const hiddenUrl = document.getElementById('nc-cover-url-input');
        const removeBtn = document.getElementById('nc-remove-cover-btn');
        const chooseText = document.getElementById('nc-choose-cover-text')?.textContent.trim();

        return {
          previewSrc: previewImg?.src,
          hiddenUrlValue: hiddenUrl?.value,
          removeBtnHidden: removeBtn ? window.getComputedStyle(removeBtn).display === 'none' : true,
          chooseText
        };
      })()
    `);

    assert('Remove Image resets preview to default-cover.jpg', removeResult.previewSrc.includes('/default-cover.jpg'));
    assert('Hidden input reset to /default-cover.jpg', removeResult.hiddenUrlValue === '/default-cover.jpg');
    assert('Remove Image button is hidden again', removeResult.removeBtnHidden);
    assert('Button text restored to "Choose Cover Image"', removeResult.chooseText === 'Choose Cover Image');

    // 7. Select image again and submit novel to verify MySQL persistence
    console.log('\n--- 5. Testing Novel Submission with Direct Upload Cover in MySQL ---');
    const testNovelSlug = `direct-cov-${Date.now()}`;
    const testNovelTitle = `Direct Cover Novel ${Date.now()}`;

    await cdp.eval(`
      (async () => {
        const base64Data = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
        const res = await fetch(base64Data);
        const blob = await res.blob();
        const testFile = new File([blob], 'persisted-cover.png', { type: 'image/png' });
        await handleNovelCoverFileSelected(testFile);
      })()
    `);
    await sleep(800);

    const uploadedCoverUrl = await cdp.eval(`document.getElementById('nc-cover-url-input')?.value`);

    // Fill required title & submit (slug is auto-generated)
    await cdp.eval(`
      document.getElementById('nc-title').value = '${testNovelTitle}';
      submitNovelCreateForm(false);
    `);
    await sleep(1500);

    const novelInDb = await queryOne('SELECT id, title, cover FROM novels WHERE title = ?;', [testNovelTitle]);
    createdNovelId = novelInDb?.id;
    assert('Novel created successfully in MySQL', Boolean(novelInDb));
    assert('Novel cover in MySQL matches direct uploaded URL', novelInDb?.cover === uploadedCoverUrl);

    // 8. Test Edit Novel Direct Upload
    console.log('\n--- 6. Testing Edit Novel Modal Direct Upload ---');
    await cdp.eval(`openEditNovelModal('${createdNovelId}')`);
    await sleep(800);

    const editModalInspection = await cdp.eval(`
      (() => {
        const chooseBtn = document.getElementById('edit-choose-cover-btn');
        const chooseText = document.getElementById('edit-choose-cover-text')?.textContent.trim();
        const removeBtn = document.getElementById('edit-remove-cover-btn');
        const previewImg = document.getElementById('edit-novel-cover-preview');
        const fileInput = document.getElementById('edit-cover-file-input');
        const hiddenInput = document.getElementById('edit-novel-cover');
        const oldModal = document.getElementById('image-browser-modal');

        return {
          hasChooseBtn: Boolean(chooseBtn),
          chooseText,
          hasRemoveBtn: Boolean(removeBtn),
          hasPreviewImg: Boolean(previewImg),
          hasFileInput: Boolean(fileInput && fileInput.type === 'file'),
          hasHiddenInput: Boolean(hiddenInput && hiddenInput.type === 'hidden'),
          oldModalExists: Boolean(oldModal)
        };
      })()
    `);

    assert('Edit Novel modal has direct "Replace Cover Image" button', editModalInspection.hasChooseBtn && editModalInspection.chooseText.includes('Cover Image'));
    assert('Edit Novel modal has native file input', editModalInspection.hasFileInput);
    assert('No custom image browser modal opened in Edit Novel', !editModalInspection.oldModalExists);

    // Close modal
    await cdp.eval(`closeNovelModal()`);

    ws.close();
  } finally {
    try {
      chromeProc.kill('SIGKILL');
    } catch {}
  }

  // Cleanup test novel
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
