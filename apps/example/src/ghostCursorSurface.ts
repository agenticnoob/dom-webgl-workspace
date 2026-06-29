import type {
  WebGLEffectMaterialProgram,
  WebGLEffectUniformValue,
} from "@project/dom-webgl-runtime";

type GhostCursorOptions = {
  readonly color: string;
  readonly opacity: number;
  readonly pointerActive: boolean;
  readonly pointerIntensity: number;
  readonly pointerX: number;
  readonly pointerY: number;
  readonly time: number;
  readonly trailPoints?: readonly (readonly [number, number])[];
  readonly trailLength: number;
};

export type GhostCursorShaderOptions = GhostCursorOptions & {
  readonly width: number;
  readonly height: number;
};

type GhostSurfaceGradient = {
  addColorStop(offset: number, color: string): void;
};

export type GhostSurfaceContext = {
  fillStyle: string | CanvasGradient | CanvasPattern | GhostSurfaceGradient;
  font: string;
  globalAlpha: number;
  globalCompositeOperation: GlobalCompositeOperation;
  lineWidth: number;
  strokeStyle: string | CanvasGradient | CanvasPattern | GhostSurfaceGradient;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
  beginPath(): void;
  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number): void;
  clearRect(x: number, y: number, width: number, height: number): void;
  createRadialGradient(
    x0: number,
    y0: number,
    r0: number,
    x1: number,
    y1: number,
    r1: number,
  ): CanvasGradient | GhostSurfaceGradient;
  fill(): void;
  fillRect(x: number, y: number, width: number, height: number): void;
  fillText(text: string, x: number, y: number): void;
  restore(): void;
  save(): void;
  strokeRect(x: number, y: number, width: number, height: number): void;
};

export function drawGhostCursorSurface(
  context: GhostSurfaceContext,
  width: number,
  height: number,
  options: GhostCursorOptions,
): void {
  context.clearRect(0, 0, width, height);
  drawGhostStage(context, width, height);
  const pointerIntensity = Math.max(0, Math.min(1, options.pointerIntensity));
  context.save();
  context.globalCompositeOperation = "screen";

  const maxTrail = Math.max(6, Math.min(64, options.trailLength));
  const baseRadius = calculateGhostCursorBaseRadius(width, height);
  for (let index = maxTrail; index >= 0; index -= 1) {
    const sample = createSmokeSample(index, maxTrail, baseRadius, width, height, options.time);
    const alpha =
      options.opacity *
      sample.weight *
      (0.018 + noise2(sample.x, sample.y, options.time) * 0.05);
    drawSmokeCluster(
      context,
      sample.x,
      sample.y,
      sample.radius,
      options.color,
      alpha,
      sample.drift,
    );
  }
  if (options.pointerActive || pointerIntensity > 0.01) {
    drawGhostCursorGlow(
      context,
      options.pointerX,
      options.pointerY,
      baseRadius * 1.9,
      options.color,
      options.opacity * pointerIntensity * 0.72,
    );
  }

  context.restore();
  drawGhostText(context, width, height);
}

export function createGhostCursorMaterialProgram(
  options: GhostCursorShaderOptions,
): WebGLEffectMaterialProgram {
  return {
    defines: { MAX_TRAIL_LENGTH: ghostCursorTrailLength },
    fragmentShader: ghostCursorFragmentShader,
    uniforms: createGhostCursorUniforms(options),
    blend: "screen",
  };
}

export function createGhostCursorUniforms(
  options: GhostCursorShaderOptions,
): Record<string, WebGLEffectUniformValue> {
  const resolution: [number, number] = [
    Math.max(1, options.width),
    Math.max(1, options.height),
  ];
  const pointer: [number, number] = [
    Math.max(0, Math.min(options.width, options.pointerX)),
    Math.max(0, Math.min(options.height, options.height - options.pointerY)),
  ];
  const normalizedPointer = normalizePoint(pointer, options.width, options.height);
  const color = readColorVector(options.color);
  const trailPoints = normalizeTrailPoints(
    options.trailPoints,
    options.width,
    options.height,
    normalizedPointer,
  );

  return {
    uSource: { kind: "source-texture" },
    iTime: options.time * 0.001,
    iResolution: [resolution[0], resolution[1], 1],
    iMouse: normalizedPointer,
    iPrevMouse: trailPoints,
    iOpacity: Math.max(0, Math.min(1, options.pointerIntensity)),
    iScale: calculateGhostCursorScale(options.width, options.height),
    iBaseColor: color,
    iBrightness: Math.max(0, Math.min(2, options.opacity)),
    iEdgeIntensity: 0,
    uResolution: resolution,
    uPointer: pointer,
    uColor: color,
    uOpacity: Math.max(0, Math.min(1, options.opacity)),
    uPointerIntensity: Math.max(0, Math.min(1, options.pointerIntensity)),
    uAmbientSmoke: 0.028,
    uCursorSmoke: 0.82,
    uTime: options.time,
    uTrailLength: Math.max(6, Math.min(64, options.trailLength)),
  };
}

