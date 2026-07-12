# Capability Status

Compatible package version: 0.1.0-alpha.0

This matrix is authoritative for recommendations made by this skill. API
presence alone does not upgrade a capability's evidence status.

## Contents

- [Status meanings](#status-meanings)
- [Version matrix](#version-matrix)
- [Blocked reproductions](#blocked-reproductions)

## Status meanings

- `verified`: an external npm consumer completed the required direct evidence.
- `experimental`: the public API exists, but the external browser matrix is
  incomplete for this version.
- `blocked`: a retained public-boundary reproduction indicates unusable visible
  output or a package defect candidate for the documented path.

## Version matrix

| Capability id | Status | Required evidence | Consumer guidance |
| --- | --- | --- | --- |
| public-imports-ssr | verified | Browser and SSR imports from all selected public entrypoints | Use published entrypoints only. |
| single-runtime-canvas | verified | Exactly one canvas while mounted | Keep one page-level runtime owner. |
| runtime-remount | verified | Canvas count `1 -> 0 -> 1` and released resources | Dispose through the owning React/runtime lifecycle. |
| managed-image-hover | verified | `sourceTextureUniform`, `replace-source`, source sampling, managed pointer, final-canvas pixel change, touch or scroll alternative, loading/error fallback | Preserve the source image in the shader and keep input runtime-owned. |
| managed-video | verified | Playback, autoplay rejection, network fallback, and offscreen re-entry | Keep a local poster and semantic video fallback. |
| shared-scroll-progress | verified | Slow, fast, forward, and reverse progress through one source | Share one stable progress key and ScrollTrigger ownership path. |
| resource-fallback-lifecycle | verified | Loading/error fallback, offscreen re-entry, and cleanup | Never hide fallback while loading or after error. |
| glb-loading-lifecycle | verified | Local GLB reaches ready/active, fails safely, and re-enters offscreen | This proves loading/lifecycle only, not final model pixels. |
| reduced-motion-signaling | verified | Content continuity and no required animation | Freeze, shorten, or replace motion without removing meaning. |
| image-sequence | experimental | Final-canvas pixels, first-frame fallback, bounded cache, forward/reverse scroll | Require explicit experimental acknowledgement until external verification completes. |
| scene-camera-pass | experimental | Managed declarations and clipped final-canvas pixels | Use public descriptors and collect browser evidence. |
| scene-native-models | experimental | Model ready plus scene-model final-canvas pixels | Keep a poster/text fallback in the story even when the scene object has no DOM fallback. |
| scene-object-effect-registration | blocked | Root-defined effect attaches through the React entrypoint, `ready + attached`, clean errors, final pixels | `0.1.0-alpha.0` is blocked by cross-entrypoint classification. Local `0.1.0-alpha.1` tarballs are verified for registration by the packed-browser gate; registry publication is still pending. |
| scene-object-interaction | experimental | Managed picking, pointer/touch alternative, final-canvas pixels | Keep controls accessible in DOM. |
| camera-gestures | experimental | Managed controller, mobile alternative, camera persistence after release | Avoid duplicate wheel/touch ownership. |
| physics | experimental | Managed descriptors, direct drag/release inertia, fallback without physics | Do not claim solver behavior beyond collected evidence. |
| advanced-effect-facades | experimental | Public facade only, effect resource disposal, final-canvas pixels | Do not use raw Three.js escape hatches. |
| surface-pulse-visible-output | blocked | Retained effect-surface versus final-canvas pixel threshold reproduction | Use DOM/CSS or a verified media path in normal projects. |
| dom-anchored-glb-visible-output | blocked | Retained ready/active GLB versus final-canvas pixel threshold reproduction | Keep fallback visible; do not add private camera/renderer workarounds. |

`glb-loading-lifecycle` being verified does not upgrade
`dom-anchored-glb-visible-output`. `managed-image-hover` is verified only for
the explicit source-sampling `replace-source` path.

The exact `0.1.0-alpha.0` registration defect is
`Effect "<kind>" is not a scene-object effect.` when root and React bundles own
different classification registries. Registration recovery does not upgrade
`scene-object-interaction` or `advanced-effect-facades`; those remain
experimental and need their own browser preflights.

## Blocked reproductions

Blocked ids may be selected only with top-level mode
`retained-defect-reproduction` and acknowledgement
`blocked-defect-reproduction`. A reproduction must use public npm imports,
retain semantic fallback, record ready/active state where relevant, and compare
clipped final-canvas pixels against a declared threshold. It must not introduce
private imports, raw Three.js ownership, R3F, a second canvas, or a consumer
render loop.
