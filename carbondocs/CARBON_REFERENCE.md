# Carbon Design System v11 — Developer Reference

Compact reference for building UI with `@carbon/react`. Replaces 56 raw docs files.

---

## Components Quick Reference

| Component | When to use | Key variants |
|-----------|-------------|-------------|
| **Accordion** | Progressive disclosure of grouped content | Default, flush (sidebars), icon-start |
| **Breadcrumb** | Secondary nav for >2 hierarchy levels | Small (`$label-01`), medium (`$body-compact-01`) |
| **Button** | Trigger actions (NOT navigation) | Primary (1 per screen), Secondary, Tertiary, Ghost, Danger |
| **Checkbox** | Multiple selections from a list | Selected, unselected, indeterminate |
| **Code Snippet** | Copyable code/strings | Inline, single-line, multi-line |
| **Contained List** | Organize content in small spaces | On-page, disclosed (popovers) |
| **Content Switcher** | Toggle views of same content | Text, icon-only. Sizes: S/M/L |
| **Data Table** | Structured data with sort/select/expand | Sortable, selectable, expandable, batch actions |
| **Date Picker** | Date/time input | Simple input, single calendar, range, time picker |
| **Dropdown** | Select from list | Single, multiselect, combo box, inline |
| **File Uploader** | Upload files | Default (button), drag-and-drop |
| **Inline Loading** | Action feedback in buttons/tables | Inactive → active → finished → error |
| **Link** | Navigation to new location (NOT actions) | Standalone (no underline), inline (always underlined) |
| **List** | Simple grouped vertical content | Unordered (bullets), ordered (numbers) |
| **Loading** | Block UI during long process (>3s) | Large (overlay), small (inline) |
| **Menu** | Disclosure list of actions | Context menu, overflow. Sizes: XS/S/M/L |
| **Menu Buttons** | Group actions into one trigger | Menu button, combo button, overflow menu |
| **Modal** | Focus on critical task, blocks workflow | Passive, transactional, acknowledgment, progress |
| **Notification** | System status / feedback | Inline, toast (auto-dismiss 5s), actionable, callout |
| **Number Input** | Numeric values with +/- controls | Default, fluid |
| **Pagination** | Navigate large datasets | Bar (below table), nav (standalone) |
| **Popover** | Floating content layer | No tip, caret tip, tab tip |
| **Progress Bar** | Show process duration | Determinate (0-100%), indeterminate |
| **Progress Indicator** | Guide through multi-step process | Vertical (preferred), horizontal |
| **Radio Button** | Mutually exclusive single choice | Vertical (preferred), horizontal |
| **Search** | Filter/discover by keyword | Default, fluid. Sizes: S/M/L |
| **Select** | Single choice in form (native browser) | Default, inline |
| **Slider** | Value from continuous scale | Default (single), range (min/max) |
| **Structured List** | Simple rows with optional selection | Read-only, selectable |
| **Tabs** | Navigate related content areas | Line, contained, vertical |
| **Tag** | Label/categorize items | Read-only, dismissible, selectable, operational |
| **Text Input** | Free-form text entry | Input (single line), textarea (multi line). Default/fluid |
| **Tile** | Flexible content grouping | Base, clickable, selectable, expandable |
| **Toggle** | Binary on/off with immediate effect | Default (with labels), small (compact) |
| **Toggletip** | Interactive content on click | Click to open, Esc to close |
| **Tooltip** | Non-interactive info on hover | Built-in (icon buttons), definition |
| **Tree View** | Hierarchical navigation | Small (default), extra small |
| **UI Shell Header** | Top nav bar | Hamburger → name → links → utils → switcher |
| **UI Shell Right Panel** | Slide-out panel from header icon | Floats over content, full height |

---

## Selection Decision Matrix

| Scenario | Component |
|----------|-----------|
| Multiple selections | Checkbox |
| Single, binary | Radio or Toggle |
| One from <3 options | Radio buttons |
| One from medium list | Select (form) / Dropdown (filter) |
| One from long list | Combo box |
| Multiple from list | Multiselect Dropdown |
| Toggle views | Content Switcher |
| Categorize items | Tag (read-only) |
| Filter with removable tags | Tag (dismissible) |
| Visual options | Selectable Tile |

---

## Key Component Rules

### Button
- Label: left-aligned. Icon: right of label. `{verb} + {noun}` labels.
- One primary per screen. Secondary never standalone. Max 3 in a group.
- Icon-only → always add tooltip. Never icon-only for danger.
- Sizes: XS, S, M, L (productive/expressive), XL, 2XL.

### Data Table
- Header row size must match body row size.
- Toolbar: tall for L/XL rows, small for S/XS rows.
- Pagination goes below table, zero padding between.
- Zebra stripes optional. Skeleton states for loading.

### Modal
- Focus trapped inside. Body scrolls, header/footer fixed.
- Transactional: secondary left + primary right, each 50% width.
- Use active verbs for buttons ("Add", "Delete"), not "OK".

### Form
- Vertical spacing: 32px between components (`$spacing-07`).
- Always visible labels. Helper text for format guidance (always visible).
- Placeholder for examples only — never critical info.
- Mark only the minority: if most required → mark optional ones.
- Default: wide gutter. Fluid: condensed gutter, 1px borders.

### Notification
- Inline: persists near related content. Toast: auto-dismiss 5s, top-right, max 2 lines.
- Toast stack: `$spacing-03` gap, newest at top.
- Callout: static, never dismissed, info/warning only.

