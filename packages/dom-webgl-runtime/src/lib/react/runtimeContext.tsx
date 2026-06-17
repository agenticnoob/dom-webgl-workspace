import { createContext, type ReactNode } from "react";

import type { WebGLRuntime } from "../types";

export const WebGLRuntimeContext = createContext<WebGLRuntime | null>(null);

export type WebGLRuntimeProviderProps = {
  runtime: WebGLRuntime;
  children?: ReactNode;
};

export function WebGLRuntimeProvider({
  runtime,
  children,
}: WebGLRuntimeProviderProps) {
  return (
    <WebGLRuntimeContext.Provider value={runtime}>
      {children}
    </WebGLRuntimeContext.Provider>
  );
}
