# Oakshade Acres

Website for Oakshade Acres, a specialty poultry hatchery in Dayton, Texas. Built with Astro 5; chicken breeds live in a markdown content collection and all other copy in `src/content/site.json`. See `docs/requirements.md` and `docs/functional-spec.md` for full documentation.

## Setup

1. Install dependencies: `npm install`
2. Start dev server: `npm run dev` (runs on localhost:4321)
3. Production build: `npm run build`

## Admin App

A local Express app for managing content (breed CRUD, site copy, image uploads with crop + watermark, one-click deploy).

```bash
cd admin
npm install
npm start  # runs on localhost:3001
```

Requires Redis for the chatbot followup queue:

```bash
sudo apt install redis-server
```

## Deployment

The main site deploys to GitHub Pages via GitHub Actions. The admin app runs locally on a Raspberry Pi.

### First-time GitHub Pages setup

1. Go to the repo on GitHub
2. Settings → Pages
3. Under "Build and deployment", set Source to **GitHub Actions**
4. The workflow will run automatically on the next push

Site URL: `https://oakshadeacres.github.io/oakshade`

### Deploying content changes

Use the **Deploy** button in the admin app header. This commits and pushes changes to `main`, which triggers the GitHub Actions workflow to rebuild and deploy the site.

### Pi setup

See `CLAUDE.md` for systemd setup instructions for the admin app.
