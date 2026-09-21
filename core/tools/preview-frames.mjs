#!/usr/bin/env node
/**
 * Seek a handful of frames of a built page with a payload and tile them into one PNG — the
 * cheap way to look at a layout without a full capture.
 *
 *   node tools/preview-frames.mjs <page.html> <payload.json> <f1,f2,...> <out.png>
 */
import fs from 'node:fs'; import http from 'node:http'; import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { CORE } from '../pipeline/lib/paths.mjs';
import { FFMPEG } from '../pipeline/lib/platform.mjs';

const [,, page_, payloadFile, framesArg, out] = process.argv;
const dist = path.join(CORE, 'web', 'dist');
const payload = JSON.parse(fs.readFileSync(payloadFile, 'utf8'));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.woff2': 'font/woff2', '.woff': 'font/woff', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  let f = path.join(dist, url === '/' ? page_ : url);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(dist, page_);
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] ?? 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 720, height: 1280 }, deviceScaleFactor: 0.5 });
page.on('console', (m) => console.log('[page]', m.text()));
await page.addInitScript((p) => { window.__AXI_LESSON = p; window.__AXI_TASK = p; window.__AXI_STORY = p; }, payload);
await page.goto(`http://127.0.0.1:${server.address().port}/${page_}`);
await page.waitForFunction(() => window.__axiReady === true, null, { timeout: 30000 });
const fit = await page.evaluate(() => window.__axiFit);
console.log('frames', await page.evaluate(() => window.__axiFrameCount), 'fits', fit?.fits, fit?.fits ? '' : JSON.stringify(fit?.problems));
const dir = path.dirname(out); const files = [];
for (const f of framesArg.split(',').map(Number)) {
  await page.evaluate((n) => window.__axiSeek(n), f);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r())));
  const file = path.join(dir, `f${f}.png`); await page.screenshot({ path: file }); files.push(file);
}
await browser.close(); server.close();
const cols = Math.min(files.length, 6); const rows = Math.ceil(files.length / cols);
const rowFiles = [];
for (let r = 0; r < rows; r++) {
  const row = files.slice(r * cols, (r + 1) * cols); const rowOut = path.join(dir, `row${r}.png`);
  if (row.length === 1) fs.copyFileSync(row[0], rowOut);
  else execFileSync(FFMPEG, ['-y', '-v', 'error', ...row.flatMap((f) => ['-i', f]), '-filter_complex', `hstack=inputs=${row.length}`, rowOut]);
  rowFiles.push(rowOut);
}
if (rowFiles.length === 1) fs.copyFileSync(rowFiles[0], out);
else {
  const w = 360 * cols;
  execFileSync(FFMPEG, ['-y', '-v', 'error', ...rowFiles.flatMap((f) => ['-i', f]), '-filter_complex',
    rowFiles.map((_, i) => `[${i}:v]pad=${w}:ih:0:0:black[p${i}]`).join(';') + ';' + rowFiles.map((_, i) => `[p${i}]`).join('') + `vstack=inputs=${rowFiles.length}`, out]);
}
[...files, ...rowFiles].forEach((f) => fs.unlinkSync(f));
console.log('wrote', out);
