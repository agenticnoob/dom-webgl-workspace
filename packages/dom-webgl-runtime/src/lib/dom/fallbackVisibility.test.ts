import { describe, expect, test } from "vitest";

import { createFallbackVisibilityController } from "./fallbackVisibility";

describe("createFallbackVisibilityController", () => {
  test("leaves DOM unchanged when hideWhenReady is omitted", () => {
    const element = document.createElement("section");
    element.setAttribute("class", "hero highlighted");
    element.setAttribute("style", "color: red;");

    const controller = createFallbackVisibilityController(element, {});

    controller.hide();
    controller.restore();

    expect(element.getAttribute("class")).toBe("hero highlighted");
    expect(element.getAttribute("style")).toBe("color: red;");
  });

  test("subtree mode hides the target and descendants", () => {
    const element = document.createElement("section");
    const child = document.createElement("span");
    child.style.visibility = "visible";
    element.appendChild(child);

    const controller = createFallbackVisibilityController(element, {
      hideWhenReady: true,
      hideMode: "subtree",
    });

    controller.hide();

    expect(element.style.visibility).toBe("hidden");
    expect(child.style.visibility).toBe("hidden");
  });

  test("self mode hides target paint while child DOM remains visible", () => {
    const element = document.createElement("section");
    const child = document.createElement("button");
    element.appendChild(child);

    const controller = createFallbackVisibilityController(element, {
      hideWhenReady: true,
      hideMode: "self",
    });

    controller.hide();

    expect(element.style.visibility).toBe("hidden");
    expect(child.style.visibility).toBe("visible");
  });

  test("restore returns previous inline styles and classes exactly", () => {
    const element = document.createElement("section");
    const child = document.createElement("span");
    element.setAttribute("class", "hero highlighted");
    element.setAttribute("style", "color: red; visibility: collapse;");
    child.setAttribute("class", "copy");
    child.setAttribute("style", "visibility: hidden; opacity: 0.5;");
    element.appendChild(child);

    const controller = createFallbackVisibilityController(element, {
      hideWhenReady: true,
      hideMode: "self",
    });

    controller.hide();
    controller.hide();
    controller.restore();
    controller.restore();

    expect(element.getAttribute("class")).toBe("hero highlighted");
    expect(element.getAttribute("style")).toBe("color: red; visibility: collapse;");
    expect(child.getAttribute("class")).toBe("copy");
    expect(child.getAttribute("style")).toBe("visibility: hidden; opacity: 0.5;");
  });
});
