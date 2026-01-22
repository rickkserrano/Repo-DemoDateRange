import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

import { DateRange } from '../date-range/date-range.types';
import { addDays, normalizeDate } from '../date-range/date-utils';

import { DateRangePickerComponent } from '../date-range-picker/date-range-picker.component';
import { DateRangePickerProto4Component } from '../date-range-picker-proto4/date-range-picker-proto4.component';
import { DateRangePickerProto5Component } from '../date-range-picker-proto5/date-range-picker-proto5.component';

function lastNDays(n: number): DateRange {
  const today = normalizeDate(new Date());
  return { start: addDays(today, -(n - 1)), end: today };
}

@Component({
  selector: 'app-demo',
  standalone: true,
  imports: [CommonModule, DateRangePickerComponent, DateRangePickerProto4Component, DateRangePickerProto5Component],
  template: `
    <div class="page">
    <!--

      <div class="section">
        <h2>Prototype 3</h2>
        <p class="subtitle">
          Presets dropdown + Custom.
        </p>

        <div class="row">
          <app-date-range-picker
            [value]="rangeProto3"
            (valueChange)="rangeProto3 = $event"
          ></app-date-range-picker>
        </div>

        <div class="value">
          Current selection:
          <code>{{ rangeProto3.start?.toDateString() }} - {{ rangeProto3.end?.toDateString() }}</code>
        </div>
      </div> 
      -->
      <!-- ========================= -->
      <!-- Prototype 4 -->
      <!-- ========================= -->
      <div class="section">
        <h2>Prototype 4</h2>
        <p class="subtitle">
          Date range picker with optional presets. The same component supports Premium and Standard users via configuration.
        </p>

        <div class="row">
          <span class="user-type">Premium</span>
          <app-date-range-picker-proto4
            [value]="rangeProto4Premium"
            [isPremium]="true"
            [initialPreset]="'last90'"
            (valueChange)="rangeProto4Premium = $event"
          ></app-date-range-picker-proto4>
        </div>

        <div class="row" style="margin-top:12px;">
        <span class="user-type">Standard</span>
          <app-date-range-picker-proto4
            [value]="rangeProto4Standard"
            [isPremium]="false"
            [initialPreset]="null"
            (valueChange)="rangeProto4Standard = $event"
          ></app-date-range-picker-proto4>
        </div>
      </div>

      <!--
      <div class="section">
        <h2>Prototype 5</h2>
        <p class="subtitle">
          Hybrid flow: quick preset list first, then a full Custom editor (Prototype 4-style). Premium gets presets; Standard is custom-only.
        </p>

        <div class="row">
          <div class="label">Premium</div>
          <app-date-range-picker-proto5
            [value]="rangeProto5Premium"
            [isPremium]="true"
            [initialPreset]="'last90'"
            [openCustomDirectlyWhenAppliedCustom]="true"
            (valueChange)="rangeProto5Premium = $event"
          ></app-date-range-picker-proto5>
        </div>

        <div class="row" style="margin-top:12px;">
          <div class="label">Standard</div>
          <app-date-range-picker-proto5
            [value]="rangeProto5Standard"
            [isPremium]="false"
            [initialPreset]="null"
            [openCustomDirectlyWhenAppliedCustom]="true"
            (valueChange)="rangeProto5Standard = $event"
          ></app-date-range-picker-proto5>
        </div>
      </div>
      -->
      <div class="page-spacer"></div>
      <p>By Ricardo Serrano</p>
    </div>
  `,
})
export class DemoComponent {
  // Prototype 3 (default demo uses last 90 days)
  rangeProto3: DateRange = lastNDays(90);

  // Prototype 4
  rangeProto4Premium: DateRange = { start: null, end: null };
  rangeProto4Standard: DateRange = { start: null, end: null };

  // Prototype 5
  rangeProto5Premium: DateRange = { start: null, end: null };
  rangeProto5Standard: DateRange = { start: null, end: null };
}
