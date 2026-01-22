import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  computed,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  addMonths,
  buildMonthGrid,
  isSameDay,
  monthLabel,
  monthName,
  normalizeDate,
  startOfMonth,
  yearOptions,
} from '../date-range/date-utils';
import { PRESETS, calcPresetRange, DEFAULT_PRESET } from '../date-range/presets';
import { ActiveField, ActivePreset, DateRange, QuickKey } from '../date-range/date-range.types';

function addDays(d: Date, deltaDays: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + deltaDays);
  return normalizeDate(x);
}

type CalId = 'top' | 'bottom';

type PresetItem = { key: QuickKey; label: string } | { key: 'custom'; label: string };

@Component({
  selector: 'app-date-range-picker-proto4',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './date-range-picker-proto4.component.html',
  styleUrls: ['./date-range-picker-proto4.component.css'],
})
export class DateRangePickerProto4Component {
  /**
   * Applied range (controlled by parent).
   * - To start "empty", pass { start: null, end: null }.
   */
  @Input({ required: true }) value!: DateRange;
  @Output() valueChange = new EventEmitter<DateRange>();

  /** Premium toggles the preset panel on the left. */
  @Input() isPremium = true;

  /**
   * Optional initial preset:
   * - If provided AND the incoming value is empty, the component will apply it once on init.
   * - Ignored when isPremium = false.
   *
   * Pass null/undefined to start empty (typical for standard users).
   */
  @Input() initialPreset: QuickKey | null | undefined = DEFAULT_PRESET;

/**
 * Maximum allowed range between start and end.
 * - If maxRangeDays is provided, it takes priority.
 * - Otherwise maxRangeYears is used.
 */
@Input() maxRangeDays?: number;
@Input() maxRangeYears = 2;

/**
 * Message template shown when the range exceeds the limit.
 * Use {limit} and {unit} placeholders (e.g. "Date range cannot exceed {limit} {unit}.").
 */
@Input() maxRangeMessageTemplate = 'Please select a date range that does not exceed {limit} {unit}.';

  /** Presets list shown in the left panel (order matters). */
  presets: PresetItem[] = [
    ...PRESETS.filter((p) => p.key !== 'lastYear'),
    { key: 'custom' as const, label: 'Custom' },
  ];
  visiblePresets(): PresetItem[] {
    // Premium should not show "Today" in the left preset panel per UX spec.
    if (this.isPremium) return this.presets.filter((p) => p.key !== 'today');
    return this.presets;
  }



  

  /**
   * "today" is the max allowed date (future dates are blocked).
   * Normalize once to avoid time-zone/time-of-day surprises.
   */  
  today = normalizeDate(new Date());
  todayYear = this.today.getFullYear();
  private todayMonth = this.today.getMonth();

  /** Applied vs draft handling (same model as Prototype 3). */
  appliedValue = signal<DateRange>({ start: null, end: null });
  draft = signal<DateRange>({ start: null, end: null });

  /** Calendar open state */
  isOpen = signal(false);

  /** Active input field (blue focus ring) */
  activeField = signal<ActiveField>('start');

  /**
   * When true, show per-field validations.
   * We keep this TRUE after "Clear" until both fields are valid again.
   */
  showError = signal(false);

  /** Track which preset is currently "active" (based on applied value). */
  activePresetKey = signal<ActivePreset>(null);

  /**
   * Tracks how the CURRENT applied value should be displayed:
   * - 'preset' => show preset label (premium only, and only when user explicitly applied a preset without edits)
   * - 'custom' => show date range
   */
  appliedDisplayMode = signal<'preset' | 'custom'>('custom');
  appliedPresetKey = signal<QuickKey | null>(null);

  /** Tracks how the CURRENT draft was produced (for Apply semantics). */
  draftMode = signal<'preset' | 'custom'>('custom');
  draftPresetKey = signal<QuickKey | null>(null);

  /** Calendar months: two consecutive months */
  topMonth = signal<Date>(startOfMonth(addMonths(this.today, -1)));
  bottomMonth = signal<Date>(startOfMonth(this.today));

