import type {
  WebGLEffectMaterialProgram,
  WebGLEffectUniformValue,
} from "@viselora/dom-webgl";

export type HeroGhostLayer = "background" | "foreground";

export const heroGhostTrailLengths = {
  background: 36,
  foreground: 12,
} as const;

export type HeroGhostCursorProgramOptions = {
  readonly width: number;
  readonly height: number;
  readonly pointerX: number;
  readonly pointerY: number;
  readonly pointerIntensity: number;
  readonly time: number;
  readonly baseBackgroundColor: string;
  readonly baseForegroundColor: string;
  readonly targetBackgroundColor: string;
  readonly targetForegroundColor: string;
  readonly radialOrigin: readonly [number, number];
  readonly radialRadiusPx: number;
  readonly radialEdgePx: number;
  readonly brightness: number;
  readonly trailPoints: readonly (readonly [number, number])[];
};

export function createHeroGhostCursorMaterialProgram(
  layer: HeroGhostLayer,
  options: HeroGhostCursorProgramOptions,
): WebGLEffectMaterialProgram {
  return {
    defines: {
      HERO_FOREGROUND: layer === "foreground" ? 1 : 0,
      MAX_TRAIL_LENGTH: heroGhostTrailLengths[layer],
    },
    fragmentShader: heroGhostCursorFragmentShader,
    uniforms: createHeroGhostCursorUniforms(layer, options),
    blend: "normal",
  };
}

export function createHeroGhostCursorUniforms(
  layer: HeroGhostLayer,
  options: HeroGhostCursorProgramOptions,
): Record<string, WebGLEffectUniformValue> {
  const width = positive(options.width, 1);
  const height = positive(options.height, 1);
  const pointer = [
    normalized(options.pointerX / width, 0.5),
    normalized(1 - options.pointerY / height, 0.5),
  ] satisfies [number, number];
  const trail = options.trailPoints
    .slice(0, heroGhostTrailLengths[layer])
    .map(
      ([x, y]) =>
        [normalized(x / width, pointer[0]), normalized(1 - y / height, pointer[1])] satisfies [
          number,
          number,
        ],
    );

  while (trail.length < heroGhostTrailLengths[layer]) {
    trail.push([pointer[0], pointer[1]]);
  }

  return {
    iTime: finite(options.time, 0) * 0.001,
    iResolution: [width, height, 1],
    iMouse: pointer,
    iPrevMouse: trail,
    iOpacity: normalized(options.pointerIntensity, 0),
    iScale: clampFinite(Math.min(width, height) / 600, 0.5, 2, 1),
    iBaseBackgroundColor: readColor(options.baseBackgroundColor),
    iBaseForegroundColor: readColor(options.baseForegroundColor),
    iTargetBackgroundColor: readColor(options.targetBackgroundColor),
    iTargetForegroundColor: readColor(options.targetForegroundColor),
    iRadialOrigin: [
      normalized(options.radialOrigin[0], 0.5),
      normalized(options.radialOrigin[1], 0.5),
    ],
    iRadialRadiusPx: Math.max(0, finite(options.radialRadiusPx, 0)),
    iRadialEdgePx: Math.max(0, finite(options.radialEdgePx, 0)),
    iBrightness: clampFinite(options.brightness, 0, 2, 0),
  };
}

function normalized(value: number, fallback: number): number {
  return clampFinite(value, 0, 1, fallback);
}

