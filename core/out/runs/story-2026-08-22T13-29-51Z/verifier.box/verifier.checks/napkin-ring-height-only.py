"""
Independent derivation of the napkin-ring volume from first principles.

Setup: sphere of radius R centered at origin; cylindrical hole of radius a
along the z-axis. The hole cuts off two spherical caps and leaves a band
of full height h between the two circles where cylinder meets sphere.

From Pythagoras: at height z = h/2 the cylinder wall lies on the sphere,
so a^2 + (h/2)^2 = R^2, i.e. a^2 = R^2 - (h/2)^2. This requires h <= 2R.

Napkin-ring cross-section at height z (|z| <= h/2) is the annulus with
outer radius^2 = R^2 - z^2 (sphere) and inner radius^2 = a^2 (cylinder).
Its area is pi * ((R^2 - z^2) - a^2) = pi * ((h/2)^2 - z^2).

Volume V(R, h) = integral over z in [-h/2, h/2] of the annulus area,
computed *without* substituting a^2 = R^2 - (h/2)^2 by hand -- let SymPy
carry R through and confirm it cancels.
"""

import json
import sympy as sp

R, h, z = sp.symbols('R h z', positive=True)

# cylinder radius squared, from the geometry (Pythagoras)
a2 = R**2 - (h/2)**2

# annulus area at height z: (outer disk) - (inner disk), both as functions of R
outer_area = sp.pi * (R**2 - z**2)
inner_area = sp.pi * a2
annulus = sp.expand(outer_area - inner_area)

# integrate along the band
V = sp.integrate(annulus, (z, -h/2, h/2))
V_simplified = sp.simplify(V)

expected = sp.pi * h**3 / sp.Integer(6)

# Does R actually appear in the final expression?
has_R = R in V_simplified.free_symbols

# Does V equal the claimed pi h^3 / 6 for all R?
difference = sp.simplify(V_simplified - expected)

# Extra safety: numerical spot checks over several R with h fixed,
# and several h with R fixed, all inside the valid range h <= 2R.
numeric_ok = True
samples = []
for R_val, h_val in [(1, 1), (2, 1), (5, 1), (10, 1), (3, 2), (3, 5), (3, 6)]:
    if h_val > 2 * R_val:
        continue  # outside valid range
    v_num = float(V_simplified.subs({R: R_val, h: h_val}))
    v_exp = float(expected.subs({h: h_val}))
    samples.append((R_val, h_val, v_num, v_exp))
    if abs(v_num - v_exp) > 1e-12:
        numeric_ok = False

agrees = (not has_R) and (difference == 0) and numeric_ok

print(json.dumps({
    "claim_id": "napkin-ring-height-only",
    "computed": str(V_simplified),
    "agrees": bool(agrees),
}))
