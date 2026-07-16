# Hero Next Hold-Driven Radial Color Transition Design

**Date:** 2026-07-16

**Status:** Implemented with one documented package runtime gap

**Post-implementation note (2026-07-17):** the hold state machine, signal
transport, radial shader, interaction, and motion behavior are implemented. The
tetrahedron effect's semantic material/emissive writes are authored but do not
run in production because the real scene-native `WebGLMesh` effect path does not
currently expose `ctx.object.material`. Focused hero tests inject that facade;
they are adapter coverage, not real runtime material evidence. The package gap
is intentionally deferred to a separate general-capability task.

## Goal

Replace the uncommitted scroll-driven tetrahedron cover transition in
`apps/hero-next` with a reversible, hold-driven radial color transition.
Pressing the actual WebGL tetrahedron starts a precise circular expansion from
the mesh hit point. An uninterrupted hold reaches full viewport coverage in
approximately one second and commits the opposite semantic color scheme.
Releasing early retracts the circle. Pressing the tetrahedron again during
retraction resumes the same expansion from its current radius.

The implementation remains app-owned, uses only public package APIs, preserves
future scroll capability, and keeps the existing two non-light author colors:

- `light`: `#B8B8B8`
- `dark`: `#5F5F5F`

## Non-Goals

- Do not modify `packages/`.
- Do not remove `WebGLScrollRuntime`, Lenis, or the app's ability to add future
  scroll timelines.
- Do not use CSS to draw the circle, shake, or any visual transition.
- Do not add a global theme store, DOM event bus, second runtime, or duplicate
  transition state.
- Do not change key, rim, or pointer-light color, intensity, position, distance,
  decay, or behavior.
- Do not add a third non-light authored color.

## Confirmed Interaction

### Idle

- The committed scheme is either `initial` or `inverted`.
- The tetrahedron keeps its existing breathing, floating, and pointer tilt.
- No radial transition is visible.

### Hold

- The tetrahedron uses public scene-object interaction with mesh hit testing and
  press tracking.
- A valid transition begins only when the primary pointer presses the actual
  tetrahedron mesh.
- The first valid hit position becomes the radial origin for that attempt.
- The target scheme is the inverse of the committed scheme.
- The tetrahedron immediately uses the target foreground so that the new color
  visibly originates on the tetrahedron.
- While the mesh remains pressed, normalized `coverage` advances at a rate that
  reaches `1` after 1000 ms of uninterrupted forward motion.
- The tetrahedron shakes while forward expansion is active. Existing ambient
  motion and pointer tilt fade down as coverage rises so the motion layers do
  not fight each other.

### Geometric Commit

- There is no independent timer callback that commits the scheme.
- `coverage` resolves the radial radius.
- The full radius is the distance from the hit origin to the farthest viewport
  corner, including a small antialias/overscan allowance.
- The scheme commits only when the resolved radius covers the viewport and
  `coverage` reaches `1`.
- An uninterrupted hold still takes approximately one second because coverage
  advances at `1 / 1000 ms`.
- On commit, the target scheme becomes the committed scheme without a visual
  jump, shake stops, and normal ambient motion returns.
- The pointer must be released before another inverse transition may begin. A
  continued hold cannot trigger repeated toggles.

### Early Release and Resume

- Releasing the pointer or losing the mesh press before full coverage reverses
  the coverage direction immediately.
- Shake stops as soon as forward pressing stops.
- Retraction uses a constant full-range speed of `1 / 300 ms`. A circle at 50%
  coverage therefore retracts in at most 150 ms.
- The tetrahedron retains the target foreground during retraction so the color
  visually returns into its source.
- If the pointer presses the tetrahedron again before coverage reaches `0`, the
  transition resumes toward the same target scheme from the current radius.
  Coverage is not cleared and the one-second advance is not restarted.
- If coverage reaches `0`, the attempt is cancelled, the radial transition is
  removed, and the tetrahedron returns to the committed foreground.

### Reversible Toggle

- After an `initial -> inverted` commit and release, the next valid hold targets
  `inverted -> initial`.
- Both directions use the same coverage, radius, retraction, resume, and commit
  rules.

## Architecture

### `heroTransitionConfig.ts`

Owns static design and interaction configuration only:

- semantic color tokens and schemes
- progress signal keys
- 1000 ms forward duration
- 300 ms full-range retract duration
- radial overscan and edge feather
- shake amplitude/frequency and ambient-motion weighting

It contains no runtime state.

### `heroHoldTransition.ts`

Owns a pure transition state machine and pure resolvers. It does not import
React, DOM APIs, or Viselora.

Core state:

- committed scheme
- target scheme for the current attempt
- radial origin in normalized viewport coordinates
- normalized coverage in `[0, 1]`
- direction: idle, expanding, retracting, or awaiting release
- whether shake is active

Frame input:

- mesh pressed state
- primary pointer state and normalized position
- frame delta
- reduced-motion preference

Pure output:

- committed/base scheme
- target scheme
- coverage and direction
- origin
- tetrahedron semantic color
- shake weight
- whether the attempt has committed or cancelled

The resolver clamps non-finite or negative delta, coverage, and pointer values so
invalid frame data cannot produce NaN uniforms or unstable transitions.

### `heroTransitionSignals.ts`

Owns the dependency boundary between the pure state and the public progress
store. It defines stable signal keys and a minimal writer dependency:

```ts
type HeroTransitionSignalWriter = {
  set(key: string, value: number): void;
};
```

It publishes only normalized numeric values needed by independent effect
consumers: committed scheme, target scheme, coverage, origin X/Y, and active
direction. It does not own animation state.

### `HeroExperience.tsx`

