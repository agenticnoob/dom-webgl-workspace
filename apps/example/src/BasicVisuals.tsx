import { PerspectiveCamera, useTexture } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type RefObject,
} from "react";
import { useWebGLRuntime } from "@viselora/dom-webgl/react";
import {
  drawDOMText,
  measureDOMText,
  type DOMTextLayout,
} from "@viselora/dom-webgl";
import {
  Box3,
  Mesh,
  MeshStandardMaterial,
  Texture,
  VideoTexture,
  SRGBColorSpace,
  LinearFilter,
  MeshBasicMaterial,
  type ShaderMaterial,
  type CanvasTexture,
  type Group,
} from "three";
import {
  canvasTexture,
  shaderUniforms,
  surfaceVertexShader,
  updateUniforms,
} from "./nativeMaterials";
import {
  createTextGlyphCommands,
  type TextMode,
  type TextOptions,
} from "./textEffects";
import { readTargetViewportProgress } from "./effectMath";
import {
  createSurfaceGhostCursorState,
  updateSurfaceGhostCursorState,
} from "./ghostCursorState";
import {
  createGhostCursorMaterialProgram,
  createGhostCursorUniforms,
} from "./ghostCursorSurface";
import {
  createSurfaceWavesMaterialProgram,
  createSurfaceWavesUniforms,
} from "./wavesMaterial";
import { drawCoverImage, drawPulseSurface } from "./surfaceEffectRenderers";
import {
  imageHoverRevealFragmentShader,
  readImageHoverRevealTrailOpacity,
  updateImageHoverRevealMask,
  type ImageHoverRevealState,
} from "./mediaEffects";
import {
  drawSequenceCardSurface,
  readSequenceCardGlow,
  readSequenceCardMotion,
} from "./sequenceCardEffect";
import type { FrameSequence } from "./frameSequence";
import { useClonedModel } from "./useClonedModel";

function usePresentation(id: string, retainText = false) {
  const runtime = useWebGLRuntime();
  useEffect(() => {
    const target = runtime.getTarget(id);
    if (!target) return;
    const color = target.element.style.backgroundColor;
    const syncBackground = () => {
      if (!retainText || runtime.getTarget(id) !== target) return;
      target.element.style.backgroundColor =
        runtime.getDebugState().ready && target.ready ? "transparent" : color;
    };
    const unsubscribe = retainText
      ? runtime.subscribe(syncBackground)
      : undefined;
    syncBackground();
    return () => {
      unsubscribe?.();
      if (retainText) target.element.style.backgroundColor = color;
      runtime.setTargetReady(id, false, target);
    };
  }, [runtime, id, retainText]);
  return {
    runtime,
    ready() {
      const target = runtime.getTarget(id);
      if (target && !target.ready) runtime.setTargetReady(id, true, target);
    },
  };
}

function useLocalPointer() {
  const point = useRef({ active: false, x: 0.5, y: 0.5 });
  return {
    point,
    events: {
      onPointerMove(event: { uv?: { x: number; y: number } }) {
        if (event.uv)
          point.current = { active: true, x: event.uv.x, y: 1 - event.uv.y };
      },
      onPointerOut() {
        point.current.active = false;
      },
    },
  };
}

function readCoverRepeat(
  width: number,
  height: number,
  mediaWidth: number,
  mediaHeight: number,
): [number, number] {
  if (width <= 0 || height <= 0 || mediaWidth <= 0 || mediaHeight <= 0)
    return [1, 1];
  const ratio = width / height / (mediaWidth / mediaHeight);
  return ratio < 1 ? [ratio, 1] : [1, 1 / ratio];
}

