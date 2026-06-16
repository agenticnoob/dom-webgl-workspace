import { describe, expect, it } from "vitest";

describe("demo App", () => {
  it("imports the demo app component", async () => {
    const module = await import("./App");

    expect(module.default).toBeTypeOf("function");
  });
});
