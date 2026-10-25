// Recipe R8: a DOM heading drawn as cast glass that refracts the page behind
// it, with dispersion at the edges and a highlight that follows the pointer.
//
// The heading stays real DOM. Its glyphs become a crisp coverage mask and a
// blurred height map (once per revision, on the CPU); the surface normal comes
// from the height map. Instead of rendering the scene a second time, the
// shader rebuilds what lies behind the heading: the page colour, an optional
// CSS baseline grid that scrolls with the page, and optional ink from
// InkField. So the refraction is exact for those layers and costs one quad.
//
// Budget at medium: one draw call over the heading box; three backdrop samples
// per pixel (one at `low`, which also halves the refraction).
//
// - Wrap the heading in `<WebGLTarget id hideWhenReady>`; the component is a
//   section over that target and reports ready once its textures exist.
// - Match `paper` and `grid` to the page's CSS background, which should be on
//   `body`, or the glass shows a different backdrop than its surroundings.
// - Reduced motion: the highlight stays still when the pointer is away.
import { useFrame } from "@react-three/fiber";
import { drawDOMText, measureDOMText } from "@viselora/dom-webgl";
import {
  WebGLSection,
  useDOMTarget,
  useRenderQuality,
  useWebGLRuntime,
} from "@viselora/dom-webgl/react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CanvasTexture,
  Color,
  LinearFilter,
  Vector2,
  type Mesh,
  type ShaderMaterial,
} from "three";

import type { InkStore } from "./InkField";
import { clamp01, coverRect, damp } from "./screenSpace";

export type GlassGrid = {
  /** Distance between lines in CSS pixels. */
  readonly spacing: number;
  readonly color: string;
  /** Line opacity, 0..1 (default 1). */
  readonly opacity?: number;
};

export type GlassTitleProps = {
  readonly target: string;
  /** The page background colour behind the heading. */
  readonly paper: string;
  /** Horizontal lines matching a CSS background grid on `body`. */
  readonly grid?: GlassGrid;
  /** Ink to refract; pass the store given to InkField and its opacity. */
  readonly ink?: { readonly store: InkStore; readonly opacity?: number };
  /** Colour the glass body leans toward (default a cool grey). */
  readonly tint?: string;
};

type GlassMaps = {
  readonly mask: CanvasTexture;
  readonly height: CanvasTexture;
  readonly heightTexel: Vector2;
  dispose(): void;
};

/** Largest height-map side; blur cost grows with its area. */
const heightMapMax = 768;

/**
 * Crisp coverage of the heading's glyphs, and a blurred copy used as the glass
 * height (thick in the middle of strokes, thin at their edges).
 */
export function createGlassMaps(element: HTMLElement): GlassMaps | undefined {
  const layout = measureDOMText(element);
  if (layout.glyphs.length === 0) return undefined;
  const dpr = layout.devicePixelRatio;
  const maskCanvas = element.ownerDocument.createElement("canvas");
  maskCanvas.width = Math.max(1, Math.ceil(layout.width * dpr));
  maskCanvas.height = Math.max(1, Math.ceil(layout.height * dpr));
  const maskContext = maskCanvas.getContext("2d");
  if (!maskContext) return undefined;
  maskContext.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawDOMText(maskContext, { ...layout, color: "#ffffff" });

  const scale = Math.min(1, heightMapMax / Math.max(layout.width, layout.height));
  const width = Math.max(1, Math.round(layout.width * scale));
  const height = Math.max(1, Math.round(layout.height * scale));
  const heightCanvas = element.ownerDocument.createElement("canvas");
  heightCanvas.width = width;
  heightCanvas.height = height;
  const heightContext = heightCanvas.getContext("2d", { willReadFrequently: true });
  if (!heightContext) return undefined;
  heightContext.drawImage(maskCanvas, 0, 0, width, height);
  const image = heightContext.getImageData(0, 0, width, height);
  const values = new Float32Array(width * height);
  for (let index = 0; index < values.length; index += 1)
    values[index] = image.data[index * 4 + 3] / 255;
  // Stroke width scales with the font; so does the bevel.
  const radius = Math.max(1, Math.round(layout.lineHeight * scale * 0.05));
  const blurred = blurField(blurField(values, width, height, radius), width, height, radius);
  for (let index = 0; index < blurred.length; index += 1) {
    const value = Math.round(Math.min(1, blurred[index]) * 255);
    image.data[index * 4] = value;
    image.data[index * 4 + 1] = value;
    image.data[index * 4 + 2] = value;
    image.data[index * 4 + 3] = 255;
  }
  heightContext.putImageData(image, 0, 0);

  // Both maps are data (coverage and height), so they stay in linear space.
  const mask = new CanvasTexture(maskCanvas);
  mask.minFilter = LinearFilter;
  mask.generateMipmaps = false;
  const heightTexture = new CanvasTexture(heightCanvas);
  heightTexture.minFilter = LinearFilter;
  heightTexture.generateMipmaps = false;
  let disposed = false;
  return {
    mask,
    height: heightTexture,
    heightTexel: new Vector2(1 / width, 1 / height),
    dispose() {
      if (disposed) return;
      disposed = true;
      mask.dispose();
      heightTexture.dispose();
    },
  };
}

