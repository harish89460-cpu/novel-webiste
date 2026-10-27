import fs from 'fs';
import path from 'path';

function walk(dir) {
  let results = [];
  try {
    const list = fs.readdirSync(dir);
    list.forEach(file => {
      file = path.join(dir, file);
      const stat = fs.statSync(file);
      if (stat && stat.isDirectory()) {
        if (!file.includes('node_modules') && !file.includes('.git') && !file.includes('dist')) {
          results = results.concat(walk(file));
        }
      } else if (file.endsWith('.js') || file.endsWith('.html')) {
        results.push(file);
      }
    });
  } catch (e) {}
  return results;
}

const files = walk('.');
for (const f of files) {
  if (f.includes('scripts\\search_code.js')) continue;
  const content = fs.readFileSync(f, 'utf8');
  const lines = content.split('\n');
  lines.forEach((l, idx) => {
    if (l.includes('editEpisode') || l.includes('editChapter') || l.includes('openEpisodeModal') || l.includes('renderEpisodes') || l.includes('episode-title') || l.includes('chapter-title') || l.includes('editor-title-input')) {
      if (l.length < 200) {
        console.log(`${f}:${idx+1}: ${l.trim()}`);
      }
    }
  });
}
