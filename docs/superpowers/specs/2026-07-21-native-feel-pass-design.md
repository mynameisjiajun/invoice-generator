# Native-Feel UX Pass — Design

Date: 2026-07-21
Goal: make the invoice PWA feel like a true native mobile app rather than a
web page, without changing what any screen does.

## Approved direction

- **Bottom tab bar**, 5 slots with a raised center "+" for New Invoice:
  `Invoices · Quotes · ⊕ · Clients · Settings`.
- **Stats** moves out of primary nav to an icon in the top app bar.
- **Full pass**: bottom tabs + in-app confirm sheets (replacing browser
  `confirm()`) + skeleton loaders + press/feedback polish.

## Components

### TopBar (new, `src/components/TopBar.tsx`)
Slim sticky app bar replacing the brand/switcher half of the old nav.
- Left: small camera glyph + active business name. If the account has >1
  non-archived business, tapping it opens a business-switch sheet; otherwise
  it's static text.
- Right: a Stats icon button (→ `/stats`).
- Frosted treatment (`--nav-bg` + backdrop blur), `env(safe-area-inset-top)`.
- Hidden on `/login` and `/quote/*` (same rule as today's nav).

### BottomNav (new, `src/components/BottomNav.tsx`)
Fixed bottom tab bar, the primary navigation.
- Slots: Invoices (`/`), Quotes (`/quotes`), **center ⊕** (`/invoices/new`,
  a raised circular accent button), Clients (`/customers`), Settings
  (`/settings`).
- Each tab: icon + tiny label; active tab in accent color, inactive tertiary.
- `position: fixed; bottom: 0`, frosted, `padding-bottom:
  env(safe-area-inset-bottom)`, tap targets ≥ 56px.
- Hidden on `/login` and `/quote/*`.

### ConfirmSheet (new, `src/components/ConfirmSheet.tsx`)
Reusable bottom sheet replacing `confirm()`.
- Props: `open`, `title`, `message`, `confirmLabel`, `danger?`, `onConfirm`,
  `onCancel`. Slides up over a dimmed backdrop; Cancel / Confirm buttons.
- Replaces the 3 destructive `confirm()` calls: delete invoice (Dashboard &
  InvoiceDetail), archive business & delete preset (Settings). The WhatsApp
  landline "try anyway?" `confirm()` also becomes a sheet for consistency.

### Skeletons (`.skeleton` in globals.css + inline use)
Replace every "Loading…" text with shimmer placeholders that match the
shape of the content that's about to load (stat cards, list rows, form).
Reuses the existing `shimmer` keyframe.

## Layout / relocation

- `layout.tsx`: render `<TopBar />` then `{children}` then `<BottomNav />`;
  retire `<NavBar />`.
- **Sign out** moves from the nav into a button at the bottom of Settings.
- `.page-container`: keep bottom padding clearing the tab bar; add top
  clearance for the app bar.

## Native-feel polish (globals.css)

- Guard all `:hover` styles behind `@media (hover: hover)` so touch devices
  don't get stuck hover states after a tap.
- `-webkit-touch-callout: none; user-select: none` on chrome (nav, buttons,
  labels) — never on inputs, invoice content, or anything copyable.
- Consistent press feedback: `:active { transform: scale(0.97) }` on
  tappable chrome; tab presses feel immediate.

## Non-goals

- No pull-to-refresh, no route-level view-transitions this pass (possible
  later).
- No change to any screen's data, flows, or business logic.
- Desktop keeps the same layout system; the bottom bar simply centers to the
  content max-width on wide screens.
