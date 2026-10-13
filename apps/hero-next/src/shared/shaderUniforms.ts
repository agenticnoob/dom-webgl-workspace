import { Color, Texture, type IUniform } from "three";

export type HeroUniformValue =
  | number
  | boolean
  | string
  | Texture
  | readonly number[]
  | readonly (readonly number[])[];

export function createHeroUniforms(
  values: Record<string, HeroUniformValue>,
): Record<string, IUniform> {
  return Object.fromEntries(
    Object.entries(values).map(([name, value]) => [
      name,
      { value: shaderValue(value) },
    ]),
  );
}

export function updateHeroUniforms(
  uniforms: Record<string, IUniform>,
  values: Record<string, HeroUniformValue>,
): void {
  for (const [name, value] of Object.entries(values)) {
    const uniform = uniforms[name];
    if (uniform) uniform.value = shaderValue(value);
    else uniforms[name] = { value: shaderValue(value) };
  }
}

function shaderValue(value: HeroUniformValue): unknown {
  if (typeof value === "string") return new Color(value);
  if (Array.isArray(value) && Array.isArray(value[0])) {
    return new Float32Array(value.flat());
  }
  return value;
}

export const heroPlaneVertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
