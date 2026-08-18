import { parse } from "yaml";
import { AppConfig, AnimationConfig, MethodColors, TreeNode } from "./types";
import { validateTree } from "./tree";

/**
 * Load and parse configuration from YAML
 */
export async function loadConfig(configPath: string): Promise<AppConfig> {
  try {
    const response = await fetch(configPath);
    const text = await response.text();
    const config = parse(text) as AppConfig;

    // Validate
    const errors = validateConfig(config);
    if (errors.length > 0) {
      throw new Error(`Configuration validation failed:\n${errors.join("\n")}`);
    }

    return config;
  } catch (error) {
    console.error("Failed to load configuration:", error);
    throw error;
  }
}

/**
 * Validate configuration structure
 */
function validateConfig(config: AppConfig): string[] {
  const errors: string[] = [];

  // Check MQTT config
  if (!config.mqtt) {
    errors.push("Missing mqtt configuration");
  } else {
    if (!config.mqtt.url) errors.push("Missing mqtt.url");
    if (!config.mqtt.username) errors.push("Missing mqtt.username");
    if (!config.mqtt.password) errors.push("Missing mqtt.password");
    if (!config.mqtt.topic) errors.push("Missing mqtt.topic");
    if (!config.mqtt.clientId) errors.push("Missing mqtt.clientId");
  }

  // Check animation config
  if (!config.animation) {
    errors.push("Missing animation configuration");
  } else {
    if (config.animation.edgeDurationMs === undefined)
      errors.push("Missing animation.edgeDurationMs");
    if (config.animation.maxParticles === undefined)
      errors.push("Missing animation.maxParticles");
  }

  // Check methods config
  if (!config.methods) {
    errors.push("Missing methods configuration");
  } else {
    if (!config.methods.DEFAULT) errors.push("Missing methods.DEFAULT");
  }

  // Check tree
  if (!config.tree) {
    errors.push("Missing tree configuration");
  } else {
    const treeErrors = validateTree(config.tree);
    errors.push(...treeErrors);
  }

  return errors;
}

/**
 * Get color for HTTP method
 */
export function getMethodColor(
  method: string,
  methods: MethodColors
): string {
  return methods[method] || methods.DEFAULT;
}

/**
 * Default configuration with example structure
 */
export const DEFAULT_CONFIG: AppConfig = {
  mqtt: {
    url: "wss://mqtt.example.com:8084/mqtt",
    username: "visualizer",
    password: "change-me",
    topic: "server/requests",
    clientId: "request-tree-visualizer",
  },
  animation: {
    edgeDurationMs: 120,
    targetFlashDurationMs: 180,
    particleSize: 5,
    particleGlow: true,
    maxParticles: 500,
  },
  methods: {
    GET: "#4CAF50",
    POST: "#2196F3",
    PUT: "#FF9800",
    PATCH: "#9C27B0",
    DELETE: "#F44336",
    OPTIONS: "#607D8B",
    HEAD: "#795548",
    DEFAULT: "#FFFFFF",
  },
  tree: {
    id: "server",
    label: "Server",
    children: [
      {
        id: "backend",
        label: "Backend",
        children: [
          {
            id: "api",
            label: "API",
            children: [
              {
                id: "user-service",
                label: "User Service",
                target: "user-service",
              },
            ],
          },
        ],
      },
    ],
  },
};
