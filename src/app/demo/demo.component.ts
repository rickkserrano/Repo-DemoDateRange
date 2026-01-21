import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DateRangePickerProto4Component } from '../date-range-picker-proto4/date-range-picker-proto4.component';

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
  imports: [CommonModule, DateRangePickerComponent,DateRangePickerProto4Component],
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
    <div class="page">
      <div class="section">
    <h2>Prototype 4</h2>
    <p class="subtitle">
   

    Date range picker with optional presets.
    The same component supports Premium and Standard users via configuration:
    presets are shown only for Premium users.
  </p>
  
    <!-- Premium (con presets + inicial preset) -->
    <app-date-range-picker-proto4
      [value]="rangeProto4Premium"
      [isPremium]="true"
      [initialPreset]="'last90'"
      (valueChange)="rangeProto4Premium = $event"
    ></app-date-range-picker-proto4>

    <div style="height:24px"></div>

    <!-- Standard (sin presets + vacío) -->
    <app-date-range-picker-proto4
      [value]="rangeProto4Standard"
      [isPremium]="false"
      [initialPreset]="null"
      (valueChange)="rangeProto4Standard = $event"
    ></app-date-range-picker-proto4>
    </div>
    </div>

    <div class="page-spacer"></div>

    <p>By Ricardo Serrano</p>
  `,
})
export class DemoComponent {
  range: DateRange = lastNDays(90);
  rangeProto4Premium: DateRange = { start: null, end: null };   // se auto-inicializa con initialPreset si lo pasas
  rangeProto4Standard: DateRange = { start: null, end: null };  // vacío

}
