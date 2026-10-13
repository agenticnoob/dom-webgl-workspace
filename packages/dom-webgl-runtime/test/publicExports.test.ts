import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import ts from "typescript";
import { describe, expect, test } from "vitest";

import { withTypecheckLock } from "./helpers/typecheck";

describe("React/R3F public contract", () => {
  test("exposes a small utility and React surface without private controllers", async () => {
    const root = await import("../src/index");
    const react = await import("../src/react");
    expect(Object.keys(root).sort()).toEqual([
      "createDOMTextTexture",
      "drawDOMText",
      "measureDOMText",
    ]);
    expect(Object.keys(react).sort()).toEqual([
      "WebGLRuntime",
      "WebGLTarget",
      "useDOMTarget",
      "useWebGLRuntime",
    ]);
  });

  test("supports native R3F scenes and typed DOM state while retiring facade declarations", async () => {
    await withTypecheckLock(() => {
      const root = process.cwd();
      const directory = mkdtempSync(
        resolve(tmpdir(), "viselora-public-types-"),
      );
      const fixture = resolve(directory, "consumer.tsx");
      writeFileSync(
        fixture,
        `
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Mesh, MeshBasicMaterial, PlaneGeometry } from "three";
import {
  createDOMTextTexture, measureDOMText, drawDOMText,
  type DOMTargetState, type DOMTextGlyphCommand,
  type RuntimeManager, type WebGLProgressSignalSource,
} from "@viselora/dom-webgl";
import {
  WebGLRuntime, WebGLTarget, useDOMTarget, useWebGLRuntime,
  type WebGLRuntimeProps, type WebGLTargetProps,
} from "@viselora/dom-webgl/react";

function Scene() {
  const mesh = useRef<Mesh>(null);
  const target: DOMTargetState | undefined = useDOMTarget("headline");
  const runtime: RuntimeManager = useWebGLRuntime();
  useFrame((_state, delta) => {
    if (mesh.current && target) {
      mesh.current.position.x = target.rect.left;
      mesh.current.rotation.z += delta;
      runtime.setTargetReady(target.id, true, target);
    }
  });
  return <mesh ref={mesh}><planeGeometry /><meshBasicMaterial color="red" /></mesh>;
}
const progress = { get: (_key: string) => 0.5 } satisfies WebGLProgressSignalSource;
const props = {
  scene: <Scene />,
  canvas: { frameloop: "demand", orthographic: true, camera: { position: [0, 0, 500] } },
  progressSignals: progress,
} satisfies WebGLRuntimeProps;
const targetProps = {
  id: "headline", hideWhenReady: true, offscreen: "restore-dom", children: <h1>Heading</h1>,
} satisfies WebGLTargetProps;
export const app = <WebGLRuntime {...props}><WebGLTarget {...targetProps} /></WebGLRuntime>;
export const nativeMesh = new Mesh(new PlaneGeometry(), new MeshBasicMaterial());
export function text(element: HTMLElement, context: CanvasRenderingContext2D) {
  const layout = measureDOMText(element, { devicePixelRatio: 2 });
  const commands: DOMTextGlyphCommand[] = layout.glyphs.map(({ index, y }) => ({ index, y: y + 2 }));
  drawDOMText(context, layout, commands);
  const resource = createDOMTextTexture(element, { devicePixelRatio: 2 });
  resource.texture.needsUpdate = true;
  resource.dispose();
}
// @ts-expect-error The old engine factory is not public.
import { createWebGLRuntime } from "@viselora/dom-webgl";
// @ts-expect-error Registries are runtime internals.
import { createDOMTargetRegistry } from "@viselora/dom-webgl";
// @ts-expect-error Native R3F meshes replace the scene-object facade.
import { WebGLMesh } from "@viselora/dom-webgl/react";
// @ts-expect-error Targets no longer accept custom engine declarations.
const oldTarget = <WebGLTarget id="old" webgl={{ source: { kind: "text" } }}><h1>Old</h1></WebGLTarget>;
// @ts-expect-error Effects belong to native scene components.
const oldHost = <WebGLRuntime effects={[]} />;
// @ts-expect-error Target ids remain mandatory.
const missingId = <WebGLTarget><h1>Missing id</h1></WebGLTarget>;
// @ts-expect-error Supported offscreen modes are deliberately small.
const invalidMode = <WebGLTarget id="x" offscreen="release"><h1>Wrong mode</h1></WebGLTarget>;
function ownership(runtime: RuntimeManager) {
  // @ts-expect-error Use R3F useThree for rendering objects.
  return runtime.renderer;
}
`,
      );
      try {
        const program = ts.createProgram([fixture], {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
          moduleResolution: ts.ModuleResolutionKind.Bundler,
          jsx: ts.JsxEmit.ReactJSX,
          strict: true,
          noEmit: true,
          skipLibCheck: true,
          esModuleInterop: true,
          types: [],
          baseUrl: root,
          paths: {
            "@viselora/dom-webgl": ["packages/dom-webgl-runtime/src/index.ts"],
            "@viselora/dom-webgl/react": [
              "packages/dom-webgl-runtime/src/react.ts",
            ],
            react: ["node_modules/@types/react/index.d.ts"],
            "react/jsx-runtime": ["node_modules/@types/react/jsx-runtime.d.ts"],
            "@react-three/fiber": [
              "node_modules/@react-three/fiber/dist/declarations/src/index.d.ts",
            ],
            three: ["node_modules/@types/three/index.d.ts"],
          },
        });
        const diagnostics = ts.getPreEmitDiagnostics(program);
        expect(
          diagnostics.map((item) =>
            ts.flattenDiagnosticMessageText(item.messageText, "\n"),
          ),
        ).toEqual([]);
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    });
  }, 60_000);
});
