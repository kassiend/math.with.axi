"""
Planner self-check for the lesson `multiply-by-11-two-digit`.

Two things must hold before this plan is worth handing to the narrator:

  1. The worked example: 20 * 11 must equal the reported 220 — computed directly
     from the operands, NOT by re-walking the split-add-drop steps. A check that
     reproduces the trick reproduces its bugs.

  2. The applicability + carry_case claim, checked exhaustively over the finite
     domain the lesson declares (two-digit integers 10..99):

        - if the digits sum to less than 10, the "simple" rule
              N == 100*a + 10*(a+b) + b      where N = 10*a + b
          must give exactly N*11.

        - if the digits sum to 10 or more, the SIMPLE rule must FAIL
          (that is what makes it a caveat) and the CARRY rule
              N*11 == 100*(a+1) + 10*((a+b) - 10) + b
          must give exactly N*11 instead.

The specific carry_case shown to the viewer, 78 * 11 = 858, is also spot-checked.
"""

from sympy import Integer, symbols, simplify


# ---------- 1. Worked example, computed straight from the operands. ----------
a_op, b_op = 20, 11
product = Integer(a_op) * Integer(b_op)
assert product == 220, f"worked example wrong: 20*11 = {product}, expected 220"
print(f"[ok] worked example: {a_op} * {b_op} = {product}")


# ---------- 2. Algebraic identity for the simple rule. ----------
# Symbolically: for N = 10a + b,   N * 11 = 100a + 10(a+b) + b   always,
# but the "middle digit = a+b" reading of that is only valid when a+b < 10.
a, b = symbols("a b", integer=True)
N = 10 * a + b
identity_lhs = N * 11
identity_rhs = 100 * a + 10 * (a + b) + b
assert simplify(identity_lhs - identity_rhs) == 0, "algebraic identity failed"
print("[ok] algebraic identity: (10a+b) * 11 == 100a + 10(a+b) + b")


# ---------- 3. Exhaustive finite-domain check over 10..99. ----------
simple_ok_no_carry = 0
simple_fails_with_carry = 0
carry_rule_ok_with_carry = 0

first_carry_failure = None

for n in range(10, 100):
    tens, ones = divmod(n, 10)
    digit_sum = tens + ones
    truth = n * 11

    # The "simple" rule read as three concatenated digits: a (a+b) b.
    # This is only a valid decimal representation when a+b <= 9.
    simple_concat = 100 * tens + 10 * digit_sum + ones

    # The "carry" rule: (a+1)(a+b-10)(b) — valid when a+b >= 10.
    carry_concat = 100 * (tens + 1) + 10 * (digit_sum - 10) + ones

    if digit_sum < 10:
        assert simple_concat == truth, (
            f"simple rule broke inside its claimed range at n={n}: "
            f"got {simple_concat}, truth {truth}"
        )
        simple_ok_no_carry += 1
    else:
        # The caveat's whole point: naive concat must NOT equal the truth here,
        # otherwise "if digits sum to 10 or more, carry" is a lie.
        if simple_concat == truth:
            first_carry_failure = ("simple did not actually fail", n)
        else:
            simple_fails_with_carry += 1

        assert carry_concat == truth, (
            f"carry rule broke at n={n}: got {carry_concat}, truth {truth}"
        )
        carry_rule_ok_with_carry += 1

assert first_carry_failure is None, first_carry_failure
print(
    f"[ok] exhaustive 10..99: "
    f"simple rule holds for all {simple_ok_no_carry} numbers with digit sum < 10; "
    f"simple rule fails for all {simple_fails_with_carry} numbers with digit sum >= 10; "
    f"carry rule holds for all {carry_rule_ok_with_carry} of them."
)


# ---------- 4. The specific carry case shown on the caveat card. ----------
assert 78 * 11 == 858, f"78*11 != 858 (got {78*11})"
naive_78 = 100 * 7 + 10 * (7 + 8) + 8  # what the simple rule would give: 7|15|8
assert naive_78 != 858, "simple rule accidentally works on 78 — caveat is false"
print(f"[ok] caveat spot-check: 78 * 11 = 858; naive concat gives {naive_78} (correctly wrong)")


print("ALL CHECKS PASSED")
