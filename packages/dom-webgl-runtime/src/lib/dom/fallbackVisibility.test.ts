import { describe, expect, test } from "vitest";

import { markManagedFallbackRoot } from "./fallbackBoundary";
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

  test("uses default hide behavior and self mode from options", () => {
    const element = document.createElement("section");
    const child = document.createElement("button");
    element.appendChild(child);

    const controller = createFallbackVisibilityController(
      element,
      {},
      { defaultHideWhenReady: true, defaultHideMode: "self" },
    );

    controller.hide();

    expect(element.style.visibility).toBe("hidden");
    expect(child.style.visibility).toBe("visible");
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

  test("self mode restores only the target fallback and preserves child inline visibility", () => {
    const element = document.createElement("section");
    const child = document.createElement("button");
    child.style.visibility = "visible";
    child.textContent = "Launch";
    element.appendChild(child);

    const controller = createFallbackVisibilityController(element, {
      hideWhenReady: true,
      hideMode: "self",
    });

    controller.hide();

    expect(element.style.visibility).toBe("hidden");
    expect(child.style.visibility).toBe("visible");

    controller.restore();

    expect(element.getAttribute("style")).toBeNull();
    expect(child.style.visibility).toBe("visible");
    expect(child.textContent).toBe("Launch");
  });

  test("parent self mode does not override nested managed fallback targets", () => {
    const parent = document.createElement("section");
    const child = document.createElement("p");
    parent.appendChild(child);
    const parentController = createFallbackVisibilityController(parent, {
      hideWhenReady: true,
      hideMode: "self",
    });
    const childController = createFallbackVisibilityController(child, {
      hideWhenReady: true,
      hideMode: "self",
    });

    childController.hide();
    parentController.hide();

    expect(parent.style.visibility).toBe("hidden");
    expect(child.style.visibility).toBe("hidden");

    parentController.restore();
    expect(child.style.visibility).toBe("hidden");

    childController.restore();
    expect(child.getAttribute("style")).toBeNull();
  });

  test("parent self mode keeps nested target fallback visible before the child is ready", () => {
    const parent = document.createElement("section");
    const childRoot = document.createElement("aside");
    const childCopy = document.createElement("p");
    childCopy.textContent = "Nested card";
    childRoot.append(childCopy);
    parent.append(childRoot);
    const unmarkChild = markManagedFallbackRoot(childRoot, "card");

    const parentController = createFallbackVisibilityController(parent, {
      hideWhenReady: true,
      hideMode: "self",
    });

    parentController.hide();

    expect(parent.style.visibility).toBe("hidden");
    expect(childRoot.style.visibility).toBe("visible");
    expect(childCopy.getAttribute("style")).toBeNull();

    parentController.restore();
    unmarkChild();
  });

  test("parent restore does not reveal a nested target hidden by its own controller", () => {
    const parent = document.createElement("section");
    const childRoot = document.createElement("aside");
    parent.append(childRoot);
    const unmarkChild = markManagedFallbackRoot(childRoot, "card");

    const parentController = createFallbackVisibilityController(parent, {
      hideWhenReady: true,
      hideMode: "self",
    });
    const childController = createFallbackVisibilityController(
      childRoot,
      {
        hideWhenReady: true,
        hideMode: "self",
      },
      { key: "card" },
    );

    childController.hide();
    parentController.hide();
    parentController.restore();

    expect(childRoot.style.visibility).toBe("hidden");

    childController.restore();
    expect(childRoot.getAttribute("style")).toBeNull();
    unmarkChild();
  });

  test("parent subtree mode hides ordinary descendants without owning nested target descendants", () => {
    const parent = document.createElement("section");
    const ordinary = document.createElement("span");
    const childRoot = document.createElement("aside");
    const childCopy = document.createElement("p");
    childRoot.append(childCopy);
    parent.append(ordinary, childRoot);
    const unmarkChild = markManagedFallbackRoot(childRoot, "card");

    const parentController = createFallbackVisibilityController(parent, {
      hideWhenReady: true,
      hideMode: "subtree",
    });

    parentController.hide();

    expect(parent.style.visibility).toBe("hidden");
    expect(ordinary.style.visibility).toBe("hidden");
    expect(childRoot.style.visibility).toBe("visible");
    expect(childCopy.getAttribute("style")).toBeNull();

    parentController.restore();
    unmarkChild();
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
