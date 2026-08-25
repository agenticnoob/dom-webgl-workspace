import { describe, expect, test, vi } from "vitest";

import {
  createHeroLocaleStore,
  heroLocaleStorageKey,
  readPersistedHeroLocale,
} from "../src/heroLocale";

describe("hero locale", () => {
  test("defaults safely and accepts only supported persisted locales", () => {
    expect(readPersistedHeroLocale(undefined)).toBe("zh");
    expect(readPersistedHeroLocale({ getItem: () => "en" })).toBe("en");
    expect(readPersistedHeroLocale({ getItem: () => "fr" })).toBe("zh");
  });

  test("commits one persisted locale truth and notifies subscribers once", () => {
    const storage = { getItem: vi.fn(() => null), setItem: vi.fn() };
    const store = createHeroLocaleStore(storage);
    const listener = vi.fn();
    store.subscribe(listener);

    store.commit("en");
    store.commit("en");

    expect(store.getSnapshot()).toBe("en");
    expect(store.getServerSnapshot()).toBe("zh");
    expect(storage.setItem).toHaveBeenCalledWith(heroLocaleStorageKey, "en");
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
