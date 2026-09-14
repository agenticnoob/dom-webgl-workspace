# Example verification

This document owns the example app's verification evidence and limitations.
Use the [component catalog](../src/recipes/README.md) for integration contracts
and [repository status](../../../docs/STATUS.md) for release and package truth.

## Automated checks

Verified on 2026-09-14: 21 recipe test files / 97 tests and the App integration
test passed. The complete repository passed 197 files / 1292 tests. Example
and root typechecking, workspace production builds, public import,
documentation and package-version checks passed.

Coverage includes geometry and reversible progress, scoped registration,
fallback semantics, stable declarations, cleanup, simultaneous instances and
one shared runtime. A regression test checks pointer offsets when the scrolling
host is far above the viewport; offsets remain relative to the fixed canvas.

From the repository root:

```bash
npm test -- --run apps/example/test/App.test.tsx apps/example/test/recipes
npm run typecheck -w @viselora/example
npm run build -w @viselora/example
npm run check:imports
npm run check:docs
```

## Browser evidence

Chromium review on 2026-09-13 at 1440×900 and emulated touch 390×844 covered:

- paper arrivals, overflow reading and live reduced-motion fallback;
- room wall selection, keyboard controls and narrow/touch lists;
- sculpture motion/light and real-mesh mouse/touch hold commits;
- model output, scroll turn, captions and text layout;
- all four portal faces and forward/reverse DOM handoffs;
- relief expansion and return, complete-text mode and pointer previews.

The initial `/` composition was reviewed with all eight original rows together,
one runtime and one canvas. Checks included adjacent portal clipping, isolated
reading/theme controls, model output and narrow layouts without horizontal
overflow. Final canvas images were inspected; readiness alone was not used as
visual evidence.

On 2026-09-14, the standalone Hero Next final journal was inspected and extracted
as the ninth inline row, `PerspectiveTimeline`. Desktop Chromium at 1440×900
covered paired text projection, forward/reverse scrolling, continuous mesh spin,
the keyboard reading toggle and return. Live reduced motion and emulated touch
390×844 rendered all six complete demo entries with no timeline text targets or
horizontal overflow. All nine rows shared one canvas; leaving the timeline removed
its text targets, and returning restored them. Desktop and mobile screenshots
were inspected without captured page/console errors in the final sampled states.
New tests cover 40-entry window selection in both directions,
multiline content spacing, frame-rate-independent thrust and scoped disposal.
The new module's React Doctor scan reported no issues; no remote score was used.

## Limits

- Mobile evidence is browser emulation, not physical-device verification.
- The example build retains its existing bundle-size warning.
- The original eight recipes' React Doctor scan reported no errors and four
  warnings: paragraph index keys for mount-stable content and three callback-effect heuristics for the scheme
  notification. Stable-content contracts and callback lifecycle tests cover
  those choices. The remote score service was unavailable; no score is claimed.
- The recipes use native document scroll. Transformed scroll systems or nested
  scrollers require their own integration and browser verification.
- These results cover the example assets and content. Other GLBs, text lengths,
  languages, GPU limits and downstream compositions need consumer verification.
