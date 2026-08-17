"""Independent check for task 'last-digit-3-pow-2026'.

Statement: Last digit of 3^2026.
Claimed answer: 9.

Approach: compute 3**2026 mod 10 directly via Python's built-in
arbitrary-precision arithmetic. No shortcuts, no cycle assumptions —
just the raw value.
"""

import json

STATED_ANSWER = "9"
TASK_ID = "last-digit-3-pow-2026"

computed_int = pow(3, 2026, 10)
computed = str(computed_int)

agrees = computed == STATED_ANSWER

print(json.dumps({"task_id": TASK_ID, "computed": computed, "agrees": agrees}))
