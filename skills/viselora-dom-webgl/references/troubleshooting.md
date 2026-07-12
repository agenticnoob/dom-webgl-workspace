# Troubleshooting

Compatible package version: 0.1.0-alpha.1

Classify the failure before changing architecture.

## API/type failures

Check exact package versions, four public entrypoints, generated API index,
peer dependencies, TypeScript strictness, `skipLibCheck: false`, and
`@types/react >=19.2.0`. Never substitute package source/private imports.

## Asset failures

Check local URL, deployment path, format/decoder, browser decoding, GLB loader
config, sequence frame metadata, video poster, semantic fallback and manifest
license fields. Production `localPath` must not be a hotlink.

## Lifecycle failures

Distinguish resource `loading|ready|error` from lifecycle
`inactive|active|parked`. Check fallback hiding, `hideMode`, offscreen strategy,
re-entry and disposal. Use the narrow selector in
[api-lifecycle-debug.md](api-lifecycle-debug.md); do not store the full
frame-frequency debug object in React state.

The exact `Effect "<kind>" is not a scene-object effect.` error means a
scene-object definition failed registration/classification. In model debug,
`ready != attached`: decoded GLB data can be `ready` while effect assembly
failed before controller attachment. Require `attached: true`, no `error`, and
final Canvas pixels before claiming success.

## Visible-output failures

Changing callbacks, uniforms, effect-owned canvas pixels or ready/active state
does not prove final output. Check source sampling, viewport/scissor, placement,
camera/light ownership and clipped final-canvas pixels. Image hover must sample
`sourceTextureUniform` through `replace-source`.

## Package-defect candidates

When public declarations are correct, assets decode, lifecycle is active, the
console is clean and the intended clipped pixels remain unchanged, keep
fallback visible and create a minimal public-boundary reproduction. Record exact
npm versions, public imports, asset provenance, debug selector output and pixel
threshold. Do not add R3F, raw renderer/camera/loader/material ownership, a
second canvas, private imports or a consumer render loop.

For `0.1.0-alpha.1`, surface pulse visible output and default DOM-anchored GLB
visible output are blocked defect candidates. GLB loading/lifecycle being
verified does not make final model pixels verified.
