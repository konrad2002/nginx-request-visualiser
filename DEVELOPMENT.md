# MQTT Request Flow Visualizer - Development Guide

## Project Overview

This is a TypeScript + React + Vite web application that visualizes HTTP request flows through a microservices architecture using animated particles traveling along a configurable service tree.

## Architecture

### Core Pipeline

```
MQTT WebSocket Connection
       ↓
RequestEvent (type: "single_request", target, method)
       ↓
Target Lookup (find service in tree)
       ↓
Path Calculation (find route from root to target)
       ↓
Particle Creation (add to animation engine)
       ↓
Animation Loop (requestAnimationFrame)
       ↓
SVG Rendering (React + SVG)
```

### Separation of Concerns

- **MQTT** (`src/mqtt.ts`) - Handles WebSocket connection and event subscription
- **Tree** (`src/tree.ts`) - Layout calculation and path finding algorithms
- **Animation** (`src/animation.ts`) - Particle lifecycle and position calculation
- **Config** (`src/config.ts`) - YAML parsing and configuration validation
- **Components** (`src/components/`) - React UI components for visualization
- **Types** (`src/types.ts`) - TypeScript interfaces and types

## Key Modules

### Tree Layout (`src/tree.ts`)

Calculates node positions using a recursive algorithm:

1. **Layout Calculation** - Positions nodes hierarchically with root at top
2. **Path Finding** - Finds route from root to any target node
3. **Validation** - Ensures tree structure integrity (no duplicate IDs, etc.)

The layout algorithm:
- Places root near center
- Each level down adds `LEVEL_HEIGHT` pixels (120px default)
- Nodes are horizontally spaced based on subtree width
- Supports arbitrary tree depth

### Animation Engine (`src/animation.ts`)

Manages particle lifecycle:

1. **Particle Creation** - Given a path of node coordinates, create particle object
2. **Position Calculation** - For any timestamp, calculate particle position along its path
3. **Lifecycle Management** - Remove particles when animation completes
4. **Bounds Checking** - Enforce maximum particle count

Each particle:
- Follows a pre-calculated path of coordinates
- Moves at a configurable speed per edge (`edgeDurationMs`)
- Stores method type for color lookup

### MQTT Client (`src/mqtt.ts`)

Connects to MQTT broker via WebSockets:

1. **Connection** - Uses `mqtt` npm package with WebSocket transport
2. **Event Parsing** - Converts raw JSON messages to RequestEvent
3. **Subscription** - Maintains callbacks for new events
4. **Reconnection** - Auto-reconnect on disconnect

### Configuration (`src/config.ts`)

Loads and validates YAML configuration:

1. **YAML Parsing** - Uses `yaml` npm package
2. **Validation** - Checks required fields and tree structure
3. **Type Safety** - Provides TypeScript types for all config sections

Configuration sections:
- `mqtt` - Connection details
- `animation` - Timing and particle settings
- `methods` - HTTP method colors
- `tree` - Service hierarchy

## Component Architecture

### App.tsx (Main Component)

Orchestrates the entire application:

- Loads configuration from `/config.yaml`
- Initializes MQTT connection
- Manages animation loop with requestAnimationFrame
- Handles incoming events and creates particles
- Tracks statistics (messages, particles, errors)
- Provides test/simulation mode

Key refs:
- `mqttClientRef` - Active MQTT connection
- `animationEngineRef` - Particle animation state
- `targetMapRef` - Quick lookup of targets by ID
- `statsRef` - Mutable statistics for high-frequency updates

### TreeVisualization.tsx

Renders the SVG visualization:

- Calculates view bounds from tree nodes
- Draws edges between parent-child nodes
- Renders node circles with labels
- Renders animated particles
- Handles zoom/pan interactions
- Uses SVG filters for particle glow effect

### UI Components (UI.tsx)

- **Legend** - Shows HTTP method colors and MQTT connection status
- **DebugPanel** - Displays statistics (collapsible)
- **ControlPanel** - Fullscreen toggle and test request generation

## Data Flow

### Adding a New Request

