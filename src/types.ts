// Configuration types
export interface MQTTConfig {
  url: string;
  username: string;
  password: string;
  topic: string;
  clientId: string;
}

export interface AnimationConfig {
  edgeDurationMs: number;
  targetFlashDurationMs: number;
  particleSize: number;
  particleGlow: boolean;
  maxParticles: number;
}

export interface MethodColors {
  [method: string]: string;
  DEFAULT: string;
}

export interface AppConfig {
  mqtt: MQTTConfig;
  animation: AnimationConfig;
  methods: MethodColors;
  tree: TreeNode;
}

// Tree types
export interface TreeNode {
  id: string;
  label: string;
  target?: string;
  children?: TreeNode[];
}

export interface TreeNodeWithPath extends TreeNode {
  path: TreeNode[];
}

// MQTT event types
export interface RequestEvent {
  type: "single_request";
  target: string;
  method: string;
}

// Animation types
export interface Particle {
  id: string;
  path: Array<{ x: number; y: number }>;
  method: string;
  startTime: number;
  edgeDurationMs: number;
  totalDuration: number;
}

// Debug stats
export interface DebugStats {
  messagesReceived: number;
  eventsVisualized: number;
  eventsDropped: number;
  unknownTargets: number;
  invalidMessages: number;
  activeParticles: number;
  requestsPerSec: number;
}
