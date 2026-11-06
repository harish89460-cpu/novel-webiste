const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const envProdPath = path.resolve(rootDir, 'frontend', '.env.production');
const vercelJsonPath = path.resolve(rootDir, 'vercel.json');
const frontendVercelJsonPath = path.resolve(rootDir, 'frontend', 'vercel.json');

console.log('[Tunnel Launcher] Starting Cloudflare Tunnel...');
const cp = spawn('cloudflared', ['tunnel', '--url', 'http://localhost:3000'], {
  stdio: ['ignore', 'pipe', 'pipe']
});

let tunnelUrl = null;

function processOutput(data) {
  const text = data.toString();
  process.stdout.write(text);

  const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
  if (match && !tunnelUrl) {
    tunnelUrl = match[0];
    console.log('\n======================================================');
    console.log('[Tunnel Launcher] Captured Active Cloudflare Tunnel:');
    console.log(tunnelUrl);
    console.log('======================================================\n');

    fs.writeFileSync(envProdPath, `VITE_API_URL=${tunnelUrl}\n`);
    console.log('[Tunnel Launcher] Updated frontend/.env.production');

    const vercelConfig = {
      rewrites: [
        {
          source: "/api/(.*)",
          destination: `${tunnelUrl}/api/$1`
        },
        {
          source: "/uploads/(.*)",
          destination: `${tunnelUrl}/uploads/$1`
        },
        {
          source: "/((?!assets/).*)",
          destination: "/index.html"
        }
      ]
    };

    fs.writeFileSync(vercelJsonPath, JSON.stringify(vercelConfig, null, 2) + '\n');
    console.log('[Tunnel Launcher] Updated vercel.json');

    fs.writeFileSync(frontendVercelJsonPath, JSON.stringify(vercelConfig, null, 2) + '\n');
    console.log('[Tunnel Launcher] Updated frontend/vercel.json');
  }
}

cp.stdout.on('data', processOutput);
cp.stderr.on('data', processOutput);

cp.on('exit', (code) => {
  console.log(`[Tunnel Launcher] cloudflared exited with code ${code}`);
});

process.on('SIGINT', () => { cp.kill(); process.exit(); });
process.on('SIGTERM', () => { cp.kill(); process.exit(); });
