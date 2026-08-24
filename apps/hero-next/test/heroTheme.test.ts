import { describe, expect, test, vi } from "vitest";

import { resolveHeroChapterScrollState } from "../src/heroChapterScroll";
import {
  createHeroThemeStore,
  heroThemeStorageKey,
  isHeroThemeInteractionEnabled,
  readPersistedHeroTheme,
  type HeroThemeStorage,
} from "../src/heroTheme";

function createStorage(initial?: string) {
  const values = new Map<string, string>();
  if (initial !== undefined) {
    values.set(heroThemeStorageKey, initial);
  }
  return {
    values,
    storage: {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        values.set(key, value);
      }),
    } satisfies HeroThemeStorage,
  };
}

describe("hero committed theme", () => {
  test("hydrates the persisted scheme and persists one committed truth", () => {
    const { storage, values } = createStorage("inverted");
    const store = createHeroThemeStore(storage);
    const listener = vi.fn();
    store.subscribe(listener);

    expect(store.getSnapshot()).toBe("inverted");
    expect(store.getServerSnapshot()).toBe("initial");
    store.commit("initial");

    expect(store.getSnapshot()).toBe("initial");
    expect(values.get(heroThemeStorageKey)).toBe("initial");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  test("defaults invalid or unavailable storage to the initial scheme", () => {
    expect(readPersistedHeroTheme(createStorage("sepia").storage)).toBe(
      "initial",
    );
    expect(readPersistedHeroTheme(undefined)).toBe("initial");
  });

  test("enables the mesh theme gesture only at the two complete Hubs", () => {
    expect(
      isHeroThemeInteractionEnabled(resolveHeroChapterScrollState(0, 0)),
    ).toBe(true);
    expect(
      isHeroThemeInteractionEnabled(resolveHeroChapterScrollState(0.2, 0)),
    ).toBe(false);
    expect(
      isHeroThemeInteractionEnabled(resolveHeroChapterScrollState(1, 0)),
    ).toBe(false);
    expect(
      isHeroThemeInteractionEnabled(resolveHeroChapterScrollState(1, 1)),
    ).toBe(true);
  });
});
