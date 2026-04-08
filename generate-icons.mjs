// Generate PNG icons from source image for Capacitor Android
import sharp from 'sharp';
import { mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sourceImage = join(__dirname, 'src', 'assets', 'home.png');

const icons = [
  { name: 'public/icon-192.png', size: 192 },
  { name: 'public/icon-512.png', size: 512 },
  // Android adaptive icon layers (foreground)
  { name: 'public/icon-48.png',  size: 48 },
  { name: 'public/icon-72.png',  size: 72 },
  { name: 'public/icon-96.png',  size: 96 },
  { name: 'public/icon-144.png', size: 144 },
];

for (const { name, size } of icons) {
  const outPath = join(__dirname, name);
  const dir = dirname(outPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  await sharp(sourceImage).resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } }).png().toFile(outPath);
  console.log(`✓ ${name} (${size}x${size})`);
}

console.log('\nAll icons generated!');
