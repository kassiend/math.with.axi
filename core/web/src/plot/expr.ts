/**
 * A small, closed expression language for plot specifications.
 *
 * Plot specs arrive as JSON written by an agent, and the thing being plotted is a formula. The
 * obvious implementation — `new Function('x', 'return ' + src)` — is not available here: the
 * capture page would be executing agent-authored JavaScript, and the sandbox around it is the
 * browser the whole pipeline runs in. So the grammar is closed instead: numbers, one or two
 * declared variables, a fixed operator set, and a whitelist of functions. Anything else is a
 * parse error, which surfaces as a visible failure rather than as a plot of the wrong curve.
 *
 * Grammar, lowest precedence first:
 *
 *   expr    := term (('+' | '-') term)*
 *   term    := unary (('*' | '/' | '%') unary)*
 *   unary   := ('-' | '+') unary | power
 *   power   := atom ('^' unary)?            -- right associative, so 2^3^2 is 2^9
 *   atom    := number | constant | variable | name '(' expr (',' expr)* ')' | '(' expr ')'
 *
 * `^` binds tighter than unary minus on the left and looser on the right, which is the usual
 * mathematical reading: -x^2 is -(x^2), and 2^-1 is valid.
 */

/** Functions a spec may call. Everything else is rejected at parse time. */
const FUNCTIONS: Record<string, { arity: number; fn: (...a: number[]) => number }> = {
  sin:   { arity: 1, fn: Math.sin },
  cos:   { arity: 1, fn: Math.cos },
  tan:   { arity: 1, fn: Math.tan },
  asin:  { arity: 1, fn: Math.asin },
  acos:  { arity: 1, fn: Math.acos },
  atan:  { arity: 1, fn: Math.atan },
  atan2: { arity: 2, fn: Math.atan2 },
  sinh:  { arity: 1, fn: Math.sinh },
  cosh:  { arity: 1, fn: Math.cosh },
  tanh:  { arity: 1, fn: Math.tanh },
  exp:   { arity: 1, fn: Math.exp },
  ln:    { arity: 1, fn: Math.log },
  log:   { arity: 1, fn: Math.log10 },
  log2:  { arity: 1, fn: Math.log2 },
  sqrt:  { arity: 1, fn: Math.sqrt },
  cbrt:  { arity: 1, fn: Math.cbrt },
  abs:   { arity: 1, fn: Math.abs },
  sign:  { arity: 1, fn: Math.sign },
  floor: { arity: 1, fn: Math.floor },
  ceil:  { arity: 1, fn: Math.ceil },
  round: { arity: 1, fn: Math.round },
  min:   { arity: 2, fn: Math.min },
  max:   { arity: 2, fn: Math.max },
  pow:   { arity: 2, fn: Math.pow },
  mod:   { arity: 2, fn: (a, b) => a - b * Math.floor(a / b) },
};

const CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  tau: Math.PI * 2,
  e: Math.E,
  phi: (1 + Math.sqrt(5)) / 2,
};

export class ExprError extends Error {}

type Node =
  | { t: 'num'; v: number }
  | { t: 'var'; i: number }
  | { t: 'bin'; op: string; l: Node; r: Node }
  | { t: 'neg'; a: Node }
  | { t: 'call'; name: string; args: Node[] };

interface Token { kind: 'num' | 'name' | 'op'; text: string; pos: number }

function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { i++; continue; }
    if (c >= '0' && c <= '9') {
      let j = i;
      while (j < src.length && /[0-9]/.test(src[j])) j++;
      if (src[j] === '.') { j++; while (j < src.length && /[0-9]/.test(src[j])) j++; }
      if (src[j] === 'e' || src[j] === 'E') {
        // Only consume an exponent that is actually one: `2e3`, `2e-3`. Bare `2e` is `2 * e`.
        let k = j + 1;
        if (src[k] === '+' || src[k] === '-') k++;
        if (k < src.length && /[0-9]/.test(src[k])) {
          j = k; while (j < src.length && /[0-9]/.test(src[j])) j++;
        }
      }
      out.push({ kind: 'num', text: src.slice(i, j), pos: i });
      i = j; continue;
    }
    if (c === '.' && /[0-9]/.test(src[i + 1] ?? '')) {
      let j = i + 1;
      while (j < src.length && /[0-9]/.test(src[j])) j++;
      out.push({ kind: 'num', text: src.slice(i, j), pos: i });
      i = j; continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++;
      out.push({ kind: 'name', text: src.slice(i, j), pos: i });
      i = j; continue;
    }
    if ('+-*/%^(),'.includes(c)) { out.push({ kind: 'op', text: c, pos: i }); i++; continue; }
    throw new ExprError(`unexpected character ${JSON.stringify(c)} at ${i} in ${JSON.stringify(src)}`);
  }
  return out;
}

