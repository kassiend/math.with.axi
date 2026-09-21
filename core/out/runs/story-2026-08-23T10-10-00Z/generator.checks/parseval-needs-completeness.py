"""Parseval's identity: what orthonormality buys, and the one extra hypothesis it does not.

Setting: the real Hilbert space L^2(-pi, pi) of square-integrable functions, with
    <f, g> = integral of f*g over (-pi, pi),   ||f||^2 = <f, f>.
Every test function below is square-integrable, so all coordinates and norms exist. (For f
outside L^2 the coordinates need not exist; square-integrability is a hypothesis ON f, not a
convenience.)

The story's displayed relation, with its quantifiers made explicit, is:

    (Bessel)    for every f in L^2:   sum_n <f, e_n>^2  <=  ||f||^2
    (Parseval)  ( for every f: equality )  <=>  {e_n} is complete (an orthonormal basis)

This script does four separable things, and is careful about which are PROOF and which are only
ILLUSTRATION:

  A. PROOF (symbolic, general in the index): the sine system e_n = sin(nx)/sqrt(pi) is
     orthonormal; so is the full trigonometric system {1/sqrt(2pi)} U {cos(nx)/sqrt(pi)} U {sines}.
  B. ILLUSTRATION: five witnesses show Bessel holding against the sine system (4 strict, 1
     equality), and equality holding against the full trigonometric system.
  C. PROOF of the converse, as an INSTANCE of the general two-line argument: the sine system is
     incomplete, witnessed by g = 1, which is orthogonal to every e_n (all coordinates 0) yet has
     ||g||^2 = 2*pi > 0; so its coordinate sum 0 is strictly below its squared length, and
     equality fails. The general statement 'not complete => equality fails for some f' is the same
     argument with g any nonzero vector orthogonal to the whole system; the existence of such a g
     for an incomplete system is the cited characterisation of completeness, not something a
     finite computation supplies.
  D. PROOF that the five-witness protocol CANNOT establish completeness: Gram-Schmidt on
     {1, x, x^2, cos x} yields a 4-direction orthonormal system that returns EXACT equality on all
     five witnesses while being provably incomplete (the residual of cos 2x is nonzero and
     orthogonal to all four). Anyone certifying completeness from the five witnesses would certify
     this incomplete system. Hence completeness of the trigonometric basis is taken from a cited
     theorem (the Fourier basis is complete), never from the witnesses here.

Output contract (assets/templates/stories/story.md, section 6): all diagnostics go to stderr and
the LAST stdout line is exactly one single-line JSON object. The claim has no single scalar, so
the anchor is the story's own worked witness f(x) = x on (-pi, pi): its squared norm 2*pi**3/3,
produced two independent ways -- the integral of x^2, and the completed-basis coordinate sum
sum_n 4*pi/n^2 -- is emitted as `computed`. `agrees` is true iff every check above held.
"""

import sys
import json
import sympy as sp

x = sp.Symbol('x', real=True)
n = sp.Symbol('n', positive=True, integer=True)
m = sp.Symbol('m', positive=True, integer=True)
k = sp.Symbol('k', positive=True, integer=True)

CLAIM_ID = "hilbert-space-infinite-pythagoras"


def log(*a):
    print(*a, file=sys.stderr)


def inner(f, g):
    return sp.integrate(f * g, (x, -sp.pi, sp.pi))


def nsq(f):
    return sp.simplify(inner(f, f))


s = lambda j: sp.sin(j * x) / sp.sqrt(sp.pi)
c = lambda j: sp.cos(j * x) / sp.sqrt(sp.pi)
e0 = 1 / sp.sqrt(2 * sp.pi)


def sine_sum(f, res=None):
    if res is None:
        return sp.simplify(sp.summation(sp.simplify(inner(f, s(n))) ** 2, (n, 1, sp.oo)))
    head = sp.simplify(inner(f, s(res)) ** 2)
    tail = sp.simplify(sp.summation(sp.simplify(inner(f, s(n + res))) ** 2, (n, 1, sp.oo)))
    return sp.simplify(head + tail)


def cos_sum(f, res=None):
    const = sp.simplify(inner(f, e0) ** 2)
    if res is None:
        return sp.simplify(const + sp.summation(sp.simplify(inner(f, c(n))) ** 2, (n, 1, sp.oo)))
    head = sp.simplify(inner(f, c(res)) ** 2)
    tail = sp.simplify(sp.summation(sp.simplify(inner(f, c(n + res))) ** 2, (n, 1, sp.oo)))
    return sp.simplify(const + head + tail)


def gram_schmidt(raw):
    us = []
    for v in raw:
        wv = v
        for u in us:
            wv = wv - inner(v, u) / inner(u, u) * u
        us.append(sp.expand(wv))
    return [sp.simplify(u / sp.sqrt(inner(u, u))) for u in us]


