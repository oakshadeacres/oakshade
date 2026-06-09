// One-time pass: stamp the watermark onto existing breed gallery photos.
//
//   node scripts/watermark-existing.js --yes
//
// WARNING: overwrites the webp files in place. Running it twice stamps the
// mark twice — only run on photos that don't already carry it.
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { applyWatermark } = require('../watermark');

const BREEDS_IMAGES = path.join(__dirname, '..', '..', 'public', 'images', 'breeds');
const QUALITY = 82; // matches IMAGE_CONFIG.full in server.js

if (!process.argv.includes('--yes')) {
  console.error('This overwrites every breed gallery photo in place (thumbs excluded).');
  console.error('Re-run with --yes to proceed. Do NOT run twice — it double-stamps.');
  process.exit(1);
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return full;
  });
}

(async () => {
  const files = walk(BREEDS_IMAGES).filter(
    (f) => f.endsWith('.webp') && !f.endsWith('-thumb.webp')
  );
  console.log(`Watermarking ${files.length} photos…`);
  for (const file of files) {
    const marked = await applyWatermark(fs.readFileSync(file));
    await sharp(marked).webp({ quality: QUALITY }).toFile(file + '.tmp');
    fs.renameSync(file + '.tmp', file);
    console.log('  ✓ ' + path.relative(BREEDS_IMAGES, file));
  }
  console.log('Done.');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
