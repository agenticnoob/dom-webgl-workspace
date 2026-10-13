import { OrbitControls, PerspectiveCamera, View } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  type ComponentRef,
  type RefObject,
} from "react";
import { ErrorBoundary } from "react-error-boundary";
import { MOUSE, Material, Mesh, MeshStandardMaterial, Vector3 } from "three";
import { useClonedModel } from "./useClonedModel";
import { useHoverPulse } from "./interactionEffects";

export function InteractiveFloor() {
  const material = useRef<MeshStandardMaterial>(null);
  const events = useHoverPulse(
    (opacity) => {
      if (material.current) material.current.opacity = opacity;
    },
    0.68,
    0.92,
  );
  return (
    <mesh
      name="example.interaction.floor"
      position={[0, -180, -70]}
      rotation={[-Math.PI / 2, 0, 0]}
      {...events}
    >
      <planeGeometry args={[820, 460]} />
      <meshStandardMaterial
        ref={material}
        color="#23322f"
        roughness={0.72}
        transparent
        opacity={0.68}
      />
    </mesh>
  );
}

export function InteractiveModel() {
  const { scene } = useClonedModel("/models/hero.glb");
  const materials = useMemo(() => {
    const owned: Material[] = [];
    scene.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const cloneMaterial = (material: Material) => {
        const clone = material.clone();
        clone.transparent = true;
        owned.push(clone);
        return clone;
      };
      object.material = Array.isArray(object.material)
        ? object.material.map(cloneMaterial)
        : cloneMaterial(object.material);
    });
    return owned;
  }, [scene]);
  useEffect(
    () => () => {
      materials.forEach((material) => material.dispose());
    },
    [materials],
  );
  const events = useHoverPulse(
    (opacity) =>
      materials.forEach((material) => {
        material.opacity = opacity;
      }),
    0.86,
    1,
  );
  return (
    <primitive
      name="example.interaction.hero"
      object={scene}
      position={[160, -180, -70]}
      rotation={[0, -0.36, 0]}
      scale={14}
      dispose={null}
      {...events}
    />
  );
}

function CameraInteraction({
  viewport,
}: {
  readonly viewport: RefObject<HTMLDivElement | null>;
}) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const camera = useThree((state) => state.camera);
  const state = useMemo(
    () => ({
      offset: new Vector3(),
      resetFrom: new Vector3(),
      resetTarget: new Vector3(),
      resetAt: -1,
      dragging: false,
      inside: false,
      home: new Vector3(120, 132, 620),
      homeTarget: new Vector3(120, -78, -70),
    }),
    [],
  );
  const clock = useThree((root) => root.clock);
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const down = (event: PointerEvent) => {
      state.inside = true;
      if (controls.current)
        controls.current.mouseButtons.LEFT = event.altKey
          ? MOUSE.DOLLY
          : MOUSE.ROTATE;
    };
    const reset = () => {
      if (!controls.current) return;
      state.resetFrom.copy(camera.position).sub(state.offset);
      state.resetTarget.copy(controls.current.target).sub(state.offset);
      state.resetAt = clock.elapsedTime;
    };
    const enter = () => {
      state.inside = true;
    };
    const leave = () => {
      state.inside = false;
    };
    element.addEventListener("pointerenter", enter);
    element.addEventListener("pointerleave", leave);
    window.addEventListener("blur", leave);
    element.addEventListener("pointerdown", down, true);
    element.addEventListener("dblclick", reset);
    return () => {
      element.removeEventListener("pointerenter", enter);
      element.removeEventListener("pointerleave", leave);
      window.removeEventListener("blur", leave);
      element.removeEventListener("pointerdown", down, true);
      element.removeEventListener("dblclick", reset);
    };
  }, [camera, clock, state, viewport]);
  useFrame(() => {
    camera.position.sub(state.offset);
    controls.current?.target.sub(state.offset);
  }, -2);
  useFrame(({ pointer }, delta) => {
    const orbit = controls.current;
    if (!orbit) return;
    if (state.resetAt >= 0) {
      const t = Math.min(1, (clock.elapsedTime - state.resetAt) / 0.22);
      const eased = t * t * (3 - 2 * t);
      camera.position.copy(state.resetFrom).lerp(state.home, eased);
      orbit.target.copy(state.resetTarget).lerp(state.homeTarget, eased);
      if (t === 1) state.resetAt = -1;
    }
    const smoothing = 1 - Math.exp(-12 * delta);
    const active = state.inside && !state.dragging;
    state.offset.x +=
      ((active ? Math.max(-28, Math.min(28, pointer.x * 16)) : 0) -
        state.offset.x) *
      smoothing;
    state.offset.y +=
      ((active ? Math.max(-16, Math.min(16, pointer.y * 8)) : 0) -
        state.offset.y) *
      smoothing;
    camera.position.add(state.offset);
    orbit.target.add(state.offset);
    camera.lookAt(orbit.target);
  }, -0.5);
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      domElement={viewport.current ?? undefined}
      target={[120, -78, -70]}
      enableDamping
      dampingFactor={0.18}
      minPolarAngle={0.52}
      maxPolarAngle={1.42}
      minDistance={240}
      maxDistance={980}
      rotateSpeed={0.7}
      panSpeed={0.9}
      zoomSpeed={1.4}
      mouseButtons={{
        LEFT: MOUSE.ROTATE,
        MIDDLE: MOUSE.DOLLY,
        RIGHT: MOUSE.PAN,
      }}
      onStart={() => {
        state.dragging = true;
        state.resetAt = -1;
      }}
      onEnd={() => {
        state.dragging = false;
      }}
    />
  );
}

export function ManagedInteractionExample() {
  const viewport = useRef<HTMLDivElement>(null);
  return (
    <section className="example-row example-interaction-dogfood">
      <div className="example-interaction-copy">
        <p className="example-kicker">R3F interaction</p>
        <h2>Scene-native picking</h2>
        <p>
          拖动旋转，右键平移，Alt + 拖动缩放；双击恢复视角。Drei OrbitControls
          处理相机，R3F 原生事件处理地面和模型的悬停与点击。
        </p>
      </div>
      <View
        ref={viewport}
        className="example-interaction-viewport"
        aria-hidden="true"
        style={{ touchAction: "none" }}
      >
        <PerspectiveCamera
          makeDefault
          position={[120, 132, 620]}
          fov={42}
          near={0.1}
          far={5000}
          onUpdate={(camera) => camera.lookAt(120, -78, -70)}
        />
        <CameraInteraction viewport={viewport} />
        <InteractiveFloor />
        <ErrorBoundary fallback={null}>
          <Suspense fallback={null}>
            <InteractiveModel />
          </Suspense>
        </ErrorBoundary>
        <ambientLight intensity={0.79} />
        <directionalLight intensity={1} position={[1, 1.5, 2]} />
        <pointLight
          color="#8bd6ca"
          intensity={2.35}
          position={[-160, 160, 180]}
        />
      </View>
    </section>
  );
}
