// Background Keepalive Ping for Cloudflare Tunnel
const fs = require('fs');
const path = require('path');

const activeUrlPath = path.resolve(__dirname, '..', 'active_tunnel_url.txt');

function getActiveUrl() {
  try {
    if (fs.existsSync(activeUrlPath)) {
      const url = fs.readFileSync(activeUrlPath, 'utf8').trim();
      if (url && url.startsWith('http')) {
        return url.replace(/\/+$/, '') + '/api/health';
      }
    }
  } catch (_) {}
  return null;
}

async function ping() {
  const url = getActiveUrl();
  if (!url) return;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (res.ok) {
      // Tunnel is healthy and responsive
    } else {
      console.warn('[Tunnel Keepalive] Status:', res.status, url);
    }
  } catch (err) {
    console.warn('[Tunnel Keepalive] Ping warning:', err.message);
  }
}

// Ping every 15 seconds to ensure edge TCP connection never idles out
setInterval(ping, 15000);
ping();
