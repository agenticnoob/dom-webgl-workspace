import { describe, expect, test } from "vitest";

import type { TargetLayerRecord } from "../../../src/lib/dom/targetTree";
import { compileRenderPolicy } from "../../../src/lib/render/renderPolicy";
import { toScopedSceneObjectOrdering } from "../../../src/lib/render/layerOrdering";

describe("toScopedSceneObjectOrdering", () => {
  const parent = {
    key: "sequence",
    parentKey: undefined,
    depth: 0,
    siblingIndex: 0,
    paintIndex: 0,
  } satisfies TargetLayerRecord;

  const child = {
    key: "card.copy",
    parentKey: "sequence",
    depth: 1,
    siblingIndex: 0,
    paintIndex: 1,
  } satisfies TargetLayerRecord;

  test("keeps nested content above parent media because DOM scope wins", () => {
    const parentOrdering = toScopedSceneObjectOrdering(
      compileRenderPolicy("media"),
      parent,
    );
    const childOrdering = toScopedSceneObjectOrdering(
      compileRenderPolicy("content"),
      child,
    );

    expect(childOrdering.renderOrder).toBeGreaterThan(parentOrdering.renderOrder);
  });

  test("keeps local overlay above local surface within one target scope", () => {
    const surface = toScopedSceneObjectOrdering(
      compileRenderPolicy("surface"),
      parent,
    );
    const overlay = toScopedSceneObjectOrdering(
      compileRenderPolicy("overlay"),
      parent,
    );

    expect(overlay.renderOrder).toBeGreaterThan(surface.renderOrder);
  });

  test("keeps model depth write while scoping model order to the target", () => {
    const ordering = toScopedSceneObjectOrdering(
      compileRenderPolicy("model"),
      child,
    );

    expect(ordering).toMatchObject({
      depthWrite: true,
      transparent: true,
    });
    expect(ordering.renderOrder).toBeGreaterThanOrEqual(100);
    expect(ordering.renderOrder).toBeLessThan(200);
  });
});
