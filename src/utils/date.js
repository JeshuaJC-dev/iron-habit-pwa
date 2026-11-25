// Local-timezone date helpers (avoids UTC midnight shift from toISOString())

export function formatLocalDate(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getTodayLocal() {
  return formatLocalDate(new Date());
}

export function parseLocalDate(dateStr) {
  return new Date(`${dateStr}T12:00:00`);
}

export function getMondayLocalKey(dateStr) {
  const d = parseLocalDate(dateStr);
  const day = d.getDay(); // 0 = Sun, 1 = Mon...
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setDate(diff);
  return formatLocalDate(monday);
}
