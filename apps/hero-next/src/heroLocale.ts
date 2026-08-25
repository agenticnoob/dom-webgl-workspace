import type { HeroLocale } from "./heroChapterContent";

export const heroLocaleStorageKey = "viselora.hero.locale.v1";

export type HeroLocaleStorage = Pick<Storage, "getItem" | "setItem">;

export type HeroLocaleStore = {
  getSnapshot(): HeroLocale;
  getServerSnapshot(): HeroLocale;
  subscribe(listener: () => void): () => void;
  commit(locale: HeroLocale): void;
};

export function createHeroLocaleStore(
  providedStorage?: HeroLocaleStorage,
): HeroLocaleStore {
  const storage = providedStorage ?? readBrowserStorage();
  let locale = readPersistedHeroLocale(storage);
  const listeners = new Set<() => void>();

  return {
    getSnapshot: () => locale,
    getServerSnapshot: () => "zh",
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    commit(nextLocale) {
      if (nextLocale === locale) {
        return;
      }
      locale = nextLocale;
      persistHeroLocale(storage, nextLocale);
      for (const listener of listeners) {
        listener();
      }
    },
  };
}

export function readPersistedHeroLocale(
  storage: Pick<HeroLocaleStorage, "getItem"> | undefined,
): HeroLocale {
  if (!storage) {
    return "zh";
  }
  try {
    return storage.getItem(heroLocaleStorageKey) === "en" ? "en" : "zh";
  } catch {
    return "zh";
  }
}

export function persistHeroLocale(
  storage: HeroLocaleStorage | undefined,
  locale: HeroLocale,
): void {
  if (!storage) {
    return;
  }
  try {
    storage.setItem(heroLocaleStorageKey, locale);
  } catch {
    return;
  }
}

function readBrowserStorage(): HeroLocaleStorage | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
