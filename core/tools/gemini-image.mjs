#!/usr/bin/env node
/**
 * Image generation via the Gemini API, for anything Wikimedia Commons cannot supply under an
 * accepted licence.
 *
 * WHAT THIS MUST NEVER BE USED FOR: a portrait of a real person presented as that person.
 * A generated "Euler" is an invented face on a biography, which is the visual equivalent of the
 * fabricated value §3.3 forbids everywhere else in this pipeline. Real people come from Commons
 * or they do not appear. Generation is for diagrams, scenes, objects, eras and abstractions.
 *
 * Cached by prompt hash: the account is metered and iterating on a script would otherwise re-bill
 * an unchanged image.
 *
 *   node core/tools/gemini-image.mjs generate "a Konigsberg bridge, engraving style" --out img/x.png
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { CORE, ROOT } from '../pipeline/lib/paths.mjs';

const CACHE_DIR = path.join(CORE, 'out', 'image-cache');
const API = 'https://generativelanguage.googleapis.com/v1beta/models';

/** Refused outright, before a request is made. See the note at the top. */
const REAL_PERSON_MARKERS = [
  /\bportrait of\b/i, /\bphoto(graph)? of\b/i, /\blikeness of\b/i, /\bface of\b/i,
];

export function loadEnv() {
  const file = path.join(ROOT, '.env');
  const env = {};
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const i = t.indexOf('=');
      if (i > 0) env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
    }
  }
  const key = env.GEMINI_API_KEY;
  if (!key) {
    throw new Error(
      'GEMINI_API_KEY is not set in .env — image generation is unavailable. ' +
      'Until it is, stories must source every image from Wikimedia Commons or ship without one.'
    );
  }
  return { key, model: env.GEMINI_IMAGE_MODEL || DEFAULT_MODEL };
}

/**
 * Default model. gemini-3-pro-image at $0.134/image — chosen for composition fidelity rather than
 * resolution: the card slot is 350x294 design px, so anything above 1K is cropped away unseen.
 * The case for it is hit-rate. A regeneration costs a full image either way, so a model that
 * lands the brief first time is not as expensive as the sticker price suggests.
 *
 * It is still nearly four times the cheapest option, and the balance is small. Watch the running
 * total with `node core/tools/gemini-image.mjs cost`, and switch models in .env if it bites.
 */
export const DEFAULT_MODEL = 'gemini-3-pro-image';

/** Published price per generated image, for the cost line in the run log. */
export const PRICE_PER_IMAGE = {
  'imagen-4.0-fast-generate-001': 0.02,
  'imagen-4.0-generate-001': 0.04,
  'imagen-4.0-ultra-generate-001': 0.06,
  'gemini-3.1-flash-lite-image': 0.0336,
  'gemini-2.5-flash-image': 0.039,
  'gemini-3.1-flash-image': 0.067,
  'gemini-3-pro-image': 0.134,
};

/**
 * Imagen and Gemini image models sit on DIFFERENT endpoints with different request and response
 * shapes — `:predict` with `instances` for Imagen, `:generateContent` with `contents` for Gemini.
 * Handled here so the choice of model stays a one-line setting rather than a code change.
 */
const isImagen = (model) => /^imagen-/i.test(model);

export async function generate(prompt, outFile, { env = loadEnv() } = {}) {
  if (!prompt?.trim()) throw new Error('refusing to generate from an empty prompt');
  if (REAL_PERSON_MARKERS.some((re) => re.test(prompt))) {
    throw new Error(
      `refusing to generate "${prompt.slice(0, 60)}…": this reads as a likeness of a real person. ` +
      'A generated face on a biography is a fabricated fact. Source it from Commons or omit it.'
    );
  }

  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const hash = crypto.createHash('sha256').update(JSON.stringify({ prompt, model: env.model })).digest('hex').slice(0, 32);
  const cached = path.join(CACHE_DIR, `${hash}.png`);
  const wasCached = fs.existsSync(cached);

  if (!wasCached) {
    const imagen = isImagen(env.model);
    const url = `${API}/${env.model}:${imagen ? 'predict' : 'generateContent'}?key=${env.key}`;
    const payload = imagen
      ? { instances: [{ prompt }], parameters: { sampleCount: 1, aspectRatio: '1:1' } }
      : { contents: [{ parts: [{ text: prompt }] }] };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`${env.model} returned ${res.status}: ${(await res.text()).slice(0, 300)}`);

    const body = await res.json();
    const b64 = imagen
      ? body?.predictions?.[0]?.bytesBase64Encoded
      : body?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData?.data;
    if (!b64) throw new Error(`${env.model} returned no image: ${JSON.stringify(body).slice(0, 300)}`);
    fs.writeFileSync(cached, Buffer.from(b64, 'base64'));
  }

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.copyFileSync(cached, outFile);

  // Billed only when the API was actually called; a cache hit costs nothing.
  if (!wasCached) recordSpend({ model: env.model, usd: PRICE_PER_IMAGE[env.model] ?? null, prompt: prompt.slice(0, 120) });

  return {
    file: outFile, bytes: fs.statSync(outFile).size, hash, generated: true, prompt,
    model: env.model,
    // Recorded so a run's cost is visible in its own log rather than discovered on a bill.
    usd: PRICE_PER_IMAGE[env.model] ?? null,
  };
}

/**
 * Every generation is appended here, so spend is visible while it happens rather than on a bill.
 * The balance funding this is small enough that one runaway loop matters.
 */
export const SPEND_LOG = path.join(CORE, 'out', 'image-spend.jsonl');

function recordSpend(row) {
  fs.mkdirSync(path.dirname(SPEND_LOG), { recursive: true });
  fs.appendFileSync(SPEND_LOG, JSON.stringify({ t: new Date().toISOString(), ...row }) + '\n');
}

/** Total spent so far, and what remains of a stated budget. */
export function spend(budgetUsd = 25) {
  if (!fs.existsSync(SPEND_LOG)) return { images: 0, usd: 0, budget: budgetUsd, remaining: budgetUsd, byModel: {} };
  const rows = fs.readFileSync(SPEND_LOG, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const byModel = {};
  let usd = 0;
  for (const r of rows) {
    usd += r.usd ?? 0;
    byModel[r.model] = (byModel[r.model] ?? 0) + 1;
  }
  return {
    images: rows.length,
    usd: Number(usd.toFixed(3)),
    budget: budgetUsd,
    remaining: Number((budgetUsd - usd).toFixed(3)),
    byModel,
  };
}

/** Is generation available at all? Used to fail a run early rather than mid-way. */
export function available() {
  try { loadEnv(); return true; } catch { return false; }
}

// ---------------------------------------------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2);
  const flag = (n) => { const i = argv.indexOf(`--${n}`); return i === -1 ? undefined : argv[i + 1]; };
  try {
    if (argv[0] === 'generate') {
      console.log(JSON.stringify(await generate(argv[1] ?? '', path.resolve(flag('out'))), null, 2));
    } else if (argv[0] === 'check') {
      console.log(JSON.stringify({ available: available(), model: available() ? loadEnv().model : null }, null, 2));
    } else if (argv[0] === 'cost') {
      console.log(JSON.stringify(spend(Number(flag('budget') ?? 25)), null, 2));
    } else {
      console.error('commands: generate <prompt> --out <file> | check | cost [--budget 25]');
      process.exit(2);
    }
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
