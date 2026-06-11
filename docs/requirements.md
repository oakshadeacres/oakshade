# Oakshade Acres — Requirements & User Stories

> This document covers *what* the system does and for whom. For a rebuild-grade specification of *how* — data schemas, API contracts, validation rules, configuration, and exact behaviors — see [`functional-spec.md`](functional-spec.md).

A retroactive write-up of the requirements and user stories covered by this project as built. Oakshade Acres is a small specialty poultry hatchery in Dayton, Texas. The project has two applications sharing one repository:

1. **Public site** — a static, single-page Astro 5 site deployed to GitHub Pages, presenting the farm and its chicken breeds to prospective buyers.
2. **Admin app** — an Express app running on a Raspberry Pi that lets the farm owner edit all site content, manage photos, and publish — without touching code or git.

A third system, the **chick-bot** Facebook chatbot, lives outside this repo but integrates through a shared Redis queue (see "Chatbot follow-ups").

## Actors

| Actor | Description |
|---|---|
| **Visitor** | A prospective chick/hatching-egg buyer browsing the public site, usually arriving from Facebook or search. |
| **Owner** | The farm owner (non-technical) who maintains content, photos, pricing, and availability through the admin UI. |
| **Maintainer** | Whoever maintains code, deployment, and the Pi (developer role). |

---

## Visitor stories (public site)

**V1 — Learn what the farm offers at a glance.**
As a visitor, I want a clear landing page so that I immediately understand who the farm is and what it sells.
*Covered by:* Hero section with farm name, tagline, logo mark, est./location masthead, and badges naming the four breeds. Breed badges are buttons that jump to the gallery with that breed opened (`Hero.astro`, `Breeds.astro`).

**V2 — Browse breeds and photos.**
As a visitor, I want to browse each breed's photos, varieties, and traits so that I can decide what to buy.
*Covered by:* Breeds section with one tab per breed; each shows a photo carousel (arrows, dots, swipe on touch, image counter), a "★ Our Specialty" flag, description, trait tiles, per-variety price tile, and variety pills. Clicking a variety pill jumps the carousel to that variety's first photo; pills with no photo are visibly disabled. Photos carry the farm's watermark (see A7).

**V3 — Check what's available right now.**
As a visitor, I want to see current availability per breed and variety so that I don't inquire about something out of stock.
*Covered by:* Schedule section rendering three buckets per breed — Available, Waitlist, Unavailable — from the same content the owner edits.

**V4 — Understand how ordering works.**
As a visitor, I want to know the preorder process and any caveats so that I can follow it.
*Covered by:* Order section (step-by-step instructions + Facebook CTA), optional Disclaimer banner (e.g. hatching-egg note), Pickup & Shipping cards (pickup in Dayton TX, USPS for hatching eggs).

**V5 — Contact the farm.**
As a visitor, I want to send an inquiry with my breed interest so that the owner can reply by email.
*Covered by:* Contact form (name, email, phone, interest type, breed/variety select populated from content, message) with client-side validation. Submissions POST as JSON to the admin's public `/api/contact` endpoint; if no endpoint is configured the form falls back to opening a pre-filled `mailto:`. Spam defenses: honeypot field (bots get a fake success), per-IP rate limit (5 per 10 min), CORS allow-list (production origin + localhost dev), and length caps on every field.

**V6 — Get care information and social proof.**
As a visitor, I want care guidance, FAQs, and testimonials so that I can trust the farm and prepare for ownership.
*Covered by:* Care Guide and FAQ sections (expandable accordion items), Testimonials section, About section with farm story and photo.

**V7 — Use the site comfortably on any device.**
*Covered by:* Responsive layout, mobile nav drawer, smooth-scrolling anchor nav with `scroll-padding` clearing the sticky header, reduced-motion media query, lazy/eager image loading, sitemap for search engines.

---

## Owner stories (admin app)

**A1 — Edit every piece of site copy without code.**
As the owner, I want to edit any text on the site so that I never need a developer for content changes.
*Covered by:* 13 admin tabs (Breeds, Schedule, Disclaimer, Hero, About, Order, Pickup & Shipping, Care Guide, FAQs, Testimonials, Contact, Nav, Footer) mapping to `site.json` sections and breed markdown files. Edits save on change with a saving/saved indicator.

**A2 — Manage breeds end to end.**
As the owner, I want to edit and reorder breeds so that the gallery always reflects the flock.
*Covered by:* Breed list with per-breed editor: name, specialty flag, ordering, description, trait tiles, varieties with optional per-chick price (free text). Renaming a variety propagates to photos tagged with it. (Creating/deleting whole breeds is supported by the API but not exposed in the UI.)

