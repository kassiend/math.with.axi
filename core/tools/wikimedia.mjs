#!/usr/bin/env node
/**
 * Wikimedia Commons image search, with the licence as a GATE rather than a note.
 *
 * A monetised channel cannot use an image because it "looks old". Euler died in 1783, but the
 * scan of his portrait, its restoration and its cropping can each carry their own claim, and a
 * photograph of a public-domain painting is a separate work in several jurisdictions. Commons is
 * the one large source that states its licence in machine-readable form, so it is the only source
 * this pipeline reads from.
 *
 * Anything Commons cannot supply under an accepted licence is GENERATED instead — see
 * tools/gemini-image.mjs. There is no third path where a file is used because nobody checked.
 *
 *   node core/tools/wikimedia.mjs search "Leonhard Euler portrait" --limit 5
 *   node core/tools/wikimedia.mjs fetch "File:Leonhard Euler.jpg" --out core/out/runs/x/img/euler.jpg
 */
import fs from 'node:fs';
import path from 'node:path';

const API = 'https://commons.wikimedia.org/w/api.php';
const UA = 'math-with-axi/0.1 (educational short-form video; contact via repository)';

/**
 * Licences this pipeline accepts. Public domain and permissive Creative Commons only.
 *
 * NonCommercial and NoDerivatives are absent on purpose: the channel is monetisable and the
 * images are composited into a derived work, so both would be violated by the use itself, not by
 * some future change of plan.
 */
export const ACCEPTED = [
  /^public domain$/i, /^pd\b/i, /^cc0/i,
  /^cc[- ]by(-sa)?[- ]?[0-9.]*$/i,
  /^attribution([- ]sharealike)?$/i,
];

export const REJECTED_MARKERS = [/non-?commercial/i, /\bnc\b/i, /no-?deriv/i, /\bnd\b/i, /fair use/i, /non-?free/i];

function accepted(licence) {
  const l = String(licence ?? '').trim();
  if (!l) return false;
  if (REJECTED_MARKERS.some((re) => re.test(l))) return false;
  return ACCEPTED.some((re) => re.test(l));
}

async function api(params) {
  const url = new URL(API);
  for (const [k, v] of Object.entries({ format: 'json', origin: '*', ...params })) {
    url.searchParams.set(k, String(v));
  }
  const res = await fetch(url, { headers: { 'user-agent': UA } });
  if (!res.ok) throw new Error(`Commons API ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

/**
 * Search Commons and return only files whose licence clears the gate, with the attribution
 * string the post owes. Rejected candidates come back too, with the reason — silence about why
 * a good-looking image was skipped just invites someone to use it anyway.
 */
export async function search(query, { limit = 8 } = {}) {
  const found = await api({
    action: 'query', generator: 'search', gsrsearch: `${query} filetype:bitmap`,
    gsrnamespace: 6, gsrlimit: limit,
    prop: 'imageinfo', iiprop: 'url|extmetadata|size|mime',
    iiurlwidth: 1200,
  });

  const pages = Object.values(found?.query?.pages ?? {});
  const usable = [];
  const rejected = [];

  for (const page of pages) {
    const info = page.imageinfo?.[0];
    if (!info) continue;
    const meta = info.extmetadata ?? {};
    const licence = meta.LicenseShortName?.value ?? meta.License?.value ?? '';
    const artist = String(meta.Artist?.value ?? '').replace(/<[^>]*>/g, '').trim();
    const credit = String(meta.Credit?.value ?? '').replace(/<[^>]*>/g, '').trim();

    const row = {
      title: page.title,
      licence,
      artist: artist || null,
      credit: credit || null,
      width: info.width, height: info.height, mime: info.mime,
      url: info.url,
      thumb: info.thumburl ?? info.url,
      descriptionurl: info.descriptionurl,
      attribution: `${artist || 'Unknown author'} — ${page.title}, ${licence || 'licence unstated'}, via Wikimedia Commons`,
    };

    if (accepted(licence) && /^image\/(jpeg|png|webp)$/.test(info.mime ?? '')) usable.push(row);
    else rejected.push({ title: page.title, licence, reason: accepted(licence) ? `unsupported type ${info.mime}` : 'licence not accepted' });
  }

  return { query, usable, rejected };
}

/** Download one file that has already cleared the gate. */
export async function fetchFile(entry, outFile) {
  if (!accepted(entry.licence)) {
    throw new Error(`refusing to download ${entry.title}: licence "${entry.licence}" is not accepted`);
  }
  const res = await fetch(entry.thumb ?? entry.url, { headers: { 'user-agent': UA } });
  if (!res.ok) throw new Error(`download failed ${res.status} for ${entry.title}`);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, Buffer.from(await res.arrayBuffer()));
  return { file: outFile, bytes: fs.statSync(outFile).size, attribution: entry.attribution, source: entry.descriptionurl };
}

// ---------------------------------------------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2);
  const flag = (n) => { const i = argv.indexOf(`--${n}`); return i === -1 ? undefined : argv[i + 1]; };
  try {
    if (argv[0] === 'search') {
      console.log(JSON.stringify(await search(argv[1] ?? '', { limit: Number(flag('limit') ?? 8) }), null, 2));
    } else if (argv[0] === 'fetch') {
      const r = await search(argv[1] ?? '', { limit: 8 });
      const pick = r.usable.find((u) => u.title === argv[1]) ?? r.usable[0];
      if (!pick) throw new Error(`nothing usable for "${argv[1]}" — every candidate failed the licence gate`);
      console.log(JSON.stringify(await fetchFile(pick, path.resolve(flag('out'))), null, 2));
    } else {
      console.error('commands: search <query> [--limit n] | fetch <query> --out <file>');
      process.exit(2);
    }
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
