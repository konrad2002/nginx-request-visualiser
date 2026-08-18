import { Particle as ParticleType } from "./types";
import { LayoutNode } from "./tree";

export type Particle = ParticleType;

export interface ParticlePosition {
  x: number;
  y: number;
  progress: number;
}

/**
 * Build particle path as array of node coordinates
 */
export function buildParticlePath(
  nodes: LayoutNode[]
): Array<{ x: number; y: number }> {
  return nodes.map((node) => ({
    x: node.x,
    y: node.y,
  }));
}

/**
 * Calculate particle position at a given time
 */
export function getParticlePosition(
  particle: Particle,
  currentTime: number
): ParticlePosition | null {
  const elapsed = currentTime - particle.startTime;

  if (elapsed < 0 || elapsed > particle.totalDuration) {
    return null;
  }

  const path = particle.path;
  if (path.length < 2) {
    return null;
  }

  // Calculate which edge segment we're on
  const segmentDuration = particle.edgeDurationMs;
  const segmentIndex = Math.floor(elapsed / segmentDuration);
  const segmentProgress = (elapsed % segmentDuration) / segmentDuration;

  if (segmentIndex >= path.length - 1) {
    // Reached end
    return {
      x: path[path.length - 1].x,
      y: path[path.length - 1].y,
      progress: 1.0,
    };
  }

  const start = path[segmentIndex];
  const end = path[segmentIndex + 1];

  return {
    x: start.x + (end.x - start.x) * segmentProgress,
    y: start.y + (end.y - start.y) * segmentProgress,
    progress: (elapsed / particle.totalDuration),
  };
}

/**
 * Create particle ID
 */
export function createParticleId(): string {
  return `particle-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Animation engine that tracks particles and removes completed ones
 */
export class AnimationEngine {
  private particles: Map<string, Particle> = new Map();
  private onParticleRemoved: (id: string) => void = () => {};
  private onParticleTargetReached: (id: string) => void = () => {};

  constructor(
    onRemoved?: (id: string) => void,
    onTargetReached?: (id: string) => void
  ) {
    if (onRemoved) this.onParticleRemoved = onRemoved;
    if (onTargetReached) this.onParticleTargetReached = onTargetReached;
  }

  addParticle(particle: Particle): void {
    this.particles.set(particle.id, particle);
  }

  getParticles(): Particle[] {
    return Array.from(this.particles.values());
  }

  update(currentTime: number): void {
    const toRemove: string[] = [];

    for (const [id, particle] of this.particles.entries()) {
      const pos = getParticlePosition(particle, currentTime);

      if (pos === null) {
        // Particle has completed its journey
        toRemove.push(id);
        this.onParticleTargetReached(id);
      }
    }

    toRemove.forEach((id) => {
      this.particles.delete(id);
      this.onParticleRemoved(id);
    });
  }

  getActiveCount(): number {
    return this.particles.size;
  }

  clear(): void {
    this.particles.clear();
  }
}
