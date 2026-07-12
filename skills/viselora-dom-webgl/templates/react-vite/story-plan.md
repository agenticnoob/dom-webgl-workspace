# Template Story Plan

## Narrative brief

Audience: teams evaluating a DOM-first visual narrative. Core message: semantic
content and managed WebGL can share one page. Desired outcome: replace the demo
with a licensed story while preserving ownership and verification.

## Selected direction and rationale

Layered product reveal. It demonstrates source-preserving image treatment and
shared scroll progress through verified capabilities only.

## Story beats

| Beat id | Message advance | Semantic DOM/fallback | Entrance | Active | Exit | Scroll owner/range | Primary interaction | Mobile | Reduced motion | Capability id/status | Asset ids | Direct assertion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| beat-01 | Establish DOM-first promise | Heading and copy | Normal flow | Read | Scroll | Native page | None | Same | Static | single-runtime-canvas/verified | none | one canvas |
| beat-02 | Show managed enhancement | Figure/image/caption | Section entry | Hover or scroll | Section exit | story.product-progress | Hover with scroll parity | Scroll parity | Copy and source remain | managed-image-hover/verified | product-source | clipped pixels change |
| beat-03 | Explain evidence | Heading and copy | Normal flow | Read | Scroll | Native page | None | Same | Static | resource-fallback-lifecycle/verified | none | fallback survives failure |
| beat-04 | Hand off implementation | Closing copy | Normal flow | Read | Page end | Native page | None | Same | Static | reduced-motion-signaling/verified | none | content continuity |

## Browser evidence

Collect one-canvas/remount, hover pixels, slow/fast/reverse scroll,
loading/network fallback, mobile overflow, and reduced-motion continuity in the
real consumer project. This tracked template has only static verifier,
typecheck, and production-build evidence.

If an experimental capability is added, run its minimal public-npm browser
preflight before full implementation and record the evidence JSON in the
capability manifest. Keep opaque backgrounds on the runtime ancestor and the
Canvas-overlying content stage transparent.
