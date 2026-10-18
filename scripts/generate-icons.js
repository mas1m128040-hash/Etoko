import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// SVG dengan background oranye #FF6B1A dan simbol sendok & garpu (Utensils) putih
function createSvg(size, iconScale = 0.55) {
  const iconSize = Math.round(size * iconScale);
  const offset = Math.round((size - iconSize) / 2);

  // Path Lucide Utensils scale to iconSize
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#FF6B1A" />
  <g transform="translate(${offset}, ${offset}) scale(${iconSize / 24})">
    <path d="M18 2v6a3 3 0 0 1-3 3 3 3 0 0 1-3-3V2" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M15 2v19" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M5 2c0 3 2 5.5 5 5.5v13.5" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M5 2v5.5" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>
`.trim();
}

async function generate() {
  console.log('[generate-icons] Generating PWA icons...');

  // 1. icon.svg
  const svg512 = createSvg(512, 0.55);
  fs.writeFileSync(path.join(publicDir, 'icon.svg'), svg512, 'utf8');

  // 2. icon-192.png
  const svg192 = createSvg(192, 0.55);
  await sharp(Buffer.from(svg192))
    .png()
    .toFile(path.join(publicDir, 'icon-192.png'));

  // 3. icon-512.png
  await sharp(Buffer.from(svg512))
    .png()
    .toFile(path.join(publicDir, 'icon-512.png'));

  // 4. icon-maskable-512.png (scale 0.42 to stay safe within circle/squircle mask)
  const svgMaskable = createSvg(512, 0.42);
  await sharp(Buffer.from(svgMaskable))
    .png()
    .toFile(path.join(publicDir, 'icon-maskable-512.png'));

  // 5. apple-touch-icon.png (180x180)
  const svg180 = createSvg(180, 0.55);
  await sharp(Buffer.from(svg180))
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));

  console.log('[generate-icons] All icons generated successfully in public/');
}

generate().catch((err) => {
  console.error('[generate-icons] Error:', err);
  process.exit(1);
});
