"""Check the Reuleaux triangle perimeter formula.

Claim: a Reuleaux triangle of width w is bounded by three circular arcs, each
of radius w and each subtending an angle of pi/3 at its centre.  Its total
perimeter is therefore

    P = 3 * (w * pi/3) = pi * w

which is the value Barbier's theorem predicts for every curve of constant
width w.  We derive it symbolically with SymPy and compare with the closed
form pi*w.
"""

import json

import sympy as sp

STORY_ID = "reuleaux-drill-square-holes"

# --- symbolic derivation -----------------------------------------------------
w = sp.symbols("w", positive=True)

# Each of the three arcs has radius w and subtends the angle pi/3
# (the interior angle of the equilateral triangle at the arc's centre).
radius = w
arc_angle = sp.pi / 3
arc_length = radius * arc_angle           # s = r * theta

perimeter_derived = sp.simplify(3 * arc_length)
perimeter_expected = sp.pi * w

agrees_perimeter = sp.simplify(perimeter_derived - perimeter_expected) == 0

# --- also verify the area formula (π − √3)/2 · w² for the intersection of
#     three disks of radius w centred at the vertices of an equilateral
#     triangle of side w.  A Reuleaux triangle = equilateral triangle + three
#     equal circular segments (arc - triangle) each of radius w, chord w.
tri_area = sp.sqrt(3) / 4 * w**2                                     # equilateral
segment_area = sp.Rational(1, 2) * w**2 * (sp.pi / 3 - sp.sin(sp.pi / 3))
area_derived = sp.simplify(tri_area + 3 * segment_area)
area_expected = sp.Rational(1, 2) * (sp.pi - sp.sqrt(3)) * w**2
agrees_area = sp.simplify(area_derived - area_expected) == 0

agrees = bool(agrees_perimeter and agrees_area)

computed = (
    f"perimeter = {sp.sstr(perimeter_derived)}; "
    f"area = {sp.sstr(area_derived)}"
)

print(json.dumps({"claim_id": STORY_ID, "computed": computed, "agrees": agrees}))
