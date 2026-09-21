#!/usr/bin/env python
"""Independent verification of lesson `multiply-near-100-complement-base`.

Derived ONLY from the payload text. Claims tested:

C1  worked example: 97 x 92 = 8924, and the displayed cards
    (gaps 3,8 -> 97-8=89 -> 3*8=24 -> 8924) reproduce it in order.
C2  algebraic identity (100-a)(100-b) = 100*(100-a-b) + a*b for all integers.
C3  both cross-subtractions agree: x - b = y - a = 100 - a - b.
C4  the digit step (cross-subtraction, then gap product as a ZERO-PADDED
    two-digit block) is exception-free over all 81 ordered pairs of [91,99]^2,
    and the gap product there never exceeds 81.
C5  carry case: 88 x 89 -> gaps 12,11 -> 88-11=77, 12*11=132, naive glue
    77|132 = 77132, true answer 7832 = 7700 + 132.
    Also 90 x 91 (gaps 10,9, product 90) still glues correctly as 81|90 = 8190.
C6  "the digit step is correct exactly when a*b <= 99, with one degenerate
    escape - when the cross-subtraction comes out as 0".  Tested as a strict
    IFF, exhaustively, on the domain the payload leaves claimable (integers
    x,y <= 100; nulls disclaim factors above 100), and then probed just
    OUTSIDE that domain.
C7  the escape "50 x 50" -- is it really ONE pair, or a whole family?
C8  operand draw reproducibility from the declared seed.
"""

import json
import random
from sympy import symbols, expand, simplify, Integer

failures = []
notes = {}

# ---------------------------------------------------------------- C2 identity
a, b = symbols("a b", integer=True)
lhs = expand((100 - a) * (100 - b))
rhs = expand(100 * (100 - a - b) + a * b)
if simplify(lhs - rhs) != 0:
    failures.append("C2: identity does not expand")

# ------------------------------------------------------- helpers for digit step
def gaps(x, y):
    return 100 - x, 100 - y


def cross(x, y):
    """Left block; also checks the two cross-subtractions agree."""
    ga, gb = gaps(x, y)
    l1, l2 = x - gb, y - ga
    assert l1 == l2 == 100 - ga - gb
    return l1


def glue(L, R):
    """Render the digit step literally, the way a viewer reads the cards.

    Gap product is written as a two-digit block (zero padded when < 10);
    if it overflows two digits the blocks are simply written next to each
    other, exactly as the payload does for 88x89 -> 77|132 = 77132.
    Returns None when the rendering is not a well-formed digit string
    (negative left block or negative gap product).
    """
    if L < 0 or R < 0:
        return None
    return int(str(L) + (f"{R:02d}" if R <= 99 else str(R)))


def digit_step_ok(x, y):
    ga, gb = gaps(x, y)
    return glue(cross(x, y), ga * gb) == x * y


# --------------------------------------------------------- C1 worked example
x0, y0 = 97, 92
ga0, gb0 = gaps(x0, y0)                      # card s2
L0 = x0 - gb0                                # card s3
R0 = ga0 * gb0                               # card s4
card_result = glue(L0, R0)
true_result = Integer(x0) * Integer(y0)
worked = str(true_result)

if (ga0, gb0) != (3, 8):
    failures.append(f"C1: gaps are {(ga0, gb0)}, cards say (3, 8)")
if L0 != 89:
    failures.append(f"C1: cross-subtraction is {L0}, card says 89")
if R0 != 24:
    failures.append(f"C1: gap product is {R0}, card says 24")
if card_result != int(true_result) or worked != "8924":
    failures.append(f"C1: cards give {card_result}, true product {true_result}")
# C3 second cross-subtraction shown implicitly by cross()'s assert
if y0 - ga0 != L0:
    failures.append("C3: cross-subtractions disagree")

# ------------------------------------- C4 exhaustive over the stated domain
bad_in_range, max_gap_product = [], 0
for x in range(91, 100):
    for y in range(91, 100):
        ga, gb = gaps(x, y)
        max_gap_product = max(max_gap_product, ga * gb)
        if not digit_step_ok(x, y):
            bad_in_range.append((x, y))
