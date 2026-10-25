// Recipe R7: ink in water behind the page, stirred by the pointer.
//
// A small stable-fluids simulation (advection, vorticity, pressure projection)
// runs in half-float render targets on the page's own renderer, inside
// useFrame, and its dye is drawn as one transparent quad behind everything.
// Moving the pointer injects velocity and ink; fast strokes add the accent.
//
// Budget at medium: grid 96 cells high, 14 pressure iterations, dye 384 high;
// about 25 small full-target passes per frame while ink is moving, none once
// it has faded (the simulation stops about 6 s after the last stroke).
//
// - It is a section over `progress` (or always on without one); offscreen, it
//   neither simulates nor draws.
// - Without half-float render targets (EXT_color_buffer_float or
//   EXT_color_buffer_half_float) it draws nothing; the page reads the same.
// - `store.dye` exposes the current dye texture for effects that refract it
//   (see GlassTitle); it is null while there is none.
// - Reduced motion: strokes leave still ink that fades; no swirl.
import { useFrame, useThree } from "@react-three/fiber";
import {
  WebGLSection,
  useRenderQuality,
  type WebGLSectionProgressRange,
} from "@viselora/dom-webgl/react";
import { useEffect, useMemo, useRef } from "react";
import {
  Camera,
  Color,
  HalfFloatType,
  LinearFilter,
  Mesh,
  NoBlending,
  PlaneGeometry,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderTarget,
  type Texture,
  type WebGLRenderer,
} from "three";

import { damp } from "./screenSpace";

/** Shared with effects that read the ink, such as a refracting title. */
export type InkStore = { dye: Texture | null };

export function createInkStore(): InkStore {
  return { dye: null };
}

export type InkFieldProps = {
  readonly store?: InkStore;
  /** Section range; without one the field is always on. */
  readonly progress?: WebGLSectionProgressRange;
  readonly ink: string;
  readonly accent: string;
  /** Overall ink opacity (default 0.85). */
  readonly opacity?: number;
};

const gridByTier = { high: 128, medium: 96, low: 64 } as const;
const dyeByTier = { high: 512, medium: 384, low: 256 } as const;
const pressureByTier = { high: 20, medium: 14, low: 8 } as const;
const curlByTier = { high: 24, medium: 18, low: 0 } as const;
/** Seconds after the last stroke before the simulation stops. */
const idleSeconds = 6;

export function InkField(props: InkFieldProps) {
  return props.progress ? (
    <WebGLSection progress={props.progress} name="ink-field">
      <Ink {...props} />
    </WebGLSection>
  ) : (
    <WebGLSection always name="ink-field">
      <Ink {...props} />
    </WebGLSection>
  );
}