  months = Array.from({ length: 12 }).map((_, i) => monthName(i));

  /** Short month labels for the Month grid picker */
  monthsShort = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  /** Month label for the picker button */
  monthShortLabel(index: number): string {
    return this.monthsShort[index] ?? '';
  }

  monthFullLabel(index: number): string {
    return this.months[index] ?? '';
  }

  /** Open sub-picker state (month/year) for top/bottom calendar headers */
  private openPicker = signal<{ cal: CalId; kind: 'month' | 'year' } | null>(null);

  private yearAnchorTop = signal<number>(this.today.getFullYear());
  private yearAnchorBottom = signal<number>(this.today.getFullYear());

  /** Year picker shows exactly one 12-cell page (4x3). End-year is bottom-right. */
  private yearPageEndTop = signal<number>(this.today.getFullYear());
  private yearPageEndBottom = signal<number>(this.today.getFullYear());

  isMonthPickerOpen(cal: CalId): boolean {
    const v = this.openPicker();
    return !!v && v.cal === cal && v.kind === 'month';
  }

  isYearPickerOpen(cal: CalId): boolean {
    const v = this.openPicker();
    return !!v && v.cal === cal && v.kind === 'year';
  }

  private closePickers(): void {
    this.openPicker.set(null);
  }

  toggleMonthPicker(cal: CalId): void {
    if (this.isMonthPickerOpen(cal)) {
      this.closePickers();
      return;
    }
    this.openPicker.set({ cal, kind: 'month' });
  }

  toggleYearPicker(cal: CalId): void {
    if (this.isYearPickerOpen(cal)) {
      this.closePickers();
      return;
    }

    const todayYear = this.today.getFullYear();
    const selected = cal === 'top' ? this.topYearValue() : this.bottomYearValue();

    // Page end-year rules:
    // - If selected year is within the newest 12 (todayYear-11..todayYear) keep the newest page (ends at todayYear).
    // - Otherwise open the page that ends at the selected year.
    const newestWindowStart = todayYear - 11;
    const endYear = selected >= newestWindowStart ? todayYear : Math.min(selected, todayYear);

    if (cal === 'top') {
      this.yearAnchorTop.set(Math.min(selected, todayYear));
      this.yearPageEndTop.set(endYear);
    } else {
      this.yearAnchorBottom.set(Math.min(selected, todayYear));
      this.yearPageEndBottom.set(endYear);
    }

    this.openPicker.set({ cal, kind: 'year' });
  }



  pickMonth(cal: CalId, monthIndex: number): void {
    this.setMonthIndex(cal, monthIndex);
    this.closePickers();
  }

  pickYear(cal: CalId, year: number): void {
    this.setYearValue(cal, year);
    this.closePickers();
  }

    /** Current end-year (bottom-right) for the visible 12-cell Year grid */
  yearPageEnd(cal: CalId): number {
    return cal === 'top' ? this.yearPageEndTop() : this.yearPageEndBottom();
  }

  /** Wheel pagination for Year picker: moves by 12 years (3 rows) */
  onYearWheel(cal: CalId, ev: WheelEvent): void {
    ev.preventDefault();
    ev.stopPropagation();

    const todayYear = this.today.getFullYear();
    const minEnd = 1900 + 11;
    const delta = ev.deltaY > 0 ? 12 : -12;

    const currentEnd = this.yearPageEnd(cal);
    let nextEnd = currentEnd + delta;
    if (nextEnd > todayYear) nextEnd = todayYear;
    if (nextEnd < minEnd) nextEnd = minEnd;

    if (cal === 'top') this.yearPageEndTop.set(nextEnd);
    else this.yearPageEndBottom.set(nextEnd);
  }

  yearsForEndYear(endYear: number): number[] {
    const start = endYear - 11;
    return Array.from({ length: 12 }, (_, i) => start + i);
  }

  dow = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  /** --- Initialization --- */
  constructor(private host: ElementRef<HTMLElement>) {}

