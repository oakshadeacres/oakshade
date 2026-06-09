const path = require('path');
const sharp = require('sharp');

const WATERMARK_PATH = path.join(__dirname, 'watermark.svg');
// Fraction of the photo width the mark occupies, and its inset from the corner.
const WIDTH_FRACTION = 0.16;
const MARGIN_FRACTION = 0.03;

// Composites the white Oakshade mark (opacity baked into the SVG) onto the
// bottom-right corner of the image. Returns a buffer in the input format.
async function applyWatermark(imageBuffer) {
  const meta = await sharp(imageBuffer).metadata();
  const wmWidth = Math.max(24, Math.round(meta.width * WIDTH_FRACTION));
  const margin = Math.round(meta.width * MARGIN_FRACTION);
  const wm = await sharp(WATERMARK_PATH).resize({ width: wmWidth }).png().toBuffer();
  const wmMeta = await sharp(wm).metadata();
  return sharp(imageBuffer)
    .composite([{
      input: wm,
      top: Math.max(0, meta.height - wmMeta.height - margin),
      left: Math.max(0, meta.width - wmMeta.width - margin),
    }])
    .toBuffer();
}

module.exports = { applyWatermark };
