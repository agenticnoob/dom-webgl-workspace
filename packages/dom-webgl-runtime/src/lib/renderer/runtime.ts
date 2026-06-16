import type { WebGLDeclaration } from "../types";

import {
  createTargetRegistry,
  type TargetRegistry,
} from "../dom/registry";
import type { TargetDescriptor } from "../dom/targetDescriptor";
import {
  createRenderable,
  type RenderableFactoryContext,
} from "../render/renderableFactory";
import type { Renderable } from "../render/renderable";
import { compileRenderPolicy } from "../render/renderPolicy";
import { inferRenderRole } from "../render/renderRole";
import { createResourceManager } from "../resources/resourceManager";
import { inferSourceDescriptor } from "../source/inferSource";
import {
  createThreeRendererHost,
  type ThreeRendererHost,
} from "./threeRenderer";

export type WebGLRuntimeOptions = {
  container: HTMLElement;
};

export type WebGLRuntime = {
  readonly container: HTMLElement;
  registerTarget(
    element: HTMLElement,
    declaration: WebGLDeclaration,
  ): TargetDescriptor;
  unregisterTarget(key: string): void;
  sync(): void | Promise<void>;
  dispose(): void;
};

type DisposableRenderable = {
  dispose(): void;
};

type RuntimeInternalOptions = WebGLRuntimeOptions & {
  rendererHostFactory?: (container: HTMLElement) => ThreeRendererHost;
  renderables?: Iterable<DisposableRenderable>;
  measureElement?: RenderableFactoryContext["measureElement"];
  loadVideo?: RenderableFactoryContext["loadVideo"];
  loadModel?: RenderableFactoryContext["loadModel"];
  onRenderableCreated?: (renderable: Renderable) => void;
};

type BrowserDOMGlobals = typeof globalThis & {
  window?: unknown;
  document?: {
    createElement?: unknown;
  };
};

const missingDOMMessage =
  "createWebGLRuntime requires a browser DOM. Call it from a client/browser environment.";

export function createWebGLRuntime(options: WebGLRuntimeOptions): WebGLRuntime {
  assertBrowserDOMAvailable();
  const internalOptions = options as RuntimeInternalOptions;
  const rendererHostFactory =
    internalOptions.rendererHostFactory ?? createThreeRendererHost;
  const rendererHost = rendererHostFactory(options.container);
  const registry = createTargetRegistry();
  const resourceManager = createResourceManager();
  const renderables = new Set<DisposableRenderable>(
    internalOptions.renderables ?? [],
  );
  const renderablesByTargetKey = new Map<string, Renderable>();
  const renderableFactoryContext: RenderableFactoryContext = {
    resourceManager,
    measureElement: internalOptions.measureElement ?? measureElement,
    loadVideo: internalOptions.loadVideo,
    loadModel: internalOptions.loadModel,
  };
  let nextScanOrder = 0;
  let disposed = false;

  return {
    container: options.container,
    registerTarget(element, declaration) {
      if (disposed) {
        throw new Error("Cannot register a WebGL target after runtime disposal.");
      }

      const descriptor = registry.register(element, declaration, nextScanOrder);
      nextScanOrder += 1;

      return descriptor;
    },
    unregisterTarget(key) {
      const targetKey = key.trim();
      registry.unregister(targetKey);
      disposeTargetRenderable(targetKey, renderablesByTargetKey, renderables);
    },
    sync() {
      if (disposed) {
        return;
      }

      const descriptors = listTargetsInScanOrder(registry);

      for (const descriptor of descriptors) {
        if (renderablesByTargetKey.has(descriptor.key)) {
          continue;
        }

        const renderable = createPipelineRenderable(
          descriptor,
          renderableFactoryContext,
        );

        renderablesByTargetKey.set(descriptor.key, renderable);
        renderables.add(renderable);
        internalOptions.onRenderableCreated?.(renderable);
      }

      const pendingUpdates: Array<Promise<void>> = [];

      for (const descriptor of descriptors) {
        const renderable = renderablesByTargetKey.get(descriptor.key);

        if (!renderable) {
          continue;
        }

        const result = renderable.update();

        if (isPromiseLike(result)) {
          pendingUpdates.push(result);
        }
      }

      if (pendingUpdates.length > 0) {
        return Promise.all(pendingUpdates).then(() => undefined);
      }
    },
    dispose() {
      if (disposed) {
        return;
      }

      disposed = true;

      try {
        for (const renderable of renderables) {
          renderable.dispose();
        }
      } finally {
        renderablesByTargetKey.clear();
        renderables.clear();
        rendererHost.dispose();
      }
    },
  };
}

function createPipelineRenderable(
  descriptor: TargetDescriptor,
  context: RenderableFactoryContext,
): Renderable {
  const source = inferSourceDescriptor(descriptor);
  const role = inferRenderRole(source, descriptor.declaration);
  const policy = compileRenderPolicy(role);

  return createRenderable(descriptor, source, role, policy, context);
}

function disposeTargetRenderable(
  key: string,
  renderablesByTargetKey: Map<string, Renderable>,
  renderables: Set<DisposableRenderable>,
): void {
  const renderable = renderablesByTargetKey.get(key);

  if (!renderable) {
    return;
  }

  renderablesByTargetKey.delete(key);
  renderables.delete(renderable);
  renderable.dispose();
}

function listTargetsInScanOrder(registry: TargetRegistry): TargetDescriptor[] {
  return registry.list().sort((left, right) => left.scanOrder - right.scanOrder);
}

function measureElement(element: HTMLElement): DOMRect {
  return element.getBoundingClientRect();
}

function isPromiseLike(result: void | Promise<void>): result is Promise<void> {
  return Boolean(
    result &&
      typeof result === "object" &&
      "then" in result &&
      typeof result.then === "function",
  );
}

function assertBrowserDOMAvailable(): void {
  const globals = globalThis as BrowserDOMGlobals;

  if (
    typeof globals.window === "undefined" ||
    typeof globals.document === "undefined" ||
    typeof globals.document.createElement !== "function"
  ) {
    throw new Error(missingDOMMessage);
  }
}