  ngOnInit() {
    // Sync internal applied state from the controlled input.
    this.appliedValue.set(this.value ?? { start: null, end: null });
// If empty + premium + initial preset provided => apply once.
const isEmpty = !this.value?.start && !this.value?.end;
if (this.isPremium && this.initialPreset && isEmpty) {
  const r = calcPresetRange(this.initialPreset, this.today);
  this.commitApplied(r, {
    activePreset: this.initialPreset,
    displayMode: 'preset',
    presetKey: this.initialPreset,
  });
} else {
  const detected = this.isPremium ? this.detectPreset(this.appliedValue()) : null;
  this.activePresetKey.set(detected);

  if (this.isPremium && detected && detected !== 'custom') {
    this.appliedDisplayMode.set('preset');
    this.appliedPresetKey.set(detected);
  } else {
    this.appliedDisplayMode.set('custom');
    this.appliedPresetKey.set(null);
  }
}


    // Position initial calendars:
    const start = this.appliedValue().start;
    if (start) {
      this.positionCalendarsAtStart(start);
    } else {
      this.openFreshCalendars();
    }
  }

  /** --- Trigger / label --- */
  triggerLabel = computed(() => {
    const r = this.appliedValue();
    if (!r.start || !r.end) return '';

    if (this.isPremium && this.appliedDisplayMode() === 'preset' && this.appliedPresetKey()) {
      const p = this.presets.find((x) => x.key === this.appliedPresetKey());
      return p?.label ?? this.formatRange(r);
    }
    return this.formatRange(r);
  });

  placeholderText = computed(() => {
    const r = this.appliedValue();
    return r.start && r.end ? '' : 'Select start and end dates';
  });

  /** Message under the field (same idea as P3). */
  dateRangeMessage = computed(() => {
    const r = this.appliedValue();
    if (!r.start || !r.end) return '';
    return `Current selection: ${this.formatRange(r)}`;
  });

  /** --- Open / close (draft vs applied) --- */
  toggleOpen() {
    if (this.isOpen()) {
      this.cancel();
      return;
    }
    this.openPanelForEdit();
  }

  openPanelForEdit() {
    // Start in "editing start" mode by default (matches our spec).
    this.activeField.set('start');
    this.showError.set(false);

    const applied = this.appliedValue();
    this.draft.set({ ...applied });

    // Position calendars.
    if (this.draft().start) {
      this.positionCalendarsAtStart(this.draft().start!);
    } else {
      this.openFreshCalendars();
    }

    this.isOpen.set(true);
  }

  cancel() {
    this.closePickers();
    // Discard draft changes and restore applied state.
    this.draft.set({ ...this.appliedValue() });
    this.showError.set(false);
    this.isOpen.set(false);

    // Reposition calendars back to applied (or fresh).
    const a = this.appliedValue();
    if (a.start) this.positionCalendarsAtStart(a.start);
    else this.openFreshCalendars();
  }

  /** Close button: same as clicking outside (discard draft). */
  closePanel() {
    this.cancel();
  }


  /** --- Presets (left panel) --- */
  selectPreset(key: ActivePreset) {
  if (key === null) return;
  // Prototype 4 rule: selecting a preset DOES NOT close the panel.
  // It sets the draft to that range and positions calendars at the start date.
  if (key === 'custom') {
    const start = startOfMonth(this.today);
    const end = this.today;
    this.draft.set({ start, end });
    this.activeField.set('start');
    this.showError.set(false);

    // Custom always resets to current-month-to-today.
    this.draftMode.set('custom');
    this.draftPresetKey.set(null);
    this.activePresetKey.set('custom');

    this.positionCalendarsAtStart(start);
    return;
  }

  // Quick presets
  const r = calcPresetRange(key, this.today);
  this.draft.set(r);
  this.activeField.set('start');
  this.showError.set(false);

  this.positionCalendarsAtStart(r.start!);

  // Track as preset-origin draft (unless user later edits, then it becomes custom).
  this.draftMode.set('preset');
  this.draftPresetKey.set(key);

  // For highlight in the preset list, we can treat it as "draft preset".
  this.activePresetKey.set(key);
}


