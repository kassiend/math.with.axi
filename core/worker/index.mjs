#!/usr/bin/env node
/**
 * Daily worker: produces three posts and delivers them to one Telegram chat as documents.
 *
 *   npm run worker -- pair      pair the bot with your account (once)
 *   npm run worker -- status    show configuration and what has shipped
 *   npm run worker -- now       run one batch immediately, then exit
 *   npm run worker              run forever, firing once a day at WORKER_DAILY_AT
 *
 * Runs unchanged on macOS, Windows and Linux: no cron, no launchd, no Task Scheduler. The
 * schedule lives in this process because those three schedulers have nothing in common, and a
 * long-lived Node process is the one thing all three can start the same way.
 *
 * Uniqueness is not this file's job — it belongs to the ledgers, which the orchestrators consult
 * before anything renders. A repeat is rejected at the gate, the failure is recorded, and the
 * retry below picks a different topic precisely because the ledger now knows about the first.
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig, msUntilNext, redacted, writeEnvValue } from './config.mjs';
import { GateClosed, PRODUCERS } from './generate.mjs';
import * as tg from './telegram.mjs';
import { CORE, PYTHON, ROOT } from '../pipeline/lib/paths.mjs';
import { NODE_BIN } from '../pipeline/lib/paths.mjs';
import { checkPrerequisites } from '../pipeline/lib/platform.mjs';
import * as ledger from '../pipeline/lib/ledger.mjs';
import * as tasksLedger from '../pipeline/lib/tasks-ledger.mjs';

const LOG_FILE = path.join(CORE, 'out', 'worker.log.jsonl');

function log(event, data = {}) {
  const entry = { t: new Date().toISOString(), event, ...data };
  fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
  fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n');
  const stamp = new Date().toLocaleTimeString();
  console.log(`[${stamp}] ${event}${Object.keys(data).length ? ' ' + JSON.stringify(data) : ''}`);
}

const CAPTIONS = {
  lesson: (m) => `Math tricks #${m.counter} — ${m.method}`,
  task20: (m) => `Daily task · 20s\n${m.statement}`,
  task40: (m) => `Daily task · 40s\n${m.statement}`,
};

/**
 * The answer, sent as its own message after the video.
 *
 * Separate rather than in the caption on purpose: the caption travels with the file if it is
 * forwarded or re-uploaded, and a task post that carries its own answer is spoiled. Lessons do
 * not get one — the answer is the whole point of the video.
 */
const ANSWERS = {
  task20: answerNote,
  task40: answerNote,
};

function answerNote(m) {
  const lines = [`Answer · ${m.durationS}s task`, '', m.statement, `= ${m.answer}`];
  if (m.solution) lines.push('', m.solution);
  return lines.join('\n');
}

// ---------------------------------------------------------------------------

/**
 * Pair the bot with its owner.
 *
 * Telegram does not let a bot look up "the user who owns me" — it only knows chats that have
 * messaged it. So: you send the bot a message, this reads it, and the chat id is written to .env.
 * That id then becomes the ONLY chat the worker will ever send to.
 */
