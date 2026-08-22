#!/usr/bin/env node
/**
 * ElevenLabs text-to-speech for lesson narration.
 *
 * Credentials come from .env at the repository root and are never written to a file, a log, an
 * artifact or a commit. If a key shows up in output, that is a leak, not a debug aid.
 *
 * Every request is cached by a hash of (text, voice, model, settings). The account is on a
 * metered character plan and iterating on a script would otherwise re-bill unchanged lines.
 *
 *   node core/tools/elevenlabs.mjs say --text "[excited] Hello." --out core/out/runs/x/audio/s1.mp3
 *   node core/tools/elevenlabs.mjs quota
 */
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { CORE, ROOT } from '../pipeline/lib/paths.mjs';
import { FFMPEG, FFPROBE } from '../pipeline/lib/platform.mjs';

const CACHE_DIR = path.join(CORE, 'out', 'tts-cache');
const API = 'https://api.elevenlabs.io/v1';

/**
 * Lower stability and higher style than the cautious defaults: at 0.45/0.35 the read came back
 * flat and even, which on short-form video sounds like a recording rather than a person.
 */
export const DEFAULT_SETTINGS = { stability: 0.32, similarity_boost: 0.8, style: 0.6 };

/**
 * Silence trimming, applied after synthesis.
 *
 * MEASURED, not guessed: a single `[pause]` tag produced 2.98 s of dead air in a 10 s clip, and
 * one 52-second story carried about 9 seconds of silence. Prompt guidance alone cannot fix this
 * — the model decides how long a beat lasts — so the audio is trimmed deterministically here as
 * well. Silences longer than TRIM_ABOVE are cut back to TRIM_KEEP; leading silence goes entirely.
 */
export const TRIM_ABOVE = 0.30;
export const TRIM_KEEP = 0.22;
export const TRIM_THRESHOLD = '-38dB';

export function loadEnv() {
  const file = path.join(ROOT, '.env');
  if (!fs.existsSync(file)) {
    throw new Error(`missing ${file} — copy .env.example and fill in ELEVENLABS_API_KEY`);
  }
  const env = {};
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i > 0) env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  const key = env.ELEVENLABS_API_KEY;
  const voice = env.ELEVENLABS_VOICE_ID;
  const model = env.ELEVENLABS_MODEL || 'eleven_v3';
  if (!key) throw new Error('ELEVENLABS_API_KEY is empty in .env');
  if (!voice) throw new Error('ELEVENLABS_VOICE_ID is empty in .env');
  return { key, voice, model };
}

const cacheKey = (text, voice, model, settings) =>
  crypto.createHash('sha256')
    .update(JSON.stringify({ text, voice, model, settings }))
    .digest('hex').slice(0, 32);

/**
 * Synthesize one clip. Returns its path, measured duration, and whether the cache served it.
 * The duration is measured with ffprobe, never estimated — it becomes the step's on-screen length.
 */
export async function say(text, outFile, { settings = DEFAULT_SETTINGS, env = loadEnv() } = {}) {
  if (!text || !text.trim()) throw new Error('refusing to synthesize empty text');

  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.mkdirSync(path.dirname(outFile), { recursive: true });

  const hash = cacheKey(text, env.voice, env.model, settings);
  const cached = path.join(CACHE_DIR, `${hash}.mp3`);

  if (!fs.existsSync(cached)) {
    // Node's own fetch, not curl: curl is not guaranteed on Windows, and this keeps the key out
    // of argv, where `ps` would expose it to every process on the machine.
    const res = await fetch(`${API}/text-to-speech/${env.voice}`, {
      method: 'POST',
      headers: {
        'xi-api-key': env.key,
        'content-type': 'application/json',
        accept: 'audio/mpeg',
      },
      body: JSON.stringify({ text, model_id: env.model, voice_settings: settings }),
    });

    if (!res.ok) {
      throw new Error(`ElevenLabs returned ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }

    const buf = Buffer.from(await res.arrayBuffer());
    // A JSON error body with a 200 would otherwise be cached as "audio" and fail much later.
    if (buf.subarray(0, 1).toString() === '{') {
      throw new Error(`ElevenLabs returned JSON where audio was expected: ${buf.toString('utf8').slice(0, 300)}`);
    }
    fs.writeFileSync(cached, buf);
  }

  const wasCached = fs.existsSync(outFile) && fs.readFileSync(outFile).equals(fs.readFileSync(cached));
  trimSilence(cached, outFile);

  // Measured AFTER trimming: this duration becomes the beat's on-screen length, so it has to be
  // the length of the file that actually plays.
  const seconds = Number(execFileSync(FFPROBE, [
    '-v', 'error', '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1', outFile,
  ], { encoding: 'utf8' }).trim());

  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new Error(`synthesized clip has no measurable duration: ${outFile}`);
  }

  return { file: outFile, seconds: Number(seconds.toFixed(3)), chars: text.length, cached: wasCached, hash };
}

/**
 * Copy `src` to `dest`, capping every internal silence and stripping the leading one.
 *
 * Falls back to a plain copy if ffmpeg refuses: a clip with long pauses is worse than one without,
 * but a missing clip is worse than both.
 */
export function trimSilence(src, dest) {
  const filter = [
    `silenceremove=start_periods=1:start_silence=0.03:start_threshold=${TRIM_THRESHOLD}`,
    `stop_periods=-1:stop_duration=${TRIM_ABOVE}:stop_silence=${TRIM_KEEP}:stop_threshold=${TRIM_THRESHOLD}`,
  ].join(':');
  try {
    execFileSync(FFMPEG, ['-y', '-v', 'error', '-i', src, '-af', filter, '-c:a', 'libmp3lame', '-q:a', '2', dest],
      { stdio: ['ignore', 'pipe', 'pipe'] });
  } catch {
    fs.copyFileSync(src, dest);
  }
}

export async function quota(env = loadEnv()) {
  const res = await fetch(`${API}/user/subscription`, { headers: { 'xi-api-key': env.key } });
  if (!res.ok) throw new Error(`ElevenLabs returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  return {
    tier: j.tier,
    used: j.character_count,
    limit: j.character_limit,
    remaining: j.character_limit - j.character_count,
  };
}

// ---------------------------------------------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2);
  const flag = (n) => { const i = argv.indexOf(`--${n}`); return i === -1 ? undefined : argv[i + 1]; };
  try {
    if (argv[0] === 'say') {
      const text = flag('text') ?? fs.readFileSync(flag('text-file'), 'utf8');
      console.log(JSON.stringify(await say(text, path.resolve(flag('out'))), null, 2));
    } else if (argv[0] === 'quota') {
      console.log(JSON.stringify(await quota(), null, 2));
    } else {
      console.error('commands: say --text <t> --out <file> | say --text-file <f> --out <file> | quota');
      process.exit(2);
    }
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
