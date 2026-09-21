"""
Independent verification of the Gaussian copula identity:

    C_rho(u, v) = Phi_2( Phi^{-1}(u), Phi^{-1}(v); rho )

Formula-step chain being verified:
  (1) u = F_A(t_A), v = F_B(t_B)                     [u, v in (0,1) by CDF]
  (2) x = Phi^{-1}(u), y = Phi^{-1}(v)               [inverse-normal transform]
  (3) C_rho(u, v) = Phi_2(x, y; rho)                 [bivariate normal CDF]

If (X, Y) ~ N_2(0, [[1, rho], [rho, 1]]), then U := Phi(X), V := Phi(Y) are
Uniform(0,1) and their joint distribution function is, by construction:

    C_rho(u,v) = P(U<=u, V<=v)
               = P(Phi(X) <= u, Phi(Y) <= v)
               = P(X <= Phi^{-1}(u), Y <= Phi^{-1}(v))
               = Phi_2(Phi^{-1}(u), Phi^{-1}(v); rho).

We verify this identity two ways at a grid of (u, v, rho) points:

  (a) Analytic: compute both sides using scipy's normal / bivariate-normal CDF.
  (b) Monte Carlo: simulate (X, Y) ~ N_2, form U = Phi(X), V = Phi(Y), and
      compare the empirical P(U<=u, V<=v) with Phi_2(Phi^{-1}(u), Phi^{-1}(v); rho).

We also check the two prerequisite pieces of the chain:
  * Step (1) : that u, v being CDF outputs lie in (0,1)  (checked by the fact
    that scipy.stats.norm.cdf produces values in (0,1) at any finite argument).
  * Step (2) : that Phi and Phi^{-1} are inverse maps between R and (0,1),
    verified by round-trip Phi(Phi^{-1}(u)) = u for a grid of u's.
"""

import json
import numpy as np
from scipy.stats import norm, multivariate_normal


def phi(x):
    return norm.cdf(x)


def phi_inv(u):
    return norm.ppf(u)


def phi2(x, y, rho):
    """Bivariate standard-normal CDF with correlation rho."""
    cov = np.array([[1.0, rho], [rho, 1.0]])
    return multivariate_normal(mean=[0.0, 0.0], cov=cov).cdf([x, y])


def analytic_lhs_C(u, v, rho):
    """Left-hand side C_rho(u,v) computed via the identity."""
    return phi2(phi_inv(u), phi_inv(v), rho)


def monte_carlo_C(u, v, rho, n=400_000, seed=0):
    """Empirical P(U <= u, V <= v) with U=Phi(X), V=Phi(Y)."""
    rng = np.random.default_rng(seed)
    cov = np.array([[1.0, rho], [rho, 1.0]])
    xy = rng.multivariate_normal(mean=[0.0, 0.0], cov=cov, size=n)
    U = phi(xy[:, 0])
    V = phi(xy[:, 1])
    return float(np.mean((U <= u) & (V <= v)))


def main():
    max_err_analytic = 0.0
    max_err_mc = 0.0

    # ---- Step (2) round-trip: Phi(Phi^{-1}(u)) == u  --------------------
    step2_ok = True
    for u in np.linspace(0.01, 0.99, 25):
        if not np.isclose(phi(phi_inv(u)), u, atol=1e-12):
            step2_ok = False
            break

    # ---- Sanity: Phi maps R -> (0,1) strictly -----------------------------
    step1_ok = True
    for t in [-5.0, -1.0, 0.0, 1.0, 5.0]:
        val = phi(t)
        if not (0.0 < val < 1.0):
            step1_ok = False
            break

    # ---- Main identity across a grid of (u, v, rho) ----------------------
    grid_u = [0.10, 0.30, 0.50, 0.70, 0.90]
    grid_v = [0.15, 0.40, 0.60, 0.85]
    grid_rho = [-0.75, -0.30, 0.00, 0.30, 0.75]

    all_agree_analytic = True

    # Analytic self-consistency: C_rho(u,v) defined as Phi_2(Phi^{-1}u,Phi^{-1}v;rho)
    # must satisfy uniform-marginal boundary conditions.
    #   C(u, 1) = u, C(1, v) = v, C(u, 0) = C(0, v) = 0.
    for u in grid_u:
        c_u1 = phi2(phi_inv(u), phi_inv(1 - 1e-12), 0.3)
        c_1u = phi2(phi_inv(1 - 1e-12), phi_inv(u), 0.3)
        c_u0 = phi2(phi_inv(u), phi_inv(1e-12), 0.3)
        err1 = abs(c_u1 - u)
        err2 = abs(c_1u - u)
        err3 = abs(c_u0 - 0.0)
        max_err_analytic = max(max_err_analytic, err1, err2, err3)
        if max(err1, err2, err3) > 1e-4:
            all_agree_analytic = False

    # Independence case rho=0: C_0(u,v) = u * v.
    for u in grid_u:
        for v in grid_v:
            val = phi2(phi_inv(u), phi_inv(v), 0.0)
            err = abs(val - u * v)
            max_err_analytic = max(max_err_analytic, err)
            if err > 1e-6:
                all_agree_analytic = False

    # Perfect positive dependence limit (rho -> 1): C(u,v) -> min(u,v).
    for u in grid_u:
        for v in grid_v:
            val = phi2(phi_inv(u), phi_inv(v), 0.999)
            err = abs(val - min(u, v))
            if err > 5e-3:  # loose: it's a limit, not exact at rho=0.999
                all_agree_analytic = False
            max_err_analytic = max(max_err_analytic, err)

    # ---- Monte-Carlo verification of the identity ------------------------
    mc_ok = True
    for rho in [-0.5, 0.0, 0.4, 0.8]:
        for (u, v) in [(0.25, 0.25), (0.5, 0.5), (0.75, 0.4), (0.9, 0.9)]:
            lhs = monte_carlo_C(u, v, rho, n=200_000, seed=17)
            rhs = analytic_lhs_C(u, v, rho)
            err = abs(lhs - rhs)
            max_err_mc = max(max_err_mc, err)
            if err > 3e-3:  # Monte-Carlo tolerance
                mc_ok = False

    agrees = bool(step1_ok and step2_ok and all_agree_analytic and mc_ok)

    computed = (
        f"step1_uv_in_01={step1_ok}; "
        f"step2_phi_roundtrip={step2_ok}; "
        f"analytic_identity_ok={all_agree_analytic} (max_err={max_err_analytic:.2e}); "
        f"monte_carlo_ok={mc_ok} (max_err={max_err_mc:.2e})"
    )

    print(json.dumps({
        "claim_id": "gaussian-copula-broke-wall-street",
        "computed": computed,
        "agrees": agrees,
    }))


if __name__ == "__main__":
    main()