- Keeps `WebGLScrollRuntime` and the current smooth-scroll stack.
- Removes only the current tetrahedron transition `WebGLScrollTimeline`, pin,
  and transition-specific 300% scroll space.
- Adds an internal `HeroScene` component rendered inside `WebGLScrollRuntime`.
- `HeroScene` calls public `useScrollEffectProgressStore()` to obtain the stable
  store already owned by `WebGLScrollRuntime`.
- A React hook or `useMemo` creates a stable mesh effect declaration containing
  only the injected signal writer dependency.
- React does not mirror per-frame transition state and does not rerender for
  coverage changes.
- The tetrahedron declares `hitTest: "mesh"` and press interaction through the
  public `WebGLMesh` API.

Future `WebGLScrollTimeline` instances may continue to publish separate keys to
the same store. Interaction keys and future scroll keys must remain distinct.

### `heroEffect.ts`

Acts as the scene-object effect adapter:

- reads `ctx.objectPointer.isPressed` and the primary global pointer input
- steps the pure hold transition state
- publishes its resolved state through the injected writer
- applies semantic material color, emissive, and opacity
- composes breathing, floating, pointer tilt, and deterministic hold shake

It does not calculate the radial shader or background colors.

### `heroGhostEffects.ts`

Acts as the background effect consumer:

- reads the shared transition signals through `ctx.progress`
- resolves base and target semantic schemes
- converts normalized pointer origin into shader coordinates
- resolves an aspect-correct full-cover radius for the current viewport
- passes only explicit uniforms to the material program

It does not import or call the tetrahedron effect and does not own gesture state.

### `heroGhostCursorProgram.ts`

Owns shader construction only. New uniforms provide:

- base background and foreground colors
- target background and foreground colors
- radial origin
- normalized coverage or resolved radius
- viewport aspect
- edge feather

The shader renders the target scheme inside the radial mask and the committed
scheme outside it. A narrow `smoothstep` edge provides antialiasing; all authored
color inputs still come from the two semantic tokens.

## Radial Geometry

For viewport pixel dimensions `(width, height)` and normalized origin converted
to pixels `(originX, originY)`, calculate the distance to all four corners:

```text
(0, 0)
(width, 0)
(0, height)
(width, height)
```

The maximum distance, multiplied by radial overscan, is the full-cover radius.
The current radius is:

```text
radius = fullCoverRadius * smoothstep(coverage)
```

Shader distance calculations must be aspect-correct so the wave remains circular
on desktop and mobile viewports. The exact hit point, not a duplicated estimate
of the tetrahedron center, is the origin.

## Motion Composition

- Existing breathing, floating, and pointer tilt remain available at idle.
- During expansion, their weight decreases as hold coverage increases.
- Shake is a deterministic, frame-time-based combination of small position and
  rotation oscillations. It does not use random values, timers, or React state.
- Shake amplitude is multiplied by a smooth coverage envelope and becomes zero
  immediately when the press stops or full coverage commits.
- Retraction contains no shake unless the tetrahedron is pressed again, at which
  point forward expansion and shake resume from the current coverage.

## Reduced Motion

- The one-second hold requirement, geometric coverage, retraction, resume, and
  reversible scheme semantics remain available.
- Geometry shake is disabled.
- No extra fast position or rotation is introduced.
- The radial edge still expands and retracts with synchronized background,
  foreground, material, and emissive roles.

## Testing

### Pure State and Resolver Tests

- initial and inverted idle states
- 999 ms remains incomplete; sufficient accumulated forward coverage reaches 1
- commit is based on geometric full coverage, not a separate timeout callback
- early release reverses direction
- 25%, 50%, and 90% coverage retract proportionally at the 300 ms full-range rate
- pressing during retraction resumes the same target from the current coverage
- retraction to zero cancels and restores committed foreground
- completion requires release before another toggle
- continued hold after commit does not toggle repeatedly
- initial to inverted to initial determinism
- non-finite, negative, and oversized input clamping
- reduced motion disables shake without disabling interaction

### Radial and Semantic Tests

- farthest-corner coverage for desktop, mobile, and edge/corner origins
- aspect-correct circular distance
- base/target scheme mapping inside and outside the mask
- tetrahedron retains target foreground until cancellation completes
- background, Ghost Cursor, material, and emissive consume one semantic state
- no third non-light authored color
- existing key, rim, and pointer-light declarations remain unchanged

### React and Integration Tests

- `WebGLScrollRuntime` and smooth-scroll configuration remain present
- the obsolete tetrahedron transition timeline, pin, and progress binding are removed
- `HeroScene` uses public `useScrollEffectProgressStore()`
- mesh interaction uses `hitTest: "mesh"` with press enabled
- injected writer and effect declarations remain reference-stable
- per-frame coverage does not cause React rendering or runtime reconstruction
- no `packages/` changes and CSS remains layout-only

### Browser Verification

Use the production build with the real installed workspace package runtime at
desktop and mobile viewports. Verify:

- successful one-second hold and full radial cover
- early release and proportional retraction
- press-during-retraction resume
- release gate after commit
- second hold reverses the scheme
- touch/pointer behavior at mobile size
- reduced-motion behavior
- one managed canvas and no console errors or warnings

Automated verification must not be described as browser visual acceptance.

## Documentation and Scope Closeout

Update only active documentation:

- `apps/hero-next/AGENTS.md`
- `apps/hero-next/VISUAL_DESIGN.md`
- `docs/STATUS.md`
- `docs/README.md`

The previous uncommitted scroll-cover implementation and its plan remain Git
history/worktree evidence until implementation planning decides whether to
replace or supersede those artifacts. Historical archive files are not edited.

No commit or push is part of this design step.
