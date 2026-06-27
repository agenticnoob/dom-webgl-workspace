import type { WebGLSourceDescriptor } from "../source/sourceDescriptor";
import type { WebGLResourceStatus } from "../types";

export type ResourceRecord<T = unknown> = {
  key: string;
  kind: WebGLResourceKind;
  status: WebGLResourceStatus;
  refCount: number;
  element?: HTMLImageElement | HTMLVideoElement;
  value?: T;
  error?: unknown;
};

export type WebGLResourceKind =
  | "dom"
  | "image"
  | "video"
  | "model/glb"
  | "image-sequence";

export type ResourceHandle<T = unknown> = {
  record: ResourceRecord<T>;
  load(loader: () => Promise<T>): Promise<T>;
  dispose(): void;
};

export type ResourceManager = {
  acquire<T = unknown>(descriptor: WebGLSourceDescriptor): ResourceHandle<T>;
  inspect(key: string): ResourceRecord | undefined;
};

type ManagedResourceRecord<T = unknown> = ResourceRecord<T> & {
  loadPromise?: Promise<T>;
};

export function createResourceManager(): ResourceManager {
  const records = new Map<string, ManagedResourceRecord>();
  const elementKeys = new WeakMap<Element, string>();
  let nextElementKey = 0;

  const readElementKey = (element: Element): string => {
    let key = elementKeys.get(element);

    if (!key) {
      nextElementKey += 1;
      key = `element-${nextElementKey}`;
      elementKeys.set(element, key);
    }

    return key;
  };

  return {
    acquire<T = unknown>(descriptor: WebGLSourceDescriptor): ResourceHandle<T> {
      const key = createResourceKey(descriptor, readElementKey);
      let record = records.get(key) as ManagedResourceRecord<T> | undefined;

      if (!record) {
        record = {
          key,
          kind: readResourceKind(descriptor),
          status: "idle",
          refCount: 0,
          element: readAdoptedElement(descriptor),
        };
        records.set(key, record);
      }

      record.refCount += 1;

      return createResourceHandle(record, records);
    },
    inspect(key: string): ResourceRecord | undefined {
      return records.get(key);
    },
  };
}

function readResourceKind(descriptor: WebGLSourceDescriptor): WebGLResourceKind {
  switch (descriptor.kind) {
    case "dom":
      return "dom";
    case "media":
      return descriptor.type;
    case "model":
      return `model/${descriptor.type}`;
  }
}

function createResourceHandle<T>(
  record: ManagedResourceRecord<T>,
  records: Map<string, ManagedResourceRecord>,
): ResourceHandle<T> {
  let disposed = false;

  return {
    record,
    load(loader: () => Promise<T>): Promise<T> {
      if (record.status === "ready") {
        return Promise.resolve(record.value as T);
      }

      if (record.status === "loading" && record.loadPromise) {
        return record.loadPromise;
      }

      record.status = "loading";
      record.error = undefined;
      record.loadPromise = loader()
        .then((value) => {
          record.status = "ready";
          record.value = value;
          return value;
        })
        .catch((error: unknown) => {
          record.status = "error";
          record.error = error;
          throw error;
        });

      return record.loadPromise;
    },
    dispose(): void {
      if (disposed) {
        return;
      }

      disposed = true;
      record.refCount = Math.max(0, record.refCount - 1);

      if (record.refCount === 0) {
        records.delete(record.key);
      }
    },
  };
}

function createResourceKey(
  descriptor: WebGLSourceDescriptor,
  readElementKey: (element: Element) => string,
): string {
  switch (descriptor.kind) {
    case "dom":
      return `dom:${descriptor.type}:${readSnapshotKey(
        descriptor.element,
        readElementKey,
      )}`;
    case "media":
      if (descriptor.type === "image-sequence") {
        return `image-sequence:${readElementKey(descriptor.anchor)}:${descriptor.frameCount}`;
      }

      return `${descriptor.type}:${readElementKey(
        descriptor.element ?? descriptor.anchor,
      )}:${normalizeResourceUrl(descriptor.src)}`;
    case "model":
      return `model:${descriptor.type}:${normalizeResourceUrl(descriptor.src)}`;
  }
}

function readAdoptedElement(
  descriptor: WebGLSourceDescriptor,
): HTMLImageElement | HTMLVideoElement | undefined {
  switch (descriptor.kind) {
    case "media":
      if (descriptor.type === "image-sequence") {
        return undefined;
      }
      return descriptor.element;
    case "dom":
    case "model":
      return undefined;
  }
}

function readSnapshotKey(
  element: HTMLElement,
  readElementKey: (element: Element) => string,
): string {
  const declaredKey = element.getAttribute("data-webgl-key")?.trim();

  if (declaredKey) {
    return declaredKey;
  }

  if (element.id) {
    return element.id;
  }

  return readElementKey(element);
}

function normalizeResourceUrl(src: string): string {
  if (src.startsWith("//")) {
    const url = new URL(`https:${src}`);
    return `${url.pathname}${url.search}${url.hash}`;
  }

  if (src.startsWith("http://") || src.startsWith("https://")) {
    const url = new URL(src);
    return `${url.pathname}${url.search}${url.hash}`;
  }

  const url = new URL(src, "https://dom-webgl.local");
  return `${url.pathname}${url.search}${url.hash}`;
}
