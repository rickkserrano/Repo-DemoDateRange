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
import { DateRange, QuickKey } from '../date-range/date-range.types';
import { PRESETS, calcPresetRange, DEFAULT_PRESET } from '../date-range/presets';

function formatMMDDYYYY(d: Date): string {
  const n = normalizeDate(d);
  const mm = String(n.getMonth() + 1).padStart(2, '0');
  const dd = String(n.getDate()).padStart(2, '0');
  const yy = String(n.getFullYear());
  return `${mm}/${dd}/${yy}`;
}

@Component({
  selector: 'app-date-range-picker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './date-range-picker.component.html',
  styleUrls: ['./date-range-picker.component.css'],
})
export class DateRangePickerComponent {
  @Input({ required: true }) value!: DateRange;
  @Output() valueChange = new EventEmitter<DateRange>();

  presets = PRESETS;

  /**
   * "today" is the max allowed date (future dates are blocked).
   * Normalize once to avoid time-zone/time-of-day surprises.
   */
  private today = normalizeDate(new Date());
  todayYear = this.today.getFullYear();
  private todayMonth = this.today.getMonth();

  /**
   * Applied range = what the report/filter is currently using.
   * Draft range = what user is editing inside the calendar panel.
   */
  appliedValue = signal<DateRange>({ start: null, end: null });
  draft = signal<DateRange>({ start: null, end: null });

  /** Dropdown menu (presets) state */
  isMenuOpen = signal(false);

  /** Calendar panel (custom picker) state */
  isOpen = signal(false);

  /**
   * When true, show per-field validations.
   * We keep this TRUE after "Clear" until both fields are valid again.
   */
  showError = signal(false);

  /** Indicates which input user is focusing when editing an existing range */
  activeField = signal<'start' | 'end'>('start');

  /**
   * "Custom mode" flag.
   * - true while user is working inside the custom panel
   * - false when a preset is applied (or after closing the panel)
   */
  isEditingCustom = signal(false);

  /** Two consecutive months: top + bottom */
  topMonth = signal<Date>(startOfMonth(addMonths(this.today, -1)));
  bottomMonth = signal<Date>(startOfMonth(this.today));

  topGrid = computed(() => buildMonthGrid(this.topMonth()));
  bottomGrid = computed(() => buildMonthGrid(this.bottomMonth()));

  topMonthIndex = computed(() => this.topMonth().getMonth());
  bottomMonthIndex = computed(() => this.bottomMonth().getMonth());
  topYearValue = computed(() => this.topMonth().getFullYear());
  bottomYearValue = computed(() => this.bottomMonth().getFullYear());

  /**
   * Year lists for each calendar.
   * UX rule: only show years up to the current year.
   * Even if future years are disabled, displaying them adds visual noise.
   *
   * NOTE: We do NOT only disable "y > todayYear".
   * We must also disable selecting a year that would make the currently selected month a future month.
   */
  topYearsLimited = computed(() =>
    yearOptions(this.topMonth().getFullYear(), 6).filter((y) => y <= this.todayYear)
  );
  bottomYearsLimited = computed(() =>
    yearOptions(this.bottomMonth().getFullYear(), 6).filter((y) => y <= this.todayYear)
  );

  dow = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  months = Array.from({ length: 12 }, (_, i) => monthName(i));

  /**
   * Preset detection:
   * If applied range matches a preset (today/last 7/30/90), we show preset label in trigger.
   */
  activePresetKey = computed<QuickKey | null>(() => {
    const v = this.appliedValue();
    if (!v.start || !v.end) return null;
    return this.detectPreset(v);
  });

  /**
   * Trigger label:
   * - while editing custom -> show "Custom"
   * - if a preset is applied -> show preset label
   * - otherwise show explicit date range (MM/DD/YYYY - MM/DD/YYYY)
   */
  triggerLabel = computed(() => {
    if (this.isEditingCustom()) return 'Custom';

    const v = this.appliedValue();
    const presetKey = this.activePresetKey();

    if (presetKey) {
      return PRESETS.find((p) => p.key === presetKey)?.label ?? 'Date range';
    }

    if (v.start && v.end) {
      return `${formatMMDDYYYY(v.start)} - ${formatMMDDYYYY(v.end)}`;
    }

    return 'Date range';
  });

  /**
   * Message under "Date range" field (applied state).
   * This is separate from the per-input messages in the panel.
   */
  dateRangeInvalid = computed(() => {
    const v = this.appliedValue();
    return !v.start || !v.end;
  });

