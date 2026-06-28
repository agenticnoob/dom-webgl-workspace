import type { TargetDescriptor } from "./targetDescriptor";

export type TargetLayerRecord = {
  key: string;
  parentKey: string | undefined;
  depth: number;
  siblingIndex: number;
  paintIndex: number;
};

export type TargetLayerTree = {
  recordsByKey: Map<string, TargetLayerRecord>;
  orderedRecords: TargetLayerRecord[];
};

export function createTargetLayerTree(
  descriptors: readonly TargetDescriptor[],
): TargetLayerTree {
  const descriptorsByElement = new Map<HTMLElement, TargetDescriptor>();
  const childrenByParentKey = new Map<string | undefined, TargetDescriptor[]>();

  for (const descriptor of descriptors) {
    descriptorsByElement.set(descriptor.element, descriptor);
  }

  for (const descriptor of descriptors) {
    const parentKey = findParentKey(descriptor, descriptorsByElement);
    const children = childrenByParentKey.get(parentKey) ?? [];
    children.push(descriptor);
    childrenByParentKey.set(parentKey, children);
  }

  for (const children of childrenByParentKey.values()) {
    children.sort(compareDescriptorDOMOrder);
  }

  const recordsByKey = new Map<string, TargetLayerRecord>();
  const orderedRecords: TargetLayerRecord[] = [];
  let paintIndex = 0;

  visitChildren(undefined, 0);

  return { recordsByKey, orderedRecords };

  function visitChildren(parentKey: string | undefined, depth: number): void {
    const children = childrenByParentKey.get(parentKey) ?? [];

    children.forEach((descriptor, siblingIndex) => {
      const record: TargetLayerRecord = {
        key: descriptor.key,
        parentKey,
        depth,
        siblingIndex,
        paintIndex,
      };

      paintIndex += 1;
      recordsByKey.set(record.key, record);
      orderedRecords.push(record);
      visitChildren(record.key, depth + 1);
    });
  }
}

function findParentKey(
  descriptor: TargetDescriptor,
  descriptorsByElement: ReadonlyMap<HTMLElement, TargetDescriptor>,
): string | undefined {
  let parent = descriptor.element.parentElement;

  while (parent) {
    const parentDescriptor = descriptorsByElement.get(parent);

    if (parentDescriptor) {
      return parentDescriptor.key;
    }

    parent = parent.parentElement;
  }

  return undefined;
}

function compareDescriptorDOMOrder(
  left: TargetDescriptor,
  right: TargetDescriptor,
): number {
  if (left.element === right.element) {
    return left.scanOrder - right.scanOrder;
  }

  const position = left.element.compareDocumentPosition(right.element);

  if (position & Node.DOCUMENT_POSITION_FOLLOWING) {
    return -1;
  }

  if (position & Node.DOCUMENT_POSITION_PRECEDING) {
    return 1;
  }

  return left.scanOrder - right.scanOrder;
}
