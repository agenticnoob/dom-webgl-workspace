import type { WebGLDeclaration } from "../types";

import {
  createTargetDescriptor,
  type TargetDescriptor,
} from "./targetDescriptor";

export type TargetRegistry = {
  register: (
    element: HTMLElement,
    declaration: WebGLDeclaration,
    scanOrder: number,
  ) => TargetDescriptor;
  unregister: (key: string) => void;
  get: (key: string) => TargetDescriptor | undefined;
  list: () => TargetDescriptor[];
};

export function createTargetRegistry(): TargetRegistry {
  const descriptors = new Map<string, TargetDescriptor>();

  return {
    register(element, declaration, scanOrder) {
      const descriptor = createTargetDescriptor(element, declaration, scanOrder);

      if (descriptors.has(descriptor.key)) {
        throw new Error(
          `WebGL target key "${descriptor.key}" is already registered.`,
        );
      }

      descriptors.set(descriptor.key, descriptor);

      return descriptor;
    },
    unregister(key) {
      descriptors.delete(key.trim());
    },
    get(key) {
      return descriptors.get(key.trim());
    },
    list() {
      return Array.from(descriptors.values());
    },
  };
}
