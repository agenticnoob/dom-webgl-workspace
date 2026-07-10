---
name: viselora-dom-webgl
description: Build, review, or repair React DOM-first WebGL pages with the public Viselora packages. Use for single-runtime pages that bind WebGL rendering to DOM targets, author managed effects, add shared scroll timelines or pointer hover, render video, images, image sequences, or GLB models, choose fallback lifecycle behavior, and verify consumer architecture.
---

# Viselora DOM WebGL

Compatible package version: 0.1.0-alpha.0

## Workflow

1. Decide fit. Use Viselora when DOM remains the layout, accessibility, and fallback source of truth while one runtime renders managed WebGL targets. Choose another stack for a free-form R3F scene or a second independently owned canvas.
2. Install the exact alpha and the verifier's TypeScript parser dependency. Follow [quickstart.md](references/quickstart.md).
3. Create exactly one `WebGLScrollRuntime` or `WebGLRuntime` root.
4. Define effect definitions and the `runtimeEffects` array at module scope. Keep both references stable.
5. Declare DOM-first targets with public React components. Give every target an explicit fallback, lifecycle, and offscreen policy.
6. Add one shared scroll/pointer pipeline. Use the scroll adapter timeline and target `pointer` declarations; do not add component-owned listeners.
7. Select `restore-dom` for releasable resources or `park` for warm media/model state. Never hide fallback content during loading or error.
8. Run the consumer verifier, typecheck, and production build. Follow [verification.md](references/verification.md).

## Load only what the task needs

- Read [public-api.md](references/public-api.md) before choosing symbols or declarations.
- Read [architecture-rules.md](references/architecture-rules.md) before changing runtime, canvas, input, resource, or fallback ownership.
- Read [effect-recipes.md](references/effect-recipes.md) and copy from `templates/effects/` for the five supported recipes.
- Read [troubleshooting.md](references/troubleshooting.md) after a verifier, typecheck, loading, or rendering failure.
- Copy `templates/react-vite/` when starting a React/Vite consumer.

## Hard boundaries

Do not add R3F, `<Canvas>`, `new WebGLRenderer(...)`, a second runtime/canvas, repository source-path imports, unstable effect arrays, per-component scroll/pointer listeners, or loading/error behavior that hides the DOM fallback.