/**
 * Compiles `source` into a plain function of the declared variables.
 *
 * Parsing happens once, here; the returned closure walks a tree of numbers and calls, which is
 * fast enough for the few hundred samples a curve needs and costs nothing in dependencies.
 */
export function compile(source: string, vars: string[]): (...args: number[]) => number {
  const toks = tokenize(source);
  let p = 0;

  const peek = () => toks[p];
  const at = (text: string) => toks[p]?.kind === 'op' && toks[p].text === text;
  const eat = (text: string) => { if (!at(text)) fail(`expected ${JSON.stringify(text)}`); p++; };
  function fail(what: string): never {
    const tok = toks[p];
    throw new ExprError(
      `${what} at ${tok ? `position ${tok.pos} (${JSON.stringify(tok.text)})` : 'end of input'}` +
      ` in ${JSON.stringify(source)}`,
    );
  }

  function parseExpr(): Node {
    let node = parseTerm();
    while (at('+') || at('-')) { const op = toks[p++].text; node = { t: 'bin', op, l: node, r: parseTerm() }; }
    return node;
  }
  function parseTerm(): Node {
    let node = parseUnary();
    while (at('*') || at('/') || at('%')) { const op = toks[p++].text; node = { t: 'bin', op, l: node, r: parseUnary() }; }
    return node;
  }
  function parseUnary(): Node {
    if (at('-')) { p++; return { t: 'neg', a: parseUnary() }; }
    if (at('+')) { p++; return parseUnary(); }
    return parsePower();
  }
  function parsePower(): Node {
    const base = parseAtom();
    if (at('^')) { p++; return { t: 'bin', op: '^', l: base, r: parseUnary() }; }
    return base;
  }
  function parseAtom(): Node {
    const tok = peek();
    if (!tok) fail('expected a value');
    if (tok.kind === 'num') { p++; return { t: 'num', v: Number(tok.text) }; }
    if (at('(')) { p++; const inner = parseExpr(); eat(')'); return inner; }
    if (tok.kind === 'name') {
      p++;
      const name = tok.text;
      if (at('(')) {
        const spec = FUNCTIONS[name];
        if (!spec) throw new ExprError(`unknown function ${JSON.stringify(name)} in ${JSON.stringify(source)}`);
        p++;
        const args: Node[] = [parseExpr()];
        while (at(',')) { p++; args.push(parseExpr()); }
        eat(')');
        if (args.length !== spec.arity) {
          throw new ExprError(`${name} takes ${spec.arity} argument(s), got ${args.length}`);
        }
        return { t: 'call', name, args };
      }
      const vi = vars.indexOf(name);
      if (vi >= 0) return { t: 'var', i: vi };
      if (name in CONSTANTS) return { t: 'num', v: CONSTANTS[name] };
      throw new ExprError(
        `unknown name ${JSON.stringify(name)} in ${JSON.stringify(source)} — ` +
        `variables here are ${vars.map((v) => JSON.stringify(v)).join(', ')}`,
      );
    }
    fail('expected a value');
  }

  const root = parseExpr();
  if (p !== toks.length) fail('unexpected trailing input');

  const ev = (n: Node, a: number[]): number => {
    switch (n.t) {
      case 'num': return n.v;
      case 'var': return a[n.i];
      case 'neg': return -ev(n.a, a);
      case 'call': return FUNCTIONS[n.name].fn(...n.args.map((x) => ev(x, a)));
      case 'bin': {
        const l = ev(n.l, a), r = ev(n.r, a);
        switch (n.op) {
          case '+': return l + r;
          case '-': return l - r;
          case '*': return l * r;
          case '/': return l / r;
          case '%': return l - r * Math.floor(l / r);
          case '^': return Math.pow(l, r);
        }
        throw new ExprError(`unknown operator ${n.op}`);
      }
    }
  };

  return (...args: number[]) => ev(root, args);
}