  /** --- Inputs / focus --- */
  setActive(field: ActiveField) {
    this.activeField.set(field);
    this.recenterCalendarsForActiveField(field);
  }

  /** --- Calendar navigation helpers (same rules as P3) --- */
  topMonthIndex = computed(() => this.topMonth().getMonth());
  bottomMonthIndex = computed(() => this.bottomMonth().getMonth());
  topYearValue = computed(() => this.topMonth().getFullYear());
  bottomYearValue = computed(() => this.bottomMonth().getFullYear());

  label(d: Date) {
    return monthLabel(d);
  }

  topGrid = computed(() => buildMonthGrid(this.topMonth()));
  bottomGrid = computed(() => buildMonthGrid(this.bottomMonth()));

  /** Future month checks used by selects */
  isFutureMonth(cal: CalId, monthIndex: number, year: number): boolean {
    const candidate = new Date(year, monthIndex, 1);
    // Disable months beyond current month/year.
    const current = startOfMonth(this.today);
    return startOfMonth(candidate) > current;
  }

  /** Year options are limited (<= current year) */
  topYearsLimited = computed(() =>
  yearOptions(this.topMonth().getFullYear(), 6)
    .filter((y) => y <= this.todayYear)
);
bottomYearsLimited = computed(() =>
  yearOptions(this.bottomMonth().getFullYear(), 6)
    .filter((y) => y <= this.todayYear)
);

  /** Disable year options that would create a future month. */
  isYearOptionDisabled(cal: CalId, year: number): boolean {
    const monthIndex = cal === 'top' ? this.topMonthIndex() : this.bottomMonthIndex();
    return this.isFutureMonth(cal, monthIndex, year);
  }

  /** Can the given calendar move next without pushing bottom into the future? */
  canGoNext(cal: CalId): boolean {
    const current = startOfMonth(this.today);
    if (cal === 'bottom') {
      return addMonths(this.bottomMonth(), 1) <= current;
    }
    // For top, next would shift both calendars (keep consecutive).
    const nextTop = addMonths(this.topMonth(), 1);
    const nextBottom = addMonths(this.bottomMonth(), 1);
    return nextBottom <= current && startOfMonth(nextTop) < startOfMonth(nextBottom);
  }

  prevMonth(cal: CalId) {
    if (cal === 'top') {
      this.topMonth.set(startOfMonth(addMonths(this.topMonth(), -1)));
      this.bottomMonth.set(startOfMonth(addMonths(this.bottomMonth(), -1)));
    } else {
      this.topMonth.set(startOfMonth(addMonths(this.topMonth(), -1)));
      this.bottomMonth.set(startOfMonth(addMonths(this.bottomMonth(), -1)));
    }
  }

  nextMonth(cal: CalId) {
    if (!this.canGoNext(cal)) return;
    this.topMonth.set(startOfMonth(addMonths(this.topMonth(), 1)));
    this.bottomMonth.set(startOfMonth(addMonths(this.bottomMonth(), 1)));
  }

  setMonthIndex(cal: CalId, monthIndex: number) {
    const year = cal === 'top' ? this.topYearValue() : this.bottomYearValue();
    const candidate = startOfMonth(new Date(year, monthIndex, 1));
    const current = startOfMonth(this.today);
    if (candidate > current) return;

    if (cal === 'top') {
      this.topMonth.set(candidate);
      this.bottomMonth.set(startOfMonth(addMonths(candidate, 1)));
      if (this.bottomMonth() > current) {
        // Clamp: if bottom would go into the future, keep bottom at current and top at previous.
        this.bottomMonth.set(current);
        this.topMonth.set(startOfMonth(addMonths(current, -1)));
      }
    } else {
      // bottom month selects also shift top to previous to maintain consecutive.
      const bottomCandidate = candidate;
      if (bottomCandidate > current) return;

      this.bottomMonth.set(bottomCandidate);
      this.topMonth.set(startOfMonth(addMonths(bottomCandidate, -1)));
    }
  }

