"""Check for task single-discount-30-then-20.

Statement: a price is reduced by 30%, then the new price is reduced by 20%.
Question:  what single discount has the same effect?

Computed from the statement itself: apply the two reductions to a symbolic
price P, then solve P*(1 - d) = final for the single discount rate d. The
price must cancel; if it does not, the question would be ill-posed and the
solve would not return a price-free rate.
"""
import json

import sympy as sp

P, d = sp.symbols("P d", positive=True)

after_first = P * (1 - sp.Rational(30, 100))
after_second = after_first * (1 - sp.Rational(20, 100))

solutions = sp.solve(sp.Eq(P * (1 - d), after_second), d)
assert len(solutions) == 1, solutions

rate = sp.simplify(solutions[0])
assert P not in rate.free_symbols, "single discount must not depend on the price"

percent = sp.nsimplify(rate * 100)
computed = f"{percent}%" if percent.is_Integer else f"{sp.nsimplify(percent)}%"

print(json.dumps({
    "task_id": "single-discount-30-then-20",
    "computed": computed,
    "agrees": computed == "44%",
}))
