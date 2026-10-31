import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const dest = 'www';

// Clean
rmSync(dest, { recursive: true, force: true });
mkdirSync(dest);

// Copy assets
const assetsToCopy = [
  'index.html',
  'manifest.webmanifest',
  'service-worker.js',
  'src',
  'icons',
  'vendor'
];

assetsToCopy.forEach(asset => {
  try {
    cpSync(asset, join(dest, asset), { recursive: true });
  } catch (err) {
    console.error(`Error copying ${asset}:`, err);
    process.exit(1);
  }
});

console.log('Build successful');
