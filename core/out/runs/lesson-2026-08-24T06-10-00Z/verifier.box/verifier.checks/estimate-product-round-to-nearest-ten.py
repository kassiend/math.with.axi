import json

def round_ten(x):
    # round to nearest ten, half up
    q, r = divmod(x, 10)
    if r * 2 >= 10:
        q += 1
    return q * 10

# --- Worked example: 49 x 48, round each to nearest ten, multiply ---
a, b = 49, 48
ra, rb = round_ten(a), round_ten(b)
estimate = ra * rb
true_prod = a * b
print("worked: {}x{} -> {}x{} = {}, true = {}".format(a, b, ra, rb, estimate, true_prod))
assert ra == 50 and rb == 50, (ra, rb)
assert true_prod == 2352, true_prod
worked_ok = (estimate == 2500)

# --- Exhaustive bound check over a sensible positive range ---
LO, HI = 1, 200
both_up_holds = True
both_down_holds = True
for x in range(LO, HI + 1):
    for y in range(LO, HI + 1):
        rx, ry = round_ten(x), round_ten(y)
        est = rx * ry
        tp = x * y
        # both rounded strictly up
        if rx > x and ry > y:
            if not (est >= tp):
                both_up_holds = False
                print("BOTH-UP FAIL", x, y, est, tp)
        # both rounded strictly down
        if rx < x and ry < y:
            if not (est <= tp):
                both_down_holds = False
                print("BOTH-DOWN FAIL", x, y, est, tp)

print("both_up_holds =", both_up_holds, "both_down_holds =", both_down_holds)

# --- Caveat: opposite-direction rounding breaks the which-side guarantee ---
# find a witness where estimate < true (below) and one where estimate > true (above)
below_wit = None
above_wit = None
for x in range(LO, HI + 1):
    for y in range(LO, HI + 1):
        rx, ry = round_ten(x), round_ten(y)
        opposite = (rx > x and ry < y) or (rx < x and ry > y)
        if not opposite:
            continue
        est = rx * ry
        tp = x * y
        if est < tp and below_wit is None:
            below_wit = (x, y, est, tp)
        if est > tp and above_wit is None:
            above_wit = (x, y, est, tp)
    if below_wit and above_wit:
        break

print("opposite-rounding below witness (est<true):", below_wit)
print("opposite-rounding above witness (est>true):", above_wit)

# check the caveat's own quoted example 47x43
rx, ry = round_ten(47), round_ten(43)
print("47x43 ->", rx, "x", ry, "=", rx*ry, "true =", 47*43)
caveat_example_ok = (rx == 50 and ry == 40 and rx*ry == 2000 and 47*43 == 2021)

caveat_breaks = (below_wit is not None and above_wit is not None)

agrees = bool(
    worked_ok
    and both_up_holds
    and both_down_holds
    and caveat_breaks
    and caveat_example_ok
)

print(json.dumps({
    "claim_id": "estimate-product-round-to-nearest-ten",
    "computed": str(estimate),
    "agrees": agrees,
}))
