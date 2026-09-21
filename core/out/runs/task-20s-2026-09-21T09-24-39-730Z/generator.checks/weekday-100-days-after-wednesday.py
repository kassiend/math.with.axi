"""Independent check for weekday-100-days-after-wednesday.

Statement: Today is Wednesday. What day of the week will it be 100 days from today?
Computed from the statement's givens — start day 'Wednesday', shift = 100 days —
without replaying the generator's reasoning.
"""

import json
from datetime import date, timedelta

WEEKDAYS = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
]

START_DAY_NAME = "Wednesday"
SHIFT_DAYS = 100
EXPECTED = "Friday"

# Pick any calendar date whose weekday is Wednesday, then step forward 100 days.
# We use datetime rather than a hand-rolled mod-7 shift so this check is
# independent of the arithmetic the generator's rationale uses.
anchor = date(2026, 9, 23)  # a Wednesday
assert WEEKDAYS[anchor.weekday()] == START_DAY_NAME, "anchor sanity check"

future = anchor + timedelta(days=SHIFT_DAYS)
computed = WEEKDAYS[future.weekday()]

print(json.dumps({
    "task_id": "weekday-100-days-after-wednesday",
    "computed": computed,
    "agrees": computed == EXPECTED,
}))
