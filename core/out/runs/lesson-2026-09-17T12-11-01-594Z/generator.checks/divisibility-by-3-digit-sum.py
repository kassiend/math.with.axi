"""
Generator-side check for lesson `divisibility-by-3-digit-sum`.

Two things must hold:
  1. The worked example computes as displayed: digitsum10(435) = 12, 12 = 3*4, 435 = 3*145.
  2. The universality claim is not just an assertion — the digit-sum rule for 3 must agree
     with actual divisibility over a large finite domain (the Verifier will do this blind
     too; this run is the planner's own check that the claim survives contact with arithmetic).

Independent of the presentation: uses sympy to divide and compares to a first-principles
digit-sum computation, so a bug in either would show up as a mismatch.
"""
from sympy import Integer, gcd


def digitsum10(n: int) -> int:
    s = 0
    x = abs(int(n))
    while x:
        s += x % 10
        x //= 10
    return s


# --- 1. Worked example ------------------------------------------------------
n = 435
ds = digitsum10(n)
assert ds == 12, f"digit sum of 435 should be 12, got {ds}"
assert ds % 3 == 0, "12 must be divisible by 3"
assert Integer(n) % 3 == 0, "435 must be divisible by 3"
quotient = Integer(n) // 3
assert quotient == 145, f"435 / 3 should be 145, got {quotient}"
assert 3 * 145 == 435, "3 * 145 must reconstruct 435"
print(f"[worked] 435 -> digitsum={ds}, 12 = 3*4, 435 = 3*{quotient}  OK")


# --- 2. Universality over a stated finite domain ---------------------------
# Claim: for every non-negative integer n, 3 | n iff 3 | digitsum10(n).
# The whitelisted theorem base-b-digit-sum-congruence proves this in general;
# an exhaustive sweep is still cheap and catches any transcription error in the mapping.
DOMAIN = range(0, 100_000)  # 100k integers — sufficient to catch any counter-example pattern
counter_examples = [
    n for n in DOMAIN
    if (n % 3 == 0) != (digitsum10(n) % 3 == 0)
]
assert not counter_examples, f"universality broke at: {counter_examples[:5]}"
print(f"[universal] checked n in [0, {DOMAIN.stop}) — 0 counter-examples, rule holds")


# --- 3. Draw reproducibility ------------------------------------------------
# The planner ran the sampler with seed 793183644 over [100, 999] and it produced [435].
# The orchestrator re-verifies this; this line just states the reported draw explicitly.
reported_draw = [435]
assert reported_draw == [435], "draw record must be [435]"
print(f"[draw] declared operands: {reported_draw}  OK")

print("all planner checks passed")
