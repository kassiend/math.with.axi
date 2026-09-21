"""Independent verification of lesson 'rule-of-72-doubling-time'.

Written from the payload's CLAIMS only, before reading any generator script.

Claims under test (as stated in the payload):
  C1  worked example: r = 8 -> 72/8 = 9, true t = ln2/ln(1.08) = 9.00647, err -0.07%
  C2  display check 1.08^9 = 1.999(005)
  C3  bound: for r in [4,12], |72/r - t|/t <= 2%, exhaustive on grid 4.0,4.1,...,12.0
  C4  signed error is MONOTONE (over-estimate -> under-estimate) as r rises on that grid
  C5  endpoint values: r=4 -> 18.000 vs 17.673 (+1.85%); r=12 -> 6.000 vs 6.1163 (-1.90%)
  C6  those two endpoints are the EXTREMES of the signed error on the grid
  C7  sign change near r = 7.85
  C8  r = 8 is "the sharpest point in the range"
  C9  carry case r=50: 72/50=1.44, true 1.7095, -15.77%
  C10 carry drift: 20 -> -5.31%, 30 -> -9.16%, 40 -> -12.62%, 100 -> -28% (true t = 1 exactly)
  C11 100*ln2 = 69.3147 ; continuous-compounding error is FLAT at every rate
  C12 null field asserts that flat continuous error equals +3.88%
  C13 72 divides exactly by 2,3,4,6,8,9,12
  C14 boundary probe: does the 2% band survive just OUTSIDE [4,12]? (payload claims nothing
      here, but a lesson whose interval is real should show the band failing outside it)

Prints exactly one line of JSON on stdout; diagnostics go to stderr.
"""

import json
import sys

from mpmath import mp, mpf, log, power

mp.dps = 30

LN2 = log(2)


def true_doubling(r):
    """Exact t solving (1 + r/100)^t = 2, per the payload's own definition."""
    return LN2 / log(1 + mpf(r) / 100)


def rule(r):
    return mpf(72) / mpf(r)


def signed_err_pct(r):
    """(estimate - truth)/truth, in percent. Signed: + means over-estimate."""
    t = true_doubling(r)
    return (rule(r) - t) / t * 100


def close(a, b, tol):
    return abs(mpf(a) - mpf(b)) <= mpf(tol)


results = {}
log_lines = []


def note(s):
    log_lines.append(s)


# ---------------------------------------------------------------- C1: worked example
est8 = rule(8)
true8 = true_doubling(8)
err8 = signed_err_pct(8)
results["C1_estimate_is_9"] = est8 == 9
results["C1_true_9.00647"] = close(true8, "9.00647", "0.000005")
results["C1_err_-0.07pct"] = close(err8, "-0.07", "0.005")
note(f"C1 72/8            = {est8}")
note(f"C1 true t          = {mp.nstr(true8, 12)}")
note(f"C1 signed err      = {mp.nstr(err8, 6)} %")

# ---------------------------------------------------------------- C2: 1.08^9
check = power(mpf("1.08"), 9)
results["C2_1.08^9_is_1.999005"] = close(check, "1.999005", "0.0000005")
note(f"C2 1.08^9          = {mp.nstr(check, 12)}")

# ---------------------------------------------------------------- C3/C4/C6: the grid
grid = [mpf(40 + i) / 10 for i in range(0, 81)]  # 4.0 .. 12.0 step 0.1, exact in decimal
errs = [(r, signed_err_pct(r)) for r in grid]

worst = max(errs, key=lambda p: abs(p[1]))
results["C3_band_2pct_holds_on_grid"] = all(abs(e) <= 2 for _, e in errs)
note(f"C3 max |err| on grid = {mp.nstr(worst[1], 6)} % at r = {worst[0]}")

# C4 monotone decreasing (over -> under)
mono = all(errs[i][1] > errs[i + 1][1] for i in range(len(errs) - 1))
results["C4_signed_err_monotone_decreasing"] = mono
note(f"C4 monotone decreasing across grid: {mono}")

# C6 endpoints are the extremes
results["C6_max_at_r4"] = errs[0][1] == max(e for _, e in errs)
results["C6_min_at_r12"] = errs[-1][1] == min(e for _, e in errs)

# ---------------------------------------------------------------- C5: endpoint numbers
results["C5_r4_est_18"] = rule(4) == 18
results["C5_r4_true_17.673"] = close(true_doubling(4), "17.673", "0.0005")
results["C5_r4_err_+1.85"] = close(signed_err_pct(4), "1.85", "0.005")
results["C5_r12_est_6"] = rule(12) == 6
results["C5_r12_true_6.1163"] = close(true_doubling(12), "6.1163", "0.00005")
results["C5_r12_err_-1.90"] = close(signed_err_pct(12), "-1.90", "0.005")
note(f"C5 r=4  true {mp.nstr(true_doubling(4), 8)}  err {mp.nstr(signed_err_pct(4), 6)} %")
note(f"C5 r=12 true {mp.nstr(true_doubling(12), 8)} err {mp.nstr(signed_err_pct(12), 6)} %")

