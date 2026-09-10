"""
Generator check — snail on a 10 m pole, +3 m by day, -2 m by night. Which day does it reach the top?

Method: simulate the process step by step, exactly as it happens. Climb, test for the top BEFORE
the night slip, then slip. The first day whose climb reaches the top is the answer. No formula.
"""
import json
import sys

POLE = 10
UP = 3
DOWN = 2

task_id = "snail-climb-slip-reach-top"

height = 0
day = 0
guard = 0
while guard < 10000:
    guard += 1
    day += 1
    height += UP                 # daytime climb
    if height >= POLE:           # reached the top during the day -> never slips
        break
    height -= DOWN               # nighttime slip

computed = str(day)
agrees = computed == "8"

print(f"reached {POLE} m on day {day}", file=sys.stderr)
print(json.dumps({"task_id": task_id, "computed": computed, "agrees": bool(agrees)}))