  dateRangeMessage = computed(() => {
    const v = this.appliedValue();
    if (v.start && v.end) return '';
    if (!v.start && !v.end) return 'Please select a start and end date.';
    if (!v.start) return 'Please select a start date.';
    return 'Please select an end date.';
  });

  /** Apply button enabled only when draft is complete */
  canApply = computed(() => !!(this.draft().start && this.draft().end));

  constructor(private host: ElementRef<HTMLElement>) {}

  ngOnInit() {
    // If host app provides an initial value, keep it.
    // Otherwise initialize with a default preset and emit it.
    if (this.value?.start && this.value?.end) {
      this.appliedValue.set(this.value);
      return;
    }

    const preset = calcPresetRange(DEFAULT_PRESET, this.today);
    this.appliedValue.set(preset);
    this.valueChange.emit(preset);
  }

  ngOnChanges() {
    this.appliedValue.set(this.value);
  }

  /**
   * Detect which preset matches a given range (if any).
   * This allows showing "Last 90 days" etc instead of explicit dates.
   */
  private detectPreset(range: DateRange): QuickKey | null {
    const s = range.start ? normalizeDate(range.start) : null;
    const e = range.end ? normalizeDate(range.end) : null;
    if (!s || !e) return null;

    for (const p of PRESETS) {
      const r = calcPresetRange(p.key, this.today);
      if (r.start && r.end) {
        if (
          normalizeDate(r.start).getTime() === s.getTime() &&
          normalizeDate(r.end).getTime() === e.getTime()
        ) {
          return p.key;
        }
      }
    }
    return null;
  }

  private monthIndex(d: Date): number {
    const n = normalizeDate(d);
    return n.getFullYear() * 12 + n.getMonth(); // month: 0..11
  }

  private clampToToday(d: Date): Date {
    const n = normalizeDate(d);
    return n.getTime() > this.today.getTime() ? this.today : n;
  }

  /**
   * Re-center the 2-calendar window so the active field's month becomes visible.
   *
   * This must work even when the current visible months are "desynced" because the user
   * navigated around without changing the selected range.
   *
   * Rules:
   * - If the active field is Start:
   *   - If Start is in the current month: show (prev month) on top and (current month) on bottom.
   *   - Else if the range spans 2 consecutive months: show start month on top, end month on bottom.
   *   - Else: show start month on top and its next month on bottom.
   * - If the active field is End:
   *   - If End is in the current month: show (prev month) on top and (current month) on bottom.
   *   - Else if the range spans 2 consecutive months: show start month on top, end month on bottom.
   *   - Else: show (prev month of end) on top and (end month) on bottom.
   *
   * Note: "current month" means the component's 'today' value, not the system clock.
   */
  private recenterCalendarsForActiveField(target: 'start' | 'end') {
    if (!this.isOpen()) return;

    const { start, end } = this.draft();
    if (!start && !end) return;

    const s = start ? normalizeDate(start) : null;
    const e = end ? this.clampToToday(end) : null;

    const todayMonthStart = startOfMonth(this.today);

    const isCurrentMonth = (d: Date) =>
      d.getFullYear() === this.today.getFullYear() && d.getMonth() === this.todayMonth;

    // When both dates exist, we can decide if the range fits in two visible months.
    const diffMonths =
      s && e ? Math.abs(this.monthIndex(e) - this.monthIndex(s)) : null;

    let top: Date;
    let bottom: Date;

    if (target === 'start' && s) {
      if (isCurrentMonth(s)) {
        // Can't show future months: current month must be on the bottom calendar.
        bottom = todayMonthStart;
        top = startOfMonth(addMonths(bottom, -1));
      } else if (diffMonths !== null && diffMonths <= 1 && e) {
        // Range fits across 1 or 2 consecutive months.
        // IMPORTANT: if BOTH dates are in the SAME month (diffMonths === 0), we still want to
        // show two *consecutive* months (month-of-range on top, next month on bottom).
        // Otherwise the UI shows duplicate months in both calendars.
        top = startOfMonth(s);
        bottom = diffMonths === 0 ? startOfMonth(addMonths(top, 1)) : startOfMonth(e);
      } else {
        top = startOfMonth(s);
        bottom = startOfMonth(addMonths(top, 1));
      }
    } else if (target === 'end' && e) {
      if (isCurrentMonth(e)) {
        bottom = todayMonthStart;
        top = startOfMonth(addMonths(bottom, -1));
      } else if (diffMonths !== null && diffMonths <= 1 && s) {
        // Same rule as above: if the range is within a single month, keep two consecutive months
        // (range month on top + next month) instead of duplicating the same month twice.
        top = startOfMonth(s);
        bottom = diffMonths === 0 ? startOfMonth(addMonths(top, 1)) : startOfMonth(e);
      } else {
        bottom = startOfMonth(e);
        top = startOfMonth(addMonths(bottom, -1));
      }
    } else {
      // Partial range: fall back to keeping the current window.
      return;
    }

    // Safety: never allow bottom to be after 'today'. If it is, clamp to current month.
    const bottomIsFuture =
      bottom.getFullYear() > this.today.getFullYear() ||
      (bottom.getFullYear() === this.today.getFullYear() && bottom.getMonth() > this.todayMonth);
    if (bottomIsFuture) {
      bottom = todayMonthStart;
      top = startOfMonth(addMonths(bottom, -1));
    }

    this.topMonth.set(top);
    this.bottomMonth.set(bottom);
  }