export function TextVisual({
  id,
  mode,
  options = {},
}: {
  readonly id: string;
  readonly mode: TextMode;
  readonly options?: TextOptions;
}) {
  const { runtime, ready } = usePresentation(id);
  const material = useRef<MeshBasicMaterial>(null);
  const { point, events } = useLocalPointer();
  const drawing = useRef<{
    canvas: HTMLCanvasElement;
    context: CanvasRenderingContext2D;
    layout: DOMTextLayout;
    texture: CanvasTexture;
    background: string;
    revision: number;
  } | null>(null);
  useEffect(
    () => () => {
      drawing.current?.texture.dispose();
      drawing.current = null;
    },
    [],
  );
  useFrame((state) => {
    const target = runtime.getTarget(id);
    if (!target || !material.current || target.rect.width <= 0) return;
    let current = drawing.current;
    if (
      !current ||
      current.revision !== target.revision ||
      current.layout.width !== target.rect.width ||
      current.layout.height !== target.rect.height
    ) {
      current?.texture.dispose();
      const layout = measureDOMText(target.element);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(
        1,
        Math.round(layout.width * layout.devicePixelRatio),
      );
      canvas.height = Math.max(
        1,
        Math.round(layout.height * layout.devicePixelRatio),
      );
      const context = canvas.getContext("2d");
      if (!context)
        throw new Error("Text examples require a 2D drawing context.");
      current = {
        canvas,
        context,
        layout,
        texture: canvasTexture(canvas),
        background: getComputedStyle(target.element).backgroundColor,
        revision: target.revision,
      };
      drawing.current = current;
      material.current.map = current.texture;
      material.current.needsUpdate = true;
    }
    const { context, layout } = current;
    context.setTransform(
      layout.devicePixelRatio,
      0,
      0,
      layout.devicePixelRatio,
      0,
      0,
    );
    context.clearRect(0, 0, layout.width, layout.height);
    context.fillStyle = current.background;
    context.fillRect(0, 0, layout.width, layout.height);
    const progress = options.progressKey
      ? runtime.progress.get(options.progressKey)
      : readTargetViewportProgress({
          top: target.rect.top,
          height: target.rect.height,
          viewport: { height: window.innerHeight },
        });
    drawDOMText(
      context,
      layout,
      createTextGlyphCommands(
        mode,
        layout.glyphs,
        {
          time: state.clock.elapsedTime * 1000,
          width: layout.width,
          height: layout.height,
          progress,
          pointer: {
            active: point.current.active,
            x: point.current.active
              ? point.current.x * layout.width
              : layout.width / 2,
            y: point.current.active
              ? point.current.y * layout.height
              : layout.height / 2,
          },
        },
        options,
      ),
    );
    current.texture.needsUpdate = true;
    ready();
  });
  return (
    <mesh {...events}>
      <planeGeometry args={[2, 2]} />
      <meshBasicMaterial ref={material} transparent toneMapped={false} />
    </mesh>
  );
}

export function SurfaceVisual({
  id,
  mode,
}: {
  readonly id: string;
  readonly mode: "fill" | "pulse" | "ghost" | "waves";
}) {
  const { runtime, ready } = usePresentation(id, true);
  const image = useTexture("/example/bg.png");
  const mesh = useRef<Mesh>(null);
  const { point, events } = useLocalPointer();
  const data = useRef<{
    canvas: HTMLCanvasElement;
    context: CanvasRenderingContext2D;
    texture: CanvasTexture;
    shader?: ShaderMaterial;
    width: number;
    height: number;
    background: string;
  } | null>(null);
  const ghost = useRef(
    createSurfaceGhostCursorState({ layout: { width: 1, height: 1 } }),
  );
  useEffect(
    () => () => {
      data.current?.shader?.dispose();
      data.current?.texture.dispose();
      data.current = null;
    },
    [],
  );
  useFrame((frame) => {
    const target = runtime.getTarget(id);
    if (!target || !mesh.current || target.rect.width <= 1) return;
    const { width, height } = target.rect;
    let current = data.current;
    if (!current || current.width !== width || current.height !== height) {
      current?.shader?.dispose();
      current?.texture.dispose();
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(width));
      canvas.height = Math.max(1, Math.round(height));
      const context = canvas.getContext("2d");
      if (!context)
        throw new Error("Surface examples require a 2D drawing context.");
      const background =
        mode === "ghost"
          ? "#07050c"
          : mode === "waves"
            ? "#dbe5df"
            : getComputedStyle(target.element).backgroundColor;
      context.fillStyle = background;
      context.fillRect(0, 0, width, height);
      current = {
        canvas,
        context,
        texture: canvasTexture(canvas),
        width,
        height,
        background,
      };
      data.current = current;
      if (mode === "ghost") {
        current.shader = createGhostCursorMaterialProgram(
          {
            color: "#b497cf",
            opacity: 0.92,
            pointerActive: false,
            pointerIntensity: 0,
            pointerX: width / 2,
            pointerY: height / 2,
            time: 0,
            trailLength: 36,
            width,
            height,
          },
          current.texture,
        );
        mesh.current.material = current.shader;
      } else if (mode === "waves") {
        current.shader = createSurfaceWavesMaterialProgram(
          {
            lineColor: "#172124",
            opacity: 0.82,
            pointerActive: false,
            pointerX: width / 2,
            pointerY: height / 2,
            time: 0,
            width,
            height,
          },
          current.texture,
        );
        mesh.current.material = current.shader;
      } else if (mesh.current.material instanceof MeshBasicMaterial) {
        mesh.current.material.map = current.texture;
        mesh.current.material.needsUpdate = true;
      }
      if (mode === "fill") {
        context.clearRect(0, 0, width, height);
        drawCoverImage(context, image.image as HTMLImageElement, width, height);
        current.texture.needsUpdate = true;
      }
    }
    const time = frame.clock.elapsedTime * 1000;
    const pointer = {
      active: point.current.active,
      x: point.current.x * width,
      y: point.current.y * height,
    };
    if (mode === "pulse") {
      drawPulseSurface(
        current.context,
        width,
        height,
        0.5 + Math.sin(time / 360) * 0.5,
        0.92,
        0.36,
      );
      current.texture.needsUpdate = true;
    }
    if (
      mode === "ghost" &&
      current.shader &&
      updateSurfaceGhostCursorState(ghost.current, pointer)
    ) {
      updateUniforms(
        current.shader.uniforms,
        createGhostCursorUniforms({
          color: "#b497cf",
          opacity: 0.92,
          pointerActive: pointer.active,
          pointerIntensity: ghost.current.intensity,
          pointerX: ghost.current.pointerX,
          pointerY: ghost.current.pointerY,
          trailPoints: ghost.current.trail,
          time,
          trailLength: 36,
          width,
          height,
        }),
      );
    }
    if (mode === "waves" && current.shader)
      updateUniforms(
        current.shader.uniforms,
        createSurfaceWavesUniforms({
          lineColor: "#172124",
          opacity: 0.82,
          pointerActive: pointer.active,
          pointerX: pointer.x,
          pointerY: pointer.y,
          time,
          width,
          height,
        }),
      );
    ready();
  });
  return (
    <mesh ref={mesh} {...events}>
      <planeGeometry args={[2, 2]} />
      <meshBasicMaterial
        transparent
        opacity={mode === "fill" ? 0.72 : 1}
        toneMapped={false}
      />
    </mesh>
  );
}

