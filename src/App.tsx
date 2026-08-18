import React, { useEffect, useRef, useState, useCallback } from "react";
import { AppConfig, Particle, DebugStats, RequestEvent, TreeNode } from "./types";
import { calculateLayout, LayoutNode, findPathToTarget } from "./tree";
import {
  AnimationEngine,
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

  // Refs for non-state data and for MQTT callback
  const mqttClientRef = useRef<MQTTClient | null>(null);
  const animationEngineRef = useRef<AnimationEngine | null>(null);
  const targetMapRef = useRef<Map<string, TreeNode>>(new Map());
  const statsRef = useRef<DebugStats>(stats);
  const animationFrameRef = useRef<number>();
  const lastRequestTimeRef = useRef<number>(Date.now());
  const requestCountRef = useRef<number>(0);
  const configRef = useRef<AppConfig | null>(null);
  const layoutTreeRef = useRef<LayoutNode | null>(null);
  const particlesRef = useRef<Particle[]>([]);

  // Keep refs in sync with state
  useEffect(() => {
    statsRef.current = stats;
  }, [stats]);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    layoutTreeRef.current = layoutTree;
  }, [layoutTree]);

  useEffect(() => {
    particlesRef.current = particles;
  }, [particles]);

  // Load configuration
  useEffect(() => {
    const loadAppConfig = async () => {
      try {
        const cfg = await loadConfig("/config.yaml");
        setConfig(cfg);
        configRef.current = cfg;

        // Calculate layout
        const layout = calculateLayout(cfg.tree);
        setLayoutTree(layout);
        layoutTreeRef.current = layout;

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
          }
        );
        animationEngineRef.current = engine;
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : String(err);
        setError(`Failed to load configuration: ${message}`);
      }
    };

    loadAppConfig();
  }, []);

  // Set up MQTT connection - runs once config finishes loading
  useEffect(() => {
    if (!config) return;

    const mqtt = new MQTTClient(config.mqtt);
    mqttClientRef.current = mqtt;

    mqtt
      .connect()
      .then(() => {
        setMqttConnected(true);

        // Subscribe with callback that uses refs for latest data
        mqtt.subscribe((event: RequestEvent | null, error?: string) => {
          if (error) {
            console.error(error);
            return;
          }

          if (!event || !configRef.current) return;

          // Handle MQTT event using refs
          const cfg = configRef.current;
          statsRef.current.messagesReceived++;

          const targetNode = targetMapRef.current.get(event.target);
          if (!targetNode) {
            statsRef.current.unknownTargets++;
            console.warn(`Unknown target: ${event.target}`);
            setStats({ ...statsRef.current });
            return;
          }

          const path = findPathToTarget(cfg.tree, event.target);
          if (!path) {
            statsRef.current.unknownTargets++;
            setStats({ ...statsRef.current });
            return;
          }

          // Check particle limit
          if (particlesRef.current.length >= cfg.animation.maxParticles) {
            statsRef.current.eventsDropped++;
            setStats({ ...statsRef.current });
            return;
          }

          // Build particle path coordinates
          const layoutCurrent = layoutTreeRef.current;
          if (!layoutCurrent) return;

          const pathCoords = path.map((node) => {
            const layoutNode = findLayoutNode(layoutCurrent, node.id);
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
        });
      })
      .catch((err: Error) => {
        setError(`Failed to connect to MQTT: ${err.message}`);
        console.error(err);
      });

    return () => {
      mqttClientRef.current?.disconnect();
    };
  }, [config]);

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
      if (!config || !layoutTree || !configRef.current) return;

      const cfg = configRef.current;
      statsRef.current.messagesReceived++;

      const targetNode = targetMapRef.current.get(targetId);
      if (!targetNode) {
        statsRef.current.unknownTargets++;
        setStats({ ...statsRef.current });
        return;
      }

      const path = findPathToTarget(cfg.tree, targetId);
      if (!path) {
        statsRef.current.unknownTargets++;
        setStats({ ...statsRef.current });
        return;
      }

      if (particles.length >= cfg.animation.maxParticles) {
        statsRef.current.eventsDropped++;
        setStats({ ...statsRef.current });
        return;
      }

      const pathCoords = path.map((node) => {
        const layoutNode = findLayoutNode(layoutTree, node.id);
        return layoutNode
          ? { x: layoutNode.x, y: layoutNode.y }
          : { x: 0, y: 0 };
      });

      const particle: Particle = {
        id: createParticleId(),
        path: pathCoords,
        method,
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
    [config, layoutTree, particles.length]
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
