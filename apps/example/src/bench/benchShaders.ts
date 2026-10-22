// 3D simplex noise by Ian McEwan and Stefan Gustavson (Ashima Arts, MIT).
const simplexNoise = /* glsl */ `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 10.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  vec3 ns = 0.142857142857 * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;
  vec4 m = max(0.5 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 105.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}`;

export const particleVertexShader = /* glsl */ `
uniform float uTime;
uniform float uPixelRatio;
uniform float uOpacity;
attribute float aSeed;
varying float vAlpha;
${simplexNoise}
void main() {
  vec3 p = position;
  float t = uTime * 0.15;
  vec3 drift = vec3(
    snoise(p * 0.35 + vec3(t, 0.0, 0.0)),
    snoise(p * 0.35 + vec3(0.0, t, 17.1)),
    snoise(p * 0.35 + vec3(31.7, 0.0, t))
  );
  p += drift * 1.2;
  vec4 view = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * view;
  gl_PointSize = (2.0 + aSeed * 3.0) * uPixelRatio * (8.0 / max(-view.z, 0.1));
  vAlpha = uOpacity * (0.35 + 0.65 * aSeed);
}`;

export const particleFragmentShader = /* glsl */ `
uniform vec3 uColor;
varying float vAlpha;
void main() {
  float alpha = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5)) * vAlpha;
  gl_FragColor = vec4(uColor * alpha, alpha);
}`;

export const textWaveVertexShader = /* glsl */ `
uniform float uTime;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec3 p = position;
  float phase = uv.x * 6.2831853 * 1.5 + uTime * 2.5;
  p.y += sin(phase) * 0.04;
  p.z += cos(phase) * 0.06;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

export const textWaveFragmentShader = /* glsl */ `
uniform sampler2D uMap;
uniform float uOpacity;
varying vec2 vUv;
void main() {
  vec4 color = texture2D(uMap, vUv);
  gl_FragColor = vec4(color.rgb, color.a * uOpacity);
  #include <colorspace_fragment>
}`;

export const screenVertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

export const raymarchFragmentShader = /* glsl */ `
uniform float uTime;
uniform float uIntensity;
uniform vec2 uResolution;
varying vec2 vUv;

float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash(i), hash(i + vec3(1.0, 0.0, 0.0)), f.x),
        mix(hash(i + vec3(0.0, 1.0, 0.0)), hash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
    mix(mix(hash(i + vec3(0.0, 0.0, 1.0)), hash(i + vec3(1.0, 0.0, 1.0)), f.x),
        mix(hash(i + vec3(0.0, 1.0, 1.0)), hash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
    f.z);
}

float fbm(vec3 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 4; i++) {
    value += amplitude * noise(p);
    p *= 2.03;
    amplitude *= 0.5;
  }
  return value;
}

float map(vec3 p) {
  float t = uTime * 0.3;
  vec3 q = p;
  q.xz = mat2(cos(t), -sin(t), sin(t), cos(t)) * q.xz;
  vec2 ring = vec2(length(q.xz) - 1.4, q.y);
  return length(ring) - 0.45 + (fbm(p * 2.2 + t) - 0.5) * 0.35;
}

void main() {
  vec2 uv = (vUv - 0.5) * vec2(uResolution.x / max(uResolution.y, 1.0), 1.0);
  vec3 origin = vec3(0.0, 0.0, 4.0);
  vec3 direction = normalize(vec3(uv, -1.6));
  float travelled = 0.0;
  float glow = 0.0;
  float hit = 0.0;
  for (int i = 0; i < 96; i++) {
    float d = map(origin + direction * travelled);
    glow += 0.012 / (0.05 + abs(d));
    if (d < 0.002) {
      hit = 1.0;
      break;
    }
    travelled += d * 0.8;
    if (travelled > 12.0) break;
  }
  vec3 color = vec3(0.02, 0.03, 0.06)
    + glow * vec3(0.25, 0.45, 0.9) * 0.06
    + hit * vec3(0.9, 0.6, 0.4) * clamp(1.0 - travelled / 8.0, 0.0, 1.0);
  gl_FragColor = vec4(color * uIntensity, uIntensity);
}`;
