import type { MeshStandardMaterial } from "three";
import type { TimelineViewport } from "./track";

export type TimelineStageState = {
  visible: boolean;
  viewport: TimelineViewport;
};

export function compileTimelineFresnel(
  shader: Parameters<MeshStandardMaterial["onBeforeCompile"]>[0],
): void {
  const chunk = "#include <emissivemap_fragment>";
  if (!shader.fragmentShader.includes(chunk))
    throw new Error(
      "PerspectiveTimeline requires the Three emissivemap fragment chunk.",
    );
  shader.fragmentShader =
    `uniform float timelineThrust;\n${shader.fragmentShader}`.replace(
      chunk,
      `${chunk}\nfloat timelineRim = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 3.2);\ntotalEmissiveRadiance += vec3(0.62, 0.76, 1.0) * timelineRim * (0.22 + timelineThrust * 1.4);`,
    );
}
