// Six deliberately unmanaged chapters: each fades with opacity or scale and
// keeps animating, uploading and drawing for the whole page, the way a
// performance-unaware page is usually written. They form the baseline that
// runtime-managed sections are measured against.
import { useTexture } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { createDOMTextTexture } from "@viselora/dom-webgl";
import { useDOMTarget, useWebGLRuntime } from "@viselora/dom-webgl/react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AdditiveBlending,
  AnimationMixer,
  Box3,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  LinearFilter,
  PerspectiveCamera,
  SRGBColorSpace,
  Texture,
  Vector2,
  Vector3,
  VideoTexture,
  type CanvasTexture,
  type Group,
  type Mesh,
  type MeshBasicMaterial,
  type MeshStandardMaterial,
  type ShaderMaterial,
} from "three";

import { useClonedModel } from "../recipes/shared/useClonedModel";
import type { BenchController } from "./benchController";
import {
  benchProgress,
  chapterLocal,
  chapterWeight,
  chapterZ,
  type BenchSequenceMode,
} from "./benchLayout";
import {
  particleFragmentShader,
  particleVertexShader,
  raymarchFragmentShader,
  screenVertexShader,
  textWaveFragmentShader,
  textWaveVertexShader,
} from "./benchShaders";

type ChapterProps = { readonly controller: BenchController };

export const benchTitleTargetId = "bench-title";

export function ModelChapter({ controller }: ChapterProps) {
  const runtime = useWebGLRuntime();
  // Sprint.glb is a whole animated set (259 meshes); it surrounds the view.
  const set = useAnimatedModel("/models/Sprint.glb", 24, "/draco/gltf/");
  const runner = useAnimatedModel("/models/human_male_base.glb", 5);
  const group = useRef<Group>(null);

  useEffect(() => controller.assetReady("model"), [controller]);

  useFrame((_, delta) => {
    set.mixer.update(delta);
    runner.mixer.update(delta);
    const node = group.current;
    if (!node) return;
    const weight = chapterWeight(benchProgress(runtime.scroll), 0);
    node.scale.setScalar(Math.max(1e-4, weight));
  });

  return (
    <group position={[0, 0, chapterZ(0)]}>
      <group ref={group}>
        <primitive object={set.scene} scale={set.scale} position={set.offset} />
        <group position={[-1.5, 0, 2]}>
          <primitive
            object={runner.scene}
            scale={runner.scale}
            position={runner.offset}
          />
        </group>
        <mesh position={[3.6, 1.6, 1]}>
          <sphereGeometry args={[1.3, 96, 64]} />
          <meshPhysicalMaterial
            color="#dfe8ff"
            transmission={1}
            thickness={1.2}
            roughness={0.06}
            ior={1.45}
          />
        </mesh>
      </group>
    </group>
  );
}

/** A cloned GLB scaled to `size` units, centred, with every clip playing. */
function useAnimatedModel(src: string, size: number, dracoPath?: string) {
  const { scene, animations } = useClonedModel(src, dracoPath);
  const fit = useMemo(() => {
    const box = new Box3().setFromObject(scene);
    const extent = box.getSize(new Vector3());
    const scale = size / Math.max(extent.x, extent.y, extent.z, 1e-3);
    return {
      scale,
      offset: box.getCenter(new Vector3()).multiplyScalar(-scale),
    };
  }, [scene, size]);
  const mixer = useMemo(() => new AnimationMixer(scene), [scene]);
  useEffect(() => {
    for (const clip of animations) mixer.clipAction(clip).play();
    return () => {
      mixer.stopAllAction();
      mixer.uncacheRoot(scene);
    };
  }, [animations, mixer, scene]);
  return { scene, mixer, ...fit };
}

const particleCount = 100_000;

