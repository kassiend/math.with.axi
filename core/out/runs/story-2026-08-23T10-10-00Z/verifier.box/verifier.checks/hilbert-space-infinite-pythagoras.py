"""Independent re-verification of the (thrice-)revised claim:

    sum_n <f,e_n>^2 <= ||f||^2         for all f in L^2
    equality for all f   <=>   {e_n} complete

on L^2(-pi, pi), real-valued f, <u,v> = int_{-pi}^{pi} u*v dx.

The revision's asserted fixes, each tested here:
  1. quantifier scoping: the UNIVERSAL biconditional (both directions), plus the
     POINTWISE characterisation 'equality <=> f in closed span', plus that the
     f=x-gives-equality-on-incomplete-sines case is the TRAP not the claim;
  2. the converse PROOF: incomplete => a nonzero g orthogonal to all e_n =>
     coordinate sum 0 < ||g||^2 => universal equality fails;
  3. witnesses only ILLUSTRATE: the Gram-Schmidt-on-{1,x,x^2,cos x} system that
     reproduces five squared norms yet is incomplete, so the witness set cannot
     stand in for completeness;
  4. hypotheses stated: square-integrability and the Stone-Weierstrass caveat
     are checked as CLAIM CONTENT here; their presence in the prose is judged in
     the verdict, not by this script.

All detail goes to stderr. The FINAL stdout line is the single canonical JSON
object, whose `computed` is ||x||^2 on (-pi,pi) obtained two independent ways.
"""

import json
import sys
import sympy as sp

def log(*a):
    print(*a, file=sys.stderr)

x = sp.Symbol('x', real=True)
n = sp.Symbol('n', integer=True, positive=True)


def ip(u, v):
    return sp.simplify(sp.integrate(sp.expand(u * v), (x, -sp.pi, sp.pi)))


def nrm2(u):
    return sp.simplify(sp.integrate(sp.expand(u * u), (x, -sp.pi, sp.pi)))


def S(k):
    return sp.sin(k * x) / sp.sqrt(sp.pi)


def C(k):
    return sp.cos(k * x) / sp.sqrt(sp.pi)


K = sp.Integer(1) / sp.sqrt(2 * sp.pi)
NCHECK = 10
BIG_N = [41, 97, 300]


def coeff_sum(f, fam):
    """Exact sum_{k>=1} <f,fam(k)>^2. Symbolic-in-n formula trusted only after it
    matches concrete integrals for k=1..NCHECK and sums to a closed number;
    otherwise a finite sum accepted only once the tail is verified zero on a
    contiguous window and at scattered large n (guards against a Piecewise index)."""
    concrete = [ip(f, fam(k)) for k in range(1, NCHECK + 1)]
    try:
        csym = sp.simplify(ip(f, fam(n)))
        if all(sp.simplify(csym.subs(n, k) - concrete[k - 1]) == 0
               for k in range(1, NCHECK + 1)):
            tot = sp.simplify(sp.summation(csym ** 2, (n, 1, sp.oo)))
            if tot.is_number and not tot.has(sp.Sum):
                return sp.simplify(tot)
    except Exception:
        pass
    window = [ip(f, fam(k)) for k in range(NCHECK + 1, 2 * NCHECK + 1)]
    far = [ip(f, fam(k)) for k in BIG_N]
    if all(t == 0 for t in window) and all(t == 0 for t in far):
        return sp.simplify(sum(c ** 2 for c in concrete))
    raise RuntimeError('tail unresolved')


results = {}

# ------------------------------------------------------- (0) orthonormal systems
sine_on = (ip(S(n), S(n)) == 1) and {ip(S(a), S(b)) for a in range(1, 6)
                                     for b in range(1, 6) if a != b} == {0}
trig = [K] + [C(k) for k in range(1, 5)] + [S(k) for k in range(1, 5)]
trig_on = all(ip(u, v) == (1 if i == j else 0)
              for i, u in enumerate(trig) for j, v in enumerate(trig))
