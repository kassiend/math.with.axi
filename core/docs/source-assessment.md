# Source material assessment

Per §5 of the brief: assess each listed source for fit and licensing **before** ingesting
anything. Nothing from any of these has been ingested. Licence facts were checked against the
primary sources on 2026-08-15; verify again before any decision that turns on them.

---

## 1. Project Euler — `projecteuler.net/archives`

**Verdict: do not use. Not as a topic source, not as an inspiration pass, not as a seed list.**

### Licensing

Problems in the Archives and Recent sections are published under
**CC BY-NC-SA 4.0** (Attribution–NonCommercial–ShareAlike). Three obligations, and each one is
independently disqualifying here:

- **NonCommercial.** The site states plainly that the problems "must not be used for commercial
  purposes." An Instagram channel that is monetised — brand deals, affiliate links, the platform's
  own bonus programmes, or a funnel to anything paid — is commercial use. If the channel is not
  monetised today, the licence still constrains what it can become, which is a bad thing to
  discover after building an audience.
- **ShareAlike.** Any derivative work inherits CC BY-NC-SA 4.0. A Reel derived from a Euler
  problem would have to be released under that licence, which means the video, its captions, and
  arguably the surrounding lesson become non-commercial and share-alike. That is a permanent
  encumbrance on an asset the channel owns.
- **Attribution.** Manageable on its own, but attribution in a 45-second vertical video costs
  screen real estate in a format that has very little of it.

The narrow reading — "we only take the idea, not the text" — does not survive contact with
practice. If the lesson is recognisably that problem, it is a derivative work; if it is not
recognisably that problem, Project Euler contributed nothing and there was no reason to open it.

### Fit

Independently of licensing, the fit is poor. Euler problems are **computational programming
puzzles** whose answer is a number you get by writing code and running it. The interesting part
is the algorithm and the optimisation, and it lives in a text editor over minutes to hours.

This channel makes 30–60 second visual explanations of a *method* — something with a schema a
viewer can carry away and reuse in their head. Those two things barely overlap. The handful of
Euler problems that do have a slick closed-form insight (Problem 1's inclusion–exclusion, for
instance) are standard results that exist in a hundred licence-free places, so there is nothing
to gain by sourcing them from here.

### What to do instead

Draw topics from the public domain of elementary mathematics — divisibility rules, modular
arithmetic tricks, mental-arithmetic shortcuts, classical identities, standard competition
techniques. Mathematical facts are not copyrightable; specific expressions of them are. Author
every lesson from scratch and the whole question disappears.

---

## 2. Lean / Mathlib

**Verdict: adopt, but as a verification backend only. Never as a topic source.**
**Not for v1 — plan it as phase 2.**

### Licensing

**Apache 2.0.** Permissive, commercial use fine, requires attribution and a copy of the licence.
No obstacle to any use here. This is the one clean licence of the three.

### As a topic source: no

Mathlib is a formalisation library. Its contents are stated at a level of abstraction that is
the opposite of what a 40-second lesson needs — `Nat.ModEq` machinery and typeclass hierarchies
do not compress into a Reel, and the parts that would compress are elementary results that need
no library to find.

### As a verification backend: yes, and it is genuinely better than SymPy

This is the real value, and the brief is right about it. Compare what each tool can actually
certify:

| | SymPy | Lean / Mathlib |
|---|---|---|
| "This identity holds for these 500 sampled inputs" | yes | yes |
| "This identity holds for **all** integers n" | **no** | **yes** |
| Failure mode | silently proves less than you think | fails to compile |

§3.2 is where this bites. The universal case currently accepts an exhaustive SymPy check over a
stated finite domain, or a citation to a whitelisted theorem. Both are compromises: the finite
check does not establish universality, and the whitelist is a human-maintained list of things we
have decided to trust. A Lean proof that typechecks is neither — it is a machine-checked proof of
the actual quantified statement.

### Cost, honestly

- Lean toolchain plus a Mathlib build is on the order of several GB and tens of minutes on a
  cold cache. It is a real dependency, not an npm package.
- Producing correct Lean from a natural-language claim is hard. An agent that cannot close a goal
  gives you `sorry`, and a proof containing `sorry` proves nothing — the gate would have to
  reject those, and early on it would reject most of them.
- It only helps for claims that are formalisable. "This mental trick is faster" is not.

### Recommended role

Phase 2, as an **additional** gate, not a replacement:

1. Keep SymPy as the cross-check for worked examples (§3.1). It is fast and it catches arithmetic.
2. Add Lean for §3.2 universality claims only. When a lesson claims universality, it must produce
   a Lean statement that compiles against Mathlib with no `sorry` and no `axiom`.
3. Shrink `verify/theorems.json` as Lean coverage grows. The whitelist exists because we cannot
   check theorem citations mechanically; once we can, it should go away.

---

## 3. Open Problem Garden

**Verdict: do not use, for any purpose.**

### Fit

It is a catalogue of **unsolved research-level problems** — 298 in algebra, 228 in graph theory,
and so on. There is no path from an open conjecture to a 45-second lesson that teaches a method,
because there is no method: the entire point of the entries is that nobody has one.

The tempting variant — "make a Reel *about* an unsolved problem" — is a different channel. It is
mathematical entertainment, not instruction, and it collides head-on with the pipeline's own
rules: §3.1 wants an executable check confirming a result, and §3.2 wants either a counterexample
or a proof of universality. An open problem supplies none of those by definition. Every such
lesson would fail the gates, correctly.

### Licensing and health

Content is under the **GNU Free Documentation License** — a copyleft licence with awkward
obligations for video (invariant sections, licence-text inclusion) and no clean answer for a
45-second Reel.

The site also shows signs of poor maintenance: the recent-activity feed carries obvious spam,
and account creation is manual because the automated process is "too prone to spammers." That is
not a source to build an automated ingestion path against.

---

## Summary

| Source | Licence | Use it? | Role |
|---|---|---|---|
| Project Euler | CC BY-NC-SA 4.0 | **No** | none — NC + SA are disqualifying for a monetisable channel, and the content is the wrong shape |
| Lean / Mathlib | Apache 2.0 | **Yes, phase 2** | verification backend for §3.2 universality claims; never a topic source |
| Open Problem Garden | GFDL | **No** | none — unsolved problems cannot satisfy §3.1 or §3.2 |

**Topic sourcing for v1** is therefore self-authored, from the public domain of elementary
mathematics, deduplicated through `content/ledger.json`. No external corpus is ingested, which
is also the simplest defensible position on licensing: there is nothing to attribute because
nothing was taken.
