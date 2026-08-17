"""Independent check, derived from the statement alone.

Statement: "30% off, then 20% off"  -- what single discount does the same?

Derivation from the claim only: a discount of p leaves a factor (1 - p) of the
price. Applying 30% off then 20% off leaves (1 - 30/100)(1 - 20/100). A single
discount d does the same iff (1 - d) equals that combined factor.

Everything is done in exact rationals (sympy.Rational), never floats, so the
"exact rather than rounded" question is answered honestly. We also solve for d
symbolically rather than assuming the product formula, and we sanity-check on a
concrete price and on order reversal.
"""

import json

import sympy as sp

TASK_ID = "single-discount-30-then-20"
STATED_ANSWER_PERCENT = sp.Rational(44)

p1 = sp.Rational(30, 100)
p2 = sp.Rational(20, 100)

# Solve (1 - d) = (1 - p1)(1 - p2) for d, symbolically.
d = sp.symbols("d", real=True)
combined_factor = sp.together((1 - p1) * (1 - p2))
solutions = sp.solve(sp.Eq(1 - d, combined_factor), d)

# Branch/sign discipline: the equation is linear in d, so exactly one root, and
# a legitimate single *discount* must lie in [0, 1].
assert len(solutions) == 1, f"expected a unique root, got {solutions}"
d_val = sp.nsimplify(solutions[0])
assert d_val.is_rational, f"root is not rational: {d_val}"
assert 0 <= d_val <= 1, f"root outside the valid discount range: {d_val}"

computed_percent = sp.Rational(d_val * 100)

# Independent confirmation 1: track an arbitrary symbolic price through both
# discounts and compare with one single discount of the computed size.
price = sp.symbols("P", positive=True)
sequential = price * (1 - p1) * (1 - p2)
single = price * (1 - computed_percent / 100)
assert sp.simplify(sequential - single) == 0

# Independent confirmation 2: order reversal must give the same single discount.
reversed_factor = (1 - p2) * (1 - p1)
assert sp.simplify(combined_factor - reversed_factor) == 0

# Independent confirmation 3: a concrete price, in exact arithmetic.
concrete = sp.Rational(100)
assert concrete * (1 - p1) * (1 - p2) == sp.Rational(56)

# Simplest form / exactness: the value must be an integer number of percent, so
# "44%" needs no fraction, no decimal tail and no rounding.
is_exact_integer_percent = computed_percent == sp.floor(computed_percent)
agrees = bool(computed_percent == STATED_ANSWER_PERCENT and is_exact_integer_percent)

computed_str = f"{sp.Integer(computed_percent)}%" if is_exact_integer_percent else f"{computed_percent}%"

print(json.dumps({"task_id": TASK_ID, "computed": computed_str, "agrees": agrees}))