  /** Toggle preset dropdown (disabled while panel is open) */
  toggleMenu() {
    if (this.isOpen()) return;
    this.isMenuOpen.set(!this.isMenuOpen());
  }

  private closeMenu() {
    this.isMenuOpen.set(false);
  }

  /**
   * Apply a preset immediately (closes everything).
   * Resets custom editing state.
   */
  applyPreset(key: QuickKey) {
    const preset = calcPresetRange(key, this.today);
    this.appliedValue.set(preset);
    this.valueChange.emit(preset);
    this.closeMenu();

    this.isOpen.set(false);
    this.showError.set(false);
    this.isEditingCustom.set(false);
    this.draft.set({ start: null, end: null });
  }

  /** Prevent dropdown from closing before click (keeps UX clean on Custom) */
  onCustomMouseDown(ev: MouseEvent) {
    ev.preventDefault();
    ev.stopPropagation();
  }

  /**
   * Opens the custom panel.
   * Rules:
   * - If a preset was applied, open in a "fresh" view (prev + current month) with empty draft.
   * - If a custom range exists, open with that range loaded for editing.
   */
  openCustomFromMenu() {
    this.closeMenu();
    this.isEditingCustom.set(true);

    const presetKey = this.activePresetKey();
    const applied = this.appliedValue();

    if (presetKey) {
      // Coming from a preset: start fresh.
      this.draft.set({ start: null, end: null });
      this.activeField.set('start');
      // IMPORTANT: do not keep showError until user hits Apply/Clear
      this.showError.set(false);

      this.topMonth.set(startOfMonth(addMonths(this.today, -1)));
      this.bottomMonth.set(startOfMonth(this.today));

      this.isOpen.set(true);
      return;
    }

    if (applied.start && applied.end) {
      // Editing an existing custom range.
      this.draft.set({
        start: normalizeDate(applied.start),
        end: normalizeDate(applied.end),
      });

      /**
       * UX rule: when editing an existing custom range, default focus is Start.
       * This makes the initial calendar anchoring predictable and avoids
       * opening the panel centered on End by default.
       */
      this.activeField.set('start');
      this.showError.set(false);

      const start = normalizeDate(applied.start);

      // If Start is in the current month, show (prev month) + (current month).
      // Otherwise show (start month) + (next month).
      const currentMonthStart = startOfMonth(this.today);
      const startMonthStart = startOfMonth(start);

      if (startMonthStart.getTime() === currentMonthStart.getTime()) {
        this.bottomMonth.set(currentMonthStart);
        this.topMonth.set(startOfMonth(addMonths(currentMonthStart, -1)));
      } else {
        this.topMonth.set(startMonthStart);
        this.bottomMonth.set(startOfMonth(addMonths(startMonthStart, 1)));
      }

      this.isOpen.set(true);
      return;
    }

    // No applied range yet: open fresh.
    this.draft.set({ start: null, end: null });
    this.activeField.set('start');
    this.showError.set(false);
    this.topMonth.set(startOfMonth(addMonths(this.today, -1)));
    this.bottomMonth.set(startOfMonth(this.today));
    this.isOpen.set(true);
  }

