"""
Independent verification for claim: wald-armor-where-bullets-arent

Claim: P(S | H_R) = P(H_R | S) * P(S) / P(H_R)    (Bayes' theorem)

Formula steps to verify:
  1) P(H_R | S)                    -- conditional: hit at R given survival
  2) P(S | H_R)                    -- reverse conditional: survival given hit at R
  3) P(S | H_R) = P(H_R | S) * P(S) / P(H_R)   -- Bayes' formula

Verification strategy (independent of the payload's own reasoning):
  Start from the definitions of conditional probability:
      P(A | B) := P(A ∩ B) / P(B)       (whenever P(B) > 0)
  Let p_SR := P(S ∩ H_R), p_S := P(S), p_R := P(H_R).
  Then:
      LHS  := P(S | H_R)              = p_SR / p_R
      RHS  := P(H_R | S) * P(S) / P(H_R)
           = (p_SR / p_S) * p_S / p_R
           = p_SR / p_R
  So LHS - RHS must simplify to 0 symbolically.

We also verify step 2 follows from step 1 via Bayes (the identity is the
same identity applied both ways), and we do a numeric sanity check with
Wald's own limiting scenario:
  If P(H_R | S) -> 0, P(S) fixed, P(H_R) > 0, then P(S | H_R) -> 0.
"""

import json
import sympy as sp


def main() -> None:
    # Symbolic joint / marginal probabilities.
    p_SR, p_S, p_R = sp.symbols("p_SR p_S p_R", positive=True)

    # Step 1: definition of P(H_R | S).
    P_HR_given_S = p_SR / p_S

    # Step 2: definition of P(S | H_R).
    P_S_given_HR = p_SR / p_R

    # Step 3: Bayes' formula rearrangement.
    bayes_rhs = P_HR_given_S * p_S / p_R

    # Check the identity claimed by the formula.
    residual = sp.simplify(P_S_given_HR - bayes_rhs)
    identity_holds = (residual == 0)

    # Chain-of-steps check: step 3 must follow algebraically from steps 1 & 2.
    #   substitute step-1 expression into RHS, verify equals step-2 LHS.
    chain = sp.simplify(bayes_rhs - P_S_given_HR)
    chain_holds = (chain == 0)

    # Numeric limit sanity check: as P(H_R | S) -> 0 (with P(S), P(H_R) > 0),
    # the posterior P(S | H_R) -> 0.  Encode by setting p_SR = eps * p_S.
    eps = sp.symbols("eps", positive=True)
    posterior = (eps * p_S) * p_S / p_R / p_S  # = eps * p_S / p_R via Bayes
    # Equivalently, from Bayes: P(S|H_R) = P(H_R|S) * P(S) / P(H_R) = eps * p_S / p_R.
    limit_val = sp.limit(sp.Rational(1, 1) * eps * p_S / p_R, eps, 0)
    limit_ok = (limit_val == 0)

    # Numeric spot check with concrete probabilities that respect axioms.
    #   Let P(S) = 0.9, P(H_R | S) = 0.01, P(H_R | ~S) = 0.5.
    #   P(H_R) = 0.9*0.01 + 0.1*0.5 = 0.009 + 0.05 = 0.059
    #   P(S | H_R) = 0.9*0.01 / 0.059 = 0.009 / 0.059 ≈ 0.15254...
    pS_num = sp.Rational(9, 10)
    pHR_S_num = sp.Rational(1, 100)
    pHR_notS_num = sp.Rational(1, 2)
    pHR_num = pS_num * pHR_S_num + (1 - pS_num) * pHR_notS_num
    posterior_num = pHR_S_num * pS_num / pHR_num
    posterior_num_simpl = sp.nsimplify(posterior_num)
    # Direct via joint: P(S ∩ H_R) = P(S) * P(H_R|S).
    joint_num = pS_num * pHR_S_num
    posterior_direct = joint_num / pHR_num
    numeric_ok = sp.simplify(posterior_num_simpl - posterior_direct) == 0

    agrees = bool(identity_holds and chain_holds and limit_ok and numeric_ok)

    computed = (
        f"P(S|H_R) - P(H_R|S)*P(S)/P(H_R) = {residual}; "
        f"chain residual = {chain}; "
        f"lim_{{P(H_R|S)->0}} P(S|H_R) = {limit_val}; "
        f"numeric P(S|H_R) = {posterior_num_simpl} "
        f"(direct via joint = {posterior_direct})"
    )

    print(json.dumps({
        "claim_id": "wald-armor-where-bullets-arent",
        "computed": computed,
        "agrees": agrees,
    }))


if __name__ == "__main__":
    main()
