"""
Check for the Ramanujan / 1729 story.

Confirms the two identities the mechanism narration lands on the card, and
independently confirms that 1729 really is the SMALLEST positive integer with
two distinct representations as a sum of two positive integer cubes. The
smallest claim is the load-bearing one: the anecdote works only because no
smaller number does this, so it must be checked rather than trusted.

Final line, and only the final line, is the JSON report the orchestrator reads.
"""
import json

STORY_ID = "ramanujan-1729-taxicab"

# The two identities the mechanism displays, computed the long way.
sum_a = 1 ** 3 + 12 ** 3          # 1 + 1728
sum_b = 9 ** 3 + 10 ** 3          # 729 + 1000
target = 1729

# For every n < 1730, collect the set of unordered pairs {i, j} with i <= j
# and i^3 + j^3 == n (both positive). The smallest n whose set has size >= 2
# is Ta(2). If the anecdote is true, that n is 1729.
smallest = None
for n in range(1, target + 1):
    reps = set()
    i = 1
    while 2 * i ** 3 <= n:
        remainder = n - i ** 3
        # integer cube root by bracket-and-check (avoid floating drift)
        k = round(remainder ** (1 / 3))
        for candidate in (k - 1, k, k + 1):
            if candidate >= i and candidate ** 3 == remainder:
                reps.add((i, candidate))
        i += 1
    if len(reps) >= 2:
        smallest = n
        break

agrees = (sum_a == target) and (sum_b == target) and (smallest == target)

print(json.dumps({
    "claim_id": STORY_ID,
    "computed": f"1^3+12^3={sum_a}; 9^3+10^3={sum_b}; smallest_n_with_two_cube_reps={smallest}",
    "agrees": bool(agrees),
}))
