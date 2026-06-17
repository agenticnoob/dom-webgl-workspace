import { useContext } from "react";

import { WebGLRuntimeContext } from "./runtimeContext";

export function useWebGLRuntime() {
  const runtime = useContext(WebGLRuntimeContext);

  if (runtime === null) {
    throw new Error(
      "useWebGLRuntime must be used within a WebGLRuntimeProvider.",
    );
  }

  return runtime;
}