function Ink({
  store,
  ink,
  accent,
  opacity = 0.85,
}: InkFieldProps) {
  const gl = useThree((state) => state.gl);
  // Rebuilt when the canvas shape changes noticeably, so ink is not stretched.
  const aspect = useThree(
    (state) => Math.round((state.size.width / Math.max(1, state.size.height)) * 4) / 4,
  );
  const { tier, reducedMotion } = useRenderQuality();
  const supported = useMemo(() => supportsHalfFloatTargets(gl), [gl]);
  const sim = useMemo(
    () =>
      supported
        ? createSimulation(gridByTier[tier], dyeByTier[tier], aspect)
        : undefined,
    [supported, tier, aspect],
  );
  useEffect(() => () => sim?.dispose(), [sim]);
  useEffect(
    () => () => {
      if (store) store.dye = null;
    },
    [store, sim],
  );
  const plane = useRef<Mesh>(null);
  const display = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uDye: { value: null },
          uOpacity: { value: opacity },
        },
        vertexShader: passVertex,
        fragmentShader: displayFragment,
        transparent: true,
        depthWrite: false,
        premultipliedAlpha: true,
      }),
    [opacity],
  );
  useEffect(() => () => display.dispose(), [display]);
  const stroke = useMemo(
    () => ({
      last: new Vector2(Number.NaN, Number.NaN),
      speed: 0,
      idle: Number.POSITIVE_INFINITY,
      inkColor: new Color(ink),
      accentColor: new Color(accent),
    }),
    [ink, accent],
  );

  useFrame(({ size, pointer }, delta) => {
    const node = plane.current;
    if (!sim || !node) return;
    const dt = Math.min(delta, 1 / 30);
    const uv = new Vector2((pointer.x + 1) / 2, (pointer.y + 1) / 2);
    const moved = Number.isNaN(stroke.last.x)
      ? new Vector2()
      : uv.clone().sub(stroke.last);
    stroke.last.copy(uv);
    const inside = uv.x >= 0 && uv.x <= 1 && uv.y >= 0 && uv.y <= 1;
    stroke.speed = damp(stroke.speed, moved.length() / Math.max(dt, 1e-3), 0.12, dt);
    if (inside && moved.lengthSq() > 1e-8) {
      stroke.idle = 0;
      const aspect = size.width / Math.max(1, size.height);
      // Fast strokes carry the accent; slow ones lay down plain ink.
      const color = stroke.inkColor
        .clone()
        .lerp(stroke.accentColor, Math.min(1, Math.max(0, (stroke.speed - 2) / 3)));
      sim.splat(gl, uv, reducedMotion ? new Vector2() : moved.multiplyScalar(5000), color, aspect);
    } else {
      stroke.idle += dt;
    }
    if (stroke.idle < idleSeconds) {
      sim.step(gl, dt, {
        pressureIterations: pressureByTier[tier],
        curl: reducedMotion ? 0 : curlByTier[tier],
      });
    }
    node.visible = stroke.idle < idleSeconds + 2;
    display.uniforms.uDye.value = sim.dye();
    if (store) store.dye = sim.dye();
  });

  if (!sim) return null;
  return (
    <mesh ref={plane} material={display} renderOrder={-10} frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
}

function supportsHalfFloatTargets(gl: WebGLRenderer) {
  return (
    gl.extensions.has("EXT_color_buffer_float") ||
    gl.extensions.has("EXT_color_buffer_half_float")
  );
}

type DoubleTarget = {
  read: WebGLRenderTarget;
  write: WebGLRenderTarget;
  swap(): void;
};

function createTarget(width: number, height: number) {
  return new WebGLRenderTarget(width, height, {
    type: HalfFloatType,
    format: RGBAFormat,
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    depthBuffer: false,
  });
}

function createDouble(width: number, height: number): DoubleTarget {
  const pair = {
    read: createTarget(width, height),
    write: createTarget(width, height),
    swap() {
      const read = pair.read;
      pair.read = pair.write;
      pair.write = read;
    },
  };
  return pair;
}

/**
 * The fluid simulation: velocity and pressure on a grid `gridHeight` cells
 * high, dye on a finer grid. Sizes follow the canvas aspect at creation.
 */
