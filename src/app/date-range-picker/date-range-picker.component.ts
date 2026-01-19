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
import { DateRange, ActiveField, ActivePreset, QuickKey } from '../date-range/date-range.types';import { PRESETS, calcPresetRange, DEFAULT_PRESET } from '../date-range/presets';

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
  template: `
    <div class="drp3">
      <div class="field">
        <div class="fieldLabel">Date range</div>

        <div class="selectWrap" [class.invalid]="dateRangeInvalid()">
          <button
            type="button"
            class="selectTrigger"
            (click)="toggleMenu()"
            [attr.aria-expanded]="isMenuOpen()"
          >
            <span class="triggerText">{{ triggerLabel() }}</span>
            <span class="caret" aria-hidden="true">▾</span>
          </button>

          <div class="menu" *ngIf="isMenuOpen()">
            <button
              type="button"
              class="menuItem"
              (mousedown)="onCustomMouseDown($event)"
              (click)="openCustomFromMenu()"
            >
              Custom
            </button>

            <button
              *ngFor="let p of presets"
              type="button"
              class="menuItem"
              [class.selected]="activePresetKey() === p.key"
              (click)="applyPreset(p.key)"
            >
              {{ p.label }}
            </button>
          </div>
        </div>

        <div class="fieldError" *ngIf="dateRangeMessage()">
          {{ dateRangeMessage() }}
        </div>
      </div>

      <div class="panel" *ngIf="isOpen()">
        <div class="panelTop">
          <div class="inputs">
            <div class="field">
              <div class="fieldLabel">Start date</div>
              <input
                readonly
                [class.active]="activeField() === 'start'"
                [class.invalid]="showError() && !draft().start"
                [value]="draft().start ? (draft().start | date:'MM/dd/yyyy') : ''"
                placeholder="MM/DD/YYYY"
                (click)="setActive('start')"
              />
              <div class="fieldError" *ngIf="showError() && !draft().start">
                Please select a start date.
              </div>
            </div>

            <div class="field">
              <div class="fieldLabel">End date</div>
              <input
                readonly
                [class.active]="activeField() === 'end'"
                [class.invalid]="showError() && !draft().end"
                [value]="draft().end ? (draft().end | date:'MM/dd/yyyy') : ''"
                placeholder="MM/DD/YYYY"
                (click)="setActive('end')"
              />
              <div class="fieldError" *ngIf="showError() && !draft().end">
                Please select an end date.
              </div>
            </div>
          </div>

          <div class="generalError" *ngIf="showError() && (!draft().start || !draft().end)">
            <ng-container *ngIf="!draft().start && !draft().end">
              Please select a start and end date.
            </ng-container>
          </div>
        </div>

        <div class="calStack">
          <div class="cal">
            <div class="calHeader">
              <button class="iconBtn" type="button" (click)="prevMonth('top')" aria-label="Previous month">←</button>

              <div class="headerCenter">
                <select class="select" [ngModel]="topMonthIndex()" (ngModelChange)="setMonthIndex('top', $event)">
                  <option
                    *ngFor="let m of months; let i=index"
                    [ngValue]="i"
                    [disabled]="isFutureMonth('top', i, topYearValue())"
                  >
                    {{ m }}
                  </option>
                </select>

                <select class="select" [ngModel]="topYearValue()" (ngModelChange)="setYearValue('top', $event)">
                  <option *ngFor="let y of topYearsLimited()" [ngValue]="y" [disabled]="y > todayYear">
                    {{ y }}
                  </option>
                </select>
              </div>

              <button
                class="iconBtn"
                type="button"
                (click)="nextMonth('top')"
                [disabled]="!canGoNext('top')"
                aria-label="Next month"
              >→</button>
            </div>

            <div class="calMonthLabel">{{ label(topMonth()) }}</div>

            <div class="dow">
              <div class="dowCell" *ngFor="let d of dow">{{ d }}</div>
            </div>

            <div class="grid">
              <ng-container *ngFor="let cell of topGrid()">
                <div *ngIf="cell === null" class="cell empty"></div>
                <button
                  *ngIf="cell !== null"
                  type="button"
                  class="cell"
                  [class.inRange]="inRange(cell)"
                  [class.start]="isStart(cell)"
                  [class.end]="isEnd(cell)"
                  [class.disabledCell]="isCellDisabled(cell)"
                  [disabled]="isCellDisabled(cell)"
                  (click)="pickDate(cell)"
                >
                  {{ cell.getDate() }}
                </button>
              </ng-container>
            </div>
          </div>

          <div class="cal">
            <div class="calHeader">
              <button class="iconBtn" type="button" (click)="prevMonth('bottom')" aria-label="Previous month">←</button>

              <div class="headerCenter">
                <select class="select" [ngModel]="bottomMonthIndex()" (ngModelChange)="setMonthIndex('bottom', $event)">
                  <option
                    *ngFor="let m of months; let i=index"
                    [ngValue]="i"
                    [disabled]="isFutureMonth('bottom', i, bottomYearValue())"
                  >
                    {{ m }}
                  </option>
                </select>

                <select class="select" [ngModel]="bottomYearValue()" (ngModelChange)="setYearValue('bottom', $event)">
                  <option *ngFor="let y of bottomYearsLimited()" [ngValue]="y" [disabled]="y > todayYear">
                    {{ y }}
                  </option>
                </select>
              </div>

              <button
                class="iconBtn"
                type="button"
                (click)="nextMonth('bottom')"
                [disabled]="!canGoNext('bottom')"
                aria-label="Next month"
              >→</button>
            </div>

            <div class="calMonthLabel">{{ label(bottomMonth()) }}</div>

            <div class="dow">
              <div class="dowCell" *ngFor="let d of dow">{{ d }}</div>
            </div>

            <div class="grid">
              <ng-container *ngFor="let cell of bottomGrid()">
                <div *ngIf="cell === null" class="cell empty"></div>
                <button
                  *ngIf="cell !== null"
                  type="button"
                  class="cell"
                  [class.inRange]="inRange(cell)"
                  [class.start]="isStart(cell)"
                  [class.end]="isEnd(cell)"
                  [class.disabledCell]="isCellDisabled(cell)"
                  [disabled]="isCellDisabled(cell)"
                  (click)="pickDate(cell)"
                >
                  {{ cell.getDate() }}
                </button>
              </ng-container>
            </div>
          </div>
        </div>

        <div class="footer">
          <button class="btn ghost" type="button" (click)="clearDraft()">Clear dates</button>

          <button
            class="btn"
            type="button"
            (click)="apply()"
            [disabled]="!canApply()"
            [class.disabledBtn]="!canApply()"
          >
            Apply dates
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .drp3 { position: relative; }

    .field { display:flex; flex-direction:column; gap:6px; }
    .fieldLabel { font-size:12px; color:#6b7280; }

    .selectWrap{
      position:relative;
      max-width: 520px;
    }

    .selectTrigger{
      height:36px; width:100%;
      border:1px solid #d1d5db; border-radius:10px;
      padding:0 10px;
      background:#fff;
      cursor:pointer;
      outline:none;
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap: 8px;
      text-align:left;
    }
    .triggerText{ overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .caret{ opacity:.7; }

    .selectWrap.invalid .selectTrigger{
      border-color:#ef4444;
      box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.12);
    }

    .menu{
      position:absolute;
      z-index:30;
      top:42px;
      left:0;
      width:100%;
      border:1px solid #e5e7eb;
      border-radius:12px;
      background:#fff;
      box-shadow:0 18px 45px rgba(0,0,0,.12);
      padding:6px;
      display:flex;
      flex-direction:column;
      gap:4px;
    }
    .menuItem{
      height:34px;
      border-radius:10px;
      border:1px solid transparent;
      background:transparent;
      cursor:pointer;
      text-align:left;
      padding:0 10px;
    }
    .menuItem:hover{ background:#f3f4f6; }
    .menuItem.selected{ background:#e5e7eb; }

    input{
      height:36px;
      border:1px solid #d1d5db;
      border-radius:10px;
      padding:0 10px;
      cursor:pointer;
      background:#fff;
      outline:none;
    }
    input.active{
      border-color:#2563eb;
      box-shadow:0 0 0 3px rgba(37, 99, 235, 0.14);
    }
    input.invalid{
      border-color:#ef4444;
      box-shadow:0 0 0 3px rgba(239, 68, 68, 0.12);
    }

    .fieldError { font-size:12px; color:#b91c1c; }
    .generalError { margin-top:6px; font-size:12px; color:#b91c1c; }

    /* ✅ COMPACT PANEL (Laptop) */
    .panel{
      position:absolute; z-index:20; top:64px; left:0;
      width:min(720px, 100%);
      border:1px solid #e5e7eb; border-radius:14px;
      background:#fff;
      overflow:hidden;
      box-shadow:0 18px 45px rgba(0,0,0,.12);
      padding: 10px;
      display:flex;
      flex-direction:column;
      gap: 10px;
    }

    .panelTop { display:flex; flex-direction:column; gap: 6px; }
    .inputs { display:flex; gap:10px; flex-wrap: wrap;  }
    .inputs > .field{
        flex: 1 1 120px;      /* ✅ cada campo intenta ocupar media fila; min 260px */
        min-width: 100px;     /* ✅ ajusta si quieres */
      }
    
    /* Desktop / laptop: horizontal */
    .calStack{
      display:grid;
      grid-template-columns: 1fr 1fr;
      gap:12px;
    }
    
    /* Tablet y abajo: vertical */
    @media (max-width: 900px){
      .calStack{
        grid-template-columns: 1fr;
      }
    }
    
    /* Celular y abajo: sigue vertical (refuerzo) */
    @media (max-width: 720px){
      .calStack{
        grid-template-columns: 1fr;
      }
    }
    
    .cal {
      border:1px solid #e5e7eb;
      border-radius:12px;
      padding:8px;
    }

    .calHeader { display:grid; grid-template-columns:32px 1fr 32px; align-items:center; gap:6px; }
    .headerCenter { display:flex; gap:8px; justify-content:center; align-items:center; flex-wrap:nowrap; }
    .select { height:30px; border:1px solid #d1d5db; border-radius:10px; padding:0 8px; background:#fff; font-size:12px; }
    .iconBtn { height:30px; width:30px; border:1px solid #d1d5db; border-radius:10px; background:#fff; cursor:pointer; }
    .iconBtn[disabled]{ opacity:.5; cursor:not-allowed; }

    .calMonthLabel { margin-top:8px; font-size:12px; color:#6b7280; }

    /* ✅ fixed columns so days don't stretch wide */
    .dow, .grid {
      display:grid;
      grid-template-columns:repeat(7, 38px);
      justify-content:center;
      gap:3px;
      margin-top:6px;
    }
    .dowCell { font-size:11px; color:#6b7280; text-align:center; }

    .cell{
      height:26px; border-radius:9px;
      border:1px solid transparent;
      background:#f9fafb;
      cursor:pointer;
    }
    .cell:hover{ border-color:#d1d5db; }
    .cell.empty{ background:transparent; cursor:default; }
    .cell.inRange{ background:#e5e7eb; }
    .cell.start, .cell.end{ background:#111827; color:#fff; }
    .cell.disabledCell{ opacity:.45; cursor:not-allowed; }

    .footer{
      display:flex;
      justify-content:flex-end;
      gap:10px;
      margin-top: 4px;
    }
    .btn{
      height:34px;
      border-radius:10px;
      border:1px solid #111827;
      background:#111827;
      color:#fff;
      padding:0 12px;
      cursor:pointer;
    }
    .btn.ghost{ background:transparent; color:#111827; }

    .btn[disabled], .btn.disabledBtn{
      opacity:.45;
      cursor:not-allowed;
    }

    /* If screen is narrower, stack calendars vertically */
    @media (max-width:820px){
        .calStack{ grid-template-columns: 1fr; }
        .dow, .grid {
            display:grid;
            grid-template-columns:repeat(7, 38px);
            justify-content:center;
            gap:3px;
            margin-top:6px;
          }
    }

    @media (max-width:720px){
        .panel{
          position:absolute;         /* ✅ ya no fixed */
          top: calc(100% + 8px);
          left: 0;
          width: 100%;
          max-width: 100%;
          border-radius:14px;
          overflow: visible;         /* o hidden si lo prefieres */
          padding: 10px;
        }
      
        .selectWrap{ max-width:100%; }
      
        /* inputs se apilan si hace falta */
       /* .inputs{ flex-direction: column; gap:8px; } */
      }
      
  `],
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