  /**
   * Focus handling for the two inputs.
   * When editing an existing long range, we jump calendars so the focused date is visible.
   */
  setActive(which: 'start' | 'end') {
    this.setActiveInternal(which, { recenter: true });
  }

  /**
   * Same as setActive(...), but allows callers (e.g., "auto swap" UX)
   * to switch the active field without jumping the calendar view.
   */
  private setActiveInternal(which: 'start' | 'end', opts: { recenter: boolean }) {
    this.activeField.set(which);
    if (opts.recenter) this.recenterCalendarsForActiveField(which);
  }

  /**
   * Apply the draft range:
   * - If incomplete, enable validation messages (per-field).
   * - If complete, emit and close.
   */
  apply() {
    if (!this.canApply()) {
      this.showError.set(true);
      return;
    }

    const d = this.draft();
    const applied = { start: d.start, end: d.end };

    this.appliedValue.set(applied);
    this.valueChange.emit(applied);

    this.isOpen.set(false);
    this.isEditingCustom.set(false);

    this.showError.set(false);
    this.draft.set({ start: null, end: null });
  }

  /**
   * Clear draft and show validation prompts.
   * NOTE: showError stays TRUE until both values are selected again.
   */
  clearDraft() {
    this.draft.set({ start: null, end: null });
    this.showError.set(true);
    this.activeField.set('start');

    this.topMonth.set(startOfMonth(addMonths(this.today, -1)));
    this.bottomMonth.set(startOfMonth(this.today));
  }

  /** Close panel without applying changes */
  private cancel() {
    this.isOpen.set(false);
    this.isEditingCustom.set(false);
    this.showError.set(false);
    this.draft.set({ start: null, end: null });
  }

  /** Keep calendars consecutive: changing top moves bottom; changing bottom moves top */
  private ensureDependentMonths(changed: 'top' | 'bottom') {
    if (changed === 'top') this.bottomMonth.set(startOfMonth(addMonths(this.topMonth(), 1)));
    else this.topMonth.set(startOfMonth(addMonths(this.bottomMonth(), -1)));
  }

  /**
   * Prevent navigating into future months.
   * - Bottom calendar cannot go beyond current month (todayMonth).
   * - Top calendar cannot move if it would push bottom beyond today.
   */
  canGoNext(which: 'top' | 'bottom'): boolean {
    const cur = which === 'top' ? this.topMonth() : this.bottomMonth();
    const next = startOfMonth(addMonths(cur, 1));
    const currentMonthStart = startOfMonth(this.today);

    if (which === 'bottom') return next.getTime() <= currentMonthStart.getTime();

    const nextBottom = startOfMonth(addMonths(next, 1));
    return nextBottom.getTime() <= currentMonthStart.getTime();
  }

  prevMonth(which: 'top' | 'bottom') {
    if (which === 'top') {
      this.topMonth.set(startOfMonth(addMonths(this.topMonth(), -1)));
      this.ensureDependentMonths('top');
    } else {
      this.bottomMonth.set(startOfMonth(addMonths(this.bottomMonth(), -1)));
      this.ensureDependentMonths('bottom');
    }
  }

  nextMonth(which: 'top' | 'bottom') {
    if (!this.canGoNext(which)) return;

    if (which === 'top') {
      this.topMonth.set(startOfMonth(addMonths(this.topMonth(), 1)));
      this.ensureDependentMonths('top');
    } else {
      this.bottomMonth.set(startOfMonth(addMonths(this.bottomMonth(), 1)));
      this.ensureDependentMonths('bottom');
    }
  }

  /**
   * Future-month rule used by:
   * - month dropdown (disable future months)
   * - year dropdown (disable years that would make current month future)
   */
  isFutureMonth(which: 'top' | 'bottom', monthIndex: number, year: number): boolean {
    if (year > this.todayYear) return true;
    if (year < this.todayYear) return false;

    // In same year, top calendar is limited to (todayMonth - 1) to keep bottom <= todayMonth.
    const maxMonth = which === 'bottom' ? this.todayMonth : Math.max(0, this.todayMonth - 1);
    return monthIndex > maxMonth;
  }

  /**
   * Disable year options based on the CURRENT selected month in that calendar.
   * This fixes the issue where selecting a future year "looks selected" but is ignored by logic.
   */
  isYearOptionDisabled(which: 'top' | 'bottom', year: number): boolean {
    const monthIndex = which === 'top' ? this.topMonth().getMonth() : this.bottomMonth().getMonth();
    return this.isFutureMonth(which, monthIndex, Number(year));
  }

