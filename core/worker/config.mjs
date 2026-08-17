/**
 * Worker configuration, read from .env at the repository root.
 *
 * Secrets are never written to a log, an artifact or a commit. `redacted()` exists so status
 * output can prove a value is present without printing it.
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../pipeline/lib/paths.mjs';

export const ENV_FILE = path.join(ROOT, '.env');

export function readEnvFile(file = ENV_FILE) {
  if (!fs.existsSync(file)) return {};
  const env = {};
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i > 0) env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return env;
}

/**
 * Set or replace one key in .env, preserving comments and the order of everything else.
 * Used by `pair` to persist the chat id once, rather than asking the user to edit a file.
 */
export function writeEnvValue(key, value, file = ENV_FILE) {
  const lines = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n') : [];
  let replaced = false;
  const next = lines.map((line) => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return line;
    const i = t.indexOf('=');
    if (i > 0 && t.slice(0, i).trim() === key) { replaced = true; return `${key}=${value}`; }
    return line;
  });
  if (!replaced) {
    if (next.length && next[next.length - 1].trim() !== '') next.push('');
    next.push(`${key}=${value}`);
  }
  fs.writeFileSync(file, next.join('\n').replace(/\n{3,}$/, '\n'), { mode: 0o600 });
}

export const DEFAULTS = {
  /** Local time of the daily run, 24h. Local, not UTC — you want it in your morning. */
  WORKER_DAILY_AT: '09:00',
  /** Attempts per post before giving up. A gate closing is normal; the next topic usually passes. */
  WORKER_MAX_ATTEMPTS: '3',
  /** Which posts a daily run produces, in order. */
  WORKER_POSTS: 'lesson,task20,task40',
};

export function loadConfig(file = ENV_FILE) {
  const env = { ...DEFAULTS, ...readEnvFile(file) };
  const missing = [];
  if (!env.TELEGRAM_BOT_TOKEN) missing.push('TELEGRAM_BOT_TOKEN');
  if (!env.ELEVENLABS_API_KEY) missing.push('ELEVENLABS_API_KEY (lessons need narration)');

  const [h, m] = String(env.WORKER_DAILY_AT).split(':').map(Number);
  if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    throw new Error(`WORKER_DAILY_AT must be HH:MM in 24h local time, got "${env.WORKER_DAILY_AT}"`);
  }

  return {
    token: env.TELEGRAM_BOT_TOKEN,
    chatId: env.TELEGRAM_OWNER_CHAT_ID || null,
    dailyAt: { hour: h, minute: m },
    maxAttempts: Math.max(1, Number(env.WORKER_MAX_ATTEMPTS) || 3),
    posts: String(env.WORKER_POSTS).split(',').map((s) => s.trim()).filter(Boolean),
    missing,
    raw: env,
  };
}

/** Enough to confirm a value is set, never enough to use it. */
export const redacted = (v) => (v ? `set (${String(v).length} chars, …${String(v).slice(-4)})` : 'MISSING');

/** Milliseconds until the next occurrence of hour:minute in LOCAL time. */
export function msUntilNext({ hour, minute }, now = new Date()) {
  const next = new Date(now);
  next.setHours(hour, minute, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}
