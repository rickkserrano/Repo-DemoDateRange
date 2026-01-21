import { addDays, normalizeDate } from './date-utils';
import { DateRange, QuickKey, AppliedDateRange  } from './date-range.types';

/**
 * Default selection when no value is provided.
 * Matches Prototype 3's original behavior.
 */
export const DEFAULT_PRESET: QuickKey = 'last90';

export const PRESETS: ReadonlyArray<{ key: QuickKey; label: string }> = [
  { key: 'today', label: 'Today' },
  { key: 'last7', label: 'Last 7 days' },
  { key: 'last30', label: 'Last 30 days' },
  { key: 'last90', label: 'Last 90 days' },
  { key: 'thisYear', label: 'This year' },
  { key: 'lastYear', label: 'Last year' },
];

/** Calculate date range for a given preset key. */
export function calcPresetRange(key: QuickKey, today: Date): AppliedDateRange  {
  const t = normalizeDate(today);

  if (key === 'today') return { start: t, end: t };

  if (key === 'thisYear') return { start: new Date(t.getFullYear(), 0, 1), end: t };

  if (key === 'lastYear') {
    const y = t.getFullYear() - 1;
    return { start: new Date(y, 0, 1), end: new Date(y, 11, 31) };
  }

  const days = key === 'last7' ? 7 : key === 'last30' ? 30 : 90;
  return { start: addDays(t, -(days - 1)), end: t };
}
