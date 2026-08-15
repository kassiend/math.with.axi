/**
 * KaTeX, rendered synchronously via renderToString.
 *
 * §4.3 chose KaTeX over MathJax precisely because it is synchronous: in a Playwright capture loop
 * an async typesetter produces screenshots that land before typesetting completes, and debugging
 * that inside a batch job is miserable. Do not swap in an async renderer here.
 *
 * `@vuepress/plugin-markdown-math` from the original brief is not used — it is a VuePress plugin,
 * and these lessons are React components. See docs/rationale.md.
 */
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface Props {
  tex: string;
  display?: boolean;
}

export function Tex({ tex, display = false }: Props) {
  let html: string;
  try {
    html = katex.renderToString(tex, {
      displayMode: display,
      throwOnError: true,
      strict: 'error',      // a silently-degraded formula is a wrong formula on screen
      output: 'html',
      trust: false,
    });
  } catch (err) {
    // Never render a formula the typesetter rejected. A visible failure marker beats a video
    // that ships malformed mathematics.
    html = `<span data-katex-error="1">⟨LaTeX error: ${escapeHtml(String(err))}⟩</span>`;
  }
  return <span className="tex" dangerouslySetInnerHTML={{ __html: html }} />;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}

/** True when any formula on the page failed to typeset. The capture stage can assert on this. */
export function hasKatexError(): boolean {
  return document.querySelector('[data-katex-error]') != null;
}
