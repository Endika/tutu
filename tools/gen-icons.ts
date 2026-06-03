import sharp from 'sharp';
import { join } from 'path';
import { existsSync } from 'fs';

const root = join(import.meta.dirname, '..');
const publicDir = join(root, 'public');
const inputSvg = join(publicDir, 'icon.svg');

if (!existsSync(inputSvg)) {
  process.stderr.write(`Missing input: ${inputSvg}\n`);
  process.exit(1);
}

interface IconSpec {
  name: string;
  size: number;
}

const icons: IconSpec[] = [
  { name: 'pwa-192.png', size: 192 },
  { name: 'pwa-512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
];

for (const icon of icons) {
  const out = join(publicDir, icon.name);
  await sharp(inputSvg).resize(icon.size, icon.size).png().toFile(out);
  process.stdout.write(`Generated ${icon.name} (${icon.size}x${icon.size})\n`);
}

// Maskable icon: render the icon at ~76% size (12% margin each side) onto a
// 512x512 canvas filled with the brand wood background color #b9763a.
const maskableSize = 512;
const iconSize = Math.round(maskableSize * 0.76); // leaves ~12% safe-zone padding each side
const padding = Math.round((maskableSize - iconSize) / 2);
const maskableOut = join(publicDir, 'pwa-maskable-512.png');
const iconBuffer = await sharp(inputSvg).resize(iconSize, iconSize).png().toBuffer();
await sharp({
  create: {
    width: maskableSize,
    height: maskableSize,
    channels: 4,
    background: { r: 0xb9, g: 0x76, b: 0x3a, alpha: 1 },
  },
})
  .composite([{ input: iconBuffer, left: padding, top: padding }])
  .png()
  .toFile(maskableOut);
process.stdout.write(`Generated pwa-maskable-512.png (${maskableSize}x${maskableSize} with safe-zone padding)\n`);

process.stdout.write('Icons generated.\n');
