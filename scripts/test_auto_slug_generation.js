// Automated test for Auto Slug Generation and Removal of Novel URL/Slug Input Field
// Rudhra Prarthana Novels

import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { query, queryOne } from '../server/db.js';
import { generateNovelSlug, transliterateTamil } from '../server/novels.js';
import { createSession } from '../server/auth.js';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEBUG_PORT = 9223; // use isolated port
const USER_DATA_DIR = path.resolve('scratch/chrome_profile_slug_test');

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function makeRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: body });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
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

async function runTests() {
  console.log('======================================================================');
  console.log('STARTING AUTO SLUG GENERATION & SLUG FIELD REMOVAL TESTS');
  console.log('======================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failed++;
    }
  }

  const createdTestNovels = [];
  let chromeProc = null;

  try {
    // -------------------------------------------------------------------------
    console.log('--- 1. Testing Slug Generation Logic ---');
    // -------------------------------------------------------------------------
    const englishTitle = 'The Beginning of Dawn';
    const englishSlug = generateNovelSlug(englishTitle);
    assert(englishSlug === 'the-beginning-of-dawn', `English: "${englishTitle}" → "${englishSlug}" (expected "the-beginning-of-dawn")`);

    const tamilTitle = 'என் காதல் கதை';
    const tamilSlug = generateNovelSlug(tamilTitle);
    assert(tamilSlug === 'en-kaathal-kathai', `Tamil: "${tamilTitle}" → "${tamilSlug}" (expected "en-kaathal-kathai")`);

    const mixedTitle = 'Rudhra Prarthana — காதல் மழை';
    const mixedSlug = generateNovelSlug(mixedTitle);
    assert(mixedSlug.includes('rudhra-prarthana') && mixedSlug.includes('kaathal'), `Mixed title: "${mixedTitle}" → "${mixedSlug}"`);

    // -------------------------------------------------------------------------
    console.log('\n--- 2. Static File Verification: Slug Field Completely Removed ---');
    // -------------------------------------------------------------------------
    const adminJs = fs.readFileSync('src/js/admin.js', 'utf8');
    const adminCss = fs.readFileSync('src/css/admin.css', 'utf8');

    // Verify Create Novel template does not render nc-slug or slug inputs
    assert(!adminJs.includes('id="nc-slug"'), 'admin.js: id="nc-slug" is removed from form template');
    assert(!adminJs.includes('class="slug-input-wrap"'), 'admin.js: class="slug-input-wrap" is removed from form template');
    assert(!adminJs.includes('class="slug-prefix"'), 'admin.js: class="slug-prefix" is removed from form template');
    assert(!adminJs.includes('id="nc-slug-error"'), 'admin.js: id="nc-slug-error" is removed from form template');
    assert(!adminJs.includes('Novel URL / Slug'), 'admin.js: "Novel URL / Slug" label text is removed');
    assert(!adminCss.includes('.slug-input-wrap'), 'admin.css: .slug-input-wrap CSS rule is removed');
    assert(!adminCss.includes('.slug-prefix'), 'admin.css: .slug-prefix CSS rule is removed');

    // -------------------------------------------------------------------------
    console.log('\n--- 3. Testing Live Browser DOM via Headless Chrome ---');
    // -------------------------------------------------------------------------
    if (!fs.existsSync('scratch')) fs.mkdirSync('scratch', { recursive: true });

    chromeProc = spawn(CHROME_PATH, [
      '--headless=new',
      `--remote-debugging-port=${DEBUG_PORT}`,
      `--user-data-dir=${USER_DATA_DIR}`,
      '--disable-gpu',
      '--no-sandbox',
      '--window-size=1280,800'
    ]);

    await sleep(1500);

    const wsUrl = await getWsUrl();
    const ws = new WebSocket(wsUrl);
    await new Promise(r => ws.onopen = r);
    const cdp = new CdpClient(ws);

    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

    // Initial navigation to localhost:5173
    await cdp.send('Page.navigate', { url: 'http://localhost:5173/' });
    await sleep(1500);

    // Perform real admin login in page context
    await cdp.eval(`
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
            return { success: true };
          }
          return { success: false, error: data.error };
        } catch (err) {
          return { success: false, error: err.message };
        }
      })()
    `);
    await sleep(2000);

    // Switch to novel-create tab
    await cdp.eval(`
      if (typeof window.switchAdminTab === 'function') {
        window.switchAdminTab('novel-create');
      }
    `);
    
    // Wait up to 5s for the form to render
    let liveDomCheck = null;
    for (let i = 0; i < 20; i++) {
      await sleep(250);
      liveDomCheck = await cdp.eval(`
        (() => {
          const titleInput = document.getElementById('nc-title');
          if (!titleInput) return null;
          const slugInput = document.getElementById('nc-slug');
          const slugWrap = document.querySelector('.slug-input-wrap');
          const slugPrefix = document.querySelector('.slug-prefix');
          const slugError = document.getElementById('nc-slug-error');
          const shortDesc = document.getElementById('nc-short-desc');

          return {
            hasSlugInput: !!slugInput,
            hasSlugWrap: !!slugWrap,
            hasSlugPrefix: !!slugPrefix,
            hasSlugError: !!slugError,
            hasTitleInput: !!titleInput,
            hasShortDesc: !!shortDesc
          };
        })()
      `);
      if (liveDomCheck) break;
    }

    assert(liveDomCheck && !liveDomCheck.hasSlugInput, 'Live Browser: #nc-slug input is NOT present in Create Novel form');
    assert(liveDomCheck && !liveDomCheck.hasSlugWrap, 'Live Browser: .slug-input-wrap container is NOT present');
    assert(liveDomCheck && !liveDomCheck.hasSlugPrefix, 'Live Browser: .slug-prefix is NOT present');
    assert(liveDomCheck && !liveDomCheck.hasSlugError, 'Live Browser: #nc-slug-error is NOT present');
    assert(liveDomCheck && liveDomCheck.hasTitleInput, 'Live Browser: Novel Title input (#nc-title) is present');
    assert(liveDomCheck && liveDomCheck.hasShortDesc, 'Live Browser: Short Description (#nc-short-desc) directly follows');

    ws.close();

    // -------------------------------------------------------------------------
    console.log('\n--- 4. Testing Backend Auto-Slug Generation (No Slug Sent by Client) ---');
    // -------------------------------------------------------------------------
    // Clean up any previous test remnants first
    await query("DELETE FROM novels WHERE id LIKE 'the-beginning-of-dawn%' OR id LIKE 'en-kaathal-kathai%'");

    // Use direct valid author session
    const token = await createSession(2, 'author');
    assert(!!token, 'Admin author session generated successfully');

    // Create Novel 1: English Title without slug or id in body
    const createRes1 = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/novels',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }, {
      title: 'The Beginning of Dawn',
      author: 'Rudhra Prarthana',
      genre: 'Romance / Drama',
      description: 'A captivating romance journey that begins at dawn.',
      status: 'Ongoing',
      visibility: 'public'
    });

    assert(createRes1.status === 201 && createRes1.data.success, 'Novel 1 created successfully via POST /api/novels');
    assert(createRes1.data.novel && createRes1.data.novel.id === 'the-beginning-of-dawn', `Novel 1 generated slug: "${createRes1.data.novel?.id}" (expected "the-beginning-of-dawn")`);
    createdTestNovels.push(createRes1.data.novel?.id);

    // Verify in MySQL
    const dbRow1 = await queryOne('SELECT * FROM novels WHERE id = ?', ['the-beginning-of-dawn']);
    assert(dbRow1 && dbRow1.id === 'the-beginning-of-dawn', 'MySQL: Novel 1 record exists with primary key "the-beginning-of-dawn"');
    assert(dbRow1 && dbRow1.link === '#novel?id=the-beginning-of-dawn', `MySQL: Public link is "${dbRow1?.link}"`);

    // -------------------------------------------------------------------------
    console.log('\n--- 5. Testing Duplicate Slug Collision Resolution ---');
    // -------------------------------------------------------------------------
    // Create Novel 2 with EXACT SAME TITLE: 'The Beginning of Dawn'
    const createRes2 = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/novels',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }, {
      title: 'The Beginning of Dawn',
      author: 'Rudhra Prarthana',
      genre: 'Drama',
      description: 'Second edition with duplicate title.'
    });

    assert(createRes2.status === 201 && createRes2.data.success, 'Novel 2 created successfully without error');
    assert(createRes2.data.novel && createRes2.data.novel.id === 'the-beginning-of-dawn-2', `Duplicate collision safely resolved to: "${createRes2.data.novel?.id}" (expected "the-beginning-of-dawn-2")`);
    createdTestNovels.push(createRes2.data.novel?.id);

    // Verify both exist independently in MySQL
    const allDawns = await query("SELECT id FROM novels WHERE id LIKE 'the-beginning-of-dawn%' ORDER BY id ASC");
    assert(allDawns.length === 2, `MySQL: Both novels exist independently (found ${allDawns.length})`);

    // -------------------------------------------------------------------------
    console.log('\n--- 6. Testing Tamil Title Auto-Slug in Backend ---');
    // -------------------------------------------------------------------------
    const createTamil = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/novels',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }, {
      title: 'என் காதல் கதை',
      author: 'Rudhra Prarthana',
      genre: 'Tamil Romance',
      description: 'உணர்ச்சிப்பூர்வமான குடும்பக் கதை.'
    });

    assert(createTamil.status === 201 && createTamil.data.success, 'Tamil novel created successfully');
    assert(createTamil.data.novel && createTamil.data.novel.id === 'en-kaathal-kathai', `Tamil novel generated slug: "${createTamil.data.novel?.id}" (expected "en-kaathal-kathai")`);
    createdTestNovels.push(createTamil.data.novel?.id);

    const dbTamil = await queryOne('SELECT * FROM novels WHERE id = ?', ['en-kaathal-kathai']);
    assert(dbTamil && dbTamil.id === 'en-kaathal-kathai', 'MySQL: Tamil novel saved with clean URL-safe slug');
    assert(dbTamil && dbTamil.title === 'என் காதல் கதை', 'MySQL: Tamil unicode title stored accurately');

    // -------------------------------------------------------------------------
    console.log('\n--- 7. Testing Edit Novel: Slug Preservation ---');
    // -------------------------------------------------------------------------
    // Update Novel 1 title to "The Beginning of Dawn (Revised)"
    // Verify that the slug / ID is NOT altered, preserving shared links!
    const updateRes = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/novels/the-beginning-of-dawn',
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }, {
      title: 'The Beginning of Dawn (Revised Edition)',
      genre: 'Epic Romance',
      description: 'Updated description for the revised edition.'
    });

    assert(updateRes.status === 200 && updateRes.data.success, 'Edit novel updated successfully');
    const dbRowUpdated = await queryOne('SELECT * FROM novels WHERE id = ?', ['the-beginning-of-dawn']);
    assert(dbRowUpdated && dbRowUpdated.id === 'the-beginning-of-dawn', 'Slug preserved: ID remains "the-beginning-of-dawn"');
    assert(dbRowUpdated && dbRowUpdated.title === 'The Beginning of Dawn (Revised Edition)', 'Title updated accurately in database');

    // -------------------------------------------------------------------------
    console.log('\n--- 8. Testing Public Novel Routing & Retrieval by Auto Slug ---');
    // -------------------------------------------------------------------------
    const getPublicRes = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/novels/the-beginning-of-dawn',
      method: 'GET'
    });
    assert(getPublicRes.status === 200 && getPublicRes.data.success, 'Public route GET /api/novels/the-beginning-of-dawn works');
    assert(getPublicRes.data.novel && getPublicRes.data.novel.id === 'the-beginning-of-dawn', 'Retrieved novel matches auto-generated slug');

    const getTamilRes = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/novels/en-kaathal-kathai',
      method: 'GET'
    });
    assert(getTamilRes.status === 200 && getTamilRes.data.success, 'Public route GET /api/novels/en-kaathal-kathai works');

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    if (chromeProc) {
      try { chromeProc.kill(); } catch {}
    }
    // Clean up created test novels from MySQL
    for (const testId of createdTestNovels) {
      if (testId) {
        await query('DELETE FROM novels WHERE id = ?', [testId]);
      }
    }
    console.log(`\nCleaned up ${createdTestNovels.length} test novel(s) from MySQL.`);
  }

  console.log('\n======================================================================');
  console.log(`AUTO SLUG TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(e => {
  console.error(e);
  process.exit(1);
});
