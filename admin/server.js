const express = require('express');
const multer = require('multer');
const matter = require('gray-matter');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { applyWatermark } = require('./watermark');
const nodemailer = require('nodemailer');
const { createClient } = require('redis');
const { exec } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS;
if (!ADMIN_PASS) {
  console.error('FATAL: ADMIN_PASS is required. Set a strong password in admin/.env.');
  process.exit(1);
}

const PROJECT_ROOT = path.join(__dirname, '..');
const CONTENT_DIR = path.join(PROJECT_ROOT, 'src', 'content');
const BREEDS_DIR = path.join(CONTENT_DIR, 'breeds');
const SITE_JSON = path.join(CONTENT_DIR, 'site.json');
const IMAGES_DIR = path.join(PROJECT_ROOT, 'public', 'images');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const FOLLOWUP_QUEUE = 'followup_queue';
const redisClient = createClient({ url: REDIS_URL });
redisClient.on('error', err => console.error('Redis error:', err));
redisClient.connect().then(() => {
  console.log('  Connected to Redis at', REDIS_URL);
}).catch(err => {
  console.error('Failed to connect to Redis:', err.message);
});

app.use(express.json({ limit: '1mb' }));

// Public contact endpoint (registered BEFORE basic-auth middleware so it stays open).
const PUBLIC_ORIGIN = process.env.PUBLIC_ORIGIN || 'https://oakshadeorpingtons.com';
const DEV_ORIGINS = ['http://localhost:4321', 'http://localhost:4322'];
const contactRateLimit = new Map();

function setContactCors(req, res) {
  const origin = req.headers.origin;
  const allowed =
    origin === PUBLIC_ORIGIN ||
    (process.env.NODE_ENV !== 'production' && DEV_ORIGINS.includes(origin));
  if (allowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

let contactMailer = null;
function getContactMailer() {
  if (contactMailer) return contactMailer;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  const port = Number(SMTP_PORT) || 587;
  contactMailer = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return contactMailer;
}

function checkContactRateLimit(ip) {
  const WINDOW_MS = 10 * 60 * 1000;
  const MAX = 5;
  const now = Date.now();
  const rec = contactRateLimit.get(ip);
  if (!rec || rec.resetAt < now) {
    contactRateLimit.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (rec.count >= MAX) return false;
  rec.count += 1;
  return true;
}

app.options('/api/contact', (req, res) => {
  setContactCors(req, res);
  res.status(204).end();
});

app.post('/api/contact', async (req, res) => {
  setContactCors(req, res);
  const body = req.body || {};

  // Honeypot — silently accept so bots don't learn they were caught.
  if (body.website) return res.json({ ok: true });

  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  if (!checkContactRateLimit(ip)) {
    return res.status(429).json({ ok: false, error: 'Too many submissions, try again in a few minutes' });
  }

  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim();
  const message = String(body.message || '').trim();
  const phone = String(body.phone || '').trim();
  const interest = String(body.interest || '').trim();
  const breed = String(body.breed || '').trim();

  if (!name || name.length > 200) return res.status(400).json({ ok: false, error: 'Name is required' });
  if (!email || email.length > 200 || !/\S+@\S+\.\S+/.test(email)) return res.status(400).json({ ok: false, error: 'Valid email is required' });
  if (!message || message.length > 5000) return res.status(400).json({ ok: false, error: 'Message is required' });

  const CONTACT_TO = process.env.CONTACT_TO;
  const transporter = CONTACT_TO ? getContactMailer() : null;
  if (!CONTACT_TO || !transporter) {
    return res.status(503).json({ ok: false, error: 'Contact endpoint not yet configured' });
  }

  const subject = `Oakshade Acres Inquiry – ${interest || 'General'}`;
  const text = [
    `Name: ${name}`,
    `Email: ${email}`,
    `Phone: ${phone || 'Not provided'}`,
    `Interested In: ${interest || 'Not specified'}`,
    `Breed Interest: ${breed || 'Not specified'}`,
    '',
    'Message:',
    message,
  ].join('\n');

  try {
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: CONTACT_TO,
      replyTo: email,
      subject,
      text,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('Contact send failed:', err.message);
    res.status(500).json({ ok: false, error: 'Could not send right now. Please email us directly.' });
  }
});

app.use((req, res, next) => {
  // Auth is always required unless explicitly disabled for local dev.
  // Do NOT infer "local" from bind address or remote IP: a reverse proxy or
  // tunnel (e.g. cloudflared) makes all traffic appear to originate from
  // localhost, which would silently expose the admin to the internet.
  if (process.env.DISABLE_AUTH === '1') return next();
  const auth = req.headers.authorization;
  const expected = 'Basic ' + Buffer.from(`${ADMIN_USER}:${ADMIN_PASS}`).toString('base64');
  if (!auth || auth !== expected) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Oakshade Admin"');
    return res.status(401).send('Authentication required');
  }
  next();
});

app.use(express.static(path.join(__dirname, 'public')));
app.use('/images', express.static(IMAGES_DIR));
app.use('/vendor/cropperjs', express.static(path.join(__dirname, 'node_modules', 'cropperjs', 'dist')));

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    cb(null, allowed.includes(file.mimetype));
  },
  limits: { fileSize: 10 * 1024 * 1024 }
});

