import type {
  WebGLEffectPostprocessHandle,
  WebGLEffectPostprocessRequest,
  WebGLEffectVisualContext,
} from "../effects/effectAuthoring";

export type PostprocessController = WebGLEffectVisualContext & {
  readonly activeRequestCount: number;
  inspectRequests(): readonly WebGLEffectPostprocessRequest[];
  render(renderBase: () => void): void;
  dispose(): void;
};

type StoredPostprocessRequest = {
  token: symbol;
  request: WebGLEffectPostprocessRequest;
};

export function createPostprocessController(): PostprocessController {
  const requestsByKey = new Map<string, StoredPostprocessRequest>();
  let disposed = false;

  return {
    get activeRequestCount() {
      return disposed ? 0 : requestsByKey.size;
    },
    requestPostprocess(request) {
      if (disposed) {
        return createDisposedPostprocessHandle();
      }

      const token = Symbol(request.key);
      requestsByKey.set(request.key, { token, request: cloneRequest(request) });
      let handleDisposed = false;

      return {
        update(nextRequest) {
          if (disposed || handleDisposed) {
            return;
          }

          requestsByKey.set(nextRequest.key, {
            token,
            request: cloneRequest(nextRequest),
          });
        },
        dispose() {
          if (handleDisposed) {
            return;
          }

          handleDisposed = true;
          const stored = requestsByKey.get(request.key);
          if (stored?.token === token) {
            requestsByKey.delete(request.key);
          }
        },
      };
    },
    inspectRequests() {
      return Array.from(requestsByKey.values(), (entry) => cloneRequest(entry.request));
    },
    render(renderBase) {
      renderBase();
    },
    dispose() {
      if (disposed) {
        return;
      }

      disposed = true;
      requestsByKey.clear();
    },
  };
}

function createDisposedPostprocessHandle(): WebGLEffectPostprocessHandle {
  return {
    update() {},
    dispose() {},
  };
}

function cloneRequest(
  request: WebGLEffectPostprocessRequest,
): WebGLEffectPostprocessRequest {
  return {
    key: request.key,
    ...(request.bloom ? { bloom: { ...request.bloom } } : {}),
    ...(request.grain ? { grain: { ...request.grain } } : {}),
    ...(request.blur ? { blur: { ...request.blur } } : {}),
  };
}