export function ImageVisual({
  id,
  src,
  mode,
}: {
  readonly id: string;
  readonly src: string;
  readonly mode: "pan" | "zoom" | "ken-burns";
}) {
  const { runtime, ready } = usePresentation(id);
  const cached = useTexture(src);
  const texture = useMemo(() => {
    const copy = cached.clone();
    copy.colorSpace = SRGBColorSpace;
    return copy;
  }, [cached]);
  const mesh = useRef<Mesh>(null);
  useEffect(() => () => texture.dispose(), [texture]);
  useFrame((frame) => {
    const target = runtime.getTarget(id);
    if (!target || !mesh.current) return;
    const time = frame.clock.elapsedTime * 1000;
    if (mode === "pan") {
      const progress = readTargetViewportProgress({
        top: target.rect.top,
        height: target.rect.height,
        viewport: { height: window.innerHeight },
      });
      texture.repeat.set(1.12, 1.12);
      texture.offset.set(0.2 * progress, 0);
    }
    if (mode === "zoom") {
      if (texture.image instanceof HTMLImageElement) {
        const [x, y] = readCoverRepeat(
          target.rect.width,
          target.rect.height,
          texture.image.naturalWidth,
          texture.image.naturalHeight,
        );
        texture.repeat.set(x, y);
        texture.offset.set((1 - x) / 2, (1 - y) / 2);
      }
      mesh.current.scale.setScalar(
        1 + 0.36 * (0.5 + Math.sin(time / 800) * 0.5),
      );
    }
    if (mode === "ken-burns") {
      const phase = 0.5 + Math.sin(time / 1200) * 0.5;
      const scale = 1 + 0.22 * (0.35 + phase * 0.65);
      texture.repeat.set(scale, scale);
      texture.offset.set(0.16 * phase, 0.16 * (1 - phase));
      mesh.current.scale.setScalar(1 + phase * 0.04);
    }
    ready();
  });
  return (
    <mesh ref={mesh}>
      <planeGeometry args={[2, 2]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}

export function HoverRevealVisual({ id }: { readonly id: string }) {
  const { runtime, ready } = usePresentation(id);
  const [base, reveal] = useTexture(["/example/show.png", "/example/mask.png"]);
  const material = useRef<ShaderMaterial>(null);
  const mask = useRef<ImageHoverRevealState>({});
  const maskTexture = useRef<CanvasTexture | null>(null);
  const { point, events } = useLocalPointer();
  const uniforms = useMemo(
    () =>
      shaderUniforms({
        uBaseTexture: base,
        uRevealTexture: reveal,
        uMaskTexture: null,
        uRevealReady: true,
        uUvRepeat: [1, 1],
        uUvOffset: [0, 0],
        uTrailOpacity: 0,
      }),
    [base, reveal],
  );
  useEffect(() => () => maskTexture.current?.dispose(), []);
  useFrame((frame) => {
    const target = runtime.getTarget(id);
    if (!target || !material.current) return;
    const time = frame.clock.elapsedTime * 1000;
    if (base.image instanceof HTMLImageElement) {
      const repeat = readCoverRepeat(
        target.rect.width,
        target.rect.height,
        base.image.naturalWidth,
        base.image.naturalHeight,
      );
      material.current.uniforms.uUvRepeat.value = repeat;
      material.current.uniforms.uUvOffset.value = [
        (1 - repeat[0]) / 2,
        (1 - repeat[1]) / 2,
      ];
    }
    const parameters = {
      radius: 132,
      feather: 42,
      restoreMs: 2200,
      roughness: 0.26,
    };
    const canvas = updateImageHoverRevealMask(
      time,
      mask.current,
      parameters,
      {
        active: point.current.active,
        x: point.current.x * target.rect.width,
        y: point.current.y * target.rect.height,
      },
      target.rect,
    );
    if (!maskTexture.current || maskTexture.current.image !== canvas) {
      maskTexture.current?.dispose();
      maskTexture.current = canvasTexture(canvas);
      material.current.uniforms.uMaskTexture.value = maskTexture.current;
    }
    maskTexture.current.needsUpdate = true;
    material.current.uniforms.uTrailOpacity.value =
      readImageHoverRevealTrailOpacity(time, mask.current, parameters);
    ready();
  });
  return (
    <mesh {...events}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={surfaceVertexShader}
        fragmentShader={imageHoverRevealFragmentShader}
        toneMapped={false}
      />
    </mesh>
  );
}

export function VideoVisual({
  id,
  src,
  playbackRate = 1,
  drift = false,
  background = false,
}: {
  readonly id: string;
  readonly src: string;
  readonly playbackRate?: number;
  readonly drift?: boolean;
  readonly background?: boolean;
}) {
  const { runtime, ready } = usePresentation(id, background);
  const material = useRef<MeshBasicMaterial>(null);
  const current = useRef<{
    video: HTMLVideoElement;
    texture: VideoTexture;
    playing: boolean;
    blocked: boolean;
  } | null>(null);
  useLayoutEffect(() => {
    const target = runtime.getTarget(id);
    if (!target || !material.current) return;
    const owned = !(target.element instanceof HTMLVideoElement);
    const video = owned
      ? document.createElement("video")
      : (target.element as HTMLVideoElement);
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.playbackRate = playbackRate;
    if (owned) video.src = src;
    const texture = new VideoTexture(video);
    texture.colorSpace = SRGBColorSpace;
    material.current.map = texture;
    material.current.needsUpdate = true;
    current.current = { video, texture, playing: false, blocked: false };
    return () => {
      current.current = null;
      video.pause();
      texture.dispose();
      if (owned) {
        video.removeAttribute("src");
        video.load();
      }
    };
  }, [runtime, id, src, playbackRate]);
  useFrame((frame) => {
    const target = runtime.getTarget(id);
    const item = current.current;
    if (!target || !item) return;
    if (target.visible !== item.playing) {
      item.playing = target.visible;
      if (item.playing)
        void item.video
          .play()
          .then(() => {
            item.blocked = false;
          })
          .catch(() => {
            item.blocked = true;
            runtime.setTargetReady(id, false, target);
          });
      else item.video.pause();
    }
    if (!target.visible || item.blocked || item.video.readyState < 2) return;
    if (drift) {
      const phase =
        0.5 + Math.sin((frame.clock.elapsedTime * 1000) / 900) * 0.5;
      item.texture.repeat.set(1.08, 1.08);
      item.texture.offset.set(0.12 * phase, 0.06 * (1 - phase));
    } else {
      const [x, y] = readCoverRepeat(
        target.rect.width,
        target.rect.height,
        item.video.videoWidth,
        item.video.videoHeight,
      );
      item.texture.repeat.set(x, y);
      item.texture.offset.set((1 - x) / 2, (1 - y) / 2);
    }
    ready();
  });
  return (
    <mesh>
      <planeGeometry args={[2, 2]} />
      <meshBasicMaterial
        ref={material}
        transparent
        opacity={background ? 0.84 : 1}
        toneMapped={false}
      />
    </mesh>
  );
}

export function SequenceVisual({
  id,
  sequence,
  progressKey,
  card,
}: {
  readonly id: string;
  readonly sequence: Pick<FrameSequence, "count" | "frameNear">;
  readonly progressKey: string;
  readonly card: RefObject<HTMLElement | null>;
}) {
  const { runtime, ready } = usePresentation(id);
  const texture = useMemo(() => {
    const value = new Texture();
    value.colorSpace = SRGBColorSpace;
    value.minFilter = LinearFilter;
    value.generateMipmaps = false;
    // Sequence bitmaps are flipped while decoding.
    value.flipY = false;
    return value;
  }, []);
  const { point, events } = useLocalPointer();
  useEffect(() => () => texture.dispose(), [texture]);
  useFrame(() => {
    const target = runtime.getTarget(id);
    if (!target || sequence.count === 0) return;
    const index = Math.min(
      sequence.count - 1,
      Math.floor(
        Math.max(0, runtime.progress.get(progressKey)) * (sequence.count - 1),
      ),
    );
    // Upload only when the frame changes.
    const image = sequence.frameNear(index);
    if (!image) return;
    if (texture.image !== image) {
      texture.image = image;
      texture.needsUpdate = true;
    }
    texture.repeat.set(0.92, 0.92);
    texture.offset.set(
      0.04 + (point.current.active ? point.current.x * 2 - 1 : 0) * 0.0288,
      0.04 + (point.current.active ? point.current.y * 2 - 1 : 0) * 0.0288,
    );
    ready();
  });
  return (
    <>
      <mesh {...events}>
        <planeGeometry args={[2, 2]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
      <SequenceCard id={id} progressKey={progressKey} card={card} />
    </>
  );
}

function SequenceCard({
  id,
  progressKey,
  card,
}: {
  readonly id: string;
  readonly progressKey: string;
  readonly card: RefObject<HTMLElement | null>;
}) {
  const runtime = useWebGLRuntime();
  const mesh = useRef<Mesh>(null);
  const material = useRef<MeshBasicMaterial>(null);
  const drawing = useRef<{
    context: CanvasRenderingContext2D;
    texture: CanvasTexture;
    width: number;
    height: number;
    revision: number;
    texts: { layout: DOMTextLayout; x: number; y: number }[];
  } | null>(null);
  const { point, events } = useLocalPointer();
  useEffect(() => () => drawing.current?.texture.dispose(), []);
  useFrame(() => {
    const target = runtime.getTarget(id);
    const element = card.current;
    if (!target || !element || !mesh.current || !material.current) return;
    const rect = element.getBoundingClientRect();
    let current = drawing.current;
    if (
      !current ||
      current.revision !== target.revision ||
      current.width !== rect.width ||
      current.height !== rect.height
    ) {
      current?.texture.dispose();
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(rect.width));
      canvas.height = Math.max(1, Math.round(rect.height));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Sequence card requires a 2D context.");
      const texts = Array.from(element.children)
        .filter((child): child is HTMLElement => child instanceof HTMLElement)
        .map((child) => {
          const box = child.getBoundingClientRect();
          return {
            layout: measureDOMText(child, { devicePixelRatio: 1 }),
            x: box.left - rect.left,
            y: box.top - rect.top,
          };
        });
      current = {
        context,
        texture: canvasTexture(canvas),
        width: rect.width,
        height: rect.height,
        revision: target.revision,
        texts,
      };
      drawing.current = current;
      material.current.map = current.texture;
      material.current.needsUpdate = true;
    }
    const progress = runtime.progress.get(progressKey);
    const motion = readSequenceCardMotion(progress);
    const pointer = {
      active: point.current.active,
      x: point.current.x * rect.width,
      y: point.current.y * rect.height,
    };
    drawSequenceCardSurface(
      current.context,
      rect.width,
      rect.height,
      readSequenceCardGlow(pointer, rect, {
        edgeSensitivity: 0.28,
        colorSensitivity: 0.48,
        glowIntensity: 1,
        glowRadius: 44,
        fillOpacity: 0.46,
      }),
    );
    for (const text of current.texts) {
      current.context.save();
      current.context.translate(text.x, text.y);
      drawDOMText(
        current.context,
        text.layout,
        createTextGlyphCommands(
          "reveal",
          text.layout.glyphs,
          {
            progress,
            time: 0,
            width: text.layout.width,
            height: text.layout.height,
            pointer: { active: false, x: 0, y: 0 },
          },
          { color: text.layout.color },
        ),
      );
      current.context.restore();
    }
    current.texture.needsUpdate = true;
    mesh.current.position.set(
      ((rect.left - target.rect.left + rect.width / 2 + motion.offsetX) /
        target.rect.width) *
        2 -
        1,
      1 -
        ((rect.top - target.rect.top + rect.height / 2) / target.rect.height) *
          2,
      0.1,
    );
    mesh.current.scale.set(
      (rect.width / target.rect.width) * 2,
      (rect.height / target.rect.height) * 2,
      1,
    );
    material.current.opacity = 0.72 + 0.28 * motion.presence;
  });
  return (
    <mesh ref={mesh} {...events}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial ref={material} transparent toneMapped={false} />
    </mesh>
  );
}

export function ModelVisual({
  id,
  src,
  mode,
  dracoPath,
}: {
  readonly id: string;
  readonly src: string;
  readonly mode: "spin" | "float" | "glow";
  readonly dracoPath?: string;
}) {
  const { runtime, ready } = usePresentation(id);
  const { scene } = useClonedModel(src, dracoPath);
  const group = useRef<Group>(null);
  const framing = useMemo(() => {
    const box = new Box3().setFromObject(scene);
    return {
      center: box.getCenter(scene.position.clone()),
      size: box.getSize(scene.scale.clone()),
    };
  }, [scene]);
  useEffect(() => {
    if (mode !== "glow") return;
    const clones: MeshStandardMaterial[] = [];
    const originals: { mesh: Mesh; material: Mesh["material"] }[] = [];
    scene.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      originals.push({ mesh: object, material: object.material });
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      const next = materials.map((material) => {
        if (!(material instanceof MeshStandardMaterial)) return material;
        const copy = material.clone();
        copy.emissive.set("#7dd3fc");
        copy.emissiveIntensity = 1.5;
        clones.push(copy);
        return copy;
      });
      object.material = Array.isArray(object.material) ? next : next[0];
    });
    return () => {
      for (const item of originals) item.mesh.material = item.material;
      for (const material of clones) material.dispose();
    };
  }, [scene, mode]);
  useFrame((frame) => {
    const target = runtime.getTarget(id);
    if (!target || !group.current) return;
    group.current.visible = target.visible;
    if (!target.visible) return;
    const time = frame.clock.elapsedTime * 1000;
    const viewHeight = 9 * Math.tan(Math.PI / 8);
    const scale =
      Math.min(
        viewHeight / Math.max(0.01, framing.size.y),
        (viewHeight * target.rect.width) /
          Math.max(1, target.rect.height) /
          Math.max(0.01, framing.size.x, framing.size.z),
      ) * 0.74;
    scene.position.copy(framing.center).multiplyScalar(-1);
    group.current.scale.setScalar(scale);
    group.current.position.y =
      mode === "float"
        ? ((Math.sin(time / 700) * 24) / Math.max(1, target.rect.height)) *
          viewHeight
        : 0;
    group.current.rotation.set(
      mode === "spin"
        ? 0
        : Math.sin(time / (mode === "glow" ? 1100 : 1000)) * 0.18,
      mode === "float"
        ? time / 1800
        : (time / 1000) * (mode === "glow" ? 0.46 : 0.25),
      0,
    );
    ready();
  });
  return (
    <>
      <color
        attach="background"
        args={[
          mode === "glow"
            ? "#000000"
            : mode === "float"
              ? "#cdd6e8"
              : "#d7e1d6",
        ]}
      />
      <PerspectiveCamera makeDefault position={[0, 0, 4.5]} fov={45} />
      <ambientLight intensity={0.45} />
      <directionalLight position={[1, 1.5, 2]} intensity={1} />
      {mode === "glow" && (
        <pointLight color="#7dd3fc" intensity={1.8} position={[0, 0, 2]} />
      )}
      <group ref={group}>
        <primitive object={scene} dispose={null} />
      </group>
    </>
  );
}
