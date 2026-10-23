# One-take benchmark

`bench.html` is a six-chapter scroll page whose camera flies down one rail. It
measures what a performance-unaware page costs, so runtime scheduling work
(sections, warmup, adaptive quality) can be compared against the same page.

Every chapter is written the way such a page usually is: it fades with opacity
or scale, keeps animating, keeps uploading and stays drawable for the whole
page. Chapters ahead of the camera are inside the frustum and are drawn;
chapters behind it are culled by Three.js.

| Chapter | Load |
| --- | --- |
| `model` | Sprint.glb set (259 meshes, all clips), a walking character, a transmission sphere |
| `particles` | 100k points with three simplex-noise lookups per vertex, additive blending, no frustum culling |
| `text` | `createDOMTextTexture` title on a 160×40 wave plane |
| `sequence` | 114 frames of 1600×900 WebP, re-uploaded every frame |
| `cards` | 12 textured standard-material cards, one 2560×1440 video |
| `raymarch` | full-screen 96-step raymarch with 4-octave noise, drawn even at zero intensity |

## Laptop run

```bash
npm run build
node scripts/bench-one-take.mjs --serve --gpu low-power
```

Options:

- `--gpu low-power | high-performance | default` sets the WebGL power
  preference. On a dual-GPU Mac, `low-power` selects the integrated GPU; the
  result's `renderer` field confirms which one ran.
- `--throttle 4` applies Chromium CPU throttling as a rough phone proxy.
- `--max-dpr 1` caps the canvas pixel ratio (default 2).
- `--duration`, `--width`, `--height`, `--scale` (device scale factor) and
  `--label` describe the run; `--headless` uses SwiftShader and only checks
  that the page runs.

The script installs `playwright-core` into `output/bench-tools/` when it is not
resolvable, scrolls the page at constant speed in a visible Chrome window, and
writes a JSON report to `output/bench/`. Keep the window in front while it runs.

## Phone run

1. Put the phone and the computer on the same Wi-Fi network.
2. Build and serve on the network:

   ```bash
   npm run build
   npm run preview -w @viselora/example -- --host 0.0.0.0 --port 4173
   ```

3. Find the computer's address (`ipconfig getifaddr en0` on macOS) and open
   `http://<address>:4173/bench.html` on the phone. Allow the incoming
   connection if the firewall asks.
4. Wait until the panel shows `就绪`, tap `开始测试`, and keep the screen on for
   60 seconds without touching it.
5. Screenshot the result table, or open `完整结果（JSON）` and copy the text.

URL parameters mirror the script: `?maxDpr=1`, `?gpu=low-power`,
`?duration=30`, and `?autoplay=1` (start automatically once ready).

## Reading results

Per chapter and overall: `fps`, frame-time `p50`/`p95`/`max`, frames slower
than 50 ms, shader programs and GPU textures created during the chapter, the
largest draw-call count, and Long Tasks over 50 ms. Renderer counters come
from `gl.info` of the previous frame.

## Baseline (2026-10-22, 0.2.0-alpha.2, unmanaged page)

MacBook Pro 16-inch 2019 (`MacBookPro16,1`), Chrome 155, 1440×900 viewport,
device scale 2, 60 s.

| GPU | Canvas DPR | CPU | Overall fps | p95 ms | Frames > 50 ms | Long Tasks |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Intel UHD 630 | 2 | 1× | 5.3 | 373.4 | 229 | 129 |
| Intel UHD 630 | 2 | 4× | 5.1 | 328.3 | 300 | 210 |
| Intel UHD 630 | 1 | 1× | 19.4 | 83.0 | 451 | 97 |
| Radeon Pro 5300M | 2 | 1× | 29.6 | 42.8 | 0 | 0 |

Huawei P30 (Mali-G76, Huawei Browser 17 on Chromium 132), 360×634 viewport,
device ratio 3, canvas DPR 2 (0.9 MP), 60 s, 2026-10-23:

| Chapter | fps | p95 ms | Draw calls |
| --- | ---: | ---: | ---: |
| overall | 25.0 | 60.4 | 551 |
| model | 18.0 | 61.6 | 551 |
| particles | 19.2 | 61.8 | 33 |
| text | 22.4 | 47.5 | 16 |
| sequence | 18.7 | 62.5 | 16 |
| cards | 29.5 | 61.6 | 15 |
| raymarch | 42.0 | 39.1 | 2 |

The phone draws about a sixth of the laptop's pixels, so the full-screen
raymarch is its fastest chapter, while the many-draw-call model, the
per-frame sequence uploads and the particle field are its slowest; 426 Long
Tasks point at the main thread rather than fill rate.

