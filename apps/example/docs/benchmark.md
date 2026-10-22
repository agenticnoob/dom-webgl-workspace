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

Limits: one run per row; Chromium CPU throttling does not model a phone GPU;
the dual-GPU laptop and its display settings affect results; the phone row is
not yet measured.
