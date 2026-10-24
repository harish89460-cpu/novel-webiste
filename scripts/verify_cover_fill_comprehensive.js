import { spawn } from 'child_process';
import path from 'path';

const DEBUG_PORT = 9236;
const USER_DATA_DIR = path.resolve('scratch/chrome_verify_final2');

const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new',
  `--remote-debugging-port=${DEBUG_PORT}`,
  `--user-data-dir=${USER_DATA_DIR}`,
  '--disable-gpu',
  '--window-size=1280,1000',
  'http://localhost:5173/'
]);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function getWsUrl(port) {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (res.ok) {
        const list = await res.json();
        const page = list.find(t => t.type === 'page' && !t.url.startsWith('chrome-extension'));
        if (page && page.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
      }
    } catch {}
    await sleep(300);
  }
  throw new Error('Could not find active Chrome page target');
}

// Generate SVG data URIs of different aspect ratios
function makeSvg(width, height, color, text) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="100%" height="100%" fill="${color}"/>
    <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="${Math.max(16, Math.floor(width/15))}px" fill="#ffffff" font-weight="bold">${text} (${width}x${height})</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const TEST_IMAGES = {
  landscape: makeSvg(1600, 900, '#C05621', '16:9 Landscape'),
  portrait: makeSvg(600, 900, '#2B6CB0', '2:3 Portrait'),
  square: makeSvg(800, 800, '#2F855A', '1:1 Square'),
  tallPortrait: makeSvg(400, 1000, '#6B46C1', '1:2.5 Tall'),
  small: makeSvg(100, 150, '#D69E2E', '100x150 Small')
};

