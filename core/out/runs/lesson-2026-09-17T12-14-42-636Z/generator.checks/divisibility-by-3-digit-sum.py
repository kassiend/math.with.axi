"""
Generator self-check for lesson `divisibility-by-3-digit-sum`.

Confirms two things independently of the plan's own arithmetic:

  1. The worked example: 7351 has digit sum 16, is not divisible by 3, and
     specifically leaves quotient 2450 remainder 1.
  2. The universality claim: for every non-negative integer n in a stated
     finite exhaustive domain, `3 | n  iff  3 | digit_sum(n)`. This is an
     exhaustive SymPy check over a declared finite range, as required by the
     lesson brief §3.2 for a `carry_case: null` claim.

The infinite-domain guarantee is carried by the whitelisted theorem
`base-b-digit-sum-congruence` cited in plan.out.json; this script provides the
finite-domain empirical corroboration that §3.2 also asks for.
"""

from sympy import Integer, Rational, symbols


def digit_sum(n: int) -> int:
    """Sum of decimal digits of a non-negative integer, via sympy Integer."""
    s = 0
    x = Integer(n)
    while x > 0:
        s += int(x % 10)
        x //= 10
    return s


def check_worked_example() -> None:
    n = 7351
    ds = digit_sum(n)
    assert ds == 16, f"digit sum of {n} expected 16, got {ds}"

    # Full quotient / remainder via sympy exact integer division.
    q, r = divmod(Integer(n), Integer(3))
    assert int(q) == 2450, f"quotient expected 2450, got {q}"
    assert int(r) == 1, f"remainder expected 1, got {r}"

    # The rule: 3 divides n iff 3 divides its digit sum.
    n_mod_3 = int(Integer(n) % 3)
    ds_mod_3 = int(Integer(ds) % 3)
    assert n_mod_3 == ds_mod_3, (
        f"congruence broken: {n} mod 3 = {n_mod_3}, "
        f"digit_sum mod 3 = {ds_mod_3}"
    )
    assert n_mod_3 != 0, "worked example is supposed to be NOT divisible by 3"
    print(f"worked_example ok: n={n} digit_sum={ds} "
          f"n mod 3 = digit_sum mod 3 = {n_mod_3}  "
          f"→ 7351 = 3*2450 + 1, not divisible by 3")


def check_universality_finite(upper: int = 100000) -> None:
    """Exhaustive check that `3 | n iff 3 | digit_sum(n)` for 0 <= n < upper."""
    bad = []
    for n in range(0, upper):
        if (n % 3 == 0) != (digit_sum(n) % 3 == 0):
            bad.append(n)
            if len(bad) >= 5:
                break
    assert not bad, f"rule failed on: {bad[:5]}"
    print(f"universality ok on finite domain [0, {upper}): "
          f"3 | n  iff  3 | digit_sum(n) with zero counterexamples")


def check_large_sanity() -> None:
    """A few large integers, well beyond the exhaustive band."""
    cases = [
        (10**18 + 3, None),                    # digit sum small, arbitrary
        (999999999999, True),                  # all nines, divisible by 3
        (10**30 + 10**15 + 7, None),           # arbitrary large
        (7351 * 10**12, False),                # worked example scaled up
    ]
    for n, expected in cases:
        ds = digit_sum(n)
        n_div = (n % 3 == 0)
        ds_div = (ds % 3 == 0)
        assert n_div == ds_div, (
            f"large sanity failed: n={n}, ds={ds}, "
            f"n mod 3 = {n % 3}, ds mod 3 = {ds % 3}"
        )
        if expected is not None:
            assert n_div == expected, (
                f"large sanity: expected divisible={expected} for n={n}, got {n_div}"
            )
    print("large_sanity ok: rule holds on all sampled >10^12 numbers")


if __name__ == "__main__":
    check_worked_example()
    check_universality_finite(100000)
    check_large_sanity()
    print("ALL CHECKS PASSED")
