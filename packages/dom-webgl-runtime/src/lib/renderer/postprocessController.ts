import { PlaneGeometry } from "three/src/geometries/PlaneGeometry.js";
import { ShaderMaterial } from "three/src/materials/ShaderMaterial.js";
import { Vector2 } from "three/src/math/Vector2.js";
import { Mesh } from "three/src/objects/Mesh.js";
import { OrthographicCamera } from "three/src/cameras/OrthographicCamera.js";
import { WebGLRenderTarget } from "three/src/renderers/WebGLRenderTarget.js";
import { Scene } from "three/src/scenes/Scene.js";

import type {
  WebGLEffectPostprocessHandle,
  WebGLEffectPostprocessRequest,
  WebGLEffectVisualContext,
  WebGLRuntimePostprocessRequest,
} from "../effects/effectAuthoring";
import type {
  WebGLDebugPostprocessRequestSummary,
  WebGLPostprocessDeclaration,
  WebGLPostprocessScopeDeclaration,
} from "../types";
import {
  createRenderTargetPool,
  type DisposableRenderTarget,
  type PooledRenderTarget,
  type RenderTargetPool,
} from "../resources/renderTargetPool";

export type PostprocessController = WebGLEffectVisualContext & {
  readonly activeRequestCount: number;
  inspect(): PostprocessControllerStats;
  inspectRequests(): readonly WebGLRuntimePostprocessRequest[];
  render(context: PostprocessRenderContext, renderBase: () => void): void;
  dispose(): void;
};

export type PostprocessControllerStats = {
  activeRequests: number;
  passCount: number;
  maxRenderTargetSize: number;
  requests: WebGLDebugPostprocessRequestSummary[];
};

export type PostprocessRenderContext = {
  passId?: string;
  viewport?: PostprocessViewport;
  descriptor?: WebGLPostprocessDeclaration;
};

type StoredPostprocessRequest = {
  token: symbol;
  request: WebGLRuntimePostprocessRequest;
};

type PostprocessRenderer = {
  setRenderTarget?(target: object | null): void;
  render?(scene: object, camera: object): void;
};

type PostprocessViewport = {
  width: number;
  height: number;
};

type PostprocessEffectRequest = {
  bloom?: { strength: number; radius: number; threshold: number };
  grain?: { amount: number };
  blur?: { radius: number };
};

type PostprocessEffectPass = {
  render(input: {
    renderer: PostprocessRenderer;
    scene: object;
    camera: object;
    sourceTarget: DisposableRenderTarget;
    request: PostprocessEffectRequest;
    outputSize: PostprocessViewport;
    time: number;
  }): void;
  dispose(): void;
};

type PostprocessControllerOptions = {
  renderer?: PostprocessRenderer;
  scene?: object;
  camera?: object;
  getViewportSize?(): PostprocessViewport;
  now?(): number;
  createRenderTargetPool?(): RenderTargetPool<DisposableRenderTarget>;
  createEffectPass?(): PostprocessEffectPass;
};

const lowResolutionScale = 0.5;
const maxPostprocessSize = 1024;
const maxBloomThreshold = 0.999;

