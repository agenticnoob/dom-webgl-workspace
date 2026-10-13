# Native visual effects

Visuals are ordinary React Three Fiber components. Use refs, native Three.js
materials and `useFrame`; there is no effect registry or material facade.

## Animate a native mesh

R3F frame delta is in **seconds**. Previous runtime effect timing was in
milliseconds; convert retained animation math deliberately.

<!-- compile-tsx:native-frame-animation -->

```tsx
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Mesh } from "three";

export function RotatingMesh() {
  const mesh = useRef<Mesh>(null);
  useFrame((_state, delta) => {
    if (mesh.current) mesh.current.rotation.y += delta * 0.4;
  });
  return (
    <mesh ref={mesh}>
      <boxGeometry args={[100, 100, 100]} />
      <meshStandardMaterial color="#b7c9c2" roughness={0.6} />
    </mesh>
  );
}
```

Continuous animation uses R3F's regular frame loop. With `frameloop="demand"`,
call `invalidate()` when external state changes or while damping still needs
frames. Do not add a second requestAnimationFrame renderer loop.

## DOM text as a native texture

The utility preserves CSS dimensions, font/color, wrapping, padding and spacing,
while rasterizing at up to 2x DPR. The caller owns its texture lifetime.

<!-- compile-tsx:native-text-texture -->

```tsx
import { createDOMTextTexture, measureDOMText, drawDOMText } from "@viselora/dom-webgl";

export function createTitleTexture(element: HTMLElement) {
  const resource = createDOMTextTexture(element);
  const image: unknown = resource.texture.image;
  const context = image instanceof HTMLCanvasElement ? image.getContext("2d") : null;
  if (context) {
    const layout = measureDOMText(element, { context });
    context.clearRect(0, 0, layout.width, layout.height);
    drawDOMText(context, layout, layout.glyphs.map((glyph) => ({
      index: glyph.index,
      y: glyph.y + Math.sin(glyph.index * 0.4) * 2,
    })));
    resource.texture.needsUpdate = true;
  }
  return resource; // Attach texture to a native material; dispose on release.
}
```

Rebuild layout/texture after a target's content revision or dimensions change.
Glyph x/y and drawing commands use CSS pixels; y is the top drawing position.
`drawDOMText` preserves the caller's canvas state and does not clear or resize
it. Set the DPR transform when creating your own canvas.

## Other visuals

Use native mesh events for picking, Three.js or Drei animation helpers for
models, and a chosen ecosystem composer/physics package when needed. Cached
loader assets and external `<primitive>` objects require deliberate disposal;
cloning a model instance does not automatically give it exclusive ownership of
shared geometries, materials and textures.

Keep visual capability in the application. Add a runtime API only when it
coordinates reusable DOM state, progress, availability or lifecycle policy.
