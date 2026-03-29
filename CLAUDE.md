# Fantasy Big Brother

Fantasy sports web app for Big Brother — fans draft houseguests and earn points based on performance.

@AGENTS.md

## Tech Stack
- **Framework**: Next.js 16 (App Router) + React 19 + TypeScript
- **Styling**: Tailwind CSS v4 — uses `@import "tailwindcss"` in globals.css, NO tailwind.config file
- **Database**: Supabase (PostgreSQL) via `@supabase/supabase-js`
- **Charts**: Recharts 3.x
- **Fonts**: Geist Sans (UI) + Geist Mono (numbers) via `next/font`
- **Path alias**: `@/*` maps to `./src/*`

## Commands
- `npm run dev` — start dev server
- `npm run build` — production build
- `npm run lint` — ESLint check

## Color Palette

### Base (dark theme — never lighten)
- **Page background**: `bg-gray-950` (only use here)
- **Cards/sections**: `bg-gray-900`
- **Nested elements/inputs**: `bg-gray-800`
- **Borders**: `border-gray-800` (cards), `border-gray-700` (inputs/forms)

### Accents
- **Primary (Spotlight Yellow)**: `text-yellow-400` / `bg-yellow-500` — scores, page titles, primary buttons, featured elements
- **Secondary (Neon Cyan)**: `text-cyan-400` / `bg-cyan-500` — data highlights, stats, secondary accents
- **Tertiary (Drama Fuchsia)**: `text-fuchsia-400` / `bg-fuchsia-500` — special moments, alerts, dramatic emphasis

### Status Colors
- **Active/positive**: `text-green-400` / `bg-green-900/50`
- **Evicted/danger**: `text-red-400` / `bg-red-900/50`
- **Runner-up**: `text-blue-400` / `bg-blue-900/50`
- **3rd place**: `text-amber-600`

### Glow Effects
- **Yellow spotlight**: `shadow-[0_0_20px_rgba(250,204,21,0.2)]` — #1 ranked items, featured cards
- **Cyan glow**: `shadow-[0_0_15px_rgba(34,211,238,0.15)]` — stat highlights
- **Fuchsia glow**: `shadow-[0_0_15px_rgba(217,70,239,0.15)]` — dramatic moments
- **Card hover glow**: `hover:border-yellow-500/30 hover:shadow-[0_0_15px_rgba(250,204,21,0.1)]`

### Gradients
- **Hero sections**: `bg-gradient-to-br from-gray-950 via-gray-900 to-cyan-950/20`
- **Dramatic header**: `bg-gradient-to-r from-yellow-500/10 via-transparent to-fuchsia-500/10`

## Typography

### Hierarchy
- **Page title**: `text-3xl font-bold text-yellow-400`
- **Section title**: `text-xl font-bold text-white`
- **Subsection**: `text-lg font-semibold text-white`
- **Body**: `text-gray-300`
- **Secondary text**: `text-gray-400`
- **Muted/tertiary**: `text-gray-500`

### Rules
- **Geist Sans**: all UI text — headings, labels, descriptions, nav
- **Geist Mono** (`font-mono`): ALL numbers — scores, points, multipliers, ranks, stats, percentages
- **Labels**: `text-sm font-semibold text-gray-400 uppercase tracking-wider`
- Scores always: `font-mono text-yellow-400`

## Component Patterns

### Cards
```
bg-gray-900 rounded-xl border border-gray-800 p-6
```
- Add `hover:border-yellow-500/30 hover:shadow-[0_0_15px_rgba(250,204,21,0.1)] transition-all duration-300` for interactive cards
- Nested elements inside cards: `bg-gray-800 rounded-lg p-3`

### Buttons
- **Primary**: `bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-bold rounded-lg px-6 py-3 transition`
- **Secondary**: `bg-gray-800 text-gray-300 hover:bg-gray-700 rounded-lg px-4 py-2 transition`
- **Danger**: `bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg px-4 py-2 transition`
- **Disabled**: add `opacity-50 cursor-not-allowed`

### Inputs & Selects
```
bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500
focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition
```

### Status Badges
```
text-xs font-medium px-2 py-1 rounded-full
```
- Active: `bg-green-900/50 text-green-400`
- Evicted: `bg-red-900/50 text-red-400`
- Winner: `bg-yellow-900/50 text-yellow-400`

### Tabs
- Active: `bg-yellow-500 text-gray-900 font-medium px-4 py-2 rounded-lg`
- Inactive: `bg-gray-800 text-gray-400 hover:text-white font-medium px-4 py-2 rounded-lg transition`

### Avatar Fallback
```
w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-gray-400 font-bold
```

### Tables
- Container: card pattern with `overflow-hidden`
- Header: `text-left text-sm font-semibold text-gray-400 uppercase tracking-wider`
- Rows: `border-b border-gray-800/50 hover:bg-gray-800/50 transition`
- Rank colors: #1 `text-yellow-400`, #2 `text-gray-300`, #3 `text-amber-600`
- Change indicators: `text-green-400` ↑, `text-red-400` ↓, `text-gray-600` —

## Layout & Spacing

### Page Containers
- Standard pages: `max-w-5xl mx-auto px-4 py-12`
- Wide pages (trends, compare): `max-w-6xl mx-auto px-4 py-12`
- Narrow pages (submit): `max-w-4xl mx-auto px-4 py-12`

