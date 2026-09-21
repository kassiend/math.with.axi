---
name: math-visual
description: Rendering mathematics as something worth looking at — formulas with KaTeX and curves, surfaces and constructions as deterministic SVG. Use when a post must show a formula, a graph, a parametric curve, a geometric construction, or an animated build-up of one. Covers what to draw, what not to, and the constraints a frame-by-frame capture imposes.
---

# Math visual

Two jobs, different tools: **formulas** are typeset, **shapes** are drawn. Never screenshot one to
get the other.

## Formulas — KaTeX, always

`katex.renderToString()`, synchronous, `throwOnError: true`. MathJax is banned in this codebase
because it typesets asynchronously and a capture loop screenshots frames mid-render — the failure
is intermittent, which is the worst kind.

- A formula the typesetter rejects must render as a visible error marker, never silently degrade.
  A malformed formula on screen is worse than a missing one.
- Inherit size and colour from the container (`font-size: 1em; color: inherit`). KaTeX's own
  sizing will fight your layout otherwise.
- Size the formula to the space with a measured auto-fit, not a guess. Overflow is a defect.

## Curves — `visual: "plot"`, and you write the equation, not the path

Do **not** hand-compute SVG path data for a curve. The renderer samples the equation for you.
Emit a `plot` object on the beat and the page compiles the expression, samples it, splits it at
discontinuities, fits the window, draws the axes and builds it on-screen.

```jsonc
{ "beat": "mechanism", "visual": "plot",
  "plot": { "kind": "function", "expr": "exp(-x^2/2)/sqrt(2*pi)",
            "domain": [-4, 4], "grid": true,
            "fillTo": "zero", "fillDomain": [-1, 1], "xLabel": "x" } }
```

| `kind` | fields | variable |
|---|---|---|
| `function` | `expr` | `x` |
| `parametric` | `x`, `y` | `t` |
| `polar` | `r` | `theta` |

`domain` is the sweep — x-range, t-range or θ-range. `xRange` / `yRange` set the visible window
and are fitted to the samples when omitted. `fillTo: "zero"` shades down to the axis, and
`fillDomain` narrows that shading to an interval — which is how a definite integral is drawn.
Optional: `samples` (600), `axes`, `grid`, `xLabel`, `yLabel`.

```
heart:      x = 16sin³t,  y = 13cos t − 5cos2t − 2cos3t − cos4t,  t ∈ [0, 2π]
cardioid:   r = a(1 − cos θ)
lissajous:  x = A sin(at + δ),  y = B sin(bt)
spiral:     r = a + bθ
```

**The expression language is closed**, because the page would otherwise be executing text an
agent wrote. `+ - * / % ^`, parentheses, the declared variable, `pi tau e phi`, and:

```
sin cos tan asin acos atan atan2 sinh cosh tanh
exp ln log log2 sqrt cbrt abs sign floor ceil round min max pow mod
```

Anything else is a parse error and renders as a **red error card**, on purpose — a blank slot
where a curve should be looks like a design choice and ships. If you need a function that is not
on the list, build it out of the ones that are.

`^` is right-associative and binds tighter than unary minus on the left: `-x^2` is `−(x²)`,
`2^3^2` is `2⁹`. Write `exp(-x^2/2)`, not `e^-x^2/2`.

## Shapes — inline SVG, computed in code

For a geometric construction, a diagram, or anything that is not a curve from an equation:
`visual: "shape"` with SVG markup. Still generated from the actual geometry, not drawn by eye,
and not an image.

**Sample densely enough that the curve is smooth, then stop.** 400–800 points covers anything at
1080×1920; beyond that you are adding file size, not fidelity.

## Long beats — build the picture across the narration, not once

A 35-second beat cannot hold one still picture: the viewer reads it in two seconds and waits out
the voice. A beat may instead carry `steps`, an ordered list of visuals, each with a `weight` equal
to the **word count** of the narration it illustrates. Speech runs at a near-constant rate, so a
step sized to its words lasts as long as its sentence — the picture advances with the voice without
needing word-level timestamps (which the TTS does not provide).

```jsonc
{ "beat": "mechanism", "display": "...",
  "steps": [
    { "visual": "formula", "formula_latex": "\\gcd(a,b)=\\gcd(a-b,\\,b)", "weight": 46 },
    { "visual": "anim", "anim": { "type": "gcd-subtraction", "a": 1920, "b": 1080 }, "weight": 33 }
  ] }
```

A single-element `steps` list makes one visual span the whole beat (its `build` runs 0→1 across the
beat, not just the first 1.5 s) — the way to give an animation the entire beat to play.

`anim` is a small registry of computed animations, each a pure function of the frame:

| `type` | draws | params |
|---|---|---|
| `gcd-subtraction` | the Euclidean loop shrinking two bars to their gcd | `a`, `b` |
| `least-squares` | points → a line → the squared residuals → the fit | — |
| `fourier-build` | perpendicular sines, the flat function they miss, the constant that fixes it | — |
| `nash-matrix` | a 2x2 game filling in, each side's best replies marked, the cell both point at | — |
| `nash-mixing` | four cells with no stable one, then the payoff lines whose crossing is the mix | — |

Numbers shown in an animation are computed from the same values the SymPy check verified, so the
picture cannot drift from the claim. A new kind of animation is a new component in
`web/src/story/anim.tsx`, not a payload field — keep the payload declarative.

## The constraint that governs everything here

Every visual is captured **frame by frame** and must be a pure function of the frame index.

- No CSS transitions, no `@keyframes`, no `requestAnimationFrame` loops, no `setTimeout`.
- An animated draw-on is `stroke-dasharray` + `stroke-dashoffset` computed from the frame number.
  A `plot` already does this: it builds itself over the first 1.5 s of its beat and then holds.
- A time-based animation renders differently depending on how fast the capture loop happens to
  run, which means the same post produces a different video on a different machine.

## What is worth drawing

The test is whether the picture carries information the sentence cannot.

| worth it | not worth it |
|---|---|
| a curve the viewer did not expect to be a heart | a stock photo of a blackboard |
| the same knot, before and after the cut | a formula floating over a gradient |
| a distribution filling in as samples arrive | a pie chart of anything |
| a construction built one line at a time | an equation with a glow on it |

**Build, do not reveal.** A shape that draws itself in front of the viewer holds attention; the
same shape fading in does not. Give the build 1–2 seconds and let the finished state hold.

## Colour and weight

Follow whatever palette the post's card already uses rather than introducing a third one. Curves
need weight — 4–8 px at 1080 wide, or they vanish under compression. Grid lines, if any, sit far
back: light, thin, and never competing with the curve.

Label the axes only when the numbers matter. A shape story usually reads better naked.