  setMonthIndex(which: 'top' | 'bottom', monthIndex: number) {
    const cur = which === 'top' ? this.topMonth() : this.bottomMonth();
    const year = cur.getFullYear();
    const mi = Number(monthIndex);

    if (this.isFutureMonth(which, mi, year)) return;

    const next = startOfMonth(new Date(year, mi, 1));
    if (which === 'top') {
      this.topMonth.set(next);
      this.ensureDependentMonths('top');
    } else {
      this.bottomMonth.set(next);
      this.ensureDependentMonths('bottom');
    }
  }

  /**
   * Year change:
   * We allow selecting the current year, but not a year+month combo that would become future.
   */
  setYearValue(which: 'top' | 'bottom', year: number) {
    const y = Number(year);

    const cur = which === 'top' ? this.topMonth() : this.bottomMonth();
    const m = cur.getMonth();

    if (this.isFutureMonth(which, m, y)) return;

    const next = startOfMonth(new Date(y, m, 1));
    if (which === 'top') {
      this.topMonth.set(next);
      this.ensureDependentMonths('top');
    } else {
      this.bottomMonth.set(next);
      this.ensureDependentMonths('bottom');
    }
  }

  /** Block future days (today is allowed). */
  isCellDisabled(d: Date): boolean {
    return normalizeDate(d).getTime() > this.today.getTime();
  }

  /**
   * Selection logic:
   * IMPORTANT: Do NOT clear showError when only one field is filled.
   * We only clear it once both start AND end exist.
   */
  pickDate(d: Date) {
    if (this.isCellDisabled(d)) return;

    const clicked = normalizeDate(d);
    const cur = this.draft();
    const start = cur.start ? normalizeDate(cur.start) : null;
    const end = cur.end ? normalizeDate(cur.end) : null;
    const active = this.activeField();

    if (!start) {
      this.draft.set({ start: clicked, end: null });
      this.activeField.set('end');
      this.updateValidationAfterDraftChange();
      return;
    }

    if (start && !end) {
      const next =
        clicked.getTime() < start.getTime()
          ? { start: clicked, end: null }
          : { start, end: clicked };
      this.draft.set(next);
      this.updateValidationAfterDraftChange();
      return;
    }

    // Both exist: edit based on active field.
    if (start && end) {
      if (active === 'start') {
        if (clicked.getTime() > end.getTime()) {
          this.draft.set({ start, end: clicked });
          // If user picked a date after the existing End, we treat this as updating End.
          this.activeField.set('end');
        } else {
          this.draft.set({ start: clicked, end });

        }
      } else {
        if (clicked.getTime() < start.getTime()) {
          this.draft.set({ start: clicked, end });
          // If user picked a date before the existing Start, we treat this as updating Start.
          this.activeField.set('start');
        } else {
          this.draft.set({ start, end: clicked });

        }
      }
      this.updateValidationAfterDraftChange();
    }
  }

  /**
   * Validation rule:
   * - If showError is true, keep it true until BOTH start and end are selected.
   * This makes each field message independent.
   */
  private updateValidationAfterDraftChange() {
    if (!this.showError()) return;
    const d = this.draft();
    if (d.start && d.end) this.showError.set(false);
  }

  inRange(d: Date): boolean {
    const s = this.draft().start ? normalizeDate(this.draft().start!) : null;
    const e = this.draft().end ? normalizeDate(this.draft().end!) : null;
    if (!s || !e) return false;
    const n = normalizeDate(d).getTime();
    return n >= s.getTime() && n <= e.getTime();
  }

  isStart(d: Date): boolean {
    const s = this.draft().start;
    return !!(s && isSameDay(normalizeDate(d), normalizeDate(s)));
  }

  isEnd(d: Date): boolean {
    const e = this.draft().end;
    return !!(e && isSameDay(normalizeDate(d), normalizeDate(e)));
  }

  label(d: Date): string {
    return monthLabel(d);
  }

  /**
   * Outside click closes:
   * - preset menu
   * - custom panel (cancel edits)
   */
  @HostListener('document:mousedown', ['$event'])
  onDocMouseDown(ev: MouseEvent) {
    const el = this.host.nativeElement;
    if (ev.target instanceof Node && !el.contains(ev.target)) {
      if (this.isMenuOpen()) this.isMenuOpen.set(false);
      if (this.isOpen()) this.cancel();
    }
  }
}