function positive(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function finite(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function clampFinite(
  value: number,
  min: number,
  max: number,
  fallback: number,
): number {
  return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
}

function readColor(color: string): [number, number, number] {
  const hex = color.startsWith("#") ? color.slice(1) : color;
  if (!/^[\da-fA-F]{6}$/.test(hex)) {
    throw new TypeError(`Expected a six-digit hex color, received "${color}".`);
  }

  return [
    Number.parseInt(hex.slice(0, 2), 16) / 255,
    Number.parseInt(hex.slice(2, 4), 16) / 255,
    Number.parseInt(hex.slice(4, 6), 16) / 255,
  ];
}

const heroGhostCursorFragmentShader = `
  uniform float iTime;
  uniform vec3 iResolution;
  uniform vec2 iMouse;
  uniform vec2 iPrevMouse[MAX_TRAIL_LENGTH];
  uniform float iOpacity;
  uniform float iScale;
  uniform vec3 iBaseBackgroundColor;
  uniform vec3 iBaseForegroundColor;
  uniform vec3 iTargetBackgroundColor;
  uniform vec3 iTargetForegroundColor;
  uniform vec2 iRadialOrigin;
  uniform float iRadialRadiusPx;
  uniform float iRadialEdgePx;
  uniform float iBrightness;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    mat2 rotation = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
    for (int octave = 0; octave < 5; octave++) {
      value += amplitude * noise(p);
      p = rotation * p * 2.0;
      amplitude *= 0.5;
    }
    return value;
  }

  vec4 blob(vec2 point, vec2 mouse, float strength, vec3 tint) {
    vec2 q = vec2(
      fbm(point * iScale + iTime * 0.10),
      fbm(point * iScale + vec2(5.2, 1.3) + iTime * 0.10)
    );
    vec2 r = vec2(
      fbm(point * iScale + q * 1.5 + iTime * 0.15),
      fbm(point * iScale + q * 1.5 + vec2(8.3, 2.8) + iTime * 0.15)
    );
    float smoke = fbm(point * iScale + r * 0.8);
    float radius = 0.24 + 0.14 / iScale;
    float distanceMask = 1.0 - smoothstep(
      0.0,
      radius * max(iOpacity, 0.001),
      length(point - mouse)
    );
    float alpha = pow(smoke, 2.5) * distanceMask * strength;
    return vec4(tint * alpha, alpha);
  }

  void main() {
    vec2 radialPointPx = vUv * iResolution.xy;
    vec2 radialOriginPx = iRadialOrigin * iResolution.xy;
    float radialDistancePx = length(radialPointPx - radialOriginPx);
    float radialMask = 1.0 - smoothstep(
      iRadialRadiusPx - iRadialEdgePx,
      iRadialRadiusPx + iRadialEdgePx,
      radialDistancePx
    );
    vec3 radialBackground = mix(iBaseBackgroundColor, iTargetBackgroundColor, radialMask);
    vec3 radialForeground = mix(iBaseForegroundColor, iTargetForegroundColor, radialMask);
    vec2 aspect = vec2(iResolution.x / iResolution.y, 1.0);
    vec2 point = (vUv * 2.0 - 1.0) * aspect;
    vec2 mouse = (iMouse * 2.0 - 1.0) * aspect;
    vec3 colorAcc = vec3(0.0);
    float alphaAcc = 0.0;

    vec4 head = blob(point, mouse, 1.0, radialForeground);
    colorAcc += head.rgb;
    alphaAcc += head.a;

    for (int index = 0; index < MAX_TRAIL_LENGTH; index++) {
      vec2 previous = (iPrevMouse[index] * 2.0 - 1.0) * aspect;
      float weight = 1.0 - float(index) / float(MAX_TRAIL_LENGTH);
      weight = pow(weight, 2.0);
      if (weight > 0.01) {
        vec4 sampleBlob = blob(point, previous, weight * 0.8, radialForeground);
        colorAcc += sampleBlob.rgb;
        alphaAcc += sampleBlob.a;
      }
    }

    float outAlpha = clamp(alphaAcc * iOpacity, 0.0, 1.0);

    #if HERO_FOREGROUND == 1
      gl_FragColor = vec4(radialForeground, outAlpha * iBrightness * 1.5);
    #else
      vec3 fogTint = colorAcc / max(alphaAcc, 0.0001);
      float fogStrength = clamp(outAlpha * iBrightness, 0.0, 1.0);
      gl_FragColor = vec4(
        mix(radialBackground, fogTint, fogStrength),
        1.0
      );
    #endif
  }
`;
