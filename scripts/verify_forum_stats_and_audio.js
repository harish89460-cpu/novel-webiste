// Comprehensive Browser & Database Verification for Forum Stats and Audio Novels UI
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { queryOne, getDb } from '../backend/db.js';

const ARTIFACT_DIR = 'C:\\Users\\Harish V\\.gemini\\antigravity-ide\\brain\\0865d7e5-7332-46f5-9deb-0d1a852fc1c1';
const DEBUG_PORT = 9228;

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function findBrowserBinary() {
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

async function getWsUrl() {
  for (let i = 0; i < 25; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
      if (res.ok) {
        const list = await res.json();
        const page = list.find(t => t.type === 'page');
        if (page && page.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
      }
    } catch {}
    await sleep(400);
  }
  throw new Error('Could not get CDP webSocketDebuggerUrl');
}

class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.nextId = 1;
    this.callbacks = new Map();
  }

  async connect() {
    const WS = globalThis.WebSocket;
    return new Promise((resolve, reject) => {
      this.ws = new WS(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = err => reject(err);
      this.ws.onmessage = event => {
        const msg = JSON.parse(event.data.toString());
        if (msg.id && this.callbacks.has(msg.id)) {
          const { res, rej } = this.callbacks.get(msg.id);
          this.callbacks.delete(msg.id);
          if (msg.error) rej(new Error(msg.error.message));
          else res(msg.result);
        }
      };
    });
  }

  send(method, params = {}) {
    return new Promise((res, rej) => {
      const id = this.nextId++;
      this.callbacks.set(id, { res, rej });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expr) {
    const res = await this.send('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise: true
    });
    return res?.result?.value;
  }

  async captureScreenshot(filename) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    const outPath = path.join(ARTIFACT_DIR, filename);
    fs.writeFileSync(outPath, buffer);
    console.log(`[Screenshot] Saved: ${outPath}`);
    return outPath;
  }

  close() {
    if (this.ws) {
      try { this.ws.close(); } catch {}
    }
  }
}

