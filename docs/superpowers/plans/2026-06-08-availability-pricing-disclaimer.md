# Availability, Per-Variety Pricing & Hatching-Eggs Disclaimer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the seasonal Spring/Fall availability model with Available / Waitlist / Unavailable buckets, add a free-text price to each breed variety shown in the gallery, and add an admin-editable hatching-eggs disclaimer callout — all editable through the local admin app.

**Architecture:** Astro 5 static site reads breed markdown (content collection) + `site.json`. A separate Express admin (`admin/`) reads/writes those same files and deploys via git. Varieties become `{ name, price? }` objects with a back-compatible schema (accepts legacy strings) so the build never breaks mid-migration. Public-site changes land first (verified by `npm run build`), then the admin (verified by `node --check` + a manual round-trip).

**Tech Stack:** Astro 5, vanilla CSS (custom `oklch` token palette in `src/styles/global.css`), Express + gray-matter (admin), no test runner.

**Testing approach:** This project has **no unit-test harness** (confirmed: no vitest/jest/playwright config, no `test` script). The verification gate for every public-site task is `npm run build` — Astro validates the content-collection schema and renders every page, so a bad prop or runtime error fails the build. Admin tasks verify with `node --check <file>` (syntax) plus a documented manual round-trip. Do **not** add a test framework (YAGNI).

**Branching & migration notes:**
- The repo starts on `main`. **Create a feature branch before the first commit** (Task 0).
- Migration scripts use `admin/node_modules/gray-matter` (confirmed installed). If it ever reports missing, run `cd admin && npm install` first.
- The admin app is updated *after* the public site (Tasks 7–10). Do not use the admin to save a breed until Task 7 is done, or `writeBreed` will stringify the new variety objects.

---

## File Structure

| File | Responsibility | Tasks |
|------|----------------|-------|
| `src/content.config.ts` | Breed schema: add availability buckets; varieties→objects; remove spring/fall | 1, 5, 6 |
| `src/content/breeds/*.md` (×4) | Migrate availability + varieties; drop spring/fall | 2, 5, 6 |
| `src/content/site.json` | schedule labels; new `disclaimer` section | 3, 4, 8 |
| `src/components/Schedule.astro` | 4-column status availability table | 3 |
| `src/components/Disclaimer.astro` | **new** callout component | 4 |
| `src/components/Breeds.astro` | variety `.name` usage + per-variety price display | 5 |
| `src/pages/index.astro` | schedule mapping/props, Disclaimer render, breedOptions `.name` | 3, 4, 5 |
| `src/styles/global.css` | status colors/markers; 4-col grid; disclaimer + price styles | 3, 4, 5 |
| `admin/server.js` | `writeBreed`: buckets + variety objects | 7 |
| `admin/public/app.js` | 3 availability cards; schedule tab; variety+price editor; disclaimer tab | 8, 9, 10 |
| `admin/public/styles.css` | variety-row styling | 9 |

---

## Task 0: Create feature branch

- [ ] **Step 1: Branch off main**

Run:
```bash
cd /home/john/Work/oakshade && git checkout -b feature/availability-pricing-disclaimer
```
Expected: `Switched to a new branch 'feature/availability-pricing-disclaimer'`

- [ ] **Step 2: Confirm a clean build baseline**

Run: `npm run build`
Expected: build completes with no errors (the current site builds).

---

## Task 1: Schema — add availability buckets (additive)

**Files:**
- Modify: `src/content.config.ts`

Add the three string-array buckets. Keep `spring`/`fall` and keep `varieties` as strings for now — this keeps the build green while content and components are migrated incrementally.

- [ ] **Step 1: Add the buckets to the breed schema**

In `src/content.config.ts`, the schema currently ends:
```ts
    spring: z.array(z.string()).default([]),
    fall: z.array(z.string()).default([]),
  }),
});
```
Change to:
```ts
    spring: z.array(z.string()).default([]),
    fall: z.array(z.string()).default([]),
    available: z.array(z.string()).default([]),
    waitlist: z.array(z.string()).default([]),
    unavailable: z.array(z.string()).default([]),
  }),
});
```

- [ ] **Step 2: Verify the build still passes**

Run: `npm run build`
Expected: build succeeds. New fields default to `[]` since no markdown supplies them yet.

- [ ] **Step 3: Commit**

```bash
git add src/content.config.ts
git commit -m "Add available/waitlist/unavailable buckets to breed schema"
```

---

## Task 2: Migrate breed availability data

**Files:**
- Modify: `src/content/breeds/bantam-cochins.md`, `bantam-ee.md`, `orpingtons.md`, `polish.md` (via script)

Set each breed's `available` to the de-duplicated union of its old `spring` + `fall` lists. Leave `waitlist`/`unavailable` empty. Keep `spring`/`fall` in the files for now (removed in Task 6).

- [ ] **Step 1: Run the migration script**

Run from the project root:
```bash
node -e '
const fs=require("fs"),path=require("path");
const matter=require("./admin/node_modules/gray-matter");
const dir="src/content/breeds";
for(const f of fs.readdirSync(dir).filter(x=>x.endsWith(".md"))){
  const fp=path.join(dir,f);
  const g=matter(fs.readFileSync(fp,"utf8"));
  const d=g.data;
  const union=[...new Set([...(d.spring||[]),...(d.fall||[])])];
  d.available=union;
  d.waitlist=Array.isArray(d.waitlist)?d.waitlist:[];
  d.unavailable=Array.isArray(d.unavailable)?d.unavailable:[];
  fs.writeFileSync(fp, matter.stringify(g.content||"", d));
  console.log("migrated",f,"-> available:",union.length);
}
'
```
Expected: four `migrated ... -> available: N` lines.

- [ ] **Step 2: Spot-check one file**

