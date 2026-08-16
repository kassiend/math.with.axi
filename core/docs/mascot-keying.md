# Mascot keying — findings

Reproduce with:

```bash
node core/tools/chromakey.mjs
open core/out/logs/chromakey-previews/
```

## Current state: solved, by a proper green screen

`assets/video/mas_chromo.mp4` is a real green-screen render — HEVC, 1920×1080, 10-bit, 24 fps,
5.06 s. Sampled key `0x1b9e35`, saturation 0.83, so the tool selects `chromakey` + `despill`
automatically. **It keys cleanly at the defaults: no holes in the fur, no halo, no green fringe.**
This is what `video/mascot.json` points at.

Everything below is why the earlier clips did not work, kept because the same mistakes are easy
to repeat with the next asset.

## Two things that were wrong before anything could be judged

**1. `chromakey` is the wrong filter for a white or black background.** It compares chroma only
and ignores luma, so on a near-white background it removes *every desaturated pixel in the frame*
— white shirt, grey trousers, pale fur — while saturated patches survive. The first pass on
`mas.mp4` produced a fox reduced to a few floating scraps of ear. `colorkey` compares full RGB and
is correct for an achromatic background. `tools/chromakey.mjs` now picks by the sampled colour's
saturation and prints which filter it used; override with `--mode color|chroma`.

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
| `mas_chromo.mp4` 1920×1080 24fps | `0x1b9e35` green | chromakey + despill | **Clean. In use.** |
| `mas.mp4` / `mas2.mp4` 1280×720 24fps | `0xf4f5f0` near-white | colorkey | Superseded. See the limitation below. |
| `hurry/papapa.webm`, `hurry/witchcat.webm`, `hurry/hurry.webm` 512×512 | `0x000000` black | colorkey | Key cleanly — the subjects have saturated outlines. Meme reaction clips, not Axi. |
| `hurry/dumdum.webm` 512×512 | `0x000000` over a chalkboard | colorkey | Not keyable and not a mascot: a full-frame graphic, a kitten head over grey formula texture. Keying pure black correctly leaves the formula layer behind. Use as a background element or not at all. |

## Why the white-background clips cannot be rescued

The cream fur is within a few RGB values of the light background, and H.264 compression has
smeared the silhouette. That leaves no usable threshold:

| similarity | outcome |
|---|---|
| 0.05 | Subject intact, **ragged white halo** over most of the background |
| 0.12 | Background clean, **holes punched in the light fur** — inner ears, muzzle, brow |
| 0.14+ | Holes get worse; under chroma-based keying the subject disappears entirely |

Tuning does not fix this. `mas_chromo.mp4` is the answer, and the general rule it demonstrates:
**shoot or generate against a saturated green or blue, never white or black.** Then the operating
window is wide and the defaults just work.

## Remaining caveats, independent of keying

- **Frame rate.** 24 fps source against a 30 fps timeline. Remotion resamples; a 24→30 pulldown
  on a looping idle can judder visibly. Prefer a 30 fps export for the next mascot render.
- **Length.** 5.06 s against a 30–60 s lesson. Either loop it or produce longer takes.
