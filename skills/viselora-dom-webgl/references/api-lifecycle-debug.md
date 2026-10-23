# Runtime lifecycle

## Runtime host

`WebGLRuntime` takes native R3F `scene`, semantic DOM `children`, ordinary
`canvas` props and optional progress/scroll sources. `useWebGLRuntime` returns
DOM coordination and shared inputs, not a duplicate renderer API.

Hidden tabs and lost contexts suspend frames and restore DOM fallback. Recovery
restores the configured `canvas.frameloop` and invalidates the scene. A visible
tab still waits for context restoration before rendering again.

## DOM targets

`WebGLTarget` clones one ref-capable DOM child. `useDOMTarget(id)` tracks its
registration; read the live rect, visible flag and content revision in a frame.
Measurements run before ordinary scene frame subscribers.

Fallback hiding defaults off. A replacement visual opts in to `hideWhenReady`
and calls `runtime.setTargetReady(id, true, capturedTarget)` when renderable.
A failed or released visual reports false. The captured identity prevents a
stale load from hiding a remounted target.

Hiding uses opacity so semantic content stays accessible. A registered parent
with registered descendants stays visible; hide only independently replaced
leaves. `restore-dom` restores offscreen paint; `park` retains hidden fallback
and ready state. Visual components choose their own resource retention policy.

## Offscreen sections

Since 0.3.0-alpha.0. Earlier versions do not export `WebGLSection` or
`useSectionState`.

`WebGLSection` wraps native scene content and pauses it by distance from a
registered `target` or a `progress` range. `active` draws and updates; `warm`
updates without drawing; `sleep` keeps the content in a hidden React
`Activity`, which hides its objects and disconnects its effects and ordinary
`useFrame` callbacks. Content mounts on first approach unless `mount="eager"`;
`retain="release"` unmounts it while asleep. While warm, new materials are
compiled and loaded textures uploaded before drawing; `useSectionState()`
reports `phase` and `warmed`. Keep lights and the camera rig outside sections.
Hidden objects receive no pointer events.

## Render quality

Since 0.3.0-alpha.0; earlier versions use `canvas.dpr` unchanged.

By default the canvas pixel ratio follows a per-tier drawing-buffer budget
(`high` 4.0, `medium` 2.0, `low` 1.0 megapixels), bounded by the device and
`canvas.dpr` (a number is the maximum). Sustained frames over 22 ms step the
tier down, far slower frames drop to `low`, and a downgrade that does not
shorten frames is undone. Frames that keep up with the display step back up.
`useRenderQuality()` returns `tier`, `dpr` and `reducedMotion`; scale optional
work such as particle counts or raymarch steps by `tier`. `quality={false}`
uses `canvas.dpr` unchanged. On a phone-sized viewport every tier's budget
allows more than DPR 2, so the tier changes only the work components scale by
it; the one-take recipes do this for particle counts and veil detail.

## Debug state

`runtime.getDebugState()` and `onDebugStateChange` report availability and
registered target readiness/visibility. A ready flag does not prove pixels
were drawn.

Since 0.3.0-alpha.0, debug state also reports `frame` (fps,
p90, draw calls, triangles, programs, textures, tier, DPR), mounted
`sections` and development `warnings`. With `diagnostics` (default on unless
`NODE_ENV` is `production`) the runtime warns once per subject about a target
that hides its DOM while nothing is drawn in its box for 30 frames, a section
compiling shaders as it becomes active, lights inside a section, sustained
frames over the tier's draw-call/triangle budget, and frames below 30 fps at
the lowest tier. Treat any `[viselora]` console warning as a defect to fix. Public modules are SSR-safe; browser work occurs after mounting.
