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
  addDays,
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

  private today = normalizeDate(new Date());
  todayYear = this.today.getFullYear();
  private todayMonth = this.today.getMonth();

  appliedValue = signal<DateRange>({ start: null, end: null });

  isMenuOpen = signal(false);

  activePresetKey = computed<QuickKey | null>(() => {
    const v = this.appliedValue();
    if (!v.start || !v.end) return null;
    return this.detectPreset(v);
  });

  triggerLabel = computed(() => {
    if (this.isEditingCustom()) return 'Custom';

    const v = this.appliedValue();
    const presetKey = this.activePresetKey();

    if (presetKey) {
      return PRESETS.find(p => p.key === presetKey)?.label ?? 'Date range';
    }

    if (v.start && v.end) {
      return `${formatMMDDYYYY(v.start)} - ${formatMMDDYYYY(v.end)}`;
    }

    return 'Date range';
  });

  isOpen = signal(false);
  showError = signal(false);
  activeField = signal<'start' | 'end'>('start');
  draft = signal<DateRange>({ start: null, end: null });

  isEditingCustom = signal(false);

  topMonth = signal<Date>(startOfMonth(addMonths(this.today, -1)));
  bottomMonth = signal<Date>(startOfMonth(this.today));

  topGrid = computed(() => buildMonthGrid(this.topMonth()));
  bottomGrid = computed(() => buildMonthGrid(this.bottomMonth()));

  topMonthIndex = computed(() => this.topMonth().getMonth());
  bottomMonthIndex = computed(() => this.bottomMonth().getMonth());
  topYearValue = computed(() => this.topMonth().getFullYear());
  bottomYearValue = computed(() => this.bottomMonth().getFullYear());

  topYearsLimited = computed(() =>
    yearOptions(this.topMonth().getFullYear(), 6).filter((y) => y <= this.todayYear),
  );
  bottomYearsLimited = computed(() =>
    yearOptions(this.bottomMonth().getFullYear(), 6).filter((y) => y <= this.todayYear),
  );

  dow = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  months = Array.from({ length: 12 }, (_, i) => monthName(i));

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

  canApply = computed(() => !!(this.draft().start && this.draft().end));

  constructor(private host: ElementRef<HTMLElement>) {}

  ngOnInit() {
    // If the host app provides an initial value, respect it.
    // Otherwise, initialize with the default preset and emit it.
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
        ) return p.key;
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
   * Si el rango actual (draft) NO cabe en dos meses consecutivos,
   * reubica los dos calendarios dependiendo de qué campo se está editando:
   * - start: start month arriba, siguiente abajo
   * - end: end month abajo, anterior arriba
   */
  private jumpCalendarsIfNeeded(target: 'start' | 'end') {
    if (!this.isOpen()) return; // solo si panel está abierto
  
    const { start, end } = this.draft();
    if (!start || !end) return; // solo si hay info previa completa
  
    const s = normalizeDate(start);
    const e = this.clampToToday(end);
  
    const diffMonths = this.monthIndex(e) - this.monthIndex(s);
  
    // "No caben en 2 meses consecutivos" => separados por 2+ meses
    if (diffMonths < 2) return;
  
    if (target === 'start') {
      const top = startOfMonth(s);
      this.topMonth.set(top);
      this.bottomMonth.set(startOfMonth(addMonths(top, 1)));
    } else {
      const bottom = startOfMonth(e);
      this.bottomMonth.set(bottom);
      this.topMonth.set(startOfMonth(addMonths(bottom, -1)));
    }
  }
  

  toggleMenu() {
    if (this.isOpen()) return;
    this.isMenuOpen.set(!this.isMenuOpen());
  }

  private closeMenu() {
    this.isMenuOpen.set(false);
  }

  applyPreset(key: QuickKey) {
    const preset = calcPresetRange(key, this.today);
    this.appliedValue.set(preset);
    this.valueChange.emit(preset);
    this.closeMenu();

    this.isOpen.set(false);
    this.showError.set(false);
    this.draft.set({ start: null, end: null });
  }

  onCustomMouseDown(ev: MouseEvent) {
    ev.preventDefault();
    ev.stopPropagation();
  }

  openCustomFromMenu() {
    this.closeMenu();
    this.isEditingCustom.set(true);

    const presetKey = this.activePresetKey();
    const applied = this.appliedValue();

    if (presetKey) {
      this.draft.set({ start: null, end: null });
      this.activeField.set('start');
      this.showError.set(false);

      this.topMonth.set(startOfMonth(addMonths(this.today, -1)));
      this.bottomMonth.set(startOfMonth(this.today));

      this.isOpen.set(true);
      return;
    }

    if (applied.start && applied.end) {
      this.draft.set({
        start: normalizeDate(applied.start),
        end: normalizeDate(applied.end),
      });

      this.activeField.set('end');
      this.showError.set(false);

      const anchor = normalizeDate(applied.end);
      const clamped = anchor.getTime() > this.today.getTime() ? this.today : anchor;
      this.bottomMonth.set(startOfMonth(clamped));
      this.topMonth.set(startOfMonth(addMonths(this.bottomMonth(), -1)));

      this.isOpen.set(true);
      return;
    }

    this.draft.set({ start: null, end: null });
    this.activeField.set('start');
    this.showError.set(false);
    this.topMonth.set(startOfMonth(addMonths(this.today, -1)));
    this.bottomMonth.set(startOfMonth(this.today));
    this.isOpen.set(true);
  }

  setActive(which: 'start' | 'end') {
    this.activeField.set(which);
  
    // Solo cuando estás editando un rango previo (custom ya abierto y draft completo)
    // y ese rango no cabe en 2 meses consecutivos.
    this.jumpCalendarsIfNeeded(which);
  }
  

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

  clearDraft() {
    this.draft.set({ start: null, end: null });
    this.showError.set(true);
    this.activeField.set('start');

    this.topMonth.set(startOfMonth(addMonths(this.today, -1)));
    this.bottomMonth.set(startOfMonth(this.today));
  }

  private cancel() {
    this.isOpen.set(false);
    this.isEditingCustom.set(false);
    this.showError.set(false);
    this.draft.set({ start: null, end: null });
  }

  private ensureDependentMonths(changed: 'top' | 'bottom') {
    if (changed === 'top') this.bottomMonth.set(startOfMonth(addMonths(this.topMonth(), 1)));
    else this.topMonth.set(startOfMonth(addMonths(this.bottomMonth(), -1)));
  }

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

  isFutureMonth(which: 'top' | 'bottom', monthIndex: number, year: number): boolean {
    if (year > this.todayYear) return true;
    if (year < this.todayYear) return false;

    const maxMonth = which === 'bottom' ? this.todayMonth : Math.max(0, this.todayMonth - 1);
    return monthIndex > maxMonth;
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

  setYearValue(which: 'top' | 'bottom', year: number) {
    const y = Number(year);
    if (y > this.todayYear) return;

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

  isCellDisabled(d: Date): boolean {
    return normalizeDate(d).getTime() > this.today.getTime();
  }

  pickDate(d: Date) {
    if (this.isCellDisabled(d)) return;

    const clicked = normalizeDate(d);
    const cur = this.draft();
    const start = cur.start ? normalizeDate(cur.start) : null;
    const end = cur.end ? normalizeDate(cur.end) : null;

    if (!start) {
      this.draft.set({ start: clicked, end: null });
      this.activeField.set('end');
      this.showError.set(false);
      return;
    }

    if (start && !end) {
      const next =
        clicked.getTime() < start.getTime()
          ? { start: clicked, end: null }
          : { start, end: clicked };
      this.draft.set(next);
      this.showError.set(false);
      return;
    }

    if (start && end) {
      if (this.activeField() === 'start') {
        if (clicked.getTime() > end.getTime()) {
          this.draft.set({ start, end: clicked });
          this.activeField.set('end');
        } else {
          this.draft.set({ start: clicked, end });
        }
      } else {
        if (clicked.getTime() < start.getTime()) {
          this.draft.set({ start: clicked, end });
          this.activeField.set('start');
        } else {
          this.draft.set({ start, end: clicked });
        }
      }
      this.showError.set(false);
    }
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

  @HostListener('document:mousedown', ['$event'])
  onDocMouseDown(ev: MouseEvent) {
    const el = this.host.nativeElement;
    if (ev.target instanceof Node && !el.contains(ev.target)) {
      if (this.isMenuOpen()) this.isMenuOpen.set(false);
      if (this.isOpen()) this.cancel();
    }
  }
}