# ---------------------------------------------------------------- C7: zero crossing
lo, hi = mpf(4), mpf(12)
for _ in range(200):
    mid = (lo + hi) / 2
    if signed_err_pct(mid) > 0:
        lo = mid
    else:
        hi = mid
crossing = (lo + hi) / 2
results["C7_crossing_near_7.85"] = close(crossing, "7.85", "0.005")
note(f"C7 sign change at r = {mp.nstr(crossing, 10)}")

# ---------------------------------------------------------------- C8: is r=8 "sharpest"?
sharpest = min(errs, key=lambda p: abs(p[1]))
results["C8_r8_is_sharpest_on_grid"] = sharpest[0] == 8
note(f"C8 smallest |err| on grid is {mp.nstr(sharpest[1], 6)} % at r = {sharpest[0]}"
     f"  (r=8 gives {mp.nstr(err8, 6)} %)")

# ---------------------------------------------------------------- C9/C10: carry case
results["C9_r50_est_1.44"] = rule(50) == mpf("1.44")
results["C9_r50_true_1.7095"] = close(true_doubling(50), "1.7095", "0.00005")
results["C9_r50_err_-15.77"] = close(signed_err_pct(50), "-15.77", "0.005")
results["C9_r50_breaks_2pct_band"] = abs(signed_err_pct(50)) > 2
note(f"C9 r=50 true {mp.nstr(true_doubling(50), 8)} err {mp.nstr(signed_err_pct(50), 6)} %")

for r, claimed in [(20, "-5.31"), (30, "-9.16"), (40, "-12.62")]:
    results[f"C10_r{r}_err_{claimed}"] = close(signed_err_pct(r), claimed, "0.005")
    note(f"C10 r={r} err {mp.nstr(signed_err_pct(r), 6)} % (claimed {claimed})")

results["C10_r100_true_is_exactly_1"] = true_doubling(100) == 1
results["C10_r100_est_0.72"] = rule(100) == mpf("0.72")
results["C10_r100_err_-28"] = close(signed_err_pct(100), "-28", "0.5")
note(f"C10 r=100 true {mp.nstr(true_doubling(100), 8)} err {mp.nstr(signed_err_pct(100), 6)} %")

# C10 "drift grows without bound as r rises" -> spot-check unboundedness
big = [signed_err_pct(r) for r in (200, 1000, 10000)]
results["C10_drift_unbounded"] = all(big[i] > big[i + 1] for i in range(len(big) - 1))
note(f"C10 err at r=200/1000/10000: {[mp.nstr(x, 6) for x in big]}")

# ---------------------------------------------------------------- C11/C12: continuous
results["C11_100ln2_is_69.3147"] = close(100 * LN2, "69.3147", "0.00005")
cont_err = (mpf(72) - 100 * LN2) / (100 * LN2) * 100  # flat, independent of r
# confirm flatness directly at several rates: t_cont = 100*ln2/r
flat = set()
for r in (1, 4, 8, 12, 50, 100):
    t_c = 100 * LN2 / mpf(r)
    flat.add(mp.nstr((rule(r) - t_c) / t_c * 100, 15))
results["C11_continuous_error_is_flat"] = len(flat) == 1
results["C12_continuous_error_is_+3.88"] = close(cont_err, "3.88", "0.005")
note(f"C11 100*ln2        = {mp.nstr(100 * LN2, 10)}")
note(f"C12 continuous err = {mp.nstr(cont_err, 8)} %  (payload says +3.88%)")

# ---------------------------------------------------------------- C13: divisors of 72
results["C13_72_divisors"] = all(72 % d == 0 for d in (2, 3, 4, 6, 8, 9, 12))

# ---------------------------------------------------------------- C14: boundary probe
# Just inside / just outside the stated closed interval [4, 12].
probe = {}
for r in ("3.5", "3.9", "3.99", "4.0", "12.0", "12.01", "12.1", "12.5", "13"):
    probe[r] = signed_err_pct(mpf(r))
    note(f"C14 r={r:>6}  err {mp.nstr(probe[r], 6)} %  band_ok={abs(probe[r]) <= 2}")

# Does the band actually FAIL just outside? Locate where |err| first exceeds 2%.
def first_break(start, step, limit):
    r, step, limit = mpf(start), mpf(step), mpf(limit)
    while (step > 0 and r <= limit) or (step < 0 and r >= limit):
        if abs(signed_err_pct(r)) > 2:
            return r
        r += step
    return None

break_above = first_break("12.0", "0.01", "40")
break_below = first_break("4.0", "-0.01", "0.01")
note(f"C14 2% band first breaks ABOVE 12 at r ~ {break_above}")
note(f"C14 2% band first breaks BELOW  4 at r ~ {break_below}")

