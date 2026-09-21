"""Independent verification of claim `euclid-one-line-loop` (revised statement).

Claim:  gcd(a,b) = gcd(a-b, b)  for  a > b > 0,
        plus a mechanism with load-bearing sub-assertions:

  M1 IDENTITY   : common divisors of (a,b) and (a-b,b) are the identical SET,
                  hence equal gcds, on the whole stated domain a > b > 0.
  M2 CLOSURE    : applying the rule to unordered {a,b} gives {a-b, b}; "both
                  entries are still positive whole numbers and the hypothesis
                  can be met again as long as they differ". So the set of
                  unordered pairs of positive integers must be CLOSED under the
                  operation, and the hypothesis must be re-satisfiable (after
                  the larger-first relabelling the hypothesis itself forces)
                  exactly when the entries differ. The loop must never step
                  outside its own precondition.
  M3 MEASURE    : "Each application decreases the sum of the pair by b, and
                  b >= 1, so the sum is a strictly decreasing sequence of
                  integers bounded below by 2." Must decrease on EVERY
                  application over the WHOLE domain, by exactly b, with the
                  lower bound 2 actually holding at every reachable state.
                  Halting must occur exactly at equal entries, and the terminal
                  pair {g,g} must satisfy g = gcd(original pair).
  M4 EXCLUSIONS : the payload's own account of what happens outside the
                  hypothesis: b = 0 leaves the pair unchanged; a negative entry
                  can grow without bound or halt on a negative non-gcd; a < b
                  means the rule does not apply until rewritten larger-first.
                  These are asserted in the text, so they are tested, not
                  assumed.
  M5 EXAMPLE    : the exact seven-pair trace on {1920,1080}, six subtractions
                  to 120, and 16:9.

Nothing is taken on trust from the prose. The closure and measure tests run over
every reachable state of every orbit in the window, not over selected examples.
"""

import json
from sympy import gcd, Integer, fibonacci

N = 260               # exhaustive window: all a > b > 0 with a <= N
DIVWINDOW = 600       # window for enumerating common divisors
STEP_CAP = 2_000_000  # step budget; orbits must finish well inside it


def rule(a, b):
    """The one line, applied to a pair already written larger-first."""
    return (a - b, b)


def as_unordered(x, y):
    """Larger-first relabelling: a relabelling of an unordered pair, which is
    what the hypothesis a > b > 0 forces, not an extra rule."""
    return (x, y) if x >= y else (y, x)


def hypothesis_holds(a, b):
    return a > b > 0


def common_divisors(x, y):
    return frozenset(d for d in range(1, DIVWINDOW + 1) if x % d == 0 and y % d == 0)


# ---------- M1: the identity and the divisor-SET claim ------------------
identity_fails = []
divset_fails = []
for a in range(2, N + 1):
    for b in range(1, a):                      # exactly the domain a > b > 0
        if gcd(Integer(a), Integer(b)) != gcd(Integer(a - b), Integer(b)):
            identity_fails.append((a, b))
        if common_divisors(a, b) != common_divisors(a - b, b):
            divset_fails.append((a, b))
identity_ok = not identity_fails
divset_ok = not divset_fails

big_fails = []
for a, b in [(10**12 + 7, 10**6 + 3), (2**31 - 1, 2**16), (999983, 999979),
             (int(fibonacci(40)), int(fibonacci(39))), (10**9, 1)]:
    if gcd(Integer(a), Integer(b)) != gcd(Integer(a - b), Integer(b)):
        big_fails.append((a, b))
big_ok = not big_fails


# ---------- M2 + M3: closure and measure at every reachable state -------
def orbit(x0, y0):
    """Run the loop from an unordered pair of positive integers, policing every
    stated property at every step. Returns (violations, terminal, steps)."""
    v = {
        "left_domain": None,
        "hypothesis_unmet_but_distinct": None,
        "hypothesis_met_but_equal": None,
        "sum_not_decreasing": None,
        "sum_decrease_not_b": None,
        "sum_below_2": None,
        "nonterminating": False,
    }
    a, b = as_unordered(x0, y0)
    steps = 0
    while True:
        # closure: every reachable state must be two positive whole numbers
        if not (isinstance(a, int) and isinstance(b, int) and a > 0 and b > 0):
            v["left_domain"] = (a, b)
            return v, None, steps
        if a + b < 2:                       # the bound the mechanism claims
            v["sum_below_2"] = (a, b)
        distinct = (a != b)
        met = hypothesis_holds(a, b)
        if distinct and not met:            # "can be met again as long as they differ"
            v["hypothesis_unmet_but_distinct"] = (a, b)
        if met and not distinct:            # "exactly when the two numbers are equal"
            v["hypothesis_met_but_equal"] = (a, b)
        if not distinct:
            return v, a, steps              # halt: the pair is {g, g}
        if steps >= STEP_CAP:
            v["nonterminating"] = True
            return v, None, steps
        old_sum, smaller = a + b, b
        na, nb = rule(a, b)
        new_sum = na + nb
        if not new_sum < old_sum:
            v["sum_not_decreasing"] = (a, b, old_sum, new_sum)
        if old_sum - new_sum != smaller:
            v["sum_decrease_not_b"] = (a, b, old_sum - new_sum, smaller)
        a, b = as_unordered(na, nb)
        steps += 1


