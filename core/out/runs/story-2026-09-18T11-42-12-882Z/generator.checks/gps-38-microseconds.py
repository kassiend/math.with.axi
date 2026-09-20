"""Check the GPS relativistic drift claim.

Two independent sources give us:
  - Special-relativity contribution: about -7 μs/day (satellite clock runs slow because it moves).
    Ohio State's Pogge page: "should fall behind clocks on the ground by about 7 microseconds per day".
    Wikipedia error-analysis page: -7.2 μs/day.
  - General-relativity contribution: about +45 μs/day (satellite clock runs fast at higher potential).
    Ohio State: "should get ahead of ground-based clocks by 45 microseconds per day".
    Wikipedia: +45.8 μs/day.
  - Net: about +38 μs/day (Ohio State), or +38.6 μs/day (Wikipedia).
  - Position drift when the timing error is untreated: roughly 11.4 km/day (Wikipedia error page).

The mechanism claim is Δx = c · Δt. We compute c · (Δt_GR + Δt_SR) using the more precise
Wikipedia numbers and compare against the sourced 11.4 km/day figure with a half-kilometre
tolerance to absorb the rounding difference between the ~38 μs quoted round and the ~38.6 μs
figure.
"""
import json

STORY_ID = "gps-38-microseconds"

C_M_PER_S = 299_792_458.0            # exact by definition of the metre
DELTA_T_GR_S_PER_DAY = +45.8e-6      # general relativity, per Wikipedia error analysis
DELTA_T_SR_S_PER_DAY = -7.2e-6       # special relativity, per Wikipedia error analysis

delta_t_net = DELTA_T_GR_S_PER_DAY + DELTA_T_SR_S_PER_DAY     # +38.6 μs/day
delta_x_m = C_M_PER_S * delta_t_net                            # metres per day
delta_x_km = delta_x_m / 1000.0

SOURCED_KM_PER_DAY = 11.4                                      # Wikipedia error page
agrees = abs(delta_x_km - SOURCED_KM_PER_DAY) < 0.5

computed = (
    f"c*(GR+SR) = ({C_M_PER_S:.0f} m/s)*("
    f"{DELTA_T_GR_S_PER_DAY*1e6:+.1f}{DELTA_T_SR_S_PER_DAY*1e6:+.1f} us/day) = "
    f"{delta_x_km:.2f} km/day (source: 11.4 km/day)"
)

print(json.dumps({"claim_id": STORY_ID, "computed": computed, "agrees": bool(agrees)}))
