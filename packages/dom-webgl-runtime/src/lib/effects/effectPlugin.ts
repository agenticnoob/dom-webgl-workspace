import type { ElementLayoutSnapshot } from "../renderer/layoutPass";
import type { WebGLEffectDeclaration, WebGLFrameInput } from "../types";
import type { WebGLEffectTarget } from "./effectTarget";

export type WebGLEffectSourceKind =
  | "snapshot/element"
  | "snapshot/text"
  | "image"
  | "video"
  | "model/glb";

export type WebGLEffectTargetCapability =
  | "material.solid"
  | "material.surface"
  | "transform.rotation";

export type WebGLEffectTargetContext = {
  key: string;
  sourceKind: WebGLEffectSourceKind;
  layout: ElementLayoutSnapshot;
  input: WebGLFrameInput;
  target: WebGLEffectTarget | undefined;
};

export type WebGLEffectInstance = {
  update(context: WebGLEffectTargetContext): void;
  dispose?(): void;
};

export type WebGLEffectPlugin<
  TDeclaration extends WebGLEffectDeclaration = WebGLEffectDeclaration,
  TState = unknown,
> = {
  readonly kind: TDeclaration["kind"];
  readonly appliesTo: readonly WebGLEffectSourceKind[];
  readonly capabilities: readonly WebGLEffectTargetCapability[];
  normalize(declaration: TDeclaration): TState;
  create(state: TState): WebGLEffectInstance;
};
