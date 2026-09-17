"""
Generator check — divisibility-by-4-last-two-digits.

Confirms:
  1. The worked example: N = 3905, last two digits = 5, 5 % 4 = 1 (remainder), and
     3905 % 4 = 1, so both sides of the biconditional agree — 3905 is NOT divisible
     by 4 and the rule correctly says so.
  2. Universality: for every integer N in a stated finite domain,
     (N % 4 == 0)  iff  ((N % 100) % 4 == 0).
     Domain: N ∈ [-100000, 100000]. Also verified symbolically via 100 ≡ 0 (mod 4).
"""

from sympy import Integer, Mod, symbols, simplify

# ---------- 1. Worked example ----------
N = 3905
last_two = N % 100

print(f"[worked] N = {N}")
print(f"[worked] last two digits (N mod 100) = {last_two}")
print(f"[worked] N mod 4         = {N % 4}")
print(f"[worked] last_two mod 4  = {last_two % 4}")

rule_says_divisible = (last_two % 4 == 0)
truth_divisible = (N % 4 == 0)
assert rule_says_divisible == truth_divisible, "Rule disagrees with truth on worked example"
assert not truth_divisible, "3905 must NOT be divisible by 4 for the demonstrated payoff"
assert N % 4 == 1, "3905 mod 4 must equal 1 for the 'remainder 1' shown on the card"
print("[worked] OK — 3905 is NOT divisible by 4 (remainder 1); rule agrees.\n")

# ---------- 2. Exhaustive universality check ----------
lo, hi = -100000, 100000
counterexamples = []
for n in range(lo, hi + 1):
    if (n % 4 == 0) != ((n % 100) % 4 == 0):
        counterexamples.append(n)
        if len(counterexamples) >= 5:
            break

if counterexamples:
    print(f"[universal] FAIL — counterexamples: {counterexamples}")
    raise AssertionError("Rule is not universal")
print(f"[universal] OK — no counterexamples over N in [{lo}, {hi}] ({hi - lo + 1} integers)")

# ---------- 3. Symbolic justification ----------
# 100 ≡ 0 (mod 4)  ⇒  N ≡ (N mod 100) (mod 4)  for every integer N.
assert 100 % 4 == 0, "the whole derivation rests on 100 being divisible by 4"
k = symbols("k", integer=True)
r = symbols("r", integer=True)
# Any integer N can be written N = 100*k + r with r = N mod 100.
# Then N mod 4 = (100*k + r) mod 4 = (0 + r) mod 4 = r mod 4.
lhs = Mod(100 * k + r, 4)
rhs = Mod(r, 4)
assert simplify(lhs - rhs) == 0, "symbolic identity (100k + r) mod 4 == r mod 4 failed"
print("[symbolic] OK — (100k + r) mod 4 ≡ r mod 4 (identity holds for all integer k, r)")

# ---------- 4. Guardrail: the WRONGER 'just check last digit' rule is NOT universal ----------
wrong_counterexamples = []
for n in range(0, 200):
    if (n % 4 == 0) != ((n % 10) % 4 == 0):
        wrong_counterexamples.append(n)
        if len(wrong_counterexamples) >= 5:
            break
assert wrong_counterexamples, "the last-digit-only rule must fail somewhere"
print(f"[guardrail] OK — last-digit-only shortcut fails at {wrong_counterexamples[:5]} "
      f"(justifies why the taught rule uses TWO digits, not one)")

print("\nAll checks passed.")
