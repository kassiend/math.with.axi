"""
Napkin-ring theorem check.

Claim: When a right circular cylinder of radius r is drilled through the
centre of a sphere of radius R, and the remaining band ("napkin ring") has
height h (measured along the cylinder axis), the band's volume equals
pi * h**3 / 6 -- independent of R.

Proof by integration of horizontal annuli. At signed height z from the
sphere's centre (|z| <= h/2), the annulus between the sphere and the
cylinder has area pi * ((R**2 - z**2) - (R**2 - (h/2)**2))
                = pi * ((h/2)**2 - z**2).
The R terms cancel before integration -- the whole answer depends only on h.
"""
import json
import sympy as sp

R, z, h = sp.symbols("R z h", positive=True)

# radius^2 of the sphere cross-section at height z
sphere_r_sq = R**2 - z**2
# radius^2 of the cylinder (from Pythagoras: r^2 + (h/2)^2 = R^2)
cyl_r_sq = R**2 - (h / 2) ** 2

annulus_area = sp.pi * (sphere_r_sq - cyl_r_sq)
volume = sp.integrate(annulus_area, (z, -h / 2, h / 2))
volume_simplified = sp.simplify(volume)

expected = sp.pi * h**3 / 6
agrees = sp.simplify(volume_simplified - expected) == 0
# also confirm R does not appear in the result
r_free = R not in volume_simplified.free_symbols

print(json.dumps({
    "claim_id": "napkin-ring-height-only",
    "computed": str(volume_simplified),
    "agrees": bool(agrees and r_free),
}))
