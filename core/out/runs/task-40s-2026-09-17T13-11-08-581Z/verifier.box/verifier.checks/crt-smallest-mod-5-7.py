"""Independent check for CRT task: find smallest positive x with
   x ≡ 2 (mod 5) and x ≡ 3 (mod 7).
Derived from the statement alone.
"""
import json

STATED_ANSWER = "17"
TASK_ID = "crt-smallest-mod-5-7"


def smallest_positive():
    x = 1
    while True:
        if x % 5 == 2 and x % 7 == 3:
            return x
        x += 1


computed = smallest_positive()
agrees = str(computed) == STATED_ANSWER.strip()
print(json.dumps({"task_id": TASK_ID, "computed": str(computed), "agrees": agrees}))