closure_violations = []
measure_violations = []
halt_condition_violations = []
nonterminating = []
wrong_terminal = []
max_steps_seen = (0, None)


def run_case(x, y):
    global max_steps_seen
    v, term, steps = orbit(x, y)
    if v["left_domain"] is not None:
        closure_violations.append((x, y, v["left_domain"]))
    if (v["sum_not_decreasing"] is not None or v["sum_decrease_not_b"] is not None
            or v["sum_below_2"] is not None):
        measure_violations.append((x, y, v))
    if (v["hypothesis_unmet_but_distinct"] is not None
            or v["hypothesis_met_but_equal"] is not None):
        halt_condition_violations.append((x, y, v))
    if v["nonterminating"]:
        nonterminating.append((x, y))
    elif term is None or term != int(gcd(Integer(x), Integer(y))):
        wrong_terminal.append((x, y, term, int(gcd(Integer(x), Integer(y)))))
    if steps > max_steps_seen[0]:
        max_steps_seen = (steps, (x, y))


for x in range(1, N + 1):
    for y in range(1, N + 1):
        run_case(x, y)

# adversarial orbits: worst case for step count, and large inputs
adversarial = [(100000, 1), (99991, 2), (int(fibonacci(30)), int(fibonacci(29))),
               (2**20, 2**20 - 1), (777777, 111111), (1, 1), (1, 2), (2, 1)]
for x, y in adversarial:
    run_case(x, y)

min_reachable_sum = min(a + b for a in range(1, 40) for b in range(1, 40))
bound_2_tight = (min_reachable_sum == 2)

closure_ok = not closure_violations
measure_ok = not measure_violations
halt_ok = not halt_condition_violations
termination_ok = not nonterminating
terminal_value_ok = not wrong_terminal


# ---------- M4: the payload's own statements about the excluded region --
def subtract_less_from_greater(a, b, cap=400_000, magcap=10**5):
    seq = [(a, b)]
    for _ in range(cap):
        if a == b:
            return seq, "halted", a
        if abs(a) > magcap or abs(b) > magcap:
            return seq, "grew", None
        if a > b:
            a = a - b
        else:
            b = b - a
        seq.append((a, b))
    return seq, "ran-out", None


b0_seq, b0_status, _ = subtract_less_from_greater(5, 0, cap=500)
b0_claim_ok = (b0_status != "halted") and all(p == (5, 0) for p in b0_seq)
_, grow_status, _ = subtract_less_from_greater(3, -2)
_, grow_status2, _ = subtract_less_from_greater(-6, -4)
grow_claim_ok = (grow_status == "grew" and grow_status2 == "grew")
_, neg_status, neg_val = subtract_less_from_greater(-7, -7, cap=500)
neg_claim_ok = (neg_status == "halted" and neg_val == -7
                and neg_val != int(gcd(Integer(-7), Integer(-7))))
alb_claim_ok = not hypothesis_holds(3, 8)
exclusions_ok = b0_claim_ok and grow_claim_ok and neg_claim_ok and alb_claim_ok


# ---------- M6 (informational): is integrality load-bearing? ------------
# The displayed hypothesis is "a > b > 0", which does not by itself say whole
# number; the prose supplies that separately ("positive whole numbers"). The
# termination argument needs b >= 1, which follows from b > 0 only for integers.
# Test whether the measure argument survives without integrality. This does NOT
# feed `agrees`: the payload claims nothing outside the integers, and gcd is not
# defined there, so no counterexample to the stated claim can live here. It only
# records whether the restriction is doing real work or is decorative.
from sympy import sqrt, Rational, nsimplify

