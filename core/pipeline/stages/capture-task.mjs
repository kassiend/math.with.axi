/**
 * Playwright capture for a daily-task post.
 *
 * Same contract as the lesson capture, two differences:
 *   - the viewport is the 720x1280 design frame at deviceScaleFactor 1.5, so the PNGs come out
 *     at 1080x1920 while the page keeps working in design units
 *   - the page reports whether the statement fitted inside the ring, and a failure there fails
 *     the run. The template makes that a hard gate: a statement over the ring is a defect the
 *     viewer sees, and shipping it is worse than not shipping the post.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';
import { CORE } from '../lib/paths.mjs';

export const DESIGN_W = 720;
export const DESIGN_H = 1280;
export const SCALE = 1.5;            // -> 1080x1920
export const FPS = 30;

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf',
};

function serve(rootDir) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
      let file = path.join(rootDir, url === '/' ? 'task.html' : url);
      if (!file.startsWith(rootDir)) { res.writeHead(403).end(); return; }
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(rootDir, 'task.html');
      if (!fs.existsSync(file)) { res.writeHead(404).end(); return; }
      res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

export class StatementDoesNotFit extends Error {}

/**
 * @param {{dir:string,id:string}} run
 * @param {object} task  payload plus `background`, `seed`, `still`, `hurry_audio_seconds`
 */
export async function captureTask(run, task, opts = {}) {
  const webDist = opts.webDist ?? path.join(CORE, 'web', 'dist');
  if (!fs.existsSync(path.join(webDist, 'task.html'))) {
    throw new Error(`task page not built at ${webDist} — run "npm run web:build"`);
  }

  const outDir = path.join(CORE, 'video', 'public', 'captures', run.id);
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const { server, port } = await serve(webDist);
  const browser = await chromium.launch({
    args: ['--force-color-profile=srgb', '--font-render-hinting=none', '--disable-lcd-text'],
  });

  try {
    const page = await browser.newPage({
      viewport: { width: DESIGN_W, height: DESIGN_H },
      deviceScaleFactor: SCALE,
      locale: 'en-US',
      timezoneId: 'UTC',
      reducedMotion: 'reduce',
    });

    await page.addInitScript((payload) => { window.__AXI_TASK = payload; }, task);
    await page.goto(`http://127.0.0.1:${port}/task.html`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__axiReady === true, null, { timeout: 30_000 });

    const fit = await page.evaluate(() => window.__axiFit ?? null);
    if (!fit?.fits) {
      throw new StatementDoesNotFit(fit?.reason ?? 'the page reported no fit result');
    }

    const frames = opts.frames ?? await page.evaluate(() => window.__axiFrameCount ?? 0);
    if (!frames) throw new Error('page reported no frames');

    const manifest = {
      run_id: run.id, width: DESIGN_W * SCALE, height: DESIGN_H * SCALE,
      fps: FPS, frames, fit, files: [],
    };

    const started = Date.now();
    for (let f = 0; f < frames; f++) {
      await page.evaluate((frame) => window.__axiSeek(frame), f);
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r())));
      const name = `frame-${String(f).padStart(5, '0')}.png`;
      await page.screenshot({ path: path.join(outDir, name), animations: 'disabled' });
      manifest.files.push(name);
      if (opts.onProgress && (f % 50 === 0 || f === frames - 1)) {
        opts.onProgress(f + 1, frames, Date.now() - started);
      }
    }

    fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
    fs.writeFileSync(path.join(run.dir, 'capture.json'), JSON.stringify({ ...manifest, dir: outDir }, null, 2));
    return { ...manifest, dir: outDir, publicPath: `captures/${run.id}` };
  } finally {
    await browser.close();
    server.close();
  }
}
