import type { WebGLSourceDescriptor } from "../source/sourceDescriptor";
import type { WebGLResourceStatus } from "../types";

export type ResourceRecord<T = unknown> = {
  key: string;
  kind: WebGLSourceDescriptor["kind"];
  status: WebGLResourceStatus;
  refCount: number;
  value?: T;
  error?: unknown;
};

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

  return {
    acquire<T = unknown>(descriptor: WebGLSourceDescriptor): ResourceHandle<T> {
      const key = createResourceKey(descriptor);
      let record = records.get(key) as ManagedResourceRecord<T> | undefined;

      if (!record) {
        record = {
          key,
          kind: descriptor.kind,
          status: "idle",
          refCount: 0,
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

function createResourceKey(descriptor: WebGLSourceDescriptor): string {
  switch (descriptor.kind) {
    case "snapshot":
      return `snapshot:${descriptor.mode}:${readSnapshotKey(descriptor.element)}`;
    case "image":
      return `image:${normalizeResourceUrl(descriptor.src)}`;
    case "video":
      return `video:${normalizeResourceUrl(descriptor.src)}`;
    case "model":
      return `model:${descriptor.format}:${normalizeResourceUrl(descriptor.src)}`;
  }
}

function readSnapshotKey(element: HTMLElement): string {
  return (
    element.getAttribute("data-webgl-key") ??
    element.id ??
    "anonymous-snapshot"
  );
}

function normalizeResourceUrl(src: string): string {
  const url = new URL(src, "https://dom-webgl.local");

  return `${url.pathname}${url.search}${url.hash}`;
}
