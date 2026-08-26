import type { WebGLProgressSignalSource } from "@viselora/dom-webgl";
import { useCallback, useMemo, useSyncExternalStore } from "react";

import { readHeroChapterScrollState } from "../chapters/scrollState";
import {
  createHeroLocaleStore,
  type HeroLocaleStore,
} from "../preferences/locale";
import {
  createHeroThemeStore,
  type HeroThemeStore,
} from "../preferences/theme";

export function useHeroThemeState(): {
  readonly store: HeroThemeStore;
  readonly scheme: ReturnType<HeroThemeStore["getSnapshot"]>;
} {
  const store = useMemo(createHeroThemeStore, []);
  const scheme = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );
  return { store, scheme };
}

export function useHeroLocaleState(): {
  readonly store: HeroLocaleStore;
  readonly locale: ReturnType<HeroLocaleStore["getSnapshot"]>;
} {
  const store = useMemo(createHeroLocaleStore, []);
  const locale = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );
  return { store, locale };
}

export function useHeroDomContentActive(
  source: WebGLProgressSignalSource,
): boolean {
  const subscribe = useCallback(
    (listener: () => void) => source.subscribe?.(listener) ?? (() => undefined),
    [source],
  );
  const getSnapshot = useCallback(
    () => readHeroChapterScrollState(source).domContentActive,
    [source],
  );

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
