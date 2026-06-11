# Oakshade Acres — Functional Specification

A rebuild-grade specification of all functionality, complementing `requirements.md` (user stories). An agent following this document should be able to reproduce the system's complete behavior. Visual design (palette, typography, spacing) is intentionally out of scope — see `BRANDING_GUIDE.md`.

## 1. System overview

One repository, two applications:

- **Public site** — static single-page Astro 5 site. Builds to `dist/`, deploys to GitHub Pages at `https://oakshadeacres.github.io/oakshade/` (config: `site: 'https://oakshadeacres.github.io'`, `base: '/oakshade'`, `@astrojs/sitemap` integration).
- **Admin app** (`admin/`) — Express server + vanilla-JS single-page UI. Runs on a Raspberry Pi under systemd. Edits the content files in this repo and publishes via git.

External integration: a Facebook chatbot ("chick-bot", separate repo) pushes unanswerable customer questions into a Redis list that the admin surfaces (§6).

## 2. Content data model

All content is file-based and versioned in git.

### 2.1 Breeds — `src/content/breeds/<id>.md`

One markdown file per breed; `<id>` is the slug (also the API id and the image folder name). Body is unused; all data is YAML frontmatter, validated by zod (`src/content.config.ts`):

| Field | Type | Default | Meaning |
|---|---|---|---|
| `name` | string | required | Display name |
| `specialty` | boolean | false | Shows "★ Our Specialty" flag |
| `order` | number | 0 | Sort order everywhere breeds are listed |
| `description` | string | required | Paragraph shown in gallery |
| `traits` | `{label, val}[]` | [] | Attribute tiles (e.g. "Egg Color" / "Brown") |
| `varieties` | `(string \| {name, price?})[]` | [] | Color varieties; bare strings normalize to `{name}`; `price` is free text (e.g. "$25") |
| `images` | `{url, variety?}[]` | [] | Gallery photos in display order; `variety` ties a photo to a variety name |
| `available` / `waitlist` / `unavailable` | string[] ×3 | [] | Variety names bucketed by availability |

### 2.2 Site copy — `src/content/site.json`

Single JSON object; each top-level key is a "section" editable independently via the admin API. Shape:

- `nav`: `{logo, links: {label, href}[], cta: {label, href}}`
- `hero`: `{logoImage, title, tagline, badges: {label, rose}[], ctas: {label, href, primary}[]}`
- `about`: `{label, title, paragraphs: string[], image}`
- `breedsSection`, `pickupShippingSection`, `faqSection`, `testimonialsSection`: `{label, title}`
- `careGuideSection`: `{label, title, sub}`
- `schedule`: `{label, title, sub, availableLabel, waitlistLabel, unavailableLabel, footerNote}`
- `disclaimer`: `{enabled: bool, heading, body}`
- `order`: `{label, title, intro, steps: {title, text}[], facebookUrl, ctaLabel, ctaNote}`
- `contact`: `{label, title, intro, infoRows: {icon, text}[], email, endpoint}` — `endpoint` is the public URL of the admin's `/api/contact`; empty string enables the mailto fallback
- `pickupShipping`: `{icon, title, text}[]`
- `careGuide`, `faqs`: `{q, a}[]`
- `testimonials`: `{name, text, stars: int}[]`
- `footer`: `{logoImage, brandName, brandText, getInTouch: {title, items: {label, href}[], note}, quickLinks: {title, items: {label, href}[]}, copyright}`

### 2.3 Images — `public/images/`

- Breed photos: `public/images/breeds/<breedId>/`; site assets (logos): `public/images/site/`.
- Naming: `<epoch-ms>-<slugified-original-basename>.webp` plus a `…-thumb.webp` sibling. Slug rule: lowercase, non-alphanumerics → `-`, collapse repeats, trim; fallback `image`.
- Content references images by absolute path (`/images/...`); the site prefixes `import.meta.env.BASE_URL` at render, and treats `http(s)://` URLs as already absolute.

## 3. Public site behavior

A single page assembling sections in this order: Nav, Hero, About, Breeds, Schedule, Disclaimer, Order, Contact, Pickup & Shipping, Care Guide, FAQ, Testimonials, Footer. All nav links are same-page anchors; smooth scrolling with enough scroll padding (~80px) to clear the sticky header; honor `prefers-reduced-motion`. Mobile: hamburger toggle opens/closes the nav links.

