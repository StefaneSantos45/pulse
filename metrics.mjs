export const timezone = 'America/Sao_Paulo';
export const day = date => new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(date));
export const shift = (date, n) => new Date(Date.parse(date + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);
export function validateRange(start, end, today = day(new Date())) {
  const valid = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
  if (!valid(start) || !valid(end) || start > end || end >= today) throw new Error('Selecione datas válidas até ontem.');
  const days = Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1;
  if (days > 366) throw new Error('Selecione um intervalo de até 366 dias.');
  return days;
}
export function aggregate(snapshot, start, end) {
  const days = validateRange(start, end);
  const previousEnd = shift(start, -1), previousStart = shift(start, -days);
  const counts = new Map(); let invalidDates = 0;
  const unique = new Map(snapshot.contacts.map(c => [c.id, c]));
  for (const c of unique.values()) {
    if (!c.dateAdded || !Number.isFinite(Date.parse(c.dateAdded))) { invalidDates++; continue; }
    const key = day(c.dateAdded); counts.set(key, (counts.get(key) || 0) + 1);
  }
  const make = first => Array.from({ length: days }, (_, i) => { const date = shift(first, i); return { date, count: counts.get(date) || 0 }; });
  const current = make(start), previous = make(previousStart);
  const sum = rows => rows.reduce((total, row) => total + row.count, 0);
  const total = sum(current), previousTotal = sum(previous);
  const peak = rows => rows.reduce((best, row) => row.count > best.count ? row : best, rows[0]);
  const rows=[...unique.values()].filter(c=>c.dateAdded&&Number.isFinite(Date.parse(c.dateAdded))&&day(c.dateAdded)>=start&&day(c.dateAdded)<=end).sort((a,b)=>Date.parse(b.dateAdded)-Date.parse(a.dateAdded)||a.id.localeCompare(b.id));
  return { rows, account: snapshot.account, retrievedAt: snapshot.retrievedAt, baseTotal: unique.size, invalidDates, timezone, start, end, days, previousStart, previousEnd, current, previous, total, previousTotal, average: total / days, change: previousTotal ? (total - previousTotal) / previousTotal * 100 : null, peak: peak(current), previousPeak: peak(previous), todayCount: counts.get(day(new Date())) || 0 };
}
