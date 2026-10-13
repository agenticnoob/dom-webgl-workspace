# Getting started

This guide describes the React/R3F 0.2 alpha API. See
[release truth](../STATUS.md#release-truth) for the current registry version.
Use React 19, React DOM 19, R3F 9 and Three.js 0.184.

```bash
npm install @viselora/dom-webgl@alpha react@19 react-dom@19 @react-three/fiber@9 three@0.184
```

Install `@viselora/scroll-adapters@alpha` only when using the optional scroll
integration. Keep both Viselora packages on the same version. TypeScript
consumers should also install `@types/react@19`, `@types/react-dom@19` and
`@types/three@0.184` as development dependencies.

If a configured registry mirror has not synchronized the release, add
`--registry=https://registry.npmjs.org` to the install command. This affects that
command only. Pin the exact version from release truth for reproducible installs.

## One host and native scene

`WebGLRuntime` mounts the page's Canvas. Put R3F components in `scene` and
semantic DOM in `children`. `canvas` forwards ordinary R3F Canvas configuration.
Use `useFrame` for high-frequency transforms and `useThree` for renderer state.

## Bind a DOM element

`WebGLTarget` binds one ref-capable child by id. The live target rect uses CSS
viewport pixels. An orthographic camera with zoom 1 maps one scene unit to one
CSS pixel; convert from top-left DOM coordinates to the scene's center origin.

<!-- compile-tsx:getting-started-runtime -->

```tsx
"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Mesh } from "three";
import { WebGLRuntime, WebGLTarget, useDOMTarget } from "@viselora/dom-webgl/react";

function Highlight() {
  const target = useDOMTarget("heading");
  const mesh = useRef<Mesh>(null);
  useFrame(({ size }) => {
    if (!target || !mesh.current) return;
    const rect = target.rect;
    mesh.current.visible = target.visible;
    mesh.current.position.set(
      rect.left + rect.width / 2 - size.width / 2,
      size.height / 2 - rect.top - rect.height / 2,
      0,
    );
    mesh.current.scale.set(rect.width, rect.height, 1);
  });
  return (
    <mesh ref={mesh} visible={false}>
      <planeGeometry />
      <meshBasicMaterial color="#7ac5b8" transparent opacity={0.25} />
    </mesh>
  );
}

export function App() {
  return (
    <WebGLRuntime canvas={{ orthographic: true, camera: { position: [0, 0, 500] } }} scene={<Highlight />}>
      <WebGLTarget id="heading"><h1>Semantic DOM remains readable</h1></WebGLTarget>
    </WebGLRuntime>
  );
}
```

The target identity is reactive; its rect/visibility/revision update in place.
Read them in a frame callback. Runtime measurement runs before ordinary scene
frame callbacks. Perspective scenes can use native Three.js camera projection
and R3F viewport helpers for their own placement.

## Fallback and offscreen policy

`hideWhenReady` defaults to false. Set it only for a visual that replaces the
DOM paint. Use `useWebGLRuntime().setTargetReady(id, true, target)` after visual
readiness, and false when a visual fails or unloads. Pass the target captured by
the load so a stale asynchronous result cannot affect a later same-id target.

`offscreen="restore-dom"` restores fallback outside the viewport;
`offscreen="park"` keeps ready fallback hidden. Use `target.visible` to pause
updates and choose normal React unmounting or retained Three.js resources.
Unavailable WebGL and final unmount restore runtime-owned opacity. A target containing another registered target
is kept visible; opt into hiding only on leaves that replace DOM paint. Opacity
keeps the semantic content available to assistive technology.

## Next.js

Place the runtime/scene composition in a Client Component with `"use client"`.
The package imports are SSR-safe and semantic children render without a WebGL
context. Keep browser-only loader work inside mounted components or explicit
DOM utility calls. Do not create textures or query `document` at module scope.

## Loading and effects

Use Three.js loaders, R3F `useLoader`, or Drei helpers such as `useGLTF` and
`useAnimations`. Use local Suspense/error boundaries as appropriate, keeping
semantic DOM available until the replacement visual is ready.

See [native effects](./effects.md), [scroll](./scroll.md), and
[architecture](../ARCHITECTURE.md) for ownership details.

## Migrate from 0.1.x

The 0.2 release is a breaking replacement with no compatibility backend.
Framework-independent runtime creation is no longer supported. Move visual
ownership into React components before removing the old declarations.

| Previous responsibility | React/R3F replacement |
| --- | --- |
| Managed scene, mesh, model and light declarations | Native R3F components in the host's `scene` prop |
| Effect registry and material/object facades | Three.js refs, materials and `useFrame` |
| Runtime loaders, model mixers and resource cache | R3F `useLoader`, Drei helpers and explicit owned/shared disposal |
| Camera controllers, pointer picking, physics and postprocessing | Native R3F/Three.js or chosen ecosystem tools |
| Automatic source-to-DOM visual replacement | `WebGLTarget`, `useDOMTarget` and explicit readiness |
| Effect frame delta in milliseconds | R3F frame delta in seconds |

Keep one host and Canvas. Retain semantic HTML and fallback while moving each
scene. Port animation math with its original units, declare the lighting your
materials need, and compare forward/reverse scroll, input, resize and context
recovery in the browser. Passing types alone does not establish visual parity.