export function ParticleChapter() {
  const runtime = useWebGLRuntime();
  const material = useRef<ShaderMaterial>(null);
  const geometry = useMemo(() => createParticleGeometry(particleCount), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  // Initial values only; per-frame writes go through the material's uniforms.
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uPixelRatio: { value: 1 },
      uColor: { value: new Color("#7fb4ff") },
    }),
    [],
  );

  useFrame(({ clock, gl }) => {
    const live = material.current?.uniforms;
    if (!live) return;
    live.uTime.value = clock.elapsedTime;
    live.uOpacity.value = chapterWeight(benchProgress(runtime.scroll), 1);
    live.uPixelRatio.value = gl.getPixelRatio();
  });

  return (
    <points
      geometry={geometry}
      position={[0, 0, chapterZ(1)]}
      frustumCulled={false}
    >
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={particleVertexShader}
        fragmentShader={particleFragmentShader}
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </points>
  );
}

function createParticleGeometry(count: number) {
  const random = createRandom(0x5eed);
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let index = 0; index < count; index += 1) {
    const theta = random() * Math.PI * 2;
    const phi = Math.acos(2 * random() - 1);
    const radius = 2 + 4 * Math.cbrt(random());
    positions[index * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[index * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    positions[index * 3 + 2] = radius * Math.cos(phi);
    seeds[index] = random();
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("aSeed", new BufferAttribute(seeds, 1));
  return geometry;
}

// Mulberry32: deterministic so every run draws the same particle field.
function createRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

type DOMTextTexture = ReturnType<typeof createDOMTextTexture>;

/**
 * `replacement` adds a camera-attached copy of the title over its DOM box for
 * the diagnostic fixtures: `drawn` replaces the hidden DOM title, `missing`
 * reports ready but never renders (the bug the runtime should flag).
 */
export function TextChapter({
  controller,
  replacement,
}: ChapterProps & { readonly replacement?: "drawn" | "missing" }) {
  const runtime = useWebGLRuntime();
  const target = useDOMTarget(benchTitleTargetId);
  const material = useRef<ShaderMaterial>(null);
  const overlay = useRef<Mesh>(null);
  const [revision, setRevision] = useState<number>();
  const [snapshot, setSnapshot] = useState<DOMTextTexture | null>(null);
  const uniforms = useMemo(
    () => ({
      uMap: { value: null as CanvasTexture | null },
      uTime: { value: 0 },
      uOpacity: { value: 0 },
    }),
    [],
  );

  useEffect(() => {
    if (!target || revision === undefined) return;
    setSnapshot(createDOMTextTexture(target.element));
  }, [target, revision]);

  useEffect(() => () => snapshot?.dispose(), [snapshot]);

  const hasTexture = snapshot !== null;
  useEffect(() => {
    if (!target || !hasTexture) return;
    runtime.setTargetReady(benchTitleTargetId, true, target);
    controller.assetReady("text");
    return () => runtime.setTargetReady(benchTitleTargetId, false, target);
  }, [controller, hasTexture, runtime, target]);

  useFrame(({ camera, clock, size }) => {
    if (target && target.revision !== revision) setRevision(target.revision);
    const plane = overlay.current;
    if (plane && target && camera instanceof PerspectiveCamera) {
      // One unit in front of the camera, matching the title's CSS box.
      const height = 2 * Math.tan((camera.fov * Math.PI) / 360);
      const width = height * camera.aspect;
      const { left, top, width: w, height: h } = target.rect;
      plane.position.set(
        camera.position.x + ((left + w / 2) / size.width - 0.5) * width,
        camera.position.y + (0.5 - (top + h / 2) / size.height) * height,
        camera.position.z - 1,
      );
      plane.scale.set((w / size.width) * width, (h / size.height) * height, 1);
    }
    const live = material.current?.uniforms;
    if (!live || !snapshot) return;
    live.uMap.value = snapshot.texture;
    live.uTime.value = clock.elapsedTime;
    live.uOpacity.value = chapterWeight(benchProgress(runtime.scroll), 2);
  });

  const aspect = snapshot ? snapshot.height / Math.max(1, snapshot.width) : 0.2;
  return (
    <>
      {replacement && snapshot ? (
        <mesh
          ref={overlay}
          renderOrder={10}
          frustumCulled={false}
          visible={replacement === "drawn"}
        >
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial
            map={snapshot.texture}
            transparent
            depthTest={false}
            depthWrite={false}
          />
        </mesh>
      ) : null}
      <mesh position={[2.5, -2.8, chapterZ(2)]} scale={[8, 8 * aspect, 1]}>
        <planeGeometry args={[1, 1, 160, 40]} />
        <shaderMaterial
          ref={material}
          uniforms={uniforms}
          vertexShader={textWaveVertexShader}
          fragmentShader={textWaveFragmentShader}
          transparent
          depthWrite={false}
          side={DoubleSide}
        />
      </mesh>
    </>
  );
}

// Every fourth frame of the example's 454-frame sequence (1600×900 WebP).
const sequenceFrames = Array.from(
  { length: Math.ceil(454 / 4) },
  (_, index) =>
    `/example/bg-sequence/frame_${String(1 + index * 4).padStart(4, "0")}.webp`,
);
const sequenceConcurrency = 6;

type SequenceFrame = HTMLImageElement | ImageBitmap;

async function loadSequenceFrame(url: string, mode: BenchSequenceMode) {
  switch (mode) {
    case "every-frame":
    case "on-change": {
      const image = new Image();
      image.src = url;
      await image.decode();
      return image;
    }
    case "bitmap":
    case "bitmap-half": {
      const blob = await (await fetch(url)).blob();
      return createImageBitmap(blob, {
        imageOrientation: "flipY",
        ...(mode === "bitmap-half"
          ? { resizeWidth: 800, resizeHeight: 450, resizeQuality: "medium" }
          : {}),
      });
    }
  }
}

export function SequenceChapter({
  controller,
  mode,
}: ChapterProps & { readonly mode: BenchSequenceMode }) {
  const runtime = useWebGLRuntime();
  const material = useRef<MeshBasicMaterial>(null);
  const frames = useRef<Array<SequenceFrame | undefined>>([]);
  const texture = useMemo(() => {
    const created = new Texture();
    created.colorSpace = SRGBColorSpace;
    created.minFilter = LinearFilter;
    created.generateMipmaps = false;
    // Bitmaps are flipped while decoding; WebGL ignores UNPACK_FLIP_Y for them.
    created.flipY = mode === "every-frame" || mode === "on-change";
    return created;
  }, [mode]);
  useEffect(() => () => texture.dispose(), [texture]);

  useEffect(() => {
    let active = true;
    let next = 0;
    let settled = 0;
    const slots: Array<SequenceFrame | undefined> = [];
    frames.current = slots;
    const worker = async () => {
      while (active && next < sequenceFrames.length) {
        const index = next;
        next += 1;
        try {
          const frame = await loadSequenceFrame(sequenceFrames[index], mode);
          if (active) slots[index] = frame;
          else if (frame instanceof ImageBitmap) frame.close();
        } catch {
          // A missing frame keeps the previous image on screen.
        }
        settled += 1;
        if (active && settled === sequenceFrames.length)
          controller.assetReady("sequence");
      }
    };
    for (let index = 0; index < sequenceConcurrency; index += 1) void worker();
    return () => {
      active = false;
      for (const frame of slots) if (frame instanceof ImageBitmap) frame.close();
    };
  }, [controller, mode]);

  useFrame(() => {
    const progress = benchProgress(runtime.scroll);
    const local = Math.min(1, Math.max(0, chapterLocal(progress, 3)));
    const image =
      frames.current[Math.round(local * (sequenceFrames.length - 1))];
    // `every-frame` re-uploads even when the frame index is unchanged.
    if (image && (mode === "every-frame" || texture.image !== image)) {
      texture.image = image;
      texture.needsUpdate = true;
    }
    if (material.current) material.current.opacity = chapterWeight(progress, 3);
  });

  return (
    <mesh position={[0, 0, chapterZ(3)]}>
      <planeGeometry args={[16, 9]} />
      <meshBasicMaterial ref={material} map={texture} transparent />
    </mesh>
  );
}

const cardImages = [
  "/example/bg.png",
  "/example/image.png",
  "/example/show.png",
  "/example/mask.png",
];
const cardCount = 12;
const videoCard = 5;

export function CardsChapter({ controller }: ChapterProps) {
  const runtime = useWebGLRuntime();
  const textures = useTexture(cardImages, (loaded) => {
    for (const texture of loaded) texture.colorSpace = SRGBColorSpace;
  });
  const [video, setVideo] = useState<VideoTexture | null>(null);
  const group = useRef<Group>(null);
  const materials = useRef<Array<MeshStandardMaterial | null>>([]);

  useEffect(() => {
    const element = document.createElement("video");
    element.src = "/example/bg.mp4";
    element.muted = true;
    element.loop = true;
    element.playsInline = true;
    const texture = new VideoTexture(element);
    texture.colorSpace = SRGBColorSpace;
    // A blocked autoplay still lets the run start; the card stays dark.
    const ready = () => controller.assetReady("cards");
    element.addEventListener("canplay", ready, { once: true });
    element.play().catch(ready);
    setVideo(texture);
    return () => {
      element.removeEventListener("canplay", ready);
      element.pause();
      element.removeAttribute("src");
      element.load();
      texture.dispose();
    };
  }, [controller]);

  useFrame(({ clock }) => {
    const weight = chapterWeight(benchProgress(runtime.scroll), 4);
    group.current?.children.forEach((card, index) => {
      card.rotation.y = Math.sin(clock.elapsedTime * 0.6 + index) * 0.25;
    });
    for (const material of materials.current)
      if (material) material.opacity = weight;
  });

  return (
    <group ref={group} position={[0, 0, chapterZ(4)]}>
      {Array.from({ length: cardCount }, (_, index) => {
        const map =
          index === videoCard ? video : textures[index % textures.length];
        // A material compiled without a map ignores one assigned later, so
        // the video card mounts only once its texture exists.
        if (!map) return null;
        return (
          <mesh
            key={`card-${index}`}
            position={[
              ((index % 4) - 1.5) * 3.6,
              (1 - Math.floor(index / 4)) * 2.2,
              0,
            ]}
          >
            <planeGeometry args={[3.2, 1.8]} />
            <meshStandardMaterial
              ref={(material) => {
                materials.current[index] = material;
              }}
              map={map}
              roughness={0.35}
              metalness={0.1}
              transparent
            />
          </mesh>
        );
      })}
    </group>
  );
}

export function RaymarchChapter() {
  const runtime = useWebGLRuntime();
  const mesh = useRef<Mesh>(null);
  const material = useRef<ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uIntensity: { value: 0 },
      uResolution: { value: new Vector2(1, 1) },
    }),
    [],
  );

  // A full-screen layer one unit in front of the camera, drawn every frame
  // even while its intensity is zero.
  useFrame(({ camera, clock, size }) => {
    const node = mesh.current;
    const live = material.current?.uniforms;
    if (!node || !live || !(camera instanceof PerspectiveCamera)) return;
    const height = 2 * Math.tan((camera.fov * Math.PI) / 360);
    node.position.set(
      camera.position.x,
      camera.position.y,
      camera.position.z - 1,
    );
    node.scale.set(height * camera.aspect * 1.02, height * 1.02, 1);
    live.uTime.value = clock.elapsedTime;
    live.uIntensity.value = chapterWeight(benchProgress(runtime.scroll), 5);
    live.uResolution.value.set(size.width, size.height);
  });

  return (
    <mesh ref={mesh} renderOrder={-10} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={screenVertexShader}
        fragmentShader={raymarchFragmentShader}
        transparent
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  );
}
