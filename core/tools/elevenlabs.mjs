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

const CACHE_DIR = path.join(CORE, 'out', 'tts-cache');
const API = 'https://api.elevenlabs.io/v1';

/** Deliberately conservative: an over-styled read makes a teacher sound like an advert. */
export const DEFAULT_SETTINGS = { stability: 0.45, similarity_boost: 0.8, style: 0.35 };

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
export function say(text, outFile, { settings = DEFAULT_SETTINGS, env = loadEnv() } = {}) {
  if (!text || !text.trim()) throw new Error('refusing to synthesize empty text');

  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.mkdirSync(path.dirname(outFile), { recursive: true });

  const hash = cacheKey(text, env.voice, env.model, settings);
  const cached = path.join(CACHE_DIR, `${hash}.mp3`);

  if (!fs.existsSync(cached)) {
    const body = JSON.stringify({ text, model_id: env.model, voice_settings: settings });
    const headerFile = path.join(CACHE_DIR, `${hash}.headers`);

    // The key goes in through a curl config on stdin, never in argv — anything in argv is
    // readable by `ps` for every process on the machine.
    execFileSync('curl', [
      '-sS', '-K', '-', '-X', 'POST', `${API}/text-to-speech/${env.voice}`,
      '-H', 'content-type: application/json',
      '-H', 'accept: audio/mpeg',
      '-D', headerFile,
      '--data-binary', body,
      '-o', cached,
    ], {
      input: `header = "xi-api-key: ${env.key}"\n`,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const status = fs.existsSync(headerFile)
      ? (fs.readFileSync(headerFile, 'utf8').match(/HTTP\/[\d.]+ (\d+)/) ?? [])[1]
      : null;
    fs.rmSync(headerFile, { force: true });

    // A JSON error body lands in the mp3 slot and would otherwise be cached as "audio".
    const head = fs.existsSync(cached) ? fs.readFileSync(cached).subarray(0, 1).toString() : '';
    if (status !== '200' || head === '{') {
      const detail = fs.existsSync(cached) ? fs.readFileSync(cached, 'utf8').slice(0, 300) : '(no body)';
      fs.rmSync(cached, { force: true });
      throw new Error(`ElevenLabs returned ${status ?? 'no status'}: ${detail}`);
    }
  }

  const fromCache = fs.existsSync(outFile) && fs.readFileSync(outFile).equals(fs.readFileSync(cached));
  fs.copyFileSync(cached, outFile);

  const seconds = Number(execFileSync('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1', outFile,
  ], { encoding: 'utf8' }).trim());

  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new Error(`synthesized clip has no measurable duration: ${outFile}`);
  }

  return { file: outFile, seconds: Number(seconds.toFixed(3)), chars: text.length, cached: fromCache, hash };
}

export function quota(env = loadEnv()) {
  const raw = execFileSync('curl', ['-sS', '-K', '-', `${API}/user/subscription`], {
    input: `header = "xi-api-key: ${env.key}"\n`, encoding: 'utf8',
  });
  const j = JSON.parse(raw);
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
      console.log(JSON.stringify(say(text, path.resolve(flag('out'))), null, 2));
    } else if (argv[0] === 'quota') {
      console.log(JSON.stringify(quota(), null, 2));
    } else {
      console.error('commands: say --text <t> --out <file> | say --text-file <f> --out <file> | quota');
      process.exit(2);
    }
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
