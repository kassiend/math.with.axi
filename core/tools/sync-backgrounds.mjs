#!/usr/bin/env node
/**
 * Copies backgrounds from assets/images/bg/ into web/public/bg/ so Vite bundles them into the
 * page Playwright captures.
 *
 * The background belongs to the lesson page, not to the Remotion composition: the captured frame
 * then already carries it, and the lesson text is composed against the real background rather
 * than against a placeholder that gets swapped underneath it later. Remotion only adds the
 * mascot on top.
 *
 * Run after adding a background:  node core/tools/sync-backgrounds.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { ASSETS, CORE } from '../pipeline/lib/paths.mjs';

const src = path.join(ASSETS, 'images', 'bg');
const dest = path.join(CORE, 'web', 'public', 'bg');

if (!fs.existsSync(src)) {
  console.error(`no backgrounds at ${src}`);
  process.exit(2);
}

fs.mkdirSync(dest, { recursive: true });
const files = fs.readdirSync(src).filter((f) => /\.(jpe?g|png|webp|avif)$/i.test(f));

if (!files.length) {
  console.error(`no image files in ${src}`);
  process.exit(2);
}

for (const f of files) {
  fs.copyFileSync(path.join(src, f), path.join(dest, f));
  console.log(`✓ ${f}`);
}

// The page needs to know what exists without a directory listing at runtime.
const manifest = { backgrounds: files.sort() };
fs.writeFileSync(path.join(dest, 'index.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`\n${files.length} background(s) → web/public/bg/`);
console.log('Rebuild the page for these to reach a capture:  npm run web:build');