if bad_in_range:
    failures.append(f"C4: digit step fails inside [91,99]^2 at {bad_in_range[:5]}")
if max_gap_product != 81:
    failures.append(f"C4: max gap product in range is {max_gap_product}, claimed 81")
# padding really is needed somewhere in range (99x98 -> 97|02)
if glue(cross(99, 98), 1 * 2) != 9702:
    failures.append("C4: 99x98 does not render as 9702 with the pad")
if int(str(cross(99, 98)) + str(1 * 2)) == 99 * 98:
    failures.append("C4: unpadded glue would also work, pad claim vacuous")

# ------------------------------------------------------------ C5 carry case
ga5, gb5 = gaps(88, 89)
if (ga5, gb5) != (12, 11) or cross(88, 89) != 77 or ga5 * gb5 != 132:
    failures.append("C5: carry-case arithmetic (12, 11, 77, 132) wrong")
if int(str(77) + str(132)) != 77132 or 88 * 89 != 7832 or 7700 + 132 != 7832:
    failures.append("C5: carry-case naive/true values wrong")
if digit_step_ok(88, 89):
    failures.append("C5: 88x89 does not actually break the digit step")
if not digit_step_ok(90, 91) or glue(cross(90, 91), 10 * 9) != 8190:
    failures.append("C5: 90x91 should still concatenate correctly as 8190")

# ------------------------- C6 the strict IFF, over the claimable domain
# nulls disclaim factors above 100; test integers 1..100 (both factors <= 100).
iff_violations = []
for x in range(1, 101):
    for y in range(1, 101):
        ga, gb = gaps(x, y)
        predicted = (ga * gb <= 99) or (cross(x, y) == 0)
        if digit_step_ok(x, y) != predicted:
            iff_violations.append((x, y, ga * gb, cross(x, y), digit_step_ok(x, y)))
if iff_violations:
    failures.append(f"C6: IFF fails on [1,100]^2 at {iff_violations[:5]}")
notes["C6_iff_holds_on_1_100"] = not iff_violations

# probe JUST OUTSIDE: one factor above 100 (mixed sign gap product),
# and non-positive factors.  Does "correct exactly when a*b <= 99" survive?
outside = []
for x in list(range(-10, 1)) + list(range(101, 111)):
    for y in range(-10, 121):
        ga, gb = gaps(x, y)
        predicted = (ga * gb <= 99) or (cross(x, y) == 0)
        if digit_step_ok(x, y) != predicted:
            outside.append((x, y, ga * gb, cross(x, y)))
notes["C6_outside_violations"] = len(outside)
notes["C6_outside_witnesses"] = outside[:6]

# ------------------------------------------------- C7 how many escapes?
escapes = [(x, y) for x in range(1, 101) for y in range(1, 101)
           if cross(x, y) == 0 and (100 - x) * (100 - y) > 99]
notes["C7_escape_pairs_with_overflow"] = len(escapes)
notes["C7_escape_examples"] = escapes[:5]

# ------------------------------------------------- C8 draw reproducibility
seed = 288838249
recipes = {}
r = random.Random(seed); recipes["randint x2"] = [r.randint(91, 99), r.randint(91, 99)]
r = random.Random(seed); recipes["choice x2"] = [r.choice(range(91, 100)), r.choice(range(91, 100))]
r = random.Random(seed); recipes["randrange x2"] = [r.randrange(91, 100), r.randrange(91, 100)]
r = random.Random(seed); recipes["sample 2"] = r.sample(range(91, 100), 2)
notes["C8_recipes"] = recipes
notes["C8_matches_declared_draw"] = [k for k, v in recipes.items() if v == [97, 92]]

agrees = not failures
print(json.dumps({
    "claim_id": "multiply-near-100-complement-base",
    "computed": worked,
    "agrees": agrees,
    "failures": failures,
    "notes": notes,
}, default=str))
