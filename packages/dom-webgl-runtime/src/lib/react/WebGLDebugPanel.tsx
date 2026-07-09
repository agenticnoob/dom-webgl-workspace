import {
  createElement,
  useState,
  type CSSProperties,
  type FunctionComponent,
  type ReactElement,
} from "react";

import type { WebGLDebugState, WebGLResourceStatus } from "../types";

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useWebGLDebugState(): [
  WebGLDebugState,
  (state: WebGLDebugState) => void,
] {
  const [state, setState] = useState<WebGLDebugState>(createInitialDebugState);

  return [state, setState];
}

// ─── Styles (inline, zero CSS dependency) ───────────────────────────────────

const STYLES = {
  pill: {
    position: "fixed" as const,
    bottom: 16,
    left: 16,
    zIndex: 2147483647,
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 14px",
    borderRadius: 20,
    background: "rgba(0, 0, 0, 0.55)",
    backdropFilter: "blur(6px)",
    WebkitBackdropFilter: "blur(6px)",
    color: "#e4e4e7",
    font: '11px/1.5 ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
    cursor: "pointer",
    userSelect: "none",
    whiteSpace: "nowrap" as const,
    WebkitUserSelect: "none",
  },
  panel: {
    position: "fixed" as const,
    bottom: 16,
    left: 16,
    zIndex: 2147483647,
    minWidth: 260,
    maxWidth: 360,
    maxHeight: "60vh",
    padding: "10px 14px",
    borderRadius: 10,
    background: "rgba(0, 0, 0, 0.82)",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
    color: "#e4e4e7",
    font: '11px/1.5 ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
    overflowY: "auto" as const,
    cursor: "default",
    userSelect: "none",
    WebkitUserSelect: "none",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    cursor: "pointer",
    userSelect: "none",
    WebkitUserSelect: "none",
    paddingBottom: 8,
    borderBottom: "1px solid rgba(255,255,255,0.1)",
  },
  headerDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#22c55e",
    flexShrink: 0,
  } as CSSProperties,
  headerTitle: {
    fontSize: 12,
    fontWeight: 600,
    color: "#f4f4f5",
    flex: 1,
  } as CSSProperties,
  headerCounts: {
    color: "#a1a1aa",
    fontSize: 10,
  } as CSSProperties,
  headerToggle: {
    color: "#71717a",
    fontSize: 14,
    lineHeight: 1,
    flexShrink: 0,
  } as CSSProperties,
  body: {
    paddingTop: 8,
    display: "flex",
    flexDirection: "column",
    gap: 4,
  } as CSSProperties,
  metricRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
  } as CSSProperties,
  metricLabel: {
    color: "#a1a1aa",
  } as CSSProperties,
  metricValue: {
    color: "#e4e4e7",
    fontWeight: 600,
  } as CSSProperties,
  gateValue: {
    color: "#a78bfa",
  } as CSSProperties,
  targetSection: {
    marginTop: 6,
    paddingTop: 6,
    borderTop: "1px solid rgba(255,255,255,0.06)",
  } as CSSProperties,
  targetToggle: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    cursor: "pointer",
    color: "#a1a1aa",
    fontSize: 11,
    userSelect: "none",
    WebkitUserSelect: "none",
    padding: "2px 0",
  } as CSSProperties,
  targetList: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    marginTop: 4,
  } as CSSProperties,
  targetRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "3px 4px",
    borderRadius: 4,
    fontSize: 10,
    lineHeight: 1.4,
  } as CSSProperties,
  targetRowEven: {
    background: "rgba(255,255,255,0.03)",
  } as CSSProperties,
  targetDot: (status: WebGLResourceStatus): CSSProperties => ({
    width: 6,
    height: 6,
    borderRadius: "50%",
    flexShrink: 0,
    background:
      status === "ready"
        ? "#22c55e"
        : status === "loading"
          ? "#eab308"
          : status === "error"
            ? "#ef4444"
            : "#6b7280",
  }),
  targetKey: {
    color: "#e4e4e7",
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
    flex: 1,
  } as CSSProperties,
  targetBadge: (bg: string): CSSProperties => ({
    padding: "1px 5px",
    borderRadius: 3,
    background: bg,
    color: "#18181b",
    fontSize: 9,
    fontWeight: 600,
    flexShrink: 0,
  }),
  targetStatusText: {
    color: "#71717a",
    flexShrink: 0,
  } as CSSProperties,
  targetError: {
    color: "#f87171",
    fontSize: 10,
    paddingLeft: 12,
    marginTop: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  } as CSSProperties,
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function createInitialDebugState(): WebGLDebugState {
  return {
    targetCount: 0,
    renderableCount: 0,
    currentScrollMode: "page",
    pointer: {
      x: 0,
      y: 0,
      normalizedX: 0,
      normalizedY: 0,
      isInside: false,
      isDown: false,
      downTime: 0,
      pressDuration: 0,
      isDragging: false,
      dragStartX: 0,
      dragStartY: 0,
      dragDeltaX: 0,
      dragDeltaY: 0,
      clickCount: 0,
      buttons: [],
      modifiers: { shift: false, alt: false, ctrl: false, meta: false },
    },
    targets: [],
  };
}

