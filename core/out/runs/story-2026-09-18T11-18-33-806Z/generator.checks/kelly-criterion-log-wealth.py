"""
Check for the Kelly Criterion story.

Kelly's 1956 paper asks: given a repeated bet with win probability p, loss
probability q = 1 - p, and net odds b (win b times the stake, or lose it),
what fraction f of the current bankroll should be wagered on each round to
maximise the long-run growth rate of the bankroll?

The answer is the growth rate that a compounded sequence of such bets earns
per bet — the expected value of the LOGARITHM of the wealth multiplier:

        G(f) = p * log(1 + b*f) + q * log(1 - f)

Maximising G with respect to f is a one-variable calculus problem. SymPy
solves the first-order condition symbolically; the unique interior optimum
is f* = (b*p - q)/b. That is the formula the mechanism narration lands on.

This script confirms two things:

  (1) The critical point of G(f) is exactly (b*p - q)/b.
  (2) A worked instance — Ed Thorp's blackjack-style edge, roughly p = 0.51,
      b = 1 (even money) — gives the number a practitioner would actually
      bet: f* = 0.02, i.e. 2% of the bankroll. The number cited in the
      narration must match this to two decimal places.
"""
import json
from sympy import Symbol, log, diff, solve, Rational, simplify, together

STORY_ID = "kelly-criterion-log-wealth"

# ---- (1) Symbolic derivation --------------------------------------------
f, p, q, b = Symbol('f', real=True), Symbol('p', positive=True), Symbol('q', positive=True), Symbol('b', positive=True)

G = p * log(1 + b * f) + q * log(1 - f)          # expected log-growth per bet
dG = diff(G, f)                                  # first-order condition
critical = solve(dG, f)                          # solve dG/df = 0

# SymPy returns [(b*p - q)/b] after using p + q = 1 or leaves it in a form
# algebraically equivalent to it. Compare against the closed form directly.
kelly_closed_form = (b * p - q) / b

# Substitute q = 1 - p into both sides so the comparison is on one variable.
lhs = simplify(critical[0].subs(q, 1 - p))
rhs = simplify(kelly_closed_form.subs(q, 1 - p))
symbolic_match = simplify(lhs - rhs) == 0

# ---- (2) Worked instance: even-money edge of one percentage point -------
# Ed Thorp's card-counting edge in blackjack was around 1%. Model the round
# as an even-money bet (b = 1) with p = 0.51, q = 0.49. Kelly says stake 2%.
p_val, q_val, b_val = Rational(51, 100), Rational(49, 100), Rational(1, 1)
f_star = (b_val * p_val - q_val) / b_val         # = 0.02
worked_match = abs(float(f_star) - 0.02) < 1e-9

agrees = bool(symbolic_match and worked_match)

print(json.dumps({
    "claim_id": STORY_ID,
    "computed": (
        f"d/df [ p*log(1+b*f) + q*log(1-f) ] = 0 => f* = (b*p - q)/b; "
        f"symbolic identity {'holds' if symbolic_match else 'FAILS'}; "
        f"worked case p=0.51, b=1 gives f*={float(f_star):.4f} "
        f"({'matches 2%' if worked_match else 'MISMATCH'})"
    ),
    "agrees": agrees,
}))