### Tabs
- One tab always selected (first by default). Never wrap — scroll instead.
- Line tabs: auto-width. Contained tabs: auto-width or equal-width.
- Vertical tabs: 4 cols at XL/L, 2 cols at M, converts to contained at small.

---

## Layout & Grid

### 2x Grid (base: 8px mini unit)
- **16 columns.** Column count fixed per breakpoint, width fluid between.
- Breakpoints: Small 320px, Medium 672px, Large 1056px, XL 1312px, Max 1584px.
- Padding: always 16px.

### Gutter Modes
| Mode | Gutter | Use |
|------|--------|-----|
| **Wide** (default) | 32px | Components flush to columns |
| **Narrow** | 16px | Components hang into gutter |
| **Condensed** | 1px | Fluid form inputs |

---

## Spacing Tokens

| Token | px | Token | px |
|-------|---:|-------|---:|
| `$spacing-01` | 2 | `$spacing-08` | 40 |
| `$spacing-02` | 4 | `$spacing-09` | 48 |
| `$spacing-03` | 8 | `$spacing-10` | 64 |
| `$spacing-04` | 12 | `$spacing-11` | 80 |
| `$spacing-05` | 16 | `$spacing-12` | 96 |
| `$spacing-06` | 24 | `$spacing-13` | 160 |
| `$spacing-07` | 32 | | |

**Common patterns:** Form spacing 32px (`$spacing-07`). Between tags: 8px. Toast stack: 8px. Popover gap: 4px.

---

## Color & Themes

### Themes
| Theme | Background | CSS |
|-------|-----------|-----|
| **White** | white | `carbon.$white` |
| **Gray 10** | light gray | `carbon.$g10` |
| **Gray 90** | dark | `carbon.$g90` |
| **Gray 100** | darkest | `carbon.$g100` |

### Key Token Groups

**Background:** `$background`, `$background-hover`, `$background-active`, `$background-selected`, `$background-inverse`

**Layer:** `$layer-01` / `$layer-02` / `$layer-03` (component backgrounds, layered)

**Text:** `$text-primary` (body), `$text-secondary` (labels), `$text-placeholder`, `$text-disabled`, `$text-inverse`, `$text-on-color`

**Icons:** `$icon-primary`, `$icon-secondary`, `$icon-interactive`, `$icon-disabled`

**Border:** `$border-subtle-00/01/02` (dividers), `$border-strong-01/02` (form fields), `$border-interactive` (focus)

**Button:** `$button-primary` (Blue 60), `$button-secondary`, `$button-tertiary`, `$button-danger-primary` (Red 60)

**Status:** `$support-error` (red), `$support-success` (green), `$support-warning` (yellow), `$support-info` (blue)

**Focus:** `$focus` (2px ring, 3:1 contrast)

**Interactive:** `$interactive` = Blue 60

### Interaction States
- Hover = half step. Active = 2 steps. Selected = 1 step.
- Disabled = always gray, exempt from WCAG contrast.

### Layer Model
- Light: layers alternate White ↔ Gray 10
- Dark: each layer one step lighter

---

## Typography

### Typeface: IBM Plex
- **Plex Sans** — UI. **Plex Serif** — editorial. **Plex Mono** — code.
- Weights: Light (300), Regular (400), SemiBold (600).

### Type Tokens
| Token | Usage |
|-------|-------|
| `$label-01`, `$label-02` | Small labels |
| `$body-compact-01/02` | Dense UI body text |
| `$body-01/02` | Standard/expressive body |
| `$heading-01` to `$heading-07` | Productive headings (fixed) |
| `$fluid-heading-03` to `$fluid-display-04` | Expressive headings (responsive) |

---

## Icons

```tsx
import { Add, TrashCan, Edit, Search, Close, Download,
         ChevronDown, ArrowRight, Copy, Settings } from '@carbon/icons-react';
```

- Sizes: 16px (inline), 20px (standard), 24px, 32px (prominent).
- In buttons: icon right of label. Icon-only → always tooltip.
- External links: "Launch" icon. Internal: "ArrowRight".

---

## CSS Patterns

```scss
// Custom component using Carbon tokens
.my-component {
  padding: $spacing-05;
  background: var(--cds-layer-01);
  color: var(--cds-text-primary);
  border: 1px solid var(--cds-border-subtle-01);
}
```

Carbon class prefix: `.cds--`. All component sizes must match on same form.

### Theme Setup
```scss
@use '@carbon/react/scss/theme' with ($theme: carbon.$g100);
@use '@carbon/react';
```

### React Imports
```tsx
import { Button, DataTable, Table, TableHead, TableRow, TableHeader,
         TableBody, TableCell, Modal, TextInput, Dropdown, Tag,
         InlineNotification, Tabs, Tab, TabList, TabPanels, TabPanel,
         Grid, Column, Stack, Theme } from '@carbon/react';
```

---

## Motion

- **Productive** — fast, subtle (dropdowns, button states).
- **Expressive** — slower, vibrant (page transitions, notifications).
- Easing: standard (visible throughout), entrance (enters view), exit (leaves).
- Always provide reduced-motion alternatives.

## Accessibility

- WCAG AA: small text 4.5:1, large text 3:1, graphical 3:1.
- All interactive elements: visible focus (2px, `$focus`, 3:1).
- Icon-only buttons: always tooltip. All form fields: visible labels.
- `SkipToContent` as first focusable element in shell header.
- Modal: trap focus. Disabled: intentionally low contrast, WCAG exempt.
