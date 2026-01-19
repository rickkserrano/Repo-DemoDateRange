import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

import { DateRangePickerComponent } from '../date-range-picker/date-range-picker.component';
import { DateRange } from '../date-range/date-range.types';
import { addDays, normalizeDate } from '../date-range/date-utils';

function lastNDays(n: number): DateRange {
  const today = normalizeDate(new Date());
  return { start: addDays(today, -(n - 1)), end: today };
}

@Component({
  selector: 'app-demo',
  standalone: true,
  imports: [CommonModule, DateRangePickerComponent],
  template: `
    <div class="page">
      <div class="section">
        <h2>Prototype 3</h2>
        <div class="subtitle">Presets dropdown + Custom (dependent 2 months, no future)</div>

        <div class="label">Current selection</div>
        <div class="value">
          <code>{{ range.start ? (range.start | date:'yyyy-MM-dd') : '—' }}</code>
          →
          <code>{{ range.end ? (range.end | date:'yyyy-MM-dd') : '—' }}</code>
        </div>

        <app-date-range-picker [value]="range" (valueChange)="range = $event"></app-date-range-picker>
      </div>
    </div>

    <div class="page-spacer"></div>

    <p>By Ricardo Serrano</p>
  `,
})
export class DemoComponent {
  range: DateRange = lastNDays(90);
}
