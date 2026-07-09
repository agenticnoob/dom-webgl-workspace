import type {
  WebGLEffectModelMorphsFacade,
  WebGLEffectModelRigFacade,
} from "../../effects/effectObject";

type MorphEntry = {
  readonly name: string;
  readonly index: number;
  readonly influences: number[];
};

export type ModelMorphDiagnostic = {
  readonly kind: "missing-morph" | "missing-bone";
  readonly name: string;
};

export type ModelMorphControlsInspection = {
  readonly morphs: readonly string[];
  readonly bones: readonly string[];
  readonly diagnostics: readonly ModelMorphDiagnostic[];
};

export type ModelMorphControls = {
  readonly morphs?: WebGLEffectModelMorphsFacade;
  readonly rig?: WebGLEffectModelRigFacade;
  set(name: string, weight: number): void;
  inspect(): ModelMorphControlsInspection;
};

export function createModelMorphControls(object3D: unknown): ModelMorphControls {
  const morphEntries = collectMorphEntries(object3D);
  const morphsByName = groupMorphsByName(morphEntries);
  const boneNames = collectBoneNames(object3D);
  const diagnostics: ModelMorphDiagnostic[] = [];
  const morphNames = Array.from(morphsByName.keys());

  return {
    morphs:
      morphNames.length > 0
        ? {
            names() {
              return morphNames.slice();
            },
            get(name) {
              const entries = readMorphEntries(name);
              if (!entries) {
                return undefined;
              }

              return entries[0]?.influences[entries[0].index];
            },
            set(name, weight) {
              setMorphWeight(name, weight);
            },
          }
        : undefined,
    rig:
      boneNames.length > 0
        ? {
            bones() {
              return boneNames.slice();
            },
          }
        : undefined,
    set(name, weight) {
      setMorphWeight(name, weight);
    },
    inspect() {
      return {
        morphs: morphNames.slice(),
        bones: boneNames.slice(),
        diagnostics: diagnostics.slice(),
      };
    },
  };

  function readMorphEntries(name: string): MorphEntry[] | undefined {
    const entries = morphsByName.get(name);
    if (!entries || entries.length === 0) {
      diagnostics.push({ kind: "missing-morph", name });
      return undefined;
    }

    return entries;
  }

  function setMorphWeight(name: string, weight: number): void {
    const entries = readMorphEntries(name);
    if (!entries) {
      return;
    }

    const clamped = clamp01(weight);
    for (const entry of entries) {
      entry.influences[entry.index] = clamped;
    }
  }
}

function collectMorphEntries(object3D: unknown): readonly MorphEntry[] {
  const entries: MorphEntry[] = [];

  traverseObject(object3D, (object) => {
    const dictionary = readMorphDictionary(object);
    const influences = readMorphInfluences(object);
    if (!dictionary || !influences) {
      return;
    }

    const names = Object.keys(dictionary).sort(
      (left, right) => dictionary[left] - dictionary[right],
    );
    for (const name of names) {
      const index = dictionary[name];
      if (Number.isInteger(index) && index >= 0 && index < influences.length) {
        entries.push({ name, index, influences });
      }
    }
  });

  return entries;
}

function groupMorphsByName(
  entries: readonly MorphEntry[],
): Map<string, MorphEntry[]> {
  const grouped = new Map<string, MorphEntry[]>();

  for (const entry of entries) {
    const existing = grouped.get(entry.name);
    if (existing) {
      existing.push(entry);
    } else {
      grouped.set(entry.name, [entry]);
    }
  }

  return grouped;
}

function collectBoneNames(object3D: unknown): readonly string[] {
  const names: string[] = [];

  traverseObject(object3D, (object) => {
    if (!object || typeof object !== "object") {
      return;
    }

    const candidate = object as { isBone?: unknown; name?: unknown };
    if (candidate.isBone === true && typeof candidate.name === "string") {
      const name = candidate.name.trim();
      if (name) {
        names.push(name);
      }
    }
  });

  return names;
}

function traverseObject(object3D: unknown, visitor: (object: unknown) => void): void {
  if (!object3D || typeof object3D !== "object") {
    return;
  }

  visitor(object3D);

  const children = (object3D as { children?: unknown }).children;
  if (Array.isArray(children)) {
    for (const child of children) {
      traverseObject(child, visitor);
    }
  }
}

function readMorphDictionary(object: unknown): Record<string, number> | undefined {
  const dictionary =
    object && typeof object === "object"
      ? (object as { morphTargetDictionary?: unknown }).morphTargetDictionary
      : undefined;

  if (!dictionary || typeof dictionary !== "object" || Array.isArray(dictionary)) {
    return undefined;
  }

  const result: Record<string, number> = {};
  for (const [name, index] of Object.entries(dictionary)) {
    if (typeof index === "number") {
      result[name] = index;
    }
  }

  return result;
}

function readMorphInfluences(object: unknown): number[] | undefined {
  const influences =
    object && typeof object === "object"
      ? (object as { morphTargetInfluences?: unknown }).morphTargetInfluences
      : undefined;

  return Array.isArray(influences) ? influences : undefined;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, value));
}