export function createPostprocessController(
  options: PostprocessControllerOptions = {},
): PostprocessController {
  const requestsByKey = new Map<string, StoredPostprocessRequest>();
  let disposed = false;
  let renderTargetPool: RenderTargetPool<DisposableRenderTarget> | undefined;
  let renderTargetPoolSize: PostprocessViewport | undefined;
  let effectPass: PostprocessEffectPass | undefined;

  return {
    get activeRequestCount() {
      return disposed ? 0 : requestsByKey.size;
    },
    inspect() {
      return inspectPostprocessState(options, disposed, requestsByKey);
    },
    requestPostprocess(request) {
      if (disposed) {
        return createDisposedPostprocessHandle();
      }

      const existing = requestsByKey.get(request.key);
      const token = existing?.token ?? Symbol(request.key);
      let currentKey = request.key;
      requestsByKey.set(currentKey, { token, request: cloneRequest(request) });
      let handleDisposed = false;

      return {
        update(nextRequest) {
          if (disposed || handleDisposed) {
            return;
          }

          const stored = requestsByKey.get(currentKey);
          if (stored?.token === token) {
            requestsByKey.delete(currentKey);
          }

          currentKey = nextRequest.key;
          requestsByKey.set(currentKey, {
            token,
            request: cloneRequest(nextRequest),
          });
        },
        dispose() {
          if (handleDisposed) {
            return;
          }

          handleDisposed = true;
          const stored = requestsByKey.get(currentKey);
          if (stored?.token === token) {
            requestsByKey.delete(currentKey);
          }
        },
      };
    },
    inspectRequests() {
      return Array.from(requestsByKey.values(), (entry) => cloneRequest(entry.request));
    },
    render(context, renderBase) {
      if (
        disposed ||
        (!context.descriptor && requestsByKey.size === 0) ||
        !canRunPostprocess(options)
      ) {
        renderBase();
        return;
      }

      const outputSize = readOutputSize(context.viewport ?? options.getViewportSize());
      const request = compilePostprocessRequest(
        [
          ...Array.from(requestsByKey.values(), (entry) => entry.request).filter(
            (entry) => requestMatchesPass(entry, context.passId),
          ),
          ...(context.descriptor
            ? [
                {
                  key: `pass:${context.passId ?? "canvas"}:descriptor`,
                  scope: context.passId
                    ? { passId: context.passId }
                    : { canvas: true },
                  ...context.descriptor,
                } satisfies WebGLRuntimePostprocessRequest,
              ]
            : []),
        ],
      );

      if (!request) {
        renderBase();
        return;
      }

      if (
        renderTargetPool &&
        renderTargetPoolSize &&
        !isSameViewportSize(renderTargetPoolSize, outputSize)
      ) {
        renderTargetPool.dispose();
        renderTargetPool = undefined;
        renderTargetPoolSize = undefined;
      }

      const pool = getRenderTargetPool(options, renderTargetPool);
      renderTargetPool = pool;
      renderTargetPoolSize = outputSize;
      const pass = getEffectPass(options, effectPass);
      effectPass = pass;
      const pooledTarget = pool.acquire(
        "postprocess",
        outputSize.width,
        outputSize.height,
      );

      try {
        options.renderer.setRenderTarget?.(pooledTarget.target);
        try {
          renderBase();
        } finally {
          options.renderer.setRenderTarget?.(null);
        }

        pass.render({
          renderer: options.renderer,
          scene: options.scene,
          camera: options.camera,
          sourceTarget: pooledTarget.target,
          request,
          outputSize,
          time: options.now?.() ?? performance.now(),
        });
      } finally {
        pool.release(pooledTarget);
      }
    },
    dispose() {
      if (disposed) {
        return;
      }

      disposed = true;
      requestsByKey.clear();
      effectPass?.dispose();
      effectPass = undefined;
      renderTargetPool?.dispose();
      renderTargetPool = undefined;
      renderTargetPoolSize = undefined;
    },
  };
}

function canRunPostprocess(
  options: PostprocessControllerOptions,
): options is PostprocessControllerOptions & {
  renderer: PostprocessRenderer;
  scene: object;
  camera: object;
  getViewportSize(): PostprocessViewport;
} {
  return (
    options.renderer !== undefined &&
    typeof options.renderer.setRenderTarget === "function" &&
    typeof options.renderer.render === "function" &&
    options.scene !== undefined &&
    options.camera !== undefined &&
    typeof options.getViewportSize === "function"
  );
}

function getRenderTargetPool(
  options: PostprocessControllerOptions,
  existing: RenderTargetPool<DisposableRenderTarget> | undefined,
): RenderTargetPool<DisposableRenderTarget> {
  if (existing) {
    return existing;
  }

  return options.createRenderTargetPool?.() ?? createDefaultRenderTargetPool();
}

function getEffectPass(
  options: PostprocessControllerOptions,
  existing: PostprocessEffectPass | undefined,
): PostprocessEffectPass {
  if (existing) {
    return existing;
  }

  return options.createEffectPass?.() ?? createDefaultEffectPass();
}

function createDisposedPostprocessHandle(): WebGLEffectPostprocessHandle {
  return {
    update() {},
    dispose() {},
  };
}

function cloneRequest(
  request: WebGLRuntimePostprocessRequest,
): WebGLRuntimePostprocessRequest {
  return {
    key: request.key,
    scope: cloneRequestScope(request.scope),
    ...(request.bloom ? { bloom: { ...request.bloom } } : {}),
    ...(request.grain ? { grain: { ...request.grain } } : {}),
    ...(request.blur ? { blur: { ...request.blur } } : {}),
  };
}

