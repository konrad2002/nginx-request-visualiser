import React, { useEffect, useRef, useState, useCallback } from "react";
import { AppConfig, Particle, DebugStats, RequestEvent, TreeNode } from "./types";
import { calculateLayout, LayoutNode, findPathToTarget } from "./tree";
import {
  AnimationEngine,
  buildParticlePath,
  createParticleId,
} from "./animation";
import { MQTTClient } from "./mqtt";
import { loadConfig } from "./config";
import { TreeVisualization } from "./components/TreeVisualization";
import { Legend, DebugPanel, ControlPanel } from "./components/UI";
import "./styles.css";

export const App: React.FC = () => {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [layoutTree, setLayoutTree] = useState<LayoutNode | null>(null);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [mqttConnected, setMqttConnected] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [debugExpanded, setDebugExpanded] = useState(true);
  const [stats, setStats] = useState<DebugStats>({
    messagesReceived: 0,
    eventsVisualized: 0,
    eventsDropped: 0,
    unknownTargets: 0,
    invalidMessages: 0,
    activeParticles: 0,
    requestsPerSec: 0,
  });
  const [reachedTargets, setReachedTargets] = useState<Set<string>>(new Set());

  // Refs for non-state data
  const mqttClientRef = useRef<MQTTClient | null>(null);
  const animationEngineRef = useRef<AnimationEngine | null>(null);
  const targetMapRef = useRef<Map<string, TreeNode>>(new Map());
  const statsRef = useRef<DebugStats>(stats);
  const animationFrameRef = useRef<number>();
  const lastRequestTimeRef = useRef<number>(Date.now());
  const requestCountRef = useRef<number>(0);

  // Load configuration
  useEffect(() => {
    const loadAppConfig = async () => {
      try {
        const cfg = await loadConfig("/config.yaml");
        setConfig(cfg);

        // Calculate layout
        const layout = calculateLayout(cfg.tree);
        setLayoutTree(layout);

        // Build target map
        const targetMap = new Map<string, TreeNode>();
        function buildMap(node: TreeNode): void {
          if (node.target) {
            targetMap.set(node.target, node);
          }
          if (node.children) {
            node.children.forEach(buildMap);
          }
        }
        buildMap(cfg.tree);
        targetMapRef.current = targetMap;

        // Initialize animation engine
        const engine = new AnimationEngine(
          (id) => {
            setParticles((prev) =>
              prev.filter((p) => p.id !== id)
            );
          },
          (id) => {
            // Find particle's target and mark for flash
            setParticles((prev) => {
              const particle = prev.find((p) => p.id === id);
              if (particle) {
                const targetPath = findPathToTarget(
                  cfg.tree,
                  particle.method // This is wrong, should track target
                );
              }
              return prev;
            });
          }
        );
        animationEngineRef.current = engine;

        // Start MQTT connection
        const mqtt = new MQTTClient(cfg.mqtt);
        mqttClientRef.current = mqtt;

        mqtt
          .connect()
          .then(() => {
            setMqttConnected(true);

            mqtt.subscribe((event: RequestEvent | null, error?: string) => {
              if (error) {
                console.error(error);
                return;
              }

              if (event) {
                handleRequestEvent(event, cfg);
              }
            });
          })
          .catch((err: Error) => {
            setError(`Failed to connect to MQTT: ${err.message}`);
            console.error(err);
          });
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : String(err);
        setError(`Failed to load configuration: ${message}`);
      }
    };

    loadAppConfig();

    return () => {
      mqttClientRef.current?.disconnect();
    };
  }, []);

  // Update stats ref when it changes
  useEffect(() => {
    statsRef.current = stats;
  }, [stats]);

  const handleRequestEvent = useCallback(
    (event: RequestEvent, cfg: AppConfig) => {
      statsRef.current.messagesReceived++;

      const targetNode = targetMapRef.current.get(event.target);

      if (!targetNode) {
        statsRef.current.unknownTargets++;
        console.warn(`Unknown target: ${event.target}`);
        return;
      }

      // Find path from root to target
      const path = findPathToTarget(cfg.tree, event.target);
      if (!path) {
        statsRef.current.unknownTargets++;
        return;
      }

      // Check particle limit
      if (
        particles.length >= cfg.animation.maxParticles
      ) {
        statsRef.current.eventsDropped++;
        return;
      }

      // Build particle path coordinates
      const pathCoords = path.map((node) => {
        const layoutNode = findLayoutNode(layoutTree, node.id);
        return layoutNode
          ? { x: layoutNode.x, y: layoutNode.y }
          : { x: 0, y: 0 };
      });

      // Create particle
      const particle: Particle = {
        id: createParticleId(),
        path: pathCoords,
        method: event.method,
        startTime: Date.now(),
        edgeDurationMs: cfg.animation.edgeDurationMs,
        totalDuration:
          (path.length - 1) * cfg.animation.edgeDurationMs +
          cfg.animation.targetFlashDurationMs,
      };

      setParticles((prev) => [...prev, particle]);
      animationEngineRef.current?.addParticle(particle);

      statsRef.current.eventsVisualized++;
      requestCountRef.current++;
      
      const now = Date.now();
      if (now - lastRequestTimeRef.current >= 1000) {
        statsRef.current.requestsPerSec = requestCountRef.current;
        requestCountRef.current = 0;
        lastRequestTimeRef.current = now;
      }

      setStats({ ...statsRef.current });
    },
    [particles.length, layoutTree]
  );

  // Animation loop
  useEffect(() => {
    const animate = () => {
      const currentTime = Date.now();

      if (animationEngineRef.current) {
        animationEngineRef.current.update(currentTime);
        const activeParticles = animationEngineRef.current.getParticles();
        setParticles(activeParticles);

        statsRef.current.activeParticles = activeParticles.length;
        setStats({ ...statsRef.current });
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Generate test request
  const handleGenerateTestRequest = useCallback(
    (targetId: string, method: string) => {
      if (!config) return;

      const event: RequestEvent = {
        type: "single_request",
        target: targetId,
        method,
      };

      handleRequestEvent(event, config);
    },
    [config, handleRequestEvent]
  );

  if (error) {
    return (
      <div className="error-container">
        <div className="error-message">
          <h2>Configuration Error</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!config || !layoutTree) {
    return (
      <div className="loading-container">
        <p>Loading configuration...</p>
      </div>
    );
  }

  // Extract available targets
  const availableTargets: Array<{ id: string; label: string }> = [];
  function collectTargets(node: TreeNode): void {
    if (node.target) {
      availableTargets.push({
        id: node.target,
        label: node.label,
      });
    }
    if (node.children) {
      node.children.forEach(collectTargets);
    }
  }
  collectTargets(config.tree);

  const appClassName = `app ${isFullscreen ? "fullscreen" : ""}`;

  return (
    <div className={appClassName}>
      <div className="main-container">
        <TreeVisualization
          layoutTree={layoutTree}
          particles={particles}
          methodColors={config.methods}
          targetFlashDurationMs={config.animation.targetFlashDurationMs}
          reachedTargets={reachedTargets}
        />
      </div>

      {!isFullscreen && (
        <>
          <Legend
            methodColors={config.methods}
            mqttConnected={mqttConnected}
            topic={config.mqtt.topic}
          />

          <DebugPanel
            stats={stats}
            expanded={debugExpanded}
            onToggle={() => setDebugExpanded(!debugExpanded)}
          />
        </>
      )}

      <ControlPanel
        isFullscreen={isFullscreen}
        onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
        onGenerateTestRequest={handleGenerateTestRequest}
        availableTargets={availableTargets}
      />
    </div>
  );
};

/**
 * Helper to find a layout node by tree node ID
 */
function findLayoutNode(
  layoutTree: LayoutNode | null,
  nodeId: string
): LayoutNode | null {
  if (!layoutTree) return null;

  if (layoutTree.id === nodeId) {
    return layoutTree;
  }

  if (layoutTree.children) {
    for (const child of layoutTree.children) {
      const found = findLayoutNode(child, nodeId);
      if (found) return found;
    }
  }

  return null;
}
