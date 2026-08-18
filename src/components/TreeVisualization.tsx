import React, { useEffect, useRef, useCallback, useState } from "react";
import { LayoutNode, flattenLayout } from "../tree";
import { Particle, ParticlePosition, getParticlePosition } from "../animation";
import { MethodColors } from "../types";

interface TreeVisualizationProps {
  layoutTree: LayoutNode | null;
  particles: Particle[];
  methodColors: MethodColors;
  targetFlashDurationMs: number;
  reachedTargets: Set<string>;
}

export const TreeVisualization: React.FC<TreeVisualizationProps> = ({
  layoutTree,
  particles,
  methodColors,
  targetFlashDurationMs,
  reachedTargets,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [scale, setScale] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Calculate SVG bounds
  const allNodes = layoutTree ? flattenLayout(layoutTree) : [];
  const minX = allNodes.length > 0 ? Math.min(...allNodes.map((n) => n.x)) : 0;
  const maxX = allNodes.length > 0 ? Math.max(...allNodes.map((n) => n.x)) : 100;
  const minY = allNodes.length > 0 ? Math.min(...allNodes.map((n) => n.y)) : 0;
  const maxY = allNodes.length > 0 ? Math.max(...allNodes.map((n) => n.y)) : 100;

  const padding = 60;
  const width = (maxX - minX) * 1.2 + padding * 2;
  const height = (maxY - minY) * 1.2 + padding * 2;
  const viewBoxX = minX - padding;
  const viewBoxY = minY - padding;

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale((prev) => Math.max(0.5, Math.min(3, prev * delta)));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - panX, y: e.clientY - panY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPanX(e.clientX - dragStart.x);
      setPanY(e.clientY - dragStart.y);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const resetView = () => {
    setScale(1);
    setPanX(0);
    setPanY(0);
  };

  if (!layoutTree) {
    return (
      <div className="tree-visualization">
        <p>Loading tree...</p>
      </div>
    );
  }

  return (
    <div
      className="tree-visualization-container"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <svg
        ref={svgRef}
        className="tree-svg"
        viewBox={`${viewBoxX} ${viewBoxY} ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        style={{
          transform: `translate(${panX}px, ${panY}px) scale(${scale})`,
          cursor: isDragging ? "grabbing" : "grab",
        }}
      >
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Draw edges */}
        <TreeEdges node={layoutTree} />

        {/* Draw particles */}
        <Particles
          particles={particles}
          methodColors={methodColors}
          currentTime={Date.now()}
        />

        {/* Draw nodes */}
        <TreeNodes
          node={layoutTree}
          methodColors={methodColors}
          reachedTargets={reachedTargets}
          targetFlashDurationMs={targetFlashDurationMs}
        />
      </svg>

      <div className="tree-controls">
        <button onClick={resetView} title="Reset view">
          Reset
        </button>
        <div className="zoom-info">
          {scale.toFixed(1)}x
        </div>
      </div>
    </div>
  );
};

interface TreeEdgesProps {
  node: LayoutNode;
}

const TreeEdges: React.FC<TreeEdgesProps> = ({ node }) => {
  const edges: JSX.Element[] = [];
  const nodeRadius = 20;

  function drawEdges(current: LayoutNode): void {
    if (current.children) {
      current.children.forEach((child) => {
        const x1 = current.x;
        const y1 = current.y + nodeRadius;
        const x2 = child.x;
        const y2 = child.y - nodeRadius;

        edges.push(
          <line
            key={`edge-${current.id}-${child.id}`}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            className="tree-edge"
          />
        );

        drawEdges(child);
      });
    }
  }

  drawEdges(node);
  return <g>{edges}</g>;
};

interface TreeNodesProps {
  node: LayoutNode;
  methodColors: MethodColors;
  reachedTargets: Set<string>;
  targetFlashDurationMs: number;
}

const TreeNodes: React.FC<TreeNodesProps> = ({
  node,
  methodColors,
  reachedTargets,
  targetFlashDurationMs,
}) => {
  const nodeRadius = 20;
  const nodes: JSX.Element[] = [];

  function drawNodes(current: LayoutNode): void {
    const isTarget = !!current.target;
    const hasReachedTarget = reachedTargets.has(current.id);
    const opacity = hasReachedTarget ? 0.3 : 1;

    nodes.push(
      <circle
        key={`node-${current.id}`}
        cx={current.x}
        cy={current.y}
        r={nodeRadius}
        className={`tree-node ${isTarget ? "target" : ""} ${
          hasReachedTarget ? "reached" : ""
        }`}
        style={{
          opacity,
          filter: isTarget ? "drop-shadow(0 0 8px rgba(255,255,255,0.5))" : "",
        }}
      />
    );

    nodes.push(
      <text
        key={`label-${current.id}`}
        x={current.x}
        y={current.y + nodeRadius + 20}
        className="tree-label"
        textAnchor="middle"
        style={{ opacity }}
      >
        {current.label}
      </text>
    );

    if (current.children) {
      current.children.forEach((child) => {
        drawNodes(child);
      });
    }
  }

  drawNodes(node);
  return <g>{nodes}</g>;
};

interface ParticlesProps {
  particles: Particle[];
  methodColors: MethodColors;
  currentTime: number;
}

const Particles: React.FC<ParticlesProps> = ({
  particles,
  methodColors,
  currentTime,
}) => {
  const particleSize = 5;
  const elements: JSX.Element[] = [];

  particles.forEach((particle) => {
    const pos = getParticlePosition(particle, currentTime);
    if (!pos) return;

    const color =
      methodColors[particle.method] || methodColors.DEFAULT;

    elements.push(
      <circle
        key={particle.id}
        cx={pos.x}
        cy={pos.y}
        r={particleSize}
        className="particle"
        fill={color}
        filter="url(#glow)"
        style={{
          opacity: Math.max(0, 1 - (pos.progress - 0.85) * 6.67),
        }}
      />
    );
  });

  return <g>{elements}</g>;
};