function cloneRequestScope(
  scope: WebGLPostprocessScopeDeclaration,
): WebGLPostprocessScopeDeclaration {
  if ("canvas" in scope) {
    return { canvas: true };
  }

  return { passId: scope.passId };
}

function requestMatchesPass(
  request: WebGLRuntimePostprocessRequest,
  passId: string | undefined,
): boolean {
  if ("canvas" in request.scope) {
    return true;
  }

  return request.scope.passId === passId;
}

function inspectPostprocessState(
  options: PostprocessControllerOptions,
  disposed: boolean,
  requestsByKey: ReadonlyMap<string, StoredPostprocessRequest>,
): PostprocessControllerStats {
  if (disposed) {
    return {
      activeRequests: 0,
      passCount: 0,
      maxRenderTargetSize: 0,
      requests: [],
    };
  }

  const requests = Array.from(requestsByKey.values(), (entry) => entry.request);
  const compiledRequest = compilePostprocessRequest(requests);
  const outputSize = options.getViewportSize
    ? readOutputSize(options.getViewportSize())
    : { width: 0, height: 0 };

  return {
    activeRequests: requestsByKey.size,
    passCount: compiledRequest ? 1 : 0,
    maxRenderTargetSize: compiledRequest
      ? Math.max(outputSize.width, outputSize.height)
      : 0,
    requests: requests.map((request) => ({
      key: request.key,
      scope: cloneRequestScope(request.scope),
    })),
  };
}

function readOutputSize(viewport: PostprocessViewport): PostprocessViewport {
  const width = normalizeViewportDimension(viewport.width);
  const height = normalizeViewportDimension(viewport.height);
  const scale = Math.min(
    lowResolutionScale,
    maxPostprocessSize / Math.max(width, height),
  );

  return {
    width: clampSharedOutputDimension(width * scale),
    height: clampSharedOutputDimension(height * scale),
  };
}

function isSameViewportSize(
  current: PostprocessViewport,
  next: PostprocessViewport,
): boolean {
  return current.width === next.width && current.height === next.height;
}

function normalizeViewportDimension(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.max(1, value);
}

function clampSharedOutputDimension(value: number): number {
  return Math.max(1, Math.min(maxPostprocessSize, Math.ceil(value)));
}

function compilePostprocessRequest(
  requests: readonly WebGLEffectPostprocessRequest[],
): PostprocessEffectRequest | null {
  let bloomStrength = 0;
  let bloomRadius = 0;
  let bloomThreshold = maxBloomThreshold;
  let hasBloom = false;
  let grainAmount = 0;
  let hasGrain = false;
  let blurRadius = 0;
  let hasBlur = false;

  for (const request of requests) {
    if (request.bloom) {
      hasBloom = true;
      bloomStrength = Math.max(
        bloomStrength,
        clampUnitInterval(request.bloom.strength ?? 0.35),
      );
      bloomRadius = Math.max(
        bloomRadius,
        clampUnitInterval(request.bloom.radius ?? 0.25),
      );
      bloomThreshold = Math.min(
        bloomThreshold,
        clampBloomThreshold(request.bloom.threshold ?? 0.8),
      );
    }

    if (request.grain) {
      hasGrain = true;
      grainAmount = Math.max(
        grainAmount,
        clampUnitInterval(request.grain.amount ?? 0.04),
      );
    }

    if (request.blur) {
      hasBlur = true;
      blurRadius = Math.max(
        blurRadius,
        clampUnitInterval(request.blur.radius ?? 0.15),
      );
    }
  }

  if (!hasBloom && !hasGrain && !hasBlur) {
    return null;
  }

  return {
    bloom: {
      strength: hasBloom ? bloomStrength : 0,
      radius: hasBloom ? bloomRadius : 0,
      threshold: bloomThreshold,
    },
    ...(hasGrain ? { grain: { amount: grainAmount } } : {}),
    ...(hasBlur ? { blur: { radius: blurRadius } } : {}),
  };
}

function clampUnitInterval(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, value));
}

function clampBloomThreshold(value: number): number {
  return Math.min(maxBloomThreshold, clampUnitInterval(value));
}

function createDefaultRenderTargetPool(): RenderTargetPool<WebGLRenderTarget> {
  return createRenderTargetPool({
    createTarget(_kind, width, height) {
      return new WebGLRenderTarget(width, height, {
        depthBuffer: true,
        stencilBuffer: false,
      });
    },
  });
}

