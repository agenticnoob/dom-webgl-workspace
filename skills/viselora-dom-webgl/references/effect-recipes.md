# Native visual recipes

Copy a runnable recipe before writing a pattern from scratch. Each file
typechecks against the [template](../templates/react-vite/), uses only public
entrypoints and ends with a usage example.

| Recipe | Covers |
| --- | --- |
| [ModelTarget.tsx](../recipes/ModelTarget.tsx) | GLB loaded after mount, fit to a target's rect in a pixel-space orthographic camera, readiness against the captured target, load error keeps the fallback, owned geometry/material/texture disposal |
| [ScrollStory.tsx](../recipes/ScrollStory.tsx) | Story section progress from its live target rect, piecewise keyframes, no clock or damping, `frameloop: "demand"` |
| [TextWave.tsx](../recipes/TextWave.tsx) | `createDOMTextTexture` aligned with the DOM baseline, rebuild on polled `target.revision`, deferred disposal, vertex wave, reduced motion |

Adapting them:

- Several models: give every instance its own loaded or cloned Object3D. Do not
  dispose geometry/materials that another instance or a loader cache shares.
- GLB animation: create an `AnimationMixer` for the owned instance and advance it
  with `useFrame` delta (seconds); Drei `useGLTF`/`useAnimations` is fine when
  the consumer already depends on Drei.
- Scroll stories under `WebGLScrollRuntime` with ScrollTrigger sections: replace
  `sectionProgress` with `runtime.progress.get(progressKey)`; keep the mapping pure.
- Per-glyph text effects (scramble, pressure): build commands from
  `measureDOMText(...).glyphs` and draw them with `drawDOMText`, which places
  each glyph on its CSS baseline; set `texture.needsUpdate = true` after redraws.
- Images/video: native textures, DOM fallback until the texture has loaded.

Keep application visual math and shaders in the consumer. Avoid wrapping every
native object in a new generic facade or recovering retired 0.1.x declarations.