const IMAGE_CONFIG = {
  full: { maxWidth: 1600, quality: 82 },
  thumb: { maxWidth: 400, quality: 75 }
};

async function processImage(buffer, originalName, relativeDir) {
  const dir = path.join(IMAGES_DIR, relativeDir);
  fs.mkdirSync(dir, { recursive: true });

  const baseName = originalName
    .toLowerCase()
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'image';

  const timestamp = Date.now();
  const fullName = `${timestamp}-${baseName}.webp`;
  const thumbName = `${timestamp}-${baseName}-thumb.webp`;

  // Breed gallery photos get the watermark; site assets (logos etc.) stay clean.
  // Thumbs stay clean too — the mark would be illegible at 400px.
  const shouldWatermark = /^breeds(\/|$)/.test(relativeDir);
  let fullBuffer = await sharp(buffer)
    .rotate()
    .resize(IMAGE_CONFIG.full.maxWidth, null, { withoutEnlargement: true, fit: 'inside' })
    .toBuffer();
  if (shouldWatermark) fullBuffer = await applyWatermark(fullBuffer);
  await sharp(fullBuffer)
    .webp({ quality: IMAGE_CONFIG.full.quality })
    .toFile(path.join(dir, fullName));

  await sharp(buffer)
    .rotate()
    .resize(IMAGE_CONFIG.thumb.maxWidth, null, { withoutEnlargement: true, fit: 'inside' })
    .webp({ quality: IMAGE_CONFIG.thumb.quality })
    .toFile(path.join(dir, thumbName));

  return {
    full: `/images/${relativeDir}/${fullName}`,
    thumb: `/images/${relativeDir}/${thumbName}`
  };
}

function isValidImageTarget(target) {
  if (typeof target !== 'string' || !target) return false;
  if (target.includes('..')) return false;
  if (!/^[a-z0-9]+(\/[a-z0-9_-]+)?$/i.test(target)) return false;
  return true;
}

function isValidBreedId(id) {
  return typeof id === 'string' && /^[a-z0-9-]+$/.test(id);
}

function readBreed(id) {
  if (!isValidBreedId(id)) return null;
  const filepath = path.join(BREEDS_DIR, `${id}.md`);
  if (!fs.existsSync(filepath)) return null;
  const content = fs.readFileSync(filepath, 'utf-8');
  const { data } = matter(content);
  return { id, ...data };
}

