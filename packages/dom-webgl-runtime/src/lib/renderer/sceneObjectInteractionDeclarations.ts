import type {
  WebGLDebugSceneObjectInteractionSummary,
  WebGLEffectDeclaration,
  WebGLEffectsDeclaration,
  WebGLObjectPointerDeclaration,
  WebGLSceneObjectInteractionDeclaration,
} from "../types";

export type NormalizedSceneObjectPointerDeclaration = {
  readonly hover: boolean;
  readonly press: boolean;
  readonly click: boolean;
  readonly drag: boolean;
};

export type NormalizedSceneObjectInteractionDeclaration = {
  readonly pickable?: {
    readonly hitTest: "bounds";
    readonly pointer: NormalizedSceneObjectPointerDeclaration;
  };
};

export function normalizeSceneObjectEffects(
  effects: WebGLEffectsDeclaration | undefined,
): WebGLEffectsDeclaration | undefined {
  if (effects === undefined) {
    return undefined;
  }

  return effects.map((effect) => ({ ...effect }));
}

export function normalizeSceneObjectInteraction(
  declaration: WebGLSceneObjectInteractionDeclaration | undefined,
): NormalizedSceneObjectInteractionDeclaration | undefined {
  const pickable = declaration?.pickable;

  if (pickable === undefined || pickable === false) {
    return undefined;
  }

  if (pickable === true) {
    return {
      pickable: {
        hitTest: "bounds",
        pointer: normalizeObjectPointer(undefined, { hover: true }),
      },
    };
  }

  return {
    pickable: {
      hitTest: pickable.hitTest ?? "bounds",
      pointer: normalizeObjectPointer(
        pickable.pointer,
        pickable.pointer ? {} : { hover: true },
      ),
    },
  };
}

export function inspectSceneObjectEffectKinds(
  effects: readonly WebGLEffectDeclaration[] | undefined,
): readonly string[] | undefined {
  if (effects === undefined) {
    return undefined;
  }

  return effects.map((effect) => effect.kind);
}

export function inspectSceneObjectInteraction(
  interaction: NormalizedSceneObjectInteractionDeclaration | undefined,
): WebGLDebugSceneObjectInteractionSummary | undefined {
  if (!interaction?.pickable) {
    return undefined;
  }

  return {
    pickable: {
      hitTest: interaction.pickable.hitTest,
      pointer: { ...interaction.pickable.pointer },
    },
  };
}

function normalizeObjectPointer(
  pointer: WebGLObjectPointerDeclaration | undefined,
  fallback: Partial<NormalizedSceneObjectPointerDeclaration>,
): NormalizedSceneObjectPointerDeclaration {
  return {
    hover: pointer?.hover ?? fallback.hover ?? false,
    press: pointer?.press ?? fallback.press ?? false,
    click: pointer?.click ?? fallback.click ?? false,
    drag: pointer?.drag ?? fallback.drag ?? false,
  };
}
