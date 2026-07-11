# Lifecycle And Debug API

Compatible package version: 0.1.0-alpha.0

## Contents

- [Runtime debug state](#runtime-debug-state)
- [Debug panel](#debug-panel)
- [Fallback offscreen and disposal](#fallback-offscreen-and-disposal)
- [Ready active but no final pixels](#ready-active-but-no-final-pixels)

## Runtime debug state

**When to use:** choose `useWebGLDebugState` or `onDebugStateChange` to inspect
descriptor-only resource/lifecycle facts.
**Public entrypoint:** `@viselora/dom-webgl/react` plus public
`WebGLDebugState` from `@viselora/dom-webgl`.
**Declaration/props shape:** derive only fields needed by UI rather than storing
the full frame-frequency state.
**Ownership and stability:** keep the callback stable and skip state updates
when selected values are unchanged.
**Fallback and lifecycle:** debug values explain loading/ready/error and
active/inactive/parked state; they do not own fallback.
**Version limitations:** ready/active is not proof of visible final pixels.

```tsx
import type { WebGLDebugState } from "@viselora/dom-webgl";
import { useWebGLDebugState } from "@viselora/dom-webgl/react";
const [debugState, setDebugState] = useWebGLDebugState();
```

For React UI, use a narrow selector:

```tsx
const [modelState, setModelState] = useState({
  resourceStatus: "loading",
  lifecycleState: "inactive",
  visible: false,
  error: undefined as string | undefined,
});

const onDebugStateChange = useCallback((state: WebGLDebugState) => {
  const target = state.targets.find((entry) => entry.key === "story.product-model");
  if (!target) return;
  const next = {
    resourceStatus: target.resourceStatus,
    lifecycleState: target.lifecycleState,
    visible: target.visible,
    error: target.error,
  };
  setModelState((current) => shallowEqual(current, next) ? current : next);
}, []);
```

**Direct verification:** simulate only meaningful field changes and confirm no
frame-frequency React rerender loop.

## Debug panel

**When to use:** choose `WebGLDebugPanel` for development-only inspection.
**Public entrypoint:** `@viselora/dom-webgl/react`.
**Declaration/props shape:** pass one public `WebGLDebugState` value.
**Ownership and stability:** do not treat panel output as production state.
**Fallback and lifecycle:** removing the panel does not alter resource state.
**Version limitations:** panel summaries are not browser pixel assertions.

```tsx
import { WebGLDebugPanel } from "@viselora/dom-webgl/react";
<WebGLDebugPanel state={debugState} />;
```

**Direct verification:** confirm diagnostics change while runtime/canvas count
remains stable.

## Fallback offscreen and disposal

Use explicit target lifecycle. `restore-dom` releases distant resources and
restores fallback; `park` retains warm media/model state. Loading and error keep
fallback visible. Unregister/runtime dispose restores fallback. Module imports
remain SSR-safe; browser APIs run only after runtime creation. Performance
budgets and warnings are descriptor data, not permission for consumer-owned
renderer state.

## Ready active but no final pixels

Classify source URL/format, browser decoding, lifecycle, viewport, placement,
camera/light and console state before changing architecture. Then compare a
clipped final-canvas region across the intended behavior. If resources are
ready, lifecycle is active, the console is clean and pixels remain unchanged,
keep fallback visible and create a minimal reproduction using only public npm
entrypoints. Do not add private imports, raw loaders/cameras/renderers, R3F, a
second canvas or a consumer render loop.
