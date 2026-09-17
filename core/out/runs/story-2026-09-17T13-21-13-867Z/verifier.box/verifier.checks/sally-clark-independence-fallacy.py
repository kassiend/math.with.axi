"""Independent check for the Sally Clark / Meadow independence fallacy story.

The story states three formula steps:
  (1) P(A ∩ B) = P(A) · P(B)            [only if A and B are independent]
  (2) (1/8543) · (1/8543) ≈ 1/73,000,000
  (3) P(A ∩ B) = P(A) · P(B | A)         [general chain rule]

We verify:
  * Step 1 is the specialisation of Step 3 under independence
    (i.e. P(B | A) = P(B)  ⇒  P(A) P(B | A) = P(A) P(B)).
  * Step 2 is arithmetically correct within the stated ≈ tolerance.
  * Step 3 (chain rule) holds identically from the definition
    P(B | A) = P(A ∩ B) / P(A) whenever P(A) > 0.

All three checks must pass for the story's formula to be confirmed.
"""

import json

import sympy as sp


def check_step3_chain_rule() -> bool:
    """P(A ∩ B) = P(A) · P(B | A), given P(B | A) := P(A ∩ B)/P(A)."""
    pA, pAB = sp.symbols("pA pAB", positive=True)
    pB_given_A = pAB / pA  # definition of conditional probability
    lhs = pAB
    rhs = pA * pB_given_A
    return sp.simplify(lhs - rhs) == 0


def check_step1_as_specialisation() -> bool:
    """Under independence P(B | A) = P(B), the general rule collapses
    to P(A ∩ B) = P(A) · P(B)."""
    pA, pB = sp.symbols("pA pB", positive=True)
    # In the independence case, substitute P(B|A) = P(B) into step 3.
    general = pA * sp.Symbol("pBgivenA", positive=True)
    specialised = general.subs(sp.Symbol("pBgivenA", positive=True), pB)
    expected = pA * pB
    return sp.simplify(specialised - expected) == 0


def check_step2_arithmetic() -> tuple[bool, str]:
    """(1/8543)^2 ≈ 1/73,000,000 — check the ≈ within 5% relative error."""
    exact = sp.Rational(1, 8543) ** 2  # = 1 / 72_982_849
    claimed = sp.Rational(1, 73_000_000)
    # ratio should be very close to 1
    ratio = sp.Float(exact / claimed)
    ok = abs(float(ratio) - 1.0) < 0.05
    return ok, f"1/8543^2 = 1/{8543**2}; claimed 1/73000000; ratio={float(ratio):.6f}"


def main() -> None:
    s3 = check_step3_chain_rule()
    s1 = check_step1_as_specialisation()
    s2, s2_detail = check_step2_arithmetic()

    all_ok = bool(s3 and s1 and s2)
    computed = (
        f"chain_rule={s3}; independence_specialisation={s1}; "
        f"arithmetic={s2} ({s2_detail})"
    )
    print(json.dumps({
        "claim_id": "sally-clark-independence-fallacy",
        "computed": computed,
        "agrees": all_ok,
    }))


if __name__ == "__main__":
    main()
