import type { EventManager } from "@react-three/fiber";
import type { Object3D } from "three";

/** Three.js raycasts ignore `visible`; a hidden ancestor means nothing is drawn. */
export function isDrawnInScene(object: Object3D) {
  for (let node: Object3D | null = object; node; node = node.parent)
    if (!node.visible) return false;
  return true;
}

/** Keeps the manager's own filter and then drops hits on undrawn objects. */
export function withDrawnHits<TTarget>(
  manager: EventManager<TTarget>,
): EventManager<TTarget> {
  const filter = manager.filter;
  return {
    ...manager,
    filter: (items, state) =>
      (filter ? filter(items, state) : items).filter((hit) =>
        isDrawnInScene(hit.object),
      ),
  };
}
