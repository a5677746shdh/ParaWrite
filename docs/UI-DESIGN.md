# ParaWrite UI Design Guide

This document defines the visual and layout conventions used across the ParaWrite web app. Theme colors can be overridden via `theme` in `config/parawrite.yaml`; the frontend applies them as CSS variables at runtime.

## Color tokens

| Token | CSS variable | Default | Usage |
|-------|--------------|---------|--------|
| primary | `--color-primary` | `#0f2b46` | Headings, primary text, icons |
| accent | `--color-accent` | `#2d7ff9` | Primary buttons, focus rings, active tabs |
| background | `--color-background` | `#f5f7fa` | Page background, secondary button hover |
| surface | `--color-surface` | `#ffffff` | Cards, panels, inputs |
| border | `--color-border` | `#d8dee9` | Borders, dividers |
| muted | `--color-muted` | `#6b7c93` | Secondary text, history source lines |
| success | `--color-success` | `#16a34a` | Copy success, confirmation messages |
| error | `--color-error` | `#dc2626` | Errors, validation failures |
| warning | `--color-warning` | `#f59e0b` | Favorite star (active) |
| alert | `--color-alert` | `#ea580c` | Strong warning: restart backend, sign out |

Tailwind classes map to these variables: `text-deepl-blue`, `bg-deepl-accent`, `text-deepl-muted`, etc.

Opacity variants on primary text use `text-deepl-blue/60`, `/70` for labels and hints.

## Typography

| Element | Classes |
|---------|---------|
| App title | `text-2xl font-bold text-deepl-blue` |
| Section / dialog title | `text-lg font-semibold text-deepl-blue` |
| Body, controls | `text-sm` |
| Source / target editor text | `text-lg leading-relaxed` |
| Stats, version, hints | `text-xs` |
| Panel section labels | `text-sm font-semibold uppercase tracking-wide` |

## Spacing

| Context | Classes |
|---------|---------|
| Page horizontal padding | `px-4` |
| Main vertical padding | `py-6` |
| Header padding | `px-4 py-4` |
| Card / pane inner padding | `p-4` |
| Pane footer | `pt-3 gap-3` |
| Button groups | `gap-2` |
| Word panel option chips | `gap-1.5` |
| Word panel alternative list | `space-y-1.5` |
| Header controls | `gap-3` |
| Major layout gaps | `gap-4` |
| Form field label to input | `gap-1` |

## Border radius

| Element | Class |
|---------|-------|
| Main cards | `rounded-2xl` |
| Modals | `rounded-xl` |
| Buttons, inputs, selects | `rounded-lg` |
| Small badges / tab pills | `rounded-md` |

## Buttons

Shared constants live in `apps/web/src/ui.ts`.

**Standard text button** — dialogs, toolbars, history pagination; horizontal padding `px-6` (`textButtonPx`):

```
rounded-lg … px-6 py-2 text-sm
```

**Primary** — filled accent:

```
rounded-lg bg-deepl-accent px-6 py-2 text-sm font-medium text-white hover:bg-deepl-accent/90
```

**Secondary** — bordered white:

```
rounded-lg border border-deepl-border bg-white px-6 hover:bg-deepl-light
```

**Compact option chip** — synonym tags in the word panel (`optionChipClass`); tighter than standard text buttons:

```
rounded-lg border border-deepl-accent/30 bg-deepl-accent/10 px-2 py-1 text-sm hover:bg-deepl-accent/20
```

Wrap chips in `flex flex-wrap gap-1.5`.

**Compact option list row** — alternative expressions in the word panel (`optionListButtonClass`):

```
w-full rounded-lg border border-deepl-border px-2 py-1.5 text-left text-sm hover:border-deepl-accent hover:bg-deepl-light
```

Stack rows with `space-y-1.5`.

**Icon button (header)** — `h-10 w-10`

**Icon button (translation footer)** — `h-[34px] w-[34px]` or `h-9 w-9` in history panel (`paneIconButtonClass` in `apps/web/src/ui.ts`)

**Destructive text** — `text-deepl-error hover:bg-deepl-error/10`

## Button icons

Button icons follow a single inline-SVG pattern. When you provide a reference file (usually under local `refer/`), apply this workflow — do **not** introduce separate icon packages, `assets/icons/`, or `components/icons/` unless explicitly requested.

### Where icons live

| Kind | Location | Examples |
|------|----------|----------|
| **UI button icons** | Inline `<svg>` inside the component that renders the button | Paste, clear, copy, speak in `Translator.tsx`; swap, settings in `Header.tsx` |
| **App / PWA raster** | `apps/web/src/assets/` or `apps/web/public/` | `app-icon.png`, favicon, manifest icons |
| **Design references** | `refer/` (gitignored, local only) | Affinity sources, Iconfont exports, drafts — **never edit these files in place** |

Shared button **shell** classes live in `apps/web/src/ui.ts` (e.g. `paneIconButtonClass`, `paneClearIconClass`, `speakActiveButtonClass`). Icon **color** comes from those classes via `currentColor`, not hard-coded fills in the SVG.

### Sizes

| Context | SVG `width` / `height` | Button shell |
|---------|------------------------|--------------|
| Translation pane footer | `16` | `paneIconButtonClass` — `h-[34px] w-[34px]` |
| Header toolbar | `18` | `h-10 w-10` (see `HeaderIcon` in `Header.tsx`) |
| History panel | `18` | `h-9 w-9` |

