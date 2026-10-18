import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Box3, Vector3, type Group } from "three";
import { WebGLRuntime, WebGLTarget, useDOMTarget, useWebGLRuntime } from "@viselora/dom-webgl/react";

function CardModel() {
  const [gltf, setGltf] = useState<GLTF | null>(null);
  useEffect(() => {
    let active = true;
    // A failed load keeps the DOM fallback; nothing is marked ready.
    new GLTFLoader().loadAsync("/models/hero.glb").then(
      (loaded) => active && setGltf(loaded),
      () => {},
    );
    return () => {
      active = false;
    };
  }, []);
  return gltf ? <FittedModel gltf={gltf} /> : null;
}

function FittedModel({ gltf }: { gltf: GLTF }) {
  const target = useDOMTarget("model");
  const runtime = useWebGLRuntime();
  const group = useRef<Group>(null);
  const fit = useMemo(() => {
    const box = new Box3().setFromObject(gltf.scene);
    const size = box.getSize(new Vector3());
    return { center: box.getCenter(new Vector3()), max: Math.max(size.x, size.y, size.z) };
  }, [gltf]);
  useEffect(() => {
    if (!target) return;
    runtime.setTargetReady("model", true, target);
    return () => runtime.setTargetReady("model", false, target);
  }, [runtime, target]);
  useFrame(({ size }, delta) => {
    const node = group.current;
    if (!node) return;
    node.visible = Boolean(target?.visible);
    if (!target) return;
    const { left, top, width, height } = target.rect;
    node.position.set(left + width / 2 - size.width / 2, size.height / 2 - top - height / 2, 0);
    node.scale.setScalar((Math.min(width, height) * 0.8) / fit.max);
    node.rotation.y += delta * 0.5;
  });
  return (
    <group ref={group}>
      <primitive object={gltf.scene} position={[-fit.center.x, -fit.center.y, -fit.center.z]} />
    </group>
  );
}

function Scene() {
  return (
    <>
      <ambientLight intensity={1.2} />
      <directionalLight position={[300, 400, 600]} intensity={2} />
      <CardModel />
    </>
  );
}

const section = { minHeight: "100vh", padding: "10vh 8vw", boxSizing: "border-box" } as const;

export function App() {
  return (
    <WebGLRuntime
      canvas={{ orthographic: true, camera: { position: [0, 0, 1000], far: 4000 } }}
      scene={<Scene />}
    >
      <main>
        <section style={section}>
          <h1>Control product page</h1>
          <p>Scroll to the product.</p>
        </section>
        <section style={section}>
          <article data-testid="product-card" style={{ border: "1px solid #ccc", borderRadius: 16, maxWidth: 420, padding: 24 }}>
            <WebGLTarget id="model" hideWhenReady>
              <div data-testid="model-fallback" style={{ height: 280, display: "grid", placeItems: "center", background: "#eee" }}>
                Hero model preview
              </div>
            </WebGLTarget>
            <h2>Hero figure</h2>
            <p>A compact figure for the control page.</p>
            <a href="#buy">Buy now</a>
          </article>
        </section>
        <section style={section} id="buy">
          <h2>Details</h2>
          <p>More content.</p>
        </section>
      </main>
    </WebGLRuntime>
  );
}
