// Recipe R5: scroll-driven product turntable with DOM hotspot labels.
//
// Scroll progress turns the model and eases between stops; labels are real
// DOM elements positioned each frame from projected 3D points, so they stay
// readable, selectable text. A "studio" finish swaps the model's materials for
// owned physical clones (clearcoat), restored on unmount.
//
// Budget at medium: the model's own draw calls; up to 300k triangles; uses the
// scene environment (set it outside sections).
//
// - The component is a progress section; labels hide while it is not active,
//   including when it falls asleep (their effect cleanup hides them).
// - Label positions are written through refs, never React state.
// - Reduced motion: the model snaps between stops instead of easing.
// - The loader cache owns the GLTF's geometry and textures; this component
//   owns only its cloned graph and the studio materials.
import { useFrame, useLoader } from "@react-three/fiber";
import {
  WebGLSection,
  useRenderQuality,
  useSectionState,
  useWebGLRuntime,
  type WebGLSectionProgressRange,
} from "@viselora/dom-webgl/react";
import { Suspense, useEffect, useMemo, useRef, type ReactNode } from "react";
import {
  Box3,
  Color,
  Mesh,
  MeshPhysicalMaterial,
  Vector3,
  type Group,
  type Material,
  type Vector3Tuple,
} from "three";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";

import { damp } from "./screenSpace";

/** Shared between the DOM labels and the scene. */
export type HotspotStore = {
  readonly elements: Map<string, HTMLElement>;
};

export function createHotspotStore(): HotspotStore {
  return { elements: new Map() };
}

export function ProductHotspot({
  store,
  id,
  children,
}: {
  readonly store: HotspotStore;
  readonly id: string;
  readonly children: ReactNode;
}) {
  return (
    <span
      className="product-hotspot"
      ref={(element) => {
        if (!element) return;
        store.elements.set(id, element);
        return () => {
          if (store.elements.get(id) === element) store.elements.delete(id);
        };
      }}
    >
      {children}
    </span>
  );
}

export type Hotspot = {
  readonly id: string;
  /** Point on the model, in its fitted local space (-0.5..0.5 of `size`). */
  readonly point: Vector3Tuple;
};

export type ProductTurntableProps = {
  readonly src: string;
  readonly dracoPath?: string;
  readonly progress: WebGLSectionProgressRange;
  readonly position?: Vector3Tuple;
  /** Largest dimension in world units (default 3). */
  readonly size?: number;
  /** Rotation stops as fractions of a full turn, visited in order. */
  readonly stops: readonly number[];
  readonly hotspots: readonly Hotspot[];
  readonly store: HotspotStore;
  readonly finish?: "original" | "studio";
  readonly studioColor?: string;
};

export function ProductTurntable(props: ProductTurntableProps) {
  return (
    <WebGLSection progress={props.progress} name="product-turntable">
      {/* Inside the section: the model load must not suspend the section. */}
      <Suspense fallback={null}>
        <Turntable {...props} />
      </Suspense>
    </WebGLSection>
  );
}

