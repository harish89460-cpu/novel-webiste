// Rudhra Prarthana Novels — Client-side IST (Asia/Kolkata, UTC+05:30) Helper

export function formatISTDisplay(istStr) {
  if (!istStr) return '';
  const match = String(istStr).match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return String(istStr);

  const [, y, m, d, hh, mm] = match;
  let hour = parseInt(hh, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12 || 12;
  const hourStr = String(hour).padStart(2, '0');

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthName = months[parseInt(m, 10) - 1] || m;

  return `${d} ${monthName} ${y}, ${hourStr}:${mm} ${ampm} IST`;
}

export function parseISTComponents(date, hour, minute, ampm) {
  if (!date) return null;
  let h = parseInt(hour || 12, 10);
  const m = parseInt(minute || 0, 10);
  const a = String(ampm || 'AM').toUpperCase();

  if (a === 'PM' && h < 12) h += 12;
  if (a === 'AM' && h === 12) h = 0;

  const hh = String(h).padStart(2, '0');
  const mm = String(m).padStart(2, '0');

  return `${date} ${hh}:${mm}:00`;
}

// Make globally accessible for inline handlers
if (typeof window !== 'undefined') {
  window.formatISTDisplay = formatISTDisplay;
  window.parseISTComponents = parseISTComponents;
}

