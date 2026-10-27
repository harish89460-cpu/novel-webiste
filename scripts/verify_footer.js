import fs from 'fs';

const fHtml = fs.readFileSync('frontend/index.html', 'utf8');
const rHtml = fs.readFileSync('index.html', 'utf8');
const fCss = fs.readFileSync('frontend/src/css/layout.css', 'utf8');
const rCss = fs.readFileSync('src/css/layout.css', 'utf8');
const fJs = fs.readFileSync('frontend/src/js/app.js', 'utf8');

console.log('--- Verifying Footer Redesign ---');

// 1. Check clickable logo redirecting to forms / forum
const logoLinkMatch = fHtml.includes('id="footer-rp-logo-link"') && fHtml.includes('href="#forum"');
console.log('1. Clickable Logo linking to #forum (Forms page):', logoLinkMatch ? 'PASS' : 'FAIL');

// 2. Check 5 required links: Privacy Policy, Disclaimer, Terms & Conditions, Contact Us, Copyright
const links = ['Privacy Policy', 'Disclaimer', 'Terms &amp; Conditions', 'Contact Us', 'Copyright'];
const allLinksPresent = links.every(l => fHtml.includes(l));
console.log('2. All 5 required links present:', allLinksPresent ? 'PASS' : 'FAIL');

// 3. Check Royal Purple colors and gold accents in CSS
const hasRoyalPurple = fCss.includes('#1B072E');
const hasGoldAccents = fCss.includes('#C5A059') && fCss.includes('#D4AF37') && fCss.includes('#E6C280');
const hasWhiteText = fCss.includes('#FFFFFF') && fCss.includes('#EDE8F7');
console.log('3. Royal purple theme in CSS (#1B072E):', hasRoyalPurple ? 'PASS' : 'FAIL');
console.log('4. Elegant gold accents in CSS (#C5A059, #D4AF37, #E6C280):', hasGoldAccents ? 'PASS' : 'FAIL');
console.log('5. Readable white text in CSS (#FFFFFF, #EDE8F7):', hasWhiteText ? 'PASS' : 'FAIL');

// 4. Check compact padding and dimensions
const hasCompactPadding = fCss.includes('padding-top: 18px;') && fCss.includes('padding-bottom: 12px;');
const hasCompactLogo = fCss.includes('width: 32px;') && fCss.includes('height: 32px;');
console.log('6. Compact padding (18px/12px) and dimensions (32px logo):', (hasCompactPadding && hasCompactLogo) ? 'PASS' : 'FAIL');

// 5. Check dual-directory sync
const htmlSync = fHtml.includes('id="footer-rp-logo-link"') && rHtml.includes('id="footer-rp-logo-link"');
const cssSync = fCss.includes('#1B072E') && rCss.includes('#1B072E');
console.log('7. Files synchronized across frontend/ and root:', (htmlSync && cssSync) ? 'PASS' : 'FAIL');

// 6. Router supports #forms and #forum
const routerSupportsForms = fJs.includes("hash.startsWith('#forms')");
console.log('8. Router supports #forms alias:', routerSupportsForms ? 'PASS' : 'FAIL');