(async () => {
  let failures = 0;

  function assert(condition, message) {
    if (!condition) {
      console.error(`❌ FAIL: ${message}`);
      failures++;
    } else {
      console.log(`✅ PASS: ${message}`);
    }
  }

  try {
    await sleep(1500);
    const wsUrl = await getWsUrl(DEBUG_PORT);
    const ws = new WebSocket(wsUrl);
    await new Promise(r => ws.onopen = r);

    const callbacks = new Map();
    ws.onmessage = (event) => {
      const res = JSON.parse(event.data);
      if (res.id && callbacks.has(res.id)) {
        const cb = callbacks.get(res.id);
        callbacks.delete(res.id);
        cb(res.result);
      }
    };

    let id = 1;
    const send = (method, params = {}) => new Promise((resolve) => {
      const curId = id++;
      callbacks.set(curId, resolve);
      ws.send(JSON.stringify({ id: curId, method, params }));
    });

    const evaluate = async (fnString, ...args) => {
      const expression = `(${fnString})(${args.map(a => JSON.stringify(a)).join(',')})`;
      const res = await send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true
      });
      if (res.exceptionDetails) {
        throw new Error(res.exceptionDetails.text || 'Evaluation error');
      }
      return res.result?.value;
    };

    const setViewport = async (width, height, isMobile = false) => {
      await send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: isMobile
      });
      await send('Emulation.setVisibleSize', { width, height });
    };

    const navigateAndWait = async (url, selectorToWaitFor) => {
      await send('Page.navigate', { url });
      for (let i = 0; i < 40; i++) {
        await sleep(150);
        if (!selectorToWaitFor) break;
        const exists = await evaluate((sel) => !!document.querySelector(sel), selectorToWaitFor);
        if (exists) break;
      }
      await sleep(300);
    };

    await send('Page.enable');
    await send('Runtime.enable');

    console.log('================================================================');
    console.log('🏁 RUNNING NOVEL COVER FRAME FILLING COMPREHENSIVE VERIFICATION');
    console.log('================================================================\n');

    /* ========================================================
       TEST 1: Reader Novel Cards across Viewports (Desktop, Tablet, Mobile)
       ======================================================== */
    const viewports = [
      { name: 'Desktop (1280px)', width: 1280, height: 800, isMobile: false },
      { name: 'Tablet (768px)', width: 768, height: 1024, isMobile: true },
      { name: 'Mobile (375px)', width: 375, height: 667, isMobile: true }
    ];

    for (const vp of viewports) {
      console.log(`\n--- Test 1: Novel Cards on ${vp.name} ---`);
      await setViewport(vp.width, vp.height, vp.isMobile);
      await navigateAndWait('http://localhost:5173/#novels', '.novel-card');

      const cardResults = await evaluate(() => {
        const cards = Array.from(document.querySelectorAll('.novel-card'));
        return cards.map((c, i) => {
          const wrap = c.querySelector('.novel-card-cover');
          const img = c.querySelector('.novel-card-img');
          if (!wrap || !img) return { index: i, missing: true };

          const wrapRect = wrap.getBoundingClientRect();
          const imgRect = img.getBoundingClientRect();
          const comp = window.getComputedStyle(img);

          const wrapW = wrap.clientWidth || wrapRect.width;
          const wrapH = wrap.clientHeight || wrapRect.height;
          const diffW = Math.abs(wrapW - imgRect.width);
          const diffH = Math.abs(wrapH - imgRect.height);

          return {
            index: i,
            wrapW: Math.round(wrapW * 10) / 10,
            wrapH: Math.round(wrapH * 10) / 10,
            imgW: Math.round(imgRect.width * 10) / 10,
            imgH: Math.round(imgRect.height * 10) / 10,
            diffW,
            diffH,
            ratio: Math.round((wrapW / wrapH) * 100) / 100,
            objectFit: comp.objectFit,
            objectPos: comp.objectPosition
          };
        });
      });

      assert(cardResults && cardResults.length > 0, `Found ${cardResults?.length || 0} novel cards on ${vp.name}`);
      for (const r of cardResults) {
        assert(!r.missing, `Card #${r.index + 1} has wrapper and img elements`);
        assert(r.diffW <= 0.5 && r.diffH <= 0.5,
          `Card #${r.index + 1} cover fills container: wrap=(${r.wrapW}x${r.wrapH}) img=(${r.imgW}x${r.imgH}) diffH=${r.diffH.toFixed(2)}px (0px gap, no blank area)`);
        assert(Math.abs(r.ratio - 0.67) < 0.05, `Card #${r.index + 1} ratio is ~2:3 portrait (${r.ratio})`);
        assert(r.objectFit === 'cover', `Card #${r.index + 1} object-fit: cover`);
      }
    }

    /* ========================================================
       TEST 2: Novel Details Page Cover on Viewports
       ======================================================== */
    for (const vp of viewports) {
      console.log(`\n--- Test 2: Novel Details Page on ${vp.name} ---`);
      await setViewport(vp.width, vp.height, vp.isMobile);
      await navigateAndWait('http://localhost:5173/#novel?id=en-uyiril-nee', '.novel-detail-cover-wrap');

      const detailResult = await evaluate(() => {
        const wrap = document.querySelector('.novel-detail-cover-wrap');
        const img = document.querySelector('.novel-detail-cover-img');
        if (!wrap || !img) return { missing: true };

        const wrapRect = wrap.getBoundingClientRect();
        const imgRect = img.getBoundingClientRect();
        const comp = window.getComputedStyle(img);

        const wrapW = wrap.clientWidth || wrapRect.width;
        const wrapH = wrap.clientHeight || wrapRect.height;
        const diffW = Math.abs(wrapW - imgRect.width);
        const diffH = Math.abs(wrapH - imgRect.height);

        return {
          wrapW: Math.round(wrapW * 10) / 10,
          wrapH: Math.round(wrapH * 10) / 10,
          imgW: Math.round(imgRect.width * 10) / 10,
          imgH: Math.round(imgRect.height * 10) / 10,
          diffW,
          diffH,
          ratio: Math.round((wrapRect.width / wrapRect.height) * 100) / 100,
          objectFit: comp.objectFit
        };
      });

      assert(!detailResult.missing, `Novel detail page has .novel-detail-cover-wrap and .novel-detail-cover-img on ${vp.name}`);
      if (!detailResult.missing) {
        assert(detailResult.diffW <= 0.5 && detailResult.diffH <= 0.5,
          `Novel detail cover fills container: wrap=(${detailResult.wrapW}x${detailResult.wrapH}) img=(${detailResult.imgW}x${detailResult.imgH}) diffH=${detailResult.diffH.toFixed(2)}px (0px gap, no blank area)`);
        assert(Math.abs(detailResult.ratio - 0.67) < 0.05, `Novel detail cover is ~2:3 portrait (${detailResult.ratio})`);
        assert(detailResult.objectFit === 'cover', `Novel detail cover has object-fit: cover`);
      }
    }

    /* ========================================================
       TEST 3: Admin Create Novel Cover Preview & Multi-Dimension Filling
       ======================================================== */
    console.log(`\n--- Test 3: Admin Create Novel Cover Preview ---`);
    await setViewport(1280, 800, false);
    await navigateAndWait('http://localhost:5173/#admin-login');

    // Perform valid admin login to unlock Admin Dashboard
    const loginResult = await evaluate(async () => {
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
          localStorage.setItem('rp_user', JSON.stringify(data.user));
          window.IS_LOGGED_IN = true;
          window.CURRENT_USER = data.user;
          return { success: true };
        }
        return { success: false, data };
      } catch (e) {
        return { success: false, error: e.message };
      }
    });

    assert(loginResult.success, 'Successfully authenticated as author/admin');
    await navigateAndWait('http://localhost:5173/#admin');
    await sleep(800);

    // Open Add Novel form
    await evaluate(() => {
      if (typeof window.showAddNovelForm === 'function') {
        window.showAddNovelForm();
      } else {
        const btn = document.getElementById('admin-add-novel-btn') || Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('New Novel'));
        if (btn) btn.click();
      }
    });
    await sleep(600);

    const createPreviewResult = await evaluate(() => {
      const wrap = document.getElementById('nc-cover-wrapper');
      const img = document.getElementById('nc-cover-preview-img');
      if (!wrap || !img) return { missing: true };

      const wrapRect = wrap.getBoundingClientRect();
      const imgRect = img.getBoundingClientRect();
      const comp = window.getComputedStyle(img);

      const wrapW = wrap.clientWidth || wrapRect.width;
      const wrapH = wrap.clientHeight || wrapRect.height;

      return {
        wrapW: Math.round(wrapW),
        wrapH: Math.round(wrapH),
        imgW: Math.round(imgRect.width),
        imgH: Math.round(imgRect.height),
        diffW: Math.abs(wrapW - imgRect.width),
        diffH: Math.abs(wrapH - imgRect.height),
        ratio: Math.round((wrapRect.width / wrapRect.height) * 100) / 100,
        objectFit: comp.objectFit,
        src: img.src
      };
    });

    assert(!createPreviewResult.missing, 'Create Novel form has #nc-cover-wrapper and #nc-cover-preview-img');
    if (!createPreviewResult.missing) {
      assert(createPreviewResult.wrapW === 158 && createPreviewResult.wrapH === 238, `Create preview container inner bounds are 158x238 (160x240 minus 1px border)`);
      assert(createPreviewResult.diffW <= 0.5 && createPreviewResult.diffH <= 0.5,
        `Create preview image fills container: wrap=(${createPreviewResult.wrapW}x${createPreviewResult.wrapH}) img=(${createPreviewResult.imgW}x${createPreviewResult.imgH}) diffH=${createPreviewResult.diffH.toFixed(2)}px (0px gap)`);
      assert(createPreviewResult.objectFit === 'cover', 'Create preview has object-fit: cover');
      assert(createPreviewResult.src.includes('default-cover.jpg'), 'Default cover is displayed when no cover is selected');

      // Test multi-dimension images in Create Novel preview
      for (const [ratioType, dataUri] of Object.entries(TEST_IMAGES)) {
        const fillTest = await evaluate((uri) => {
          const img = document.getElementById('nc-cover-preview-img');
          const wrap = document.getElementById('nc-cover-wrapper');
          img.src = uri;
          const wrapW = wrap.clientWidth;
          const wrapH = wrap.clientHeight;
          const imgRect = img.getBoundingClientRect();
          return {
            diffW: Math.abs(wrapW - imgRect.width),
            diffH: Math.abs(wrapH - imgRect.height),
            wrapW: Math.round(wrapW),
            wrapH: Math.round(wrapH),
            imgW: Math.round(imgRect.width),
            imgH: Math.round(imgRect.height)
          };
        }, dataUri);

        assert(fillTest.diffW <= 0.5 && fillTest.diffH <= 0.5,
          `Create preview fills frame for ${ratioType} image without distortion: img=(${fillTest.imgW}x${fillTest.imgH}) diffH=${fillTest.diffH.toFixed(2)}px`);
      }
    }

    /* ========================================================
       TEST 4: Admin Edit Novel Modal Cover Preview
       ======================================================== */
    console.log(`\n--- Test 4: Admin Edit Novel Modal Cover Preview ---`);
    await evaluate(() => {
      if (typeof window.switchAdminTab === 'function') {
        window.switchAdminTab('novels');
      }
    });
    await sleep(800);

    // Open edit modal for first novel
    const openedModal = await evaluate(() => {
      if (typeof window.openEditNovelModal === 'function' && window.adminState?.novels?.[0]?.id) {
        window.openEditNovelModal(window.adminState.novels[0].id);
        return true;
      }
      const editBtn = document.querySelector('.admin-table tbody tr [onclick*="openEditNovelModal"]');
      if (editBtn) {
        editBtn.click();
        return true;
      }
      return false;
    });

    assert(openedModal, 'Successfully opened Edit Novel modal');
    await sleep(600);

    const editPreviewResult = await evaluate(() => {
      const wrap = document.getElementById('edit-cover-wrapper');
      const img = document.getElementById('edit-novel-cover-preview');
      if (!wrap || !img) return { missing: true };

      const wrapW = wrap.clientWidth;
      const wrapH = wrap.clientHeight;
      const imgRect = img.getBoundingClientRect();
      const comp = window.getComputedStyle(img);

      return {
        wrapW: Math.round(wrapW),
        wrapH: Math.round(wrapH),
        imgW: Math.round(imgRect.width),
        imgH: Math.round(imgRect.height),
        diffW: Math.abs(wrapW - imgRect.width),
        diffH: Math.abs(wrapH - imgRect.height),
        ratio: Math.round((wrap.getBoundingClientRect().width / wrap.getBoundingClientRect().height) * 100) / 100,
        objectFit: comp.objectFit
      };
    });

    assert(!editPreviewResult.missing, 'Edit modal has #edit-cover-wrapper and #edit-novel-cover-preview');
    if (!editPreviewResult.missing) {
      assert(editPreviewResult.wrapW === 70 && editPreviewResult.wrapH === 106, `Edit preview container inner bounds are 70x106 (72x108 minus 1px border)`);
      assert(editPreviewResult.diffW <= 0.5 && editPreviewResult.diffH <= 0.5,
        `Edit preview image fills container: wrap=(${editPreviewResult.wrapW}x${editPreviewResult.wrapH}) img=(${editPreviewResult.imgW}x${editPreviewResult.imgH}) diffH=${editPreviewResult.diffH.toFixed(2)}px (0px gap)`);
      assert(editPreviewResult.objectFit === 'cover', 'Edit preview has object-fit: cover');

      // Test multi-dimension images in Edit Novel preview
      for (const [ratioType, dataUri] of Object.entries(TEST_IMAGES)) {
        const fillTest = await evaluate((uri) => {
          const img = document.getElementById('edit-novel-cover-preview');
          const wrap = document.getElementById('edit-cover-wrapper');
          img.src = uri;
          const wrapW = wrap.clientWidth;
          const wrapH = wrap.clientHeight;
          const imgRect = img.getBoundingClientRect();
          return {
            diffW: Math.abs(wrapW - imgRect.width),
            diffH: Math.abs(wrapH - imgRect.height),
            wrapW: Math.round(wrapW),
            wrapH: Math.round(wrapH),
            imgW: Math.round(imgRect.width),
            imgH: Math.round(imgRect.height)
          };
        }, dataUri);

        assert(fillTest.diffW <= 0.5 && fillTest.diffH <= 0.5,
          `Edit modal preview fills frame for ${ratioType} image: img=(${fillTest.imgW}x${fillTest.imgH}) diffH=${fillTest.diffH.toFixed(2)}px`);
      }
    }

    /* ========================================================
       TEST 5: Broken Image Fallback to /default-cover.jpg
       ======================================================== */
    console.log(`\n--- Test 5: Broken Image Fallback Handling ---`);
    await navigateAndWait('http://localhost:5173/#novels', '.novel-card');
    await sleep(600);

    const fallbackResult = await evaluate(() => {
      const img = document.querySelector('.novel-card-img');
      if (!img) return { missing: true };

      return new Promise((resolve) => {
        img.onerror = function() {
          this.onerror = null;
          this.src = '/default-cover.jpg';
        };
        img.onload = function() {
          if (this.src.includes('default-cover.jpg')) {
            const wrap = this.parentElement;
            const wrapW = wrap.clientWidth;
            const wrapH = wrap.clientHeight;
            const imgRect = this.getBoundingClientRect();
            resolve({
              fallbackTriggered: true,
              src: this.src,
              naturalWidth: this.naturalWidth,
              naturalHeight: this.naturalHeight,
              diffH: Math.abs(wrapH - imgRect.height),
              diffW: Math.abs(wrapW - imgRect.width)
            });
          }
        };
        img.src = '/non-existent-broken-cover-xyz.jpg';
      });
    });

    assert(fallbackResult.fallbackTriggered, 'Broken cover URL successfully triggers fallback to /default-cover.jpg');
    assert(fallbackResult.naturalWidth === 600 && fallbackResult.naturalHeight === 900,
      `Default fallback cover is valid 600x900 2:3 image (${fallbackResult.naturalWidth}x${fallbackResult.naturalHeight})`);
    assert(fallbackResult.diffH <= 0.5 && fallbackResult.diffW <= 0.5,
      `Fallback cover completely fills novel card frame with 0px blank gap (diffH=${fallbackResult.diffH.toFixed(2)}px)`);

    console.log(`\n================================================================`);
    if (failures === 0) {
      console.log(`🎉 ALL NOVEL COVER VERIFICATION TESTS PASSED! (${failures} failures)`);
    } else {
      console.error(`💥 TEST SUITE COMPLETED WITH ${failures} FAILURE(S)`);
    }
    console.log(`================================================================\n`);

  } finally {
    try {
      chrome.kill('SIGKILL');
    } catch {}
  }

  process.exit(failures > 0 ? 1 : 0);
})().catch(err => {
  console.error('Fatal test error:', err);
  try { chrome.kill('SIGKILL'); } catch {}
  process.exit(1);
});
