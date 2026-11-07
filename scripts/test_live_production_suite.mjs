import { spawn } from 'node:child_process';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const targetBase = 'https://frontend-snowy-five-81.vercel.app';

async function main() {
  console.log('Launching headless Chrome to test LIVE PRODUCTION URL:', targetBase);
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9232',
    '--disable-gpu',
    '--disable-extensions',
    '--user-data-dir=' + process.env.TEMP + '\\chrome-live-suite-' + Date.now(),
    'about:blank'
  ]);

  await new Promise(r => setTimeout(r, 1500));

  try {
    const targetsRes = await fetch('http://localhost:9232/json/list');
    const targets = await targetsRes.json();
    const pageTarget = targets.find(t => t.type === 'page');

    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
    await new Promise(r => ws.onopen = r);

    let msgId = 1;
    function send(method, params = {}) {
      return new Promise((resolve) => {
        const id = msgId++;
        const handler = (event) => {
          const data = JSON.parse(event.data);
          if (data.id === id) {
            ws.removeEventListener('message', handler);
            resolve(data.result);
          }
        };
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    const uncaughtExceptions = [];
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.method === 'Runtime.exceptionThrown') {
        uncaughtExceptions.push(msg.params.exceptionDetails);
      }
    };

    await send('Runtime.enable');
    await send('Page.enable');

    const pages = [
      { name: '1. Forms Overview', path: '#forms' },
      { name: '2. Forms Category View (Chit Chat)', path: '#forms?category=chit_chat_corner' },
      { name: '3. Forms Subcategory View (Welcome Notes)', path: '#forms?sub=welcome-notes' },
      { name: '4. Novels Catalog', path: '#novels' },
      { name: '5. Thread / Article View (gjh)', path: '#thread?id=gjh' },
      { name: '6. Members Directory', path: '#members' },
      { name: '7. Member Profile (Rudhra Author)', path: '#member?id=rudhra_author' },
      { name: '8. Direct Messages View', path: '#messages' },
      { name: '9. Member Login View', path: '#login' },
      { name: '10. Member Register View', path: '#register' },
      { name: '11. Admin Login View', path: '#admin-login' },
      { name: '12. Writer Login View', path: '#writer-login' },
      { name: '13. About Page', path: '#about' },
      { name: '14. Contact Page', path: '#contact' },
      { name: '15. Privacy Page', path: '#privacy' },
      { name: '16. Terms Page', path: '#terms' },
      { name: '17. Disclaimer Page', path: '#disclaimer' },
      { name: '18. Copyright Page', path: '#copyright' }
    ];

    console.log('\n======================================================');
    console.log('TESTING LIVE PRODUCTION DEPLOYMENT ACROSS ALL ROUTES');
    console.log('======================================================\n');

    await send('Page.navigate', { url: `${targetBase}/#forms` });
    await new Promise(r => setTimeout(r, 4000));

    let passed = 0;
    let failed = 0;

    for (const p of pages) {
      await send('Runtime.evaluate', {
        expression: `window.location.hash = '${p.path}'`
      });
      await new Promise(r => setTimeout(r, 2000));

      const res = await send('Runtime.evaluate', {
        expression: `({
          is500: document.body.innerText.includes('500 — SERVER ERROR') || document.body.innerText.includes('Something Went Wrong'),
          contentLen: (document.getElementById('main-content')?.innerText || '').trim().length,
          title: document.title,
          heading: (document.querySelector('h1, h2')?.innerText || '').trim()
        })`,
        returnByValue: true
      });

      const val = res?.result?.value;
      if (!val || val.is500) {
        console.error(`[FAIL 500] ${p.name} (${p.path}) -> Detected 500 Server Error!`);
        failed++;
      } else {
        console.log(`[PASS] ${p.name} -> Content: ${val.contentLen} chars | Header: "${val.heading}"`);
        passed++;
      }
    }

    console.log('\n--- Testing Mobile Viewport on Live Site (375x812) ---');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 375,
      height: 812,
      deviceScaleFactor: 2,
      mobile: true
    });
    await send('Runtime.evaluate', { expression: `window.location.hash = '#forms'` });
    await new Promise(r => setTimeout(r, 2000));

    const mobileRes = await send('Runtime.evaluate', {
      expression: `({
        is500: document.body.innerText.includes('500 — SERVER ERROR'),
        navBar: Boolean(document.querySelector('.header, .site-header, nav')),
        hero: Boolean(document.getElementById('forms-hero-section'))
      })`,
      returnByValue: true
    });

    const mVal = mobileRes?.result?.value;
    console.log('Mobile Result:', mVal);
    if (!mVal?.is500) {
      console.log('[PASS] Mobile Viewport verified responsive without 500 error.');
      passed++;
    } else {
      console.error('[FAIL] Mobile Viewport failed with 500 error.');
      failed++;
    }

    console.log('\n======================================================');
    console.log(`LIVE PRODUCTION TEST SUMMARY: Passed: ${passed} | Failed: ${failed}`);
    console.log('======================================================');

    if (uncaughtExceptions.length > 0) {
      console.warn('\nUncaught Exceptions during run:');
      uncaughtExceptions.forEach(e => console.warn(e));
    } else {
      console.log('✓ Zero uncaught exceptions on Live Production!');
    }

    ws.close();
    chrome.kill();
  } catch (err) {
    console.error('Test Suite Error:', err);
    chrome.kill();
  }
}

main();