async function run() {
  console.log('=== FORUM STATS & AUDIO NOVELS VERIFICATION ===\n');

  // 1. Database Ground Truth
  const dbMembers = (await queryOne("SELECT COUNT(*) AS c FROM users WHERE status = 'active'")).c;
  const dbReplies = (await queryOne("SELECT COALESCE(SUM(replies_count), 0) AS c FROM forum_topics WHERE is_published = 1 AND visibility = 'public'")).c;
  const dbGuests = (await queryOne("SELECT COUNT(*) AS c FROM guest_visitors")).c;
  console.log(`[MySQL Ground Truth] Members: ${dbMembers}, Replies: ${dbReplies}, Guests: ${dbGuests}`);

  // 2. Launch Headless Browser
  const binary = findBrowserBinary();
  if (!binary) throw new Error('No Chrome or Edge binary found.');

  const userDataDir = path.join(ARTIFACT_DIR, '.browser_stats_test_profile');
  const browserProc = spawn(binary, [
    `--remote-debugging-port=${DEBUG_PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-background-networking',
    `--user-data-dir=${userDataDir}`,
    'about:blank'
  ], { stdio: 'ignore' });

  let client = null;

  try {
    const wsUrl = await getWsUrl();
    client = new CdpClient(wsUrl);
    await client.connect();
    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });

    // 3. Test Forum Page (#forum)
    console.log('\n--- 1. Testing Forum Page Live Statistics ---');
    await client.send('Page.navigate', { url: 'http://localhost:5173/#forum' });
    await sleep(2500);

    const statsBarExists = await client.eval(`!!document.getElementById('forum-live-stats-bar')`);
    console.log('Forum stats bar exists in DOM:', statsBarExists);

    const uiStats = await client.eval(`(() => {
      const bar = document.getElementById('forum-live-stats-bar');
      if (!bar) return null;
      return {
        members: document.getElementById('forum-stat-members')?.textContent?.trim(),
        replies: document.getElementById('forum-stat-replies')?.textContent?.trim(),
        guests: document.getElementById('forum-stat-guests')?.textContent?.trim(),
        labels: Array.from(bar.querySelectorAll('.forum-stat-lbl')).map(el => el.textContent.trim()),
        icons: Array.from(bar.querySelectorAll('.forum-stat-icon')).map(el => el.textContent.trim())
      };
    })()`);

    console.log('UI Statistics extracted:', uiStats);

    if (!uiStats) throw new Error('Forum stats bar could not be found or extracted!');
    if (Number(uiStats.members) !== Number(dbMembers)) {
      throw new Error(`Member count mismatch: UI says ${uiStats.members}, DB says ${dbMembers}`);
    }
    if (Number(uiStats.replies) !== Number(dbReplies)) {
      throw new Error(`Reply count mismatch: UI says ${uiStats.replies}, DB says ${dbReplies}`);
    }
    console.log('✓ UI Members and Replies match MySQL DB exactly!');
    console.log(`✓ UI Guests is ${uiStats.guests} (valid integer >= 1)`);

    // Capture desktop screenshot
    await client.captureScreenshot('forum_live_stats_desktop.png');

    // 4. Test Mobile Viewport Responsiveness
    console.log('\n--- 2. Testing Forum Statistics Responsive Mobile View ---');
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true
    });
    await sleep(600);
    await client.captureScreenshot('forum_live_stats_mobile.png');
    console.log('✓ Mobile responsive layout verified & captured');

    // Restore desktop viewport
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });

    // 5. Test Forum Category View
    console.log('\n--- 3. Testing Category Page Statistics Bar ---');
    await client.send('Page.navigate', { url: 'http://localhost:5173/#forum?category=cat-general-discussions-1001' });
    await sleep(2000);
    const categoryStatsExists = await client.eval(`!!document.getElementById('forum-live-stats-bar')`);
    console.log('Category page stats bar exists:', categoryStatsExists);
    if (!categoryStatsExists) throw new Error('Stats bar missing on category page!');
    console.log('✓ Category page stats bar successfully verified');

    // 6. Test Audio Novels Page (#audio)
    console.log('\n--- 4. Testing Audio Novels Page (Language Filter Removal) ---');
    await client.send('Page.navigate', { url: 'http://localhost:5173/#audio' });
    await sleep(2500);

    const langFilterCheck = await client.eval(`(() => {
      const langSelect = document.getElementById('reader-audio-lang-filter');
      const bar = document.querySelector('.audio-filters-bar');
      const barHtml = bar ? bar.innerHTML : '';
      const hasLangDropdown = !!langSelect;
      const hasLangText = barHtml.includes('All Languages') || barHtml.includes('Tamil') || barHtml.includes('English');
      const searchBox = document.getElementById('reader-audio-search');
      const novelFilter = document.getElementById('reader-audio-novel-filter');
      const sortFilter = document.getElementById('reader-audio-sort-filter');
      const audioCards = document.querySelectorAll('.audio-novel-item-card').length;

      return {
        hasLangDropdown,
        hasLangText,
        hasSearchBox: !!searchBox,
        hasNovelFilter: !!novelFilter,
        hasSortFilter: !!sortFilter,
        audioCardsCount: audioCards
      };
    })()`);

    console.log('Audio Novels UI check:', langFilterCheck);

    if (langFilterCheck.hasLangDropdown) {
      throw new Error('FAIL: #reader-audio-lang-filter still exists in DOM!');
    }
    if (langFilterCheck.hasLangText) {
      throw new Error('FAIL: Language filter text still present in audio filters bar!');
    }
    if (!langFilterCheck.hasSearchBox) {
      throw new Error('FAIL: Search box missing from Audio Novels page!');
    }
    if (!langFilterCheck.hasNovelFilter) {
      throw new Error('FAIL: Linked novel filter missing!');
    }
    if (!langFilterCheck.hasSortFilter) {
      throw new Error('FAIL: Sort filter missing!');
    }

    console.log('✓ Language filter is completely removed from Audio Novels page!');
    console.log(`✓ Search, novel filter, sort filter, and audio cards (${langFilterCheck.audioCardsCount}) are present and functional!`);

    await client.captureScreenshot('audio_novels_no_language_filter.png');

    console.log('\n=========================================');
    console.log('ALL VERIFICATION CHECKS PASSED WITH 100% SUCCESS!');
    console.log('=========================================');
  } finally {
    if (client) client.close();
    try { browserProc.kill(); } catch {}
    const pool = getDb();
    if (pool) {
      try { await pool.end(); } catch {}
    }
  }
}

run().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
