"""Independent check for task 'percent-25-more-reverse-drop'.

Derived ONLY from the task statement/description:

    statement:   "b is 25% more than a"
    description: "By what percent is a less than b?"
    stated answer: 20%

Reading, fixed before any computation:
  * "b is 25% more than a"  ==>  b = a + (25/100)*a = (5/4)*a
  * "by what percent is a less than b" is a shortfall of a measured
    against the BASE b (the object of "less than"):
        p = (b - a) / b * 100
  * The answer must be exact and in simplest form, so we work in
    exact rationals (sympy.Rational), never floats.

We also probe the alternative base (a) and the degenerate/negative
branches, because those are where a percent-inversion task can be
ambiguous or ill-posed.
"""

import json
import sys

from sympy import Rational, S, Symbol, nsimplify, simplify, symbols, zoo, nan

TASK_ID = "percent-25-more-reverse-drop"
STATED = Rational(20)  # "20%"

# ---------------------------------------------------------------- symbolic
a_pos = Symbol("a", positive=True)
b_pos = a_pos * (1 + Rational(25, 100))  # b is 25% more than a

# primary reading: shortfall of a relative to base b
p_sym = simplify((b_pos - a_pos) / b_pos * 100)

# alternative (mis)reading: relative to base a -- recorded, not adopted
p_alt = simplify((b_pos - a_pos) / a_pos * 100)

# ------------------------------------------------------- exactness / form
# p_sym must be a rational number free of the symbol a (scale invariant).
is_number = p_sym.is_number
free_of_a = a_pos not in p_sym.free_symbols
is_rational = bool(p_sym.is_rational)
# "simplest form": as an exact Rational, 20 has denominator 1 and is integral.
as_rat = nsimplify(p_sym, rational=True)
simplest = (as_rat == Rational(as_rat.p, as_rat.q)) and as_rat.q == 1

# ----------------------------------------------------- numeric resampling
# scale invariance: any nonzero a must give the same percent.
numeric_vals = []
for a_val in [Rational(1), Rational(4), Rational(7, 3), Rational(1000),
              Rational(1, 7), Rational(-2), Rational(-9, 5)]:
    b_val = a_val * Rational(5, 4)
    numeric_vals.append(simplify((b_val - a_val) / b_val * 100))
numeric_consistent = all(v == p_sym for v in numeric_vals)

# --------------------------------------------------------- branch probing
# Sign / ordering branch: is a actually LESS than b, as the question asserts?
# a > 0 : b = 1.25a > a  -> a < b, question well-posed.
# a < 0 : b = 1.25a < a  -> a > b, "a less than b" is FALSE.
# a = 0 : b = 0, percent = 0/0 undefined.
ordering_holds_for_positive = bool((b_pos - a_pos).is_positive)
a_neg = Symbol("a", negative=True)
b_neg = a_neg * Rational(5, 4)
ordering_holds_for_negative = bool((b_neg - a_neg).is_positive)  # expect False

zero_case = simplify((S(0) * Rational(5, 4) - S(0)) / (S(0) * Rational(5, 4)) * 100)
zero_undefined = zero_case in (nan, zoo) or zero_case.has(zoo) or zero_case.has(nan)

agrees = bool(
    p_sym == STATED
    and is_number
    and free_of_a
    and is_rational
    and simplest
    and numeric_consistent
)

detail = {
    "b_in_terms_of_a": str(b_pos),
    "percent_base_b_primary": str(p_sym),
    "percent_base_a_alternative": str(p_alt),
    "exact_rational": is_rational,
    "scale_invariant": free_of_a and numeric_consistent,
    "simplest_form_integer": simplest,
    "a_less_than_b_when_a_positive": ordering_holds_for_positive,
    "a_less_than_b_when_a_negative": ordering_holds_for_negative,
    "a_zero_percent_undefined": bool(zero_undefined),
}
print(json.dumps(detail), file=sys.stderr)

print(json.dumps({
    "task_id": TASK_ID,
    "computed": f"{p_sym}%",
    "agrees": agrees,
}))
