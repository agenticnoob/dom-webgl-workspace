import type { WebGLEffectPlugin } from "../effectPlugin";
import { pointerTiltEffect } from "./pointerTiltEffect";
import { solidMaterialEffect } from "./solidMaterialEffect";
import { surfaceBasicEffect } from "./surfaceBasicEffect";

export const builtInWebGLEffectPlugins: readonly WebGLEffectPlugin[] = [
  solidMaterialEffect,
  surfaceBasicEffect,
  pointerTiltEffect,
];
