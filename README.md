# Angular 19 – Date Range Picker (Prototype 3)

This repository contains **Prototype 3** of a dependency-free Date Range Picker built with **Angular 19** using **standalone components**, **signals**, and **plain TypeScript/CSS**.

The goal of this prototype is to provide a **production-ready reference implementation** that can be:
- Integrated into an existing Angular application
- Reviewed by developers and QA
- Used as a baseline for future visual or behavioral changes

No third‑party UI or date libraries are used.

---

## Goals and scope

- Provide a robust date range selection UX
- Support both **presets** and **custom ranges**
- Enforce **no-future-date** rules
- Keep logic decoupled from UI
- Remain framework‑light and easy to reason about

---

## Quickstart

```bash
npm install
npm run start
```

The application renders a **single demo page** showing Prototype 3.

---

## High-level architecture

```
Demo page
   ↓
DateRangePickerComponent
   ↓
Pure date utilities & preset logic
```

- **UI logic** lives in the picker component
- **Date math & rules** live in reusable helpers
- **No DOM logic** exists outside the component

---

## Folder structure

```
src/app/
├── date-range/
│   ├── date-range.types.ts
│   │   Shared interfaces and enums (DateRange, Preset keys)
│   │
│   ├── date-utils.ts
│   │   Pure date helpers:
│   │   - date normalization
│   │   - month grid generation
│   │   - comparisons (same day, range checks)
│   │
│   └── presets.ts
│       Preset definitions and calculations
│
├── date-range-picker/
│   ├── date-range-picker.component.ts
│   │   Core behavior:
│   │   - state management (signals)
│   │   - calendar navigation rules
│   │   - validation logic
│   │   - preset vs custom flows
│   │
│   ├── date-range-picker.component.html
│   │   Template:
│   │   - inputs
│   │   - dropdowns
│   │   - calendars
│   │   - buttons
│   │
│   └── date-range-picker.component.css
│       Styles:
│       - layout
│       - spacing
│       - responsive behavior
│
├── demo/
│   └── demo.component.ts
│       Minimal demo wrapper
│
└── app.component.ts
    Renders the demo
```

---

## Component responsibilities

### date-range-picker.component.ts

Responsible for:
- Applied vs draft range handling
- Preset detection and application
- Calendar navigation (month/year)
- Preventing future selections
- Validation rules
- Responsive behavior triggers

No HTML or styling logic exists here.

---

### date-range-picker.component.html

Responsible for:
- Rendering inputs and dropdowns
- Binding to signals
- Displaying validation messages
- Wiring user interactions

No date calculations exist here.

---

### date-range-picker.component.css

Responsible for:
- Horizontal vs vertical layout
- Compact spacing
- Visual affordances (hover, selected, disabled)
- Breakpoints for responsiveness

---

## Core behavioral rules

### Presets

- Selecting a preset:
  - Immediately updates the applied range
  - Closes any open calendar
- Presets never keep the calendar open
- Presets are recalculated relative to **today**

---

### Custom range – opening behavior

- Clicking **Custom** opens the calendar panel
- If coming from a preset:
  - Draft is empty
  - Calendar opens in a fresh state (previous + current month)
- If editing an existing custom range:
  - Draft is prefilled
  - Calendars reposition to show the relevant months

---

### Calendar navigation rules

#### Month navigation

- Two calendars always show **consecutive months**
- The bottom calendar may not move beyond the current month
- The top calendar may not advance if it would push the bottom calendar into the future

#### Year selection

- Only years **≤ current year** are shown
- A year option is disabled if selecting it would create a future month
- Year selection never visually succeeds if logically invalid

---

### Date selection rules

- Future dates are disabled
- Today is allowed
- Selection flow:
  1. First click sets Start
  2. Second click sets End
  3. Clicking again edits based on the active field (Start or End)

---

### Validation rules

- Start and End validations are **independent**
- Clearing the draft shows validation messages
- Selecting only Start clears only the Start error
- Errors clear only when both dates are valid
- Canceling the panel does **not** apply changes

---

## Responsive behavior

- When enough horizontal space exists:
  - Calendars render side-by-side
- On smaller widths:
  - Calendars stack vertically
- Inputs attempt to remain on one row when possible

Layout decisions are CSS-only.

---

## QA scenarios (Gherkin)

### Presets

```gherkin
Scenario: Default preset is applied
  Given the page loads
  Then the selected range is Last 90 days
```

```gherkin
Scenario: Preset applies immediately
  When the user selects "Last 7 days"
  Then the range updates immediately
  And the calendar is closed
```

---

### Custom range

```gherkin
Scenario: Open custom picker
  When the user clicks Custom
  Then the calendar panel opens
```

```gherkin
Scenario: Independent field validation
  Given the panel is open
  When the user clears dates
  Then both Start and End errors are shown
  When the user selects a Start date
  Then only the End error remains
```

```gherkin
Scenario: Apply custom range
  Given both Start and End are selected
  When the user clicks Apply
  Then the range updates
  And the panel closes
```

---

### Date constraints

```gherkin
Scenario: Prevent future dates
  When the user attempts to select a future date
  Then the date cannot be selected
```

```gherkin
Scenario: Prevent future year navigation
  When the user selects a year that would create a future month
  Then the year option is disabled
```

---

## Modifying the visual design

To change the visual appearance:

- **Spacing, layout, breakpoints**
  - Edit `date-range-picker.component.css`
- **Markup structure**
  - Edit `date-range-picker.component.html`
- **Behavioral rules**
  - Edit `date-range-picker.component.ts`

Recommended:
- Do **not** mix date logic into HTML
- Do **not** introduce visual conditionals into TS
- Keep date math inside `date-utils.ts`

---

## Integration notes

- The component is standalone
- Can be copied into another Angular 19+ app
- No external dependencies required
- Works with OnPush change detection by default

---