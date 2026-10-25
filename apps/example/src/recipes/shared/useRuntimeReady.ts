import { useSyncExternalStore } from "react";
import { useWebGLRuntime } from "@viselora/dom-webgl/react";

/** DOM enhancement also depends on the shared renderer remaining available. */
export function useRuntimeReady(): boolean {
  const runtime = useWebGLRuntime();
  return useSyncExternalStore(
    runtime.subscribe,
    () => runtime.getDebugState().ready,
    () => false,
  );
}
