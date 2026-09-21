/**
 * Load every face the pages use BEFORE any measurement or capture.
 *
 * `document.fonts.ready` resolves once the faces referenced by the current DOM are loaded — not
 * every declared face. A weight first used on a later frame (the 600 ask line, say) is then
 * fetched lazily during the capture, and Playwright's screenshot waits on `document.fonts` while
 * that happens. Measured: one screenshot took 244 s on that wait and the run timed out. Loading
 * all three weights up front means no font work can start mid-capture.
 */
export const FACES = ['400 40px Inter', '600 40px Inter', '800 40px Inter'];

/** @param extra  further faces a page uses (the story's Outfit weights) */
export async function fontsLoaded(extra: string[] = []): Promise<void> {
  await Promise.all([...FACES, ...extra].map((f) => document.fonts.load(f)));
  await document.fonts.ready;
}