  setYearValue(cal: CalId, year: number) {
    const monthIndex = cal === 'top' ? this.topMonthIndex() : this.bottomMonthIndex();
    this.setMonthIndex(cal, monthIndex); // monthIndex logic already checks future with current year value
    // But we need to actually apply year. Rebuild candidate directly.
    const candidate = startOfMonth(new Date(year, monthIndex, 1));
    const current = startOfMonth(this.today);
    if (candidate > current) return;

    if (cal === 'top') {
      this.topMonth.set(candidate);
      this.bottomMonth.set(startOfMonth(addMonths(candidate, 1)));
      if (this.bottomMonth() > current) {
        this.bottomMonth.set(current);
        this.topMonth.set(startOfMonth(addMonths(current, -1)));
      }
    } else {
      this.bottomMonth.set(candidate);
      this.topMonth.set(startOfMonth(addMonths(candidate, -1)));
    }
  }

  /** --- Date selection rules (same as P3, including "elastic" behavior) --- */
  isCellDisabled(d: Date): boolean {
    return normalizeDate(d) > this.today;
  }

  inRange(d: Date): boolean {
    const r = this.draft();
    if (!r.start || !r.end) return false;
    const n = normalizeDate(d);
    return n >= r.start && n <= r.end;
  }

  
  isToday(d: Date): boolean {
    return isSameDay(normalizeDate(d), normalizeDate(this.today));
  }

isStart(d: Date): boolean {
    const r = this.draft();
    return !!r.start && isSameDay(d, r.start);
  }

  isEnd(d: Date): boolean {
    const r = this.draft();
    return !!r.end && isSameDay(d, r.end);
  }
  pickDate(d: Date) {
    if (this.isCellDisabled(d)) return;

    const n = normalizeDate(d);
    const r = this.draft();
    const todayN = normalizeDate(this.today);

    // If user started from a preset and then edits manually => switch context to Custom (no reset).
    if (this.isPremium && this.draftMode() === 'preset') {
      this.activePresetKey.set('custom');
      this.draftMode.set('custom');
      this.draftPresetKey.set(null);
    }

    const clampEndForStart = (start: Date): Date => {
      const next = addDays(start, 1);
      return next > todayN ? todayN : next;
    };

    // 1) No selection yet => first click sets Start, focus moves to End.
    if (!r.start && !r.end) {
      this.draft.set({ start: n, end: null });
      this.activeField.set('end');

      // Keep validation visible after a Reset/Clear until BOTH dates are selected.
      if (this.showError()) {
        const rr = this.draft();
        this.showError.set(!(rr.start && rr.end));
      }
      return;
    }

    // 2) Start set but End not set => treat click as End attempt.
    if (r.start && !r.end) {
      if (n >= r.start) {
        // Valid end.
        this.draft.set({ start: r.start, end: n });
        this.activeField.set('start'); // pivot back to start
        this.showError.set(false);
      } else {
        // Clicked before start: move start back, auto-set end to next day (clamped), keep focus on end.
        const newStart = n;
        const newEnd = clampEndForStart(newStart);
        this.draft.set({ start: newStart, end: newEnd });
        this.activeField.set('end');
        // End may already be valid; we still keep user on end for adjustment.
        this.showError.set(false);
      }
      return;
    }

    // 3) Both Start and End set => edit based on active field + special rules.
    if (r.start && r.end) {
      const field = this.activeField();

      if (field === 'start') {
        if (n > r.end) {
          // Click beyond current end: restart range at clicked day; end becomes next day (clamped); focus end.
          const newStart = n;
          const newEnd = clampEndForStart(newStart);
          this.draft.set({ start: newStart, end: newEnd });
          this.activeField.set('end');
        } else {
          // Click inside (or before) current range: move start to clicked day; focus end.
          this.draft.set({ start: n, end: r.end });
          this.activeField.set('end');
        }
        this.showError.set(false);
        return;
      }

      // field === 'end'
      if (n >= r.start) {
        this.draft.set({ start: r.start, end: n });
        this.activeField.set('start'); // pivot back to start
        this.showError.set(false);
      } else {
        // End picked before start: move start back; end becomes next day (clamped); keep focus end.
        const newStart = n;
        const newEnd = clampEndForStart(newStart);
        this.draft.set({ start: newStart, end: newEnd });
        this.activeField.set('end');
        this.showError.set(false);
      }
    }
  }