function listBreeds() {
  if (!fs.existsSync(BREEDS_DIR)) return [];
  return fs.readdirSync(BREEDS_DIR)
    .filter(f => f.endsWith('.md'))
    .map(f => readBreed(f.replace(/\.md$/, '')))
    .filter(Boolean)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

function writeBreed(id, data) {
  fs.mkdirSync(BREEDS_DIR, { recursive: true });
  const out = {
    name: String(data.name || ''),
    specialty: Boolean(data.specialty),
    order: Number.isFinite(data.order) ? data.order : 0,
    description: String(data.description || ''),
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
  const filepath = path.join(BREEDS_DIR, `${id}.md`);
  fs.writeFileSync(filepath, matter.stringify('', out));
  return { id, ...out };
}

function readSite() {
  const raw = fs.readFileSync(SITE_JSON, 'utf-8');
  return JSON.parse(raw);
}

function writeSite(obj) {
  fs.writeFileSync(SITE_JSON, JSON.stringify(obj, null, 2) + '\n');
}

function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Breeds
app.get('/api/breeds', (req, res) => {
  res.json(listBreeds());
});

app.get('/api/breeds/:id', (req, res) => {
  const b = readBreed(req.params.id);
  if (!b) return res.status(404).json({ error: 'Not found' });
  res.json(b);
});

app.post('/api/breeds', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  const id = slugify(name);
  if (!id) return res.status(400).json({ error: 'Invalid name' });
  if (readBreed(id)) return res.status(409).json({ error: 'A breed with this name already exists' });
  const all = listBreeds();
  const maxOrder = all.length ? Math.max(...all.map(b => b.order ?? 0)) : 0;
  const saved = writeBreed(id, { ...req.body, name, order: maxOrder + 1 });
  res.status(201).json(saved);
});

app.put('/api/breeds/:id', (req, res) => {
  const { id } = req.params;
  const existing = readBreed(id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const saved = writeBreed(id, { ...existing, ...req.body });
  res.json(saved);
});

app.delete('/api/breeds/:id', (req, res) => {
  if (!isValidBreedId(req.params.id)) return res.status(400).json({ error: 'Invalid breed id' });
  const filepath = path.join(BREEDS_DIR, `${req.params.id}.md`);
  if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'Not found' });
  fs.unlinkSync(filepath);
  res.json({ success: true });
});

// Site content
app.get('/api/site', (req, res) => {
  try {
    res.json(readSite());
  } catch (err) {
    res.status(500).json({ error: 'Failed to read site.json', details: err.message });
  }
});

