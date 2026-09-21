"""
Generator check — last two digits of 7^2024, i.e. 7^2024 mod 100.

Method: compute it directly by fast modular exponentiation (Python's built-in pow with a modulus),
which never forms the full number and makes no assumption about the period. Report the result as a
two-digit string to match the displayed answer.
"""
import json
import sys

task_id = "last-two-digits-7-pow-2024"

last_two = pow(7, 2024, 100)          # direct modular exponentiation
computed = f"{last_two:02d}"
agrees = computed == "01"

print(f"7^2024 mod 100 = {last_two}", file=sys.stderr)
print(json.dumps({"task_id": task_id, "computed": computed, "agrees": bool(agrees)}))
