# Dark Theme + 5-Mode Shell Implementation Plan

## Goal
Transform the dentist dashboard from a 10-tab light theme to a 5-mode dark theme architecture. Zero functional breakage - all existing components stay untouched internally.

## Architecture Overview

### Current Flow
```
page.tsx → activeTab (10 values) → renders component
```

### New Flow
```
page.tsx → activeMode (5 modes) → mode determines which tabs are visible → activeTab → renders same component
```

The key insight: we add an `activeMode` state that sits ABOVE `activeTab`. The mode determines which group of tabs is relevant. The existing `activeTab` + component rendering stays 100% identical.

## Files to Change

### 1. `app/globals.css` — Dark Theme Variables
**What**: Replace the `.dark` CSS variables with our custom dark navy palette. Remove the duplicate color blocks (lines 133-186) that conflict. Update prose styles for dark mode.

**Dark palette (matches mockups):**
- `--background`: `220 25% 5.5%` → `#0a0f1a`
- `--foreground`: `210 40% 98%` → `#f1f5f9`
- `--card`: `222 25% 11%` → `#1a2235`
- `--muted`: `217 25% 14%` → `#1e2a40`
- `--border`: `220 15% 12%` → subtle dark border
- `--accent`: `170 58% 40%` → `#14b8a6` (cyan-teal)

**Also**: Add `--color-teal` custom property for the accent color that components reference. Update prose styles to use CSS variables.

### 2. `app/layout.tsx` — Force Dark Class
**What**: Add `dark` class to the `<html>` element and update body classes.

```tsx
// Before
<html className={`bg-white dark:bg-gray-950 text-black dark:text-white ${manrope.className}`}>
<body className="min-h-[100dvh] bg-gray-50">

// After
<html lang="en" className={`dark ${manrope.className}`}>
<body className="min-h-[100dvh] bg-background text-foreground">
```

This activates all the `.dark` CSS variables immediately. The `bg-background` and `text-foreground` classes use our CSS variables, so they auto-resolve to the dark palette.

### 3. `app/dentist/page.tsx` — Add Mode Layer + Redesign Header
**What**: This is the main structural change. We:

a) Add `activeMode` state with 5 values: `'home' | 'clinical' | 'pms' | 'research' | 'management'`

b) Define mode-to-tab mapping:
```typescript
const modeConfig = {
  home: { tabs: ['today'], defaultTab: 'today' },
  clinical: { tabs: ['consultation-v3', 'cockpit'], defaultTab: 'consultation-v3' },
  pms: { tabs: ['patients', 'messages', 'templates'], defaultTab: 'patients' },
  research: { tabs: ['analysis', 'research-v2', 'medical-knowledge', 'ai-assistant'], defaultTab: 'analysis' },
  management: { tabs: ['tasks', 'organizer'], defaultTab: 'tasks' },
}
```

c) Replace the header with dark-themed mode-pill navigation:
- Dark background header with backdrop blur
- ENDOFLOW logo (gradient text)
- 5 mode pills (Home, Clinical, PMS, Research, Manage)
- Active pill gets teal background
- Notification + profile buttons

d) Replace the 10-tab nav bar:
- In non-home modes: show sub-tabs for the current mode only (much fewer tabs)
- In home mode: no sub-tabs needed (just renders today's view + workspace cards)

e) **Home mode content**: Replace the current "today" tab content with the new landing layout:
- Welcome greeting row
- 4 stat cards (dark themed)
- 4 workspace mode blocks (Clinical, PMS, Research, Management)
- Today's schedule list
- Calendar widget + notifications sidebar

f) Update all hardcoded light-theme classes throughout the file:
- `bg-white` → `bg-card`
- `border-gray-200` → `border-border`
- `text-gray-900` → `text-foreground`
- `text-gray-500` → `text-muted-foreground`
- `bg-gray-50` → `bg-background`
- `text-teal-600` → `text-teal-400` (for dark backgrounds)
- `bg-teal-600` → `bg-teal-500`
- Gradient stat cards → dark-themed with subtle color glows

g) Loading skeleton + error states: update to dark theme colors.

### 4. `components/dentist/mobile-dentist-navigation.tsx` — Dark Theme + Mode Nav
**What**: Update the mobile bottom nav for dark theme and 5-mode architecture.

Changes:
- `bg-white/95` → `bg-[#0a0f1a]/95`
- `border-gray-200` → `border-border`
- Active state: `text-teal-600 bg-teal-50` → `text-teal-400 bg-teal-500/10`
- Inactive: `text-gray-500` → `text-muted-foreground`
- AI FAB: keep gradient but update shadow color
- More menu sheet: dark background, dark cards
- Update tabs to reflect mode-based grouping (Home, Patients, AI FAB, Schedule, More)
- The "More" sheet shows mode blocks instead of individual tabs

### 5. `components/dentist/view-mode-toggle.tsx` — Dark Theme Colors
**What**: Quick update to use dark-compatible colors.
- `hover:bg-teal-50` → `hover:bg-teal-500/10`
- `text-teal-600` → `text-teal-400`
- `text-gray-600` → `text-muted-foreground`

## What Does NOT Change
- All 56 dentist components (consultation, chart, patients, etc.) — their internal code stays identical
- Database queries, server actions, API routes
- Authentication, middleware, routing
- Voice controller, AI services
- All other dashboards (patient, assistant)

## Execution Order

1. **globals.css** — Update dark theme variables, clean duplicates, update prose
2. **layout.tsx** — Add dark class (2 lines)
3. **view-mode-toggle.tsx** — Quick color fix (3 lines)
4. **mobile-dentist-navigation.tsx** — Dark theme + mode structure
5. **page.tsx** — The main change: mode layer + header + home landing + dark classes

Steps 1-3 are fast and independent. Step 4 and 5 are the core work.

## Risk Assessment
- **Zero functional risk**: No component internals change. The `activeTab` state still drives rendering identically.
- **Visual risk**: Some child components use hardcoded light colors internally (e.g., `text-gray-900` in section headers). These will look wrong against a dark background. We'll fix these as we find them, but the child components' functional behavior is untouched.
- **Rollback**: If anything breaks, removing the `dark` class from `<html>` reverts everything to light theme instantly.
