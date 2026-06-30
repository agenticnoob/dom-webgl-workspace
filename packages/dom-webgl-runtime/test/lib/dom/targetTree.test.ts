import { describe, expect, test } from "vitest";

import { createTargetDescriptor } from "../../../src/lib/dom/targetDescriptor";
import { createTargetLayerTree } from "../../../src/lib/dom/targetTree";

describe("createTargetLayerTree", () => {
  test("derives parent, depth, sibling index, and paint index from DOM ancestry", () => {
    const root = document.createElement("section");
    const media = document.createElement("div");
    const card = document.createElement("aside");
    const copy = document.createElement("p");
    root.append(media);
    media.append(card);
    card.append(copy);

    const descriptors = [
      createTargetDescriptor(media, { key: "sequence" }, 0),
      createTargetDescriptor(card, { key: "card" }, 1),
      createTargetDescriptor(copy, { key: "card.copy" }, 2),
    ];

    const tree = createTargetLayerTree(descriptors);

    expect(tree.recordsByKey.get("sequence")).toMatchObject({
      key: "sequence",
      parentKey: undefined,
      depth: 0,
      siblingIndex: 0,
      paintIndex: 0,
    });
    expect(tree.recordsByKey.get("card")).toMatchObject({
      key: "card",
      parentKey: "sequence",
      depth: 1,
      siblingIndex: 0,
      paintIndex: 1,
    });
    expect(tree.recordsByKey.get("card.copy")).toMatchObject({
      key: "card.copy",
      parentKey: "card",
      depth: 2,
      siblingIndex: 0,
      paintIndex: 2,
    });
  });

  test("orders sibling targets by DOM order instead of registration order", () => {
    const parent = document.createElement("section");
    const first = document.createElement("div");
    const second = document.createElement("div");
    parent.append(first, second);

    const descriptors = [
      createTargetDescriptor(second, { key: "second" }, 0),
      createTargetDescriptor(first, { key: "first" }, 1),
    ];

    const orderedKeys = createTargetLayerTree(descriptors).orderedRecords.map(
      (record) => record.key,
    );

    expect(orderedKeys).toEqual(["first", "second"]);
  });

  test("uses scan order as a deterministic fallback for disconnected nodes", () => {
    const first = document.createElement("div");
    const second = document.createElement("div");

    const descriptors = [
      createTargetDescriptor(second, { key: "second" }, 1),
      createTargetDescriptor(first, { key: "first" }, 0),
    ];

    const orderedKeys = createTargetLayerTree(descriptors).orderedRecords.map(
      (record) => record.key,
    );

    expect(orderedKeys).toEqual(["first", "second"]);
  });
});
