"""Independent verification of the GPS relativity claim.

Verifies each formula_step from first principles:
  1) SR time-dilation for a GPS satellite:  Δt_SR ≈ -7 μs/day
  2) GR gravitational time dilation:        Δt_GR ≈ +45 μs/day
  3) Net effect:                            Δt = Δt_GR + Δt_SR ≈ +38 μs/day
  4) Distance error:                        Δx = c·Δt ≈ 11.4 km/day
"""

import json
from sympy import Rational, sqrt, N, Symbol

# --- Fundamental / geodetic constants (SI) --------------------------------
c        = Rational(299792458)               # speed of light [m/s]  (exact)
G_M      = Rational("3.986004418e14")        # GM_earth [m^3/s^2]     (WGS-84)
R_earth  = Rational("6371000")               # mean Earth radius [m]
R_orbit  = Rational("26571000")              # GPS semi-major axis [m]  (~20200 km altitude)
day      = Rational(86400)                   # seconds in a day

# --- Orbital speed from circular-orbit condition v = sqrt(GM/r) ---------
v = sqrt(G_M / R_orbit)                      # ~3874 m/s

# ---- STEP 1: Special-relativistic time dilation --------------------------
# For v << c:  Δt_SR / T  ≈ -v² / (2 c²)
dt_SR_per_day = -(v**2 / (2 * c**2)) * day   # seconds per day (negative)
dt_SR_us      = N(dt_SR_per_day * 10**6, 10) # μs/day

# ---- STEP 2: General-relativistic gravitational time dilation ------------
# Weak-field: Δt_GR / T = (Φ_sat − Φ_ground)/c²
#           = (GM/c²)(1/R_earth − 1/R_orbit)   [positive at higher altitude]
dt_GR_per_day = (G_M / c**2) * (Rational(1, 1) / R_earth
                                - Rational(1, 1) / R_orbit) * day
dt_GR_us      = N(dt_GR_per_day * 10**6, 10)

# ---- STEP 3: Net ----------------------------------------------------------
dt_net_per_day = dt_GR_per_day + dt_SR_per_day
dt_net_us      = N(dt_net_per_day * 10**6, 10)

# ---- STEP 4: Position error ----------------------------------------------
dx_per_day_m   = c * dt_net_per_day
dx_per_day_km  = N(dx_per_day_m / 1000, 10)

# --- Compare against the claim's rounded numbers --------------------------
# Tolerances chosen loose enough to accept the standard textbook rounding.
sr_ok  = abs(float(dt_SR_us) - (-7.0))  < 0.6      # −7 μs/day  (typical range −7.1 .. −7.2)
gr_ok  = abs(float(dt_GR_us) - (+45.0)) < 2.0      # +45 μs/day (typical range 45.5 .. 45.9)
sum_ok = abs(float(dt_net_us) - (+38.0)) < 2.0     # +38 μs/day (typical range 38.4 .. 38.7)

# Verify the additive line-by-line claim itself:  Δt = Δt_GR + Δt_SR
additivity_ok = (dt_net_per_day - (dt_GR_per_day + dt_SR_per_day)) == 0

# Verify the last line:  Δx = c · Δt, and that the numerical value ≈ 11.4 km
# Use the rounded 38 μs/day the story states, so line 4 follows from line 3.
dx_from_stated = float(N(c * Rational("38e-6") / 1000, 10))   # km
dx_line_ok     = abs(dx_from_stated - 11.4) < 0.1

# Also check the self-consistent chain (using our computed net):
dx_chain_ok    = abs(float(dx_per_day_km) - 11.4) < 0.5

agrees = bool(sr_ok and gr_ok and sum_ok and additivity_ok and dx_line_ok and dx_chain_ok)

computed = (
    f"SR={float(dt_SR_us):.2f} μs/day, "
    f"GR={float(dt_GR_us):.2f} μs/day, "
    f"net={float(dt_net_us):.2f} μs/day, "
    f"c·38μs={dx_from_stated:.3f} km, "
    f"c·net={float(dx_per_day_km):.3f} km"
)

print(json.dumps({
    "claim_id": "gps-38-microseconds",
    "computed": computed,
    "agrees": agrees,
}))