function Turntable({
  src,
  dracoPath,
  progress,
  position = [0, 0, 0],
  size = 3,
  stops,
  hotspots,
  store,
  finish = "original",
  studioColor = "#d9d4cc",
}: ProductTurntableProps) {
  const runtime = useWebGLRuntime();
  const { reducedMotion } = useRenderQuality();
  const { phase } = useSectionState();
  const gltf = useLoader(GLTFLoader, src, (loader) => {
    if (!dracoPath) return;
    const draco = new DRACOLoader();
    draco.setDecoderPath(dracoPath);
    loader.setDRACOLoader(draco);
  });
  const scene = useMemo(() => clone(gltf.scene), [gltf.scene]);
  const turn = useRef<Group>(null);
  const angle = useRef<number | undefined>(undefined);
  const fit = useMemo(() => {
    const box = new Box3().setFromObject(scene);
    const extent = box.getSize(new Vector3());
    const scale = size / Math.max(extent.x, extent.y, extent.z, 1e-3);
    return {
      scale,
      offset: box.getCenter(new Vector3()).multiplyScalar(-scale),
    };
  }, [scene, size]);
  const scratch = useMemo(
    () => ({
      world: new Vector3(),
      toCamera: new Vector3(),
      normal: new Vector3(),
      center: new Vector3(),
    }),
    [],
  );

  // Owned clones for the studio finish; the loader's materials are restored.
  useEffect(() => {
    if (finish !== "studio") return;
    const swapped: Array<{ mesh: Mesh; material: Material | Material[] }> = [];
    const owned: MeshPhysicalMaterial[] = [];
    scene.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const material = new MeshPhysicalMaterial({
        color: new Color(studioColor),
        roughness: 0.38,
        metalness: 0.1,
        clearcoat: 0.8,
        clearcoatRoughness: 0.18,
        envMapIntensity: 0.7,
      });
      swapped.push({ mesh: object, material: object.material });
      owned.push(material);
      object.material = material;
    });
    return () => {
      for (const item of swapped) item.mesh.material = item.material;
      for (const material of owned) material.dispose();
    };
  }, [scene, finish, studioColor]);

  // Labels hide when the section sleeps or this component unmounts.
  useEffect(
    () => () => {
      for (const element of store.elements.values())
        element.style.opacity = "0";
    },
    [store],
  );

  useFrame(({ camera, size: viewport }, delta) => {
    const node = turn.current;
    if (!node) return;
    const span = Math.max(1e-6, progress.to - progress.from);
    const local = Math.min(
      1,
      Math.max(0, (runtime.progress.get(progress.key) - progress.from) / span),
    );
    const goal = stopAngle(stops, local);
    const current = angle.current ?? goal;
    angle.current = reducedMotion ? goal : damp(current, goal, 0.2, delta);
    node.rotation.y = angle.current;
    node.updateWorldMatrix(true, true);

    const showLabels = phase === "active" && local > 0.08 && local < 0.92;
    node.getWorldPosition(scratch.center);
    for (const hotspot of hotspots) {
      const element = store.elements.get(hotspot.id);
      if (!element) continue;
      scratch.world.set(...hotspot.point).multiplyScalar(size);
      node.localToWorld(scratch.world);
      // Facing the camera: the point's outward direction against the view.
      scratch.normal.copy(scratch.world).sub(scratch.center).normalize();
      scratch.toCamera.copy(camera.position).sub(scratch.world).normalize();
      const facing = scratch.normal.dot(scratch.toCamera);
      const projected = scratch.world.project(camera);
      const x = (projected.x * 0.5 + 0.5) * viewport.width;
      const y = (0.5 - projected.y * 0.5) * viewport.height;
      const visible = showLabels && facing > 0.15 && projected.z < 1;
      element.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%)`;
      element.style.opacity = visible
        ? String(Math.min(1, (facing - 0.15) * 4))
        : "0";
    }
  });

  return (
    <group position={position}>
      <group ref={turn}>
        <primitive object={scene} scale={fit.scale} position={fit.offset} />
      </group>
    </group>
  );
}

// Holds each stop for the middle of its segment, easing between stops.
function stopAngle(stops: readonly number[], local: number) {
  if (stops.length === 0) return 0;
  if (stops.length === 1) return stops[0] * Math.PI * 2;
  const position = local * (stops.length - 1);
  const index = Math.min(stops.length - 2, Math.floor(position));
  const t = position - index;
  const eased = t < 0.25 ? 0 : t > 0.75 ? 1 : smooth((t - 0.25) / 0.5);
  return (
    (stops[index] + (stops[index + 1] - stops[index]) * eased) * Math.PI * 2
  );
}

function smooth(value: number) {
  return value * value * (3 - 2 * value);
}
