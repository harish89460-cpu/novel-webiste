// Browser Verification Script for Writer Dashboard & Writing UI Redesign
// Pure CDP (Chrome DevTools Protocol) testing real rendered DOM and visual layouts

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createSession } from '../server/auth.js';
import { queryOne } from '../server/db.js';

const ARTIFACT_DIR = 'C:\\Users\\Harish V\\.gemini\\antigravity-ide\\brain\\b16dd30d-d1fd-4723-867c-c8807977fd5f';
const DEBUG_PORT = 9223;

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
  throw new Error('Failed to connect to browser CDP port ' + DEBUG_PORT);
}

class SimpleCdp {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.id = 1;
    this.callbacks = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = reject;
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data.toString());
        if (msg.id && this.callbacks.has(msg.id)) {
          const { resolve, reject } = this.callbacks.get(msg.id);
          this.callbacks.delete(msg.id);
          if (msg.error) reject(msg.error);
          else resolve(msg.result);
        }
      };
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expr) {
    const res = await this.send('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      throw new Error(res.exceptionDetails.exception?.description || 'Eval error');
    }
    return res.result?.value;
  }

  async screenshot(filepath) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(filepath, Buffer.from(res.data, 'base64'));
  }

  async setViewport(width, height) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 768
    });
  }

  close() {
    try { this.ws.close(); } catch {}
  }
}

