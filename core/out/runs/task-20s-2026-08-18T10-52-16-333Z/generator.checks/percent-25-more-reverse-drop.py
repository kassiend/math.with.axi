"""Check for task percent-25-more-reverse-drop.

Built from the statement, not from the solution path:
  statement   -> "b is 25% more than a"
  description -> "By what percent is a less than b?"

So b is defined directly from the given increase, and the asked quantity is
formed straight from its English definition: the amount by which a falls short
of b, expressed as a percentage OF b. The symbol a is never given a value, so
the answer must come out independent of it -- that independence is itself part
of what is being checked.
"""
import json

from sympy import Rational, simplify, symbols

TASK_ID = "percent-25-more-reverse-drop"
EXPECTED = "20%"

a = symbols("a", positive=True)

# "b is 25% more than a"
b = a * (1 + Rational(25, 100))

# "by what percent is a less than b" = (shortfall of a below b) / b, as a percent
drop = simplify((b - a) / b * Rational(100))

# The result must not depend on a; if it does, the puzzle is ill-posed.
assert a not in drop.free_symbols, f"answer depends on a: {drop}"
assert drop == Rational(20), f"unexpected value {drop}"

computed = f"{drop}%"
print(json.dumps({"task_id": TASK_ID, "computed": computed, "agrees": computed == EXPECTED}))
