"""Independent verifier check for lesson `difference-of-squares-factoring`.

Derived from the claim alone:
  - Method: a^2 - b^2 = (a+b)(a-b)
  - Worked example operands: a=55, b=30
  - Applicability claim: holds for any two real numbers (in fact any
    commutative ring), no exceptions.

We verify:
  1. The worked example arithmetic: compute 55^2 - 30^2 directly and via
     (55+30)*(55-30); both must match and equal the stated result 2125.
  2. The identity symbolically with SymPy: expand((a+b)*(a-b)) - (a**2 - b**2)
     must be identically zero.
  3. The universality claim by probing the boundary of the stated domain and
     just outside it: integers (incl. negatives, zero, one), rationals, reals,
     and complex numbers. Also non-commutative counterexample is not required
     since the payload restricts to real/complex, but we probe a Gaussian
     integer and a matrix-free scalar sweep.
"""

import json
from fractions import Fraction

import sympy as sp


def check_worked_example() -> tuple[str, bool]:
    a, b = 55, 30
    lhs = a * a - b * b
    rhs = (a + b) * (a - b)
    stated = 2125
    ok = (lhs == rhs == stated)
    return str(lhs), ok


def check_identity_symbolic() -> bool:
    a, b = sp.symbols("a b")
    diff = sp.expand((a + b) * (a - b) - (a ** 2 - b ** 2))
    return diff == 0


def check_universality_numeric() -> bool:
    # Probe boundary and outside: negatives, zero, one, non-integers, complex.
    samples = [
        (0, 0),
        (1, 0),
        (0, 1),
        (-1, 1),
        (-7, -13),
        (1, 1),
        (100, -100),
        (Fraction(1, 3), Fraction(5, 7)),
        (Fraction(-2, 5), Fraction(9, 4)),
        (2.5, -1.75),
        (complex(1, 2), complex(-3, 4)),
        (complex(0, 1), complex(0, -1)),
    ]
    for a, b in samples:
        lhs = a * a - b * b
        rhs = (a + b) * (a - b)
        # Use a loose tolerance for floats/complex.
        if isinstance(lhs, (float, complex)) or isinstance(rhs, (float, complex)):
            if abs(lhs - rhs) > 1e-9:
                return False
        else:
            if lhs != rhs:
                return False
    return True


def check_universality_exhaustive_small() -> bool:
    # Exhaustive integer sweep over a small stated finite domain — this only
    # supports the identity on integers within that range, nothing more.
    for a in range(-20, 21):
        for b in range(-20, 21):
            if a * a - b * b != (a + b) * (a - b):
                return False
    return True


def main() -> None:
    computed, worked_ok = check_worked_example()
    symbolic_ok = check_identity_symbolic()
    numeric_ok = check_universality_numeric()
    exhaustive_ok = check_universality_exhaustive_small()
    agrees = worked_ok and symbolic_ok and numeric_ok and exhaustive_ok
    print(json.dumps({
        "claim_id": "difference-of-squares-factoring",
        "computed": computed,
        "agrees": agrees,
    }))


if __name__ == "__main__":
    main()