function sourceKindAbbr(kind: string): string {
  switch (kind) {
    case "dom/element":
      return "elem";
    case "dom/text":
      return "text";
    case "media/image":
      return "img";
    case "media/video":
      return "vid";
    case "media/image-sequence":
      return "seq";
    case "model/glb":
      return "mdl";
    default:
      return kind.slice(0, 4);
  }
}

function renderRoleAbbr(role: string): string {
  switch (role) {
    case "surface":
      return "surf";
    case "content":
      return "cont";
    case "media":
      return "medi";
    case "model":
      return "mdlR";
    case "overlay":
      return "over";
    default:
      return role.slice(0, 4);
  }
}

function renderInteractionRows(
  interaction: WebGLDebugState["interaction"],
): ReactElement[] {
  if (!interaction) {
    return [];
  }

  const objectState = [
    interaction.hoveredObjectId ? `hover ${interaction.hoveredObjectId}` : "",
    interaction.pressedObjectId ? `press ${interaction.pressedObjectId}` : "",
    interaction.capturedObjectId ? `capture ${interaction.capturedObjectId}` : "",
    interaction.lastClickedObjectId ? `click ${interaction.lastClickedObjectId}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const rows: ReactElement[] = [
    createElement(
      "div",
      { key: "interaction-objects", style: STYLES.metricRow },
      createElement("span", { style: STYLES.metricLabel }, "Interaction"),
      createElement(
        "span",
        { style: STYLES.metricValue },
        objectState || "none",
      ),
    ),
  ];

  if (interaction.cameraController) {
    const cameraState = [
      interaction.cameraController.cameraId,
      interaction.cameraController.sceneId,
      interaction.cameraController.activeGesture ?? "none",
      interaction.cameraController.active ? "active" : "idle",
      interaction.cameraController.damping ? "damping" : "",
    ]
      .filter(Boolean)
      .join(" · ");

    rows.push(
      createElement(
        "div",
        { key: "interaction-camera", style: STYLES.metricRow },
        createElement("span", { style: STYLES.metricLabel }, "Camera"),
        createElement(
          "span",
          { style: STYLES.metricValue },
          cameraState,
        ),
      ),
    );
  }

  return rows;
}

// ─── Component ──────────────────────────────────────────────────────────────

export type WebGLDebugPanelProps = {
  state: WebGLDebugState;
};

export const WebGLDebugPanel: FunctionComponent<WebGLDebugPanelProps> =
  function WebGLDebugPanel({ state }: WebGLDebugPanelProps) {
    const [collapsed, setCollapsed] = useState(true);
    const [targetsExpanded, setTargetsExpanded] = useState(false);
    const visibleCount = state.targets.filter((t) => t.visible).length;

    const toggleCollapsed = () => {
      setCollapsed((prev) => !prev);
    };

    if (collapsed) {
      return createElement(
        "div",
        {
          onClick: toggleCollapsed,
          style: STYLES.pill,
          role: "button",
          "aria-label": "Open WebGL debug panel",
        },
        createElement("span", null, "◉"),
        createElement("span", null, `${state.targetCount}T ${state.renderableCount}R`),
      );
    }

    // Expanded panel
    const targetErrorRows = targetsExpanded
      ? renderTargetErrorRows(state.targets)
      : [];

    return createElement(
      "div",
      { style: STYLES.panel, role: "dialog", "aria-label": "WebGL debug panel" },
      // Header
      createElement(
        "div",
        { onClick: toggleCollapsed, style: STYLES.header, role: "button", "aria-label": "Collapse debug panel" },
        createElement("div", { style: STYLES.headerDot }),
        createElement("span", { style: STYLES.headerTitle }, "Debug"),
        createElement(
          "span",
          { style: STYLES.headerCounts },
          `${state.targetCount}T ${state.renderableCount}R`,
        ),
        createElement("span", { style: STYLES.headerToggle }, "\u2212"),
      ),
      // Body
      createElement(
        "div",
        { style: STYLES.body },
        // Metrics
        createElement(
          "div",
          { style: STYLES.metricRow },
          createElement("span", { style: STYLES.metricLabel }, "Targets"),
          createElement("span", { style: STYLES.metricValue }, String(state.targetCount)),
        ),
        createElement(
          "div",
          { style: STYLES.metricRow },
          createElement("span", { style: STYLES.metricLabel }, "Renderables"),
          createElement("span", { style: STYLES.metricValue }, String(state.renderableCount)),
        ),
        createElement(
          "div",
          { style: STYLES.metricRow },
          createElement("span", { style: STYLES.metricLabel }, "Visible"),
          createElement(
            "span",
            { style: STYLES.metricValue },
            `${visibleCount}/${state.targets.length}`,
          ),
        ),
        createElement(
          "div",
          { style: STYLES.metricRow },
          createElement("span", { style: STYLES.metricLabel }, "Scroll"),
          createElement(
            "span",
            { style: state.currentScrollMode === "gate" ? STYLES.gateValue : STYLES.metricValue },
            state.currentScrollMode === "gate" && state.activeGateKey
              ? `gate \u00B7 ${state.activeGateKey}`
              : state.currentScrollMode,
          ),
        ),
        // Gate progress (only when gate active)
        ...(state.currentScrollMode === "gate" && state.sceneProgress !== undefined
          ? [
              createElement(
                "div",
                { key: "gate-progress", style: STYLES.metricRow },
                createElement("span", { style: STYLES.metricLabel }, "Progress"),
                createElement(
                  "span",
                  { style: STYLES.metricValue },
                  state.sceneProgress.toFixed(3),
                ),
              ),
            ]
          : []),
        // Pointer
        createElement(
          "div",
          { style: STYLES.metricRow },
          createElement("span", { style: STYLES.metricLabel }, "Pointer"),
          createElement(
            "span",
            { style: STYLES.metricValue },
            `${Math.round(state.pointer.x)} \u00D7 ${Math.round(state.pointer.y)}`,
          ),
        ),
        ...renderInteractionRows(state.interaction),
        // Target list section
        ...(state.targets.length > 0
          ? [
              createElement(
                "div",
                { key: "target-section", style: STYLES.targetSection },
                // Toggle
                createElement(
                  "div",
                  {
                    onClick: () => setTargetsExpanded((prev) => !prev),
                    style: STYLES.targetToggle,
                    role: "button",
                    "aria-expanded": targetsExpanded,
                  },
                  createElement("span", null, targetsExpanded ? "\u25BC" : "\u25B6"),
                  createElement(
                    "span",
                    null,
                    `Targets (${state.targets.length})`,
                  ),
                ),
                // List
                ...(targetsExpanded
                  ? [
                      createElement(
                        "div",
                        { key: "target-list", style: STYLES.targetList },
                        ...state.targets.map((target, index) =>
                          createElement(
                            "div",
                            { key: target.key, style: { ...STYLES.targetRow, ...(index % 2 === 1 ? STYLES.targetRowEven : {}) } },
                            createElement("div", {
                              style: STYLES.targetDot(target.resourceStatus),
                            }),
                            createElement(
                              "span",
                              { style: STYLES.targetKey, title: target.key },
                              target.key,
                            ),
                            createElement(
                              "span",
                              { style: STYLES.targetBadge("rgba(161,161,170,0.2)") },
                              sourceKindAbbr(target.sourceKind),
                            ),
                            createElement(
                              "span",
                              { style: STYLES.targetBadge("rgba(161,161,170,0.15)") },
                              renderRoleAbbr(target.renderRole),
                            ),
                            createElement(
                              "span",
                              { style: STYLES.targetStatusText },
                              target.resourceStatus,
                            ),
                          ),
                        ),
                      ),
                    ]
                  : []),
                // Error details
                ...targetErrorRows,
              ),
            ]
          : []),
      ),
    );
  };

function renderTargetErrorRows(
  targets: WebGLDebugState["targets"],
): ReactElement[] {
  const rows: ReactElement[] = [];

  for (const target of targets) {
    if (target.resourceStatus !== "error" || !target.error) {
      continue;
    }

    rows.push(
      createElement(
        "div",
        { key: `error-${target.key}`, style: STYLES.targetError },
        `\u21B3 ${target.error}`,
      ),
    );
  }

  return rows;
}
