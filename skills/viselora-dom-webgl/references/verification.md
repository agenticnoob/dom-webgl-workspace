# Verification

Compatible package version: 0.1.0-alpha.0

## Skill integrity

Maintainers validate frontmatter/links, build both packages, check generated
`.d.ts` drift, public value/type/status coverage, run skill tests, verify the
selected template, and typecheck/build a clean temporary template copy.

## Selected consumer checks

From the consumer root:

```bash
node /absolute/path/to/viselora-dom-webgl/scripts/verify-consumer.mjs .
npm run typecheck
npm run build
```

The static verifier checks versions, public imports, one runtime/canvas owner,
stable declarations, input ownership, selected assets/status/acknowledgements
and required evidence names. Static success does not prove real-browser output.
Template typecheck/build proves skill/template self-consistency only.

## Real-browser evidence

For every selected dynamic beat, assert final-canvas pixel change or a direct
behavioral result. Test exactly one canvas, unmount/remount `1 -> 0 -> 1`, slow/
fast/forward/reverse scroll, pointer plus touch alternative, loading/network
fallback, video autoplay rejection when selected, offscreen re-entry, clean
console, desktop/mobile overflow and reduced-motion continuity.

Callbacks, debug ready/active state, effect-owned pixels and build success are
not substitutes for final-canvas evidence.

## Narrative review

Review the full desktop, mobile and reduced-motion story. Confirm every beat
advances the message, pacing and text remain legible, interactions are clear,
semantic content/navigation survives without WebGL, and every production asset
is local with deployment-compatible licensing.

Do not claim a consumer browser or narrative pass until those observations are
recorded in the independent consumer project.