Per chapter on the UHD 630 at DPR 1, the fastest chapter (`raymarch`) reached
21.3 fps and the slowest (`model`) 16.2 fps. No shader program was compiled
during scrolling because every chapter mounts and compiles at load.

## Sections variant (2026-10-22, unreleased source)

`--variant sections` (or `?variant=sections`) wraps each chapter in a
`WebGLSection` over its progress range and changes nothing else. Only the
first chapter must load before a run; later chapters mount on approach.

| GPU | Canvas DPR | Unmanaged fps / p95 ms | Sections fps / p95 ms |
| --- | ---: | ---: | ---: |
| Intel UHD 630 | 2 | 5.3 / 373.4 | 35.1 / 53.0 |
| Intel UHD 630 | 1 | 19.4 / 83.0 | 42.2 / 52.4 |
| Radeon Pro 5300M | 2 | 29.6 / 42.8 | 47.3 / 40.2 |

Remaining costs: the raymarch chapter alone still runs at 5.3 fps on the
UHD 630 at DPR 2 (adaptive quality is not implemented); five shader programs
and seven textures are created while scrolling, with single frames up to
300–700 ms on chapter entry (warmup is not implemented); and the sequence
chapter's own per-frame re-upload holds it near 20 fps.

## Sections with warmup (2026-10-22, unreleased source)

Warm sections compile new materials with `compileAsync`, decode image elements
off the main thread and upload at most two textures per frame. `stallFrames`
counts frames over 50 ms that also created a program or texture.

| GPU | Canvas DPR | fps | p95 ms | Frames > 50 ms | Long Tasks | Stall frames |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Intel UHD 630 | 2 | 36.8 (35.1) | 43.5 (53.0) | 67 (208) | 4 (127) | 2 |
| Intel UHD 630 | 1 | 43.8 (42.2) | 51.9 (52.4) | 179 (251) | 3 (61) | 2 |
| Radeon Pro 5300M | 2 | 48.0 (47.3) | 43.4 (40.2) | 12 (9) | 9 (7) | 2 |

Values in parentheses are the sections variant without warmup. The UHD 630
frame-time count at DPR 1 is dominated by the raymarch chapter.

WebGL call timing located both remaining stall frames in application loading,
not in warmup:

- drei `useTexture` calls `gl.initTexture` for every texture when its effects
  connect, so the four card images (up to 1920×1920) uploaded in one frame:
  282 ms of `texSubImage2D` on the UHD 630.
- Uploading a 1600×900 `HTMLImageElement` costs about 40 ms on the UHD 630;
  the sequence chapter re-uploads one every frame.

## Managed variant: sections, warmup and adaptive quality (2026-10-22)

`--variant managed` uses the runtime's default adaptive quality; the other
variants pass `quality={false}` and keep the fixed canvas DPR. The canvas
maximum is `--max-dpr` (2); budgets give DPR 1.76 / 1.24 / 0.88 at 1440×900.

| GPU | CPU | Fixed DPR 2 fps (sections) | Managed fps | Raymarch chapter fps (fixed → managed) | Final tier |
| --- | ---: | ---: | ---: | ---: | --- |
| Intel UHD 630 | 1× | 36.8 | 42.2 | 5.5 → 18.2 | low |
| Radeon Pro 5300M | 1× | 48.0 | 50.2 | 43.1 → 53.8 | high |
| Intel UHD 630 | 4× | — | 37.4 | — → 21.5 | low |

On the 5300M the sequence chapter (slow from its own uploads) triggered two
downgrades; both were undone because fewer pixels did not shorten frames. On
the UHD 630 the light middle chapters returned the tier to `high`, so the
raymarch chapter spent about three seconds at `high` before dropping to `low`;
at `low` it runs at about 24 fps, so the chapter itself must scale its steps by
tier to reach 30 fps. With 4× CPU throttling the sequence chapter falls to
6 fps from its per-frame uploads.

## Diagnostics check (2026-10-22, unreleased source)

`--diagnostics` turns on the runtime's development warnings in the production
build and the script prints every `[viselora]` console warning. `--fixture`
makes the text chapter hide its DOM title once ready and adds a copy of the
title over the DOM box: `ready-with-pixels` draws it, `ready-without-pixels`
never does. Managed variant, UHD 630, 40 s:

| Fixture | Warnings |
| --- | --- |
| `ready-with-pixels` | over budget (Sprint set: 535 calls, 1.06 M triangles) |
| `ready-without-pixels` | over budget; `bench-title` hides its DOM with nothing drawn |

An earlier version passed a target as soon as any pixel appeared in its box,
which the previous chapter's particles satisfied; the check now samples every
10 frames for as long as the fallback stays hidden. Frames below 30 fps at
`low` were reported in one of three runs, from the raymarch chapter.