results['sine_orthonormal'] = bool(sine_on)
results['trig_orthonormal'] = bool(trig_on)
log('[0] sine orthonormal:', sine_on, '| trig orthonormal:', trig_on)

WIT = [
    ('1', sp.Integer(1), 2 * sp.pi),
    ('cos x', sp.cos(x), sp.pi),
    ('x^2', x ** 2, 2 * sp.pi ** 5 / 5),
    ('1 + x', 1 + x, 2 * sp.pi * (3 + sp.pi ** 2) / 3),
    ('x', x, 2 * sp.pi ** 3 / 3),
]

# ------------------------- (1a) Bessel for all f (illustrated), and the f=x TRAP
bessel_ok = True
xeq_trap = None
for lbl, f, norm in WIT:
    L = nrm2(f)
    R = coeff_sum(f, S)
    holds = bool(sp.simplify(L - R) >= 0)
    bessel_ok = bessel_ok and holds and bool(sp.simplify(L - norm) == 0)
    if lbl == 'x':
        xeq_trap = bool(sp.simplify(L - R) == 0)   # equality on INCOMPLETE sines
    log(f'[1a] sine: ||{lbl}||^2={L}  sum={R}  Bessel<= {holds}  eq={L==R}')
results['bessel_holds_all_witnesses'] = bool(bessel_ok)
# f=x lies in the closed span (odd), so equality is the TRAP, not evidence of completeness
results['pointwise_trap_f_eq_x_equality_on_incomplete_sines'] = bool(xeq_trap)

# ------------------------------- (1b) POINTWISE characterisation: eq <=> in span
# f=x is odd -> in closed span of sines -> equality; f=1 has nonzero even part
# -> not in span -> strict. Confirms 'equality <=> f in closed span', not 'complete'.
one_L, one_R = nrm2(sp.Integer(1)), coeff_sum(sp.Integer(1), S)
pointwise_char = bool(xeq_trap) and bool(sp.simplify(one_L - one_R) > 0)
results['pointwise_characterisation'] = pointwise_char
log('[1b] pointwise: f=x equality =', xeq_trap,
    '| f=1 strict (0 <', one_L, ') =', bool(one_L - one_R > 0))

# ---------------------------- (2) converse PROOF instance: incomplete => g exists
# Standard characterisation input: an incomplete orthonormal set admits a nonzero
# g orthogonal to every member. For the sines, g=1 witnesses it. Then coordinate
# sum(g)=0 < ||g||^2, so universal equality fails. Verify the arithmetic of the
# proof step on this concrete g, AND a parity-free second instance.
g1 = sp.Integer(1)
g1_orth = all(ip(g1, S(k)) == 0 for k in list(range(1, 30)) + BIG_N)
g1_sum = coeff_sum(g1, S)
g1_pos = bool(sp.N(nrm2(g1)) > 0)
conv1 = bool(g1_orth and g1_sum == 0 and g1_pos)
# second instance: trig basis with cos(x) removed is incomplete; g=cos x is orth.
def trig_minus_cos1_sum(f):
    cos_part = sp.simplify(sum(ip(f, C(k)) ** 2 for k in range(2, 2 * NCHECK))
                           + sum(ip(f, C(k)) ** 2 for k in BIG_N))
    return sp.simplify(ip(f, K) ** 2 + cos_part + coeff_sum(f, S))
g2 = sp.cos(x)
g2_orth = bool(ip(g2, K) == 0
               and all(ip(g2, C(k)) == 0 for k in list(range(2, 30)) + BIG_N)
               and all(ip(g2, S(k)) == 0 for k in list(range(1, 30)) + BIG_N))
g2_sum = trig_minus_cos1_sum(g2)
conv2 = bool(g2_orth and sp.simplify(g2_sum) == 0 and sp.N(nrm2(g2)) > 0)
results['converse_proof_instance_sine_g1'] = conv1
results['converse_proof_instance_trig_minus_cos_g2'] = conv2
log('[2] converse: g=1 orth&sum0&pos =', conv1,
    '| g=cos x orth&sum0&pos =', conv2)