export function createSimulation(
  gridHeight: number,
  dyeHeight: number,
  aspect: number,
) {
  const gridWidth = Math.round(gridHeight * aspect);
  const dyeWidth = Math.round(dyeHeight * aspect);
  const velocity = createDouble(gridWidth, gridHeight);
  const pressure = createDouble(gridWidth, gridHeight);
  const divergence = createTarget(gridWidth, gridHeight);
  const curl = createTarget(gridWidth, gridHeight);
  const dye = createDouble(dyeWidth, dyeHeight);
  // Advection moves dye by the velocity grid's cells too.
  const texel = new Vector2(1 / gridWidth, 1 / gridHeight);

  const scene = new Scene();
  const camera = new Camera();
  const quad = new Mesh(new PlaneGeometry(2, 2));
  quad.frustumCulled = false;
  scene.add(quad);
  const pass = (fragmentShader: string, uniforms: Record<string, { value: unknown }>) =>
    new ShaderMaterial({
      uniforms: { uTexel: { value: texel }, ...uniforms },
      vertexShader: passVertex,
      fragmentShader,
      blending: NoBlending,
      depthTest: false,
      depthWrite: false,
    });
  const materials = {
    advect: pass(advectFragment, {
      uVelocity: { value: null },
      uSource: { value: null },
      uDt: { value: 0 },
      uDissipation: { value: 0 },
    }),
    splat: pass(splatFragment, {
      uTarget: { value: null },
      uPoint: { value: new Vector2() },
      uColor: { value: new Color() },
      uAmount: { value: 0 },
      uRadius: { value: 0 },
      uAspect: { value: 1 },
    }),
    curl: pass(curlFragment, { uVelocity: { value: null } }),
    vorticity: pass(vorticityFragment, {
      uVelocity: { value: null },
      uCurl: { value: null },
      uStrength: { value: 0 },
      uDt: { value: 0 },
    }),
    divergence: pass(divergenceFragment, { uVelocity: { value: null } }),
    clear: pass(clearFragment, { uSource: { value: null }, uValue: { value: 0 } }),
    pressure: pass(pressureFragment, {
      uPressure: { value: null },
      uDivergence: { value: null },
    }),
    gradient: pass(gradientFragment, {
      uPressure: { value: null },
      uVelocity: { value: null },
    }),
  };

  const run = (
    gl: WebGLRenderer,
    material: ShaderMaterial,
    target: WebGLRenderTarget,
  ) => {
    quad.material = material;
    gl.setRenderTarget(target);
    gl.render(scene, camera);
  };

  // Keeps the caller's render target and clear behaviour around the passes.
  const isolated = (gl: WebGLRenderer, work: () => void) => {
    const previous = gl.getRenderTarget();
    const autoClear = gl.autoClear;
    gl.autoClear = false;
    work();
    gl.setRenderTarget(previous);
    gl.autoClear = autoClear;
  };

  return {
    dye: () => dye.read.texture,

    /** Adds a stroke at `point` (0..1 UV) with `force` in UV units per second-ish. */
    splat(gl: WebGLRenderer, point: Vector2, force: Vector2, color: Color, canvasAspect: number) {
      isolated(gl, () => {
        const { uniforms } = materials.splat;
        uniforms.uPoint.value.copy(point);
        uniforms.uAspect.value = canvasAspect;
        uniforms.uRadius.value = 0.0006;
        uniforms.uTarget.value = velocity.read.texture;
        uniforms.uColor.value.setRGB(force.x, force.y, 0);
        uniforms.uAmount.value = 0;
        run(gl, materials.splat, velocity.write);
        velocity.swap();
        uniforms.uRadius.value = 0.0009;
        uniforms.uTarget.value = dye.read.texture;
        uniforms.uColor.value.copy(color);
        uniforms.uAmount.value = 0.35;
        run(gl, materials.splat, dye.write);
        dye.swap();
      });
    },

    step(
      gl: WebGLRenderer,
      dt: number,
      options: { pressureIterations: number; curl: number },
    ) {
      isolated(gl, () => {
        if (options.curl > 0) {
          materials.curl.uniforms.uVelocity.value = velocity.read.texture;
          run(gl, materials.curl, curl);
          const { uniforms } = materials.vorticity;
          uniforms.uVelocity.value = velocity.read.texture;
          uniforms.uCurl.value = curl.texture;
          uniforms.uStrength.value = options.curl;
          uniforms.uDt.value = dt;
          run(gl, materials.vorticity, velocity.write);
          velocity.swap();
        }
        materials.divergence.uniforms.uVelocity.value = velocity.read.texture;
        run(gl, materials.divergence, divergence);
        // Start from a fraction of the previous pressure (faster convergence).
        materials.clear.uniforms.uSource.value = pressure.read.texture;
        materials.clear.uniforms.uValue.value = 0.8;
        run(gl, materials.clear, pressure.write);
        pressure.swap();
        materials.pressure.uniforms.uDivergence.value = divergence.texture;
        for (let index = 0; index < options.pressureIterations; index += 1) {
          materials.pressure.uniforms.uPressure.value = pressure.read.texture;
          run(gl, materials.pressure, pressure.write);
          pressure.swap();
        }
        materials.gradient.uniforms.uPressure.value = pressure.read.texture;
        materials.gradient.uniforms.uVelocity.value = velocity.read.texture;
        run(gl, materials.gradient, velocity.write);
        velocity.swap();

        const advect = materials.advect.uniforms;
        advect.uTexel.value = texel;
        advect.uDt.value = dt;
        advect.uVelocity.value = velocity.read.texture;
        advect.uSource.value = velocity.read.texture;
        advect.uDissipation.value = 0.25;
        run(gl, materials.advect, velocity.write);
        velocity.swap();
        advect.uVelocity.value = velocity.read.texture;
        advect.uSource.value = dye.read.texture;
        advect.uDissipation.value = 0.9;
        run(gl, materials.advect, dye.write);
        dye.swap();
      });
    },

    dispose() {
      for (const target of [velocity.read, velocity.write, pressure.read, pressure.write, dye.read, dye.write, divergence, curl])
        target.dispose();
      for (const material of Object.values(materials)) material.dispose();
      quad.geometry.dispose();
    },

    sizes: { grid: [gridWidth, gridHeight], dye: [dyeWidth, dyeHeight] },
  };
}

