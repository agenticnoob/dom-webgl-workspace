import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

const dogfoodClipNames = [
  "MainSkeleton.001",
  "SpeedLines.001",
  "Plane.250",
  "Plane.251",
  "Plane.252",
  "Plane.253",
  "Plane.254",
  "Plane.256",
  "Plane.258",
  "Plane.262",
  "Plane.263",
  "Plane.264",
  "Ray.001",
  "checkoutCTRL.001",
  "BagArmature.001",
] as const;

describe("managed model dogfood asset contract", () => {
  test("uses explicit Sprint clips that exist in the GLB", () => {
    const glb = readGLBJSON("apps/example/public/models/Sprint.glb");

    for (const clip of dogfoodClipNames) {
      expect(readAnimation(glb, clip).channels.length).toBeGreaterThan(0);
    }
  });

  test("uses the Sprint main skeleton clip for visible animation dogfood", () => {
    const glb = readGLBJSON("apps/example/public/models/Sprint.glb");
    const mainSkeleton = readAnimation(glb, "MainSkeleton.001");
    const bag = readAnimation(glb, "BagArmature.001");

    expect(mainSkeleton.channels.length).toBeGreaterThanOrEqual(80);
    expect(bag.channels.length).toBeLessThan(mainSkeleton.channels.length);
    expect(
      mainSkeleton.channels.some((channel) =>
        readNodeName(glb, channel.target.node).startsWith("mixamorig:"),
      ),
    ).toBe(true);
  });
});

type GLBJSON = {
  readonly nodes?: readonly { readonly name?: string }[];
  readonly animations?: readonly {
    readonly name?: string;
    readonly channels: readonly {
      readonly target: { readonly node: number; readonly path: string };
    }[];
  }[];
};

function readGLBJSON(path: string): GLBJSON {
  const buffer = readFileSync(path);
  if (buffer.toString("utf8", 0, 4) !== "glTF") {
    throw new Error(`Expected ${path} to be a GLB file.`);
  }

  let offset = 12;
  while (offset < buffer.length) {
    const length = buffer.readUInt32LE(offset);
    offset += 4;
    const type = buffer.toString("utf8", offset, offset + 4);
    offset += 4;
    const chunk = buffer.subarray(offset, offset + length);
    offset += length;

    if (type === "JSON") {
      return JSON.parse(chunk.toString("utf8").replace(/\0+$/, "")) as GLBJSON;
    }
  }

  throw new Error(`Expected ${path} to contain a GLB JSON chunk.`);
}

function readAnimation(
  glb: GLBJSON,
  name: string,
): NonNullable<GLBJSON["animations"]>[number] {
  const animation = glb.animations?.find((candidate) => candidate.name === name);
  if (!animation) {
    throw new Error(`Expected Sprint.glb to include animation ${name}.`);
  }
  return animation;
}

function readNodeName(glb: GLBJSON, index: number): string {
  return glb.nodes?.[index]?.name ?? "";
}
