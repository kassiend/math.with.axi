import json
import sympy as sp

# Independent verification of the claim:
#   The perimeter of a Reuleaux triangle of width w is P = pi * w.
#
# Construction from the mechanism text: a Reuleaux triangle is the
# intersection of three disks of radius w centred at the vertices of an
# equilateral triangle of side w. Its boundary is three circular arcs.
# Each arc is centred at one vertex of the triangle and runs between
# the other two vertices, i.e. it subtends the interior angle at that
# vertex.

w = sp.symbols('w', positive=True)

# --- Step 1: width = w (definitional; nothing to derive) ---
step1_width = w

# --- Step 2: arc length = w * (pi/3) ------------------------------------
# Independently compute the interior angle of an equilateral triangle
# with side w by placing its vertices and taking the angle between two
# side-vectors, rather than assuming pi/3.
A = sp.Matrix([0, 0])
B = sp.Matrix([w, 0])
C = sp.Matrix([w/2, w*sp.sqrt(3)/2])
# Check the three sides are equal (equilateral of side w).
side_AB = sp.simplify((B - A).norm())
side_BC = sp.simplify((C - B).norm())
side_CA = sp.simplify((A - C).norm())
assert sp.simplify(side_AB - w) == 0
assert sp.simplify(side_BC - w) == 0
assert sp.simplify(side_CA - w) == 0

# Interior angle at vertex A between vectors AB and AC.
v1 = B - A
v2 = C - A
cos_theta = sp.simplify((v1.dot(v2)) / (v1.norm() * v2.norm()))
theta = sp.acos(cos_theta)
theta_simplified = sp.simplify(theta)  # expected: pi/3

# Arc centred at A between B and C has radius |AB| = |AC| = w and
# subtends the angle theta at A. Independently verify this radius.
rad_from_B = sp.simplify((B - A).norm())
rad_from_C = sp.simplify((C - A).norm())
assert sp.simplify(rad_from_B - w) == 0
assert sp.simplify(rad_from_C - w) == 0

# By the definition of radian measure, arc length = radius * angle.
arc_length_symbolic = w * theta_simplified
arc_length_expected_step2 = w * sp.pi / 3
step2_ok = sp.simplify(arc_length_symbolic - arc_length_expected_step2) == 0

# Cross-check by direct integration of the arc parametrisation.
# Arc from B to C along the circle of radius w centred at A. The angle
# of B measured from A is 0; the angle of C measured from A is pi/3
# (which we will confirm, not assume, via arctan2).
angle_B = sp.atan2((B - A)[1], (B - A)[0])       # expected 0
angle_C = sp.atan2((C - A)[1], (C - A)[0])       # expected pi/3
assert sp.simplify(angle_B) == 0
assert sp.simplify(angle_C - sp.pi/3) == 0

t = sp.symbols('t', real=True)
x = A[0] + w * sp.cos(t)
y = A[1] + w * sp.sin(t)
ds = sp.sqrt(sp.diff(x, t)**2 + sp.diff(y, t)**2)
arc_length_integral = sp.integrate(ds, (t, angle_B, angle_C))
arc_length_integral = sp.simplify(arc_length_integral)
step2_integral_ok = sp.simplify(arc_length_integral - arc_length_expected_step2) == 0

# --- Step 3: total perimeter = 3 * (w * pi/3) ---------------------------
# By symmetry each of the three arcs has the same length. Compute all
# three explicitly rather than invoking symmetry.
def arc_len(center, p_start, p_end):
    r1 = sp.simplify((p_start - center).norm())
    r2 = sp.simplify((p_end - center).norm())
    assert sp.simplify(r1 - r2) == 0, "arc endpoints not equidistant from center"
    r = r1
    a_start = sp.atan2((p_start - center)[1], (p_start - center)[0])
    a_end = sp.atan2((p_end - center)[1], (p_end - center)[0])
    delta = sp.simplify(a_end - a_start)
    # take the positive minor-arc measure
    delta = sp.Abs(delta)
    return sp.simplify(r * delta)

arc_A = arc_len(A, B, C)  # arc opposite vertex A? No: centred at A, between B and C
arc_B = arc_len(B, C, A)
arc_C = arc_len(C, A, B)
total = sp.simplify(arc_A + arc_B + arc_C)

step3_expected = 3 * (w * sp.pi / 3)
step3_ok = sp.simplify(total - step3_expected) == 0

# --- Step 4: P = pi * w -------------------------------------------------
P_expected = sp.pi * w
step4_ok = sp.simplify(step3_expected - P_expected) == 0
final_ok = sp.simplify(total - P_expected) == 0

# Sanity cross-check with Barbier's theorem numeric consistency:
# a circle of diameter w has circumference pi*w, matching the formula.
circle_circumference = sp.pi * w
barbier_consistency = sp.simplify(circle_circumference - P_expected) == 0

all_ok = bool(step2_ok and step2_integral_ok and step3_ok and step4_ok
              and final_ok and barbier_consistency)

print(json.dumps({
    "claim_id": "reuleaux-drill-square-holes",
    "computed": str(sp.simplify(total)),
    "agrees": all_ok
}))