/** Separable box blur of a scalar field; edges clamp. */
export function blurField(
  values: Float32Array,
  width: number,
  height: number,
  radius: number,
) {
  const horizontal = new Float32Array(values.length);
  const out = new Float32Array(values.length);
  const span = radius * 2 + 1;
  for (let y = 0; y < height; y += 1) {
    let sum = 0;
    for (let x = -radius; x <= radius; x += 1)
      sum += values[y * width + Math.min(width - 1, Math.max(0, x))];
    for (let x = 0; x < width; x += 1) {
      horizontal[y * width + x] = sum / span;
      const drop = values[y * width + Math.max(0, x - radius)];
      const add = values[y * width + Math.min(width - 1, x + radius + 1)];
      sum += add - drop;
    }
  }
  for (let x = 0; x < width; x += 1) {
    let sum = 0;
    for (let y = -radius; y <= radius; y += 1)
      sum += horizontal[Math.min(height - 1, Math.max(0, y)) * width + x];
    for (let y = 0; y < height; y += 1) {
      out[y * width + x] = sum / span;
      const drop = horizontal[Math.max(0, y - radius) * width + x];
      const add = horizontal[Math.min(height - 1, y + radius + 1) * width + x];
      sum += add - drop;
    }
  }
  return out;
}

const glassVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const glassFragment = /* glsl */ `
uniform sampler2D uMask;
uniform sampler2D uHeight;
uniform sampler2D uInk;
uniform vec2 uHeightTexel;
uniform vec2 uViewport;
uniform float uDpr;
uniform float uScrollY;
uniform vec3 uPaper;
uniform vec3 uGridColor;
uniform float uGridSpacing;
uniform float uGridOpacity;
uniform float uInkOpacity;
uniform float uHasInk;
uniform vec3 uTint;
uniform float uRefract;
uniform float uDispersion;
uniform vec2 uLight;
uniform float uLightOn;
varying vec2 vUv;

vec3 backdrop(vec2 css) {
  vec3 color = uPaper;
  if (uGridOpacity > 0.0) {
    // CSS draws each line in the first pixel of its tile, in document space.
    float y = mod(css.y + uScrollY, uGridSpacing);
    float line = 1.0 - smoothstep(1.0 - 0.5 / uDpr, 1.0 + 0.5 / uDpr, y);
    color = mix(color, uGridColor, line * uGridOpacity);
  }
  if (uHasInk > 0.5) {
    vec4 dye = texture2D(uInk, vec2(css.x / uViewport.x, 1.0 - css.y / uViewport.y));
    float density = max(dye.a, 0.0);
    float alpha = (1.0 - exp(-density * 2.2)) * uInkOpacity;
    color = mix(color, dye.rgb / max(density, 1e-4), alpha);
  }
  return color;
}

void main() {
  float coverage = texture2D(uMask, vUv).a;
  if (coverage < 0.004) discard;
  float h = texture2D(uHeight, vUv).r;
  float hx = texture2D(uHeight, vUv + vec2(uHeightTexel.x, 0.0)).r - texture2D(uHeight, vUv - vec2(uHeightTexel.x, 0.0)).r;
  float hy = texture2D(uHeight, vUv + vec2(0.0, uHeightTexel.y)).r - texture2D(uHeight, vUv - vec2(0.0, uHeightTexel.y)).r;
  vec3 normal = normalize(vec3(-hx * 6.0, -hy * 6.0, 1.0));

  vec2 css = vec2(gl_FragCoord.x, uViewport.y * uDpr - gl_FragCoord.y) / uDpr;
  // Refract more where the glass is thick; flip y into CSS space.
  vec2 offset = normal.xy * vec2(1.0, -1.0) * uRefract * (0.35 + h);
  vec3 seen;
  if (uDispersion > 0.0) {
    seen.r = backdrop(css + offset * (1.0 - uDispersion)).r;
    seen.g = backdrop(css + offset).g;
    seen.b = backdrop(css + offset * (1.0 + uDispersion)).b;
  } else {
    seen = backdrop(css + offset);
  }

  // Glass body: a little darker and tinted where thick.
  vec3 color = mix(seen, seen * uTint, 0.2 + 0.3 * h);
  // Rim: grazing angles reflect more.
  float fresnel = pow(1.0 - normal.z, 2.0);
  color += fresnel * 0.55;
  // A highlight from a light above the pointer.
  vec3 toLight = normalize(vec3(uLight - css, 260.0) * vec3(1.0, -1.0, 1.0));
  float spec = pow(max(dot(reflect(-toLight, normal), vec3(0.0, 0.0, 1.0)), 0.0), 48.0);
  color += spec * 0.9 * uLightOn;
  // Edge darkening where the bevel turns away.
  color *= 1.0 - 0.25 * smoothstep(0.15, 0.6, length(normal.xy));

  gl_FragColor = vec4(color * coverage, coverage);
  #include <colorspace_fragment>
}`;