async function cmdPair(cfg) {
  const me = await tg.getMe(cfg.token);
  console.log(`Bot: @${me.username} (${me.first_name})`);
  console.log(`\nOpen https://t.me/${me.username} and send it any message, e.g. "hi".`);
  console.log('Waiting… (Ctrl-C to abort)\n');

  const deadline = Date.now() + 5 * 60 * 1000;
  let offset;
  while (Date.now() < deadline) {
    const updates = await tg.getUpdates(cfg.token, { offset, timeout: 25 });
    for (const u of updates) {
      offset = u.update_id + 1;
      const chat = u.message?.chat;
      if (!chat) continue;
      if (chat.type !== 'private') {
        console.log(`  ignoring a ${chat.type} chat — this worker only posts to a private chat`);
        continue;
      }
      writeEnvValue('TELEGRAM_OWNER_CHAT_ID', String(chat.id));
      console.log(`✓ paired with ${chat.first_name ?? ''} ${chat.last_name ?? ''} (id ${chat.id})`);
      console.log('  written to .env as TELEGRAM_OWNER_CHAT_ID');
      await tg.sendMessage(cfg.token, chat.id,
        'Paired. This chat is now the only place I will send posts.');
      return 0;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.error('✗ timed out after 5 minutes without a private message');
  return 1;
}

async function cmdStatus(cfg) {
  console.log('Telegram token       ', redacted(cfg.token));
  console.log('Owner chat id        ', cfg.chatId ?? 'NOT PAIRED — run: npm run worker -- pair');
  console.log('ElevenLabs key       ', redacted(cfg.raw.ELEVENLABS_API_KEY));
  console.log('Daily at             ', `${String(cfg.dailyAt.hour).padStart(2, '0')}:${String(cfg.dailyAt.minute).padStart(2, '0')} local`);
  console.log('Posts per run        ', cfg.posts.join(', '));
  console.log('Attempts per post    ', cfg.maxAttempts);

  const missing = checkPrerequisites({ python: PYTHON, localBinDir: NODE_BIN });
  console.log('Prerequisites        ', missing.length ? `MISSING: ${missing.join(', ')}` : 'ok');

  const lessons = ledger.load().entries.filter((e) => e.status === 'shipped');
  const tasks = tasksLedger.load().entries.filter((e) => e.status === 'shipped');
  console.log(`\nShipped so far: ${lessons.length} lesson(s), ` +
    `${tasks.filter((t) => t.duration_s === 20).length} × 20s, ` +
    `${tasks.filter((t) => t.duration_s === 40).length} × 40s`);

  if (cfg.chatId) {
    try {
      const chat = await tg.assertOwnerPrivateChat(cfg.token, cfg.chatId);
      console.log(`Delivery target      ok — private chat with ${chat.first_name ?? chat.id}`);
    } catch (err) {
      console.log(`Delivery target      ✗ ${err.message}`);
      return 1;
    }
  }
  return missing.length ? 1 : 0;
}

/**
 * One batch: produce each post, deliver it, move on.
 *
 * Posts are independent. One failing does not cancel the others — a day with two of three videos
 * is better than a day with none, and the one that failed is reported rather than swallowed.
 */
async function runBatch(cfg) {
  await tg.assertOwnerPrivateChat(cfg.token, cfg.chatId);

  const results = [];
  for (const kind of cfg.posts) {
    const produce = PRODUCERS[kind];
    if (!produce) { log('post.unknown', { kind }); continue; }

    let delivered = false;
    for (let attempt = 1; attempt <= cfg.maxAttempts && !delivered; attempt++) {
      log('post.start', { kind, attempt });
      try {
        const post = await produce({ log: (m) => console.log(m) });
        await tg.sendDocument(cfg.token, cfg.chatId, post.video, {
          caption: CAPTIONS[kind]?.(post.meta) ?? path.basename(post.video),
        });

        // The answer follows the video as its own message. If it fails, the post has still been
        // delivered — do not retry the whole generation over a missing follow-up.
        const note = ANSWERS[kind]?.(post.meta);
        if (note) {
          try {
            await tg.sendMessage(cfg.token, cfg.chatId, note, { disable_notification: true });
          } catch (err) {
            log('answer.failed', { kind, error: String(err.message).slice(0, 200) });
          }
        }

        log('post.delivered', { kind, id: post.meta.id, file: path.relative(ROOT, post.video) });
        results.push({ kind, ok: true, id: post.meta.id });
        delivered = true;
      } catch (err) {
        if (err instanceof GateClosed) {
          // Expected: the ledger now knows, so the next attempt steers elsewhere.
          log('post.gate-closed', { kind, attempt, stage: err.stage });
          continue;
        }
        log('post.error', { kind, attempt, error: String(err.message).slice(0, 300) });
        if (attempt === cfg.maxAttempts) results.push({ kind, ok: false, error: err.message });
      }
    }
    if (!delivered && !results.some((r) => r.kind === kind)) {
      results.push({ kind, ok: false, error: `no post survived ${cfg.maxAttempts} attempts` });
    }
  }

  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    await tg.sendMessage(cfg.token, cfg.chatId,
      `Batch finished with ${failed.length} failure(s):\n` +
      failed.map((f) => `• ${f.kind}: ${String(f.error).slice(0, 200)}`).join('\n'));
  }
  log('batch.done', { ok: results.filter((r) => r.ok).length, failed: failed.length });
  return results;
}

async function cmdLoop(cfg) {
  const at = `${String(cfg.dailyAt.hour).padStart(2, '0')}:${String(cfg.dailyAt.minute).padStart(2, '0')}`;
  log('worker.start', { daily_at: `${at} local`, posts: cfg.posts });

  // Verified once at startup so a missing dependency is a clear message now rather than a failed
  // batch at nine in the morning.
  const missing = checkPrerequisites({ python: PYTHON, localBinDir: NODE_BIN });
  if (missing.length) {
    console.error(`✗ missing prerequisites: ${missing.join(', ')}`);
    return 1;
  }
  await tg.assertOwnerPrivateChat(cfg.token, cfg.chatId);

  for (;;) {
    const wait = msUntilNext(cfg.dailyAt);
    log('worker.sleep', { until: new Date(Date.now() + wait).toLocaleString(), hours: +(wait / 3.6e6).toFixed(2) });
    // setTimeout caps at ~24.8 days, and a day always fits, so one timer is enough.
    await new Promise((r) => setTimeout(r, wait));
    try {
      await runBatch(cfg);
    } catch (err) {
      // The loop must survive a bad batch: a network blip at 09:00 should not end the worker.
      log('batch.error', { error: String(err.message).slice(0, 300) });
    }
  }
}

// ---------------------------------------------------------------------------

async function main() {
  const cmd = process.argv[2] ?? 'loop';

  let cfg;
  try {
    cfg = loadConfig();
  } catch (err) {
    console.error(`✗ ${err.message}`);
    return 1;
  }

  if (cmd === 'pair') {
    if (!cfg.token) { console.error('✗ TELEGRAM_BOT_TOKEN is missing from .env'); return 1; }
    return cmdPair(cfg);
  }
  if (cmd === 'status') return cmdStatus(cfg);

  if (cfg.missing.length) {
    console.error(`✗ .env is missing: ${cfg.missing.join(', ')}`);
    return 1;
  }
  if (!cfg.chatId) {
    console.error('✗ not paired yet. Run:  npm run worker -- pair');
    return 1;
  }

  if (cmd === 'now') { await runBatch(cfg); return 0; }
  if (cmd === 'loop') return cmdLoop(cfg);

  console.error(`unknown command "${cmd}" — expected: pair | status | now | loop`);
  return 2;
}

main().then((code) => { process.exitCode = code ?? 0; }).catch((err) => {
  console.error('\n! worker error:', err.stack ?? err.message);
  process.exitCode = 1;
});
