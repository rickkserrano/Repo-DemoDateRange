const LOCALE = 'en-US';

export function normalizeDate(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function startOfMonth(d: Date): Date {
  const n = normalizeDate(d);
  return new Date(n.getFullYear(), n.getMonth(), 1);
}

export function addDays(d: Date, delta: number): Date {
  const n = normalizeDate(d);
  const out = new Date(n);
  out.setDate(out.getDate() + delta);
  return normalizeDate(out);
}

export function addMonths(d: Date, delta: number): Date {
  const m = startOfMonth(d);
  return startOfMonth(new Date(m.getFullYear(), m.getMonth() + delta, 1));
}

export function daysInMonth(d: Date): number {
  const y = d.getFullYear();
  const m = d.getMonth();
  return new Date(y, m + 1, 0).getDate();
}

export function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function monthLabel(d: Date): string {
  return d.toLocaleString(LOCALE, { month: 'long', year: 'numeric' });
}

export function monthName(monthIndex: number): string {
  return new Date(2020, monthIndex, 1).toLocaleString(LOCALE, {
    month: 'long',
  });
}

export function yearOptions(centerYear: number, radius: number): number[] {
  const years: number[] = [];
  for (let y = centerYear - radius; y <= centerYear + radius; y++)
    years.push(y);
  return years;
}

export function buildMonthGrid(month: Date): (Date | null)[] {
  const start = startOfMonth(month);
  const dim = daysInMonth(start);
  const firstDow = start.getDay(); // 0..6 Sun..Sat

  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);

  for (let day = 1; day <= dim; day++) {
    cells.push(new Date(start.getFullYear(), start.getMonth(), day));
  }

  while (cells.length % 7 !== 0) cells.push(null);
  while (cells.length < 42) cells.push(null);

  return cells;
}
