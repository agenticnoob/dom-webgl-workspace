import { describe, expect, test } from "vitest";

import { readDOMStyleSnapshot } from "./styleSnapshot";

describe("readDOMStyleSnapshot", () => {
  test("reads common box text and media computed styles", () => {
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
      textAlign: "center",
      objectFit: "cover",
      objectPosition: "25% 75%",
    });

    const snapshot = readDOMStyleSnapshot(element);

    expect(snapshot.box).toMatchObject({
      opacity: 0.72,
      backgroundColor: "rgb(240, 248, 255)",
      borderTopWidth: 2,
      borderRightWidth: 2,
      borderBottomWidth: 2,
      borderLeftWidth: 2,
      borderTopColor: "rgb(12, 34, 56)",
      borderRightColor: "rgb(12, 34, 56)",
      borderBottomColor: "rgb(12, 34, 56)",
      borderLeftColor: "rgb(12, 34, 56)",
      borderTopLeftRadius: 18,
      borderTopRightRadius: 12,
      borderBottomRightRadius: 10,
      borderBottomLeftRadius: 8,
      boxShadow: "0px 12px 24px rgba(0, 0, 0, 0.2)",
    });
    expect(snapshot.text).toMatchObject({
      color: "rgb(20, 24, 28)",
      lineHeight: 30,
      paddingTop: 10,
      paddingRight: 14,
      paddingBottom: 10,
      paddingLeft: 14,
      textAlign: "center",
    });
    expect(snapshot.media).toEqual({
      objectFit: "cover",
      objectPosition: "25% 75%",
    });
    expect(snapshot.rasterSignature).toContain("rgb(240, 248, 255)");
  });
});