def real_orbit(a, b, cap=300, prec=600):
    """Same loop over exact reals. Ordering decided by high-precision evaluation
    of the exact expressions, so no floating-point drift decides a comparison."""
    def ge(u, w):
        return (u - w).evalf(prec) >= 0
    a, b = (a, b) if ge(a, b) else (b, a)
    for k in range(cap):
        if (a - b).evalf(prec) == 0:
            return k, "halted"
        a, b = (a - b, b) if ge(a - b, b) else (b, a - b)
    return cap, "still-running"

steps_irrational, status_irrational = real_orbit(sqrt(2), Rational(1))
steps_rational, status_rational = real_orbit(Rational(12, 10), Rational(11, 10))
integrality_load_bearing = (status_irrational == "still-running"
                            and status_rational == "halted")

# ---------- M5: the exact published trace -------------------------------
claimed_trace = [(1920, 1080), (1080, 840), (840, 240), (600, 240),
                 (360, 240), (240, 120), (120, 120)]
actual = []
a, b = as_unordered(1920, 1080)
actual.append((a, b))
while a != b:
    a, b = as_unordered(*rule(a, b))
    actual.append((a, b))
example_subtractions = len(actual) - 1
example_ok = (actual == claimed_trace
              and example_subtractions == 6
              and actual[-1] == (120, 120)
              and int(gcd(Integer(1920), Integer(1080))) == 120
              and 1920 // 120 == 16 and 1080 // 120 == 9)


agrees = bool(identity_ok and divset_ok and big_ok and closure_ok and measure_ok
              and halt_ok and termination_ok and terminal_value_ok
              and exclusions_ok and example_ok)

computed = {
    "M1_identity_on_a_gt_b_gt_0": {
        "domain": "all a>b>0 with a<=%d (%d pairs)" % (N, N * (N - 1) // 2),
        "counterexamples": len(identity_fails), "holds": identity_ok},
    "M1_common_divisor_sets_identical": {
        "counterexamples": len(divset_fails), "holds": divset_ok},
    "M1_large_input_spot_checks": {"failures": len(big_fails), "holds": big_ok},
    "M2_closure_never_leaves_positive_integer_pairs": {
        "orbits_tested": N * N + len(adversarial),
        "violations": len(closure_violations), "holds": closure_ok},
    "M2_hypothesis_re_satisfiable_iff_entries_differ": {
        "violations": len(halt_condition_violations), "holds": halt_ok},
    "M3_sum_strictly_decreases_by_exactly_b_every_application": {
        "violations": len(measure_violations), "holds": measure_ok},
    "M3_sum_bounded_below_by_2": {
        "min_reachable_sum": min_reachable_sum, "bound_tight": bound_2_tight,
        "holds": measure_ok},
    "M3_terminates_and_terminal_g_equals_gcd": {
        "nonterminating_orbits": len(nonterminating),
        "wrong_terminal_orbits": len(wrong_terminal),
        "max_steps_seen": max_steps_seen[0], "at": max_steps_seen[1],
        "holds": termination_ok and terminal_value_ok},
    "M4_excluded_region_described_correctly": {
        "b_eq_0_pair_never_changes": b0_claim_ok,
        "negative_can_grow_unbounded": grow_claim_ok,
        "negative_can_halt_on_non_gcd": neg_claim_ok,
        "a_lt_b_rule_does_not_apply": alb_claim_ok, "holds": exclusions_ok},
    "M6_integrality_is_load_bearing_informational": {
        "irrational_ratio_sqrt2_over_1": status_irrational,
        "steps_before_giving_up": steps_irrational,
        "rational_ratio_6_over_5": status_rational,
        "restriction_does_real_work": integrality_load_bearing,
        "affects_agrees": False},
    "M5_published_trace_1920_1080": {
        "trace_matches_exactly": actual == claimed_trace,
        "subtractions": example_subtractions, "terminal": actual[-1][0],
        "ratio": "16:9", "holds": example_ok},
}

import sys

# Full per-assertion results go to stderr (kept, not discarded).
print(json.dumps({
    "claim_id": "euclid-one-line-loop",
    "detail": computed,
    "agrees": agrees,
}, sort_keys=True), file=sys.stderr)

# Canonical value for the orchestrator cross-check: gcd(1920, 1080) = 120,
# the number the story states. Computed here as the terminal value of the very
# loop under test (actual[-1] is the halting pair {g, g}); asserted equal to an
# independent SymPy gcd rather than hardcoded.
canonical = actual[-1][0]
assert canonical == int(gcd(Integer(1920), Integer(1080))) == 120

# The last stdout line is the single canonical JSON object, not pretty-printed.
print(json.dumps({
    "claim_id": "euclid-one-line-loop",
    "computed": str(canonical),
    "agrees": agrees,
}))
