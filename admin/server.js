const express = require('express');
const multer = require('multer');
const matter = require('gray-matter');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;

// Paths relative to the main project
const PROJECT_ROOT = path.join(__dirname, '..');
const CONTENT_DIR = path.join(PROJECT_ROOT, 'src', 'content');
const IMAGES_DIR = path.join(PROJECT_ROOT, 'public', 'images');

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Serve images from main project for preview
app.use('/images', express.static(IMAGES_DIR));

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const type = req.params.type || req.body.type || 'chickens';
    const dir = path.join(IMAGES_DIR, type);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    // Sanitize filename
    const safeName = file.originalname
      .toLowerCase()
      .replace(/[^a-z0-9.]/g, '-')
      .replace(/-+/g, '-');
    cb(null, `${Date.now()}-${safeName}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    cb(null, allowed.includes(file.mimetype));
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

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

// POST /api/upload/:type - Upload images
app.post('/api/upload/:type', upload.array('images', 10), (req, res) => {
  const { type } = req.params;
  if (!['chickens', 'goats'].includes(type)) {
    return res.status(400).json({ error: 'Invalid type' });
  }

  const urls = req.files.map(f => `/images/${type}/${f.filename}`);
  res.json({ urls });
});

// DELETE /api/images - Delete an image
app.delete('/api/images', (req, res) => {
  const { path: imagePath } = req.body;
  if (!imagePath || !imagePath.startsWith('/images/')) {
    return res.status(400).json({ error: 'Invalid path' });
  }

  const filepath = path.join(PROJECT_ROOT, 'public', imagePath);
  if (!fs.existsSync(filepath)) {
    return res.status(404).json({ error: 'Image not found' });
  }

  fs.unlinkSync(filepath);
  res.json({ success: true });
});

// Start server
app.listen(PORT, '127.0.0.1', () => {
  console.log(`\n  Oakshade Admin running at http://localhost:${PORT}\n`);
});
