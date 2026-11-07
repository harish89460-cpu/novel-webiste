const { spawn, execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const cloudflaredPath = 'C:\\Program Files (x86)\\cloudflared\\cloudflared.exe';
const envProdPath = path.resolve(rootDir, 'frontend', '.env.production');
const vercelJsonPath = path.resolve(rootDir, 'vercel.json');
const frontendVercelJsonPath = path.resolve(rootDir, 'frontend', 'vercel.json');
const keepalivePath = path.resolve(__dirname, 'tunnel_keepalive.cjs');
const activeUrlPath = path.resolve(rootDir, 'active_tunnel_url.txt');
const logFile = path.resolve(rootDir, 'cloudflared_tunnel.log');

let currentChild = null;
let currentTunnelUrl = null;
let isDeploying = false;
let failedPingCount = 0;

console.log('[Self-Healing Tunnel Supervisor] Initializing...');

async function checkBackend() {
  try {
    const res = await fetch('http://localhost:3000/api/health', { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      return true;
    }
  } catch (err) {}
  return false;
}

async function startSupervisor() {
  const isUp = await checkBackend();
  if (!isUp) {
    console.warn('[Supervisor] Waiting for local backend on port 3000...');
    setTimeout(startSupervisor, 3000);
    return;
  }

  spawnTunnelProcess();
}

function spawnTunnelProcess() {
  console.log('[Supervisor] Spawning cloudflared quick tunnel to http://localhost:3000 ...');
  const outLog = fs.createWriteStream(logFile, { flags: 'a' });

  const cp = spawn(cloudflaredPath, ['tunnel', '--protocol', 'http2', '--url', 'http://localhost:3000'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  });

  currentChild = cp;
  let detectedUrl = null;

  function handleOutput(chunk) {
    const text = chunk.toString();
    outLog.write(text);

    if (!detectedUrl) {
      const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
      if (match) {
        detectedUrl = match[0].trim();
        onNewTunnelDetected(detectedUrl);
      }
    }
  }

  cp.stdout.on('data', handleOutput);
  cp.stderr.on('data', handleOutput);

  cp.on('exit', (code, signal) => {
    console.log(`[Supervisor] cloudflared process exited (code=${code}, signal=${signal}). Restarting in 3s...`);
    outLog.end();
    currentChild = null;
    currentTunnelUrl = null;
    setTimeout(spawnTunnelProcess, 3000);
  });

  cp.on('error', (err) => {
    console.error('[Supervisor] cloudflared process error:', err.message);
  });
}

async function onNewTunnelDetected(url) {
  console.log('\n================================================================');
  console.log('✓ ACTIVE CLOUDFLARE HTTPS TUNNEL ESTABLISHED:');
  console.log(url);
  console.log('================================================================\n');

  currentTunnelUrl = url;
  failedPingCount = 0;
  fs.writeFileSync(activeUrlPath, url + '\n', 'utf8');

  // Update configurations
  fs.writeFileSync(envProdPath, `VITE_API_URL=${url}\n`, 'utf8');

  const vercelConfig = {
    rewrites: [
      { source: "/api/(.*)", destination: `${url}/api/$1` },
      { source: "/uploads/(.*)", destination: `${url}/uploads/$1` },
      { source: "/((?!assets/).*)", destination: "/index.html" }
    ]
  };

  const vercelJsonStr = JSON.stringify(vercelConfig, null, 2) + '\n';
  fs.writeFileSync(vercelJsonPath, vercelJsonStr, 'utf8');
  fs.writeFileSync(frontendVercelJsonPath, vercelJsonStr, 'utf8');

  console.log('✓ Updated frontend/.env.production and vercel.json');

  // Verify tunnel reachability before triggering deployment
  console.log('Verifying tunnel reachability...');
  let ok = false;
  for (let i = 0; i < 8; i++) {
    await new Promise(r => setTimeout(r, 1500));
    try {
      const res = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        ok = true;
        console.log('✓ Tunnel verified reachable!');
        break;
      }
    } catch (e) {}
  }

  if (ok && !isDeploying) {
    deployToVercel(url);
  }
}

function deployToVercel(url) {
  isDeploying = true;
  console.log('\n[Supervisor] Building frontend with new tunnel URL...');
  try {
    execSync('npm --prefix frontend run build', { cwd: rootDir, stdio: 'inherit' });
    console.log('[Supervisor] Deploying to Vercel production...');
    execSync('npx vercel --prod --yes', { cwd: path.resolve(rootDir, 'frontend'), stdio: 'inherit' });
    console.log('✓ Successfully deployed production with URL:', url);
  } catch (err) {
    console.error('[Supervisor] Deploy error:', err.message);
  } finally {
    isDeploying = false;
  }
}

// Health monitor ping loop
setInterval(async () => {
  if (!currentTunnelUrl || isDeploying) return;

  try {
    const res = await fetch(`${currentTunnelUrl}/api/health`, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      failedPingCount = 0;
    } else {
      failedPingCount++;
      console.warn(`[Supervisor Monitor] Health ping returned status ${res.status} (failure ${failedPingCount}/6)`);
    }
  } catch (err) {
    failedPingCount++;
    console.warn(`[Supervisor Monitor] Health ping failed: ${err.message} (failure ${failedPingCount}/6)`);
  }

  // If 6 consecutive pings fail (90s of no connectivity), restart tunnel process
  if (failedPingCount >= 6 && currentChild) {
    console.warn('[Supervisor Monitor] Tunnel appears disconnected. Restarting tunnel process...');
    try {
      currentChild.kill();
    } catch (_) {}
  }
}, 15000);

startSupervisor();
