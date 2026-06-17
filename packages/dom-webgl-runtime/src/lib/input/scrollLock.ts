export type ScrollLockController = {
  lock(): void;
  unlock(): void;
  isLocked(): boolean;
  dispose(): void;
};

export function createScrollLockController(
  rootElement: HTMLElement,
): ScrollLockController {
  let isLocked = false;
  let previousOverflow = "";

  function lock(): void {
    if (isLocked) {
      return;
    }

    previousOverflow = rootElement.style.overflow;
    rootElement.style.overflow = "hidden";
    isLocked = true;
  }

  function unlock(): void {
    if (!isLocked) {
      return;
    }

    rootElement.style.overflow = previousOverflow;
    previousOverflow = "";
    isLocked = false;
  }

  return {
    lock,
    unlock,
    isLocked: () => isLocked,
    dispose: unlock,
  };
}
