import React from "react";
import { MethodColors, DebugStats } from "../types";

interface LegendProps {
  methodColors: MethodColors;
  mqttConnected: boolean;
  topic: string;
}

export const Legend: React.FC<LegendProps> = ({
  methodColors,
  mqttConnected,
  topic,
}) => {
  const methods = Object.entries(methodColors)
    .filter(([key]) => key !== "DEFAULT")
    .sort();

  return (
    <div className="legend">
      <div className="legend-title">HTTP Methods</div>
      <div className="legend-items">
        {methods.map(([method, color]) => (
          <div key={method} className="legend-item">
            <div
              className="legend-color"
              style={{ backgroundColor: color }}
            />
            <span className="legend-label">{method}</span>
          </div>
        ))}
      </div>

      <div className="legend-status">
        <div className="status-item">
          <div
            className="status-dot"
            style={{
              backgroundColor: mqttConnected ? "#4CAF50" : "#FF6B6B",
            }}
          />
          <span>{mqttConnected ? "Connected" : "Disconnected"}</span>
        </div>
        <div className="status-topic">{topic}</div>
      </div>
    </div>
  );
};

interface DebugPanelProps {
  stats: DebugStats;
  expanded: boolean;
  onToggle: () => void;
}

export const DebugPanel: React.FC<DebugPanelProps> = ({
  stats,
  expanded,
  onToggle,
}) => {
  return (
    <div className={`debug-panel ${expanded ? "expanded" : "collapsed"}`}>
      <div className="debug-header" onClick={onToggle}>
        <span className="toggle-icon">{expanded ? "▼" : "▶"}</span>
        <span className="debug-title">Debug Stats</span>
      </div>

      {expanded && (
        <div className="debug-content">
          <div className="stat-row">
            <span className="stat-label">Messages Received:</span>
            <span className="stat-value">{stats.messagesReceived}</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">Events Visualized:</span>
            <span className="stat-value">{stats.eventsVisualized}</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">Events Dropped:</span>
            <span className="stat-value">{stats.eventsDropped}</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">Unknown Targets:</span>
            <span className="stat-value">{stats.unknownTargets}</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">Invalid Messages:</span>
            <span className="stat-value">{stats.invalidMessages}</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">Active Particles:</span>
            <span className="stat-value">{stats.activeParticles}</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">Requests/sec:</span>
            <span className="stat-value">{stats.requestsPerSec}</span>
          </div>
        </div>
      )}
    </div>
  );
};

interface ControlPanelProps {
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onGenerateTestRequest?: (target: string, method: string) => void;
  availableTargets: Array<{ id: string; label: string }>;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  isFullscreen,
  onToggleFullscreen,
  onGenerateTestRequest,
  availableTargets,
}) => {
  const [selectedTarget, setSelectedTarget] = React.useState(
    availableTargets[0]?.id || ""
  );
  const [selectedMethod, setSelectedMethod] = React.useState("GET");

  const methods = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"];

  return (
    <div className="control-panel">
      <button
        className="btn-fullscreen"
        onClick={onToggleFullscreen}
        title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
      >
        {isFullscreen ? "⛶" : "◭"}
      </button>

      {!isFullscreen && onGenerateTestRequest && (
        <div className="test-controls">
          <div className="test-group">
            <label>Target</label>
            <select
              value={selectedTarget}
              onChange={(e) => setSelectedTarget(e.target.value)}
            >
              {availableTargets.map((target) => (
                <option key={target.id} value={target.id}>
                  {target.label}
                </option>
              ))}
            </select>
          </div>

          <div className="test-group">
            <label>Method</label>
            <select
              value={selectedMethod}
              onChange={(e) => setSelectedMethod(e.target.value)}
            >
              {methods.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
          </div>

          <button
            className="btn-test"
            onClick={() =>
              onGenerateTestRequest(selectedTarget, selectedMethod)
            }
          >
            Send Request
          </button>
        </div>
      )}
    </div>
  );
};
