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

## Shapes — inline SVG, computed in code

Parametric curves, function plots, geometric constructions and diagrams are SVG path data
generated from the actual equation. Not an image, not a library chart.

```
heart:      x = 16sin³t,  y = 13cos t − 5cos2t − 2cos3t − cos4t,  t ∈ [0, 2π]
cardioid:   r = a(1 − cos θ)
lissajous:  x = A sin(at + δ),  y = B sin(bt)
spiral:     r = a + bθ
```

**Sample densely enough that the curve is smooth, then stop.** 400–800 points covers anything at
1080×1920; beyond that you are adding file size, not fidelity.

## The constraint that governs everything here

Every visual is captured **frame by frame** and must be a pure function of the frame index.

- No CSS transitions, no `@keyframes`, no `requestAnimationFrame` loops, no `setTimeout`.
- An animated draw-on is `stroke-dasharray` + `stroke-dashoffset` computed from the frame number.
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
