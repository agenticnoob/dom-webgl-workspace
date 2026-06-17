import * as React from "react";

import type { WebGLDebugState } from "@project/dom-webgl-runtime";

export type DebugPanelProps = {
  state: WebGLDebugState;
};

export function DebugPanel({ state }: DebugPanelProps) {
  return (
    <aside className="debug-panel" aria-label="Runtime debug panel">
      <div className="debug-panel__metric">
        <span className="debug-panel__label">Targets</span>
        <strong>{state.targetCount}</strong>
      </div>
      <div className="debug-panel__metric">
        <span className="debug-panel__label">Renderables</span>
        <strong>{state.renderableCount}</strong>
      </div>
      <div className="debug-panel__metric">
        <span className="debug-panel__label">Scroll</span>
        <strong>{state.currentScrollMode}</strong>
      </div>
      <div className="debug-panel__metric">
        <span className="debug-panel__label">Pointer</span>
        <strong>
          {Math.round(state.pointer.x)}, {Math.round(state.pointer.y)}
        </strong>
      </div>
    </aside>
  );
}
