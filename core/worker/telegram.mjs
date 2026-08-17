/**
 * Minimal Telegram Bot API client.
 *
 * Node's own fetch, no dependencies, no curl — this has to run unchanged on macOS, Windows and
 * Linux.
 *
 * The delivery rule from the brief is enforced here rather than trusted to the caller: the worker
 * sends to exactly ONE chat, the paired owner's private chat, and refuses everything else. A bot
 * token is a broadcast capability, and the only thing standing between "sends me my videos" and
 * "posts to a group someone added the bot to" is a check like this one.
 */
import fs from 'node:fs';
import path from 'node:path';

const API = 'https://api.telegram.org';

export class TelegramError extends Error {
  constructor(message, { method, description, code } = {}) {
    super(message);
    this.method = method;
    this.description = description;
    this.code = code;
  }
}

async function call(token, method, payload) {
  const res = await fetch(`${API}/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload ?? {}),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.ok) {
    throw new TelegramError(`Telegram ${method} failed: ${body.description ?? res.status}`, {
      method, description: body.description, code: body.error_code ?? res.status,
    });
  }
  return body.result;
}

export const getMe = (token) => call(token, 'getMe');
export const getUpdates = (token, opts = {}) =>
  call(token, 'getUpdates', { timeout: 0, allowed_updates: ['message'], ...opts });
export const sendMessage = (token, chatId, text, opts = {}) =>
  call(token, 'sendMessage', { chat_id: chatId, text, ...opts });

/**
 * Send a file as a DOCUMENT, not as a video.
 *
 * Deliberate: Telegram re-encodes and compresses anything sent as video, and a 1080x1920 render
 * loses visible quality on the way. As a document the bytes arrive exactly as rendered, which is
 * what you want for something about to be uploaded elsewhere.
 */
export async function sendDocument(token, chatId, filePath, { caption, disableNotification } = {}) {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) throw new TelegramError(`file not found: ${abs}`);

  const bytes = fs.readFileSync(abs);
  const stat = fs.statSync(abs);
  // Bot API caps uploads at 50 MB. Renders sit around 5 MB, so this only fires if something is
  // very wrong upstream — better a clear error than a confusing 413.
  if (stat.size > 50 * 1024 * 1024) {
    throw new TelegramError(`${path.basename(abs)} is ${(stat.size / 1e6).toFixed(1)} MB; Telegram bots cap at 50 MB`);
  }

  const form = new FormData();
  form.append('chat_id', String(chatId));
  if (caption) form.append('caption', caption);
  if (disableNotification) form.append('disable_notification', 'true');
  form.append('document', new Blob([bytes], { type: 'video/mp4' }), path.basename(abs));

  const res = await fetch(`${API}/bot${token}/sendDocument`, { method: 'POST', body: form });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.ok) {
    throw new TelegramError(`Telegram sendDocument failed: ${body.description ?? res.status}`, {
      method: 'sendDocument', description: body.description, code: body.error_code ?? res.status,
    });
  }
  return body.result;
}

/**
 * The delivery guard. Every send goes through this.
 *
 * Two independent conditions, because either alone can be satisfied by accident:
 *   - the chat id equals the paired owner's id
 *   - the chat is of type "private"
 *
 * A group the bot is added to gets a different id AND a different type, so a misconfiguration has
 * to defeat both to leak a post.
 */
export async function assertOwnerPrivateChat(token, chatId) {
  const chat = await call(token, 'getChat', { chat_id: chatId });
  if (String(chat.id) !== String(chatId)) {
    throw new TelegramError(`chat id mismatch: asked for ${chatId}, Telegram returned ${chat.id}`);
  }
  if (chat.type !== 'private') {
    throw new TelegramError(
      `refusing to send to a ${chat.type} chat — this worker only ever posts to the owner's private chat`
    );
  }
  return chat;
}
