import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Mesh } from "three";
import {
  useDOMTarget,
  WebGLRuntime,
  WebGLTarget,
} from "@viselora/dom-webgl/react";

function HeadingHighlight() {
  const target = useDOMTarget("heading");
  const mesh = useRef<Mesh>(null);

  useFrame(({ size }) => {
    if (!mesh.current) return;
    mesh.current.visible = Boolean(target?.visible);
    if (!target) return;
    const { left, top, width, height } = target.rect;
    mesh.current.position.set(
      left + width / 2 - size.width / 2,
      size.height / 2 - top - height / 2,
      0,
    );
    mesh.current.scale.set(width + 32, height + 24, 1);
  });

  return (
    <mesh ref={mesh} visible={false}>
      <planeGeometry />
      <meshBasicMaterial color="#9d8cff" transparent opacity={0.28} />
    </mesh>
  );
}

export function App() {
  return (
    <WebGLRuntime
      canvas={{
        orthographic: true,
        camera: { position: [0, 0, 500] },
        frameloop: "demand",
      }}
      scene={<HeadingHighlight />}
    >
      <main>
        <header>
          <p className="eyebrow">Viselora · React Three Fiber</p>
          <WebGLTarget id="heading">
            <h1>
              The document leads.
              <br />
              The canvas follows.
            </h1>
          </WebGLTarget>
          <p>
            Scroll or resize: a native Three.js plane follows this heading. The
            heading stays readable while WebGL loads or is unavailable.
          </p>
        </header>
        <section aria-labelledby="ownership">
          <h2 id="ownership">One runtime, ordinary scene components.</h2>
          <p>
            Viselora measures DOM anchors and coordinates progress and fallback.
            Use React Three Fiber and Three.js directly for your visual scene.
          </p>
          <a href="#heading-note">Continue reading</a>
        </section>
        <footer id="heading-note">
          Semantic content remains ordinary HTML.
        </footer>
      </main>
    </WebGLRuntime>
  );
}
