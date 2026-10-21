---
name: viselora-dom-webgl
description: Build, migrate or debug React 19 / Next.js pages that sync semantic DOM with one React Three Fiber (R3F) + Three.js WebGL scene using the @viselora/dom-webgl and @viselora/scroll-adapters packages. Use when adding WebGL/3D visuals that follow DOM elements, DOM text rendered as textures, scroll-driven 3D progress (Lenis, GSAP ScrollTrigger), DOM fallback while models load, or when code imports @viselora/*.
license: MIT
metadata:
  author: agenticnoob
  repository: https://github.com/agenticnoob/dom-webgl-workspace
---

# Viselora React/R3F Development

Compatible package version: 0.2.0-alpha.2

This skill targets the breaking React/R3F 0.2 alpha API. Install matching package
versions from the `alpha` channel or use reviewed local tarballs. The 0.1.x
packages implement a different API. Check the repository
[release status](https://github.com/agenticnoob/dom-webgl-workspace/blob/main/docs/STATUS.md#release-truth) for registry confirmation.

`<skill-dir>` below is the directory containing this file (for example
`.claude/skills/viselora-dom-webgl` or `.agents/skills/viselora-dom-webgl`).

## Rules that are easy to get wrong

1. **Pin Viselora exactly, without `^` or `~`.** `package.json` must say
   `"@viselora/dom-webgl": "0.2.0-alpha.2"` (and the same for
   `@viselora/scroll-adapters` if used). `npm install` writes a caret by
   default, so use `--save-exact`:
   `npm install --save-exact @viselora/dom-webgl@0.2.0-alpha.2`.
   React 19, R3F 9 and Three.js 0.184–0.186 may use normal ranges.
2. **Run the static verifier before finishing:**
   `node <skill-dir>/scripts/verify-consumer.mjs <project-root>`. It rejects
   caret pins, private Viselora imports, a second Canvas/WebGLRenderer/R3F
   root and unsupported React/R3F/Three versions.
3. **`target.rect`, `target.visible` and `target.revision` are mutable fields.**
   They update before every frame and do not re-render React. Read them inside
   `useFrame`. To rebuild a texture when `revision` changes, poll it in
   `useFrame` and copy it into state; reading it during render leaves a stale,
   stretched texture after resize or font loading.
4. **Report readiness only for a visual that exists**, with the captured target:
   `runtime.setTargetReady(id, true, target)` after the model/texture is
   created, `false` in the effect cleanup, never on a load error. Wrap the
   fallback in `<WebGLTarget id hideWhenReady>` so the DOM stays visible while
   loading, on failure and without WebGL.
5. **Use 0.2.0-alpha.1 or later for DOM text.** `createDOMTextTexture` and
   `drawDOMText` place glyphs on the CSS baseline, including half-leading,
   since 0.2.0-alpha.1. 0.2.0-alpha.0 drew text about half the leading too high
   (11px at 72px with `line-height: normal`); upgrade rather than compensate.
6. **SSR-safe render.** No `window`, `document`, `matchMedia`, loaders or
   textures in render bodies, `useState` initializers or module scope; create
   them in `useEffect`. Public Viselora imports are SSR-safe.
7. **Update shader uniforms through the material ref.** Recent R3F 9 releases copy the
   values of a `uniforms` prop into the material's own uniform objects, so
   mutating your memoized object does nothing; write
   `materialRef.current.uniforms.uTime.value` in `useFrame`.
8. **Scroll-driven state is a pure function of progress**: no clock, no
   accumulated deltas, no damping, so reverse scroll and resize restore the same
   frame. Time-based animation (idle spin, waves) uses `useFrame` delta in
   seconds and the default `frameloop: "always"`, and stops under
   `prefers-reduced-motion: reduce` (read `matchMedia` in an effect).
9. **Pixel-space placement**: with `canvas={{ orthographic: true, camera:
   { position: [0, 0, 1000], far: 4000 } }}` one world unit is one CSS pixel
   and the centre of a target is
   `x = left + width / 2 - size.width / 2`, `y = size.height / 2 - top - height / 2`.

## Recipes: copy, then adapt

Each file typechecks against the template and contains a usage example.
Copy it into the consumer's `src/` instead of rewriting the pattern.

| Pattern | Recipe |
| --- | --- |
| GLB model that follows a DOM card, fallback while loading, load error keeps fallback, owned disposal | [recipes/ModelTarget.tsx](recipes/ModelTarget.tsx) |
| Scroll progress of a story section mapped to deterministic keyframes (reverse scroll and resize safe) | [recipes/ScrollStory.tsx](recipes/ScrollStory.tsx) |
| DOM text texture with a wave shader, rebuilt on `target.revision`, aligned with the DOM baseline | [recipes/TextWave.tsx](recipes/TextWave.tsx) |

## Workflow

1. Read the consumer's actual scene, DOM and assets before changing ownership.
   Preserve its visual behavior, semantics and existing authorization scope.
2. Keep one `WebGLRuntime`/`WebGLScrollRuntime` host. Put ordinary R3F components
   in `scene`, semantic HTML in `children`, and use public Viselora entrypoints.
3. Use `WebGLTarget` and `useDOMTarget` for measured DOM anchors. Use native
   Three.js refs, materials, loaders and R3F hooks for visual behavior.
4. Keep fallback paint until the replacement visual is ready. Scope async
   readiness to the captured target. Choose resource retention explicitly.
5. Verify focused behavior, types and builds, then compare actual browser
   pixels, forward/reverse scroll, resize, input and remount behavior.

## Verify

```bash
node <skill-dir>/scripts/verify-consumer.mjs .
npx tsc --noEmit
npm run build
```

Then check real pixels, following, determinism and fallback paths in a browser.
`browser-check.mjs` needs the `playwright-core` driver in the project, which a
fresh app does not have; install it first, then start the dev server
(`npm run dev`) and leave it running:

```bash
npm install --save-dev playwright-core
node <skill-dir>/scripts/browser-check.mjs http://localhost:5173 --follow "#card-model" --fallback "#card-model" --block "**/*.glb"
node <skill-dir>/scripts/browser-check.mjs http://localhost:5173 --deterministic --fallback main
```

Unmount/remount cleanup still needs a test of the consumer component.

## Load only what the task needs

| Need | Reference |
| --- | --- |
| Start a consumer or use the runnable template | [quickstart.md](references/quickstart.md) |
| API navigation | [public-api.md](references/public-api.md) |
| Native effects and DOM text | [api-effects-rendering.md](references/api-effects-rendering.md) |
| Native scene and model ownership | [api-scenes-models.md](references/api-scenes-models.md) |
| Scroll progress and interaction | [api-scroll-interaction.md](references/api-scroll-interaction.md) |
| Fallback, SSR and cleanup | [api-lifecycle-debug.md](references/api-lifecycle-debug.md) |
| Ownership constraints | [architecture-rules.md](references/architecture-rules.md) |
| Optional narrative planning | [narrative-design.md](references/narrative-design.md) |
| Asset provenance | [asset-pipeline.md](references/asset-pipeline.md) |
| Native visual recipes | [effect-recipes.md](references/effect-recipes.md) |
| Failures | [troubleshooting.md](references/troubleshooting.md) |
| Verification scope | [verification.md](references/verification.md) |
| Automated capability evidence | [capability-status.md](references/capability-status.md) |
| Exhaustive exports | [api-surface.generated.md](references/api-surface.generated.md) |

## Boundaries

- React 19, R3F 9 and Three.js 0.184–0.186 are the supported stack.
- Native Three.js ownership and R3F JSX/hooks are the normal visual API.
- Do not add a second Canvas/WebGLRenderer or custom renderer RAF loop.
- Do not import private Viselora source or rebuild a scene/material/effect facade.
- Read live rect/progress in `useFrame`; R3F delta is in seconds.
- `hideWhenReady` defaults to false. Paint hiding uses opacity on registered
  leaves; a target containing another target remains visible.
- Shared cached assets and external primitives require deliberate disposal.
- Static checks do not establish browser visual correctness or publication.
