import type {
  WebGLEffectMaterialProgram,
  WebGLEffectUniformValue,
} from "@viselora/dom-webgl";

import { defaultWavesConfig } from "./wavesConfig";

type WavesMaterialOptions = {
  readonly lineColor: string;
  readonly opacity: number;
  readonly pointerActive: boolean;
  readonly pointerX: number;
  readonly pointerY: number;
  readonly time: number;
  readonly width: number;
  readonly height: number;
};

export function createSurfaceWavesMaterialProgram(
  options: WavesMaterialOptions,
): WebGLEffectMaterialProgram {
  return {
    fragmentShader: surfaceWavesFragmentShader,
    uniforms: createSurfaceWavesUniforms(options),
    blend: "screen",
  };
}

export function createSurfaceWavesUniforms(
  options: WavesMaterialOptions,
): Record<string, WebGLEffectUniformValue> {
  const width = Math.max(1, options.width);
  const height = Math.max(1, options.height);

  return {
    uSource: { kind: "source-texture" },
    uResolution: [width, height],
    uTime: options.time,
    uPointer: [
      clampNumber(options.pointerX, 0, width),
      height - clampNumber(options.pointerY, 0, height),
    ],
    uPointerActive: options.pointerActive,
    uLineColor: readColorVector(options.lineColor),
    uOpacity: clampNumber(options.opacity, 0, 1),
    uWaveDensity: [
      Math.max(1, defaultWavesConfig.xGap),
      Math.max(1, defaultWavesConfig.yGap),
    ],
    uWaveAmplitude: [
      defaultWavesConfig.waveAmpX,
      defaultWavesConfig.waveAmpY,
    ],
    uWaveSpeed: [
      defaultWavesConfig.waveSpeedX,
      defaultWavesConfig.waveSpeedY,
    ],
    uPointerStrength: defaultWavesConfig.cursorForce * 520,
  };
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function readColorVector(color: string): [number, number, number] {
  const normalized = color.trim();
  const hex = normalized.startsWith("#") ? normalized.slice(1) : normalized;
  if (/^[\da-fA-F]{6}$/.test(hex)) {
    return [
      Number.parseInt(hex.slice(0, 2), 16) / 255,
      Number.parseInt(hex.slice(2, 4), 16) / 255,
      Number.parseInt(hex.slice(4, 6), 16) / 255,
    ];
  }

  return [0.09, 0.13, 0.14];
}

const surfaceWavesFragmentShader = `
  uniform sampler2D uSource;
  uniform vec2 uResolution;
  uniform float uTime;
  uniform vec2 uPointer;
  uniform bool uPointerActive;
  uniform vec3 uLineColor;
  uniform float uOpacity;
  uniform vec2 uWaveDensity;
  uniform vec2 uWaveAmplitude;
  uniform vec2 uWaveSpeed;
  uniform float uPointerStrength;
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

  float lineMask(float distanceToLine, float width) {
    return 1.0 - smoothstep(width, width + 1.4, distanceToLine);
  }

  void main() {
    vec4 sourceColor = texture2D(uSource, vUv);
    vec2 pixel = vUv * uResolution;
    float time = uTime * 0.001;

    float wave = noise(vec2(
      pixel.x * 0.018 + time * uWaveSpeed.x * 34.0,
      pixel.y * 0.012 + time * uWaveSpeed.y * 42.0
    ));
    float waveOffset = (wave - 0.5) * uWaveAmplitude.y;

    float pointerField = 0.0;
    if (uPointerActive) {
      float pointerDistance = distance(pixel, uPointer);
      pointerField = (1.0 - smoothstep(0.0, 190.0, pointerDistance)) * uPointerStrength;
      waveOffset += sin(pointerDistance * 0.045 - time * 5.2) * pointerField * 18.0;
    }

    float verticalGrid = abs(fract((pixel.x + waveOffset) / uWaveDensity.x) - 0.5) * uWaveDensity.x;
    float horizontalGrid = abs(fract((pixel.y - waveOffset * 0.62) / uWaveDensity.y) - 0.5) * uWaveDensity.y;
    float verticalLine = lineMask(verticalGrid, 0.86 + pointerField * 0.28);
    float horizontalLine = lineMask(horizontalGrid, 0.72 + pointerField * 0.22);
    float mesh = max(verticalLine * 0.88, horizontalLine * 0.54);

    float shimmer = 0.72 + noise(pixel * 0.035 + time * 0.8) * 0.28;
    vec3 color = mix(sourceColor.rgb, uLineColor, mesh * uOpacity * shimmer);
    gl_FragColor = vec4(color, max(sourceColor.a, mesh * uOpacity * 0.84));
  }
`;
