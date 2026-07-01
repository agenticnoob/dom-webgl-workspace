import { describe, expect, test } from "vitest";

import { createTargetDescriptor } from "../../../src/lib/dom/targetDescriptor";
import { createTargetLayerTree } from "../../../src/lib/dom/targetTree";
import type { ProjectedDOMRect } from "../../../src/lib/renderer/domProjection";
import { createTransformGroupPlan } from "../../../src/lib/render/transformGroups";

describe("createTransformGroupPlan", () => {
  test("attaches declared descendants to the nearest subtree transform root", () => {
    const root = document.createElement("section");
    const sequence = document.createElement("div");
    const card = document.createElement("aside");
    const title = document.createElement("strong");
    const sibling = document.createElement("p");
    root.append(sequence, sibling);
    sequence.append(card);
    card.append(title);

    const descriptors = [
      createTargetDescriptor(sequence, { key: "sequence" }, 0),
      createTargetDescriptor(
        card,
        { key: "card", transformScope: "subtree" },
        1,
      ),
      createTargetDescriptor(title, { key: "card.title" }, 2),
      createTargetDescriptor(sibling, { key: "sibling" }, 3),
    ];
    const tree = createTargetLayerTree(descriptors);

    const plan = createTransformGroupPlan({
      descriptors,
      layersByKey: tree.recordsByKey,
      layoutsByKey: new Map<string, ProjectedDOMRect>([
        ["sequence", layout(100, 100, 600, 320)],
        ["card", layout(160, 120, 220, 140)],
        ["card.title", layout(140, 150, 160, 32)],
        ["sibling", layout(420, 80, 180, 40)],
      ]),
    });

    expect(plan.groupsByKey.get("card")).toEqual({
      key: "card",
      parentGroupKey: undefined,
      layout: layout(160, 120, 220, 140),
    });
    expect(plan.attachmentsByKey.get("sequence")).toEqual({
      key: "sequence",
      groupKey: undefined,
      layout: layout(100, 100, 600, 320),
    });
    expect(plan.attachmentsByKey.get("card")).toEqual({
      key: "card",
      groupKey: "card",
      layout: layout(0, 0, 220, 140),
    });
    expect(plan.attachmentsByKey.get("card.title")).toEqual({
      key: "card.title",
      groupKey: "card",
      layout: layout(-20, 30, 160, 32),
    });
    expect(plan.attachmentsByKey.get("sibling")).toEqual({
      key: "sibling",
      groupKey: undefined,
      layout: layout(420, 80, 180, 40),
    });
  });

  test("starts a new attachment root for nested subtree transform roots", () => {
    const root = document.createElement("section");
    const card = document.createElement("aside");
    const media = document.createElement("figure");
    const caption = document.createElement("figcaption");
    root.append(card);
    card.append(media);
    media.append(caption);

    const descriptors = [
      createTargetDescriptor(
        card,
        { key: "card", transformScope: "subtree" },
        0,
      ),
      createTargetDescriptor(
        media,
        { key: "card.media", transformScope: "subtree" },
        1,
      ),
      createTargetDescriptor(caption, { key: "card.media.caption" }, 2),
    ];
    const tree = createTargetLayerTree(descriptors);

    const plan = createTransformGroupPlan({
      descriptors,
      layersByKey: tree.recordsByKey,
      layoutsByKey: new Map<string, ProjectedDOMRect>([
        ["card", layout(200, 180, 240, 160)],
        ["card.media", layout(230, 210, 180, 96)],
        ["card.media.caption", layout(250, 190, 140, 28)],
      ]),
    });

    expect(plan.groupsByKey.get("card")).toEqual({
      key: "card",
      parentGroupKey: undefined,
      layout: layout(200, 180, 240, 160),
    });
    expect(plan.groupsByKey.get("card.media")).toEqual({
      key: "card.media",
      parentGroupKey: "card",
      layout: layout(30, 30, 180, 96),
    });
    expect(plan.attachmentsByKey.get("card.media")).toEqual({
      key: "card.media",
      groupKey: "card.media",
      layout: layout(0, 0, 180, 96),
    });
    expect(plan.attachmentsByKey.get("card.media.caption")).toEqual({
      key: "card.media.caption",
      groupKey: "card.media",
      layout: layout(20, -20, 140, 28),
    });
  });

  test("keeps descendants at scene root when the transform root has no layout", () => {
    const root = document.createElement("section");
    const card = document.createElement("aside");
    const title = document.createElement("strong");
    root.append(card);
    card.append(title);

    const descriptors = [
      createTargetDescriptor(
        card,
        { key: "card", transformScope: "subtree" },
        0,
      ),
      createTargetDescriptor(title, { key: "card.title" }, 1),
    ];
    const tree = createTargetLayerTree(descriptors);

    const plan = createTransformGroupPlan({
      descriptors,
      layersByKey: tree.recordsByKey,
      layoutsByKey: new Map<string, ProjectedDOMRect>([
        ["card.title", layout(140, 150, 160, 32)],
      ]),
    });

    expect(plan.groupsByKey.has("card")).toBe(false);
    expect(plan.attachmentsByKey.get("card.title")).toEqual({
      key: "card.title",
      groupKey: undefined,
      layout: layout(140, 150, 160, 32),
    });
  });
});

function layout(
  x: number,
  y: number,
  width: number,
  height: number,
): ProjectedDOMRect {
  return { x, y, width, height };
}
