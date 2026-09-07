import type { WebGLEffectMaterialProgram } from "@viselora/dom-webgl";
import { projectRoomConfig as config } from "./room";
import { heroTransitionConfig } from "../transition/transitionConfig";

export function createProjectRoomProgram(
  texture: HTMLCanvasElement,
): WebGLEffectMaterialProgram {
  return {
    blend: "normal",
    uniforms: {
      inkAtlas: { kind: "canvas-texture", source: texture },
      viewport: [1440, 900],
      view: [0, 0, 0, 0],
      ...projectRoomColors(false),
    },
    fragmentShader: `
      uniform sampler2D inkAtlas;
      uniform vec2 viewport;
      uniform vec4 view;
      uniform vec3 backgroundColor;
      uniform vec3 foregroundColor;
      varying vec2 vUv;
      const float R = ${config.radius.toFixed(2)};
      const float H = ${config.halfHeight.toFixed(2)};
      void main() {
        vec2 screen = (vUv - 0.5) * 2.0;
        vec3 ray = vec3(screen.x * viewport.x / viewport.y * ${config.tangent}, screen.y * ${config.tangent}, -1.0);
        float cp = cos(view.y), sp = sin(view.y);
        ray = vec3(ray.x, cp * ray.y - sp * ray.z, sp * ray.y + cp * ray.z);
        float cy = cos(view.x), sy = sin(view.x);
        ray = vec3(cy * ray.x - sy * ray.z, ray.y, sy * ray.x + cy * ray.z);
        vec3 eye = vec3(view.z * cy, view.w, view.z * sy);
        vec3 direction = mix(vec3(-1.0), vec3(1.0), step(vec3(0.0), ray));
        vec3 bound = vec3(R, H, R) * direction;
        vec3 distances = (bound - eye) / (direction * max(abs(ray), vec3(0.00001)));
        float t = min(min(distances.x, distances.y), distances.z);
        vec3 p = eye + ray * t;
        bool horizontal = distances.y < distances.x && distances.y < distances.z;
        float shade = horizontal ? 0.063 : (distances.x < distances.z ? 0.11 : 0.0);
        float line = 0.0;
        float glyph = 0.0;
        if (!horizontal) {
          float face;
          float u;
          if (distances.x < distances.z) {
            face = p.x > 0.0 ? 1.0 : 3.0;
            u = p.x > 0.0 ? (p.z + R) / (2.0 * R) : (R - p.z) / (2.0 * R);
          } else {
            face = p.z < 0.0 ? 0.0 : 2.0;
            u = p.z < 0.0 ? (p.x + R) / (2.0 * R) : (R - p.x) / (2.0 * R);
          }
          float v = (H - p.y) / (2.0 * H);
          vec2 uv = vec2((mod(face, 2.0) + clamp(u, 0.001, 0.999)) * 0.5, 1.0 - (floor(face / 2.0) + clamp(v, 0.001, 0.999)) * 0.5);
          glyph = texture2D(inkAtlas, uv).a;
          // Keep the wall under the reader's gaze bright; adjacent planes recede.
          float facing = distances.x < distances.z ? abs(ray.x) / length(ray.xz) : abs(ray.z) / length(ray.xz);
          glyph *= mix(0.55, 1.0, pow(facing, 4.0));
          float edge = min(min(u, 1.0-u), min(v, 1.0-v));
          line = 1.0 - smoothstep(0.001, 0.003, edge);
        } else {
          float edge = min(R - abs(p.x), R - abs(p.z));
          line = 1.0 - smoothstep(0.006, 0.018, edge);
        }
        vec3 color = mix(backgroundColor, foregroundColor, shade);
        color = mix(color, foregroundColor, glyph);
        color = mix(color, mix(backgroundColor, foregroundColor, 0.32), line);
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  };
}

export function projectRoomColors(inverted: boolean) {
  const rgb = (hex: string): [number, number, number] => {
    const n = Number.parseInt(hex.slice(1), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  };
  return {
    backgroundColor: rgb(
      inverted
        ? heroTransitionConfig.colors.light
        : heroTransitionConfig.colors.dark,
    ),
    foregroundColor: rgb(
      inverted
        ? heroTransitionConfig.colors.dark
        : heroTransitionConfig.colors.light,
    ),
  };
}
