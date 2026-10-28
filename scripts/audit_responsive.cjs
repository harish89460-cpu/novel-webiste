const fs = require('fs');
const path = require('path');

const cssDir = path.join(__dirname, '..', 'src', 'css');
const files = fs.readdirSync(cssDir).filter(f => f.endsWith('.css'));

console.log('=== CSS RESPONSIVE AUDIT ===\n');

const issues = [];

files.forEach(file => {
  const content = fs.readFileSync(path.join(cssDir, file), 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, i) => {
    const trimmed = line.trim();
    // 1. Fixed width >= 340px
    const widthMatch = trimmed.match(/(?<!max-)(?<!min-)width\s*:\s*([3-9]\d{2,}|[1-9]\d{3,})px/);
    if (widthMatch) {
      issues.push({ file, line: i + 1, type: 'fixed-width', detail: trimmed });
    }

    // 2. min-width >= 340px that might cause horizontal overflow
    const minWidthMatch = trimmed.match(/min-width\s*:\s*([4-9]\d{2,}|[1-9]\d{3,})px/);
    if (minWidthMatch) {
      issues.push({ file, line: i + 1, type: 'large-min-width', detail: trimmed });
    }
  });
});

console.log(`Found ${issues.length} potential fixed/min-width constraints:\n`);
issues.slice(0, 35).forEach(iss => {
  console.log(`[${iss.type}] ${iss.file}:${iss.line} -> ${iss.detail}`);
});

