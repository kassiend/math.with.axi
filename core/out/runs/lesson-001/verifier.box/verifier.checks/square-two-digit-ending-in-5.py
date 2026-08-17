"""Independent verifier for lesson 'square-two-digit-ending-in-5'.

Claims from the payload alone:
  1. Worked example: 95^2 == 9025.
  2. Identity: (10n + 5)^2 == 100 * n * (n + 1) + 25 for every non-negative
     integer n.
  3. carry_case is null: the two components n*(n+1) and 25 occupy disjoint
     decimal places (separated by factor 100), so no carry is possible.
  4. Domain for this lesson: n in {1,...,9}. Exhaustive check is claimed.
  5. Display steps: s2 -> "9 x 10 = 90", s3 -> "then append 25" -> "9025".

The script:
  a) Checks the worked example numerically.
  b) Verifies the identity symbolically with SymPy.
  c) Exhaustively confirms n in {1,...,9}.
  d) Probes the boundary and just outside (n = 0, 10, 11, 99, 100).
  e) Tests the "append 25" display step as digit concatenation of str(n*(n+1))
     with "25" -- the way a viewer would actually read s2 -> s3.
"""

from __future__ import annotations

import json

import sympy as sp


def main() -> None:
    # (a) Worked example: n = 9  ->  operand = 95.
    operand = 95
    computed_square = operand * operand  # 9025 expected

    # (b) Symbolic identity check.
    n = sp.symbols("n", integer=True)
    lhs = (10 * n + 5) ** 2
    rhs = 100 * n * (n + 1) + 25
    identity_symbolic = sp.simplify(sp.expand(lhs) - sp.expand(rhs)) == 0

    # (c) Exhaustive numeric check across stated domain n in {1..9}.
    domain_ok = all(
        (10 * k + 5) ** 2 == 100 * k * (k + 1) + 25 for k in range(1, 10)
    )

    # (d) Probe boundary + outside stated domain.
    outside_probe = {
        k: ((10 * k + 5) ** 2, 100 * k * (k + 1) + 25)
        for k in (0, 10, 11, 99, 100)
    }
    outside_ok = all(pair[0] == pair[1] for pair in outside_probe.values())

    # (e) Test the display steps read literally: "9 x 10 = 90" then "append 25"
    # -> string concatenation of str(n*(n+1)) with "25". Compare to actual
    # square across n in {0..12} to see if the append-as-string reading holds
    # everywhere the identity does.
    append_reading = {}
    for k in range(0, 13):
        product_str = str(k * (k + 1))
        concat_str = product_str + "25"
        actual_square = (10 * k + 5) ** 2
        append_reading[k] = (int(concat_str), actual_square,
                             int(concat_str) == actual_square)
    append_reading_ok = all(v[2] for v in append_reading.values())

    # (f) Explicitly test the "no carry" claim: n*(n+1) is disjoint from 25
    # because 25 < 100. Verify that n*(n+1)*100 + 25 never triggers a carry
    # into the tens/hundreds of 25 for any n in the stated domain (and beyond).
    no_carry_ok = all((100 * k * (k + 1) + 25) % 100 == 25
                      for k in range(0, 200))

    worked_example_ok = (computed_square == 9025)

    agrees = (
        worked_example_ok
        and identity_symbolic
        and domain_ok
        and outside_ok
        and append_reading_ok
        and no_carry_ok
    )

    print(json.dumps({
        "claim_id": "square-two-digit-ending-in-5",
        "computed": str(computed_square),
        "agrees": bool(agrees),
        "_diagnostics": {
            "worked_example_ok": worked_example_ok,
            "identity_symbolic_ok": bool(identity_symbolic),
            "domain_1_to_9_ok": domain_ok,
            "outside_probe_ok": outside_ok,
            "outside_probe": {str(k): [str(a), str(b)]
                              for k, (a, b) in outside_probe.items()},
            "append_as_string_ok": append_reading_ok,
            "no_carry_ok": no_carry_ok,
        },
    }))


if __name__ == "__main__":
    main()
