# Mascot keying — findings

Ran on 2026-08-15 against everything in `assets/video/`. Reproduce with:

```bash
node core/tools/chromakey.mjs --similarity 0.12 --blend 0.02
open core/out/logs/chromakey-previews/
```

## The starting problem

The brief assumed the mascot was a pre-rendered alpha asset (WebM / ProRes 4444). It is not.
Every clip is `yuv420p` — no alpha anywhere, including the two WebMs, where VP9 alpha would show
as `yuva420p`. So the alpha has to be manufactured, and keying is the only route from what exists.

## Two things that were wrong before anything could be judged

**1. `chromakey` is the wrong filter for these clips.** It compares chroma only and ignores luma.
On a near-white background (`0xf4f5f0`) that means it removes *every desaturated pixel in the
frame* — the white shirt, the grey trousers, the pale fur — while saturated orange fur survives.
The first pass produced a fox reduced to a few floating patches of ear. `colorkey` compares full
RGB and is the correct filter for an achromatic background. `tools/chromakey.mjs` now picks by
the sampled colour's saturation and prints which filter it used.

**2. ffmpeg's native VP9 decoder silently drops the alpha layer.** Previews rendered without
`-c:v libvpx-vp9` on the input showed the original background and looked like the key had failed
when it had worked. Chrome — and therefore Remotion — decodes it correctly. If a preview and the
render disagree, suspect the preview.

Also worth knowing: `ffprobe` reports a VP9 alpha WebM's stream as `yuv420p` with a separate
`alpha_mode=1` tag, not as `yuva420p`. `tools/probe-assets.mjs` reads pix_fmt, so it will call a
correctly-keyed output "no-alpha". Check the tag, or check the preview.

## Per clip

| Clip | Background | Filter | Result |
|---|---|---|---|
| `mas3.mp4` 782×720 24fps | `0xdedfda` light grey | colorkey | **Best of the fox clips.** Waving pose, good silhouette. |
| `mas.mp4` / `mas2.mp4` 1280×720 24fps | `0xf4f5f0` near-white | colorkey | Same subject, smaller in frame, standing pose. Same artefacts. |
| `papapa.webm` 512×512 30fps | `0x000000` black | colorkey | **Cleanest key of the set.** Meme cat with a pink outline; the outline is saturated, so it survives cleanly. Not the Axi mascot. |
| `dumdum.webm` 512×512 30fps | `0x000000` black over a chalkboard | colorkey | Not keyable and not a mascot: it is a full-frame graphic — a kitten head over grey formula texture. Keying pure black leaves the entire formula layer behind, correctly, because that layer is not black. Use it as a background element or not at all. |

## The real limitation on the fox clips

The light cream fur is very close in RGB to the light background, and there is H.264 compression
noise around the silhouette. That leaves a narrow and unsatisfying operating window:

| similarity | outcome |
|---|---|
| 0.05 | Subject intact, **ragged white halo** over most of the background |
| 0.12 | Background clean, **holes punched in the light fur** — inner ears, muzzle, brow |
| 0.14+ | Holes get worse; at chroma-based keying the subject disappears entirely |

0.12 / blend 0.02 is the least-bad compromise and is what is checked in. It is visibly imperfect
at 512px and will be more obvious composited at 1080×1920.

**Tuning will not fix this.** There is no threshold that separates cream fur from a light grey
background when they differ by a few RGB values and the encoder has smeared the boundary.

## Recommendation

1. **Re-export the mascot with a real alpha channel.** This is the actual fix. VP9 `yuva420p`
   WebM (`-c:v libvpx-vp9 -pix_fmt yuva420p -auto-alt-ref 0`) or ProRes 4444. If the mascot is
   generated rather than filmed, ask the generator for a transparent background instead of a
   white one — that costs nothing and removes this whole problem.
2. **If a re-export is not available**, shoot or generate against a saturated green or blue
   background, not white or black. Then `chromakey` + `despill` is the right path and the
   operating window is wide.
3. **Meanwhile**, `mas3.webm` at 0.12 is usable for layout work and rough cuts. Keep the mascot
   small in frame; the artefacts are on the fur edges and are much less visible at 400–500px wide
   than at full height.

Two further issues that are independent of keying, and will need answering regardless:

- **Frame rate.** The fox clips are 24 fps against a 30 fps timeline. Remotion will resample;
  a 24→30 pulldown on a looping idle animation tends to judder visibly.
- **Resolution.** 782×720 and 512×512 sources against a 1080×1920 frame. Fine at 400–520px wide,
  soft above that.
