# Availability, Per-Variety Pricing & Hatching-Eggs Disclaimer — Design

**Date:** 2026-06-08
**Status:** Approved for planning

## Overview

Three changes to the Oakshade Acres site, each reflected on both the public Astro
site and the local Express admin app:

1. **Availability** — replace the seasonal Spring/Fall model with three status
   buckets: **Available**, **Waitlist**, **Unavailable**.
2. **Per-variety pricing** — add a price to each breed variety, shown in the breed
   gallery's info area for the currently selected variety.
3. **Hatching-eggs disclaimer** — a new standalone, admin-editable callout placed
   above the "How to Preorder" section, with a show/hide toggle.

## Goals

- The farm owner edits all three features through the admin UI; no code edits.
- Existing breed content migrates cleanly with no broken build.
- Public styling stays consistent with the current rustic "almanac ledger" design.

## Non-goals

- No changes to the contact form, FAQs, image upload/crop pipeline, deploy flow,
  followups, or auth.
- The nav "Availability" link continues to point at `#schedule`.
- No per-variety pricing on the availability section (price lives only in the
  breed gallery section, per request).

---

## Data-model decision: varieties become objects

Varieties change from `string[]` to `Array<{ name: string, price?: string }>`.
This is the single source of truth so a price travels with its variety through
renames. Image tags (`image.variety`) and the new availability lists continue to
reference varieties **by name** (free text), so they are unaffected.

The Astro schema accepts **both** legacy strings and new objects and normalizes to
`{ name, price }`, so the build never breaks during migration.

### `src/content.config.ts`

```ts
varieties: z.array(
  z.union([
    z.string().transform((s) => ({ name: s })),
    z.object({ name: z.string(), price: z.string().optional() }),
  ])
).default([]),
available: z.array(z.string()).default([]),
waitlist: z.array(z.string()).default([]),
unavailable: z.array(z.string()).default([]),
// remove: spring, fall
```

### `src/content/site.json`

**`schedule` section** — drop `springLabel` / `fallLabel`, add three labels:

```jsonc
"schedule": {
  "label": "What's Available",
  "title": "Current Availability",
  "sub": "...",                       // kept, editable
  "availableLabel": "✅ Available",
  "waitlistLabel": "⏳ Waitlist",
  "unavailableLabel": "Unavailable",
  "footerNote": "..."                 // kept, editable
}
```

**New `disclaimer` section:**

```jsonc
"disclaimer": {
  "enabled": true,
  "heading": "About Hatching Eggs",
  "body": "Placeholder text — edit in the admin. (e.g. hatch rates are never guaranteed; eggs are fragile and shipping carries inherent risk.)"
}
```

---

## Feature 1 — Availability (Available / Waitlist / Unavailable)

### Public — `src/components/Schedule.astro`

- Props change: replace `springLabel`, `fallLabel`, and per-breed `spring`/`fall`
  with `availableLabel`, `waitlistLabel`, `unavailableLabel`, and per-breed
  `available[]`, `waitlist[]`, `unavailable[]`.
- The ledger table goes from 3 columns to 4: **Breed · Available · Waitlist ·
  Unavailable**.
- Each status column reuses the existing list/marker markup; markers are
  color-coded by status (green / amber / muted). Empty buckets render a quiet
  "—" (reusing `.schedule-empty`).
- Mobile: existing responsive reflow stacks each breed into a card; the three
  status sub-blocks stack with their status tags shown (reusing
  `.schedule-season-tag`, renamed conceptually to status tags).

### CSS — `src/styles/global.css`

- `.schedule-row` grid: 3 → 4 columns (e.g.
  `minmax(0,2.4fr) minmax(0,3fr) minmax(0,3fr) minmax(0,3fr)`).
- Add status color hooks reusing existing palette where possible:
  - available → a green (new small token, e.g. `--color-available`)
  - waitlist → amber (`--color-accent-2` or a new amber token)
  - unavailable → muted (`--color-ink-3`), optionally with reduced opacity.
- Add `.schedule-marker.available/.waitlist/.unavailable`,
  `.schedule-status-tag.available/.waitlist/.unavailable`, and head-cell colors
  to replace the `.season-spring/.season-fall` rules.
- Keep the existing `@media (max-width: 768px)` reflow, updated for 3 status cells.

### Admin — `admin/public/app.js`

- **Breed editor:** replace the two "Availability (Spring/Fall)" cards with three
  cards — Available / Waitlist / Unavailable — each a `chipListEditor` writing to
  `breed.available` / `breed.waitlist` / `breed.unavailable`.
- **Schedule tab:** replace the two label fields with three
  (`availableLabel`, `waitlistLabel`, `unavailableLabel`); update the preview
  matrix from 2 to 3 columns reading the new arrays.

### Admin — `admin/server.js` `writeBreed`

- Replace `spring`/`fall` output with `available`/`waitlist`/`unavailable`
  (string arrays).
- `varieties` output: map to `{ name, price? }` objects (accept incoming strings
  or objects; coerce to objects; drop empty `price`).

### Public — `src/pages/index.astro`

- `scheduleBreeds` maps `name, available, waitlist, unavailable`.
- `<Schedule>` props updated to pass the three labels + arrays.

---

## Feature 2 — Per-variety pricing in the breed gallery

### Public — `src/components/Breeds.astro`