**A3 — Manage availability by dragging.**
As the owner, I want to move varieties between Available / Waitlist / Unavailable so that the public schedule stays current.
*Covered by:* Drag-and-drop availability board per breed (drag by handle, click to rename, × to remove, + to add).

**A4 — Upload photos easily from a computer.**
As the owner, I want to drag photos from my file manager into the admin so that adding gallery images is quick.
*Covered by:* Upload drop zone (also a click-to-browse input) accepting up to 10 images per batch (JPEG/PNG/WebP, 10 MB each), with drag-over highlight; stray drops outside the zone can't navigate the page away.

**A5 — Frame photos before publishing.**
As the owner, I want to crop each upload so that gallery photos are well-framed squares.
*Covered by:* A crop queue (Cropper.js): each uploaded image opens in a square pan/zoom editor with zoom buttons, reset, "Use original" skip, and cancel; the final image saves at up to 2000px.

**A6 — Organize the gallery.**
As the owner, I want to tag, reorder, and delete photos so that each variety's pictures appear correctly on the site.
*Covered by:* Image manager grid with per-photo variety tag dropdown, left/right reordering, and delete (with confirmation; removes both full image and thumbnail from disk).

**A7 — Protect photos with the farm brand.**
As the owner, I want uploaded gallery photos watermarked so that shared/stolen images still credit the farm.
*Covered by:* Server-side watermark pipeline: the logo (vectorized SVG, embossed style — offset dark/light edge copies that read as relief) is composited onto the bottom-right corner (18% of width, 3% inset) of every breed-gallery upload. Site assets (logos) and admin thumbnails stay clean. A one-time script (`admin/scripts/watermark-existing.js`, `--yes` guard) stamped pre-existing photos.

**A8 — Publish with one click.**
As the owner, I want a Deploy button so that my edits go live without using git.
*Covered by:* `/api/deploy` runs `git add -A`, commit, `pull --rebase`, push from the Pi; GitHub Actions then builds and publishes the site. Button shows progress/result states.

**A9 — Answer chatbot escalations.**
As the owner, I want to see questions the Facebook chatbot couldn't answer so that no customer goes ignored.
*Covered by:* A bell icon with unanswered count (polled every 30s) opening a panel of follow-up questions from the shared Redis queue; items can be dismissed once handled.

**A10 — Learn what changed.**
*Covered by:* Dismissible "What's new" banner describing recent admin changes (remembered in localStorage).

---

## Maintainer stories & non-functional requirements

**M1 — Static, low-cost, low-risk hosting.** The public site is fully static (Astro build → GitHub Pages via `.github/workflows/deploy.yml` on every push to main, Node 20, ~30s deploys). No server is in the visitor path except the optional contact endpoint.

**M2 — Content as data.** All content is file-based and versioned: breed markdown with zod-validated frontmatter (`src/content.config.ts`) and `site.json` for section copy. Git history doubles as content backup (every Deploy is a commit).

**M3 — Admin security model.** The admin runs behind HTTP Basic Auth, except when bound to `127.0.0.1` for local development (`REQUIRE_AUTH` overrides). Only `/api/contact` is deliberately public, with the spam defenses listed in V5. Upload targets and image-delete paths are validated against traversal; uploads are size/type restricted.

**M4 — Image pipeline.** Every upload is normalized server-side with sharp: EXIF rotation, resize to max 1600px (quality 82 webp) plus a 400px thumbnail (quality 75), timestamped slug filenames, watermark per A7.

**M5 — Pi operations.** The admin runs as a systemd service (`admin/oakshade-admin.service`) using a `/usr/local/bin/node` symlink (nvm-compatible). Requires Redis for the follow-up queue and SMTP credentials (env) for contact email. Update routine: `git pull`, `npm ci` in `admin/` when dependencies changed, `systemctl restart oakshade-admin` — a stale process or stale `node_modules` causes silent breakage (documented failure modes: content corruption 2026-06-08, dead crop editor 2026-06-09).

**M6 — Node & dependency baseline.** Node ≥ 20.3 (sharp's floor); Node 22 LTS recommended. Dependencies kept clean against `npm audit` (last cleared 2026-06-10: express/qs/path-to-regexp bumps, nodemailer 6→8).

**M7 — Branding consistency.** Visual identity (rustic palette, JetBrains Mono/serif type mix, engraved-logo iconography) follows `BRANDING_GUIDE.md`; both apps use it.

---

## Out of scope (as of this writing)

- No e-commerce: ordering happens via Facebook/contact form; prices are informational free text.
- No user accounts on the public site; single shared credential for the admin.
- Goats appear in legacy docs (`README.md`, `CLAUDE.md`) but the current content model covers chicken breeds only.
- chick-bot itself (Facebook webhook, NLP) lives outside this repo; only its escalation queue surfaces here.