const refractByTier = { high: 22, medium: 16, low: 8 } as const;
const dispersionByTier = { high: 0.28, medium: 0.2, low: 0 } as const;

export function GlassTitle(props: GlassTitleProps) {
  return (
    <WebGLSection target={props.target} name="glass-title">
      <Glass {...props} />
    </WebGLSection>
  );
}

function Glass({ target: id, paper, grid, ink, tint = "#c9d3dc" }: GlassTitleProps) {
  const runtime = useWebGLRuntime();
  const target = useDOMTarget(id);
  const { tier, reducedMotion } = useRenderQuality();
  const mesh = useRef<Mesh>(null);
  const material = useRef<ShaderMaterial>(null);
  const [revision, setRevision] = useState(-1);
  const maps = useMemo(
    () =>
      revision >= 0 && target?.element ? createGlassMaps(target.element) : undefined,
    // `revision` is the rebuild signal; the element is read from the target.
    [revision, target],
  );
  useEffect(() => () => maps?.dispose(), [maps]);
  useEffect(() => {
    if (!target || !maps) return;
    runtime.setTargetReady(id, true, target);
    return () => runtime.setTargetReady(id, false, target);
  }, [runtime, target, maps, id]);

  const uniforms = useMemo(
    () => ({
      uMask: { value: maps?.mask ?? null },
      uHeight: { value: maps?.height ?? null },
      uInk: { value: null },
      uHeightTexel: { value: maps?.heightTexel ?? new Vector2(1, 1) },
      uViewport: { value: new Vector2(1, 1) },
      uDpr: { value: 1 },
      uScrollY: { value: 0 },
      uPaper: { value: new Color(paper) },
      uGridColor: { value: new Color(grid?.color ?? paper) },
      uGridSpacing: { value: grid?.spacing ?? 1 },
      uGridOpacity: { value: grid ? (grid.opacity ?? 1) : 0 },
      uInkOpacity: { value: ink?.opacity ?? 0.85 },
      uHasInk: { value: 0 },
      uTint: { value: new Color(tint) },
      uRefract: { value: refractByTier.medium },
      uDispersion: { value: dispersionByTier.medium },
      uLight: { value: new Vector2() },
      uLightOn: { value: 1 },
    }),
    [maps, paper, grid, ink, tint],
  );
  const light = useMemo(
    () => ({ position: new Vector2(Number.NaN, Number.NaN), on: 0, phase: 0 }),
    [],
  );

  useFrame(({ camera, size, pointer, gl }, delta) => {
    const live = target;
    if (live && live.revision !== revision) setRevision(live.revision);
    const node = mesh.current;
    const values = material.current?.uniforms;
    if (!node || !values || !live || !maps || live.rect.width <= 0) return;
    coverRect(node, camera, live.rect, size, 1);
    values.uViewport.value.set(size.width, size.height);
    values.uDpr.value = gl.getPixelRatio();
    values.uScrollY.value = runtime.scroll.scrollY;
    values.uRefract.value = refractByTier[tier];
    values.uDispersion.value = dispersionByTier[tier];
    const dye = ink?.store.dye ?? null;
    values.uInk.value = dye;
    values.uHasInk.value = dye ? 1 : 0;

    // The light sits above the pointer; away from the heading it drifts slowly.
    const pointerX = ((pointer.x + 1) / 2) * size.width;
    const pointerY = ((1 - pointer.y) / 2) * size.height;
    const rect = live.rect;
    const near =
      pointerX > rect.left - 120 &&
      pointerX < rect.left + rect.width + 120 &&
      pointerY > rect.top - 120 &&
      pointerY < rect.top + rect.height + 120;
    if (!reducedMotion) light.phase += delta * 0.35;
    const driftX = rect.left + rect.width * (0.5 + 0.4 * Math.sin(light.phase));
    const driftY = rect.top + rect.height * (0.3 + 0.2 * Math.cos(light.phase * 1.3));
    const goalX = near ? pointerX : driftX;
    const goalY = near ? pointerY : driftY;
    if (Number.isNaN(light.position.x)) light.position.set(goalX, goalY);
    light.position.set(
      damp(light.position.x, goalX, 0.12, delta),
      damp(light.position.y, goalY, 0.12, delta),
    );
    light.on = damp(light.on, near || !reducedMotion ? 1 : 0.4, 0.3, delta);
    values.uLight.value.copy(light.position);
    values.uLightOn.value = clamp01(light.on);
  });

  if (!maps) return null;
  return (
    <mesh ref={mesh} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={glassVertex}
        fragmentShader={glassFragment}
        transparent
        depthWrite={false}
        premultipliedAlpha
      />
    </mesh>
  );
}

