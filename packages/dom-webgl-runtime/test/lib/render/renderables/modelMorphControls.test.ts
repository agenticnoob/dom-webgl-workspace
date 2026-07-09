import { describe, expect, test } from "vitest";

import { createModelMorphControls } from "../../../../src/lib/render/renderables/modelMorphControls";

describe("createModelMorphControls", () => {
  test("lists and updates morph weights by stable names", () => {
    const mesh = {
      name: "Face",
      morphTargetDictionary: { Smile: 0, Blink: 1 },
      morphTargetInfluences: [0.25, 0],
    };
    const controls = createModelMorphControls({ children: [mesh] });

    expect(controls.morphs?.names()).toEqual(["Smile", "Blink"]);
    expect(controls.morphs?.get("Smile")).toBe(0.25);

    controls.morphs?.set("Smile", 1.4);
    controls.morphs?.set("Blink", -0.2);

    expect(mesh.morphTargetInfluences).toEqual([1, 0]);
    expect("morphTargetInfluences" in (controls.morphs ?? {})).toBe(false);
  });

  test("records missing morph diagnostics and no-ops", () => {
    const mesh = {
      morphTargetDictionary: { Smile: 0 },
      morphTargetInfluences: [0],
    };
    const controls = createModelMorphControls({ children: [mesh] });

    expect(controls.morphs?.get("Missing")).toBeUndefined();
    expect(() => controls.morphs?.set("Missing", 0.8)).not.toThrow();

    expect(mesh.morphTargetInfluences).toEqual([0]);
    expect(controls.inspect().diagnostics).toEqual([
      { kind: "missing-morph", name: "Missing" },
      { kind: "missing-morph", name: "Missing" },
    ]);
  });

  test("lists named bones for diagnostics without exposing bone objects", () => {
    const hips = {
      isBone: true,
      name: "Hips",
      children: [{ isBone: true, name: "Spine" }],
    };
    const unnamed = { isBone: true, name: "" };
    const controls = createModelMorphControls({ children: [hips, unnamed] });

    expect(controls.rig?.bones()).toEqual(["Hips", "Spine"]);
    expect("bone" in (controls.rig ?? {})).toBe(false);
    expect("skeleton" in (controls.rig ?? {})).toBe(false);
  });

  test("omits facades when no morph or rig metadata exists", () => {
    const controls = createModelMorphControls({ children: [{ name: "Mesh" }] });

    expect(controls.morphs).toBeUndefined();
    expect(controls.rig).toBeUndefined();
    expect(controls.inspect()).toEqual({
      morphs: [],
      bones: [],
      diagnostics: [],
    });
  });
});
