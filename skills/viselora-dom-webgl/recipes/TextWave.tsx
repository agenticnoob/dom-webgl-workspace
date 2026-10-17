// Recipe: DOM text rendered into a texture and animated with a wave shader.
//
// - The texture is rebuilt whenever `target.revision` changes (content, font
//   loading, resize, re-wrapping). `revision` is a mutable field on the target:
//   changing it does NOT re-render React, so poll it in useFrame and copy it
//   into state. Reading it only during render leaves a stale, stretched texture.
// - The previous texture is disposed only after its replacement is committed.
// - Readiness is set once a texture exists and stays set across rebuilds, so
//   the DOM text does not flash during a resize.
// - The DOM heading stays the semantic, accessible text (opacity only).
//
// Alignment caveat for @viselora/dom-webgl 0.2.0-alpha.0: createDOMTextTexture
// and drawDOMText draw each line at the top of its line box and ignore CSS
// half-leading, so the texture sits higher than the DOM glyphs whenever
// line-height is larger than the font's content height (about 11px too high
// at 72px with `line-height: normal`, 22px with `line-height: 1.5`). This recipe draws the lines itself from the
// measureDOMText layout with a half-leading baseline. Give the text an explicit
// line-height (e.g. 1.1); `normal` is measured as 1.2em and can drift slightly.
// The repository source has an unreleased fix (alphabetic baseline with
// half-leading); once a release containing it is the compatible version,
// createDOMTextTexture can replace createAlignedTextTexture.
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import {
  CanvasTexture,
  LinearFilter,
  SRGBColorSpace,
  Vector2,
  type Mesh,
  type ShaderMaterial,
} from "three";
import { measureDOMText } from "@viselora/dom-webgl";
import {
  useDOMTarget,
  useWebGLRuntime,
  WebGLRuntime,
  WebGLTarget,
} from "@viselora/dom-webgl/react";

export type AlignedTextTexture = {
  texture: CanvasTexture;
  width: number;
  height: number;
  dispose(): void;
};

/** Like createDOMTextTexture, but places glyphs on the CSS baseline. */
export function createAlignedTextTexture(
  element: HTMLElement,
): AlignedTextTexture {
  const canvas = element.ownerDocument.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("DOM text textures require a 2D canvas.");
  const layout = measureDOMText(element, { context });
  const dpr = layout.devicePixelRatio;
  canvas.width = Math.max(1, Math.ceil(layout.width * dpr));
  canvas.height = Math.max(1, Math.ceil(layout.height * dpr));
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.font = layout.font;
  context.fillStyle = layout.color;
  context.textAlign = "left";
  context.textBaseline = "alphabetic";
  const metrics = context.measureText("Hg");
  const ascent = finite(metrics.fontBoundingBoxAscent, metrics.actualBoundingBoxAscent);
  const descent = finite(metrics.fontBoundingBoxDescent, metrics.actualBoundingBoxDescent);
  // CSS centres the font's content area (ascent + descent) in the line box.
  const baseline = (lineTop: number) =>
    lineTop + (layout.lineHeight - ascent - descent) / 2 + ascent;
  if (layout.letterSpacing === 0 && layout.wordSpacing === 0) {
    for (const line of layout.lines)
      context.fillText(line.text, line.x, baseline(line.y));
  } else {
    for (const glyph of layout.glyphs)
      context.fillText(glyph.char, glyph.x, baseline(glyph.y));
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  return {
    texture,
    width: layout.width,
    height: layout.height,
    dispose: () => texture.dispose(),
  };
}

function finite(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

const vertexShader = /* glsl */ `
uniform float uTime;
uniform float uAmplitude; // CSS pixels
uniform float uFrequency; // waves across the text
uniform vec2 uSize;       // target size in CSS pixels
varying vec2 vUv;
void main() {
  vUv = uv;
  vec3 p = position;
  p.y += sin(uv.x * 6.2831853 * uFrequency + uTime * 2.5) * uAmplitude / max(uSize.y, 1.0);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

const fragmentShader = /* glsl */ `
uniform sampler2D uMap;
varying vec2 vUv;
void main() {
  gl_FragColor = texture2D(uMap, vUv);
  #include <colorspace_fragment>
}`;

export type WaveTextProps = {
  targetId: string;
  /** Peak vertical displacement in CSS pixels. */
  amplitude?: number;
  frequency?: number;
};

export function WaveText({ targetId, amplitude = 4, frequency = 1.5 }: WaveTextProps) {
  const target = useDOMTarget(targetId);
  const runtime = useWebGLRuntime();
  const mesh = useRef<Mesh>(null);
  const material = useRef<ShaderMaterial>(null);
  const [revision, setRevision] = useState<number>();
  const [snapshot, setSnapshot] = useState<AlignedTextTexture | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  // Initial values only: R3F copies them into the material's own uniforms, so
  // per-frame updates go through `material.current.uniforms`.
  const uniforms = useMemo(
    () => ({
      uMap: { value: null as CanvasTexture | null },
      uTime: { value: 0 },
      uAmplitude: { value: 0 },
      uFrequency: { value: 0 },
      uSize: { value: new Vector2(1, 1) },
    }),
    [],
  );

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  // Rebuild for every observed revision of the current target.
  useEffect(() => {
    if (!target || revision === undefined) return;
    setSnapshot(createAlignedTextTexture(target.element));
  }, [target, revision]);

  // Dispose a texture once it has been replaced or the component unmounts.
  useEffect(() => () => snapshot?.dispose(), [snapshot]);

  const hasTexture = snapshot !== null;
  useEffect(() => {
    if (!target || !hasTexture) return;
    runtime.setTargetReady(targetId, true, target);
    return () => runtime.setTargetReady(targetId, false, target);
  }, [runtime, target, targetId, hasTexture]);

  useFrame(({ size, clock }) => {
    // Poll the mutable revision; a state update triggers the rebuild effect.
    if (target && target.revision !== revision) setRevision(target.revision);
    const node = mesh.current;
    const shader = material.current;
    if (!node || !shader || !target || !snapshot) return;
    node.visible = target.visible;
    const { left, top, width, height } = target.rect;
    node.position.set(left + width / 2 - size.width / 2, size.height / 2 - top - height / 2, 0);
    node.scale.set(width, height, 1);
    const live = shader.uniforms;
    live.uMap.value = snapshot.texture;
    live.uTime.value = clock.elapsedTime;
    live.uAmplitude.value = reducedMotion ? 0 : amplitude;
    live.uFrequency.value = frequency;
    live.uSize.value.set(width, height);
  });

  return (
    <mesh ref={mesh} visible={false}>
      <planeGeometry args={[1, 1, 96, 1]} />
      <shaderMaterial
        ref={material}
        transparent
        depthWrite={false}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
      />
    </mesh>
  );
}

export function TextWaveExample() {
  return (
    <WebGLRuntime
      canvas={{ orthographic: true, camera: { position: [0, 0, 500] } }}
      scene={<WaveText targetId="wave" />}
    >
      <main>
        <WebGLTarget id="wave" hideWhenReady>
          <h1 style={{ fontSize: 72, lineHeight: 1.1, margin: 0 }}>
            Words that ripple through light
          </h1>
        </WebGLTarget>
        <p>Body copy stays in the DOM.</p>
      </main>
    </WebGLRuntime>
  );
}
