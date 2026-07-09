# Fantasy Big Brother

Fantasy sports web app for Big Brother — fans draft houseguests and earn points based on performance.

@AGENTS.md

## Tech Stack
- **Framework**: Next.js 16 (App Router) + React 19 + TypeScript
- **Styling**: Tailwind CSS v4 — uses `@import "tailwindcss"` in globals.css, NO tailwind.config file
- **Database**: Supabase (PostgreSQL) via `@supabase/supabase-js`
- **Charts**: Recharts 3.x
- **Fonts**: Geist Sans (UI) + Geist Mono (available via `font-mono`) via `next/font`
- **Path alias**: `@/*` maps to `./src/*`

## Commands
- `npm run dev` — start dev server
- `npm run build` — production build
- `npm run lint` — ESLint check

## Design System — "Broadcast Dark"

Refined dark UI: near-black canvas, hairline borders, one gold accent. No neon glows,
no multi-color accent schemes. The energy comes from contrast and the gold, not effects.

All design tokens are defined in `src/app/globals.css` via Tailwind v4 `@theme` and used
as normal utility classes (`bg-surface`, `text-ink-mid`, `border-edge`, …).

### Surface tokens (never lighten the base)
- `bg-canvas` (#0a0b0e) — page background only
- `bg-surface` (#12141a) — cards and panels
- `bg-raised` (#1a1d25) — nested elements, inputs, chips
- `bg-overlay` (#232733) — floating elements (tooltips, menus)

### Line tokens
- `border-edge` (#22252f) — default hairline for cards, dividers, table rows
- `border-edge-bright` (#2f3441) — hover borders, rings on avatars

### Ink tokens (text)
- `text-ink` (#f2f4f8) — headings, primary values, names
- `text-ink-mid` (#98a1b0) — body copy, secondary text
- `text-ink-dim` (#5c6473) — labels, hints, muted metadata

### Accent
- `gold` (#f5c518) / `gold-bright` (#ffd75e) — THE accent. Scores, eyebrow labels,
  primary buttons, active tabs, #1-rank highlights, focus rings.
- Gold surfaces: `bg-gold/10` wash + `border-gold/20` (badges), `bg-gold/[0.04]` (#1 rows)
- Text on solid gold is always `text-black`
- Medals: `text-silver` (#c3cad6) for 2nd, `text-bronze` (#d08c4a) for 3rd

### Status colors (always paired with a text label, never color alone)
- Active: `text-emerald-400` + `bg-emerald-400/10` + `border-emerald-400/20` (+ pulsing dot)
- Evicted/danger: `text-red-400` + `bg-red-400/10` + `border-red-400/20`
- Winner: gold equivalents
- Runner-up: `text-sky-400` equivalents
- Rank change: up `text-emerald-400`, down `text-red-400`, none `text-ink-dim` em-dash

## Typography
- **Page title**: `text-3xl font-bold tracking-tight text-ink`
- **Eyebrow** (above titles): `text-xs font-semibold uppercase tracking-[0.15em] text-gold`
- **Section heading**: `text-sm font-semibold uppercase tracking-wider text-ink-mid`
- **Form/table labels**: `text-xs font-medium uppercase tracking-wider text-ink-dim`
- **Body**: `text-sm text-ink-mid`
- **Numbers**: Geist Sans with `tabular-nums` in any column/row that must align
  (scores, ranks, stats). Large standalone numbers (hero scores) use `font-semibold`
  proportional figures. Do NOT use `font-mono` for numbers.
- **Scores**: `font-semibold text-gold tabular-nums`

## Component Patterns

Shared primitives live in `src/components/ui.tsx` — **use them, don't re-implement**:
`Card`, `PageHeader`, `EmptyState`, `NoSeason`, `Skeleton`, `StatTile`, `Avatar`,
`StatusBadge`, `RankNumber`, `RankChange`, icons (`IconUsers`, `IconHome`,
`IconCalendar`, `IconTrophy`, `IconEye` — 18px, 1.75 stroke, always `text-ink-dim`),
plus exported class strings
`inputCls`, `selectCls`, `btnPrimary`, `btnSecondary`, `btnDanger`, `thCls`, `trCls`.
The nav is `src/components/nav.tsx` (client component, active-state pills + mobile menu).

### Cards
The `Card` component bakes in depth (`rounded-2xl border border-edge bg-surface` +
an inset top highlight and soft outer shadow) — never build a bare card div.
- Interactive cards add `transition-colors hover:border-edge-bright`
- Nested elements inside cards: `rounded-xl border border-edge bg-raised p-3`
- Card section headers: `border-b border-edge px-5 py-4`

### Buttons
- **Primary**: `rounded-xl bg-gold px-5 py-2.5 text-sm font-semibold text-black hover:bg-gold-bright`
- **Secondary**: `rounded-xl border border-edge bg-raised text-ink-mid hover:border-edge-bright hover:text-ink`
- **Danger**: `rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20`
- Disabled: `disabled:cursor-not-allowed disabled:opacity-40`

### Inputs & Selects
```
rounded-xl border border-edge bg-raised px-4 py-2.5 text-sm text-ink
placeholder:text-ink-dim focus:border-gold/50 focus:outline-none focus:ring-2 focus:ring-gold/20
```

### Badges / chips
`rounded-full border px-2.5 py-0.5 text-xs font-medium` + status color trio (see above).

### Tabs (segmented)
- Container: `inline-flex gap-1 rounded-xl border border-edge bg-surface p-1`
- Active: `rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-black`
- Inactive: `text-ink-mid hover:text-ink`

### Tables
- Wrap in Card with `overflow-hidden`; `table` is `w-full text-sm`
- Header row: `border-b border-edge`, cells use `thCls`
- Body rows: `trCls` (`border-b border-edge/60 last:border-0 hover:bg-white/[0.02]`)
- Rank colors via `RankNumber`; #1 row gets `bg-gold/[0.04]`
- Numeric cells right-aligned with `tabular-nums`

### Loading states
- ALWAYS skeleton placeholders (`Skeleton` component: `animate-pulse rounded-lg bg-raised`),
  never "Loading..." text. Match the shape of the loaded content.

## Layout & Spacing
- Standard pages: `mx-auto max-w-5xl px-4 py-12`
- Wide pages (dashboard, trends, houseguests): `max-w-6xl`; forecast: `max-w-7xl`
- Narrow pages (submit): `max-w-2xl`
- Between cards in a list: `space-y-4`; page sections: `mt-12` or `space-y-6`
- Grid gaps: `gap-4` (tiles), `gap-6` (cards)
- Nav: sticky, `border-b border-edge bg-canvas/85 backdrop-blur-md`, pill links
  (active `bg-raised text-ink`), gold "Submit bracket" CTA. Admin link lives in the footer.
- Hero sections: `.bg-dots` utility (faint dot grid fading downward, defined in
  globals.css) + one soft gold radial orb; hero headline uses gradient text
  (`bg-gradient-to-b from-white to-ink-mid bg-clip-text text-transparent`)
- App icon: `src/app/icon.svg` (gold rounded square, black BB)

## Charts & Data Viz (Recharts)
Follow the dataviz method: form first, color by job, validated palette, thin marks.

- **Categorical series palette** (validated CVD-safe on `#12141a`, in this fixed order):
  `#3987e5` blue, `#199e70` aqua, `#c98500` yellow, `#008300` green, `#9085e9` violet,
  `#e66767` red, `#d55181` magenta, `#d95926` orange.
  Colors are assigned to entities **in rank order at load and never reassigned or cycled**;
  entities beyond the 8th render muted `#4a515e` — the legend/tooltip carries their identity.
- Head-to-head team colors: A = `#3987e5` (blue), B = `#d95926` (orange)
- Grid: solid hairline `#22252f`, horizontal only (`vertical={false}`), never dashed
- Axis ticks: `fill #7d8594`, fontSize 12, `tickLine={false}`
- Lines: `strokeWidth={2}`, `dot={false}`, `activeDot={{ r: 5, stroke: '#12141a', strokeWidth: 2 }}`
  (the surface-colored ring keeps overlapping points legible)
- Tooltip: `backgroundColor #1a1d25`, `border 1px solid #2f3441`, `borderRadius 10px`
- Comparison bars: thin (`h-2.5`) rounded, 2px surface gap between segments, values in
  ink tokens beside the bar (text never wears the series color)
- Always wrap charts in Card with `min-h-[400px]`; a legend/checkbox panel is always present

## Accessibility
- All interactive elements: visible `focus:ring-2 focus:ring-gold/20` (or default ring) focus state
- Color is **never** the only indicator — status badges carry labels, rank changes carry arrows+numbers
- Text meets WCAG AA on dark surfaces (`text-ink-mid`+ for body copy)
- `aria-label`/`sr-only` on icon-only buttons; semantic HTML (`<table>`, `<nav>`, `<label>`)

## Anti-Patterns — NEVER Do These
- **Never** use light backgrounds — the dark canvas is the product
- **Never** use neon glow shadows (`shadow-[0_0_20px_...]`) — depth comes from surface steps + hairlines
- **Never** introduce accent colors beyond gold + the status/chart palettes above
- **Never** use `font-mono` for scores — Geist Sans + `tabular-nums` in columns
- **Never** skip borders on cards — always `border border-edge`
- **Never** show "Loading..." text — always skeletons
- **Never** hardcode hex in className — use the theme tokens; raw hex is allowed only in
  chart configs and dynamic inline styles (bar widths, series colors)
- **Never** re-implement a primitive that exists in `src/components/ui.tsx`
- **Never** use animations longer than 500ms
- **Never** cycle or reassign chart series colors when filters change

## Data Conventions
- **Bracket passwords**: `brackets.edit_password` stores a SHA-256 hex hash of the password set
  at submission. Players edit their bracket from the team page (`/api/brackets/update`) until
  `seasons.submissions_locked` is true ("roster lock"). The season `admin_password` works as a
  plaintext master key in that route. Never return `edit_password` from API responses.
- **Week-0 sentinel**: the `weekly_events` row with `week_number = 0` holds the LIVE house
  state (current HOH via `hoh_winner_id`, veto holder via `veto_winner_id`, nominees as
  `block_survivors` rows). It is display-only: `getHouseguestStats` in `scoring.ts` excludes
  week-0 events/survivors from all point math, and pages filter `week_number >= 1` when
  enumerating weeks. Managed from the admin "House state" tab; rendered as the dashboard's
  "The house right now" board. Real scored weeks always start at 1.

## File Structure
- Pages: `src/app/*/page.tsx` (client pages use `'use client'`; home is a server component)
- Shared UI: `src/components/` — `nav.tsx` (header), `ui.tsx` (primitives + class strings)
- API routes: `src/app/api/*/route.ts`
- Shared logic: `src/lib/` — `supabase.ts` (client), `types.ts` (interfaces + constants), `scoring.ts` (calculations)
- Global styles + design tokens: `src/app/globals.css` (Tailwind v4 `@theme`)
- Root layout: `src/app/layout.tsx` (nav + footer shell)
- All styling via Tailwind utility classes — no component library