Run: `grep -A12 "^available:" src/content/breeds/orpingtons.md`
Expected: an `available:` list containing the former Spring + Fall varieties, plus empty `waitlist:` / `unavailable:` keys.

- [ ] **Step 3: Verify the build still passes**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/content/breeds/*.md
git commit -m "Migrate breed availability to available bucket (union of spring+fall)"
```

---

## Task 3: Public availability — 4-column status table

**Files:**
- Modify: `src/components/Schedule.astro` (full rewrite)
- Modify: `src/pages/index.astro` (scheduleBreeds mapping + Schedule props)
- Modify: `src/content/site.json` (add three status labels)
- Modify: `src/styles/global.css` (status colors, 4-col grid)

- [ ] **Step 1: Add the three status labels to `site.json`**

In `src/content/site.json`, the `schedule` object currently is:
```json
  "schedule": {
    "label": "What's Available",
    "title": "Hatch Schedule & Availability",
    "sub": "Our hatch schedule is updated regularly. Reach out on Facebook to claim your spot — popular breeds go fast!",
    "springLabel": "🌱 Spring 2026",
    "fallLabel": "🍂 Fall 2026",
    "footerNote": "✉️ Reach out on Facebook or use the contact form to reserve your spot — popular varieties go fast!"
  },
```
Replace with (keeps `springLabel`/`fallLabel` for now — the admin still reads them until Task 8 — and adds the three new labels):
```json
  "schedule": {
    "label": "What's Available",
    "title": "Current Availability",
    "sub": "Our availability is updated regularly. Reach out on Facebook to claim your spot — popular breeds go fast!",
    "springLabel": "🌱 Spring 2026",
    "fallLabel": "🍂 Fall 2026",
    "availableLabel": "✅ Available",
    "waitlistLabel": "⏳ Waitlist",
    "unavailableLabel": "Unavailable",
    "footerNote": "✉️ Reach out on Facebook or use the contact form to reserve your spot — popular varieties go fast!"
  },
```

- [ ] **Step 2: Rewrite `Schedule.astro`**

Replace the entire contents of `src/components/Schedule.astro` with:
```astro
---
interface Breed { name: string; available: string[]; waitlist: string[]; unavailable: string[] }
interface Props {
  label: string;
  title: string;
  sub: string;
  availableLabel: string;
  waitlistLabel: string;
  unavailableLabel: string;
  footerNote: string;
  breeds: Breed[];
}
const { label, title, sub, availableLabel, waitlistLabel, unavailableLabel, footerNote, breeds } = Astro.props;

const columns = [
  { key: 'available', label: availableLabel, cls: 'available' },
  { key: 'waitlist', label: waitlistLabel, cls: 'waitlist' },
  { key: 'unavailable', label: unavailableLabel, cls: 'unavailable' },
] as const;
---
<section id="schedule" class="schedule">
  <div class="schedule-inner">
    <div class="sec-head reveal">
      <span class="eyebrow">{label}</span>
      <h2>{title}</h2>
      <p class="sub">{sub}</p>
    </div>

    <div class="schedule-table stagger">
      <div class="schedule-row head" role="row">
        <div>Breed</div>
        {columns.map((c) => (
          <div class={`status-${c.cls}`}>{c.label}</div>
        ))}
      </div>
      {breeds.map((b) => (
        <div class="schedule-row">
          <div class="schedule-cell schedule-cell-breed">{b.name}</div>
          {columns.map((c) => (
            <div class="schedule-cell schedule-cell-status">
              <div class={`schedule-status-tag ${c.cls}`}>{c.label}</div>
              {b[c.key].length === 0 ? (
                <span class="schedule-empty">—</span>
              ) : (
                <ul class="schedule-list">
                  {b[c.key].map((v) => (
                    <li><span class={`schedule-marker ${c.cls}`}></span>{v}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
    <p class="schedule-footnote">{footerNote}</p>
  </div>
</section>
```

- [ ] **Step 3: Update `index.astro` mapping and props**

In `src/pages/index.astro`, the `scheduleBreeds` block currently is:
```ts
const scheduleBreeds = breeds.map((b) => ({
  name: b.name,
  spring: b.spring,
  fall: b.fall,
}));
```
Change to:
```ts
const scheduleBreeds = breeds.map((b) => ({
  name: b.name,
  available: b.available,
  waitlist: b.waitlist,
  unavailable: b.unavailable,
}));
```
And the `<Schedule .../>` element currently is:
```astro
  <Schedule
    label={site.schedule.label}
    title={site.schedule.title}
    sub={site.schedule.sub}
    springLabel={site.schedule.springLabel}
    fallLabel={site.schedule.fallLabel}
    footerNote={site.schedule.footerNote}
    breeds={scheduleBreeds}
  />
```
Change to:
```astro
  <Schedule
    label={site.schedule.label}
    title={site.schedule.title}
    sub={site.schedule.sub}
    availableLabel={site.schedule.availableLabel}
    waitlistLabel={site.schedule.waitlistLabel}
    unavailableLabel={site.schedule.unavailableLabel}
    footerNote={site.schedule.footerNote}
    breeds={scheduleBreeds}
  />
```

- [ ] **Step 4: Update the schedule CSS**

In `src/styles/global.css`:

(a) Add status color tokens. Find the `--color-warn:` line in `:root` (around line 24):
```css
  --color-warn: oklch(48% 0.18 28);
```
Add directly after it:
```css
  --color-available: oklch(52% 0.12 145);
  --color-waitlist: oklch(62% 0.13 70);
  --color-unavailable: oklch(54% 0.018 60);
```

(b) Change the row grid from 3 to 4 columns. Find:
```css
.schedule-row {
  display: grid;
  grid-template-columns: minmax(0, 3fr) minmax(0, 4fr) minmax(0, 4fr);
  border-bottom: 1px solid var(--color-rule);
}
```
Change the `grid-template-columns` line to:
```css
  grid-template-columns: minmax(0, 2.4fr) minmax(0, 3fr) minmax(0, 3fr) minmax(0, 3fr);
```

(c) Replace the season head-cell color rules. Find:
```css
.schedule-row.head .season-spring { color: var(--color-accent); padding-left: var(--space-4); border-left: 1px solid var(--color-rule); }
.schedule-row.head .season-fall   { color: var(--color-accent-2); padding-left: var(--space-4); border-left: 1px solid var(--color-rule); }
```
Replace with:
```css
.schedule-row.head .status-available,
.schedule-row.head .status-waitlist,
.schedule-row.head .status-unavailable { padding-left: var(--space-4); border-left: 1px solid var(--color-rule); }
.schedule-row.head .status-available { color: var(--color-available); }
.schedule-row.head .status-waitlist { color: var(--color-waitlist); }
.schedule-row.head .status-unavailable { color: var(--color-unavailable); }
```

(d) Rename the cell class and markers. Find:
```css
.schedule-cell-season {
  padding-left: var(--space-4);
  border-left: 1px solid var(--color-rule);
}
```
Replace with:
```css
.schedule-cell-status {
  padding-left: var(--space-4);
  border-left: 1px solid var(--color-rule);
}
```
Then find:
```css
.schedule-marker.spring { background: var(--color-accent); }
.schedule-marker.fall { background: var(--color-accent-2); }
```
Replace with:
```css
.schedule-marker.available { background: var(--color-available); }
.schedule-marker.waitlist { background: var(--color-waitlist); }
.schedule-marker.unavailable { background: var(--color-unavailable); }
```

(e) Replace the season tag rules. Find:
```css
.schedule-season-tag {
  display: none;
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  margin-bottom: var(--space-3);
}
.schedule-season-tag.spring { color: var(--color-accent); }
.schedule-season-tag.fall { color: var(--color-accent-2); }
```
Replace with:
```css
.schedule-status-tag {
  display: none;
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  margin-bottom: var(--space-3);
}
.schedule-status-tag.available { color: var(--color-available); }
.schedule-status-tag.waitlist { color: var(--color-waitlist); }
.schedule-status-tag.unavailable { color: var(--color-unavailable); }
```

(f) Update the mobile reflow rules. Find:
```css
  .schedule-cell-season {
    padding-left: 0;
    border-left: none;
    padding-top: var(--space-3);
    border-top: 1px solid var(--color-rule);
  }
```
Replace `.schedule-cell-season` with `.schedule-cell-status`:
```css
  .schedule-cell-status {
    padding-left: 0;
    border-left: none;
    padding-top: var(--space-3);
    border-top: 1px solid var(--color-rule);
  }
```
Then find:
```css
  .schedule-season-tag { display: block; }
```
Replace with:
```css
  .schedule-status-tag { display: block; }
```

- [ ] **Step 5: Verify the build and check the rendered markup**

Run: `npm run build`
Expected: build succeeds.

Run: `grep -o "schedule-status-tag [a-z]*" dist/index.html | sort -u`
Expected: lines for `available`, `unavailable`, `waitlist` — confirming the 3 status columns render.

- [ ] **Step 6: Commit**

```bash
git add src/components/Schedule.astro src/pages/index.astro src/content/site.json src/styles/global.css
git commit -m "Replace seasonal schedule with Available/Waitlist/Unavailable status table"
```

---

## Task 4: Hatching-eggs disclaimer callout

**Files:**
- Create: `src/components/Disclaimer.astro`
- Modify: `src/content/site.json` (add `disclaimer` section)
- Modify: `src/pages/index.astro` (import + render between Schedule and Order)
- Modify: `src/styles/global.css` (callout styles)

- [ ] **Step 1: Add the `disclaimer` section to `site.json`**

In `src/content/site.json`, find the `schedule` object's closing `},` and the `order` object that follows it:
```json
    "footerNote": "✉️ Reach out on Facebook or use the contact form to reserve your spot — popular varieties go fast!"
  },
  "order": {
```
Insert a new `disclaimer` block between them:
```json
    "footerNote": "✉️ Reach out on Facebook or use the contact form to reserve your spot — popular varieties go fast!"
  },
  "disclaimer": {
    "enabled": true,
    "heading": "About Hatching Eggs",
    "body": "Hatching eggs are sold as-is — hatch rates depend on your incubator, handling, and shipping, and can never be guaranteed. Eggs are fragile and shipping carries inherent risk. Please reach out with any questions before ordering."
  },
  "order": {
```

- [ ] **Step 2: Create `Disclaimer.astro`**

Create `src/components/Disclaimer.astro` with:
```astro
---
interface Props {
  enabled: boolean;
  heading: string;
  body: string;
}
const { enabled, heading, body } = Astro.props;
---
{enabled && (
  <section class="disclaimer reveal">
    <div class="disclaimer-inner">
      <div class="disclaimer-card">
        {heading && <h3 class="disclaimer-heading">{heading}</h3>}
        <p class="disclaimer-body">{body}</p>
      </div>
    </div>
  </section>
)}
```

- [ ] **Step 3: Import and render in `index.astro`**

In `src/pages/index.astro`, add the import alongside the others (after the `Schedule` import):
```ts
import Schedule from '../components/Schedule.astro';
import Disclaimer from '../components/Disclaimer.astro';
```
Then, in the template, the `<Schedule .../>` element is immediately followed by `<Order .../>`. Insert the `<Disclaimer>` between them:
```astro
    breeds={scheduleBreeds}
  />
  <Disclaimer
    enabled={site.disclaimer.enabled}
    heading={site.disclaimer.heading}
    body={site.disclaimer.body}
  />
  <Order
```

- [ ] **Step 4: Add disclaimer styles**

In `src/styles/global.css`, find the `/* === Order === */` comment block header:
```css
/* ============================================
 * Order
 * ============================================ */
