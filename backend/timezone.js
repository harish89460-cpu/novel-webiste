// Rudhra Prarthana Novels — Centralized IST (Asia/Kolkata, UTC+05:30) Timezone Engine
// Guarantees consistent 12-hour AM/PM formatting and correct MySQL DATETIME storage

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/**
 * Parses any incoming date representation into an exact IST MySQL DATETIME string: 'YYYY-MM-DD HH:mm:ss'
 * Accepts:
 *  - Component object: { date: 'YYYY-MM-DD', hour: 1-12, minute: 0-59, ampm: 'AM'|'PM' }
 *  - Datetime string: 'YYYY-MM-DD HH:mm:ss', 'YYYY-MM-DDTHH:mm'
 *  - ISO timestamp: '2026-10-29T15:00:00.000Z'
 *  - Date instance or unix timestamp
 */
export function parseISTDateTime(input) {
  if (!input) return null;

  // Case 1: Structured component object { date, hour, minute, ampm }
  if (typeof input === 'object' && !(input instanceof Date) && input.date) {
    let hour = parseInt(input.hour || 12, 10);
    const minute = parseInt(input.minute || 0, 10);
    const ampm = String(input.ampm || 'AM').trim().toUpperCase();

    if (ampm === 'PM' && hour < 12) hour += 12;
    if (ampm === 'AM' && hour === 12) hour = 0;

    const hh = String(hour).padStart(2, '0');
    const mm = String(minute).padStart(2, '0');
    const dateStr = String(input.date).trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return null;
    }
    return `${dateStr} ${hh}:${mm}:00`;
  }

  // Case 2: Standard local string 'YYYY-MM-DD HH:mm:ss' or 'YYYY-MM-DDTHH:mm' (without explicit Z/offset)
  if (typeof input === 'string') {
    const trimmed = input.trim();
    const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/);
    if (match && !trimmed.endsWith('Z') && !trimmed.includes('+')) {
      const [, y, m, d, hh, mm, ss] = match;
      return `${y}-${m}-${d} ${hh}:${mm}:${ss || '00'}`;
    }
  }

  // Case 3: Parse Date instance or timestamp / ISO string with offset
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return null;

  // Convert to IST
  const istDate = new Date(d.getTime() + IST_OFFSET_MS);
  const y = istDate.getUTCFullYear();
  const m = String(istDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(istDate.getUTCDate()).padStart(2, '0');
  const hh = String(istDate.getUTCHours()).padStart(2, '0');
  const mm = String(istDate.getUTCMinutes()).padStart(2, '0');
  const ss = String(istDate.getUTCSeconds()).padStart(2, '0');

  return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
}

/**
 * Returns the current date and time in IST as 'YYYY-MM-DD HH:mm:ss'
 */
export function getISTNowString() {
  const istDate = new Date(Date.now() + IST_OFFSET_MS);
  const y = istDate.getUTCFullYear();
  const m = String(istDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(istDate.getUTCDate()).padStart(2, '0');
  const hh = String(istDate.getUTCHours()).padStart(2, '0');
  const mm = String(istDate.getUTCMinutes()).padStart(2, '0');
  const ss = String(istDate.getUTCSeconds()).padStart(2, '0');
  return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
}

/**
 * Checks whether the given scheduled IST timestamp is strictly in the past
 * @param {string} scheduledIST - 'YYYY-MM-DD HH:mm:ss'
 * @param {number} graceSeconds - grace window in seconds (default: 5)
 */
export function isPastIST(scheduledIST, graceSeconds = 5) {
  if (!scheduledIST) return false;
  const now = getISTNowString();
  if (graceSeconds > 0) {
    // Subtract grace from now
    const nowParts = now.split(/[- :]/).map(Number);
    const nowDate = new Date(Date.UTC(nowParts[0], nowParts[1] - 1, nowParts[2], nowParts[3], nowParts[4], nowParts[5]));
    nowDate.setSeconds(nowDate.getSeconds() - graceSeconds);

    const schedParts = scheduledIST.split(/[- :]/).map(Number);
    const schedDate = new Date(Date.UTC(schedParts[0], schedParts[1] - 1, schedParts[2], schedParts[3], schedParts[4], schedParts[5]));

    return schedDate.getTime() < nowDate.getTime();
  }
  return scheduledIST < now;
}

/**
 * Formats an IST MySQL DATETIME string into a clean 12-hour AM/PM presentation string:
 * e.g. "29 Oct 2026, 08:30 PM IST"
 */
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