Keep the source `viewBox` from the reference file; only the rendered size changes.

### Inline SVG template

**Stroke icons** (Lucide-style, most footer icons):

```tsx
<svg
  width="16"
  height="16"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  strokeWidth="2"
  strokeLinecap="round"
  strokeLinejoin="round"
  aria-hidden="true"
>
  <path d="…" />
</svg>
```

**Fill icons** (Iconfont / `refer/` exports — e.g. clear brush):

```tsx
<svg
  width="16"
  height="16"
  viewBox="0 0 1024 1024"
  fill="none"
  xmlns="http://www.w3.org/2000/svg"
  aria-hidden="true"
>
  <path d="…" fill="currentColor" />
</svg>
```

Rules:

- Always `aria-hidden="true"` on decorative icons; put meaning on the `<button>` via `title` and `aria-label` (i18n keys in `apps/web/src/i18n.ts`).
- Never commit hard-coded `#000` / `fill-opacity` from reference SVGs — use `currentColor` so Tailwind text classes control hue and opacity.
- Strip Iconfont/XML boilerplate (`class`, `p-id`, `t=`, DOCTYPE); keep only `viewBox` and path data.

### Updating an icon from a reference file

1. Open the file you provide (e.g. `refer/Iconfont Clear.svg`) — **read only**; do not modify `refer/`.
2. Copy the `<path d="…">` (and `viewBox` if non-standard) into the inline `<svg>` in the target component.
3. Replace any fixed fill/stroke with `currentColor`.
4. Use the same button shell class as sibling icons in that toolbar (footer icons share `paneIconButtonClass`).
5. If the icon should look muted in one state, add a text utility on the **button** (e.g. `paneClearIconClass` = `text-deepl-blue/40`), not a different fill in the SVG.
6. Do not add duplicate `.svg` files under `src/assets/` or wrapper components unless you explicitly ask for that.

### State-specific icons

Some buttons swap icon or style by state while keeping the same shell:

| Button | Empty / idle | With content / active |
|--------|----------------|------------------------|
| Source pane action | Paste (clipboard stroke icon) | Clear (brush fill icon, `paneClearIconClass`) |
| Copy | Clipboard | Checkmark + success colors on button |
| Speak | Speaker | Active glow (`speakActiveButtonClass`) |

New icons should follow the same pattern: one button element, shared shell class, state handled with `clsx` and conditional SVG children.

## Cards and overlays

- Card: `rounded-2xl border border-deepl-border bg-deepl-surface shadow-sm`
- Modal overlay: `fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4`
- Modal content: `max-w-sm rounded-xl bg-deepl-surface p-5 shadow-xl`

## Layout

- Content max width: `max-w-7xl mx-auto`
- Translation card: two-column grid `grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)]` with 1px divider
- Three-column mode: translation + history in left column; word panel `minmax(260px, 320px)` on the right

## Word panel

- Section order: synonyms → dictionary → alternatives
- **Synonyms**: compact chips (`optionChipClass`), `flex flex-wrap gap-1.5`
- **Alternatives**: full-width compact rows (`optionListButtonClass`), `space-y-1.5`; changed phrases highlighted with `bg-amber-100`
- Close control (modal/sheet): standard text button padding (`textButtonPx`)
- Resident mode: fixed right column; modal/sheet on narrow viewports

## History panel

- Placed directly below the translation card (`mt-4`)
- Header: tab switcher (**Favorites** left, **All** right) + icon-only add-favorite button (`h-10 w-10`)
- List height grows with current page content (no fixed max-height scroll)
- Pagination footer: `h-10` prev/next buttons, page indicator `{{page}} / {{total}}`
- Page size configured via `users.history.page_size` in YAML (default 5)
- Entry: `rounded-lg border border-deepl-border bg-deepl-light/50 p-3`
- Entry text order: **target (translation) on top** in `text-deepl-blue`; **source below** in `text-deepl-muted`
- Favorite toggle: star icon, `text-deepl-warning` when active

## Forms

- Label: `text-sm font-medium text-deepl-blue/70`
- Input: `rounded-lg border border-deepl-border px-3 py-2 outline-none focus:border-deepl-accent`
- Error state: `border-deepl-error/40` or `bg-deepl-error/10 text-deepl-error`

## Selects

```
h-10 rounded-lg border border-deepl-border bg-white px-3 py-2 text-sm focus:border-deepl-accent
```

## Screenshots

Reference captures live in [`docs/snapshots/`](snapshots/). The same files are copied to `apps/web/public/screenshots/` for the PWA manifest.

| File | Layout mode | Description |
|------|-------------|-------------|
| `main-interface.jpg` | Stacked (mobile width) | Default translation view with history sign-in prompt |
| `desktop-layout.jpg` | Three-column | Wide viewport: source/target panes + resident word panel |
| `tablet-layout.jpg` | Two-column | Medium viewport without side word panel |
| `mobile-layout.jpg` | Stacked | Narrow viewport, vertical panes |
| `login-dialog.jpg` | Modal | User auth dialog (login / register tabs) |
| `synonyms-panel.jpg` | Modal / sheet | Word panel with synonyms, dictionary, and alternatives |

Responsive breakpoints (`app.layout` in YAML):

- **≥ `three_column_min_width` (default 1280px):** translation card + resident word panel sidebar
- **≥ `two_column_min_width` (default 768px):** side-by-side source/target; word panel as modal
- **Below 768px:** stacked panes; word panel as bottom sheet
