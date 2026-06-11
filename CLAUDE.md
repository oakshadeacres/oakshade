# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Oakshade Acres is a specialty poultry hatchery website built with Astro 5 (single page, plain CSS in `src/styles/global.css`). Chicken breeds live in a markdown content collection; all other copy lives in `src/content/site.json`. A separate Express admin app (`admin/`) provides content management from a Raspberry Pi. See `docs/requirements.md` (user stories) and `docs/functional-spec.md` (rebuild-grade detail).

## Development Commands

```bash
# Main site
npm run dev          # Start dev server (default: localhost:4321)
npm run build        # Production build to dist/
npm run preview      # Preview production build

# Admin app (local content management)
cd admin && npm start   # Runs on localhost:3001
```

## Architecture

### Content
- Breeds: `src/content/breeds/<id>.md`, frontmatter validated in `src/content.config.ts` — `name`, `specialty`, `order`, `description`, `traits[{label,val}]`, `varieties[{name,price?}]`, `images[{url,variety?}]`, and `available`/`waitlist`/`unavailable` (variety-name lists).
- Site copy: `src/content/site.json`, one top-level key per section.

### Admin API (`admin/server.js`)
- `GET/POST /api/breeds`, `GET/PUT/DELETE /api/breeds/:id` — breed CRUD (create slugifies the name into the id)
- `GET/PUT /api/site/:section` — site.json sections
- `POST /api/upload` — multipart `images` (max 10 files, 10MB each) + `type` target (`breeds/<id>` or `site`); breed photos get watermarked (`admin/watermark.js`), resized to webp + thumbnail
- `DELETE /api/images` — removes an image and its thumb
- `POST /api/deploy` — git add/commit/pull-rebase/push from the Pi
- `GET/DELETE /api/followups…` — chatbot escalation queue (Redis)
- `POST /api/contact` — public (pre-auth) contact-form receiver; everything else sits behind basic auth

Images upload to `/public/images/{type}/`. Full contracts in `docs/functional-spec.md`.

### Raspberry Pi Deployment

The admin app includes a systemd service file (`admin/oakshade-admin.service`). See `chick-bot/CLAUDE.md` for full deployment instructions including systemd setup and Cloudflare Tunnel migration (replacing ngrok for a stable webhook URL).

If using nvm on the Pi, create a stable symlink for systemd:

```bash
sudo ln -s "$(which node)" /usr/local/bin/node
```

### Key Configuration
- **Path alias**: `@/*` maps to `src/*` (tsconfig.json)
- **Styling**: plain CSS with custom properties in `src/styles/global.css` (no Tailwind); visual identity in `BRANDING_GUIDE.md`
- **Deployment**: GitHub Pages via `.github/workflows/deploy.yml` (Node 20, builds to `dist/`) on every push to main; live at https://oakshadeacres.github.io/oakshade/ — check runs with `gh run list --workflow deploy.yml`
- **Contact form**: POSTs JSON to the `contact.endpoint` URL in `src/content/site.json`; falls back to a `mailto:` link when the endpoint is empty
