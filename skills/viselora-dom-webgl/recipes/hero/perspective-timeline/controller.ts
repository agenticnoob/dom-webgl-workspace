import type { ScrollEffectProgressStore } from "@viselora/scroll-adapters";
import type { TimelineStageState } from "./effects";
import { clampProgress } from "./track";

/** Native document measurements only; effects never read the DOM or own a loop. */
export function createTimelineController({
  root,
  view,
  stage,
  progressKey,
  store,
}: {
  readonly root: HTMLElement;
  readonly view: HTMLElement;
  readonly stage: TimelineStageState;
  readonly progressKey: string;
  readonly store: ScrollEffectProgressStore;
}) {
  const windowRef = root.ownerDocument.defaultView;
  if (!windowRef)
    throw new Error("PerspectiveTimeline requires a mounted document.");
  const owner = windowRef;
  let disposed = false;
  let request = 0;
  function update() {
    request = 0;
    if (disposed) return;
    const rect = root.getBoundingClientRect();
    const viewport = view.getBoundingClientRect();
    stage.viewport = {
      width: Math.max(1, viewport.width),
      height: Math.max(1, viewport.height),
    };
    stage.visible =
      viewport.bottom > 0 &&
      viewport.top < owner.innerHeight &&
      viewport.right > 0 &&
      viewport.left < owner.innerWidth;
    store.set(
      progressKey,
      clampProgress(-rect.top / Math.max(1, rect.height - viewport.height)),
    );
    // A discrete signal gates the bounded target window outside this row.
    store.set(`${progressKey}.visible`, stage.visible ? 1 : 0);
  }
  function schedule() {
    if (!disposed && !request) request = owner.requestAnimationFrame(update);
  }
  const observer = new ResizeObserver(schedule);
  observer.observe(root);
  observer.observe(view);
  owner.addEventListener("scroll", schedule, { passive: true });
  owner.addEventListener("resize", schedule, { passive: true });
  update();
  return {
    update,
    dispose() {
      if (disposed) return;
      disposed = true;
      observer.disconnect();
      owner.removeEventListener("scroll", schedule);
      owner.removeEventListener("resize", schedule);
      owner.cancelAnimationFrame(request);
      stage.visible = false;
      store.clear(progressKey);
      store.clear(`${progressKey}.visible`);
    },
  };
}
