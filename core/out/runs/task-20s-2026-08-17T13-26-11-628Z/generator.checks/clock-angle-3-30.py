"""Independent verification for clock-angle-3-30.

Statement: angle between the clock hands at 3:30.
Compute directly from the time (3 hours, 30 minutes); do not hard-code the
answer.
"""

import json
from sympy import Rational, Abs

hours = 3
minutes = 30

# Minute hand: 360° per 60 min -> 6° per minute.
minute_angle = Rational(minutes) * 6

# Hour hand: 360° per 12 h -> 30° per hour, plus 0.5° per minute drift.
hour_angle = Rational(hours) * 30 + Rational(minutes) * Rational(1, 2)

raw_gap = Abs(minute_angle - hour_angle)
# The angle "between the hands" is the smaller of the two supplementary arcs.
gap = raw_gap if raw_gap <= 180 else 360 - raw_gap

computed = f"{gap}°"
expected = "75°"

print(json.dumps({
    "task_id": "clock-angle-3-30",
    "computed": computed,
    "agrees": computed == expected,
}))
