// Copy generated icons into Android mipmap resource directories
import sharp from 'sharp';
import { readFileSync, mkdirSync, existsSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const svgInput = readFileSync(join(__dirname, 'public', 'icon.svg'));
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
  await sharp(svgInput)
    .resize(size, size)
    .png()
    .toFile(join(dir, 'ic_launcher.png'));

  // ic_launcher_round.png (same icon)
  await sharp(svgInput)
    .resize(size, size)
    .png()
    .toFile(join(dir, 'ic_launcher_round.png'));

  console.log(`✓ ${folder}: ic_launcher.png + ic_launcher_round.png (${size}x${size})`);
}

for (const { folder, size } of foregroundSizes) {
  const dir = join(resDir, folder);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  await sharp(svgInput)
    .resize(size, size)
    .png()
    .toFile(join(dir, 'ic_launcher_foreground.png'));

  console.log(`✓ ${folder}: ic_launcher_foreground.png (${size}x${size})`);
}

// Also generate splash icon for drawable
const drawableDir = join(resDir, 'drawable');
if (!existsSync(drawableDir)) mkdirSync(drawableDir, { recursive: true });
await sharp(svgInput).resize(512, 512).png().toFile(join(drawableDir, 'splash.png'));
console.log(`✓ drawable: splash.png (512x512)`);

console.log('\n✅ All Android icons replaced with RiverGreen real estate logo!');
