import sympy as sp, json

# Statement: product_{k=2}^{10} (1 - 1/k^2)
val = sp.Integer(1)
for k in range(2, 11):
    val *= (1 - sp.Rational(1, k**2))
val = sp.nsimplify(val)
computed = str(sp.Rational(val))
answer = "11/20"
print("product value:", computed)
print(json.dumps({"claim_id": "telescoping-product-one-minus-inv-square-10",
                  "computed": computed, "agrees": computed == answer}))