## Showcase (2026-10-23, unreleased source)

`showcase.html` is the [five recipes](../src/showcase/README.md) composed into
one page with the runtime's defaults (sections, warmup, adaptive quality).
`--page showcase.html`, 60 s, 1440×900, device scale 2:

| GPU | CPU | fps | p95 ms | Frames > 50 ms | Stall frames | Final tier |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Intel UHD 630 | 1× | 58.1 | 18.7 | 11 | 6 | low |
| Radeon Pro 5300M | 1× | 59.4 | 18.2 | 8 | 6 | high |
| Intel UHD 630 | 4× | 58.0 | 19.9 | 15 | 7 | low |

Every chapter stays above 56 fps. The stall frames (up to 160 ms) fall in the
particle chapter while the eagerly mounted gallery uploads its 16 textures,
two per frame; a per-frame upload budget by size rather than count would
spread them further. On the UHD 630 those stalls also move the quality tier
up and down several times. In development, scrolling the page produced no
runtime warnings.

## Huawei P30 (2026-10-23, unreleased source)

Same phone and browser as the baseline, 60 s per run, DPR 2 (0.9 MP). The
bench page per variant:

| Chapter | Unmanaged fps | Sections fps / p95 ms | Managed fps / p95 ms |
| --- | ---: | ---: | ---: |
| overall | 25.0 | 47.7 / 42.7 | 47.5 / 43.9 |
| model | 18.0 | 59.2 / 18.8 | 59.4 / 17.6 |
| particles | 19.2 | 59.9 / 18.1 | 60.0 / 20.7 |
| text | 22.4 | 52.9 / 39.6 | 52.7 / 40.8 |
| sequence | 18.7 | 22.7 / 60.2 | 22.0 / 62.9 |
| cards | 29.5 | 47.6 / 44.4 | 47.4 / 45.5 |
| raymarch | 42.0 | 43.8 / 39.1 | 43.3 / 43.1 |

Long Tasks fell from 426 to 27 (sections) and 45 (managed). Sections remove
the cost of hidden chapters, which was most of the phone's frame: the
draw-call-heavy model chapter alone reached 59 fps once nothing else ran.

Managed equals sections here because adaptive quality has nothing to scale:
the 360×634 viewport is 0.23 MP, so every tier's budget (4 / 2 / 1 MP) allows
more than the canvas maximum of DPR 2 and the DPR never changed. The governor
still stepped down six times (to `low` twice, in the sequence and cards
chapters) and undid each step after it brought no improvement; each step only
cost frames. The sequence chapter stays below 30 fps from its own per-frame
1600×900 uploads, which no tier changes.

`/showcase.html?bench=1` on the phone (the five recipes with runtime
defaults):

| Chapter | fps | p95 ms |
| --- | ---: | ---: |
| overall | 58.0 | 23.5 |
| intro | 59.9 | 19.6 |
| form | 58.8 | 23.6 |
| gallery | 58.2 | 20.4 |
| product | 56.3 | 27.1 |
| outro | 60.0 | 17.9 |

The phone started at `medium`, rose to `high` after the startup grace and
stepped down twice (form, product), undoing both; final tier `high`. Three
stall frames fell in the form chapter while the gallery uploaded.

## Sequence uploads (2026-10-23)

`--sequence` (or `?sequence=`) changes only how the sequence chapter uploads
its 114 frames (1600×900 WebP). Sections variant, UHD 630, 4× CPU, 60 s:

| Mode | Sequence fps | p95 ms | Frames > 50 ms | Long Tasks | Overall fps |
| --- | ---: | ---: | ---: | ---: | ---: |
| `every-frame`: `HTMLImageElement`, `needsUpdate` each frame | 5.2 | 267.2 | 52 | 53 | 31.7 |
| `on-change`: same, only when the frame index changes | 5.4 | 276.3 | 52 | 52 | 35.0 |
| `bitmap`: `createImageBitmap(blob, { imageOrientation: "flipY" })`, `flipY = false` | 51.7 | 31.6 | 5 | 2 | 40.0 |
| `bitmap-half`: the same, decoded at 800×450 | 54.4 | 18.7 | 4 | 1 | 39.4 |

While scrolling the index changes almost every frame, so skipping unchanged
frames barely helps: each `HTMLImageElement` upload costs about 170 ms here.
The same frames as pre-flipped `ImageBitmap`s upload within the frame
budget. The run does not isolate whether the element's decode or the flip
on upload is the cost. Decoded bitmaps hold their pixels: 114 full frames are
about 660 MB, half-size frames about 160 MB.

Limits: one run per row; Chromium CPU throttling does not model a phone GPU;
the dual-GPU laptop and its display settings affect results.
