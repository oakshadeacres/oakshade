# Oakshade Acres

Farm website for Oakshade Acres built with Astro 5 and Tailwind CSS. Features chickens and goats available for purchase using markdown-based content collections.

## Setup

1. Install dependencies: `npm install`
2. Start dev server: `npm run dev` (runs on localhost:4321)
3. Production build: `npm run build`

## Admin App

A local Express app for managing content (CRUD for animals, image uploads).

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

The main site deploys to Netlify. The admin app runs locally on a Raspberry Pi — see `CLAUDE.md` for systemd setup instructions.