- `Breed.varieties` interface → `Array<{ name: string; price?: string }>`.
- Update every string usage of a variety to use `.name`:
  - `initialFallbackName` (`firstBreed.varieties[0].name`)
  - gallery fallback label (`b.varieties[slide].name`)
  - `currentVariety` derivation
  - variety-pill rendering (`v.name`; image match `im.variety === v.name`)
  - `slideCount` (length unaffected)
- **New price display:** a `.breed-price` element in the breed **info column**
  (data hooks `data-breed-price`, `data-breed-price-variety`,
  `data-breed-price-amount`). The inline script updates it whenever the active
  variety changes (pill click, arrow, dot, swipe, tab switch):
  - active variety has a price → show `"<variety> — <price>"` with the price text
    shown verbatim (free text, so the owner can write "$25", "$25/chick",
    "Starting at $20", etc.). A small "per chick" caption label sits above/beside
    the amount so context is clear even for a bare number.
  - active variety has no price → hide the element (or show a subtle
    "Contact for pricing"; default: hide).
  - breed has no varieties → element stays hidden.

### Admin — `admin/public/app.js`

- Replace the Varieties `chipListEditor` with a **variety + price row editor**
  (`varietyListEditor`): each row has a name input and a price input, plus
  add/remove. On change, write `breed.varieties` as `{ name, price }` objects.
- `applyVarietyChangeToImages` adapted to operate on variety **names** derived
  from the objects (rename re-tags matching photos; delete untags), preserving
  the `price` on surviving entries.
- `renderImageManager` receives `varieties.map(v => v.name)` for its tag dropdown.
- Breed list meta count uses `(b.varieties || []).length` (unchanged).

### Public — `src/pages/index.astro`

- `breedOptions` builder uses `v.name` instead of the raw string.

---

## Feature 3 — Hatching-eggs disclaimer callout

### Public — `src/components/Disclaimer.astro` (new)

- Props: `enabled`, `heading`, `body`.
- Renders nothing when `enabled` is false.
- Styled as a standout callout (bordered/tinted block), distinct from a plain
  paragraph; consistent with the rustic palette. Body supports line breaks.

### Public — `src/pages/index.astro`

- Import and render `<Disclaimer>` **between `<Schedule>` and `<Order>`**, passing
  `site.disclaimer.*`.

### Admin — `admin/public/app.js`

- Add a `{ id: 'disclaimer', label: 'Disclaimer' }` tab (placed after Schedule).
- `renderDisclaimerTab`: heading text input, body textarea, and an enabled
  checkbox; all save via `saveSection('disclaimer', ...)`.

### Admin — `admin/server.js`

- No route changes needed: the generic `GET/PUT /api/site/:section` already
  handles a new `disclaimer` section.

---

## Migration of existing content

Four breed markdown files (`bantam-cochins`, `bantam-ee`, `orpingtons`, `polish`):

- `varieties`: convert each string to `{ name: <string> }` (no price initially).
- `available`: set to the de-duplicated union of the old `spring` + `fall` lists.
- `waitlist`: `[]`. `unavailable`: `[]`.
- Remove `spring` / `fall` keys.

`site.json`: update the `schedule` section keys as above and add the `disclaimer`
section. The owner refines availability buckets, prices, and disclaimer wording in
the admin afterward.

Because the schema's `varieties` union also accepts legacy strings, the build is
safe even if a file is migrated out of order.

---

## File-by-file change summary

| File | Change |
|------|--------|
| `src/content.config.ts` | varieties→objects (union/normalize); replace spring/fall with available/waitlist/unavailable |
| `src/content/site.json` | schedule labels (3); add `disclaimer`; migrate breeds' frontmatter (separate files) |
| `src/content/breeds/*.md` (×4) | migrate varieties + availability buckets |
| `src/components/Schedule.astro` | 4-column status table |
| `src/components/Breeds.astro` | variety `.name` usage + per-variety price display |
| `src/components/Disclaimer.astro` | **new** callout component |
| `src/pages/index.astro` | scheduleBreeds mapping, Schedule props, breedOptions `.name`, render Disclaimer |
| `src/styles/global.css` | status colors/markers/tags; 4-col grid; disclaimer callout styles |
| `admin/server.js` | `writeBreed`: varieties→objects, available/waitlist/unavailable |
| `admin/public/app.js` | variety+price editor; 3 availability cards; schedule tab 3 labels + matrix; new Disclaimer tab |
| `admin/public/styles.css` | minor styles for variety+price rows / disclaimer tab if needed |

## Edge cases

- Variety with empty price → no price shown publicly.
- Breed with zero varieties → no price line; gallery falls back to breed name.
- Availability bucket empty → "—" placeholder.
- Renaming a variety in admin → its tagged photos follow the rename; price retained.
- `disclaimer.enabled = false` → component renders nothing.
- Legacy frontmatter (string varieties / leftover spring-fall) → schema normalizes
  varieties; `writeBreed` drops spring/fall on next save.

## Verification

- `npm run build` succeeds with migrated content (schema accepts both shapes).
- Public: availability shows 3 status columns; breed gallery shows the selected
  variety's price; disclaimer appears above Order and hides when disabled.
- Admin: editing each field saves and round-trips through the markdown/JSON;
  variety rename re-tags photos; deploy still commits/pushes.
