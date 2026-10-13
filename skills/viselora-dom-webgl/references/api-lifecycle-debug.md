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

## Debug state

`runtime.getDebugState()` and `onDebugStateChange` report availability and
registered target readiness/visibility. A ready flag does not prove pixels
were drawn. Public modules are SSR-safe; browser work occurs after mounting.
