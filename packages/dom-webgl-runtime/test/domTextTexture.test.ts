import { LinearFilter, SRGBColorSpace } from "three";
import { afterEach, describe, expect, test, vi } from "vitest";

import { createDOMTextTexture } from "../src/lib/domTextTexture";

afterEach(() => vi.restoreAllMocks());

describe("DOM text CanvasTexture", () => {
  test("keeps CSS size, renders at capped DPR, and owns disposal of the native texture", () => {
    const context = {
      font: "",
      fillStyle: "",
      textAlign: "",
      textBaseline: "",
      globalAlpha: 1,
      save: vi.fn(),
      restore: vi.fn(),
      setTransform: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn((text: string) => ({ width: text.length * 10 })),
    };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() =>
      Object.assign(context),
    );
    const element = document.createElement("p");
    element.textContent = "DOM";
    element.style.color = "rgb(25, 30, 35)";
    vi.spyOn(element, "getBoundingClientRect").mockReturnValue(
      new DOMRect(0, 0, 100.25, 30.5),
    );
    const result = createDOMTextTexture(element, { devicePixelRatio: 3 });
    expect(result).toMatchObject({ width: 100.25, height: 30.5 });
    expect(result.texture.image).toMatchObject({ width: 201, height: 61 });
    expect(result.texture.colorSpace).toBe(SRGBColorSpace);
    expect(result.texture.minFilter).toBe(LinearFilter);
    expect(result.texture.magFilter).toBe(LinearFilter);
    expect(result.texture.generateMipmaps).toBe(false);
    expect(context.setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0);
    expect(context.fillStyle).toBe("rgb(25, 30, 35)");
    const disposed = vi.fn();
    result.texture.addEventListener("dispose", disposed);
    result.dispose();
    result.dispose();
    expect(disposed).toHaveBeenCalledTimes(1);
  });

  test("reports a missing 2D context so callers can keep semantic DOM visible", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    expect(() => createDOMTextTexture(document.createElement("p"))).toThrow(
      "DOM text textures require a 2D canvas context.",
    );
  });
});
