const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const tunnelUrl = 'https://equipped-checking-predicted-relax.trycloudflare.com';

fs.writeFileSync(path.resolve(rootDir, 'active_tunnel_url.txt'), tunnelUrl + '\n', 'utf8');
fs.writeFileSync(path.resolve(rootDir, 'frontend', '.env.production'), `VITE_API_URL=${tunnelUrl}\n`, 'utf8');

const vercelConfig = {
  rewrites: [
    { source: "/api/(.*)", destination: `${tunnelUrl}/api/$1` },
    { source: "/uploads/(.*)", destination: `${tunnelUrl}/uploads/$1` },
    { source: "/((?!assets/).*)", destination: "/index.html" }
  ]
};

const jsonStr = JSON.stringify(vercelConfig, null, 2) + '\n';
fs.writeFileSync(path.resolve(rootDir, 'vercel.json'), jsonStr, 'utf8');
fs.writeFileSync(path.resolve(rootDir, 'frontend', 'vercel.json'), jsonStr, 'utf8');

console.log('✓ Successfully synchronized tunnel URL to all config files:', tunnelUrl);

