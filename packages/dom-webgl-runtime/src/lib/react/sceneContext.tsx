import { createContext, createElement, type ReactNode } from "react";

export const WebGLSceneContext = createContext<string | undefined>(undefined);

export type WebGLSceneProviderProps = {
  sceneId: string;
  children?: ReactNode;
};

export function WebGLSceneProvider({
  sceneId,
  children,
}: WebGLSceneProviderProps) {
  return createElement(
    WebGLSceneContext.Provider,
    { value: sceneId },
    children,
  );
}
