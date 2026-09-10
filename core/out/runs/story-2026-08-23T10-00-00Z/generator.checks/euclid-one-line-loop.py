"""
Story check: Euclid's one-line loop.

    gcd(a, b) = gcd(a - b, b)        for a > b > 0

The hypothesis "a > b > 0" is part of the claim, not decoration. It is what makes the identity
into a LOOP: it can only be applied to a pair whose larger entry is written first, so applying it
repeatedly forces the larger entry to be the one that shrinks, and it keeps both entries positive
whole numbers - Euclid's own setting in Elements VII (Def., VII.1-2).

What this script settles:

  1. the identity itself, exhaustively on its stated domain;
  2. the reason given for it - the two pairs have the SAME SET of common divisors;
  3. that the domain guard really excludes b = 0, negatives, and a < b, so nothing is claimed
     outside the hypothesis;
  4. that the procedure the story narrates IS the procedure the one line defines: each step is
     one application of the identity, with the larger entry written first;
  5. termination, by exhibiting the strictly decreasing positive-integer measure, and confirming
     the returned value is the gcd on every pair up to the limit;
  6. that the hypothesis is load-bearing - the unordered swap (a, b) -> (b, a - b), which is the
     same identity with the hypothesis thrown away, does NOT terminate on the story's own numbers;
  7. the payoff numbers: 6 subtractions, gcd(1920, 1080) = 120, 1920:1080 = 16:9.
"""
import json
from math import gcd as math_gcd
from sympy import igcd, Rational

LIM = 200          # exhaustive limit for the identity and the loop
SET_LIM = 90       # cheaper limit for the brute-force divisor-set comparison


def in_domain(a, b):
    """The hypothesis of the one line, verbatim: a > b > 0."""
    return isinstance(a, int) and isinstance(b, int) and a > b > 0


def divisors_of_pair(x, y):
    """Every positive integer dividing both x and y. Brute force on purpose."""
    return {d for d in range(1, min(x, y) + 1) if x % d == 0 and y % d == 0}


# --------------------------------------------------------------------------- 1
# The identity, on exactly the domain the story states it for.
pairs_checked = 0
for a in range(2, LIM + 1):
    for b in range(1, a):
        assert in_domain(a, b)
        assert igcd(a, b) == igcd(a - b, b), (a, b)
        pairs_checked += 1

# --------------------------------------------------------------------------- 2
# The reason: identical sets of common divisors, both directions of the argument.
for a in range(2, SET_LIM + 1):
    for b in range(1, a):
        left = divisors_of_pair(a, b)
        right = divisors_of_pair(a - b, b)
        assert left == right, (a, b, sorted(left), sorted(right))
        assert max(left) == igcd(a, b)

# --------------------------------------------------------------------------- 3
# The domain guard excludes precisely the inputs that broke the earlier version.
assert not in_domain(1, 2)      # a < b            -> outside; no claim is made
assert not in_domain(5, 0)      # b = 0            -> outside; no claim is made
assert not in_domain(-7, -7)    # not positive     -> outside; no claim is made
assert not in_domain(3, -2)     # not positive     -> outside; no claim is made
assert not in_domain(7, 7)      # a = b            -> outside; this is the STOP state
for a in range(-40, 41):
    for b in range(-40, 41):
        if not (a > b > 0):
            assert not in_domain(a, b), (a, b)

# --------------------------------------------------------------------------- 4 + 5
def euclid_loop(x, y, trace=False):
    """
    The procedure exactly as narrated: two positive whole numbers; if they are equal, that is the
    answer; otherwise write the larger first - which is the only way the hypothesis a > b > 0 can
    be met - and replace it by the difference. Returns (value, subtractions, steps).
    """
    assert isinstance(x, int) and isinstance(y, int) and x > 0 and y > 0, (x, y)
    steps = []
    subtractions = 0
    guard = 10 ** 6
    while x != y:
        a, b = (x, y) if x > y else (y, x)
        assert in_domain(a, b)                    # every step is a legal use of the one line
        before_sum, before_gcd = a + b, igcd(a, b)
        a, b = a - b, b                           # the one line, applied
        assert a > 0 and b > 0                    # both entries stay positive whole numbers
        assert a + b < before_sum                 # the strictly decreasing measure
        assert igcd(a, b) == before_gcd           # the identity, live
        x, y = a, b
        subtractions += 1
        if trace:
            steps.append((subtractions, tuple(sorted((x, y), reverse=True))))
        guard -= 1
        assert guard > 0, 'did not terminate'
    return x, subtractions, steps


# Terminates, and returns the gcd, on every pair of positive integers up to LIM.
worst = (0, None)
for x in range(1, LIM + 1):
    for y in range(1, LIM + 1):
        val, n, _ = euclid_loop(x, y)
        assert val == igcd(x, y), (x, y, val)
        if n > worst[0]:
            worst = (n, (x, y))

# --------------------------------------------------------------------------- 6
# The hypothesis is load-bearing. Drop it - use the unordered swap (a, b) -> (b, a - b), which is
# the same identity with "a > b > 0" thrown away - and the story's own example runs forever.
def unordered_swap(a, b, rounds=400):
    seen = []
    for _ in range(rounds):
        if a == b:
            return ('halted', a, seen)
        a, b = b, a - b
        seen.append((a, b))
    return ('running', None, seen)

state, value, trail = unordered_swap(1920, 1080)
assert state == 'running', state
assert value is None
assert max(abs(u) for u in trail[-1]) > 10 ** 20    # it does not merely fail to halt, it blows up
assert trail[2] == (240, 600) and trail[3] == (600, -360)   # the verifier's witness, reproduced
# ...whereas the loop WITH the hypothesis halts on the same input.
val_1920, subs_1920, trace = euclid_loop(1920, 1080, trace=True)

# --------------------------------------------------------------------------- 7
assert val_1920 == 120
assert subs_1920 == 6
assert igcd(1920, 1080) == 120
assert max(divisors_of_pair(1920, 1080)) == 120        # "and nothing bigger"
assert 1920 // 120 == 16 and 1080 // 120 == 9
assert Rational(1920, 1080) == Rational(16, 9)
assert igcd(16, 9) == 1                                # 16:9 really is the end of the road

import sys as _sys
def _log(*a):
    print(*a, file=_sys.stderr)

_log('OK  identity gcd(a,b) = gcd(a-b,b) on a>b>0:', pairs_checked, 'pairs, no counterexample')
_log('OK  common-divisor SETS identical for both pairs (brute force to', SET_LIM, ')')
_log('OK  domain guard rejects b=0, negatives, a<b and a=b (6561 pairs in [-40,40] tested)')
_log('OK  loop terminates and returns gcd on all', LIM * LIM, 'positive pairs; worst case',
     worst[0], 'subtractions at', worst[1])
_log('OK  without the hypothesis the swap diverges: (1920,1080) ->', trail[2], '->', trail[3], '-> ...')
_log('OK  with it:', ' -> '.join(str(p) for _, p in trace), '=>', val_1920, 'in', subs_1920, 'subtractions')
_log('OK  1920/120 = 16, 1080/120 = 9, and gcd(16,9) = 1')

# The orchestrator reads ONLY this last stdout line and requires exactly one JSON object.
# `computed` is gcd(1920, 1080) recomputed here (not a literal), and must equal val_1920, the
# terminal value the loop itself returned above. `agrees` is true because reaching this line means
# every assertion above held. One line, last line, not pretty-printed.
_computed = str(math_gcd(1920, 1080))
assert _computed == str(val_1920) == '120'
print(json.dumps({'claim_id': 'euclid-one-line-loop', 'computed': _computed, 'agrees': True}))