```
Insert this block immediately **before** it:
```css
/* ============================================
 * Disclaimer callout
 * ============================================ */

.disclaimer {
  padding: var(--space-7) 0;
  border-bottom: 1px solid var(--color-rule);
}
.disclaimer-inner {
  max-width: var(--container);
  margin: 0 auto;
  padding: 0 var(--space-5);
}
.disclaimer-card {
  border: 1px solid var(--color-accent-soft);
  border-left: 3px solid var(--color-accent);
  background: var(--color-accent-faint);
  border-radius: var(--radius-sm);
  padding: var(--space-5) var(--space-6);
}
.disclaimer-heading {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 0.16em;
  color: var(--color-accent-deep);
  margin-bottom: var(--space-3);
}
.disclaimer-body {
  color: var(--color-ink-2);
  font-size: var(--text-base);
  line-height: 1.65;
  white-space: pre-line;
  max-width: 70ch;
}

```

- [ ] **Step 5: Verify the build and that the callout renders**

Run: `npm run build`
Expected: build succeeds.

Run: `grep -c "disclaimer-card" dist/index.html`
Expected: `1`.

- [ ] **Step 6: Commit**

```bash
git add src/components/Disclaimer.astro src/pages/index.astro src/content/site.json src/styles/global.css
git commit -m "Add admin-editable hatching-eggs disclaimer callout above Order section"
```

---

## Task 5: Per-variety pricing

**Files:**
- Modify: `src/content.config.ts` (varieties → objects, back-compatible)
- Modify: `src/content/breeds/*.md` (varieties → objects, via script)
- Modify: `src/components/Breeds.astro` (`.name` usage + price display)
- Modify: `src/pages/index.astro` (breedOptions `.name`)
- Modify: `src/styles/global.css` (price styles)

These land together because changing the variety shape touches the schema and every consumer at once.

- [ ] **Step 1: Make the schema accept variety objects (and legacy strings)**

In `src/content.config.ts`, find:
```ts
    varieties: z.array(z.string()).default([]),
```
Replace with:
```ts
    varieties: z
      .array(
        z.union([
          z.string().transform((s) => ({ name: s })),
          z.object({ name: z.string(), price: z.string().optional() }),
        ])
      )
      .default([]),
```

- [ ] **Step 2: Migrate the markdown varieties to objects**

Run from the project root:
```bash
node -e '
const fs=require("fs"),path=require("path");
const matter=require("./admin/node_modules/gray-matter");
const dir="src/content/breeds";
for(const f of fs.readdirSync(dir).filter(x=>x.endsWith(".md"))){
  const fp=path.join(dir,f);
  const g=matter(fs.readFileSync(fp,"utf8"));
  g.data.varieties=(g.data.varieties||[]).map(v=> typeof v==="string"?{name:v}:v);
  fs.writeFileSync(fp, matter.stringify(g.content||"", g.data));
  console.log("migrated varieties",f);
}
'
```
Expected: four `migrated varieties ...` lines.

Run: `grep -A4 "^varieties:" src/content/breeds/polish.md`
Expected: list entries shaped like `- name: <variety>` (objects), not bare strings.

- [ ] **Step 3: Update `Breeds.astro` interface and `.name` usages**

In `src/components/Breeds.astro`:

(a) The interface line:
```ts
  varieties: string[];
```
Change to:
```ts
  varieties: { name: string; price?: string }[];
```

(b) The `initialFallbackName` const:
```ts
const initialFallbackName = firstBreed && !firstImage
  ? `${firstBreed.varieties[0] ?? ''} ${firstBreed.name}`.trim()
  : '';
```
Change the inner expression to use `.name`:
```ts
const initialFallbackName = firstBreed && !firstImage
  ? `${firstBreed.varieties[0]?.name ?? ''} ${firstBreed.name}`.trim()
  : '';
```

(c) In the inline `<script>`, the gallery fallback label line:
```js
        const label = b.varieties.length ? b.varieties[slide] : b.name;
```
Change to:
```js
        const label = b.varieties.length ? (b.varieties[slide]?.name ?? b.name) : b.name;
```

(d) In `renderVarietyPills`, the `currentVariety` line:
```js
      const currentVariety = hasImage ? (b.images[slide]?.variety || null) : (b.varieties[slide] || null);
```
Change to:
```js
      const currentVariety = hasImage ? (b.images[slide]?.variety || null) : (b.varieties[slide]?.name || null);
```

(e) Still in `renderVarietyPills`, the `forEach` body references the variety as a string. Current:
```js
      b.varieties.forEach((v, i) => {
        const pill = document.createElement('button');
        pill.type = 'button';
        pill.textContent = v;

        if (hasImage) {
          const firstMatch = b.images.findIndex((im) => im.variety === v);
```
Change the two references (`v` → `v.name`):
```js
      b.varieties.forEach((v, i) => {
        const pill = document.createElement('button');
        pill.type = 'button';
        pill.textContent = v.name;

        if (hasImage) {
          const firstMatch = b.images.findIndex((im) => im.variety === v.name);
```

- [ ] **Step 4: Add the price element to the breed info markup**

In `src/components/Breeds.astro`, find the breed-info block:
```astro
      <div class="breed-info">
        <span class="breed-specialty" data-breed-specialty style="display:none">★ Our Specialty</span>
        <h3 data-breed-name></h3>
        <p class="breed-desc" data-breed-desc></p>
        <div class="breed-traits" data-breed-traits></div>
      </div>
```
Insert the price element between the `<h3>` and the description `<p>`:
```astro
      <div class="breed-info">
        <span class="breed-specialty" data-breed-specialty style="display:none">★ Our Specialty</span>
        <h3 data-breed-name></h3>
        <div class="breed-price" data-breed-price style="display:none">
          <span class="breed-price-caption">Price per chick</span>
          <span class="breed-price-row">
            <span class="breed-price-variety" data-breed-price-variety></span>
            <span class="breed-price-amount" data-breed-price-amount></span>
          </span>
        </div>
        <p class="breed-desc" data-breed-desc></p>
        <div class="breed-traits" data-breed-traits></div>
      </div>
```

- [ ] **Step 5: Wire up the price in the script**

In the inline `<script>` of `src/components/Breeds.astro`:

(a) Add element refs. Find:
```js
    const counterEl = document.querySelector('[data-breed-img-counter]');
    const dotsEl = document.querySelector('[data-breed-dots]');
```
Insert after them:
```js
    const priceEl = document.querySelector('[data-breed-price]');
    const priceVarietyEl = document.querySelector('[data-breed-price-variety]');
    const priceAmountEl = document.querySelector('[data-breed-price-amount]');
```

(b) Add a `renderPrice` function. Find the start of `renderVarietyPills`:
```js
    function renderVarietyPills() {
```
Insert this function immediately **before** it:
```js
    function renderPrice() {
      const b = current();
      const hasImage = b.images.length > 0;
      const currentName = hasImage ? (b.images[slide]?.variety || null) : (b.varieties[slide]?.name || null);
      const match = currentName ? b.varieties.find((v) => v.name === currentName) : null;
      if (match && match.price) {
        priceVarietyEl.textContent = match.name;
        priceAmountEl.textContent = match.price;
        priceEl.style.display = 'flex';
      } else {
        priceEl.style.display = 'none';
      }
    }

```

(c) Call it whenever the gallery re-renders. Find the end of `renderGallery` — the closing of the `dotsEl` population block:
```js
      dotsEl.innerHTML = '';
      if (total > 1) {
        for (let i = 0; i < total; i++) {
          const d = document.createElement('button');
          d.className = `breed-dot${i === slide ? ' active' : ''}`;
          d.type = 'button';
          d.setAttribute('aria-label', `Go to slide ${i + 1}`);
          d.addEventListener('click', () => { slide = i; renderGallery(); renderVarietyPills(); });
          dotsEl.appendChild(d);
        }
      }
    }
```
Add `renderPrice();` just before the function's closing brace:
```js
      dotsEl.innerHTML = '';
      if (total > 1) {
        for (let i = 0; i < total; i++) {
          const d = document.createElement('button');
          d.className = `breed-dot${i === slide ? ' active' : ''}`;
          d.type = 'button';
          d.setAttribute('aria-label', `Go to slide ${i + 1}`);
          d.addEventListener('click', () => { slide = i; renderGallery(); renderVarietyPills(); });
          dotsEl.appendChild(d);
        }
      }
      renderPrice();
    }
```

- [ ] **Step 6: Update `index.astro` breedOptions to use `.name`**

In `src/pages/index.astro`, find:
```ts
    b.varieties.forEach((v) => breedOptions.push(`${b.name} – ${v}`));
```
Change to:
```ts
    b.varieties.forEach((v) => breedOptions.push(`${b.name} – ${v.name}`));
```

- [ ] **Step 7: Add price styles**

In `src/styles/global.css`, find the variety-pill empty rule:
```css
.variety-pill-empty { opacity: 0.45; cursor: default; }
```
Insert after it:
```css

.breed-price {
  flex-direction: column;
  gap: 2px;
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--color-rule);
}
.breed-price-caption {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--color-ink-3);
}
.breed-price-row {
  display: flex;
  align-items: baseline;
  gap: var(--space-3);
}
.breed-price-variety {
  font-size: var(--text-sm);
  color: var(--color-ink-2);
}
.breed-price-amount {
  font-family: var(--font-display);
  font-style: italic;
  font-size: var(--text-xl);
  color: var(--color-accent);
}
```
(The element starts hidden via the inline `style="display:none"`; the script sets `display:flex` when a priced variety is active, so `.breed-price` only needs the non-display properties.)

- [ ] **Step 8: Verify the build**

Run: `npm run build`
Expected: build succeeds (schema normalizes the migrated objects; `.name` usages compile).

Run: `grep -c "data-breed-price" dist/index.html`
Expected: a non-zero count (the price element is present in the rendered card).

- [ ] **Step 9: Commit**

```bash
git add src/content.config.ts src/content/breeds/*.md src/components/Breeds.astro src/pages/index.astro src/styles/global.css
git commit -m "Add per-variety pricing shown for the selected variety in the breed gallery"
```

---

## Task 6: Cleanup — remove spring/fall from schema and content

**Files:**
- Modify: `src/content.config.ts`
- Modify: `src/content/breeds/*.md` (via script)

Now that no public code reads `spring`/`fall`, remove them.

- [ ] **Step 1: Remove the fields from the schema**

In `src/content.config.ts`, delete these two lines:
```ts
    spring: z.array(z.string()).default([]),
    fall: z.array(z.string()).default([]),
```

- [ ] **Step 2: Strip the keys from the markdown**

Run from the project root:
```bash
node -e '
const fs=require("fs"),path=require("path");
const matter=require("./admin/node_modules/gray-matter");
const dir="src/content/breeds";
for(const f of fs.readdirSync(dir).filter(x=>x.endsWith(".md"))){
  const fp=path.join(dir,f);
  const g=matter(fs.readFileSync(fp,"utf8"));
  delete g.data.spring; delete g.data.fall;
  fs.writeFileSync(fp, matter.stringify(g.content||"", g.data));
  console.log("cleaned",f);
}
'
```
Expected: four `cleaned ...` lines.

Run: `grep -l "^spring:\|^fall:" src/content/breeds/*.md || echo "none remaining"`
Expected: `none remaining`.

- [ ] **Step 3: Verify the build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/content.config.ts src/content/breeds/*.md
git commit -m "Remove obsolete spring/fall fields from schema and breed content"
```

---

## Task 7: Admin — `writeBreed` (buckets + variety objects)

**Files:**
- Modify: `admin/server.js`

- [ ] **Step 1: Update `writeBreed`**

In `admin/server.js`, find the `out` object inside `writeBreed`:
```js
    traits: Array.isArray(data.traits) ? data.traits.map(t => ({ label: String(t.label || ''), val: String(t.val || '') })) : [],
    varieties: Array.isArray(data.varieties) ? data.varieties.map(String) : [],
    images: Array.isArray(data.images)
      ? data.images.map((i) => {
          if (typeof i === 'string') return { url: i };
          const out = { url: String(i.url || '') };
          if (i.variety) out.variety = String(i.variety);
          return out;
        }).filter((i) => i.url)
      : [],
    spring: Array.isArray(data.spring) ? data.spring.map(String) : [],
    fall: Array.isArray(data.fall) ? data.fall.map(String) : [],
  };
```
Replace the `varieties:` line and the `spring:`/`fall:` lines so the block reads:
```js
    traits: Array.isArray(data.traits) ? data.traits.map(t => ({ label: String(t.label || ''), val: String(t.val || '') })) : [],
    varieties: Array.isArray(data.varieties)
      ? data.varieties.map((v) => {
          if (typeof v === 'string') return { name: v };
          const out = { name: String(v.name || '') };
          if (v.price) out.price = String(v.price);
          return out;
        }).filter((v) => v.name)
      : [],
    images: Array.isArray(data.images)
      ? data.images.map((i) => {
          if (typeof i === 'string') return { url: i };
          const out = { url: String(i.url || '') };
          if (i.variety) out.variety = String(i.variety);
          return out;
        }).filter((i) => i.url)
      : [],
    available: Array.isArray(data.available) ? data.available.map(String) : [],
    waitlist: Array.isArray(data.waitlist) ? data.waitlist.map(String) : [],
    unavailable: Array.isArray(data.unavailable) ? data.unavailable.map(String) : [],
  };
```

- [ ] **Step 2: Syntax check**

Run: `node --check admin/server.js`
Expected: no output (valid).

- [ ] **Step 3: Commit**

```bash
git add admin/server.js
git commit -m "Admin: writeBreed stores variety objects and availability buckets"
```

---

## Task 8: Admin — availability cards + schedule tab

**Files:**
- Modify: `admin/public/app.js`
- Modify: `src/content/site.json` (drop now-unused springLabel/fallLabel)

- [ ] **Step 1: Replace the two availability cards in the breed editor**

In `admin/public/app.js`, find (in `renderBreedEditor`):
```js
  wrap.appendChild(card(`Availability (${site?.schedule?.springLabel || 'Spring'})`,
    h('p', { class: 'hint' }, 'What varieties of this breed are available this spring.'),
    chipListEditor(breed.spring || [], (v) => { breed.spring = v; saveBreed(breed.id, breed); })
  ));

  wrap.appendChild(card(`Availability (${site?.schedule?.fallLabel || 'Fall'})`,
    h('p', { class: 'hint' }, 'What varieties of this breed are available this fall.'),
    chipListEditor(breed.fall || [], (v) => { breed.fall = v; saveBreed(breed.id, breed); })
  ));
```
Replace with:
```js
  wrap.appendChild(card(`Available (${site?.schedule?.availableLabel || 'Available'})`,
    h('p', { class: 'hint' }, 'Varieties of this breed currently available.'),
    chipListEditor(breed.available || [], (v) => { breed.available = v; saveBreed(breed.id, breed); })
  ));

  wrap.appendChild(card(`Waitlist (${site?.schedule?.waitlistLabel || 'Waitlist'})`,
    h('p', { class: 'hint' }, 'Varieties you are taking waitlist sign-ups for.'),
    chipListEditor(breed.waitlist || [], (v) => { breed.waitlist = v; saveBreed(breed.id, breed); })
  ));

  wrap.appendChild(card(`Unavailable (${site?.schedule?.unavailableLabel || 'Unavailable'})`,
    h('p', { class: 'hint' }, 'Varieties not currently available.'),
    chipListEditor(breed.unavailable || [], (v) => { breed.unavailable = v; saveBreed(breed.id, breed); })
  ));
```

- [ ] **Step 2: Update the schedule tab label fields**

In `renderScheduleTab`, find:
```js
    field('Spring season label', textInput(s.springLabel, (v) => { s.springLabel = v; saveSection('schedule', s); })),
    field('Fall season label', textInput(s.fallLabel, (v) => { s.fallLabel = v; saveSection('schedule', s); })),
```
Replace with:
```js
    field('Available label', textInput(s.availableLabel, (v) => { s.availableLabel = v; saveSection('schedule', s); })),
    field('Waitlist label', textInput(s.waitlistLabel, (v) => { s.waitlistLabel = v; saveSection('schedule', s); })),
    field('Unavailable label', textInput(s.unavailableLabel, (v) => { s.unavailableLabel = v; saveSection('schedule', s); })),
```

- [ ] **Step 3: Update the schedule preview matrix**

In `renderScheduleTab`, find:
```js
  container.appendChild(card('What\'s available each season',
    h('p', { class: 'hint' }, 'Edit per-breed availability on the Breeds tab — each breed has its own Spring and Fall lists.'),
    h('div', { class: 'schedule-matrix' }, breeds.map(b =>
      h('div', { class: 'schedule-matrix-row' }, [
        h('div', { class: 'schedule-matrix-breed' }, b.name),
        h('div', { class: 'schedule-matrix-col' }, [
          h('strong', {}, s.springLabel),
          (b.spring || []).length ? h('ul', {}, (b.spring || []).map(v => h('li', {}, v))) : h('em', {}, 'none'),
        ]),
        h('div', { class: 'schedule-matrix-col' }, [
          h('strong', {}, s.fallLabel),
          (b.fall || []).length ? h('ul', {}, (b.fall || []).map(v => h('li', {}, v))) : h('em', {}, 'none'),
        ]),
      ])
    )),
  ));
```
Replace with:
```js
  container.appendChild(card('What\'s available',
    h('p', { class: 'hint' }, 'Edit per-breed availability on the Breeds tab — each breed has Available, Waitlist, and Unavailable lists.'),
    h('div', { class: 'schedule-matrix' }, breeds.map(b =>
      h('div', { class: 'schedule-matrix-row' }, [
        h('div', { class: 'schedule-matrix-breed' }, b.name),
        h('div', { class: 'schedule-matrix-col' }, [
          h('strong', {}, s.availableLabel),
          (b.available || []).length ? h('ul', {}, (b.available || []).map(v => h('li', {}, v))) : h('em', {}, 'none'),
        ]),
        h('div', { class: 'schedule-matrix-col' }, [
          h('strong', {}, s.waitlistLabel),
          (b.waitlist || []).length ? h('ul', {}, (b.waitlist || []).map(v => h('li', {}, v))) : h('em', {}, 'none'),
        ]),
        h('div', { class: 'schedule-matrix-col' }, [
          h('strong', {}, s.unavailableLabel),
          (b.unavailable || []).length ? h('ul', {}, (b.unavailable || []).map(v => h('li', {}, v))) : h('em', {}, 'none'),
        ]),
      ])
    )),
  ));
```

- [ ] **Step 4: Drop the now-unused season labels from `site.json`**

In `src/content/site.json`, remove these two lines from the `schedule` object:
```json
    "springLabel": "🌱 Spring 2026",
    "fallLabel": "🍂 Fall 2026",
```

- [ ] **Step 5: Syntax check**

Run: `node --check admin/public/app.js`
Expected: no output (valid).

- [ ] **Step 6: Commit**

```bash
git add admin/public/app.js src/content/site.json
git commit -m "Admin: three availability buckets and status labels in breed editor + schedule tab"
```

---

## Task 9: Admin — variety + price editor

**Files:**
- Modify: `admin/public/app.js`
- Modify: `admin/public/styles.css`

- [ ] **Step 1: Add a `varietyPriceEditor` helper**

In `admin/public/app.js`, find the existing `applyVarietyChangeToImages` function (it ends with a closing `}` before the `// ===== Tab: Breeds =====` comment). Insert this new function immediately **after** `applyVarietyChangeToImages` and before the `// ===== Tab: Breeds =====` comment:
```js
function varietyPriceEditor(breed) {
  const wrap = h('div', { class: 'variety-editor' });
  breed.varieties = breed.varieties || [];
  let prevNames = breed.varieties.map((v) => v.name);
  function commit() {
    const nextNames = breed.varieties.map((v) => v.name);
    applyVarietyChangeToImages(breed, prevNames, nextNames);
    prevNames = nextNames.slice();
    saveBreed(breed.id, breed);
  }
  function render() {
    wrap.innerHTML = '';
    breed.varieties.forEach((v, i) => {
      wrap.appendChild(h('div', { class: 'variety-row' }, [
        h('input', { type: 'text', class: 'variety-name', value: v.name || '', placeholder: 'Variety name',
          onchange: (e) => { breed.varieties[i].name = e.target.value; commit(); } }),
        h('input', { type: 'text', class: 'variety-price', value: v.price || '', placeholder: 'Price (e.g. $25)',
          onchange: (e) => { const p = e.target.value.trim(); if (p) breed.varieties[i].price = p; else delete breed.varieties[i].price; commit(); } }),
        h('button', { type: 'button', class: 'btn btn-sm btn-danger', onclick: () => { breed.varieties.splice(i, 1); commit(); render(); } }, 'Remove'),
      ]));
    });
    wrap.appendChild(h('button', { type: 'button', class: 'btn btn-secondary btn-sm', onclick: () => { breed.varieties.push({ name: '' }); render(); } }, '+ Add variety'));
  }
  render();
  return wrap;
}
```

- [ ] **Step 2: Replace the Varieties card and update the image-manager call**

In `renderBreedEditor`, find:
```js
  let prevVarieties = (breed.varieties || []).slice();
  wrap.appendChild(card('Varieties',
    h('p', { class: 'hint' }, 'Add a pill for each color/variety you carry. Shown under the breed description. Renaming or deleting a variety will update any photos tagged with it.'),
    chipListEditor(breed.varieties || [], (next) => {
      applyVarietyChangeToImages(breed, prevVarieties, next);
      breed.varieties = next;
      prevVarieties = next.slice();
      saveBreed(breed.id, breed);
    })
  ));
```
Replace with:
```js
  wrap.appendChild(card('Varieties & pricing',
    h('p', { class: 'hint' }, 'Add a row for each color/variety you carry, with an optional price per chick (free text — e.g. "$25" or "Starting at $20"). Renaming a variety updates any photos tagged with it.'),
    varietyPriceEditor(breed)
  ));
```
Then find the Gallery images card's `renderImageManager` call:
```js
    renderImageManager('breeds/' + breed.id, breed.images || [], breed.varieties || [], (imgs) => { breed.images = imgs; saveBreed(breed.id, breed); })
```
Change the varieties argument to pass names:
```js
    renderImageManager('breeds/' + breed.id, breed.images || [], (breed.varieties || []).map((v) => v.name), (imgs) => { breed.images = imgs; saveBreed(breed.id, breed); })
```

- [ ] **Step 3: Add styling for variety rows**

In `admin/public/styles.css`, append at the end of the file:
```css
.variety-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 0.5rem;
}
.variety-row .variety-name { flex: 2 1 0; }
.variety-row .variety-price { flex: 1 1 0; }
.variety-editor > .btn { margin-top: 0.25rem; }
```

- [ ] **Step 4: Syntax check**

Run: `node --check admin/public/app.js`
Expected: no output (valid).

- [ ] **Step 5: Commit**

```bash
git add admin/public/app.js admin/public/styles.css
git commit -m "Admin: per-variety name + price editor"
```

---

## Task 10: Admin — disclaimer tab

**Files:**
- Modify: `admin/public/app.js`

- [ ] **Step 1: Add the tab to the `TABS` array**

In `admin/public/app.js`, find the `TABS` array. The `schedule` entry is:
```js
  { id: 'schedule', label: 'Schedule' },
```
Insert a disclaimer entry right after it:
```js
  { id: 'schedule', label: 'Schedule' },
  { id: 'disclaimer', label: 'Disclaimer' },
```

- [ ] **Step 2: Route it in `renderPanel`**

In `renderPanel`, find:
```js
    case 'schedule': return renderScheduleTab();
```
Insert after it:
```js
    case 'schedule': return renderScheduleTab();
    case 'disclaimer': return renderDisclaimerTab();
```

- [ ] **Step 3: Add `renderDisclaimerTab`**

Insert this function immediately **after** the end of `renderScheduleTab` (just before the `// ===== Tab: Hero =====` comment):
```js
// ===== Tab: Disclaimer =====
function renderDisclaimerTab() {
  const d = site.disclaimer || (site.disclaimer = { enabled: true, heading: '', body: '' });
  const container = h('div', {});
  container.appendChild(card('Hatching-eggs disclaimer',
    field('Show on site', checkboxInput(d.enabled, (v) => { d.enabled = v; saveSection('disclaimer', d); }, 'Display this callout above the "How to Preorder" section')),
    field('Heading', textInput(d.heading, (v) => { d.heading = v; saveSection('disclaimer', d); })),
    field('Body', textareaInput(d.body, (v) => { d.body = v; saveSection('disclaimer', d); }, 5), 'Use Enter for line breaks.'),
  ));
  tabPanel.appendChild(container);
}
```

- [ ] **Step 4: Syntax check**

Run: `node --check admin/public/app.js`
Expected: no output (valid).

- [ ] **Step 5: Commit**

```bash
git add admin/public/app.js
git commit -m "Admin: disclaimer editor tab (heading, body, show/hide)"
```

---

## Task 11: Manual admin round-trip verification

No code changes — confirm the admin reads, edits, and writes the new shapes correctly end-to-end.

- [ ] **Step 1: Start the admin**

Run: `cd admin && npm start`
Expected: `Oakshade Admin running at: ... http://localhost:3001`. Open it in a browser.

- [ ] **Step 2: Availability round-trip**

In the **Breeds** tab, edit a breed. Confirm three cards now show: Available, Waitlist, Unavailable (pre-filled Available from migration). Move a variety into Waitlist and add one to Unavailable.

Run: `grep -A3 "^waitlist:\|^unavailable:" src/content/breeds/<that-breed>.md`
Expected: the values you entered are persisted in the markdown.

- [ ] **Step 3: Pricing round-trip**

In the same breed, in **Varieties & pricing**, set a price (e.g. `$25`) on one variety and rename another.

Run: `grep -A6 "^varieties:" src/content/breeds/<that-breed>.md`
Expected: the priced variety shows `name:` + `price:`; the rename persisted. Confirm a photo tagged with the renamed variety still shows it tagged in the image manager.

- [ ] **Step 4: Disclaimer round-trip**

Open the **Disclaimer** tab. Edit the heading/body, then toggle "Show on site" off and on.

Run: `grep -A4 '"disclaimer"' src/content/site.json`
Expected: your edits and the `enabled` boolean are persisted.

- [ ] **Step 5: Final public build with edited content**

Run: `npm run build`
Expected: build succeeds. Optionally `npm run preview` and visually confirm: 3-column availability, the selected variety's price in the gallery, and the disclaimer above "How to Preorder" (and that it disappears when disabled).

- [ ] **Step 6: Stop the admin** (Ctrl-C in its terminal).

---

## Self-Review (completed during planning)

**Spec coverage:**
- Availability seasons → 3 buckets: schema (T1), content (T2), public (T3), cleanup (T6), admin (T8). ✓
- Per-variety pricing in gallery: schema+content+component (T5), admin editor (T7, T9). ✓
- Disclaimer callout above Order, enabled/heading/body, admin-editable: component+JSON+render (T4), admin tab (T10). ✓
- Migration defaults (available = union of spring+fall; varieties→{name}): T2, T5. ✓
- Both public site and admin updated: public T1–T6, admin T7–T10, verified T11. ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code; the disclaimer body is intentional default copy the owner edits in-admin. ✓

**Type/name consistency:** `available`/`waitlist`/`unavailable` (string[]) and `varieties: {name, price?}[]` are used identically across schema, `Schedule.astro`, `Breeds.astro`, `writeBreed`, and `app.js`. Status CSS classes (`available`/`waitlist`/`unavailable`) match between `Schedule.astro` markup and `global.css`. Data hooks (`data-breed-price*`) match between markup and script. ✓
