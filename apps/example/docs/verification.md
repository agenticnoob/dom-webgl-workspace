# Example verification

This document owns the example app's verification evidence and limitations.
Use the [component catalog](../src/recipes/README.md) for integration contracts
and [repository status](../../../docs/STATUS.md) for release and package truth.

## Automated checks

Verified on 2026-09-14: 17 recipe test files / 81 tests and the App integration
test passed. The complete repository passed 193 files / 1276 tests. Example
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

The final `/` composition was reviewed with all eight rows mounted together,
one runtime and one canvas. Checks included adjacent portal clipping, isolated
reading/theme controls, model output and narrow layouts without horizontal
overflow. Final canvas images were inspected; readiness alone was not used as
visual evidence.

## Limits

- Mobile evidence is browser emulation, not physical-device verification.
- The example build retains its existing bundle-size warning.
- React Doctor reported no errors and four warnings: paragraph index keys for
  mount-stable content and three callback-effect heuristics for the scheme
  notification. Stable-content contracts and callback lifecycle tests cover
  those choices. The remote score service was unavailable; no score is claimed.
- The recipes use native document scroll. Transformed scroll systems or nested
  scrollers require their own integration and browser verification.
- These results cover the example assets and content. Other GLBs, text lengths,
  languages, GPU limits and downstream compositions need consumer verification.
