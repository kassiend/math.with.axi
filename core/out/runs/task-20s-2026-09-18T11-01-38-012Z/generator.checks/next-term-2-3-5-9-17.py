"""Independent check for the sequence 2, 3, 5, 9, 17, ?

Verify from the statement (the given terms), not by replaying the intended
reasoning. Two independent structural rules should agree on the next term:

  1. First differences double: 1, 2, 4, 8, 16, so next term = 17 + 16.
  2. Recurrence a_{n+1} = 2*a_n - 1, checked against every given pair.

If either rule fits all five given transitions and both give the same next
term, we report that term.
"""

import json

terms = [2, 3, 5, 9, 17]

# Rule 1: check that first differences form a geometric sequence with ratio 2
diffs = [terms[i + 1] - terms[i] for i in range(len(terms) - 1)]
ratios = [diffs[i + 1] / diffs[i] for i in range(len(diffs) - 1)]
rule1_ok = all(r == 2 for r in ratios) and diffs[0] == 1
rule1_next = terms[-1] + diffs[-1] * 2

# Rule 2: verify a_{n+1} = 2*a_n - 1 holds for every given pair
rule2_ok = all(terms[i + 1] == 2 * terms[i] - 1 for i in range(len(terms) - 1))
rule2_next = 2 * terms[-1] - 1

assert rule1_ok, f"doubling-differences rule fails: diffs={diffs}"
assert rule2_ok, "recurrence a_{n+1} = 2 a_n - 1 fails on given terms"
assert rule1_next == rule2_next, (
    f"rules disagree: {rule1_next} vs {rule2_next}"
)

computed = rule1_next
print(json.dumps({
    "task_id": "next-term-2-3-5-9-17",
    "computed": str(computed),
    "agrees": computed == 33,
}))
