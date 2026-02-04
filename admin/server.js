const express = require('express');
const multer = require('multer');
const matter = require('gray-matter');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { createClient } = require('redis');
const { exec } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

// Authentication credentials (set via environment variables in production)
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'oakshade123';

// Paths relative to the main project
const PROJECT_ROOT = path.join(__dirname, '..');
const CONTENT_DIR = path.join(PROJECT_ROOT, 'src', 'content');
const IMAGES_DIR = path.join(PROJECT_ROOT, 'public', 'images');

// Redis for followup queue (shared with chick-bot)
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const FOLLOWUP_QUEUE = 'followup_queue';
const redisClient = createClient({ url: REDIS_URL });
redisClient.on('error', err => console.error('Redis error:', err));
redisClient.connect().then(() => {
  console.log('  Connected to Redis at', REDIS_URL);
}).catch(err => {
  console.error('Failed to connect to Redis:', err.message);
});

// Middleware
app.use(express.json());

// Basic authentication
app.use((req, res, next) => {
  // Skip auth for local development if desired
  if (HOST === '127.0.0.1' && !process.env.REQUIRE_AUTH) {
    return next();
  }

  const auth = req.headers.authorization;
  const expected = 'Basic ' + Buffer.from(`${ADMIN_USER}:${ADMIN_PASS}`).toString('base64');

  if (!auth || auth !== expected) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Oakshade Admin"');
    return res.status(401).send('Authentication required');
  }
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

// Serve images from main project for preview
app.use('/images', express.static(IMAGES_DIR));

// Configure multer for image uploads (memory storage for processing)
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    cb(null, allowed.includes(file.mimetype));
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// Image processing settings
const IMAGE_CONFIG = {
  full: { maxWidth: 1200, quality: 80 },
  thumb: { maxWidth: 400, quality: 75 }
};

// Process and save image
async function processImage(buffer, originalName, type) {
  const dir = path.join(IMAGES_DIR, type);
  fs.mkdirSync(dir, { recursive: true });

  // Generate safe base name
  const baseName = originalName
    .toLowerCase()
    .replace(/\.[^.]+$/, '') // Remove extension
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  const timestamp = Date.now();
  const fullName = `${timestamp}-${baseName}.webp`;
  const thumbName = `${timestamp}-${baseName}-thumb.webp`;

  // Process full-size image
  await sharp(buffer)
    .resize(IMAGE_CONFIG.full.maxWidth, null, {
      withoutEnlargement: true,
      fit: 'inside'
    })
    .webp({ quality: IMAGE_CONFIG.full.quality })
    .toFile(path.join(dir, fullName));

  // Process thumbnail
  await sharp(buffer)
    .resize(IMAGE_CONFIG.thumb.maxWidth, null, {
      withoutEnlargement: true,
      fit: 'inside'
    })
    .webp({ quality: IMAGE_CONFIG.thumb.quality })
    .toFile(path.join(dir, thumbName));

  return {
    full: `/images/${type}/${fullName}`,
    thumb: `/images/${type}/${thumbName}`
  };
}

// Helper: Read all animals of a type
function getAnimals(type) {
  const dir = path.join(CONTENT_DIR, type);
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .map(filename => {
      const filepath = path.join(dir, filename);
      const content = fs.readFileSync(filepath, 'utf-8');
      const { data } = matter(content);
      return {
        id: filename.replace('.md', ''),
        filename,
        ...data
      };
    });
}

// Helper: Read single animal
function getAnimal(type, id) {
  const filepath = path.join(CONTENT_DIR, type, `${id}.md`);
  if (!fs.existsSync(filepath)) return null;

  const content = fs.readFileSync(filepath, 'utf-8');
  const { data } = matter(content);
  return { id, ...data };
}

// Helper: Save animal to markdown
function saveAnimal(type, id, data) {
  const dir = path.join(CONTENT_DIR, type);
  fs.mkdirSync(dir, { recursive: true });

  const filepath = path.join(dir, `${id}.md`);
  const frontmatter = matter.stringify('', {
    name: data.name,
    images: data.images || [],
    description: data.description,
    availability: data.availability
  });

  fs.writeFileSync(filepath, frontmatter);
  return { id, ...data };
}

// Helper: Generate slug from name
function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// API Routes

// GET /api/animals - List all animals
app.get('/api/animals', (req, res) => {
  const chickens = getAnimals('chickens').map(a => ({ ...a, type: 'chickens' }));
  const goats = getAnimals('goats').map(a => ({ ...a, type: 'goats' }));
  res.json({ chickens, goats });
});

// GET /api/animals/:type/:id - Get single animal
app.get('/api/animals/:type/:id', (req, res) => {
  const { type, id } = req.params;
  if (!['chickens', 'goats'].includes(type)) {
    return res.status(400).json({ error: 'Invalid type' });
  }

  const animal = getAnimal(type, id);
  if (!animal) {
    return res.status(404).json({ error: 'Not found' });
  }

  res.json(animal);
});

// POST /api/animals/:type - Create new animal
app.post('/api/animals/:type', (req, res) => {
  const { type } = req.params;
  if (!['chickens', 'goats'].includes(type)) {
    return res.status(400).json({ error: 'Invalid type' });
  }

  const { name, description, availability, images } = req.body;
  if (!name || !description || !availability) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const id = generateSlug(name);

  // Check if already exists
  if (getAnimal(type, id)) {
    return res.status(409).json({ error: 'An animal with this name already exists' });
  }

  const animal = saveAnimal(type, id, { name, description, availability, images: images || [] });
  res.status(201).json(animal);
});

// PUT /api/animals/:type/:id - Update animal
app.put('/api/animals/:type/:id', (req, res) => {
  const { type, id } = req.params;
  if (!['chickens', 'goats'].includes(type)) {
    return res.status(400).json({ error: 'Invalid type' });
  }

  const existing = getAnimal(type, id);
  if (!existing) {
    return res.status(404).json({ error: 'Not found' });
  }

  const { name, description, availability, images } = req.body;
  const animal = saveAnimal(type, id, {
    name: name || existing.name,
    description: description || existing.description,
    availability: availability || existing.availability,
    images: images || existing.images || []
  });

  res.json(animal);
});

// DELETE /api/animals/:type/:id - Delete animal
app.delete('/api/animals/:type/:id', (req, res) => {
  const { type, id } = req.params;
  if (!['chickens', 'goats'].includes(type)) {
    return res.status(400).json({ error: 'Invalid type' });
  }

  const filepath = path.join(CONTENT_DIR, type, `${id}.md`);
  if (!fs.existsSync(filepath)) {
    return res.status(404).json({ error: 'Not found' });
  }

  fs.unlinkSync(filepath);
  res.json({ success: true });
});

// POST /api/upload/:type - Upload and process images
app.post('/api/upload/:type', upload.array('images', 10), async (req, res) => {
  const { type } = req.params;
  if (!['chickens', 'goats'].includes(type)) {
    return res.status(400).json({ error: 'Invalid type' });
  }

  try {
    const results = await Promise.all(
      req.files.map(f => processImage(f.buffer, f.originalname, type))
    );

    // Return both full URLs (for content) and thumb URLs (for previews)
    res.json({
      images: results,
      urls: results.map(r => r.full) // Backwards compatible
    });
  } catch (err) {
    console.error('Image processing error:', err);
    res.status(500).json({ error: 'Failed to process images' });
  }
});

// DELETE /api/images - Delete an image (and its thumbnail)
app.delete('/api/images', (req, res) => {
  const { path: imagePath } = req.body;
  if (!imagePath || !imagePath.startsWith('/images/')) {
    return res.status(400).json({ error: 'Invalid path' });
  }

  const filepath = path.join(PROJECT_ROOT, 'public', imagePath);
  if (!fs.existsSync(filepath)) {
    return res.status(404).json({ error: 'Image not found' });
  }

  // Delete main image
  fs.unlinkSync(filepath);

  // Also delete thumbnail if it exists
  const thumbPath = imagePath.replace('.webp', '-thumb.webp');
  const thumbFilepath = path.join(PROJECT_ROOT, 'public', thumbPath);
  if (fs.existsSync(thumbFilepath)) {
    fs.unlinkSync(thumbFilepath);
  }

  // If deleting a thumb, also try to delete the full version
  if (imagePath.includes('-thumb.webp')) {
    const fullPath = imagePath.replace('-thumb.webp', '.webp');
    const fullFilepath = path.join(PROJECT_ROOT, 'public', fullPath);
    if (fs.existsSync(fullFilepath)) {
      fs.unlinkSync(fullFilepath);
    }
  }

  res.json({ success: true });
});

// Deploy API - commit and push to trigger GitHub Actions

app.post('/api/deploy', (req, res) => {
  const timestamp = new Date().toISOString();
  const commitMsg = `Content update ${timestamp}`;

  exec(
    `git add -A && git commit -m "${commitMsg}" && git push`,
    { cwd: PROJECT_ROOT },
    (err, stdout, stderr) => {
      if (err) {
        // Check if it's just "nothing to commit"
        if (stderr.includes('nothing to commit') || stdout.includes('nothing to commit')) {
          return res.json({ success: true, message: 'No changes to deploy' });
        }
        console.error('Deploy failed:', stderr);
        return res.status(500).json({ error: 'Deploy failed', details: stderr });
      }
      console.log('Deploy successful:', stdout);
      res.json({ success: true, message: 'Deployed successfully' });
    }
  );
});

// Followup Queue API

// GET /api/followups - List all followups
app.get('/api/followups', async (req, res) => {
  try {
    const items = await redisClient.lRange(FOLLOWUP_QUEUE, 0, -1);
    const followups = items.map((item, index) => ({ index, ...JSON.parse(item) }));
    res.json(followups);
  } catch (err) {
    console.error('Failed to get followups:', err);
    res.status(500).json({ error: 'Failed to get followups' });
  }
});

// GET /api/followups/count - Get count of pending followups
app.get('/api/followups/count', async (req, res) => {
  try {
    const count = await redisClient.lLen(FOLLOWUP_QUEUE);
    res.json({ count });
  } catch (err) {
    console.error('Failed to get followup count:', err);
    res.status(500).json({ error: 'Failed to get followup count' });
  }
});

// DELETE /api/followups/:index - Remove a followup by index
app.delete('/api/followups/:index', async (req, res) => {
  try {
    const index = parseInt(req.params.index, 10);
    const items = await redisClient.lRange(FOLLOWUP_QUEUE, 0, -1);
    if (index < 0 || index >= items.length) {
      return res.status(404).json({ error: 'Followup not found' });
    }
    // Mark the item with a sentinel value, then remove it
    const sentinel = '__REMOVED__';
    await redisClient.lSet(FOLLOWUP_QUEUE, index, sentinel);
    await redisClient.lRem(FOLLOWUP_QUEUE, 1, sentinel);
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to delete followup:', err);
    res.status(500).json({ error: 'Failed to delete followup' });
  }
});

// Start server
app.listen(PORT, HOST, () => {
  const localUrl = `http://localhost:${PORT}`;
  const networkUrl = HOST === '0.0.0.0' ? `http://<your-ip>:${PORT}` : `http://${HOST}:${PORT}`;

  console.log(`
  Oakshade Admin running at:
    Local:   ${localUrl}
    Network: ${networkUrl}

  Authentication: ${HOST === '127.0.0.1' && !process.env.REQUIRE_AUTH ? 'disabled (localhost)' : 'enabled'}
  Username: ${ADMIN_USER}
  `);
});
