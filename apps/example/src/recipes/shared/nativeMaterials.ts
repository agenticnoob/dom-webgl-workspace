import {
  CanvasTexture,
  Color,
  LinearFilter,
  SRGBColorSpace,
  type IUniform,
} from "three";

export const surfaceVertexShader = `varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

/** GLSL vector arrays use flat numeric storage; ordinary vectors accept arrays. */
function uniformValue(value: unknown): unknown {
  if (typeof value === "string") return new Color(value);
  if (Array.isArray(value) && Array.isArray(value[0])) return value.flat();
  return value;
}

export function shaderUniforms(
  values: Record<string, unknown>,
): Record<string, IUniform> {
  return Object.fromEntries(
    Object.entries(values).map(([name, value]) => [
      name,
      { value: uniformValue(value) },
    ]),
  );
}

export function updateUniforms(
  uniforms: Record<string, IUniform>,
  values: Record<string, unknown>,
): void {
  for (const [name, value] of Object.entries(values)) {
    if (uniforms[name]) uniforms[name].value = uniformValue(value);
    else uniforms[name] = { value: uniformValue(value) };
  }
}

export function canvasTexture(canvas: HTMLCanvasElement): CanvasTexture {
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}
