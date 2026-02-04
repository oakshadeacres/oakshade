# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Oakshade Acres is a farm website built with Astro 5 and Tailwind CSS. It features chickens and goats available for purchase, using markdown-based content collections. A separate Express admin app provides local content management.

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

### Content Collections
Content lives in `src/content/{chickens,goats}/` as markdown files. Schema defined in `src/content.config.ts`:
- `name`: string
- `images`: string[] (supports multi-image carousel)
- `description`: string
- `availability`: 'available' | 'limited' | 'unavailable'

### Admin API (`admin/server.js`)
REST API for CRUD operations on content files:
- `GET/POST /api/animals/:type` - List/create animals
- `GET/PUT/DELETE /api/animals/:type/:id` - Single animal operations
- `POST /api/upload/:type` - Image upload (max 10 files, 10MB each)
- `DELETE /api/images` - Delete images

Images upload to `/public/images/{type}/`.

### Raspberry Pi Deployment

The admin app includes a systemd service file (`admin/oakshade-admin.service`). See `chick-bot/CLAUDE.md` for full deployment instructions including systemd setup and Cloudflare Tunnel migration (replacing ngrok for a stable webhook URL).

If using nvm on the Pi, create a stable symlink for systemd:

```bash
sudo ln -s "$(which node)" /usr/local/bin/node
```

### Key Configuration
- **Path alias**: `@/*` maps to `src/*` (tsconfig.json)
- **Tailwind theme**: Custom rustic palette in `tailwind.config.mjs` (cream, barn-red, forest, earth)
- **Deployment**: Netlify with Node 20, builds to `dist/`
- **Contact form**: Uses Netlify Forms with honeypot spam protection
