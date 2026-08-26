import type { HeroSchemeName } from "../transition/transitionConfig";

export const heroThemeStorageKey = "viselora.hero.theme.v1";

export type HeroThemeStorage = Pick<Storage, "getItem" | "setItem">;

export type HeroThemeStore = {
  getSnapshot(): HeroSchemeName;
  getServerSnapshot(): HeroSchemeName;
  subscribe(listener: () => void): () => void;
  commit(scheme: HeroSchemeName): void;
};

export function createHeroThemeStore(
  providedStorage?: HeroThemeStorage,
): HeroThemeStore {
  const storage = providedStorage ?? readBrowserStorage();
  let committed = readPersistedHeroTheme(storage);
  const listeners = new Set<() => void>();

  return {
    getSnapshot: () => committed,
    getServerSnapshot: () => "initial",
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    commit(scheme) {
      if (scheme === committed) {
        return;
      }
      committed = scheme;
      persistHeroTheme(storage, scheme);
      for (const listener of listeners) {
        listener();
      }
    },
  };
}

export function readPersistedHeroTheme(
  storage: HeroThemeStorage | undefined,
): HeroSchemeName {
  if (!storage) {
    return "initial";
  }
  try {
    return parseHeroTheme(storage.getItem(heroThemeStorageKey));
  } catch {
    return "initial";
  }
}

export function persistHeroTheme(
  storage: HeroThemeStorage | undefined,
  scheme: HeroSchemeName,
): void {
  if (!storage) {
    return;
  }
  try {
    storage.setItem(heroThemeStorageKey, scheme);
  } catch {
    return;
  }
}

function parseHeroTheme(value: string | null): HeroSchemeName {
  return value === "inverted" ? "inverted" : "initial";
}

function readBrowserStorage(): HeroThemeStorage | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