export function calculateGhostCursorScale(width: number, height: number): number {
  const current = Math.min(Math.max(1, width), Math.max(1, height));

  return Math.max(0.5, Math.min(2, current / 600));
}

export function calculateGhostCursorBaseRadius(width: number, height: number): number {
  return Math.max(18, Math.min(width, height) * 0.13);
}

function drawGhostStage(
  context: GhostSurfaceContext,
  width: number,
  height: number,
): void {
  context.save();
  context.globalAlpha = 1;
  context.globalCompositeOperation = "source-over";
  context.fillStyle = "#07050c";
  context.fillRect(0, 0, width, height);
  context.globalAlpha = 0.78;
  context.strokeStyle = "rgba(92, 72, 118, 0.5)";
  context.lineWidth = Math.max(1, Math.min(width, height) * 0.008);
  context.strokeRect(
    context.lineWidth * 0.5,
    context.lineWidth * 0.5,
    Math.max(1, width - context.lineWidth),
    Math.max(1, height - context.lineWidth),
  );
  context.restore();
}

function drawGhostText(
  context: GhostSurfaceContext,
  width: number,
  height: number,
): void {
  context.save();
  context.globalCompositeOperation = "source-over";
  context.globalAlpha = 0.84;
  context.fillStyle = "#05030a";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = `700 ${Math.max(72, Math.min(width * 0.22, height * 0.54))}px Georgia, "Times New Roman", serif`;
  context.fillText("Boo!", width * 0.5, height * 0.55);
  context.restore();
}

function drawGhostCursorGlow(
  context: GhostSurfaceContext,
  x: number,
  y: number,
  radius: number,
  color: string,
  alpha: number,
): void {
  const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, colorWithAlpha("#f0ddff", alpha));
  gradient.addColorStop(0.32, colorWithAlpha(color, alpha * 0.58));
  gradient.addColorStop(0.72, colorWithAlpha(color, alpha * 0.12));
  gradient.addColorStop(1, colorWithAlpha(color, 0));
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
}

function drawSmokeBlob(
  context: GhostSurfaceContext,
  x: number,
  y: number,
  radius: number,
  color: string,
  alpha: number,
): void {
  const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, colorWithAlpha(color, alpha));
  gradient.addColorStop(0.42, colorWithAlpha(color, alpha * 0.34));
  gradient.addColorStop(1, colorWithAlpha(color, 0));
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
}

function drawSmokeCluster(
  context: GhostSurfaceContext,
  x: number,
  y: number,
  radius: number,
  color: string,
  alpha: number,
  drift: number,
): void {
  for (let index = 0; index < 5; index += 1) {
    const branch = drift + index * 1.47;
    const offset = radius * (0.12 + index * 0.11);
    drawSmokeBlob(
      context,
      x + Math.cos(branch) * offset,
      y + Math.sin(branch * 1.4) * offset,
      radius * (0.54 - index * 0.055),
      index % 2 === 0 ? color : "#e7d7ff",
      alpha * (1 - index * 0.14),
    );
  }
}

function createSmokeSample(
  index: number,
  maxTrail: number,
  baseRadius: number,
  width: number,
  height: number,
  time: number,
): {
  readonly drift: number;
  readonly radius: number;
  readonly weight: number;
  readonly x: number;
  readonly y: number;
} {
  const age = index / maxTrail;
  const drift = time * 0.0012 + index * 2.399;
  const pulse = noise2(index * 19.7, age * 31.3, time);
  const orbit = baseRadius * (0.9 + age * 3.4 + pulse * 1.2);
  const centerX = width * (0.51 + Math.sin(time * 0.00018) * 0.04);
  const centerY = height * (0.43 + Math.cos(time * 0.00021) * 0.05);
  const verticalBias = Math.sin(time * 0.0008 + age * Math.PI) * baseRadius * 0.42;

  return {
    drift,
    radius: baseRadius * (0.78 + pulse * 1.32 + (1 - age) * 0.72),
    weight: Math.max(0, 1 - age * 0.74),
    x: centerX + Math.cos(drift) * orbit * 1.8,
    y: centerY + Math.sin(drift * 1.37) * orbit * 0.95 - verticalBias,
  };
}

function colorWithAlpha(color: string, alpha: number): string {
  if (color.startsWith("#") && color.length === 7) {
    const red = Number.parseInt(color.slice(1, 3), 16);
    const green = Number.parseInt(color.slice(3, 5), 16);
    const blue = Number.parseInt(color.slice(5, 7), 16);
    return `rgba(${red}, ${green}, ${blue}, ${Math.max(0, Math.min(1, alpha))})`;
  }

  return color;
}

function noise2(x: number, y: number, time: number): number {
  return (
    Math.sin(x * 0.021 + time * 0.0017) * 0.5 +
    Math.cos(y * 0.028 - time * 0.0013) * 0.5 +
    1
  ) / 2;
}

