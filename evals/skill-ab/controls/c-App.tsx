import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import type { Mesh, ShaderMaterial } from "three";
import { createDOMTextTexture } from "@viselora/dom-webgl";
import { WebGLRuntime, WebGLTarget, useDOMTarget, useWebGLRuntime } from "@viselora/dom-webgl/react";

type TextTexture = ReturnType<typeof createDOMTextTexture>;

function WaveText() {
  const target = useDOMTarget("wave");
  const runtime = useWebGLRuntime();
  const [snapshot, setSnapshot] = useState<TextTexture | null>(null);
  const mesh = useRef<Mesh>(null);
  // `revision` is a live field: poll it in a frame and re-render on change.
  const [revision, setRevision] = useState(-1);
  useEffect(() => {
    if (!target) return;
    if (revision < 0) return;
    const next = createDOMTextTexture(target.element);
    setSnapshot(next);
    runtime.setTargetReady("wave", true, target);
    return () => {
      runtime.setTargetReady("wave", false, target);
      next.dispose();
    };
  }, [runtime, target, revision]);
  useFrame(({ size, clock }) => {
    if (target && target.revision !== revision) setRevision(target.revision);
    const node = mesh.current;
    if (!node || !target) return;
    node.visible = target.visible;
    const { left, top, width, height } = target.rect;
    node.position.set(left + width / 2 - size.width / 2, size.height / 2 - top - height / 2, 0);
    node.scale.set(width, height, 1);
    (node.material as ShaderMaterial).uniforms.uTime.value = clock.elapsedTime;
  });
  if (!snapshot) return null;
  return (
    <mesh ref={mesh}>
      <planeGeometry args={[1, 1, 64, 8]} />
      <shaderMaterial
        transparent
        uniforms={{ uMap: { value: snapshot.texture }, uTime: { value: 0 } }}
        vertexShader={`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`}
        fragmentShader={`uniform sampler2D uMap; uniform float uTime; varying vec2 vUv;
          void main(){ vec2 uv = vUv; uv.y += sin(uv.x * 18.0 + uTime * 3.0) * 0.04; gl_FragColor = texture2D(uMap, uv); }`}
      />
    </mesh>
  );
}

export function App() {
  return (
    <WebGLRuntime canvas={{ orthographic: true, camera: { position: [0, 0, 500] } }} scene={<WaveText />}>
      <main>
        <section style={{ minHeight: "100vh", padding: "15vh 8vw" }}>
          <WebGLTarget id="wave" hideWhenReady>
            <h1 data-testid="wave-text" style={{ fontSize: "72px", lineHeight: 1, margin: 0 }}>Words that ripple through light</h1>
          </WebGLTarget>
          <p>Body copy stays in the DOM.</p>
        </section>
        <section style={{ minHeight: "100vh", padding: "15vh 8vw" }}>
          <h2>More</h2>
        </section>
      </main>
    </WebGLRuntime>
  );
}