**Hero.** Title splits once on `&` for typesetting. Each badge is matched to a breed by normalizing both badge label and breed name (lowercase, strip non-alphanumerics) and testing prefix-containment either way (tolerates trailing spaces / singular-plural drift). Matched badges render as `<a href="#breeds" data-breed-link="<breedId>">`; unmatched stay plain text. Clicking scrolls to the gallery and activates that breed's tab.

**Breeds gallery.** Tabs (one per breed, ordered by `order`, specialty star suffix) switch a single shared card; state = `{activeId, slide}` with `slide` reset on tab change. Card contents driven by the breed data serialized into the page:
- Slide count = `images.length`, else `varieties.length`, else 1. When the breed has images, the carousel shows them; when it has none, show a placeholder (icon + "<variety> <breed name>" text) per variety.
- Carousel: prev/next arrows (wrap around), clickable dots, counter "n / total" — all hidden when only one slide; touch swipe with 40px threshold.
- Variety pills: one per variety. With images: pill is active when the current slide's `variety` matches; pills whose variety has no tagged image are disabled (`aria-disabled`); clicking an enabled pill jumps to that variety's first image. Without images: pill i maps to slide i.
- "Price per chick" tile appears among the trait tiles only when the current slide's variety has a `price`, updating as slides change.

**Schedule.** Per breed: three columns (labels from `schedule.*Label`) listing variety names from `available`/`waitlist`/`unavailable`; empty bucket renders "none".

**Disclaimer.** Rendered only when `disclaimer.enabled`.

**Contact form.** Fields: name*, email*, phone, interest select (`Day-old Chicks`, `Hatching Eggs`, `Fertile Eating Eggs`, `Pullets / Older Birds`, `General Question`), breed select, message*, plus a visually-hidden `website` honeypot input. Breed options are computed at build: for each breed, one option per variety as `"<Breed> – <Variety>"` (breed name alone if no varieties), plus trailing `"Multiple Breeds"`.
Client validation: name nonempty, email matches `\S+@\S+\.\S+`, message nonempty; inline per-field errors. On submit:
- If `contact.endpoint` is empty → build a `mailto:` to `contact.email` with subject `Oakshade Acres Inquiry – <interest|General>` and a body listing all fields, open it, then show the success panel.
- Else POST JSON `{name, email, phone, interest, breed, message, website}` to the endpoint; success = HTTP ok AND `{ok: true}` body → success panel replaces the form; otherwise show server-provided or generic error and re-enable submit.

**Care Guide / FAQ.** Expandable accordion items from `careGuide`/`faqs` arrays.

**SEO.** `sitemap-index.xml` generated at build.

## 4. Admin server (`admin/server.js`)

Express app; JSON body parsing; reads/writes the repo files directly (`PROJECT_ROOT` = repo root, one level up).

### 4.1 Configuration (env, with defaults)

| Var | Default | Purpose |
|---|---|---|
| `PORT` / `HOST` | 3001 / `0.0.0.0` | Listen address |
| `ADMIN_USER` / `ADMIN_PASS` | `admin` / `oakshade123` | Basic-auth credential |
| `REQUIRE_AUTH` | unset | Force auth even on localhost |
| `REDIS_URL` | `redis://localhost:6379` | Follow-up queue |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | — | Contact mailer (lazily created; port 465 ⇒ `secure`) |
| `CONTACT_TO` | — | Inquiry recipient; unset ⇒ contact endpoint returns 503 |
| `NODE_ENV` | — | `production` disables dev CORS origins |
| `RESTART_ON_CHANGE` | unset | Force the auto-restart watcher outside systemd |

`.env` is loaded by systemd (`EnvironmentFile`); an `.env.example` documents these.

### 4.2 Middleware order (security-relevant)

1. `OPTIONS|POST /api/contact` — registered **before** auth; public.
2. Basic-auth guard: skipped entirely when `HOST === '127.0.0.1'` and `REQUIRE_AUTH` unset; otherwise compares the exact `Authorization: Basic <b64>` string; 401 + `WWW-Authenticate` on mismatch.
3. Static: `admin/public/` (the UI), `/images` → `public/images/` (repo), `/vendor/cropperjs` → `node_modules/cropperjs/dist`.
4. All `/api/*` routes below.

