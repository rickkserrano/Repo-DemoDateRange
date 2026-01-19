# Angular 19 - Date Range Picker (Prototype 3)

This repository contains a **dependency-free** Date Range Picker built with **Angular 19** (standalone components) and plain **TypeScript/CSS**.  
It was extracted from a multi-prototype playground and kept as a single, production-oriented component.

- No Angular Material
- No third-party date libraries (Moment, Day.js, date-fns, ...)
- Presets + Custom date range selection
- Two-month dependent calendar view
- Future dates disabled (today is allowed)
- Responsive layout (horizontal when space allows, vertical on narrow screens)

## Quickstart

```bash
npm install
npm run start
```

Open the app and navigate to the single demo page.

## Folder structure

```
src/app/
  date-range/
    date-range.types.ts     # Shared types (DateRange, QuickKey, ...)
    date-utils.ts           # Pure date helpers (grid building, normalize, etc.)
    presets.ts              # Preset definitions and range calculators

  date-range-picker/
    date-range-picker.component.ts  # Standalone picker component (UI + interaction)

  demo/
    demo.component.ts       # Simple demo page for manual testing

  app.component.ts          # Renders the demo component
```

## Component API

Selector:

```html
<app-date-range-picker
  [value]="range"
  (valueChange)="range = $event"
></app-date-range-picker>
```

Types:

```ts
export type DateRange = { start: Date | null; end: Date | null };
```

### Events
- `valueChange: EventEmitter<DateRange>` emits **only** when the user clicks **Apply dates**.

## Data contract for backend filtering

UI can display friendly strings, but backend filtering should use a stable format. Recommended patterns:

### Date-only filtering (no time)
Send ISO dates:

```json
{ "startDate": "2025-01-12", "endDate": "2025-03-28" }
```

### Timestamp filtering (with time)
Send ISO timestamps in UTC (example):

```json
{ "startDateTime": "2025-01-12T00:00:00Z", "endDateTime": "2025-03-28T23:59:59Z" }
```

## QA guide (expected behavior)

The following scenarios describe the intended behavior of the picker using a Gherkin-style format.

### Feature: Presets

```gherkin
Feature: Date Range Presets

  Scenario: Default preset is applied when the demo loads
    Given the demo page is loaded
    When no external value is injected
    Then the current selection should be Last 90 days

  Scenario: Selecting a preset updates the selection immediately
    Given the presets dropdown is open
    When the user clicks "Last 7 days"
    Then the current selection should represent the last 7 days ending today
    And the calendar panel should remain closed
```

### Feature: Custom range

```gherkin
Feature: Custom Date Range

  Scenario: Opening Custom shows the calendar panel
    Given the presets dropdown is open
    When the user clicks "Custom"
    Then the calendar panel should be visible

  Scenario: Applying a custom range updates the selection
    Given the calendar panel is open
    When the user selects a start date and an end date
    And the user clicks "Apply dates"
    Then the selection should update to the chosen range
    And the calendar panel should close

  Scenario: Canceling Custom does not change the applied selection
    Given a selection is already applied
    And the calendar panel is open
    When the user dismisses the panel without clicking "Apply dates"
    Then the selection should remain the previously applied range
```

### Feature: Date constraints

```gherkin
Feature: Date Constraints

  Scenario: Future dates are disabled
    Given the calendar panel is open
    When the user tries to select a date after today
    Then the picker should prevent the selection

  Scenario: Today is allowed
    Given the calendar panel is open
    When the user selects today's date
    Then the picker should accept the selection
```

### Feature: Responsive layout

```gherkin
Feature: Responsive Layout

  Scenario: Desktop layout shows two calendars side-by-side when there is enough width
    Given the viewport width is wide enough
    When the calendar panel opens
    Then the two month calendars should render horizontally

  Scenario: Narrow layout stacks calendars vertically
    Given the viewport width is narrow
    When the calendar panel opens
    Then the two month calendars should render one above the other
```

## Notes for developers

- **Pure date logic** lives in `src/app/date-range/date-utils.ts` and `src/app/date-range/presets.ts`.
- The picker component is intentionally standalone so it can be copied into another app or extracted into an internal library.
- Styling is plain CSS kept inside the component to reduce global coupling.

