# SEO TODO

SEO checklist for Oakshade Acres. Items are grouped by who can act on them. Done items stay in this file as a record.

---

## 🧑‍🌾 Manual — things only you can do

These require accounts, money, or physical-world details I don't have.

### 1. Claim a Google Business Profile
**Highest-impact item on this list.** Free. Drives "chicks for sale near Dayton TX" Map + Knowledge Panel results.
- Go to https://business.google.com/create
- Search for "Oakshade Acres" — if it's not there, create a new listing
- Business name: `Oakshade Acres`
- Category: `Farm` (primary), secondary: `Poultry farm`
- Set service area to Liberty County, TX (or a radius around Dayton)
- Phone: `(936) 367-1974`
- Website: whatever your public URL is (currently `https://oakshadeacres.github.io/oakshade/`)
- Add hours (when you're willing to accept messages/visits — can be "by appointment")
- Add ~5–10 photos of birds + the farm — Google heavily weighs photo count for ranking
- Verify by postcard (takes ~5 business days)

### 2. Buy a custom domain
The current URL `oakshadeacres.github.io/oakshade` hurts ranking and looks less trustworthy.
- Check availability at a registrar (Namecheap, Cloudflare, or Google/Squarespace Domains). `oakshadeacres.com` is ideal.
- Once bought, in GitHub repo Settings → Pages → Custom domain, enter the domain.
- In your registrar's DNS, add these A records pointing at GitHub Pages:
  ```
  185.199.108.153
  185.199.109.153
  185.199.110.153
  185.199.111.153
  ```
  And a CNAME record: `www` → `oakshadeacres.github.io`
- Let me know when you've done this and I'll:
  - Remove the `base: '/oakshade'` from `astro.config.mjs`
  - Update `site:` in the same file
  - Move `robots.txt` into the build (right now a robots.txt under `/oakshade/robots.txt` would be ignored by crawlers — only the domain root works)

### 3. Submit the site to Google Search Console
- Go to https://search.google.com/search-console
- Add property using the `https://oakshadeacres.github.io/oakshade/` URL (or custom domain once set)
- Verify via the HTML-tag method (paste a `<meta>` tag — tell me and I'll add it to `Layout.astro`)
- After verification, submit your sitemap URL: `https://oakshadeacres.github.io/oakshade/sitemap-index.xml`
- Also submit to Bing Webmaster Tools (https://www.bing.com/webmasters) — same procedure, small but easy win

### 4. Supply farm details for structured data
The JSON-LD `LocalBusiness` block I added uses what's already in `site.json` plus a Dayton, TX locality. You can improve it by giving me any of the following — all optional:
- **Exact street address** (only if you're OK with it being public; otherwise leave it at city-level)
- **Latitude / longitude** of the farm (grab from Google Maps right-click → copy coordinates). Helps Google place you on the map.
- **Operating hours** (e.g. "Monday–Saturday by appointment")
- **Year established**

### 5. Content freshness habit
Google rewards sites that update. Use the admin's **Hatch Schedule** section regularly — every time you mark a variety as available/unavailable and hit Deploy, that's a freshness signal. Small farms almost never do this, so it's a differentiator.

---

## 🤖 Done — already implemented in the code

- **Open Graph + Twitter Card meta tags** in `Layout.astro` — links shared on Facebook/iMessage/Slack now show a proper preview card.
- **LocalBusiness JSON-LD** in `Layout.astro` — tells Google you're a farm in Dayton, TX with phone/email/FB. Auto-updates when contact info changes in the admin.
- **Canonical URL** — prevents duplicate-content ranking dilution.
- **Sharper default title** — `Oakshade Acres – English Orpingtons & Specialty Chicks | Dayton, TX`
- **Improved default description** — includes color varieties (Lavender, Chocolate, Jubilee) for long-tail searches.
- **Sitemap** (`@astrojs/sitemap` integration) — auto-generated at `sitemap-index.xml` on every build.
- **Server-rendered first breed image** — the static HTML now contains the initial image with a descriptive `alt`, so image-search crawlers see it without needing to run JS.
- **Better default alt text** on the About-section image.

---

## 📋 Optional follow-ups (ask me to do any of these)

- **Per-image alt text field in the admin** — right now alts derive from breed name + variety. You'd be able to type "Two-week-old chocolate chicks in brooder" instead.
- **Self-host Google Fonts** — currently loaded from `fonts.googleapis.com`, which adds a DNS + connection hop. Self-hosted is 50–150ms faster on mobile.
- **Add `robots.txt`** — low priority until you have a custom domain (GitHub Pages subpath robots.txt is ignored by crawlers).
- **OG image tuned for sharing** — the logo works but a 1200×630 landscape image (farm photo + "Oakshade Acres — Dayton, TX") would look better on Facebook.
- **Schema.org `Product` markup** for each breed — could appear in Google Shopping / rich results, but more effort than it's worth at this stage.
