import { describe, expect, test } from "vitest";

import { createScrollLockController } from "./scrollLock";

describe("createScrollLockController", () => {
  test("stores and replaces the previous root overflow style when locked", () => {
    const root = document.createElement("main");
    root.style.overflow = "auto";
    const scrollLock = createScrollLockController(root);

    scrollLock.lock();

    expect(root.style.overflow).toBe("hidden");
    expect(scrollLock.isLocked()).toBe(true);
  });

  test("keeps the first stored overflow value when lock is called repeatedly", () => {
    const root = document.createElement("section");
    root.style.overflow = "scroll";
    const scrollLock = createScrollLockController(root);

    scrollLock.lock();
    root.style.overflow = "clip";
    scrollLock.lock();
    scrollLock.unlock();

    expect(root.style.overflow).toBe("scroll");
    expect(scrollLock.isLocked()).toBe(false);
  });

  test("restores the previous inline overflow style on unlock", () => {
    const root = document.createElement("div");
    const scrollLock = createScrollLockController(root);

    scrollLock.lock();
    scrollLock.unlock();

    expect(root.style.overflow).toBe("");
    expect(scrollLock.isLocked()).toBe(false);
  });

  test("treats unlock while unlocked as a safe no-op", () => {
    const root = document.createElement("div");
    root.style.overflow = "visible";
    const scrollLock = createScrollLockController(root);

    scrollLock.unlock();

    expect(root.style.overflow).toBe("visible");
    expect(scrollLock.isLocked()).toBe(false);
  });

  test("dispose always unlocks and is safe after an explicit unlock", () => {
    const root = document.createElement("article");
    root.style.overflow = "auto";
    const scrollLock = createScrollLockController(root);

    scrollLock.lock();
    scrollLock.dispose();
    scrollLock.dispose();

    expect(root.style.overflow).toBe("auto");
    expect(scrollLock.isLocked()).toBe(false);

    scrollLock.lock();
    scrollLock.unlock();
    scrollLock.dispose();

    expect(root.style.overflow).toBe("auto");
    expect(scrollLock.isLocked()).toBe(false);
  });
});