### 4.3 Public contact endpoint

`POST /api/contact` (and `OPTIONS` → 204):
- CORS: allow-origin echoed (with `Vary: Origin`) only for `https://oakshadeacres.github.io`, plus `http://localhost:4321/4322` outside production.
- Honeypot: nonempty `website` → `{ok: true}` immediately (silent drop).
- Rate limit: in-memory per-IP (first hop of `x-forwarded-for`, else socket address), 5 per rolling 10 min → 429.
- Validation: name required ≤200; email required ≤200 matching `\S+@\S+\.\S+`; message required ≤5000 → 400 with field-specific message.
- Unconfigured (`CONTACT_TO` or SMTP missing) → 503 `{ok:false, error:'Contact endpoint not yet configured'}`.
- Sends mail: from `SMTP_USER` to `CONTACT_TO`, `replyTo` = visitor email, subject `Oakshade Acres Inquiry – <interest|General>`, plain-text body with all fields. Success `{ok:true}`; failure logged, 500 with a friendly message.

### 4.4 Content API

| Endpoint | Behavior |
|---|---|
| `GET /api/breeds` | All breeds (`{id, ...frontmatter}`), sorted by `order` |
| `GET /api/breeds/:id` | One breed or 404 |
| `POST /api/breeds` | Requires `name`; id = slugified name; 409 if exists; `order` = max+1; 201 with saved breed |
| `PUT /api/breeds/:id` | Shallow-merges body over existing, rewrites file; 404 if missing |
| `DELETE /api/breeds/:id` | Deletes the markdown file |
| `GET /api/site` / `GET /api/site/:section` | Whole `site.json` / one section (404 unknown key) |
| `PUT /api/site/:section` | Replaces that section with the body, writes pretty-printed JSON |
| `POST /api/upload` | Multipart `images` (≤10 files, ≤10 MB each, jpeg/png/webp/gif) + `type` target; target must match `/^[a-z0-9]+(\/[a-z0-9_-]+)?$/i` with no `..`; returns `{images: [{full, thumb}], urls: [full…]}` |
| `DELETE /api/images` | Body `{path}` starting `/images/`, no `..`; deletes the file and its `-thumb` sibling (or, given a thumb path, also the full image) |
| `POST /api/deploy` | Runs `git add -A && (commit "Content update <ISO>" if staged) && pull --rebase origin main && push origin main` in the repo; distinguishes "No changes to deploy" from "Deployed successfully"; 500 with stderr on failure |
| `GET /api/followups` / `GET /api/followups/count` / `DELETE /api/followups/:index` | See §6 |
| `ALL /api/animals*`, `/api/upload/:type` | 410 Gone (legacy guard so old UIs can't corrupt content) |

Breed writes normalize defensively (`writeBreed`): coerce field types, accept bare-string varieties/images, drop entries without name/url, preserve only known fields.

### 4.5 Image pipeline

Per uploaded file (`processImage`): EXIF auto-rotate → resize to ≤1600px wide (`fit: inside`, no enlargement) → **watermark if the target matches `/^breeds(\/|$)/`** → webp quality 82. Thumbnail: same source, ≤400px, quality 75, no watermark. Site-asset uploads (`type=site`) are never watermarked.

**Watermark** (`admin/watermark.js` + `admin/watermark.svg`): the farm logo traced to a single SVG path (viewBox 1254×1254), rendered as an **emboss** — two `<use>` copies of the path, black at opacity 0.55 translated (+5,+5) units and white at 0.55 translated (−5,−5) — composited at 18% of photo width (min 24px), inset 3% from the bottom-right corner. `admin/scripts/watermark-existing.js --yes` is a one-time batch stamper for pre-existing photos (skips `-thumb` files; re-running double-stamps — guard prompt explains this).

### 4.6 Self-restart on code change

When supervised (systemd sets `INVOCATION_ID`, or `RESTART_ON_CHANGE=1`), the server watches its own file (2s poll, 1s debounce) and exits(1) on change so the supervisor relaunches fresh code — deferred until any in-flight deploy finishes. Rationale: a stale in-memory handler once corrupted content. Note: this only watches `server.js`; dependency changes (`package.json`) still require a manual `npm ci` + restart.

## 5. Admin UI (`admin/public/` — vanilla JS SPA)

Single `index.html` + `app.js`; all rendering via DOM-builder helper. Header: save indicator, **Deploy** button (calls `/api/deploy`, shows progress/result), follow-up bell (hidden when zero). Tab bar with 13 tabs: Breeds, Schedule, Disclaimer, Hero, About, Order, Pickup & Shipping, Care Guide, FAQs, Testimonials, Contact, Nav, Footer — each editing its `site.json` section (or breed files) with **save-on-change** (`PUT` per edit; saving/saved/error flash).

- **Breeds tab**: card list (first-photo thumbnail, name, specialty star, variety/image counts) with an Edit button each. Creating and deleting breeds is API-only (`POST`/`DELETE /api/breeds…`) — the UI does not expose it. Breed editor: basics (name, specialty, order, description), trait rows, varieties & pricing rows (renaming a variety rewrites matching `images[].variety` tags), availability board — three columns (Available/Waitlist/Unavailable) where varieties are dragged between buckets by a handle, click-to-rename, ×-remove, +-add — and the gallery image manager.
- **Image manager**: thumbnail grid (falls back to full image if thumb 404s) with per-photo variety dropdown ("— untagged —" clears), ←/→ adjacent reorder, × delete (confirm; calls `DELETE /api/images` then updates the breed). Uploader: drop zone + file input (multiple, `image/*`); dropped/picked files filtered to `image/*` and capped at 10; drag-over highlight uses a depth counter so child elements don't flicker it; window-level `dragover`/`drop` are prevented so stray drops never navigate the page.
- **Crop queue**: each accepted file opens sequentially in a square Cropper.js editor (aspect 1, viewMode 1, autoCropArea 1, dragMode move, no rotate/scale); controls: zoom ±0.1, reset, "Use original" (skips cropping, keeps file as-is), cancel (aborts whole queue), Next/"Save all". Cropped output: canvas capped at 2000×2000, JPEG q0.92, renamed `<base>.jpg`. On completion, results upload as one multipart request; returned URLs append to the breed's images.
- **Follow-ups**: bell badge = `GET /api/followups/count`, polled every 30s; panel lists items (sender, localized timestamp, question, bot's reply); per-item dismiss calls `DELETE /api/followups/:index`.
- **What's-new banner**: shown until dismissed; persisted in `localStorage` key `oakshade_whatsnew_v1`.
- **Hero tab** includes a logo uploader (same image-manager component, target `site`, no watermark) — uploaded URL is manually pasted into the logo path field.

## 6. chick-bot integration contract

Redis list **`followup_queue`**: each element is a JSON string `{sender_id, timestamp, question, bot_response}` pushed by the external chatbot when it can't answer. The admin reads the whole list, shows count/badge, and removes individual items by index (set-to-sentinel `__REMOVED__` then `LREM` — index-safe under concurrent pushes). Items are append-only from the bot's side; no other coordination exists.

## 7. Build, deployment & operations

- **Site**: `npm run dev` (localhost:4321) / `npm run build` → `dist/` / `npm run preview`. GitHub Actions (`.github/workflows/deploy.yml`): on every push to `main` (and manual dispatch) — Node 20, `npm ci`, `npm run build`, upload `dist/` artifact, deploy to GitHub Pages; concurrency group `pages`, cancel-in-progress.
- **Admin**: `cd admin && npm start`. Production: systemd unit `admin/oakshade-admin.service` (After/Wants `redis-server`, `EnvironmentFile=.env`, `ExecStart=/usr/local/bin/node server.js`, `Restart=on-failure` — the restart policy is what makes §4.6 work). `/usr/local/bin/node` is a manual symlink to the nvm-installed Node.
- **Runtime baseline**: Node ≥ 20.3 (sharp's floor); Redis required for follow-ups; SMTP credentials for contact email.
- **Update routine on the Pi**: `git pull` → `npm ci` in `admin/` if `package.json`/lockfile changed → `systemctl restart oakshade-admin` → hard-refresh the admin tab. Known failure modes if skipped: stale handlers corrupting content; missing new dependencies breaking features silently; sharp's per-process SVG cache stamping stale watermark artwork.
- **Publishing model**: content changes flow Pi → git → GitHub Pages (admin Deploy button); code changes flow dev box → git → Pi (pull) and GitHub Pages (Actions). The deploy endpoint's pull-rebase prevents push rejections when both happen.
