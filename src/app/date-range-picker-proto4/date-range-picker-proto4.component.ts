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

type CalId = 'top' | 'bottom';

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

  /** Presets list shown in the left panel (order matters). */
  presets = PRESETS;

  

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

  /** Calendar months: two consecutive months */
  topMonth = signal<Date>(startOfMonth(addMonths(this.today, -1)));
  bottomMonth = signal<Date>(startOfMonth(this.today));

  months = Array.from({ length: 12 }).map((_, i) => monthName(i));
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
      this.commitApplied(r, this.initialPreset);
    } else {
      this.activePresetKey.set(this.detectPreset(this.appliedValue()));
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
    const presetKey = this.detectPreset(r);
    if (this.isPremium && presetKey && presetKey !== 'custom') {
      const p = this.presets.find((x) => x.key === presetKey);
      return p?.label ?? this.formatRange(r);
    }
    return this.formatRange(r);
  });

  placeholderText = computed(() => {
    const r = this.appliedValue();
    return r.start && r.end ? '' : 'Select range';
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
    // Discard draft changes and restore applied state.
    this.draft.set({ ...this.appliedValue() });
    this.showError.set(false);
    this.isOpen.set(false);

    // Reposition calendars back to applied (or fresh).
    const a = this.appliedValue();
    if (a.start) this.positionCalendarsAtStart(a.start);
    else this.openFreshCalendars();
  }

  /** --- Presets (left panel) --- */
  selectPreset(key: QuickKey) {
    // Prototype 4 rule: selecting a preset DOES NOT close the panel.
    // It sets the draft to that range and positions calendars at the start date.
    const r = calcPresetRange(key, this.today);
    this.draft.set(r);
    this.activeField.set('start');
    this.showError.set(false);

    this.positionCalendarsAtStart(r.start!);

    // We do NOT change applied until Apply dates.
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

    // Clear preset highlight as soon as user starts manual edits (treat as custom).
    if (this.isPremium) this.activePresetKey.set('custom');

    // If draft is empty, set start.
    if (!r.start && !r.end) {
      this.draft.set({ start: n, end: null });
      this.activeField.set('end');
      this.showError.set(false);
      return;
    }

    // If only start is set, second click sets end (or swaps).
    if (r.start && !r.end) {
      if (n < r.start) {
        this.draft.set({ start: n, end: r.start });
      } else {
        this.draft.set({ start: r.start, end: n });
      }
      this.activeField.set('start'); // back to start editing by default
      this.showError.set(false);
      return;
    }

    // Both start and end are set: edit based on active field,
    // with elastic behavior when crossing.
    if (r.start && r.end) {
      if (this.activeField() === 'start') {
        if (n <= r.end) {
          this.draft.set({ start: n, end: r.end });
        } else {
          // Crossed end: extend end and move focus to end
          this.draft.set({ start: r.start, end: n });
          this.activeField.set('end');
        }
      } else {
        // editing end
        if (n >= r.start) {
          this.draft.set({ start: r.start, end: n });
        } else {
          // Crossed start: extend start and move focus to start
          this.draft.set({ start: n, end: r.end });
          this.activeField.set('start');
        }
      }
      this.showError.set(false);
    }
  }

  /** --- Clear / Apply --- */
  clearDraft() {
    this.draft.set({ start: null, end: null });
    this.activeField.set('start');
    this.showError.set(true);

    // Reset months to previous + current (like Prototype 3).
    this.openFreshCalendars();

    // If premium, clear preset highlight.
    if (this.isPremium) this.activePresetKey.set('custom');
  }

  canApply = computed(() => !!this.draft().start && !!this.draft().end);

  apply() {
    if (!this.canApply()) {
      this.showError.set(true);
      return;
    }

    const r = this.draft();
    const preset = this.isPremium ? this.detectPreset(r) : null;

    this.commitApplied(r as { start: Date; end: Date }, preset);
    this.isOpen.set(false);
  }

  /** --- Utilities --- */
  private commitApplied(r: { start: Date; end: Date }, preset: ActivePreset) {
    const next: DateRange = { start: r.start, end: r.end };
    this.appliedValue.set(next);
    this.valueChange.emit(next);

    // Track active preset for label/highlight.
    this.activePresetKey.set(preset);

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
    const bottom = startOfMonth(end);
    const top = startOfMonth(addMonths(bottom, -1));
    // Prevent navigating into future months
    const current = startOfMonth(this.today);
    if (bottom > current) {
      this.bottomMonth.set(current);
      this.topMonth.set(startOfMonth(addMonths(current, -1)));
      return;
    }
    this.topMonth.set(top);
    this.bottomMonth.set(bottom);
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