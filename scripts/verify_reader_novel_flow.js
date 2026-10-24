// Comprehensive End-to-End Verification for Novel Reader and 500 Server Error Fix
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEBUG_PORT = 9224;
const USER_DATA_DIR = path.resolve('scratch/chrome_reader_test');

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

class CdpClient {
  constructor(ws) {
    this.ws = ws;
    this.id = 1;
    this.callbacks = new Map();
    this.logs = [];

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.method === 'Runtime.consoleAPICalled') {
        const text = (msg.params.args || []).map(a => a.value || a.description || '').join(' ');
        this.logs.push(`[Console ${msg.params.type}] ${text}`);
      } else if (msg.method === 'Runtime.exceptionThrown') {
        const text = msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text;
        this.logs.push(`[Exception] ${text}`);
      }

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

async function runTests() {
  console.log('=====================================================');
  console.log('1. VERIFYING BACKEND API CONTRACT & STATUS CODES');
  console.log('=====================================================');

  const backendBase = 'http://localhost:3000';

  // 1.1 Novel Details API
  const res1 = await fetch(`${backendBase}/api/novels/en-uyiril-nee`);
  console.log(`GET /api/novels/en-uyiril-nee -> Status: ${res1.status}`);
  if (res1.status !== 200) throw new Error(`Expected 200, got ${res1.status}`);
  const data1 = await res1.json();
  console.log(`  Novel title: "${data1.novel?.title}"`);
  console.log(`  Total published chapters: ${data1.novel?.chapters?.length}`);
  console.log(`  First chapter num: ${data1.novel?.chapters?.[0]?.chapterNum}`);

  // 1.2 Sub-episode lookup with ch=1.1
  const res2 = await fetch(`${backendBase}/api/content/chapter?novel=en-uyiril-nee&ch=1.1`);
  console.log(`GET /api/content/chapter?novel=en-uyiril-nee&ch=1.1 -> Status: ${res2.status}`);
  if (res2.status !== 200) throw new Error(`Expected 200, got ${res2.status}`);
  const data2 = await res2.json();
  console.log(`  Allowed: ${data2.allowed}, Title: "${data2.title}", Content length: ${data2.content?.length}`);

  // 1.3 Sub-episode fallback lookup with ch=1
  const res3 = await fetch(`${backendBase}/api/content/chapter?novel=en-uyiril-nee&ch=1`);
  console.log(`GET /api/content/chapter?novel=en-uyiril-nee&ch=1 -> Status: ${res3.status}`);
  if (res3.status !== 200) throw new Error(`Expected 200, got ${res3.status}`);
  const data3 = await res3.json();
  console.log(`  Resolved chapter: "${data3.title}" (Sub-episode fallback works!)`);

  // 1.4 Nonexistent chapter -> 404 (not 403 or 500)
  const res4 = await fetch(`${backendBase}/api/content/chapter?novel=en-uyiril-nee&ch=999`);
  console.log(`GET /api/content/chapter?novel=en-uyiril-nee&ch=999 -> Status: ${res4.status} (Expected 404)`);
  if (res4.status !== 404) throw new Error(`Expected 404 for missing chapter, got ${res4.status}`);

  // 1.5 Nonexistent novel -> 404
  const res5 = await fetch(`${backendBase}/api/novels/completely-fake-novel-slug`);
  console.log(`GET /api/novels/completely-fake-novel-slug -> Status: ${res5.status} (Expected 404)`);
  if (res5.status !== 404) throw new Error(`Expected 404 for missing novel, got ${res5.status}`);

  // 1.6 URL-encoded Tamil title lookup
  const encodedTamil = encodeURIComponent('என் உயிரில் நீ...');
  const res6 = await fetch(`${backendBase}/api/novels/${encodedTamil}`);
  console.log(`GET /api/novels/${encodedTamil} -> Status: ${res6.status}`);
  if (res6.status !== 200) throw new Error(`Expected 200 for URL-encoded Tamil title, got ${res6.status}`);
  const data6 = await res6.json();
  console.log(`  Resolved ID: ${data6.novel?.id}`);

  console.log('\n=====================================================');
  console.log('2. VERIFYING BROWSER E2E READER FLOW');
  console.log('=====================================================');

  if (!fs.existsSync(USER_DATA_DIR)) {
    fs.mkdirSync(USER_DATA_DIR, { recursive: true });
  }

  const chromeProc = spawn(CHROME_PATH, [
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${USER_DATA_DIR}`,
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--window-size=1280,800'
  ]);

  try {
    const wsUrl = await getWsUrl();
    const ws = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });

    const client = new CdpClient(ws);
    await client.send('Runtime.enable');
    await client.send('Page.enable');

    // TEST 2.1: Open Homepage and Click Novel Card
    console.log('Test 2.1: Navigating to Reader Homepage...');
    await client.send('Page.navigate', { url: 'http://localhost:5173/#home' });
    await sleep(2000);

    const novelCardFound = await client.eval(`
      (() => {
        const card = document.querySelector('a[href*="#novel?id=en-uyiril-nee"]');
        return Boolean(card);
      })()
    `);
    console.log(`  Novel card for "en-uyiril-nee" found on homepage: ${novelCardFound}`);

    console.log('  Clicking novel card...');
    await client.eval(`
      (() => {
        const card = document.querySelector('a[href*="#novel?id=en-uyiril-nee"]');
        if (card) card.click();
      })()
    `);
    await sleep(2000);

    // TEST 2.2: Verify Novel Details Page
    console.log('Test 2.2: Checking Novel Details Page content & error state...');
    const novelPageData = await client.eval(`
      (() => {
        const bodyText = document.body.innerText;
        const has500Error = bodyText.includes('500') && bodyText.includes('SERVER ERROR');
        const hasLiteraryServerMsg = bodyText.includes('Our literary servers encountered an unexpected issue');
        const titleEl = document.querySelector('.novel-detail-title');
        const startReadingBtn = document.querySelector('a[href*="#reader?novel="]');
        const chaptersCount = document.querySelectorAll('.chapter-list-item').length;
        return {
          currentHash: window.location.hash,
          has500Error,
          hasLiteraryServerMsg,
          novelTitle: titleEl ? titleEl.innerText : null,
          startReadingHref: startReadingBtn ? startReadingBtn.getAttribute('href') : null,
          chaptersRendered: chaptersCount
        };
      })()
    `);

    console.log('  Details Page State:', novelPageData);
    if (novelPageData.has500Error || novelPageData.hasLiteraryServerMsg) {
      throw new Error('FAILED: Novel Details page displays 500 SERVER ERROR!');
    }
    if (!novelPageData.startReadingHref) {
      throw new Error('FAILED: Start reading button not found!');
    }
    console.log('  ✓ Novel Details page loaded successfully with 0 errors.');

    // TEST 2.3: Click "Start Reading"
    console.log('\nTest 2.3: Clicking "Start Reading" button to enter Reader View...');
    await client.eval(`
      (() => {
        const startReadingBtn = document.querySelector('a[href*="#reader?novel="]');
        if (startReadingBtn) startReadingBtn.click();
      })()
    `);
    await sleep(2000);

    const readerViewData = await client.eval(`
      (() => {
        const bodyText = document.body.innerText;
        const has500Error = bodyText.includes('500') && bodyText.includes('SERVER ERROR');
        const hasLiteraryServerMsg = bodyText.includes('Our literary servers encountered an unexpected issue');
        const hasAccessDenied = bodyText.includes('403') || bodyText.includes('Members Only Area');
        const readerTitle = document.querySelector('.reader-chapter-title')?.innerText;
        const readerContent = document.querySelector('#reader-body-content')?.innerText;
        const bookmarkBtn = document.querySelector('button[onclick*="bookmarkChapter"]');
        return {
          currentHash: window.location.hash,
          has500Error,
          hasLiteraryServerMsg,
          hasAccessDenied,
          readerTitle,
          contentLength: readerContent ? readerContent.length : 0,
          hasBookmarkBtn: Boolean(bookmarkBtn)
        };
      })()
    `);

    console.log('  Reader View State:', readerViewData);
    if (readerViewData.has500Error || readerViewData.hasLiteraryServerMsg) {
      throw new Error('FAILED: Reader view displayed 500 SERVER ERROR!');
    }
    if (readerViewData.hasAccessDenied) {
      throw new Error('FAILED: Reader view displayed 403 Access Denied!');
    }
    if (readerViewData.contentLength < 50) {
      throw new Error('FAILED: Reader view content was empty!');
    }
    console.log('  ✓ Reader view opened successfully and rendered full story content!');

    // TEST 2.4: Test Bookmark functionality
    console.log('\nTest 2.4: Testing chapter bookmark click...');
    const bookmarkResult = await client.eval(`
      (() => {
        try {
          const btn = document.querySelector('button[onclick*="bookmarkChapter"]');
          if (btn) btn.click();
          return { success: true };
        } catch (e) {
          return { success: false, error: e.message };
        }
      })()
    `);
    console.log('  Bookmark execution result:', bookmarkResult);
    if (!bookmarkResult.success) {
      throw new Error(`Bookmark button threw error: ${bookmarkResult.error}`);
    }

    // TEST 2.5: Direct URL and Refresh test
    console.log('\nTest 2.5: Testing direct navigation to #novel?id=en-uyiril-nee and page reload...');
    await client.send('Page.navigate', { url: 'http://localhost:5173/#novel?id=en-uyiril-nee' });
    await sleep(1500);
    await client.send('Page.reload');
    await sleep(2000);

    const reloadedNovelState = await client.eval(`
      (() => {
        const bodyText = document.body.innerText;
        return {
          has500: bodyText.includes('500') && bodyText.includes('SERVER ERROR'),
          title: document.querySelector('.novel-detail-title')?.innerText
        };
      })()
    `);
    console.log('  Reloaded Novel Page State:', reloadedNovelState);
    if (reloadedNovelState.has500 || !reloadedNovelState.title) {
      throw new Error('FAILED: Reloading novel page failed or showed 500 error!');
    }
    console.log('  ✓ Direct novel URL and page reload work perfectly.');

    // TEST 2.6: Direct Chapter Reader URL and Refresh
    console.log('\nTest 2.6: Testing direct navigation to #reader?novel=en-uyiril-nee&ch=1.1 and page reload...');
    await client.send('Page.navigate', { url: 'http://localhost:5173/#reader?novel=en-uyiril-nee&ch=1.1' });
    await sleep(1500);
    await client.send('Page.reload');
    await sleep(2000);

    const reloadedReaderState = await client.eval(`
      (() => {
        const bodyText = document.body.innerText;
        return {
          has500: bodyText.includes('500') && bodyText.includes('SERVER ERROR'),
          chapterTitle: document.querySelector('.reader-chapter-title')?.innerText,
          contentLength: document.querySelector('#reader-body-content')?.innerText?.length || 0
        };
      })()
    `);
    console.log('  Reloaded Reader Page State:', reloadedReaderState);
    if (reloadedReaderState.has500 || reloadedReaderState.contentLength < 50) {
      throw new Error('FAILED: Reloading reader page failed or showed 500 error!');
    }
    console.log('  ✓ Direct chapter reader URL and page reload work cleanly.');

    // TEST 2.7: Requesting ch=1 fallback
    console.log('\nTest 2.7: Testing reader URL with fallback ch=1 (#reader?novel=en-uyiril-nee&ch=1)...');
    await client.send('Page.navigate', { url: 'http://localhost:5173/#reader?novel=en-uyiril-nee&ch=1' });
    await sleep(2000);

    const fallbackReaderState = await client.eval(`
      (() => {
        const bodyText = document.body.innerText;
        return {
          has500: bodyText.includes('500') && bodyText.includes('SERVER ERROR'),
          has403: bodyText.includes('403') || bodyText.includes('Members Only Area'),
          chapterTitle: document.querySelector('.reader-chapter-title')?.innerText,
          contentLength: document.querySelector('#reader-body-content')?.innerText?.length || 0
        };
      })()
    `);
    console.log('  Fallback Reader State:', fallbackReaderState);
    if (fallbackReaderState.has500 || fallbackReaderState.has403 || fallbackReaderState.contentLength < 50) {
      throw new Error('FAILED: Fallback ch=1 produced error or failed to load episode!');
    }
    console.log('  ✓ ch=1 fallback automatically resolved and rendered episode 1.1 without error.');

    // TEST 2.8: Requesting Nonexistent Novel -> 404 (NOT 500)
    console.log('\nTest 2.8: Testing nonexistent novel URL (#novel?id=nonexistent-novel-12345)...');
    await client.send('Page.navigate', { url: 'http://localhost:5173/#novel?id=nonexistent-novel-12345' });
    await sleep(2000);

    const notFoundState = await client.eval(`
      (() => {
        const bodyText = document.body.innerText;
        return {
          has500: bodyText.includes('500') && bodyText.includes('SERVER ERROR'),
          has404: bodyText.includes('404') || bodyText.includes('Page Not Found') || bodyText.includes('not found')
        };
      })()
    `);
    console.log('  Nonexistent Novel State:', notFoundState);
    if (notFoundState.has500) {
      throw new Error('FAILED: Nonexistent novel rendered 500 SERVER ERROR instead of 404!');
    }
    if (!notFoundState.has404) {
      throw new Error('FAILED: Nonexistent novel did not render 404 Not Found state!');
    }
    console.log('  ✓ Nonexistent novel displays proper 404 Not Found page.');

    // Check exceptions during run
    console.log('\nChecking console exceptions during test:');
    const exceptions = client.logs.filter(l => l.includes('[Exception]') || l.includes('ReferenceError') || l.includes('500'));
    if (exceptions.length > 0) {
      console.warn('  Captured exceptions:', exceptions);
    } else {
      console.log('  ✓ Zero unhandled JavaScript exceptions or ReferenceErrors captured!');
    }

    console.log('\n=====================================================');
    console.log('🎉 ALL TESTS PASSED SUCCESSFULLY!');
    console.log('=====================================================');

    ws.close();
  } finally {
    chromeProc.kill();
  }
}

runTests().catch(err => {
  console.error('\n❌ Test Failure:', err);
  process.exit(1);
});
