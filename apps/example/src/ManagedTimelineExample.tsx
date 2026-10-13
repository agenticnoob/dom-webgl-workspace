import { PerspectiveCamera, View } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import {
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera as ThreePerspectiveCamera,
  Quaternion,
  Vector3,
} from "three";
import { WebGLTarget, useWebGLRuntime } from "@viselora/dom-webgl/react";
import {
  useScrollEffectProgressStore,
  WebGLScrollTimeline,
} from "@viselora/scroll-adapters/react";
import { canvasTexture } from "./nativeMaterials";
import {
  drawTimelineCard,
  readTimelineCardFrame,
  smoothstep,
} from "./managedTimelineCardEffect";

export const managedTimelineId = "example.managedTimeline";
const cardId = "example.managedStage.card";

export function applyTimelineCamera(
  camera: ThreePerspectiveCamera,
  progress: number,
): void {
  const t = smoothstep(0.12, 0.88, progress);
  camera.position.set(0, 136 - 40 * t, 560 - 40 * t);
  camera.lookAt(0, -88 + 124 * t, -40 + 40 * t);
  camera.fov = 42 - 8 * t;
  camera.updateProjectionMatrix();
}

function TimelineCamera() {
  const camera = useRef<ThreePerspectiveCamera>(null);
  const progress = useScrollEffectProgressStore();
  useFrame(() => {
    if (camera.current)
      applyTimelineCamera(
        camera.current,
        progress.source.get(managedTimelineId),
      );
  }, -1);
  return (
    <PerspectiveCamera
      ref={camera}
      makeDefault
      position={[0, 136, 560]}
      fov={42}
      near={0.1}
      far={5000}
    />
  );
}

function TimelineCard({
  viewport,
}: {
  readonly viewport: RefObject<HTMLDivElement | null>;
}) {
  const runtime = useWebGLRuntime();
  const progress = useScrollEffectProgressStore();
  const mesh = useRef<Mesh>(null);
  const state = useMemo(() => {
    const canvas = document.createElement("canvas");
    const texture = canvasTexture(canvas);
    const material = new MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    return {
      canvas,
      texture,
      material,
      forward: new Vector3(),
      offset: new Vector3(),
      rotation: new Quaternion(),
      lastProgress: -1,
    };
  }, []);
  useEffect(
    () => () => {
      runtime.setTargetReady(cardId, false);
      state.texture.dispose();
      state.material.dispose();
    },
    [runtime, state],
  );
  useFrame(({ camera }) => {
    const target = runtime.getTarget(cardId);
    const view = viewport.current?.getBoundingClientRect();
    if (
      !target ||
      !view ||
      !mesh.current ||
      !(camera instanceof ThreePerspectiveCamera)
    )
      return;
    const p = progress.source.get(managedTimelineId);
    const frame = readTimelineCardFrame(p);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.ceil(target.rect.width));
    const height = Math.max(1, Math.ceil(target.rect.height));
    const pixelWidth = Math.ceil(width * dpr);
    const pixelHeight = Math.ceil(height * dpr);
    if (
      state.lastProgress !== p ||
      state.canvas.width !== pixelWidth ||
      state.canvas.height !== pixelHeight
    ) {
      state.canvas.width = pixelWidth;
      state.canvas.height = pixelHeight;
      const context = state.canvas.getContext("2d");
      if (!context) return;
      context.scale(dpr, dpr);
      drawTimelineCard(context, width, height, p, frame.presence);
      state.texture.needsUpdate = true;
      state.lastProgress = p;
    }
    const unitsPerPixel =
      (2 * Math.tan((camera.fov * Math.PI) / 360) * 120) /
      Math.max(1, view.height);
    camera.getWorldDirection(state.forward);
    mesh.current.position
      .copy(camera.position)
      .addScaledVector(state.forward, 120);
    state.offset
      .set(
        target.rect.left + target.rect.width / 2 - view.left - view.width / 2,
        view.top + view.height / 2 - target.rect.top - target.rect.height / 2,
        0,
      )
      .multiplyScalar(unitsPerPixel)
      .applyQuaternion(camera.quaternion);
    mesh.current.position.add(state.offset);
    state.rotation.setFromAxisAngle(
      state.forward.set(0, 1, 0),
      frame.rotationY,
    );
    mesh.current.quaternion.copy(camera.quaternion).multiply(state.rotation);
    mesh.current.scale.set(
      target.rect.width * unitsPerPixel,
      target.rect.height * unitsPerPixel,
      1,
    );
    mesh.current.visible = target.visible && frame.visible;
    state.material.opacity = frame.opacity;
    runtime.setTargetReady(cardId, true, target);
  });
  return (
    <mesh ref={mesh} name={cardId} renderOrder={10} material={state.material}>
      <planeGeometry args={[1, 1]} />
    </mesh>
  );
}

export function ManagedTimelineExample() {
  const viewport = useRef<HTMLDivElement>(null);
  return (
    <WebGLScrollTimeline
      id={managedTimelineId}
      className="example-row example-managed-stage-timeline"
      start="top top"
      end="+=240%"
      pin
      scrub
    >
      <div className="example-managed-stage-copy">
        <p className="example-kicker">pinned R3F scene</p>
        <h2>滚动固定的声明式 3D 舞台</h2>
        <p>
          同一个 timeline 驱动原生 camera 和右侧卡片效果；Drei View 把舞台裁剪在
          pinned viewport 内。
        </p>
      </div>
      <View ref={viewport} className="example-managed-stage-viewport">
        <TimelineCamera />
        <mesh
          name="example.managedStage.floor"
          position={[0, -178, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[920, 520]} />
          <meshStandardMaterial color="#16241f" roughness={0.82} />
        </mesh>
        <mesh name="example.managedStage.backdrop" position={[0, 18, -290]}>
          <planeGeometry args={[920, 430]} />
          <meshStandardMaterial color="#1f3a32" roughness={0.7} />
        </mesh>
        <mesh name="example.managedStage.plinth" position={[0, -130, -56]}>
          <boxGeometry args={[220, 96, 180]} />
          <meshStandardMaterial color="#566b61" roughness={0.56} />
        </mesh>
        <ambientLight intensity={0.69} />
        <directionalLight intensity={1} position={[1, 1.5, 2]} />
        <pointLight
          color="#f6c453"
          intensity={1.85}
          position={[-180, 160, 220]}
        />
        <TimelineCard viewport={viewport} />
      </View>
      <WebGLTarget id={cardId} hideWhenReady>
        <article className="example-managed-stage-card">
          <span>WebGLTarget</span>
          <strong>Timeline driven card</strong>
          <em>same progress signal</em>
        </article>
      </WebGLTarget>
    </WebGLScrollTimeline>
  );
}