// Full-screen in clip space. Depth just inside the far plane, so the ink stays
// behind opaque scene content when used as the page backdrop.
const passVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.9999, 1.0);
}`;

// Velocity is stored in grid cells per second; uv steps divide by the grid.
const advectFragment = /* glsl */ `
uniform sampler2D uVelocity;
uniform sampler2D uSource;
uniform vec2 uTexel;
uniform float uDt;
uniform float uDissipation;
varying vec2 vUv;
void main() {
  vec2 coord = vUv - uDt * texture2D(uVelocity, vUv).xy * uTexel;
  gl_FragColor = texture2D(uSource, coord) / (1.0 + uDissipation * uDt);
}`;

// Velocity splats add (force.xy, 0) with no amount; dye splats add colour
// premultiplied by density in rgb and the density in alpha.
const splatFragment = /* glsl */ `
uniform sampler2D uTarget;
uniform vec2 uPoint;
uniform vec3 uColor;
uniform float uAmount;
uniform float uRadius;
uniform float uAspect;
varying vec2 vUv;
void main() {
  vec2 p = vUv - uPoint;
  p.x *= uAspect;
  float falloff = exp(-dot(p, p) / uRadius);
  vec4 base = texture2D(uTarget, vUv);
  vec4 add = uAmount > 0.0 ? vec4(uColor * uAmount, uAmount) : vec4(uColor, 0.0);
  gl_FragColor = base + add * falloff;
}`;

const curlFragment = /* glsl */ `
uniform sampler2D uVelocity;
uniform vec2 uTexel;
varying vec2 vUv;
void main() {
  float left = texture2D(uVelocity, vUv - vec2(uTexel.x, 0.0)).y;
  float right = texture2D(uVelocity, vUv + vec2(uTexel.x, 0.0)).y;
  float bottom = texture2D(uVelocity, vUv - vec2(0.0, uTexel.y)).x;
  float top = texture2D(uVelocity, vUv + vec2(0.0, uTexel.y)).x;
  gl_FragColor = vec4(0.5 * (right - left - top + bottom), 0.0, 0.0, 1.0);
}`;

const vorticityFragment = /* glsl */ `
uniform sampler2D uVelocity;
uniform sampler2D uCurl;
uniform vec2 uTexel;
uniform float uStrength;
uniform float uDt;
varying vec2 vUv;
void main() {
  float left = texture2D(uCurl, vUv - vec2(uTexel.x, 0.0)).x;
  float right = texture2D(uCurl, vUv + vec2(uTexel.x, 0.0)).x;
  float bottom = texture2D(uCurl, vUv - vec2(0.0, uTexel.y)).x;
  float top = texture2D(uCurl, vUv + vec2(0.0, uTexel.y)).x;
  float center = texture2D(uCurl, vUv).x;
  vec2 force = 0.5 * vec2(abs(top) - abs(bottom), abs(right) - abs(left));
  force /= length(force) + 1e-4;
  force *= uStrength * center * vec2(1.0, -1.0);
  vec2 velocity = texture2D(uVelocity, vUv).xy + force * uDt;
  gl_FragColor = vec4(clamp(velocity, -1000.0, 1000.0), 0.0, 1.0);
}`;

// Edges reflect velocity, which keeps ink from leaking out of the frame.
const divergenceFragment = /* glsl */ `
uniform sampler2D uVelocity;
uniform vec2 uTexel;
varying vec2 vUv;
void main() {
  vec2 c = texture2D(uVelocity, vUv).xy;
  float left = vUv.x - uTexel.x < 0.0 ? -c.x : texture2D(uVelocity, vUv - vec2(uTexel.x, 0.0)).x;
  float right = vUv.x + uTexel.x > 1.0 ? -c.x : texture2D(uVelocity, vUv + vec2(uTexel.x, 0.0)).x;
  float bottom = vUv.y - uTexel.y < 0.0 ? -c.y : texture2D(uVelocity, vUv - vec2(0.0, uTexel.y)).y;
  float top = vUv.y + uTexel.y > 1.0 ? -c.y : texture2D(uVelocity, vUv + vec2(0.0, uTexel.y)).y;
  gl_FragColor = vec4(0.5 * (right - left + top - bottom), 0.0, 0.0, 1.0);
}`;

const clearFragment = /* glsl */ `
uniform sampler2D uSource;
uniform float uValue;
varying vec2 vUv;
void main() {
  gl_FragColor = uValue * texture2D(uSource, vUv);
}`;

const pressureFragment = /* glsl */ `
uniform sampler2D uPressure;
uniform sampler2D uDivergence;
uniform vec2 uTexel;
varying vec2 vUv;
void main() {
  float left = texture2D(uPressure, vUv - vec2(uTexel.x, 0.0)).x;
  float right = texture2D(uPressure, vUv + vec2(uTexel.x, 0.0)).x;
  float bottom = texture2D(uPressure, vUv - vec2(0.0, uTexel.y)).x;
  float top = texture2D(uPressure, vUv + vec2(0.0, uTexel.y)).x;
  float divergence = texture2D(uDivergence, vUv).x;
  gl_FragColor = vec4((left + right + bottom + top - divergence) * 0.25, 0.0, 0.0, 1.0);
}`;

const gradientFragment = /* glsl */ `
uniform sampler2D uPressure;
uniform sampler2D uVelocity;
uniform vec2 uTexel;
varying vec2 vUv;
void main() {
  float left = texture2D(uPressure, vUv - vec2(uTexel.x, 0.0)).x;
  float right = texture2D(uPressure, vUv + vec2(uTexel.x, 0.0)).x;
  float bottom = texture2D(uPressure, vUv - vec2(0.0, uTexel.y)).x;
  float top = texture2D(uPressure, vUv + vec2(0.0, uTexel.y)).x;
  vec2 velocity = texture2D(uVelocity, vUv).xy - vec2(right - left, top - bottom);
  gl_FragColor = vec4(velocity, 0.0, 1.0);
}`;

// Dye alpha is ink density; Beer-Lambert keeps thin ink translucent.
const displayFragment = /* glsl */ `
uniform sampler2D uDye;
uniform float uOpacity;
varying vec2 vUv;
void main() {
  vec4 dye = texture2D(uDye, vUv);
  float density = max(dye.a, 0.0);
  float alpha = (1.0 - exp(-density * 2.2)) * uOpacity;
  vec3 color = dye.rgb / max(density, 1e-4);
  gl_FragColor = vec4(color * alpha, alpha);
  #include <colorspace_fragment>
}`;
