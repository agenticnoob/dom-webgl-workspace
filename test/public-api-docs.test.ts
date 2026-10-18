import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

// Agents learn the API from the published .d.ts files, so these constraints
// must stay in the JSDoc that tsup copies into dist declarations.
const root = process.cwd();
const runtime = "packages/dom-webgl-runtime/src/lib";
const adapters = "packages/dom-webgl-scroll-adapters/src";

describe("public API JSDoc", () => {
  test.each([
    [`${runtime}/domRuntime.ts`, "export type DOMTargetState", "do not re-render React"],
    [`${runtime}/domRuntime.ts`, "  revision: number;", "Mutable: poll it in `useFrame`"],
    [`${runtime}/domRuntime.ts`, "  hideWhenReady?: boolean;", "Only leaves are hidden"],
    [`${runtime}/runtimeManager.ts`, "  setTargetReady(", "never `true`\n   * after a load error"],
    [`${runtime}/runtimeManager.ts`, "  setTargetReady(", "target captured when asynchronous"],
    [`${runtime}/Runtime.tsx`, "  canvas?: Omit<CanvasProps", "Do not mount another `<Canvas>`"],
    [`${runtime}/Runtime.tsx`, "export function WebGLRuntime(", "single R3F Canvas, renderer and frame loop"],
    [`${runtime}/Runtime.tsx`, "export function useDOMTarget(", "not when it moves"],
    [`${runtime}/domTextLayout.ts`, "  baseline: number;", "including CSS half-leading"],
    [`${runtime}/domTextTexture.ts`, "export function createDOMTextTexture(", "The caller owns it"],
    [`${adapters}/react.ts`, "  readonly smooth?:", "a new object recreates the stack"],
    [`${adapters}/scrollEffectProgress.ts`, "  set(key: string, value: number): void;", "clamped to 0..1"],
  ])("%s documents %s", (file, declaration, phrase) => {
    const source = readFileSync(resolve(root, file), "utf8");
    const at = source.indexOf(declaration);
    expect(at, `${declaration} not found`).toBeGreaterThan(-1);
    const comment = source.slice(0, at).match(/\/\*\*((?:(?!\*\/)[\s\S])*)\*\/\s*$/);
    expect(comment?.[1], `${declaration} has no JSDoc`).toContain(phrase);
  });
});
