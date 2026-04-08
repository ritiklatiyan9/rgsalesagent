// Copy generated icons into Android mipmap resource directories
import sharp from 'sharp';
import { mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sourceImage = join(__dirname, 'src', 'assets', 'home.png');
const resDir = join(__dirname, 'android', 'app', 'src', 'main', 'res');

// Android mipmap sizes: mdpi=48, hdpi=72, xhdpi=96, xxhdpi=144, xxxhdpi=192
const mipmapSizes = [
  { folder: 'mipmap-mdpi',    size: 48  },
  { folder: 'mipmap-hdpi',    size: 72  },
  { folder: 'mipmap-xhdpi',   size: 96  },
  { folder: 'mipmap-xxhdpi',  size: 144 },
  { folder: 'mipmap-xxxhdpi', size: 192 },
];

// Foreground icon for adaptive icons (108dp base with 72dp icon area)
// Scale factor: foreground should be 108/48 * density-size
const foregroundSizes = [
  { folder: 'mipmap-mdpi',    size: 108 },
  { folder: 'mipmap-hdpi',    size: 162 },
  { folder: 'mipmap-xhdpi',   size: 216 },
  { folder: 'mipmap-xxhdpi',  size: 324 },
  { folder: 'mipmap-xxxhdpi', size: 432 },
];

for (const { folder, size } of mipmapSizes) {
  const dir = join(resDir, folder);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  // ic_launcher.png
  await sharp(sourceImage)
    .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .png()
    .toFile(join(dir, 'ic_launcher.png'));

  // ic_launcher_round.png (same icon)
  await sharp(sourceImage)
    .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .png()
    .toFile(join(dir, 'ic_launcher_round.png'));

  console.log(`✓ ${folder}: ic_launcher.png + ic_launcher_round.png (${size}x${size})`);
}

for (const { folder, size } of foregroundSizes) {
  const dir = join(resDir, folder);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  await sharp(sourceImage)
    .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .png()
    .toFile(join(dir, 'ic_launcher_foreground.png'));

  console.log(`✓ ${folder}: ic_launcher_foreground.png (${size}x${size})`);
}

// Also generate splash icon for drawable
const drawableDir = join(resDir, 'drawable');
if (!existsSync(drawableDir)) mkdirSync(drawableDir, { recursive: true });
await sharp(sourceImage).resize(512, 512, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } }).png().toFile(join(drawableDir, 'splash.png'));
console.log(`✓ drawable: splash.png (512x512)`);

console.log('\n✅ All Android icons replaced with RiverGreen real estate logo!');
