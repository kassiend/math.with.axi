"""Independent check for task `log-6-sum-2-and-3`.

Statement (as rendered): log_6(2) + log_6(3) = ?
Compute the value from the statement itself (no shortcut), then compare to
the claimed answer.
"""

import json
from sympy import log, simplify, Rational

task_id = "log-6-sum-2-and-3"
claimed = "1"

# Build the expression directly from the statement.
expr = log(2, 6) + log(3, 6)
computed = simplify(expr)

# Also validate numerically as a sanity check independent of symbolic simplify.
num_ok = abs(float(expr) - 1.0) < 1e-12

agrees = (simplify(computed - Rational(claimed)) == 0) and num_ok

print(json.dumps({
    "task_id": task_id,
    "computed": str(computed),
    "agrees": bool(agrees),
}))