### Spacing Scale
- Between cards in a list: `space-y-4`
- Between page sections: `space-y-8` or `mb-8`
- Card internal sections: `space-y-4` or `space-y-6`
- Grid gaps: `gap-4` (tight), `gap-6` (standard), `gap-8` (loose)

### Grid Patterns
- Stats grid: `grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4`
- Card grid: `grid sm:grid-cols-2 lg:grid-cols-3 gap-6`
- Compare layout: `grid grid-cols-3` (Team A | VS | Team B)

### Navigation
- `bg-gray-900 border-b border-gray-800`
- Links: `text-gray-300 hover:text-white transition`
- Active link: `text-yellow-400`

## Animation & Interaction

### Transitions
- Color changes: `transition-colors duration-200`
- Size/shadow changes: `transition-all duration-300`
- Comparison bars: `transition-all duration-500`
- **Max duration**: 500ms for any UI animation

### Hover Effects
- Cards: glow border + subtle shadow (see Card pattern above)
- Table rows: `hover:bg-gray-800/50 transition`
- Nav links: `hover:text-white` or `hover:text-yellow-400`
- Buttons: always include `transition` with hover color shift

### Loading States
- **ALWAYS use skeleton placeholders**, never "Loading..." text
- Skeleton: `animate-pulse bg-gray-800 rounded`
- Match the shape of the content being loaded (rectangles for text, circles for avatars)
- Example: `<div className="h-4 w-32 animate-pulse bg-gray-800 rounded" />`

### Micro-interactions
- Active status dot: small `animate-pulse` green circle next to "Active" badges
- Rank change arrows should be visually distinct (green ↑ / red ↓) with `font-bold`

## Big Brother Theme Effects

### Spotlight Treatment
- #1 ranked row/card: `border-yellow-500/30 shadow-[0_0_20px_rgba(250,204,21,0.15)]`
- Winner houseguest: yellow glow border + subtle pulsing accent

### Neon Accents
- Featured/highlighted elements: `border-cyan-500/30` or `border-fuchsia-500/30`
- Use sparingly — only on 1-2 elements per page max

### Drama
- Hero sections use gradients (see Gradients above)
- VS dividers in comparisons: bold, large text with dramatic styling
- The darkness IS the theme — deep blacks create the Big Brother surveillance feel
- **Never lighten the base** — add energy through accents and glows, not by raising background lightness

## Charts (Recharts)
- Grid: `stroke="#374151"` (gray-700), `strokeDasharray="3 3"`
- Axis text: `fill: '#9ca3af'` (gray-400), `fontSize: 12`
- Tooltip: `backgroundColor: '#1f2937'`, `border: '1px solid #374151'`, `borderRadius: '8px'`
- Active dot: `r={6}`, default dot: `r={4}`
- Always wrap charts in the card pattern with `min-h-[400px]`
- Use the existing 20-color LINE_COLORS palette from trends page

## Fantasy Sports Patterns

### Leaderboard
- Table in card, rank numbers color-coded (gold/silver/bronze), +/- indicators
- `font-mono` for all numeric columns — scores, ranks, changes

### Stat Cards
```
bg-gray-800 rounded-lg p-3
```
- Label: `text-xs text-gray-400 uppercase tracking-wider`
- Value: `text-lg font-mono text-white font-bold`
- Detail: `text-xs text-gray-500`

### Player Cards
- Avatar (photo or initial fallback) + name + status badge
- Score breakdown with multiplier shown
- Link to detailed view

### Score Display
- Primary score: `font-mono text-2xl text-yellow-400 font-bold`
- Secondary scores: `font-mono text-lg text-white`
- Always right-aligned in tables

## Accessibility
- All interactive elements: visible `focus:ring-2 focus:ring-yellow-500` focus state
- Color is **never** the only indicator — always pair with text, icons, or patterns
- Ensure text meets WCAG AA contrast on dark backgrounds (gray-300+ on gray-900)
- Use `sr-only` labels on icon-only buttons
- Semantic HTML: `<table>` for data, `<nav>` for navigation, `<form>` with `<label>`s

## Anti-Patterns — NEVER Do These
- **Never** use light backgrounds (white, gray-50 through gray-300 as backgrounds)
- **Never** use `bg-gray-950` for cards — that's page background only
- **Never** display scores/numbers in sans-serif — always `font-mono`
- **Never** skip borders on cards — always `border border-gray-800`
- **Never** show "Loading..." text — always use skeleton placeholders
- **Never** use inline styles except for dynamic widths (comparison bars) or chart colors
- **Never** use animations longer than 500ms for UI elements
- **Never** hardcode hex colors in className — use Tailwind palette names

## File Structure
- Pages: `src/app/*/page.tsx` (each page self-contained with `'use client'` where needed)
- API routes: `src/app/api/*/route.ts`
- Shared logic: `src/lib/` — `supabase.ts` (client), `types.ts` (interfaces + constants), `scoring.ts` (calculations)
- Global styles: `src/app/globals.css` (Tailwind v4 format)
- Root layout: `src/app/layout.tsx` (nav + footer shell)
- All styling via Tailwind utility classes — no component library