app.get('/api/site/:section', (req, res) => {
  try {
    const site = readSite();
    if (!(req.params.section in site)) return res.status(404).json({ error: 'Section not found' });
    res.json(site[req.params.section]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to read site.json' });
  }
});

app.put('/api/site/:section', (req, res) => {
  try {
    const site = readSite();
    site[req.params.section] = req.body;
    writeSite(site);
    res.json(site[req.params.section]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to write site.json', details: err.message });
  }
});

// Image uploads: target passed in `type` form field, e.g. 'breeds/orpingtons' or 'site'
app.post('/api/upload', upload.array('images', 10), async (req, res) => {
  const target = req.body.type;
  if (!isValidImageTarget(target)) return res.status(400).json({ error: 'Invalid target' });
  try {
    const results = await Promise.all(
      (req.files || []).map(f => processImage(f.buffer, f.originalname, target))
    );
    res.json({ images: results, urls: results.map(r => r.full) });
  } catch (err) {
    console.error('Image processing error:', err);
    res.status(500).json({ error: 'Failed to process images' });
  }
});

app.delete('/api/images', (req, res) => {
  const { path: imagePath } = req.body;
  if (!imagePath || !imagePath.startsWith('/images/') || imagePath.includes('..')) {
    return res.status(400).json({ error: 'Invalid path' });
  }
  const filepath = path.join(PROJECT_ROOT, 'public', imagePath);
  if (fs.existsSync(filepath)) fs.unlinkSync(filepath);

  const thumbPath = imagePath.replace(/\.webp$/, '-thumb.webp');
  const thumbFilepath = path.join(PROJECT_ROOT, 'public', thumbPath);
  if (fs.existsSync(thumbFilepath)) fs.unlinkSync(thumbFilepath);

  if (imagePath.includes('-thumb.webp')) {
    const fullFilepath = path.join(PROJECT_ROOT, 'public', imagePath.replace('-thumb.webp', '.webp'));
    if (fs.existsSync(fullFilepath)) fs.unlinkSync(fullFilepath);
  }
  res.json({ success: true });
});

// --- Auto-restart when server.js changes on disk -------------------------
// The admin is a long-lived process: its handler logic lives in memory, so a
// freshly pulled server.js (via Deploy's git pull, or a manual git pull) has
// no effect until the process restarts — and stale handlers can silently
// corrupt content. Watch this file and exit on change so the service
// supervisor (systemd: Restart=on-failure/always) relaunches with fresh code.
let deployInProgress = false;
let restartArmed = false;

function requestRestart(reason) {
  if (deployInProgress) { restartArmed = true; return; }
  console.log(`${reason} — exiting so the service restarts with fresh code`);
  process.exit(1);
}

function watchForCodeChanges() {
  // Only auto-exit when a supervisor will relaunch us. systemd sets
  // INVOCATION_ID; set RESTART_ON_CHANGE=1 to force it in other setups.
  if (!process.env.INVOCATION_ID && process.env.RESTART_ON_CHANGE !== '1') return;
  let timer = null;
  fs.watchFile(__filename, { interval: 2000 }, (curr, prev) => {
    if (!curr.mtimeMs || curr.mtimeMs === prev.mtimeMs) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => requestRestart('server.js changed on disk'), 1000);
  });
  console.log('  Auto-restart on server.js change: enabled');
}

// Deploy
app.post('/api/deploy', (req, res) => {
  deployInProgress = true;
  const timestamp = new Date().toISOString();
  const commitMsg = `Content update ${timestamp}`;
  // Stage any local edits, commit if there are staged changes, rebase onto
  // remote to integrate work from other machines (e.g. the dev box pushing
  // directly), then push. Pulling before pushing prevents the "fetch first"
  // rejection that occurs when two admin instances deploy independently.
  const cmd = [
    'git add -A',
    `git diff --cached --quiet || git commit -m "${commitMsg}"`,
    'git pull --rebase origin main',
    'git push origin main',
  ].join(' && ');
  exec(cmd, { cwd: PROJECT_ROOT }, (err, stdout, stderr) => {
    deployInProgress = false;
    // If the pull updated server.js mid-deploy, restart now that we're idle.
    const finish = () => {
      if (!restartArmed) return;
      restartArmed = false;
      setTimeout(() => requestRestart('server.js updated by deploy'), 500);
    };
    if (err) {
      console.error('Deploy failed:', stderr);
      res.status(500).json({ error: 'Deploy failed', details: stderr });
      return finish();
    }
    const nothingNew =
      stdout.includes('Everything up-to-date') &&
      !stdout.includes('main ->');
    if (nothingNew) {
      res.json({ success: true, message: 'No changes to deploy' });
      return finish();
    }
    console.log('Deploy successful:', stdout);
    res.json({ success: true, message: 'Deployed successfully' });
    finish();
  });
});

// Followups (unchanged)
app.get('/api/followups', async (req, res) => {
  try {
    const items = await redisClient.lRange(FOLLOWUP_QUEUE, 0, -1);
    const followups = items.map((item, index) => ({ index, ...JSON.parse(item) }));
    res.json(followups);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get followups' });
  }
});

app.get('/api/followups/count', async (req, res) => {
  try {
    const count = await redisClient.lLen(FOLLOWUP_QUEUE);
    res.json({ count });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get followup count' });
  }
});

app.delete('/api/followups/:index', async (req, res) => {
  try {
    const index = parseInt(req.params.index, 10);
    const items = await redisClient.lRange(FOLLOWUP_QUEUE, 0, -1);
    if (index < 0 || index >= items.length) {
      return res.status(404).json({ error: 'Followup not found' });
    }
    const sentinel = '__REMOVED__';
    await redisClient.lSet(FOLLOWUP_QUEUE, index, sentinel);
    await redisClient.lRem(FOLLOWUP_QUEUE, 1, sentinel);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete followup' });
  }
});

// Legacy routes — return 410 Gone so the old admin UI can't corrupt new shape
const legacyPaths = ['/api/animals', '/api/animals/:type', '/api/animals/:type/:id', '/api/upload/:type'];
legacyPaths.forEach(p => {
  app.all(p, (req, res) => res.status(410).json({ error: 'Gone: admin has been rewritten for breeds + site.json' }));
});

app.listen(PORT, HOST, () => {
  console.log(`
  Oakshade Admin running at:
    Local:   http://localhost:${PORT}
    Network: http://${HOST === '0.0.0.0' ? '<your-ip>' : HOST}:${PORT}

  Auth: ${process.env.DISABLE_AUTH === '1' ? 'DISABLED (DISABLE_AUTH=1)' : 'enabled'}
  User: ${ADMIN_USER}
  `);
  watchForCodeChanges();
});
