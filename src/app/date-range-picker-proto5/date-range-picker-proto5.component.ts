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
  buildMonthGrid,  isSameDay,
  normalizeDate,
  startOfMonth,
  yearOptions,
} from '../date-range/date-utils';
import { PRESETS, calcPresetRange, DEFAULT_PRESET } from '../date-range/presets';
import { ActiveField, ActivePreset, DateRange, QuickKey } from '../date-range/date-range.types';


// Local helpers (date-utils.ts in this repo does not export these)
function isBefore(a: Date, b: Date): boolean {
  return normalizeDate(a).getTime() < normalizeDate(b).getTime();
}

function isAfter(a: Date, b: Date): boolean {
  return normalizeDate(a).getTime() > normalizeDate(b).getTime();
}

function clampToToday(d: Date, today: Date): Date {
  return isAfter(d, today) ? today : d;
}

type CalId = 'top' | 'bottom';

/**
 * Prototype 5
 * - Premium: first shows a presets menu (like Prototype 3). Custom opens the full panel (like Prototype 4).
 * - Standard: no presets menu and no left preset pane; opens custom panel directly.
 * - Apply-only for custom edits; click-outside/cancel discards draft.
 */
@Component({
  selector: 'app-date-range-picker-proto5',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './date-range-picker-proto5.component.html',
  styleUrls: ['./date-range-picker-proto5.component.css'],
})
export class DateRangePickerProto5Component {
  constructor(private host: ElementRef<HTMLElement>) {}

  /** Controlled value (applied range). */
  @Input({ required: true }) value!: DateRange;
  @Output() valueChange = new EventEmitter<DateRange>();

  /** Premium vs Standard switch. */
  @Input() isPremium = true;

  /** Premium-only: initial preset applied once when value is empty. */
  @Input() initialPreset: QuickKey | null | undefined = DEFAULT_PRESET;

  /**
   * If true and the current applied value is a custom range, clicking the trigger opens the custom panel directly.
   * If false, premium users always see the presets menu first.
   */
  @Input() openCustomDirectlyWhenAppliedCustom = true;

