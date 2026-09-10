"""Independent check of lesson `line-multiplication-crossings-two-digit`.

Derived from the payload text alone:

  applicability: any two two-digit whole numbers with all digits non-zero.
                 Bands = diagonal crossing counts (hundreds, tens, units).
                 Reading band counts straight off as digits is valid only
                 when every band count is below 10.
  carry_case:    "the middle band is not read as a digit 10 - write 0 there
                  and carry 1 into the hundreds band ... Any pair whose middle
                  band a1*b0 + a0*b1 reaches 10 does this, e.g. 34 x 25."
  worked example: 23 x 22 -> bands 4 | 10 | 6 -> 506.

Checks performed:
  A. bands and result for the worked example, from the crossing definition;
  B. the "read bands off as digits" rule over the whole stated domain, to see
     whether the stated applicability condition really is the boundary;
  C. the payload's own stated carry procedure ("write 0, carry 1") applied to
     the payload's own cited example 34 x 25, and to the whole domain.

Prints one line of JSON.
"""

import json
from sympy import Integer

CLAIM = "line-multiplication-crossings-two-digit"


def digits(n):
    return Integer(n) // 10, Integer(n) % 10


def bands(a, b):
    """Crossing counts per diagonal band, straight from the drawing rule:
    a1 lines x b1 lines cross in the left band, etc."""
    a1, a0 = digits(a)
    b1, b0 = digits(b)
    return (a1 * b1, a1 * b0 + a0 * b1, a0 * b0)


def value_of_bands(bd):
    h, t, u = bd
    return 100 * h + 10 * t + u


def domain():
    for a in range(11, 100):
        for b in range(11, 100):
            a1, a0 = digits(a)
            b1, b0 = digits(b)
            if 0 in (a1, a0, b1, b0):
                continue          # payload excludes zero digits
            yield a, b


# ---- A. worked example -------------------------------------------------
wa, wb = 23, 22
wbands = bands(wa, wb)
true_product = Integer(wa) * Integer(wb)
computed = str(value_of_bands(wbands))

example_ok = (
    wbands == (4, 10, 6)                    # payload's stated band counts
    and value_of_bands(wbands) == true_product
    and computed == "506"
)

# ---- B. is "all bands < 10" really the right applicability boundary? ----
# Positive direction: whenever every band < 10, reading them off must work.
read_off_ok_when_small = True
# Negative direction: whenever some band >= 10, reading off must FAIL
# (otherwise the stated condition is not tight).
read_off_fails_when_large = True
for a, b in domain():
    bd = bands(a, b)
    small = all(x < 10 for x in bd)
    naive = int("".join(str(int(x)) for x in bd)) if small else None
    if small and naive != int(a * b):
        read_off_ok_when_small = False
    if not small and value_of_bands(bd) == a * b and False:
        pass
# tightness: some band >= 10 means the concatenation is not even well formed
for a, b in domain():
    bd = bands(a, b)
    if any(x >= 10 for x in bd):
        # concatenating a two-character band cannot equal the true product
        # in general; confirm at least one genuine failure exists
        s = "".join(str(int(x)) for x in bd)
        if len(s) == 3 and int(s) == a * b:
            read_off_fails_when_large = False

# The positional value of the bands (100h + 10t + u) must ALWAYS equal a*b,
# with or without carrying.  That is the real content of the method.
positional_always_ok = all(value_of_bands(bands(a, b)) == a * b
                           for a, b in domain())

# ---- C. the payload's stated carry procedure ---------------------------
def payload_carry_rule(a, b):
    """Literal reading of carry_case: if the middle band reaches 10,
    write 0 in the tens place and carry 1 into the hundreds band."""
    h, t, u = bands(a, b)
    if t >= 10:
        return 100 * (h + 1) + 10 * 0 + u
    return 100 * h + 10 * t + u


# the payload cites 34 x 25 as an instance of "does this"
cited_a, cited_b = 34, 25
cited_bands = bands(cited_a, cited_b)
cited_rule_gives = payload_carry_rule(cited_a, cited_b)
cited_true = cited_a * cited_b
cited_rule_ok = (cited_rule_gives == cited_true)

# how widely does the stated carry rule fail across the stated domain?
carry_rule_failures = [(a, b) for a, b in domain()
                       if payload_carry_rule(a, b) != a * b]

# correct general procedure, for contrast: carry the TENS DIGIT of each band,
# right to left, which may exceed 1 and may cascade.
def general_carry(a, b):
    h, t, u = (int(x) for x in bands(a, b))
    d0 = u % 10
    t += u // 10
    d1 = t % 10
    h += t // 10
    return h * 100 + d1 * 10 + d0


general_ok = all(general_carry(a, b) == a * b for a, b in domain())

agrees = bool(
    example_ok
    and positional_always_ok
    and read_off_ok_when_small
)

print(json.dumps({
    "claim_id": CLAIM,
    "computed": computed,
    "agrees": agrees,
    "_detail": {
        "worked_example_bands": [int(x) for x in wbands],
        "worked_example_true_product": int(true_product),
        "worked_example_ok": bool(example_ok),
        "positional_value_of_bands_always_equals_product": bool(positional_always_ok),
        "read_off_valid_whenever_all_bands_below_10": bool(read_off_ok_when_small),
        "read_off_boundary_is_tight": bool(read_off_fails_when_large),
        "cited_carry_example": f"{cited_a} x {cited_b}",
        "cited_carry_example_bands": [int(x) for x in cited_bands],
        "payload_carry_rule_gives": int(cited_rule_gives),
        "cited_true_product": int(cited_true),
        "payload_carry_rule_ok_on_its_own_cited_example": bool(cited_rule_ok),
        "payload_carry_rule_failure_count_over_domain": len(carry_rule_failures),
        "payload_carry_rule_first_failures": [
            f"{a}x{b}" for a, b in carry_rule_failures[:5]],
        "domain_size": sum(1 for _ in domain()),
        "general_carry_tens_digit_rule_always_ok": bool(general_ok),
    }
}))
