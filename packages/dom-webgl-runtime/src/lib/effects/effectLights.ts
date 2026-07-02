import type { WebGLEffectColorValue } from "./effectColor";
import type { WebGLEffectManagedObjectHandle } from "./effectAuthoring";

export type WebGLEffectLightFollowMode = "object" | "layout-center" | "none";

export type WebGLEffectPointLightRequest = {
  color?: WebGLEffectColorValue;
  intensity?: number;
  distance?: number;
  decay?: number;
  position?: readonly [number, number, number];
  follow?: WebGLEffectLightFollowMode;
};

export type WebGLEffectDirectionalLightRequest = {
  color?: WebGLEffectColorValue;
  intensity?: number;
  position?: readonly [number, number, number];
  target?: readonly [number, number, number];
  follow?: WebGLEffectLightFollowMode;
};

export type WebGLEffectAmbientLightRequest = {
  color?: WebGLEffectColorValue;
  intensity?: number;
};

export type WebGLEffectLightsFacade = {
  ambient(
    key: string,
    request: WebGLEffectAmbientLightRequest,
  ): WebGLEffectManagedObjectHandle;
  directional(
    key: string,
    request: WebGLEffectDirectionalLightRequest,
  ): WebGLEffectManagedObjectHandle;
  point(
    key: string,
    request: WebGLEffectPointLightRequest,
  ): WebGLEffectManagedObjectHandle;
  remove(key: string): void;
};
