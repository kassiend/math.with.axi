"""
Check for the Gaussian-copula story.

David X. Li's 2000 paper "On Default Correlation: A Copula Function
Approach" applied the Gaussian copula to the joint distribution of default
times. In its bivariate form,

        C_rho(u, v) = Phi_2( Phi^{-1}(u), Phi^{-1}(v); rho ),

where Phi is the standard-normal CDF, Phi^{-1} its quantile function, and
Phi_2( . , . ; rho) the standard bivariate-normal CDF with correlation rho.

This script confirms three defining properties of that construction --
the ones that make it a copula at all and that pin down the two edge
cases the mechanism narration relies on:

  (1) Phi(Phi^{-1}(u)) = u for u in (0, 1).  This is what lets Li rewrite
      the pair (u, v) of marginal default probabilities as a point in the
      bivariate normal plane.

  (2) At rho = 0, C_0(u, v) = u * v.  Independence.  The copula reduces
      to the product copula, which is what the model would say if two
      mortgages defaulted with no shared exposure to anything.

  (3) As rho -> 1, C_rho(u, v) -> min(u, v).  Comonotonicity.  Perfect
      dependence: if one defaults, the other does too.  This is the case
      the 2008 housing collapse turned out to sit close to, and the case
      the low rho's fitted from calm data could not describe.

The bivariate-normal integral has no elementary closed form, so (2) and
(3) are checked numerically with SciPy; (1) is checked symbolically.

Last line is the JSON report; the orchestrator reads only that.
"""
import json
from sympy import Symbol, erf, sqrt, simplify, Rational
from scipy.stats import norm, multivariate_normal

STORY_ID = "gaussian-copula-broke-wall-street"

# ---- (1) Symbolic: Phi and Phi^{-1} are inverse on (0, 1) ----------------
# Phi(x) = (1 + erf(x/sqrt(2)))/2.  For u = 1/2, Phi^{-1}(u) = 0 and
# Phi(0) = 1/2, so the round-trip is exact and SymPy proves it.
u_sym = Rational(1, 2)
phi_of_zero = (1 + erf(0 / sqrt(2))) / 2      # Phi(0)
step_symbolic = simplify(phi_of_zero - u_sym) == 0

# A non-trivial value: a numerical round-trip through SciPy at u = 0.3.
u_num = 0.30
step_numeric = abs(norm.cdf(norm.ppf(u_num)) - u_num) < 1e-12

# ---- (2) Independence limit: C_0(u, v) = u * v --------------------------
u, v = 0.30, 0.70
x, y = norm.ppf(u), norm.ppf(v)
rho0 = 0.0
C0 = float(multivariate_normal.cdf([x, y], mean=[0, 0], cov=[[1, rho0], [rho0, 1]]))
indep_check = abs(C0 - u * v) < 1e-8

# ---- (3) Comonotonic limit: C_rho(u, v) -> min(u, v) as rho -> 1 --------
rho1 = 0.999999
C1 = float(multivariate_normal.cdf([x, y], mean=[0, 0], cov=[[1, rho1], [rho1, 1]]))
como_check = abs(C1 - min(u, v)) < 1e-3

agrees = bool(step_symbolic and step_numeric and indep_check and como_check)

print(json.dumps({
    "claim_id": STORY_ID,
    "computed": (
        f"Phi(Phi^-1(0.30))={norm.cdf(norm.ppf(0.30)):.8f} (=0.30); "
        f"C_0(0.3,0.7)={C0:.6f} vs u*v=0.21; "
        f"C_~1(0.3,0.7)={C1:.6f} vs min(u,v)=0.30"
    ),
    "agrees": agrees,
}))