function createDefaultEffectPass(): PostprocessEffectPass {
  const scene = new Scene();
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 2);
  camera.position.z = 1;
  const geometry = new PlaneGeometry(2, 2);
  const material = new ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    transparent: true,
    uniforms: {
      uTexture: { value: null },
      uResolution: { value: new Vector2(1, 1) },
      uBloomStrength: { value: 0 },
      uBloomRadius: { value: 0 },
      uBloomThreshold: { value: maxBloomThreshold },
      uGrainAmount: { value: 0 },
      uBlurRadius: { value: 0 },
      uTime: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;

      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;

      uniform sampler2D uTexture;
      uniform vec2 uResolution;
      uniform float uBloomStrength;
      uniform float uBloomRadius;
      uniform float uBloomThreshold;
      uniform float uGrainAmount;
      uniform float uBlurRadius;
      uniform float uTime;

      float random(vec2 uv) {
        return fract(sin(dot(uv, vec2(12.9898, 78.233))) * 43758.5453123);
      }

      vec3 sampleBlur(vec2 uv, vec2 texel, float radius) {
        vec2 horizontal = vec2(texel.x * radius, 0.0);
        vec2 vertical = vec2(0.0, texel.y * radius);

        vec3 sum = texture2D(uTexture, uv).rgb * 0.2;
        sum += texture2D(uTexture, uv + horizontal).rgb * 0.15;
        sum += texture2D(uTexture, uv - horizontal).rgb * 0.15;
        sum += texture2D(uTexture, uv + vertical).rgb * 0.15;
        sum += texture2D(uTexture, uv - vertical).rgb * 0.15;
        sum += texture2D(uTexture, uv + horizontal + vertical).rgb * 0.1;
        sum += texture2D(uTexture, uv + horizontal - vertical).rgb * 0.05;
        sum += texture2D(uTexture, uv - horizontal + vertical).rgb * 0.05;
        sum += texture2D(uTexture, uv - horizontal - vertical).rgb * 0.05;

        return sum;
      }

      void main() {
        vec4 base = texture2D(uTexture, vUv);
        vec2 texel = 1.0 / max(uResolution, vec2(1.0, 1.0));
        vec3 color = base.rgb;

        if (uBlurRadius > 0.0 || uBloomStrength > 0.0) {
          float bloomEnabled = step(0.0001, uBloomStrength);
          float blurRadius = mix(0.0, 4.0, uBlurRadius);
          float bloomRadius = mix(4.0, 18.0, uBloomRadius) * bloomEnabled;
          vec3 blurred = sampleBlur(vUv, texel, max(blurRadius, bloomRadius));

          if (uBlurRadius > 0.0) {
            color = mix(color, blurred, uBlurRadius * 0.65);
          }

          if (uBloomStrength > 0.0) {
            float bloomThreshold = min(uBloomThreshold, 0.999);
            float highlight = max(max(blurred.r, blurred.g), blurred.b);
            float bloomMask = smoothstep(bloomThreshold, 1.0, highlight);
            vec3 bloom = max(blurred - vec3(bloomThreshold), vec3(0.0)) * bloomMask * uBloomStrength;
            color += bloom;
          }
        }

        float grain = (random(vUv * uResolution + uTime) - 0.5) * uGrainAmount;
        color += vec3(grain);

        gl_FragColor = vec4(color, base.a);
      }
    `,
  });
  const quad = new Mesh(geometry, material);
  scene.add(quad);

  return {
    render(input) {
      material.uniforms.uTexture.value = (
        input.sourceTarget as WebGLRenderTarget
      ).texture;
      material.uniforms.uResolution.value.set(
        input.outputSize.width,
        input.outputSize.height,
      );
      material.uniforms.uBloomStrength.value = input.request.bloom?.strength ?? 0;
      material.uniforms.uBloomRadius.value = input.request.bloom?.radius ?? 0;
      material.uniforms.uBloomThreshold.value =
        input.request.bloom?.threshold ?? maxBloomThreshold;
      material.uniforms.uGrainAmount.value = input.request.grain?.amount ?? 0;
      material.uniforms.uBlurRadius.value = input.request.blur?.radius ?? 0;
      material.uniforms.uTime.value = input.time * 0.001;
      input.renderer.render?.(scene, camera);
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
