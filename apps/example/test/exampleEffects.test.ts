import { expect, test } from "vitest";
import { Color, ShaderMaterial, Texture } from "three";
import { shaderUniforms, updateUniforms } from "../src/nativeMaterials";

test("native shader uniforms preserve texture ownership and flatten GLSL arrays", () => {
  const texture = new Texture();
  const uniforms = shaderUniforms({
    texture,
    color: "#ffffff",
    origins: [
      [1, 2],
      [3, 4],
    ],
    time: 0,
  });
  expect(uniforms.texture.value).toBe(texture);
  expect(uniforms.color.value).toBeInstanceOf(Color);
  expect(uniforms.origins.value).toEqual([1, 2, 3, 4]);
  const material = new ShaderMaterial({ uniforms });
  const time = material.uniforms.time;
  updateUniforms(material.uniforms, { time: 100, origins: [[5, 6]] });
  expect(material.uniforms.time).toBe(time);
  expect(time.value).toBe(100);
  expect(material.uniforms.origins.value).toEqual([5, 6]);
  expect(material.uniforms.texture.value).toBe(texture);
  material.dispose();
  texture.dispose();
});