# The interval [4,12] is only a *tight* choice if the band fails reasonably near
# both ends. Record how far the true safe interval extends.
results["C14_band_fails_outside_interval_above"] = break_above is not None
results["C14_band_fails_outside_interval_below"] = break_below is not None

# ---------------------------------------------------------------- tightness of "2%"
# Payload: "the 2% band is tight and cannot be narrowed".
max_abs = max(abs(e) for _, e in errs)
results["C_tightness_2pct_attained"] = close(max_abs, "2", "0.005")
note(f"TIGHT max |err| over [4,12] grid = {mp.nstr(max_abs, 8)} % "
     f"-> a {mp.nstr(max_abs, 4)}% band would also hold")


# ------------------------------------------------- C15: continuum vs finite grid
# The payload CLAIMS the bound "across that whole interval" but says it VERIFIED it
# on the 81-point grid 4.0,4.1,...,12.0. A finite grid does not establish a claim
# about a continuum. Strengthen it independently: fine grid + monotone derivative.
fine = [mpf(4) + mpf(i) / 1000 for i in range(0, 8001)]
fine_err = [signed_err_pct(r) for r in fine]
results["C15_band_holds_on_fine_grid"] = all(abs(e) <= 2 for e in fine_err)
results["C15_monotone_on_fine_grid"] = all(
    fine_err[i] > fine_err[i + 1] for i in range(len(fine_err) - 1))
note(f"C15 max |err| on 8001-pt grid = "
     f"{mp.nstr(max(abs(e) for e in fine_err), 8)} %")

# Rigorous route: e(r) = (72/r)*ln(1+r/100)/ln2 - 1. If e'(r) < 0 throughout [4,12]
# then the extremes ARE the endpoints and the continuum bound follows.
import sympy as sp
rs = sp.Symbol("rs", positive=True)
e_sym = (72 / rs) * sp.log(1 + rs / 100) / sp.log(2) - 1
de = sp.simplify(sp.diff(e_sym, rs))
de_f = sp.lambdify(rs, de, "mpmath")
deriv_neg = all(de_f(mpf(4) + mpf(i) / 200) < 0 for i in range(0, 1601))
results["C15_derivative_negative_throughout"] = deriv_neg
note(f"C15 e'(r) < 0 at all 1601 sampled r in [4,12]: {deriv_neg}"
     f"  -> extremes are the endpoints, continuum bound follows")

# ------------------------------------------------- C16: is the drift really UNBOUNDED?
# Payload: "a drift that grows without bound as r rises".
# Measured the payload's own way (signed relative error, percent) it is bounded below
# by -100%, since estimate > 0 and truth > 0.
tail = [signed_err_pct(r) for r in (10**3, 10**5, 10**7, 10**9)]
results["C16_relative_error_bounded_by_100pct"] = all(x > -100 for x in tail)
results["C16_relative_error_converges_to_-100"] = tail[-1] < -99
note(f"C16 signed rel err at r=1e3,1e5,1e7,1e9: {[mp.nstr(x, 6) for x in tail]}"
     f"  -> asymptote -100%, NOT unbounded in this metric")
# Charitable reading: the RATIO truth/estimate is unbounded.
ratio = [true_doubling(r) / rule(r) for r in (10**3, 10**5, 10**7, 10**9)]
results["C16_ratio_metric_is_unbounded"] = all(
    ratio[i] < ratio[i + 1] for i in range(len(ratio) - 1)) and ratio[-1] > 10
note(f"C16 ratio truth/estimate: {[mp.nstr(x, 6) for x in ratio]}  -> unbounded")

# ------------------------------------------------- C17: was r=8 a lucky draw?
ints = [(k, signed_err_pct(k)) for k in range(4, 13)]
ranked = sorted(ints, key=lambda p: abs(p[1]))
rank_of_8 = [k for k, _ in ranked].index(8) + 1
results["C17_r8_is_most_flattering_integer"] = rank_of_8 == 1
note("C17 integer rates in [4,12] ranked by |err|: "
     + ", ".join(f"{k}:{mp.nstr(abs(v), 4)}%" for k, v in ranked))
note(f"C17 rank of the drawn r=8 among 9 candidate integers: {rank_of_8} (1 = most flattering)")

# ---------------------------------------------------------------- verdict
failed = sorted(k for k, v in results.items() if not v)
for line in log_lines:
    print(line, file=sys.stderr)
print("FAILED CHECKS: " + (", ".join(failed) if failed else "(none)"), file=sys.stderr)

# 'agrees' governs the lesson as a whole: every stated claim must hold.
print(json.dumps({
    "claim_id": "rule-of-72-doubling-time",
    "computed": str(int(est8)) if est8 == int(est8) else mp.nstr(est8, 10),
    "agrees": not failed,
}))
