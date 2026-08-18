import { TreeNode, TreeNodeWithPath } from "./types";

export interface LayoutNode extends TreeNode {
  x: number;
  y: number;
  width: number;
  children?: LayoutNode[];
}

const NODE_RADIUS = 20;
const LEVEL_HEIGHT = 120;
const H_SPACING = 80;

/**
 * Calculate tree layout positions using a recursive algorithm.
 * Positions nodes so that:
 * - Root is near top center
 * - Children branch downward
 * - Each parent is centered above its children
 */
export function calculateLayout(
  node: TreeNode,
  maxWidth: number = 1200
): LayoutNode {
  const layout = layoutNode(node, 0, maxWidth);
  centerTree(layout, maxWidth / 2);
  return layout;
}

function layoutNode(
  node: TreeNode,
  depth: number,
  availableWidth: number
): LayoutNode {
  const children = node.children || [];

  if (children.length === 0) {
    // Leaf node
    return {
      ...node,
      x: 0,
      y: depth * LEVEL_HEIGHT,
      width: H_SPACING,
      children: [],
    };
  }

  // Recursively layout children
  const layoutChildren = children.map((child) =>
    layoutNode(child, depth + 1, availableWidth / children.length)
  );

  // Calculate total width needed by children
  const totalWidth = layoutChildren.reduce((sum, child) => sum + child.width, 0);
  const childSpacing = Math.max(H_SPACING, totalWidth / children.length);

  // Position children horizontally
  let xOffset = -totalWidth / 2;
  layoutChildren.forEach((child) => {
    child.x = xOffset + child.width / 2;
    xOffset += child.width;
  });

  return {
    ...node,
    x: 0,
    y: depth * LEVEL_HEIGHT,
    width: Math.max(H_SPACING, totalWidth),
    children: layoutChildren,
  };
}

function centerTree(node: LayoutNode, centerX: number): void {
  node.x = centerX;
  if (node.children) {
    const childLeft = Math.min(...node.children.map((c) => c.x));
    const childRight = Math.max(...node.children.map((c) => c.x));
    const childCenter = (childLeft + childRight) / 2;
    const offset = centerX - childCenter;

    node.children.forEach((child) => {
      centerTree(child, child.x + offset);
    });
  }
}

/**
 * Flatten layout tree to get all nodes with their coordinates
 */
export function flattenLayout(node: LayoutNode): LayoutNode[] {
  const result = [node];
  if (node.children) {
    node.children.forEach((child) => {
      result.push(...flattenLayout(child));
    });
  }
  return result;
}

/**
 * Find a target node in the tree and return path from root
 */
export function findPathToTarget(
  node: TreeNode,
  targetId: string,
  currentPath: TreeNode[] = []
): TreeNode[] | null {
  const path = [...currentPath, node];

  if (node.target === targetId) {
    return path;
  }

  if (node.children) {
    for (const child of node.children) {
      const result = findPathToTarget(child, targetId, path);
      if (result) {
        return result;
      }
    }
  }

  return null;
}

/**
 * Validate tree structure
 */
export function validateTree(tree: TreeNode): string[] {
  const errors: string[] = [];
  const seenIds = new Set<string>();
  const seenTargets = new Set<string>();

  function validateNode(node: TreeNode, path: string[] = []): void {
    const currentPath = [...path, node.id];

    // Check for duplicate IDs
    if (seenIds.has(node.id)) {
      errors.push(`Duplicate node ID: ${node.id}`);
    }
    seenIds.add(node.id);

    // Check target
    if (node.target) {
      if (seenTargets.has(node.target)) {
        errors.push(`Duplicate target: ${node.target}`);
      }
      seenTargets.add(node.target);

      // Target nodes should be leaves
      if (node.children && node.children.length > 0) {
        errors.push(
          `Target node ${node.id} has children (should be a leaf)`
        );
      }
    }

    // Recursively validate children
    if (node.children) {
      node.children.forEach((child) => validateNode(child, currentPath));
    }
  }

  validateNode(tree);
  return errors;
}
