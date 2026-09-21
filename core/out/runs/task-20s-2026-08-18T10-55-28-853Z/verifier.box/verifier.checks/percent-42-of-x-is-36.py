"""Independent check for task percent-42-of-x-is-36.

Derived from the posted statement alone:
    given   42% of x = 36
    asked   what is 70% of x?
    claimed answer: 60

Everything is done in exact rationals (no floats) so that "exact rather than
rounded" can be decided, not assumed.  The equation is solved symbolically
rather than by rearranging by hand, and the solution set is checked to be a
singleton so that no branch is silently dropped.
"""

import json

from sympy import Rational, S, Symbol, solveset, nsimplify

TASK_ID = "percent-42-of-x-is-36"
CLAIMED = Rational(60)

x = Symbol("x", real=True)

# 42% of x = 36, with 42% as the exact rational 42/100.
equation = Rational(42, 100) * x - 36

# Solve over the reals and require a unique solution (sign / branch check).
solutions = solveset(equation, x, domain=S.Reals)
sols = sorted(solutions, key=lambda v: v)

agrees = False
computed = None
notes = {}

if len(sols) == 1:
    x_val = nsimplify(sols[0], rational=True)
    # 70% of x, exactly.
    asked = Rational(70, 100) * x_val

    notes["x"] = str(x_val)                       # expect 600/7, not an integer
    notes["x_is_integer"] = bool(asked.is_integer and x_val.is_integer)
    notes["asked_exact"] = str(asked)
    notes["asked_is_rational"] = bool(asked.is_rational)
    notes["asked_is_integer"] = bool(asked.is_integer)
    # simplest form: numerator/denominator of the fully reduced rational
    notes["numer"] = int(asked.p)
    notes["denom"] = int(asked.q)
    notes["sign_positive"] = bool(asked > 0)

    # Independent cross-route: 70% of x = (70/42) * (42% of x) = (5/3)*36.
    cross = Rational(70, 42) * 36
    notes["cross_route"] = str(cross)
    notes["routes_match"] = bool(cross == asked)

    # Verify the solution really satisfies the given datum.
    notes["datum_check"] = str(Rational(42, 100) * x_val)

    computed = str(asked)
    agrees = bool(
        asked == CLAIMED
        and cross == asked
        and Rational(42, 100) * x_val == 36
        and asked.q == 1                       # exact integer, nothing rounded
    )
else:
    computed = "non-unique solution set: " + str(sols)
    agrees = False

print(json.dumps({"task_id": TASK_ID, "computed": computed, "agrees": agrees}))
import sys
print(json.dumps(notes), file=sys.stderr)