async function main() {
  console.log('🚀 Launching Headless Browser for Writer Workspace Verification...\n');

  // 1. Ensure test writer exists and generate valid session token
  const writerUser = await queryOne("SELECT id, username, email FROM users WHERE email = 'kavitha.writer@rpnovels.com'");
  if (!writerUser) throw new Error('Test writer kavitha.writer@rpnovels.com not found');
  const token = await createSession(writerUser.id, 'writer');
  console.log(`✓ Active Writer Session Token created for: ${writerUser.username} (ID: ${writerUser.id})`);

  // 2. Launch Browser
  const browserPath = findBrowserBinary();
  if (!browserPath) throw new Error('No Chrome or Edge browser found');

  const userDataDir = path.resolve('scratch/writer_browser_profile');
  fs.mkdirSync(userDataDir, { recursive: true });

  const browserProc = spawn(browserPath, [
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${userDataDir}`,
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1280,800',
    'http://localhost:3000/#home'
  ], { stdio: 'ignore' });

  let cdp = null;
  try {
    const wsUrl = await getWsUrl();
    cdp = new SimpleCdp(wsUrl);
    await cdp.connect();
    console.log('✓ Connected to Browser via CDP');

    await cdp.send('Page.enable');
    await cdp.send('DOM.enable');

    // 3. Inject writer session token into localStorage & navigate to #writer
    await cdp.eval(`
      localStorage.setItem('rp_auth_token', '${token}');
      window.location.hash = '#writer?tab=overview';
      if (window.renderAppView) window.renderAppView();
    `);

    await sleep(2500);

    // 4. Verify Overview Tab UI
    console.log('\n--- VERIFYING OVERVIEW TAB ---');
    const overviewCheck = await cdp.eval(`(() => {
      const headerTitle = document.querySelector('.writer-header-title')?.textContent?.trim();
      const headerSub = document.querySelector('.writer-header-sub')?.textContent?.trim();
      
      // Sidebar items
      const navButtons = Array.from(document.querySelectorAll('.writer-nav-btn')).map(b => b.textContent.trim());
      const hasRichTextNav = navButtons.some(t => t.includes('Rich-Text'));
      
      // Metric Cards
      const metricCards = Array.from(document.querySelectorAll('.writer-metric-card')).map(c => ({
        label: c.querySelector('.writer-metric-label')?.textContent?.trim(),
        value: c.querySelector('.writer-metric-value')?.textContent?.trim()
      }));

      // Workflow clutter card check
      const pageText = document.body.innerText;
      const hasWorkflowCard = pageText.includes('Writer Publishing Workflow');

      // Recent novels section
      const hasRecentSection = Boolean(document.querySelector('.writer-card-title'));

      return {
        headerTitle,
        headerSub,
        navButtons,
        hasRichTextNav,
        metricCards,
        hasWorkflowCard,
        hasRecentSection
      };
    })()`);

    console.log('  Header Title:', overviewCheck.headerTitle);
    console.log('  Header Subtitle:', overviewCheck.headerSub);
    console.log('  Sidebar Navigation Items Count:', overviewCheck.navButtons.length);
    console.log('  Sidebar Items:', overviewCheck.navButtons);
    console.log('  Contains duplicate "Rich-Text Editor" in nav?:', overviewCheck.hasRichTextNav);
    console.log('  Metrics Cards:', overviewCheck.metricCards);
    console.log('  Contains bulky "Writer Publishing Workflow" banner?:', overviewCheck.hasWorkflowCard);

    // Assertions for Overview
    if (overviewCheck.headerTitle !== 'Writer Dashboard') {
      throw new Error(`Expected header title "Writer Dashboard", got "${overviewCheck.headerTitle}"`);
    }
    if (overviewCheck.hasRichTextNav) {
      throw new Error('Sidebar nav must not contain duplicate Rich-Text Editor item');
    }
    if (overviewCheck.hasWorkflowCard) {
      throw new Error('Writer Publishing Workflow info card should have been removed from main dashboard');
    }

    const pubCard = overviewCheck.metricCards.find(m => m.label?.toLowerCase().includes('published novels'));
    if (!pubCard) throw new Error('Published Novels metric card missing');
    if (pubCard.value.includes('undefined')) {
      throw new Error(`Published Novels card displays undefined! (${pubCard.value})`);
    }
    console.log('  ✓ Published Novels Card Value is valid:', pubCard.value);

    // Save Overview Screenshot
    const overviewImgPath = path.join(ARTIFACT_DIR, 'writer_overview_desktop.png');
    await cdp.screenshot(overviewImgPath);
    console.log('  ✓ Desktop Overview screenshot saved:', overviewImgPath);

    // 5. Test Novel Writing Form
    console.log('\n--- VERIFYING WRITE NOVEL TAB ---');
    await cdp.eval(`switchWriterTab('write');`);
    await sleep(1000);

    const writeTabCheck = await cdp.eval(`(() => {
      const pageTitle = document.getElementById('wn-header-title')?.textContent?.trim();
      const saveStatus = document.getElementById('wn-save-status')?.textContent?.trim();
      const titleInput = Boolean(document.getElementById('wn-title'));
      const genreInput = Boolean(document.getElementById('wn-genre'));
      const coverInput = Boolean(document.getElementById('wn-cover'));
      const descInput = Boolean(document.getElementById('wn-description'));
      const saveBtn = Boolean(document.getElementById('wn-save-btn'));
      const previewBtn = Boolean(document.querySelector("button[onclick*='previewWriterNovel']"));

      return {
        pageTitle,
        saveStatus,
        titleInput,
        genreInput,
        coverInput,
        descInput,
        saveBtn,
        previewBtn
      };
    })()`);

    console.log('  Write Novel Page Title:', writeTabCheck.pageTitle);
    console.log('  Save Status:', writeTabCheck.saveStatus);
    console.log('  Essential Form Inputs Present:', {
      title: writeTabCheck.titleInput,
      genre: writeTabCheck.genreInput,
      cover: writeTabCheck.coverInput,
      description: writeTabCheck.descInput
    });

    if (!writeTabCheck.titleInput || !writeTabCheck.genreInput || !writeTabCheck.coverInput || !writeTabCheck.descInput) {
      throw new Error('Essential form inputs missing on Write Novel page');
    }

    // Save Write Novel Screenshot
    const writeImgPath = path.join(ARTIFACT_DIR, 'writer_write_novel.png');
    await cdp.screenshot(writeImgPath);
    console.log('  ✓ Write Novel screenshot saved:', writeImgPath);

    // 6. Test Manage Episodes & Rich-Text Editor
    console.log('\n--- VERIFYING MANAGE EPISODES & WRITING EDITOR ---');
    await cdp.eval(`switchWriterTab('episodes');`);
    await sleep(1000);

    // Open editor
    await cdp.eval(`openNewEpisodeForCurrentNovel();`);
    await sleep(1000);

    const editorCheck = await cdp.eval(`(() => {
      const pageTitle = document.getElementById('we-page-title')?.textContent?.trim();
      const saveStatus = document.getElementById('we-save-status')?.textContent?.trim();
      const epNumInput = Boolean(document.getElementById('we-number'));
      const epTitleInput = Boolean(document.getElementById('we-title'));
      const toolbarButtons = Array.from(document.querySelectorAll('.writer-toolbar-btn')).map(b => b.title || b.textContent.trim());
      const canvas = document.getElementById('we-canvas');
      const counter = document.getElementById('we-word-counter')?.textContent?.trim();

      return {
        pageTitle,
        saveStatus,
        epNumInput,
        epTitleInput,
        toolbarButtonsCount: toolbarButtons.length,
        canvasPresent: Boolean(canvas),
        canvasEditable: canvas?.getAttribute('contenteditable') === 'true',
        counter
      };
    })()`);

    console.log('  Editor Page Title:', editorCheck.pageTitle);
    console.log('  Editor Save Status:', editorCheck.saveStatus);
    console.log('  Toolbar Formats Count:', editorCheck.toolbarButtonsCount);
    console.log('  Writing Canvas Editable?:', editorCheck.canvasEditable);
    console.log('  Live Counter:', editorCheck.counter);

    if (!editorCheck.canvasPresent || !editorCheck.canvasEditable) {
      throw new Error('Writing canvas missing or not editable');
    }

    // Test typing and formatting in canvas
    await cdp.eval(`(() => {
      const canvas = document.getElementById('we-canvas');
      canvas.innerHTML = '<p><strong>Chapter 1: The Golden Whispers</strong></p><p>The morning mist rolled over the emerald hills of the southern valleys as Ananya stood by the courtyard.</p>';
      handleStoryInput();
    })()`);
    await sleep(400);

    const afterTypeCheck = await cdp.eval(`(() => {
      return {
        counter: document.getElementById('we-word-counter')?.textContent?.trim(),
        saveStatus: document.getElementById('we-save-status')?.textContent?.trim()
      };
    })()`);
    console.log('  Counter After Typing:', afterTypeCheck.counter);
    console.log('  Status After Typing:', afterTypeCheck.saveStatus);

    // Save Editor Screenshot
    const editorImgPath = path.join(ARTIFACT_DIR, 'writer_editor_desktop.png');
    await cdp.screenshot(editorImgPath);
    console.log('  ✓ Writing Editor screenshot saved:', editorImgPath);

    // 7. Test Reader Preview Modal
    console.log('\n--- VERIFYING READER PREVIEW MODAL ---');
    await cdp.eval(`previewWriterEditorContent();`);
    await sleep(600);

    const previewCheck = await cdp.eval(`(() => {
      const modal = document.querySelector('.writer-preview-modal');
      const title = document.getElementById('wpreview-title')?.textContent?.trim();
      const article = document.querySelector('.reader-formatted-content')?.innerHTML;
      const closeBtn = Boolean(document.querySelector("button[onclick*='closeReaderPreviewModal']"));

      return {
        modalPresent: Boolean(modal),
        title,
        hasFormattedText: article?.includes('Golden Whispers'),
        closeBtn
      };
    })()`);

    console.log('  Reader Preview Modal Present?:', previewCheck.modalPresent);
    console.log('  Preview Title:', previewCheck.title);
    console.log('  Formatted Content Preserved?:', previewCheck.hasFormattedText);

    if (!previewCheck.modalPresent || !previewCheck.hasFormattedText) {
      throw new Error('Reader Preview Modal failed to render formatted content');
    }

    // Save Preview Screenshot
    const previewImgPath = path.join(ARTIFACT_DIR, 'writer_reader_preview.png');
    await cdp.screenshot(previewImgPath);
    console.log('  ✓ Reader Preview screenshot saved:', previewImgPath);

    // Close preview modal
    await cdp.eval(`closeReaderPreviewModal();`);
    await sleep(400);

    // 8. Test Responsive Viewports (320px, 360px, 390px, 430px, 768px, 1024px, 1280px, 1920px)
    console.log('\n--- VERIFYING RESPONSIVE VIEWPORTS ---');
    const viewports = [
      { name: '320px Ultra Mobile', width: 320, height: 600 },
      { name: '360px Mobile', width: 360, height: 740 },
      { name: '390px iPhone', width: 390, height: 844 },
      { name: '430px Large Mobile', width: 430, height: 932 },
      { name: '768px iPad Portrait', width: 768, height: 1024 },
      { name: '1024px iPad Landscape', width: 1024, height: 768 },
      { name: '1280px Desktop', width: 1280, height: 800 },
      { name: '1920px Full HD', width: 1920, height: 1080 }
    ];

    await cdp.eval(`
      writerState.editorDirty = false;
      switchWriterTab('overview');
    `);
    await sleep(500);

    for (const vp of viewports) {
      await cdp.setViewport(vp.width, vp.height);
      await sleep(300);

      const overflow = await cdp.eval(`(() => {
        const docWidth = document.documentElement.clientWidth;
        const scrollWidth = document.documentElement.scrollWidth;
        const bodyScroll = document.body.scrollWidth;
        const canvas = document.getElementById('writer-main-canvas');
        return {
          clientWidth: docWidth,
          scrollWidth: Math.max(scrollWidth, bodyScroll),
          hasOverflow: Math.max(scrollWidth, bodyScroll) > docWidth + 2,
          canvasWidth: canvas?.offsetWidth || 0
        };
      })()`);

      console.log(`  [${vp.name}] client: ${overflow.clientWidth}px, scroll: ${overflow.scrollWidth}px, overflow: ${overflow.hasOverflow ? 'YES (FAIL)' : 'NO (PASS)'}`);
      if (overflow.hasOverflow) {
        throw new Error(`Horizontal overflow detected at ${vp.name}: ${overflow.scrollWidth} > ${overflow.clientWidth}`);
      }

      if (vp.width === 390) {
        const mobileImgPath = path.join(ARTIFACT_DIR, 'writer_overview_mobile_390px.png');
        await cdp.screenshot(mobileImgPath);
        console.log('    ✓ Mobile screenshot saved:', mobileImgPath);
      }
    }

    console.log('\n🎉 ALL BROWSER & VISUAL TESTS PASSED WITH 100% SUCCESS!');
  } finally {
    if (cdp) cdp.close();
    browserProc.kill();
  }
}

main().catch(err => {
  console.error('\n❌ Browser Test Failed:', err);
  process.exit(1);
});
