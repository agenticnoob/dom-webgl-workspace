// Recipe: a GLB model that follows a WebGLTarget.
//
// - The DOM fallback inside <WebGLTarget hideWhenReady> stays visible while the
//   model loads, when the load fails and when WebGL is unavailable.
// - Readiness is reported only after the model exists, against the captured
//   target identity, and is withdrawn on unmount.
// - The loaded model is owned by this component and disposed on unmount.
// - The idle spin stops under `prefers-reduced-motion: reduce`.
//
// Copy this file, then render <ModelTarget> in the runtime `scene` and wrap the
// fallback element in <WebGLTarget id=... hideWhenReady>. See ModelCardExample.
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Box3, Mesh, Texture, Vector3, type Group, type Object3D } from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import {
  useDOMTarget,
  useWebGLRuntime,
  WebGLRuntime,
  WebGLTarget,
} from "@viselora/dom-webgl/react";

type ModelLoad =
  | { status: "loading" }
  | { status: "ready"; gltf: GLTF }
  | { status: "error"; error: unknown };

/** Loads a GLB after mount. The result is owned by the caller's component. */
export function useOwnedGLTF(url: string): ModelLoad {
  const [loaded, setLoaded] = useState<{ url: string; load: ModelLoad }>();
  useEffect(() => {
    let active = true;
    let owned: GLTF | undefined;
    new GLTFLoader().loadAsync(url).then(
      (gltf) => {
        // StrictMode or a URL change discarded this load: release it now.
        if (!active) return disposeObject(gltf.scene);
        owned = gltf;
        setLoaded({ url, load: { status: "ready", gltf } });
      },
      (error: unknown) => {
        // Never mark the target ready on failure: the DOM fallback stays.
        if (active) setLoaded({ url, load: { status: "error", error } });
      },
    );
    return () => {
      active = false;
      if (owned) disposeObject(owned.scene);
    };
  }, [url]);
  return loaded?.url === url ? loaded.load : { status: "loading" };
}

export function disposeObject(root: Object3D): void {
  root.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    node.geometry.dispose();
    const materials = Array.isArray(node.material)
      ? node.material
      : [node.material];
    for (const material of materials) {
      for (const value of Object.values(material))
        if (value instanceof Texture) value.dispose();
      material.dispose();
    }
  });
}

export type ModelTargetProps = {
  targetId: string;
  url: string;
  /** Fraction of the target's shorter side the model's largest edge fills. */
  fill?: number;
  /** Idle rotation in radians per second; 0 disables it. Reduced motion stops it. */
  spinSpeed?: number;
};

export function ModelTarget({
  targetId,
  url,
  fill = 0.8,
  spinSpeed = 0.5,
}: ModelTargetProps) {
  const model = useOwnedGLTF(url);
  useEffect(() => {
    if (model.status === "error")
      console.warn(`Model ${url} failed; keeping the DOM fallback.`, model.error);
  }, [model, url]);
  if (model.status !== "ready") return null;
  return (
    <FittedModel
      targetId={targetId}
      object={model.gltf.scene}
      fill={fill}
      spinSpeed={spinSpeed}
    />
  );
}

function FittedModel({
  targetId,
  object,
  fill,
  spinSpeed,
}: {
  targetId: string;
  object: Object3D;
  fill: number;
  spinSpeed: number;
}) {
  const target = useDOMTarget(targetId);
  const runtime = useWebGLRuntime();
  const group = useRef<Group>(null);
  const reducedMotion = useRef(false);
  const fit = useMemo(() => {
    const box = new Box3().setFromObject(object);
    const size = box.getSize(new Vector3());
    return {
      center: box.getCenter(new Vector3()),
      size: Math.max(size.x, size.y, size.z) || 1,
    };
  }, [object]);

  // A ref, not state: the frame callback reads it without re-rendering.
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      reducedMotion.current = query.matches;
    };
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!target) return;
    runtime.setTargetReady(targetId, true, target);
    return () => runtime.setTargetReady(targetId, false, target);
  }, [runtime, target, targetId]);

  // Orthographic pixel camera: 1 world unit = 1 CSS pixel, origin at the
  // viewport centre. Read the live rect every frame; it is not React state.
  useFrame(({ size }, delta) => {
    const node = group.current;
    if (!node) return;
    node.visible = Boolean(target?.visible);
    if (!target) return;
    const { left, top, width, height } = target.rect;
    node.position.set(
      left + width / 2 - size.width / 2,
      size.height / 2 - top - height / 2,
      0,
    );
    node.scale.setScalar((Math.min(width, height) * fill) / fit.size);
    if (!reducedMotion.current) node.rotation.y += delta * spinSpeed; // delta is in seconds
  });

  return (
    <group ref={group} visible={false}>
      <primitive
        object={object}
        position={[-fit.center.x, -fit.center.y, -fit.center.z]}
      />
    </group>
  );
}

export function ModelCardExample() {
  return (
    <WebGLRuntime
      canvas={{
        orthographic: true,
        camera: { position: [0, 0, 1000], near: 0.1, far: 4000 },
      }}
      scene={
        <>
          <ambientLight intensity={1.2} />
          <directionalLight position={[300, 400, 600]} intensity={2} />
          <ModelTarget targetId="product-model" url="/models/hero.glb" />
        </>
      }
    >
      <main>
        <article>
          <WebGLTarget id="product-model" hideWhenReady>
            <div style={{ height: 280, display: "grid", placeItems: "center" }}>
              Product model preview
            </div>
          </WebGLTarget>
          <h2>Product</h2>
          <p>The card stays ordinary HTML; the model follows its fallback box.</p>
          <a href="#buy">Buy now</a>
        </article>
      </main>
    </WebGLRuntime>
  );
}
