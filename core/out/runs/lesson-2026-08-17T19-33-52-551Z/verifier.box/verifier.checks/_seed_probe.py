import random, json
s=288838249; out={}
try:
    import numpy as np
    g=np.random.default_rng(s); out["np_default_rng.integers"]=[int(v) for v in g.integers(91,100,2)]
    r=np.random.RandomState(s); out["np_RandomState.randint"]=[int(v) for v in r.randint(91,100,2)]
except Exception as e: out["numpy"]=str(e)
def mulberry32(a):
    def nxt():
        nonlocal a
        a=(a+0x6D2B79F5)&0xFFFFFFFF
        t=a; t=( (t^(t>>15))*(t|1) )&0xFFFFFFFF
        t=(t ^ (t+((t^(t>>7))*(t|61))&0xFFFFFFFF))&0xFFFFFFFF
        return ((t^(t>>14))&0xFFFFFFFF)/4294967296
    return nxt
m=mulberry32(s); out["mulberry32"]=[91+int(m()*9) for _ in range(2)]
def lcg(seed):
    st=seed
    def nxt():
        nonlocal st
        st=(1103515245*st+12345)%(2**31)
        return st/(2**31)
    return nxt
l=lcg(s); out["lcg"]=[91+int(l()*9) for _ in range(2)]
r=random.Random(s); out["random.random_scaled"]=[91+int(r.random()*9) for _ in range(2)]
r=random.Random(str(s)); out["random.Random(str)"]=[r.randint(91,99) for _ in range(2)]
r=random.Random(s); out["shuffle_first2"]=(lambda p: (r.shuffle(p), p[:2])[1])(list(range(91,100)))
out["target"]=[97,92]
out["matches"]=[k for k,v in out.items() if v==[97,92]]
print(json.dumps(out))
