"""Independent check for task exp-chain-3x4-4y9-xy.

Statement (transcribed from the payload, nothing else used):
    3^x = 4,  4^y = 9.   Find xy.

Strategy, derived from the statement alone:
  1. Solve each equation for the real unknown with SymPy, without assuming any
     particular manipulation (no "take logs and chain" shortcut).
  2. Confirm each real solution is UNIQUE, so that "the value of xy" is well
     posed and no branch/sign ambiguity exists over the reals.
  3. Form x*y, simplify exactly, and compare to the stated answer 2 both
     symbolically (simplify to 0) and numerically at high precision.
  4. Confirm the result is exact and in simplest form (an integer).
"""

import json

import sympy as sp

TASK_ID = "exp-chain-3x4-4y9-xy"
STATED_ANSWER = sp.Integer(2)

x, y = sp.symbols("x y", real=True)

# --- 1. solve each equation independently -------------------------------
sol_x = sp.solve(sp.Eq(3**x, 4), x)
sol_y = sp.solve(sp.Eq(4**y, 9), y)

# keep only real solutions
sol_x = [s for s in sol_x if sp.im(sp.simplify(s)) == 0]
sol_y = [s for s in sol_y if sp.im(sp.simplify(s)) == 0]

unique_real = (len(sol_x) == 1) and (len(sol_y) == 1)

xv = sp.simplify(sol_x[0])
yv = sp.simplify(sol_y[0])

# --- 2. verify the solutions actually satisfy the equations -------------
sat = (
    sp.simplify(3**xv - 4) == 0
    and sp.simplify(4**yv - 9) == 0
)

# --- 3. exact product ---------------------------------------------------
prod = sp.simplify(sp.expand_log(sp.simplify(xv * yv), force=True))
prod = sp.nsimplify(sp.simplify(prod))

symbolic_match = sp.simplify(prod - STATED_ANSWER) == 0

# --- 4. independent high-precision numeric corroboration ----------------
xn = sp.log(4) / sp.log(3)
yn = sp.log(9) / sp.log(4)
numeric = sp.N(xn * yn, 50)
numeric_match = abs(numeric - sp.N(STATED_ANSWER, 50)) < sp.Float("1e-40")

# --- 5. exactness / simplest form --------------------------------------
is_exact_rational = prod.is_Integer or prod.is_Rational
simplest_form = prod.is_Integer  # "2" is already the simplest rendering

# --- 6. sign check: both logs are of numbers > 1 with bases > 1, so
#        x > 0 and y > 0, hence xy > 0. No negative branch to pick.
sign_ok = (sp.sign(xv) == 1) and (sp.sign(yv) == 1) and (sp.sign(prod) == 1)

agrees = bool(
    unique_real
    and sat
    and symbolic_match
    and numeric_match
    and is_exact_rational
    and simplest_form
    and sign_ok
)

print(
    json.dumps(
        {
            "task_id": TASK_ID,
            "computed": str(prod),
            "agrees": agrees,
        }
    )
)
