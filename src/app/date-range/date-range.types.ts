export type DateRange = { start: Date | null; end: Date | null };

export type ActiveField = 'start' | 'end';

export type QuickKey =
  | 'today'
  | 'last7'
  | 'last30'
  | 'last90'
  | 'thisYear'
  | 'lastYear';

export type ActivePreset = QuickKey | 'custom' | null;
