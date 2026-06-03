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

process.stdout.write('Icons generated.\n');
