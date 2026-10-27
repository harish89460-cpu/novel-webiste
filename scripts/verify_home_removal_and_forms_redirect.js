import http from 'http';
import fs from 'fs';

function get(path, followRedirect = false) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:3000${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
        }
      });
    }).on('error', reject);
  });
}

async function runTests() {
  console.log('=== RUNNING HOME REMOVAL & FORMS REDIRECT VERIFICATION SUITE ===\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, desc) {
    if (condition) {
      console.log(`✓ [PASS] ${desc}`);
      passed++;
    } else {
      console.error(`✗ [FAIL] ${desc}`);
      failed++;
    }
  }

  // 1. Check Header Navigation & HTML Branding
  const indexHtml = fs.readFileSync('index.html', 'utf8');
  const frontendIndexHtml = fs.readFileSync('frontend/index.html', 'utf8');

  // Desktop nav must have Home pointing to #forms
  assert(/<a href="#forms" class="nav-link"[^>]*>\s*Home\s*<\/a>/.test(indexHtml), 'index.html desktop nav displays "Home" with href="#forms"');
  assert(/<a href="#forms" class="nav-link"[^>]*>\s*Home\s*<\/a>/.test(frontendIndexHtml), 'frontend/index.html desktop nav displays "Home" with href="#forms"');

  // Brand link must point to #forms
  assert(/<a href="#forms" class="brand-link"/.test(indexHtml), 'index.html brand logo links to #forms');
  assert(/<a href="#forms" class="brand-link"/.test(frontendIndexHtml), 'frontend/index.html brand logo links to #forms');

  // Mobile drawer nav must have Home pointing to #forms
  assert(/<a href="#forms" class="drawer-nav-item"[^>]*>\s*Home\s*<\/a>/.test(indexHtml), 'index.html mobile drawer displays "Home" with href="#forms"');
  assert(/<a href="#forms" class="drawer-nav-item"[^>]*>\s*Home\s*<\/a>/.test(frontendIndexHtml), 'frontend/index.html mobile drawer displays "Home" with href="#forms"');

  // 2. Client-Side Router in app.js
  const appJs = fs.readFileSync('src/js/app.js', 'utf8');

  // Root landing route defaults to #forms
  assert(/hash\s*=\s*'#forms'/.test(appJs), 'app.js defaults empty hash / root route to #forms');
  assert(/window\.history\.replaceState\(null,\s*'',\s*'#forms'\)/.test(appJs), 'app.js replaces history with #forms on default load');

  // Explicit #home route redirects to #forms
  assert(/hash === '#home'/.test(appJs) && /window\.location\.hash = '#forms'/.test(appJs), 'app.js catches #home and redirects window.location.hash to #forms');

  // Separate Home page UI is removed
  assert(!appJs.includes('function renderHomeView'), 'renderHomeView is completely removed from app.js');
  assert(!appJs.includes('function renderDynamicHomepageSection'), 'renderDynamicHomepageSection is completely removed from app.js');
  assert(!appJs.includes('renderFeaturedSectionComponent'), 'renderFeaturedSectionComponent is completely removed from app.js');
  assert(!appJs.includes('class="hero-section"'), 'Old Home hero section markup is completely removed from app.js');

  // Breadcrumbs updated to #forms
  assert(/<a href="#forms">Home<\/a>/.test(appJs), 'Breadcrumbs Home link updated to #forms');
  assert(!/<a href="#home">Home<\/a>/.test(appJs), 'Zero breadcrumbs linking to obsolete #home');

  // 3. Admin Dashboard
  const adminJs = fs.readFileSync('src/js/admin.js', 'utf8');

  // Sidebar navigation does not have Homepage Management
  assert(!adminJs.includes('<span>Homepage Management</span>'), 'Homepage Management button completely removed from admin sidebar');
  assert(!adminJs.includes('renderHomepageManagementTab'), 'renderHomepageManagementTab is completely removed from admin.js');
  assert(!adminJs.includes('handleResetHomepageOrder'), 'Homepage reset handlers completely removed from admin.js');
  assert(!adminJs.includes('openHomepagePreviewModal'), 'Homepage preview modal completely removed from admin.js');

  // Admin public reader site links point to #forms
  assert(!/<a href="#home" class="admin-sidebar-action-btn"/.test(adminJs), 'Admin sidebar footer link no longer points to #home');
  assert(/<a href="#forms" class="admin-sidebar-action-btn"[^>]*>\s*\$\{ADMIN_ICONS\.externalLink\}\s*<span>View Site<\/span>/.test(adminJs), 'Admin sidebar footer "View Site" links to #forms');
  assert(/<a href="#forms" class="admin-mobile-site-btn"/.test(adminJs), 'Admin mobile header site button links to #forms');

  // 4. CSS Cleanup
  const mainCss = fs.readFileSync('src/css/main.css', 'utf8');
  assert(!mainCss.includes("@import './hero.css';"), "main.css no longer imports hero.css");
  const heroCss = fs.readFileSync('src/css/hero.css', 'utf8');
  assert(!heroCss.includes('.hero-section {'), "hero.css has been cleared of obsolete hero styles");

  const adminCss = fs.readFileSync('src/css/admin.css', 'utf8');
  assert(!adminCss.includes('.homepage-sections-container'), "admin.css no longer contains obsolete homepage management styles");

  // 5. Backend Server Routing & Endpoints
  try {
    // Direct /home pathname returns 302 redirect to /#forms
    const homeReq = await get('/home');
    assert(homeReq.status === 302, 'HTTP GET /home returns 302 redirect status');
    assert(homeReq.headers.location === '/#forms', `HTTP GET /home Location header is "/#forms" (got: ${homeReq.headers.location})`);

    // Deprecated /api/novels/homepage returns safe empty response
    const hpApi = await get('/api/novels/homepage');
    assert(hpApi.status === 200, 'GET /api/novels/homepage returns 200 safe response');
    assert(hpApi.data?.success === true, 'GET /api/novels/homepage returns success: true');
    assert(Array.isArray(hpApi.data?.orderedSections) && hpApi.data.orderedSections.length === 0, 'GET /api/novels/homepage returns empty sections');

    // All active novels and chapters preserved
    const novelsReq = await get('/api/novels');
    assert(novelsReq.status === 200, 'GET /api/novels returns 200');
    assert(Array.isArray(novelsReq.data?.novels) && novelsReq.data.novels.length >= 6, `Preserved ${novelsReq.data?.novels?.length} genuine novels in database`);

    // Forum topics preserved and novel-linked
    const topicsReq = await get('/api/forum/topics');
    assert(topicsReq.status === 200, 'GET /api/forum/topics returns 200');
    assert(Array.isArray(topicsReq.data?.topics) && topicsReq.data.topics.length >= 6, `Preserved ${topicsReq.data?.topics?.length} forum topics in database`);

    // Comments preserved
    const commentsReq = await get('/api/comments?novel=nenjam-marappadhillai&ch=24&page=1&limit=7');
    assert(commentsReq.status === 200, 'GET /api/comments returns 200');
    assert(commentsReq.data?.comments?.length === 7, 'Preserved comments system with 7-item pagination');

  } catch (err) {
    console.error('Error during backend verification:', err);
    failed++;
  }

  console.log(`\nTESTS COMPLETED: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
