/**
 * The messages that follow a delivered video: what to paste where.
 *
 * Every block that is meant to be pasted is a <pre> — Telegram copies a monospace block to the
 * clipboard on a single tap, which is the whole point. The answer to a task lives in the
 * first-comment blocks and nowhere else: those are separate messages from the file, so forwarding
 * the video does not carry the answer with it.
 *
 * When the caption agent produced nothing, a plain fallback is built from the post's own fields
 * so a day never ends with a video and no words for it.
 */

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const pre = (s) => `<pre>${esc(s)}</pre>`;

/** Short caption on the document itself — identifies the file, nothing to paste. */
export function fileCaption(kind, meta) {
  if (kind === 'lesson') return `Math tricks #${meta.counter} — ${meta.method}`;
  if (kind === 'story') return `Story — ${meta.title}`;
  return `Daily task · ${meta.durationS}s\n${meta.statement}`;
}

/** Messages (HTML) to send after the file, in order. */
export function copyMessages(kind, meta, caption) {
  const c = caption ?? fallbackCaption(kind, meta);
  const out = [];

  out.push([
    `📸 <b>Instagram Reels</b> — caption`,
    pre(c.instagram.caption),
    `First comment (post it right after publishing):`,
    pre(c.instagram.first_comment),
  ].join('\n'));

  out.push([
    `🎵 <b>TikTok</b> — caption`,
    pre(c.tiktok.caption),
    ...(c.tiktok.first_comment ? ['First comment:', pre(c.tiktok.first_comment)] : []),
  ].join('\n'));

  out.push([
    `▶️ <b>YouTube Shorts</b>`,
    `Title:`, pre(c.youtube.title),
    `Description:`, pre(c.youtube.description),
    `Tags (comma-separated):`, pre((c.youtube.tags ?? []).join(', ')),
    ...(c.youtube.first_comment ? ['First comment:', pre(c.youtube.first_comment)] : []),
  ].join('\n'));

  if (c.alt_text) out.push(`Alt text: ${esc(c.alt_text)}`);
  return out;
}

/**
 * Plain copy from the payload, used only when the agent failed. Deliberately unadorned: a generic
 * "you won't believe this trick" is worse than an honest line, and the agent exists to do better.
 */
export function fallbackCaption(kind, meta) {
  const tags = ['math', 'maths', 'mathtricks', 'mentalmath', 'learnontiktok', 'mathhacks',
    'education', 'stem', 'mathteacher', 'numbers', 'mathwithaxi', 'brainteaser'];
  const hashtags = tags.map((t) => `#${t}`).join(' ');

  if (kind === 'lesson') {
    const hook = `${meta.method} — in your head, no calculator.`;
    const cta = 'Save this and try it on your own number.';
    return {
      kind, hook,
      instagram: { caption: `${hook}\n\nMath tricks #${meta.counter}.\n${cta}`, first_comment: `${hashtags}\n\nWhich number did you try it on?` },
      tiktok: { caption: `${hook} ${cta} #math #mathtricks #mentalmath #learnontiktok`, first_comment: null },
      youtube: { title: `${meta.method} in your head (Math tricks #${meta.counter})`.slice(0, 70),
                 description: `${hook}\n\n${cta}\n\n#math #mathtricks #Shorts`, tags, first_comment: 'Which number did you try it on?' },
      alt_text: `A white card with the steps of "${meta.method}" appearing one by one, with the mascot Axi.`,
      nulls: [{ field: 'caption', reason: 'caption agent produced nothing; fallback copy' }],
    };
  }

  if (kind === 'story') {
    const hook = meta.title;
    return {
      kind, hook,
      instagram: { caption: `${hook}\n\nThe maths behind it, in under a minute.\nSave this one.`, first_comment: `${hashtags}\n\nDid you know this one?` },
      tiktok: { caption: `${hook} #math #mathstory #learnontiktok #stem`, first_comment: null },
      youtube: { title: hook.slice(0, 70), description: `${hook}\n\nThe maths behind it, in under a minute.\n\n#math #Shorts`, tags, first_comment: 'Did you know this one?' },
      alt_text: `A story card titled "${meta.title}" with an image and a formula, read by the mascot Axi.`,
      nulls: [{ field: 'caption', reason: 'caption agent produced nothing; fallback copy' }],
    };
  }

  const hook = `Can you solve it in ${meta.durationS} seconds?`;
  const answer = [`Answer: ${meta.answer}`, meta.solution ? `\n${meta.solution}` : '', '\nWhat did you get?'].join('');
  return {
    kind, hook,
    instagram: { caption: `${hook}\n\n${meta.statement}\n\nAnswer in the comments — no calculator.`, first_comment: `${answer}\n\n${hashtags}` },
    tiktok: { caption: `${hook} ${meta.statement} #math #puzzle #brainteaser #learnontiktok`, first_comment: answer },
    youtube: { title: `${meta.statement} — ${meta.durationS} seconds`.slice(0, 70),
               description: `${hook}\n\n${meta.statement}\n\nAnswer in the comments — no calculator.\n\n#math #puzzle #Shorts`, tags, first_comment: answer },
    alt_text: `A countdown ring around the puzzle "${meta.statement}", with the mascot Axi.`,
    nulls: [{ field: 'caption', reason: 'caption agent produced nothing; fallback copy' }],
  };
}
