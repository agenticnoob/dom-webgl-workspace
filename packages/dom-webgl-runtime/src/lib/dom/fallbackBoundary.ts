const managedRootCounts = new WeakMap<HTMLElement, Map<string, number>>();
const hiddenRootKeys = new WeakMap<HTMLElement, Set<string>>();

export function markManagedFallbackRoot(
  element: HTMLElement,
  key: string,
): () => void {
  const targetKey = key.trim();
  const counts = managedRootCounts.get(element) ?? new Map<string, number>();
  counts.set(targetKey, (counts.get(targetKey) ?? 0) + 1);
  managedRootCounts.set(element, counts);

  return () => {
    const current = managedRootCounts.get(element);
    const count = current?.get(targetKey);

    if (count === undefined) {
      return;
    }

    if (count > 1) {
      current.set(targetKey, count - 1);
      return;
    }

    current.delete(targetKey);
    markManagedFallbackRootVisible(element, targetKey);

    if (current.size === 0) {
      managedRootCounts.delete(element);
    }
  };
}

export function isManagedFallbackRoot(
  element: Element,
): element is HTMLElement {
  return element instanceof HTMLElement && managedRootCounts.has(element);
}

export function markManagedFallbackRootHidden(
  element: HTMLElement,
  key: string,
): void {
  const keys = hiddenRootKeys.get(element) ?? new Set<string>();
  keys.add(key.trim());
  hiddenRootKeys.set(element, keys);
}

export function markManagedFallbackRootVisible(
  element: HTMLElement,
  key: string,
): void {
  const keys = hiddenRootKeys.get(element);
  keys?.delete(key.trim());

  if (keys?.size === 0) {
    hiddenRootKeys.delete(element);
  }
}

export function isManagedFallbackRootHidden(element: Element): boolean {
  return element instanceof HTMLElement && hiddenRootKeys.has(element);
}