  /** --- Constants / helpers --- */
  readonly presets = PRESETS;
  readonly months = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December',
  ];
  readonly dow = ['Su','Mo','Tu','We','Th','Fr','Sa'];

  readonly today = normalizeDate(new Date());
  readonly todayYear = this.today.getFullYear();

  /** --- UI state (menu vs panel) --- */
  readonly isMenuOpen = signal(false);  // Premium only
  readonly isOpen = signal(false);      // Custom panel open

  /** --- Applied vs draft --- */
  private readonly appliedValue = signal<DateRange>({ start: null, end: null });
  readonly draft = signal<DateRange>({ start: null, end: null });

  /** Track which preset is currently applied (only for premium quick presets). */
  readonly appliedPresetKey = signal<QuickKey | null>(null);

  /** Track which preset is selected in the left pane while editing. */
  readonly activePresetKey = signal<ActivePreset>(null);

  /** Field focus inside custom panel. */
  readonly activeField = signal<ActiveField>('start');

  /** Validation UI for custom panel. */
  readonly showError = signal(false);

  /** Calendars (two consecutive months). */
  readonly topMonth = signal<Date>(startOfMonth(this.today));
  readonly bottomMonth = signal<Date>(startOfMonth(addMonths(this.today, 1)));

  readonly topYearValue = computed(() => this.topMonth().getFullYear());
  readonly bottomYearValue = computed(() => this.bottomMonth().getFullYear());
  readonly topMonthIndex = computed(() => this.topMonth().getMonth());
  readonly bottomMonthIndex = computed(() => this.bottomMonth().getMonth());

  readonly topGrid = computed(() => buildMonthGrid(this.topMonth()));
  readonly bottomGrid = computed(() => buildMonthGrid(this.bottomMonth()));

  /** Year options are limited (<= current year). */
  topYearsLimited = computed(() =>
    yearOptions(this.topMonth().getFullYear(), 6).filter((y) => y <= this.todayYear)
  );
  bottomYearsLimited = computed(() =>
    yearOptions(this.bottomMonth().getFullYear(), 6).filter((y) => y <= this.todayYear)
  );

  /** --- Labels --- */

  /** Trigger label:
   * - If custom panel open => "Custom"
   * - Else if premium preset applied => preset label
   * - Else if applied range => formatted range
   * - Else => empty (placeholder shown)
   */
  triggerLabel = computed(() => {
    if (this.isOpen()) return 'Custom';

    const presetKey = this.appliedPresetKey();
    if (this.isPremium && presetKey) {
      const p = this.presets.find((x) => x.key === presetKey);
      return p?.label ?? '';
    }

    const r = this.appliedValue();
    if (r.start && r.end) return this.formatRange(r);
    return '';
  });

  placeholderText = computed(() => (this.isPremium ? 'Select range' : 'Select range'));

  /** Helper message shown under trigger (optional). */
  dateRangeMessage = computed(() => {
    const r = this.appliedValue();
    if (!r.start || !r.end) return '';
    return `Current selection: ${this.formatRange(r)}`;
  });

  /** --- Init --- */
  ngOnInit() {
    // Sync internal applied state from the controlled input.
    this.appliedValue.set(this.value ?? { start: null, end: null });

    // Apply premium default preset once if empty.
    const isEmpty = !this.value?.start && !this.value?.end;
    if (this.isPremium && this.initialPreset && isEmpty) {
      const r = calcPresetRange(this.initialPreset, this.today);
      this.commitApplied(r, this.initialPreset);
    } else {
      this.appliedPresetKey.set(this.detectAppliedPresetKey(this.appliedValue()));
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

  /** --- Trigger / menu / open logic --- */

  onTriggerClick() {
    // Standard users: open custom panel directly.
    if (!this.isPremium) {
      if (this.isOpen()) {
        this.cancel(); // close + restore applied
      } else {
        this.openCustomPanel({ fromMenu: false, forceClear: !this.appliedValue().start || !this.appliedValue().end });
      }
      return;
    }

    // Premium:
    // If panel open => close it.
    if (this.isOpen()) {
      this.cancel();
      return;
    }

    // If menu open => close it.
    if (this.isMenuOpen()) {
      this.closeMenu();
      return;
    }

    // If applied is custom and flag says open custom directly => open panel preloaded.
    if (this.openCustomDirectlyWhenAppliedCustom && this.isAppliedCustom()) {
      this.openCustomPanel({ fromMenu: false, forceClear: false });
      return;
    }

    // Otherwise open menu.
    this.isMenuOpen.set(true);
  }

  closeMenu() {
    this.isMenuOpen.set(false);
  }

  /** Called when user clicks "Custom" from the premium presets menu. */
  openCustomFromMenu() {
    // Close menu first.
    this.isMenuOpen.set(false);

    // If the applied selection came from a preset, open in clear-silent mode.
    const forceClear = this.appliedPresetKey() !== null || !this.appliedValue().start || !this.appliedValue().end;
    this.openCustomPanel({ fromMenu: true, forceClear });
  }

  /** Apply a preset immediately from the premium presets menu (no calendar). */
  applyPresetFromMenu(key: QuickKey) {
    const r = calcPresetRange(key, this.today);
    this.commitApplied(r, key);
    this.isMenuOpen.set(false);
    this.isOpen.set(false);
  }

  /** Opens the custom panel for editing. */
  private openCustomPanel(opts: { fromMenu: boolean; forceClear: boolean }) {
    // Start in "editing start" mode by default.
    this.activeField.set('start');
    this.showError.set(false);

    if (opts.forceClear) {
      // Clear-silent state: no dates and no validation messages.
      this.draft.set({ start: null, end: null });
      this.activePresetKey.set(null);
      this.openFreshCalendars();
    } else {
      // Preload applied into draft.
      const applied = this.appliedValue();
      this.draft.set({ ...applied });
      this.activePresetKey.set(this.detectPreset(applied));
      const s = this.draft().start;
      if (s) this.positionCalendarsAtStart(s);
      else this.openFreshCalendars();
    }

    this.isOpen.set(true);
  }

  /** Cancel: discard draft changes, close panel, restore to applied. */
  cancel() {
    // Discard draft changes and restore applied state.
    this.draft.set({ ...this.appliedValue() });
    this.showError.set(false);
    this.isOpen.set(false);
    this.isMenuOpen.set(false);

    // Reposition calendars back to applied (or fresh).
    const a = this.appliedValue();
    const s = a.start;
    if (s) this.positionCalendarsAtStart(s);
    else this.openFreshCalendars();

    // Refresh preset selection highlight.
    this.activePresetKey.set(this.detectPreset(this.appliedValue()));
  }

  /** --- Outside click behavior --- */
  @HostListener('document:mousedown', ['$event'])
  onDocumentMouseDown(ev: MouseEvent) {
    const target = ev.target as Node | null;
    if (!target) return;

    // If click is inside this component, do nothing.
    if (this.host.nativeElement.contains(target)) return;

    // If menu open: close it (no state change).
    if (this.isMenuOpen()) this.isMenuOpen.set(false);

    // If panel open: cancel (discard draft).
    if (this.isOpen()) this.cancel();
  }

  /** --- Commit / detect presets --- */

  private commitApplied(r: DateRange, presetKey: QuickKey | null) {
    // Persist applied.
    this.appliedValue.set({ ...r });
    this.valueChange.emit({ ...r });

    // Track applied preset key (only for premium quick picks).
    this.appliedPresetKey.set(this.isPremium ? presetKey : null);

    // Sync draft too.
    this.draft.set({ ...r });

    // Update active preset highlight inside panel.
    this.activePresetKey.set(this.detectPreset(r));

    // Position calendars to start.
    if (r.start) this.positionCalendarsAtStart(r.start);
  }

  /** Returns which preset matches an applied range (or 'custom'/null). */
  private detectPreset(r: DateRange): ActivePreset {
    if (!r.start || !r.end) return null;

    // Try all presets: if range matches exactly, return that key.
    for (const p of this.presets) {
      const pr = calcPresetRange(p.key, this.today);
      if (pr.start && pr.end && isSameDay(pr.start, r.start) && isSameDay(pr.end, r.end)) {
        return p.key;
      }
    }
    return 'custom';
  }

  /** Similar to detectPreset but returns only QuickKey when it matches; otherwise null. */
  private detectAppliedPresetKey(r: DateRange): QuickKey | null {
    const p = this.detectPreset(r);
    return p && p !== 'custom' ? p : null;
  }

  private isAppliedCustom(): boolean {
    const r = this.appliedValue();
    return !!(r.start && r.end) && this.appliedPresetKey() === null;
  }

  /** --- Panel actions --- */

  clearDraft() {
    this.draft.set({ start: null, end: null });
    this.activePresetKey.set(null);
    this.activeField.set('start');
    this.showError.set(true); // explicit clear shows validation
    this.openFreshCalendars();
  }

  canApply = computed(() => !!this.draft().start && !!this.draft().end);

  apply() {
    if (!this.canApply()) {
      this.showError.set(true);
      return;
    }
    const r = this.draft();
    this.commitApplied(r, null); // custom apply => no preset key
    this.isOpen.set(false);
    this.isMenuOpen.set(false);
    this.showError.set(false);
  }

  /** Select preset in left pane (custom panel). Does NOT apply until Apply dates. */
  selectPreset(key: QuickKey) {
    const r = calcPresetRange(key, this.today);
    this.draft.set({ ...r });
    this.activePresetKey.set(key);
    this.showError.set(false);
    this.activeField.set('start');
    if (r.start) this.positionCalendarsAtStart(r.start);
  }

  setActive(field: ActiveField) {
    this.activeField.set(field);
    // Recenter calendars to the active field's month (Prototype 3 behavior).
    this.recenterCalendarsForActiveField(field);
  }

  /** --- Calendar navigation rules (same as Proto 3/4) --- */

  prevMonth(which: CalId) {
    const cur = which === 'top' ? this.topMonth() : this.bottomMonth();
    const next = addMonths(cur, -1);
    if (which === 'top') {
      this.topMonth.set(next);
      // Keep consecutive:
      this.bottomMonth.set(addMonths(next, 1));
    } else {
      this.bottomMonth.set(next);
      this.topMonth.set(addMonths(next, -1));
    }
  }

  nextMonth(which: CalId) {
    if (!this.canGoNext(which)) return;

    const cur = which === 'top' ? this.topMonth() : this.bottomMonth();
    const next = addMonths(cur, 1);

    if (which === 'top') {
      this.topMonth.set(next);
      this.bottomMonth.set(addMonths(next, 1));
    } else {
      this.bottomMonth.set(next);
      this.topMonth.set(addMonths(next, -1));
    }
  }

  canGoNext(which: CalId) {
    const cur = which === 'top' ? this.topMonth() : this.bottomMonth();
    const next = startOfMonth(addMonths(cur, 1));
    return !isAfter(next, startOfMonth(this.today));
  }

  setMonthIndex(which: CalId, idx: number) {
    const cur = which === 'top' ? this.topMonth() : this.bottomMonth();
    const next = new Date(cur.getFullYear(), idx, 1);

    if (this.isFutureMonth(which, idx, next.getFullYear())) return;

    if (which === 'top') {
      this.topMonth.set(next);
      this.bottomMonth.set(addMonths(next, 1));
    } else {
      this.bottomMonth.set(next);
      this.topMonth.set(addMonths(next, -1));
    }
  }

  setYearValue(which: CalId, year: number) {
    const cur = which === 'top' ? this.topMonth() : this.bottomMonth();
    const next = new Date(year, cur.getMonth(), 1);

    // Prevent selecting a year that would put the month in the future.
    if (this.isYearOptionDisabled(which, year)) return;

    if (which === 'top') {
      this.topMonth.set(next);
      this.bottomMonth.set(addMonths(next, 1));
    } else {
      this.bottomMonth.set(next);
      this.topMonth.set(addMonths(next, -1));
    }
  }

  isYearOptionDisabled(which: CalId, year: number) {
    const cur = which === 'top' ? this.topMonth() : this.bottomMonth();
    const candidate = new Date(year, cur.getMonth(), 1);
    return isAfter(candidate, startOfMonth(this.today));
  }

  isFutureMonth(which: CalId, monthIndex: number, year: number) {
    const candidate = new Date(year, monthIndex, 1);
    return isAfter(candidate, startOfMonth(this.today));
  }

  /** Build a readable month label. */
  label(d: Date) {
    return `${this.months[d.getMonth()]} ${d.getFullYear()}`;
  }

  /** --- Date picking rules --- */

  pickDate(d: Date) {
    if (this.isCellDisabled(d)) return;

    const { start, end } = this.draft();

    // If no start yet, set start.
    if (!start) {
      this.draft.set({ start: d, end: null });
      this.activeField.set('end');
      this.activePresetKey.set('custom');
      this.showError.set(true); // because end is still missing
      return;
    }

    // If start exists but end missing, set end.
    if (!end) {
      // If picked before start, flip.
      if (isBefore(d, start)) {
        this.draft.set({ start: d, end: start });
      } else {
        this.draft.set({ start, end: d });
      }
      this.activePresetKey.set(this.detectPreset(this.draft()));
      this.showError.set(false);
      return;
    }

    // Both exist: edit based on active field.
    if (this.activeField() === 'start') {
      // If new start is after end => extend end (move focus)
      if (isAfter(d, end)) {
        this.draft.set({ start: start, end: d });
        this.activeField.set('end');
      } else {
        this.draft.set({ start: d, end });
      }
    } else {
      // editing end
      if (isBefore(d, start)) {
        this.draft.set({ start: d, end: end });
        this.activeField.set('start');
      } else {
        this.draft.set({ start, end: d });
      }
    }

    this.activePresetKey.set(this.detectPreset(this.draft()));
  }

  isCellDisabled(d: Date) {
    // No future dates.
    return isAfter(d, this.today);
  }

  inRange(d: Date) {
    const { start, end } = this.draft();
    if (!start || !end) return false;
    return !isBefore(d, start) && !isAfter(d, end);
  }

  isStart(d: Date) {
    const s = this.draft().start;
    return !!s && isSameDay(s, d);
  }

  isEnd(d: Date) {
    const e = this.draft().end;
    return !!e && isSameDay(e, d);
  }

  /** --- Calendar positioning helpers --- */

  private openFreshCalendars() {
    // Same as Prototype 3/4: left calendar = previous month, right = current month.
    const current = startOfMonth(this.today);
    this.bottomMonth.set(current);
    this.topMonth.set(addMonths(current, -1));
  }

  private positionCalendarsAtStart(d: Date) {
    const startM = startOfMonth(clampToToday(d, this.today));
    this.topMonth.set(startM);
    this.bottomMonth.set(addMonths(startM, 1));
  }

  private positionCalendarsAtEnd(d: Date) {
    const endM = startOfMonth(clampToToday(d, this.today));
    this.bottomMonth.set(endM);
    this.topMonth.set(addMonths(endM, -1));
  }

  private recenterCalendarsForActiveField(field: ActiveField) {
    const r = this.draft();
    if (field === 'start' && r.start) this.positionCalendarsAtStart(r.start);
    if (field === 'end' && r.end) this.positionCalendarsAtEnd(r.end);
  }

  /** --- Formatting --- */
  private formatRange(r: DateRange) {
    const s = r.start ? this.formatDate(r.start) : '';
    const e = r.end ? this.formatDate(r.end) : '';
    return `${s} - ${e}`;
  }

  private formatDate(d: Date) {
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${mm}/${dd}/${yyyy}`;
  }
}
