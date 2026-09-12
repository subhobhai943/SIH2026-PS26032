/** All scheduling is done in IST, independent of the server's own timezone. */
const IST_OFFSET_MINUTES = 330;

export function todayISO(now = new Date()) {
  const ist = new Date(now.getTime() + IST_OFFSET_MINUTES * 60_000);
  return ist.toISOString().slice(0, 10);
}

export function addDaysISO(dateISO, days) {
  const d = new Date(`${dateISO}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function currentISTTime(now = new Date()) {
  const ist = new Date(now.getTime() + IST_OFFSET_MINUTES * 60_000);
  const h = String(ist.getUTCHours()).padStart(2, '0');
  const m = String(ist.getUTCMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

export function isPastDate(dateISO, now = new Date()) {
  return dateISO < todayISO(now);
}

/**
 * Checks if a slot on a given date and time has already passed in IST.
 * - Date before today: always past.
 * - Date after today: not past.
 * - Date is today: past if current IST time >= slot start time.
 */
export function isPastSlot(dateISO, startTime, now = new Date()) {
  const today = todayISO(now);
  if (dateISO < today) return true;
  if (dateISO > today) return false;
  const nowTime = currentISTTime(now);
  return nowTime >= startTime;
}

/** "09:30" -> 570 */
export function minutesOfDay(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/** 570 -> "09:30" */
export function toHHMM(minutes) {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function formatWait(minutes) {
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m ? `${h} hr ${m} min` : `${h} hr`;
}