  /** --- Clear / Apply --- */
  
  clearDraft() {
    this.closePickers();

    if (this.isPremium) {
      // Premium "Reset": revert back to the last applied state, keep the calendar open.
      const prev = this.appliedValue();
      this.draft.set({ start: prev.start, end: prev.end });

      // Restore highlight/context based on what was last applied.
      if (this.appliedDisplayMode() === 'preset' && this.appliedPresetKey()) {
        this.activePresetKey.set(this.appliedPresetKey()!);
        this.draftMode.set('preset');
        this.draftPresetKey.set(this.appliedPresetKey()!);
      } else {
        this.activePresetKey.set('custom');
        this.draftMode.set('custom');
        this.draftPresetKey.set(null);
      }

      this.activeField.set('start');
      this.showError.set(false);

      // Ensure calendars are positioned around the restored draft.
      if (prev.start) this.positionCalendarsAtStart(prev.start);
      else this.openFreshCalendars();

      return;
    }

    // Standard "Clear": clear selection and close the calendar. No field warnings.
    this.draft.set({ start: null, end: null });
    this.activeField.set('start');
    this.showError.set(false);

    this.openFreshCalendars();
    this.isOpen.set(false);
  }

  private addDaysLocal(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

private addYearsLocal(d: Date, years: number): Date {
  const x = new Date(d);
  x.setFullYear(x.getFullYear() + years);
  return x;
}

private diffDaysInclusive(start: Date, end: Date): number {
  const s = normalizeDate(start);
  const e = normalizeDate(end);
  const ms = e.getTime() - s.getTime();
  return Math.floor(ms / 86400000) + 1;
}

rangeTooLarge = computed(() => {
  const r = this.draft();
  if (!r.start || !r.end) return false;

  const s = normalizeDate(r.start);
  const e = normalizeDate(r.end);

  // Days takes priority when provided
  if (this.maxRangeDays != null) {
    const days = this.diffDaysInclusive(s, e);
    return days > this.maxRangeDays;
  }

  const years = this.maxRangeYears ?? 2;
  const limitEnd = normalizeDate(this.addYearsLocal(s, years));
  return e.getTime() > limitEnd.getTime();
});

rangeTooLargeMessage = computed(() => {
  if (!this.rangeTooLarge()) return '';
  const useDays = this.maxRangeDays != null;
  const limit = useDays ? this.maxRangeDays! : (this.maxRangeYears ?? 2);
  const unit = useDays ? (limit === 1 ? 'day' : 'days') : (limit === 1 ? 'year' : 'years');
  return this.maxRangeMessageTemplate
    .replace('{limit}', String(limit))
    .replace('{unit}', unit);
});

canApply = computed(() => !!this.draft().start && !!this.draft().end && !this.rangeTooLarge());

applyTooltipText(): string | null {
  if (this.isPremium) return null;
  const r = this.draft();
  if (r.start && r.end) return null;
  // Only show tooltip guidance for Standard users when Apply is disabled due to missing dates.
  if (!r.start && !r.end) return 'Select a start and end date to apply';
  if (!r.end) return 'Select an end date to apply';
  return 'Select a start date to apply';
}


apply() {
  this.closePickers();
  if (!this.canApply()) {
    this.showError.set(true);
    return;
  }

  const r = this.draft() as { start: Date; end: Date };

  // Apply semantics:
  // - Only show preset label if user explicitly chose a preset and applied without edits.
  // - Anything coming from Custom (or edited) is treated as Custom and displays a date range.
  if (this.isPremium && this.draftMode() === 'preset' && this.draftPresetKey()) {
    this.commitApplied(r, {
      activePreset: this.draftPresetKey()!,
      displayMode: 'preset',
      presetKey: this.draftPresetKey()!,
    });
  } else {
    this.commitApplied(r, {
      activePreset: this.isPremium ? 'custom' : null,
      displayMode: 'custom',
      presetKey: null,
    });
  }

  this.isOpen.set(false);
}

/** --- Utilities --- */

  private commitApplied(
  r: { start: Date; end: Date },
  meta: { activePreset: ActivePreset; displayMode: 'preset' | 'custom'; presetKey: QuickKey | null }
) {
  const next: DateRange = { start: r.start, end: r.end };
  this.appliedValue.set(next);
  this.valueChange.emit(next);

  // Track active preset for highlight in the preset list (premium only).
  this.activePresetKey.set(meta.activePreset);

  // Track how the applied value should be displayed in the trigger.
  this.appliedDisplayMode.set(meta.displayMode);
  this.appliedPresetKey.set(meta.displayMode === 'preset' ? meta.presetKey : null);

  // Reposition calendars to start date (per spec).
  this.positionCalendarsAtStart(r.start);
}

  private formatRange(r: DateRange): string {
    if (!r.start || !r.end) return '';
    const fmt = (d: Date) =>
      `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(
        2,
        '0',
      )}/${d.getFullYear()}`;
    return `${fmt(r.start)} - ${fmt(r.end)}`;
  }

  private detectPreset(r: DateRange): ActivePreset {
    if (!r.start || !r.end) return null;

    // Compare to each preset as of "today".
    for (const p of this.presets) {
      if (p.key === 'custom') continue;
      const pr = calcPresetRange(p.key, this.today);
      if (isSameDay(pr.start!, r.start) && isSameDay(pr.end!, r.end)) return p.key;
    }
    return 'custom';
  }


  /**
   * Recenter calendars to the month that corresponds to the active field (same UX as Prototype 3).
   * - start: top = start month, bottom = next month
   * - end:   bottom = end month, top = previous month
   */
  private recenterCalendarsForActiveField(field: ActiveField) {
    const d = field === 'start' ? this.draft().start : this.draft().end;
    if (!d) return;
    const clamped = this.clampToToday(d);
    if (field === 'start') {
      this.positionCalendarsAtStart(clamped);
    } else {
      this.positionCalendarsAtEnd(clamped);
    }
  }

  private clampToToday(d: Date): Date {
    const nd = normalizeDate(d);
    return nd > this.today ? this.today : nd;
  }

  private positionCalendarsAtEnd(end: Date) {
    const endM = startOfMonth(end);
    const current = startOfMonth(this.today);
    const next = startOfMonth(addMonths(endM, 1));

    // Default: show the focused month on top and the next month below.
    if (next <= current) {
      this.topMonth.set(endM);
      this.bottomMonth.set(next);
      return;
    }

    // If the next month is in the future (e.g., end date is in the current month), clamp to (previous, current).
    this.bottomMonth.set(current);
    this.topMonth.set(startOfMonth(addMonths(current, -1)));
  }

  private positionCalendarsAtStart(start: Date) {
    const top = startOfMonth(start);
    this.topMonth.set(top);
    this.bottomMonth.set(startOfMonth(addMonths(top, 1)));

    // Clamp bottom if it becomes future.
    const current = startOfMonth(this.today);
    if (this.bottomMonth() > current) {
      this.bottomMonth.set(current);
      this.topMonth.set(startOfMonth(addMonths(current, -1)));
    }
  }

  private openFreshCalendars() {
    const current = startOfMonth(this.today);
    this.bottomMonth.set(current);
    this.topMonth.set(startOfMonth(addMonths(current, -1)));
  }

  /** Outside click closes the panel (cancel edits). */
  @HostListener('document:mousedown', ['$event'])
  onDocMouseDown(ev: MouseEvent) {
    const el = this.host.nativeElement;
    if (ev.target instanceof Node && !el.contains(ev.target)) {
      if (this.isOpen()) this.cancel();
    }
  }
}