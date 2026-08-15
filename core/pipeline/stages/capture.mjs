/**
 * Stage 4 — Playwright capture.
 *
 * Per the run decision on the render architecture: the lesson is a web page, Playwright captures
 * it frame by frame, and Remotion composes the result. This stage produces a deterministic PNG
 * sequence, not a video — timing belongs to Remotion.
 *
 * Determinism is the whole game here, and three things buy it:
 *   1. KaTeX renders synchronously, so a screenshot cannot land mid-typeset (this is why §4.3
 *      chose KaTeX over MathJax).
 *   2. The page exposes __axiSeek(frame) and drives every animation from that number. Nothing
 *      is time-based, so nothing depends on how fast the capture loop runs.
 *   3. We wait on document.fonts.ready and an explicit __axiReady flag before the first frame.
 *
 * Output goes into video/public/captures/<runId>/ so Remotion can staticFile() it.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';
import { CORE } from '../lib/paths.mjs';

export const WIDTH = 1080;
export const HEIGHT = 1920;
export const FPS = 30;

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
  '.woff': 'font/woff', '.ttf': 'font/ttf',
};

/** Minimal static server over the built web page. No dev server: HMR is nondeterminism. */
function serve(rootDir) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
      let file = path.join(rootDir, url === '/' ? 'index.html' : url);
      if (!file.startsWith(rootDir)) { res.writeHead(403).end(); return; }
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(rootDir, 'index.html');
      if (!fs.existsSync(file)) { res.writeHead(404).end(); return; }
      res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

/**
 * @param {{dir:string,id:string}} run
 * @param {object} lesson  the edited, verified lesson payload
 * @param {{frames?:number, webDist?:string}} [opts]
 */
export async function capture(run, lesson, opts = {}) {
  const webDist = opts.webDist ?? path.join(CORE, 'web', 'dist');
  if (!fs.existsSync(path.join(webDist, 'index.html'))) {
    throw new Error(`web page not built at ${webDist} — run "npm run web:build" first`);
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
      viewport: { width: WIDTH, height: HEIGHT },
      deviceScaleFactor: 1,
      // Fixed, so a machine with a different locale does not render different digits.
      locale: 'en-US',
      timezoneId: 'UTC',
      reducedMotion: 'reduce',
    });

    // The lesson is injected before any script runs — the page never fetches it, so a capture
    // cannot race a network request.
    await page.addInitScript((payload) => { window.__AXI_LESSON = payload; }, lesson);
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' });

    await page.waitForFunction(() => window.__axiReady === true, null, { timeout: 30_000 });
    await page.evaluate(() => document.fonts.ready);

    const frames = opts.frames ?? await page.evaluate(() => window.__axiFrameCount ?? 0);
    if (!frames) throw new Error('page reported no frames — window.__axiFrameCount is 0');

    const manifest = { run_id: run.id, width: WIDTH, height: HEIGHT, fps: FPS, frames, files: [] };

    for (let f = 0; f < frames; f++) {
      await page.evaluate((frame) => window.__axiSeek(frame), f);
      // __axiSeek is synchronous by contract; this waits only for the compositor.
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r())));
      const name = `frame-${String(f).padStart(5, '0')}.png`;
      await page.screenshot({ path: path.join(outDir, name), animations: 'disabled' });
      manifest.files.push(name);
    }

    fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
    fs.writeFileSync(path.join(run.dir, 'capture.json'), JSON.stringify({ ...manifest, dir: outDir }, null, 2));
    return { ...manifest, dir: outDir, publicPath: `captures/${run.id}` };
  } finally {
    await browser.close();
    server.close();
  }
}
