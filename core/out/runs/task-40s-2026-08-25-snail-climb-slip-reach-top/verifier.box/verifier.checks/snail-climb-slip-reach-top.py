"""
Verifier check — snail on a 10 m pole, +3 m by day, -2 m by night. Written blind of the generator.

Different method: closed form instead of simulation. At the end of night k the height is
k*(UP-DOWN). The snail escapes on the first day d whose climb crosses the top:
    (d-1)*(UP-DOWN) + UP >= POLE  =>  d >= (POLE-UP)/(UP-DOWN) + 1.
So d = ceil((POLE-UP)/(UP-DOWN)) + 1. The result is then re-checked against the height it implies.
"""
import json
import math
import sys

POLE = 10
UP = 3
DOWN = 2
NET = UP - DOWN

TASK = "snail-climb-slip-reach-top"

assert NET > 0 and UP < POLE, "closed form assumes steady net progress and no day-one escape"

d = math.ceil((POLE - UP) / NET) + 1

# Re-check from the definition: on day d the climb must reach the top, and on day d-1 it must not.
height_before_day = lambda k: (k - 1) * NET          # height at the start of day k (after night k-1)
assert height_before_day(d) + UP >= POLE, "day d does not actually reach the top"
assert height_before_day(d - 1) + UP < POLE, "the snail would have escaped earlier"

computed = str(d)
agrees = computed == "8"

print(f"closed form: day {d}", file=sys.stderr)
print(json.dumps({"task_id": TASK, "computed": computed, "agrees": bool(agrees)}))
