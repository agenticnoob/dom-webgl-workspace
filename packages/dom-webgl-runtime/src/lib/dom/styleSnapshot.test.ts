import { describe, expect, test } from "vitest";

import { createFallbackVisibilityController } from "./fallbackVisibility";
import { readDOMStyleSnapshot } from "./styleSnapshot";

describe("readDOMStyleSnapshot", () => {
  test("reads layout content and media placement styles only", () => {
    const element = document.createElement("div");

    Object.assign(element.style, {
      opacity: "0.72",
      backgroundColor: "rgb(240, 248, 255)",
      border: "2px solid rgb(12, 34, 56)",
      borderRadius: "18px 12px 10px 8px",
      boxShadow: "0px 12px 24px rgba(0, 0, 0, 0.2)",
      color: "rgb(20, 24, 28)",
      fontFamily: "Arial",
      fontSize: "22px",
      fontWeight: "700",
      lineHeight: "30px",
      padding: "10px 14px",
      letterSpacing: "1.5px",
      textAlign: "center",
      whiteSpace: "pre-wrap",
      wordSpacing: "3px",
      objectFit: "cover",
      objectPosition: "25% 75%",
    });

    const snapshot = readDOMStyleSnapshot(element);

    expect(snapshot.box).toMatchObject({
      borderTopWidth: 2,
      borderRightWidth: 2,
      borderBottomWidth: 2,
      borderLeftWidth: 2,
      paddingTop: 10,
      paddingRight: 14,
      paddingBottom: 10,
      paddingLeft: 14,
    });
    expect(snapshot.box).not.toHaveProperty("opacity");
    expect(snapshot.box).not.toHaveProperty("backgroundColor");
    expect(snapshot.box).not.toHaveProperty("borderTopColor");
    expect(snapshot.box).not.toHaveProperty("borderTopLeftRadius");
    expect(snapshot.box).not.toHaveProperty("boxShadow");
    expect(snapshot.box).not.toHaveProperty("transform");
    expect(snapshot.box).not.toHaveProperty("transformOrigin");
    expect(snapshot.text).toMatchObject({
      lineHeight: 30,
      paddingTop: 10,
      paddingRight: 14,
      paddingBottom: 10,
      paddingLeft: 14,
      letterSpacing: 1.5,
      textAlign: "center",
      whiteSpace: "pre-wrap",
      wordSpacing: 3,
    });
    expect(snapshot.text).not.toHaveProperty("color");
    expect(snapshot.media).toEqual({
      objectFit: "cover",
      objectPosition: "25% 75%",
    });
    expect(snapshot.rasterSignature).not.toContain("rgb(240, 248, 255)");
    expect(snapshot.rasterSignature).not.toContain("rgba(0, 0, 0, 0.2)");
  });

  test("reads author visibility after runtime fallback hiding", () => {
    const element = document.createElement("section");
    const fallback = createFallbackVisibilityController(element, {
      hideWhenReady: true,
      hideMode: "self",
    });

    fallback.hide();

    expect(element.style.visibility).toBe("hidden");
    expect(readDOMStyleSnapshot(element).box.visibility).toBe("visible");
  });

  test("preserves author-hidden visibility during runtime fallback hiding", () => {
    const element = document.createElement("section");
    const fallback = createFallbackVisibilityController(element, {
      hideWhenReady: true,
      hideMode: "self",
    });

    element.style.visibility = "collapse";
    fallback.hide();

    expect(element.style.visibility).toBe("hidden");
    expect(readDOMStyleSnapshot(element).box.visibility).toBe("collapse");
  });
});