def run_checks():
    """Every check. Returns the anchor value (norm^2 of f=x) computed two ways, asserting equal.
    Raises AssertionError if any check fails."""

    # A. orthonormality (general in the index, so proof, not sampling)
    assert sp.simplify(inner(s(n), s(n)) - 1) == 0
    assert sp.simplify(inner(s(n), s(n + k))) == 0
    assert sp.simplify(inner(e0, e0) - 1) == 0
    assert sp.simplify(inner(e0, c(n))) == 0
    assert sp.simplify(inner(e0, s(n))) == 0
    assert sp.simplify(inner(c(n), c(n)) - 1) == 0
    assert sp.simplify(inner(c(n), c(n + k))) == 0
    assert sp.simplify(inner(c(n), s(m))) == 0
    log("A. sine system and full trigonometric system are orthonormal  [proof]")

    # B. witnesses: sines (Bessel) and full trig basis (Parseval)  [illustration]
    witnesses = [
        ('f = 1',      sp.Integer(1),  None, None),
        ('f = cos x',  sp.cos(x),      1,    None),
        ('f = x',      x,              None, None),
        ('f = x^2',    x ** 2,         None, None),
        ('f = 1 + x',  1 + x,          None, None),
    ]
    rows = []
    for label, f, cres, sres in witnesses:
        N = nsq(f)
        sines = sine_sum(f, sres)
        full = sp.simplify(sines + cos_sum(f, cres))
        assert bool(sp.simplify(N - sines) >= 0), f'{label}: Bessel violated'
        assert sp.simplify(N - full) == 0, f'{label}: Parseval fails for full basis: {full} vs {N}'
        rows.append((label, N, sines, sp.simplify(N - sines) == 0, full))
    odd_only = [r[0] for r in rows if r[3]]
    assert odd_only == ['f = x'], f'expected only the odd witness to reach equality with sines, got {odd_only}'
    w = max(len(r[0]) for r in rows)
    log("B. witnesses  [illustration -- NOT a proof of any 'for all f' statement]")
    log(f'   {"":<{w}}  {"||f||^2":>16}  {"sines":>12}  {"=?":>5}  {"full basis":>16}')
    for label, N, sines, eq, full in rows:
        log(f'   {label:<{w}}  {str(N):>16}  {str(sines):>12}  {str(eq):>5}  {str(full):>16}')

    # C. converse, as an instance: incomplete => equality fails for some f
    g = sp.Integer(1)
    assert sp.simplify(inner(g, s(n))) == 0, 'g=1 should be orthogonal to every sine'
    assert sp.simplify(nsq(g)) == 2 * sp.pi
    assert sp.simplify(sine_sum(g)) == 0
    log("C. converse instance: g = 1 is orthogonal to every sine (all coordinates 0),")
    log(f"   yet ||g||^2 = {nsq(g)} > 0, so 0 = sum < ||g||^2 -- the sine system is incomplete  [proof]")

    # D. five witnesses cannot certify completeness: an incomplete system that passes them all
    fake = gram_schmidt([sp.Integer(1), x, x ** 2, sp.cos(x)])
    for i in range(4):
        assert sp.simplify(inner(fake[i], fake[i]) - 1) == 0
        for j in range(i + 1, 4):
            assert sp.simplify(inner(fake[i], fake[j])) == 0
    for label, f, _, _ in witnesses:
        coord_sum = sp.simplify(sum(inner(f, u) ** 2 for u in fake))
        assert sp.simplify(coord_sum - nsq(f)) == 0, f'{label}: fake basis failed to match'
    residual = sp.cos(2 * x) - sum(inner(sp.cos(2 * x), u) * u for u in fake)
    res_norm2 = sp.simplify(inner(residual, residual))
    for u in fake:
        assert sp.simplify(inner(residual, u)) == 0
    assert res_norm2 > 0
    log("D. Gram-Schmidt{1, x, x^2, cos x}: 4 orthonormal directions give EXACT equality on all")
    log(f"   five witnesses, yet are incomplete -- residual of cos 2x has ||r||^2 = {res_norm2} > 0.")
    log("   So no finite witness set certifies completeness; that rests on the cited theorem.  [proof]")

    # ANCHOR: the story's worked witness f(x) = x, two independent routes to ||f||^2.
    # Route 1 -- the integral of x^2 over (-pi, pi).
    anchor_integral = sp.simplify(inner(x, x))
    # Route 2 -- the completed-basis coordinate sum. For f = x the only nonzero coordinates are the
    # sine ones, <x, e_n> = 2*sqrt(pi)*(-1)^(n+1)/n, squares 4*pi/n^2; the constant and cosine
    # coordinates all vanish (x is odd). So the completed-basis sum equals sum_n 4*pi/n^2.
    coeff = sp.simplify(inner(x, s(n)))                       # 2*sqrt(pi)*(-1)^(n+1)/n
    assert sp.simplify(coeff ** 2 - 4 * sp.pi / n ** 2) == 0
    assert sp.simplify(inner(x, e0)) == 0                     # constant coordinate is 0
    assert sp.simplify(inner(x, c(n))) == 0                   # every cosine coordinate is 0
    anchor_sum = sp.simplify(sp.summation(4 * sp.pi / n ** 2, (n, 1, sp.oo)))
    assert sp.simplify(anchor_integral - anchor_sum) == 0, f'anchor mismatch: {anchor_integral} vs {anchor_sum}'
    assert sp.simplify(anchor_integral - 2 * sp.pi ** 3 / 3) == 0
    log(f"ANCHOR f=x: integral of x^2 = {anchor_integral}; coordinate sum 4*pi/n^2 = {anchor_sum}  [proof]")

    return sp.simplify(anchor_integral)


if __name__ == '__main__':
    try:
        anchor = run_checks()
        agrees = True
        computed = str(anchor)
        log("")
        log("PASS: orthonormality proved; Bessel/Parseval illustrated; converse proved by instance;")
        log("      witness protocol shown incapable of establishing completeness; anchor confirmed.")
    except AssertionError as err:
        agrees = False
        computed = f"assertion failed: {err}"
        log(f"FAIL: {err}")

    # The LAST stdout line: exactly one single-line JSON object.
    print(json.dumps({"claim_id": CLAIM_ID, "computed": computed, "agrees": agrees}))
