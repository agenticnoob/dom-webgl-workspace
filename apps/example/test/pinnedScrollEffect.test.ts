import { expect, test } from "vitest";
import { createTextGlyphCommands } from "../src/textEffects";

test("pinned progress preserves high contrast and reverses without history", () => {
  const glyphs = Array.from("Pinn", (char, index) => ({
    index,
    char,
    line: 0,
    x: index * 16,
    y: 0,
    width: 16,
    height: 24,
    baseline: 18,
  }));
  const input = {
    time: 0,
    width: 100,
    height: 30,
    progress: 0.75,
    pointer: { active: false, x: 0, y: 0 },
  };
  const commands = createTextGlyphCommands("pinned", glyphs, input, {
    color: "#172124",
  });
  expect(commands[0]).toMatchObject({ opacity: 1, color: "#172124" });
  expect(commands[3]).toMatchObject({ opacity: 0.32, scaleX: 0.78 });
  expect(
    createTextGlyphCommands("pinned", glyphs, { ...input, progress: 0 }).every(
      (c) => c.opacity === 0.32,
    ),
  ).toBe(true);
});
