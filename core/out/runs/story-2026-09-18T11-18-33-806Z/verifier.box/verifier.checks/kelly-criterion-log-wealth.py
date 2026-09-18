"""Independent verification of the Kelly criterion story.

Claim:
  G(f) = p*log(1 + b*f) + q*log(1 - f)   with q = 1 - p
  G'(f) = p*b/(1 + b*f) - q/(1 - f)      (step 2 follows from step 1)
  Setting G'(f) = 0 gives f* = (b*p - q)/b   (step 3 follows from step 2)

We confirm each transition symbolically with SymPy, without reading anything
the Generator produced.
"""

import json

import sympy as sp


def main() -> None:
    f, p, q, b = sp.symbols("f p q b", real=True)

    # --- Step 1 -> Step 2: differentiate G and compare to the claimed G'. ---
    G = p * sp.log(1 + b * f) + q * sp.log(1 - f)
    G_prime_claimed = p * b / (1 + b * f) - q / (1 - f)
    G_prime_computed = sp.diff(G, f)

    step1_to_step2 = sp.simplify(G_prime_computed - G_prime_claimed) == 0

    # --- Step 2 -> Step 3: solve G'(f) = 0 for f and compare to the claimed
    #     optimum f* = (b*p - q)/b.  The stated formula assumes q = 1 - p
    #     (the mechanism explicitly says so), so substitute that in before
    #     solving; otherwise the raw solver returns the two-variable form.
    G_prime_binary = G_prime_claimed.subs(q, 1 - p)
    solutions = sp.solve(sp.Eq(G_prime_binary, 0), f)

    f_star_claimed = (b * p - q) / b
    f_star_claimed_binary = f_star_claimed.subs(q, 1 - p)

    step2_to_step3 = any(
        sp.simplify(sol - f_star_claimed_binary) == 0 for sol in solutions
    )

    # --- Sanity: the critical point is a maximum (G'' < 0 on the interior). ---
    G_second = sp.diff(G, f, 2)
    G_second_at_star = sp.simplify(
        G_second.subs({q: 1 - p, f: f_star_claimed_binary})
    )
    # For 0 < p < 1 and b > 0 with 0 < f* < 1 this should be negative.
    concavity_ok = sp.simplify(
        G_second_at_star.subs({p: sp.Rational(1, 2), b: 2})
    ) < 0

    agrees = bool(step1_to_step2 and step2_to_step3 and concavity_ok)

    computed = (
        f"G'(f)={sp.simplify(G_prime_computed)}; "
        f"solve G'=0 -> f={solutions}; "
        f"claimed f*={sp.simplify(f_star_claimed_binary)}; "
        f"G''(f*) sample={G_second_at_star.subs({p: sp.Rational(1,2), b: 2})}"
    )

    print(json.dumps({
        "claim_id": "kelly-criterion-log-wealth",
        "computed": computed,
        "agrees": agrees,
    }))


if __name__ == "__main__":
    main()
