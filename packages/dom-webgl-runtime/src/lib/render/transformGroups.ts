import type { TargetDescriptor } from "../dom/targetDescriptor";
import type { TargetLayerRecord } from "../dom/targetTree";
import type { ProjectedDOMRect } from "../renderer/domProjection";
import type { WebGLTransformScope } from "../types";

export type TransformScope = WebGLTransformScope;

export type TransformGroupRecord = {
  key: string;
  parentGroupKey: string | undefined;
  layout: ProjectedDOMRect;
};

export type TransformAttachmentRecord = {
  key: string;
  groupKey: string | undefined;
  layout: ProjectedDOMRect;
};

export type TransformGroupPlan = {
  groupsByKey: Map<string, TransformGroupRecord>;
  attachmentsByKey: Map<string, TransformAttachmentRecord>;
};

export type TransformGroupPlanOptions = {
  descriptors: readonly TargetDescriptor[];
  layersByKey: ReadonlyMap<string, TargetLayerRecord>;
  layoutsByKey: ReadonlyMap<string, ProjectedDOMRect>;
};

export function createTransformGroupPlan(
  options: TransformGroupPlanOptions,
): TransformGroupPlan {
  const { descriptors, layersByKey, layoutsByKey } = options;
  const activeTransformRootKeys = new Set<string>();
  const groupsByKey = new Map<string, TransformGroupRecord>();
  const attachmentsByKey = new Map<string, TransformAttachmentRecord>();

  for (const descriptor of descriptors) {
    if (
      descriptor.declaration.transformScope === "subtree" &&
      layoutsByKey.has(descriptor.key)
    ) {
      activeTransformRootKeys.add(descriptor.key);
    }
  }

  for (const descriptor of descriptors) {
    if (!activeTransformRootKeys.has(descriptor.key)) {
      continue;
    }

    const layout = layoutsByKey.get(descriptor.key);
    if (!layout) {
      continue;
    }

    const parentGroupKey = findNearestActiveTransformRoot(
      layersByKey.get(descriptor.key)?.parentKey,
      layersByKey,
      activeTransformRootKeys,
    );
    const parentLayout = parentGroupKey
      ? layoutsByKey.get(parentGroupKey)
      : undefined;

    groupsByKey.set(descriptor.key, {
      key: descriptor.key,
      parentGroupKey,
      layout: parentLayout
        ? toLocalLayout(layout, parentLayout)
        : cloneLayout(layout),
    });
  }

  for (const descriptor of descriptors) {
    const layout = layoutsByKey.get(descriptor.key);
    if (!layout) {
      continue;
    }

    const groupKey = activeTransformRootKeys.has(descriptor.key)
      ? descriptor.key
      : findNearestActiveTransformRoot(
          layersByKey.get(descriptor.key)?.parentKey,
          layersByKey,
          activeTransformRootKeys,
        );
    const groupLayout = groupKey ? layoutsByKey.get(groupKey) : undefined;

    attachmentsByKey.set(descriptor.key, {
      key: descriptor.key,
      groupKey: groupLayout ? groupKey : undefined,
      layout: groupLayout
        ? groupKey === descriptor.key
          ? toSelfLayout(layout)
          : toLocalLayout(layout, groupLayout)
        : cloneLayout(layout),
    });
  }

  return { groupsByKey, attachmentsByKey };
}

function findNearestActiveTransformRoot(
  startKey: string | undefined,
  layersByKey: ReadonlyMap<string, TargetLayerRecord>,
  activeTransformRootKeys: ReadonlySet<string>,
): string | undefined {
  let currentKey = startKey;

  while (currentKey) {
    if (activeTransformRootKeys.has(currentKey)) {
      return currentKey;
    }

    currentKey = layersByKey.get(currentKey)?.parentKey;
  }

  return undefined;
}

function toSelfLayout(layout: ProjectedDOMRect): ProjectedDOMRect {
  return {
    x: 0,
    y: 0,
    width: layout.width,
    height: layout.height,
  };
}

function toLocalLayout(
  layout: ProjectedDOMRect,
  parentLayout: ProjectedDOMRect,
): ProjectedDOMRect {
  return {
    x: layout.x - parentLayout.x,
    y: layout.y - parentLayout.y,
    width: layout.width,
    height: layout.height,
  };
}

function cloneLayout(layout: ProjectedDOMRect): ProjectedDOMRect {
  return {
    x: layout.x,
    y: layout.y,
    width: layout.width,
    height: layout.height,
  };
}