1. MQTT message arrives: `{"type":"single_request","target":"user-service","method":"GET"}`
2. `MQTTClient` parses JSON and calls callbacks
3. `handleRequestEvent` receives the event
4. Find target node in tree using `targetMapRef`
5. Calculate path from root to target using `findPathToTarget`
6. Extract coordinates from layout nodes
7. Create `Particle` object with path and timing
8. Add to `AnimationEngine` and React state
9. Animation loop updates particle positions
10. SVG re-renders on each frame
11. Particle removed when animation completes

## Performance Considerations

### Particle Rendering

- Particles are drawn as simple circles in SVG (very fast)
- Not implemented as individual DOM elements (would be slow)
- Particle count bounded by `maxParticles` config
- Excess particles dropped silently (acceptable for visualization)

### Animation Loop

- Uses `requestAnimationFrame` for smooth 60fps
- Updates particle positions on every frame
- Reuses particle objects to avoid garbage collection
- Animation state kept outside React state where possible

### SVG Rendering

- Single SVG canvas for entire visualization
- Edges pre-calculated during layout
- Nodes rendered with minimal updates
- Transform attribute used for zoom/pan (GPU-accelerated)

## Testing

### Manual Testing

1. **Start dev server** - `npm run dev`
2. **Test mode** - Use "Send Request" button to generate fake events
3. **Visual verification** - Particles should travel root → target
4. **Performance** - Try max particle rates to verify bounds

### Real MQTT Testing

```bash
# Publish test message
mosquitto_pub \
  -h mqtt.example.com \
  -p 8084 \
  -u visualizer \
  -P 'password' \
  -t server/requests \
  -m '{"type":"single_request","target":"user-service","method":"GET"}'
```

## Configuration Examples

### Minimal Tree

```yaml
tree:
  id: root
  label: "Server"
  children:
    - id: service
      label: "Service"
      target: service
```

### Multi-Level Tree

```yaml
tree:
  id: root
  label: "Gateway"
  children:
    - id: frontend
      label: "Frontend"
      target: frontend
    - id: backend
      label: "Backend"
      children:
        - id: api
          label: "API"
          children:
            - id: users
              label: "Users"
              target: users
            - id: posts
              label: "Posts"
              target: posts
```

## Future Architecture Changes

### For Physical LED Installation

The architecture supports future hardware visualization:

```
MQTT
  ↓
RequestEvent (same format)
  ↓
Target Lookup (same algorithm)
  ↓
Physical Path (map targets to LED positions)
  ↓
LED Animation (PWM/brightness control)
```

No changes needed to event pipeline - only visualization layer.

### Potential Improvements

- Hot configuration reload
- Multiple animation styles
- Event recording/playback
- WebSocket fallback
- Performance metrics API
- Integration with monitoring systems

## Debugging

### Check MQTT Connection

```javascript
// In browser console
// Should show in debug panel: "● MQTT Connected"
```

### Verify Tree Structure

```javascript
// Errors will be shown in error container
// Check browser console for validation messages
```

### Monitor Particle Creation

```javascript
// Debug panel shows:
// - Messages Received
// - Events Visualized
// - Unknown Targets (indicates config issues)
```

### Performance Issues

- Check browser DevTools Performance tab
- Look for excessive re-renders
- Verify particle count isn't exceeding maxParticles
- Check WebSocket message rate

## Key Files for Common Tasks

| Task | File |
|------|------|
| Change tree structure | `public/config.yaml` |
| Add new HTTP methods | `public/config.yaml` (methods section) |
| Adjust animation speed | `public/config.yaml` (animation.edgeDurationMs) |
| Change colors | `public/config.yaml` (methods section) |
| Modify visualization | `src/components/TreeVisualization.tsx` |
| Add new UI elements | `src/components/UI.tsx` |
| Change particle behavior | `src/animation.ts` |
| Add new event types | `src/mqtt.ts` (handleMessage) + `src/App.tsx` (handleRequestEvent) |

## Building & Deployment

### Development

```bash
npm install
npm run dev
# App runs on http://localhost:5173
```

### Production Build

```bash
npm run build
npm run preview
# Optimized build in dist/
```

### Configuration for Deployment

1. Update `public/config.yaml` with production MQTT broker
2. Ensure MQTT broker is accessible from deployment location
3. MQTT user should have subscribe-only permissions
4. Deploy static files from `dist/` directory
