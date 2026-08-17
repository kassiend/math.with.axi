import json
from sympy import Rational, Abs, Min

# Time: 3:30
h = 3
m = 30

# Minute hand: 6 degrees per minute from 12
minute_angle = Rational(6) * m  # 180

# Hour hand: 30 degrees per hour + 0.5 degrees per minute
hour_angle = Rational(30) * h + Rational(1, 2) * m  # 90 + 15 = 105

# Absolute difference
diff = Abs(minute_angle - hour_angle)

# Smaller angle between the hands (the natural "angle between")
smaller = Min(diff, 360 - diff)

# Format as "N°"
computed_str = f"{smaller}°"
expected = "75°"

result = {
    "task_id": "clock-angle-3-30",
    "computed": computed_str,
    "agrees": computed_str == expected,
}
print(json.dumps(result))