# ------------------------- (3) forward direction illustrated: complete trig basis
trig_parseval = True
for lbl, f, norm in WIT:
    L = nrm2(f)
    R = sp.simplify(ip(f, K) ** 2 + coeff_sum(f, C) + coeff_sum(f, S))
    trig_parseval = trig_parseval and bool(sp.simplify(L - R) == 0)
    log(f'[3] trig: ||{lbl}||^2={L}  sum={R}  eq={L==R}')
# and the 'constant, not cosine, repairs f=1' point:
one_const = sp.simplify(ip(sp.Integer(1), K) ** 2)
one_cosines = coeff_sum(sp.Integer(1), C)
const_essential = bool(sp.simplify(one_const - 2 * sp.pi) == 0 and one_cosines == 0)
results['trig_parseval_all_witnesses'] = bool(trig_parseval)
results['f1_repaired_by_constant_not_cosines'] = const_essential
log('[3] f=1: constant part =', one_const, ' cosine part =', one_cosines,
    ' -> constant essential =', const_essential)

# --------- (4) witnesses cannot prove completeness: incomplete system, 5 norms ok
V = [sp.Integer(1), x, x ** 2, sp.cos(x)]
U = []
for v in V:
    w = sp.simplify(v - sum(ip(v, u) * u for u in U))
    U.append(sp.simplify(w / sp.sqrt(nrm2(w))))
U_on = all(sp.simplify(ip(U[i], U[j]) - (1 if i == j else 0)) == 0
           for i in range(4) for j in range(4))
gs_all_eq = all(bool(sp.simplify(nrm2(f) - sum(ip(f, u) ** 2 for u in U)) == 0)
                for _, f, _ in WIT)
resid = sp.simplify(sp.cos(2 * x) - sum(ip(sp.cos(2 * x), u) * u for u in U))
resid_pos = bool(sp.N(nrm2(resid)) > 0)
resid_orth = all(sp.simplify(ip(resid, u)) == 0 for u in U)
witnesses_cannot_prove_completeness = bool(U_on and gs_all_eq and resid_pos and resid_orth)
results['witnesses_cannot_prove_completeness'] = witnesses_cannot_prove_completeness
log('[4] GS system orthonormal =', U_on, ' matches 5 norms =', gs_all_eq,
    ' residual pos&orth =', resid_pos and resid_orth,
    ' ||residual||^2 =', sp.N(nrm2(resid), 6))

# ------------------------------ canonical value: ||x||^2 computed two ways
norm_integral = nrm2(x)                                  # int x^2 dx
norm_coeffsum = sp.simplify(sp.summation(4 * sp.pi / n ** 2, (n, 1, sp.oo)))  # sum 4pi/n^2
two_way_equal = bool(sp.simplify(norm_integral - norm_coeffsum) == 0)
results['norm_x_two_ways_agree'] = two_way_equal
log('[canonical] integral =', norm_integral, ' coeff-sum =', norm_coeffsum,
    ' agree =', two_way_equal)

# ------------------------------------------------------------------- overall
agrees = all([
    results['sine_orthonormal'],
    results['trig_orthonormal'],
    results['bessel_holds_all_witnesses'],
    results['pointwise_trap_f_eq_x_equality_on_incomplete_sines'],
    results['pointwise_characterisation'],
    results['converse_proof_instance_sine_g1'],
    results['converse_proof_instance_trig_minus_cos_g2'],
    results['trig_parseval_all_witnesses'],
    results['f1_repaired_by_constant_not_cosines'],
    results['witnesses_cannot_prove_completeness'],
    results['norm_x_two_ways_agree'],
])
log('[verdict] component results:', json.dumps(results))
log('[verdict] agrees =', agrees)

computed = str(norm_integral)   # SymPy renders "2*pi**3/3"
print(json.dumps({
    'claim_id': 'hilbert-space-infinite-pythagoras',
    'computed': computed,
    'agrees': bool(agrees),
}))