function readColorVector(color: string): [number, number, number] {
  if (color.startsWith("#") && color.length === 7) {
    return [
      Number.parseInt(color.slice(1, 3), 16) / 255,
      Number.parseInt(color.slice(3, 5), 16) / 255,
      Number.parseInt(color.slice(5, 7), 16) / 255,
    ];
  }

  return [0.705, 0.592, 0.812];
}

function normalizePoint(
  point: readonly [number, number],
  width: number,
  height: number,
): [number, number] {
  return [
    Math.max(0, Math.min(1, point[0] / Math.max(1, width))),
    Math.max(0, Math.min(1, point[1] / Math.max(1, height))),
  ];
}

function normalizeTrailPoints(
  trailPoints: readonly (readonly [number, number])[] | undefined,
  width: number,
  height: number,
  fallback: readonly [number, number],
): readonly [number, number][] {
  const points = trailPoints ?? [];
  const normalized = points.slice(0, ghostCursorTrailLength).map((point) =>
    normalizePoint([point[0], height - point[1]], width, height),
  );

  while (normalized.length < ghostCursorTrailLength) {
    normalized.push([fallback[0], fallback[1]]);
  }

  return normalized;
}

const ghostCursorTrailLength = 50;

const ghostCursorFragmentShader = `
  uniform sampler2D uSource;
  uniform float iTime;
  uniform vec3  iResolution;
  uniform vec2  iMouse;
  uniform vec2  iPrevMouse[MAX_TRAIL_LENGTH];
  uniform float iOpacity;
  uniform float iScale;
  uniform vec3  iBaseColor;
  uniform float iBrightness;
  uniform float iEdgeIntensity;
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
    float v = 0.0;
    float a = 0.5;
    mat2 m = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
    for(int i = 0; i < 5; i++) {
      v += a * noise(p);
      p = m * p * 2.0;
      a *= 0.5;
    }
    return v;
  }

  vec3 tint1(vec3 base) {
    return mix(base, vec3(1.0), 0.15);
  }

  vec3 tint2(vec3 base) {
    return mix(base, vec3(0.8, 0.9, 1.0), 0.25);
  }

  vec4 blob(vec2 p, vec2 mousePos, float intensity, float activity) {
    vec2 q = vec2(
      fbm(p * iScale + iTime * 0.1),
      fbm(p * iScale + vec2(5.2, 1.3) + iTime * 0.1)
    );
    vec2 r = vec2(
      fbm(p * iScale + q * 1.5 + iTime * 0.15),
      fbm(p * iScale + q * 1.5 + vec2(8.3, 2.8) + iTime * 0.15)
    );

    float smoke = fbm(p * iScale + r * 0.8);
    float radius = 0.5 + 0.3 * (1.0 / iScale);
    float distFactor = 1.0 - smoothstep(0.0, radius * max(activity, 0.001), length(p - mousePos));
    float alpha = pow(smoke, 2.5) * distFactor;
    vec3 color = mix(tint1(iBaseColor), tint2(iBaseColor), sin(iTime * 0.5) * 0.5 + 0.5);

    return vec4(color * alpha * intensity, alpha * intensity);
  }

  void main() {
    vec4 sourceColor = texture2D(uSource, vUv);
    vec2 uv = (vUv * 2.0 - 1.0) * vec2(iResolution.x / iResolution.y, 1.0);
    vec2 mouse = (iMouse * 2.0 - 1.0) * vec2(iResolution.x / iResolution.y, 1.0);

    vec3 colorAcc = vec3(0.0);
    float alphaAcc = 0.0;

    vec4 b = blob(uv, mouse, 1.0, iOpacity);
    colorAcc += b.rgb;
    alphaAcc += b.a;

    for (int i = 0; i < MAX_TRAIL_LENGTH; i++) {
      vec2 pm = (iPrevMouse[i] * 2.0 - 1.0) * vec2(iResolution.x / iResolution.y, 1.0);
      float t = 1.0 - float(i) / float(MAX_TRAIL_LENGTH);
      t = pow(t, 2.0);
      if (t > 0.01) {
        vec4 bt = blob(uv, pm, t * 0.8, iOpacity);
        colorAcc += bt.rgb;
        alphaAcc += bt.a;
      }
    }

    colorAcc *= iBrightness;

    float edgeDist = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
    float distFromEdge = clamp(edgeDist * 2.0, 0.0, 1.0);
    float edgeMask = mix(1.0 - clamp(iEdgeIntensity, 0.0, 1.0), 1.0, distFromEdge);
    float outAlpha = clamp(alphaAcc * iOpacity * edgeMask, 0.0, 1.0);
    vec3 base = sourceColor.rgb * vec3(0.07, 0.055, 0.095);

    gl_FragColor = vec4(base + colorAcc * outAlpha, 1.0);
  }
`;
