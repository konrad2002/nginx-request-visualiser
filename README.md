# MQTT Request Flow Tree Visualizer

A beautiful, real-time visualization of HTTP request flows through your system architecture. Animated particles travel through a configurable tree structure, representing requests as they flow from a root server through various microservices.

## Features

- 🎨 **Beautiful SVG visualization** - Dark theme with futuristic aesthetics
- 🔄 **Real-time MQTT integration** - Connect directly to MQTT brokers via WebSockets
- 🎯 **Arbitrary tree depth** - Define any hierarchical service structure
- ✨ **Smooth animations** - Particles flow along edges with configurable timing
- 📊 **HTTP method colors** - GET, POST, PUT, DELETE, etc. have distinct colors
- 🎮 **Interactive controls** - Zoom, pan, and fullscreen modes
- 🧪 **Test mode** - Generate fake requests without a real MQTT broker
- 🐛 **Debug panel** - Monitor message counts, active particles, and errors
- ⚙️ **YAML configuration** - Easy to modify tree structure and settings

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- An MQTT broker with WebSocket support (or the simulator mode)

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd nginx-request-visualiser

# Install dependencies
npm install

# Copy and customize configuration
cp public/config.yaml public/config.yaml.backup
# Edit public/config.yaml with your MQTT broker details and service tree
```

### Running Locally

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

### Building for Production

```bash
npm run build
npm run preview
```

## Configuration

Edit `public/config.yaml` to configure:

### MQTT Settings

```yaml
mqtt:
  url: "wss://your-mqtt-broker.com:8084/mqtt"
  username: "visualizer"
  password: "your-password"
  topic: "server/requests"
  clientId: "request-tree-visualizer"
```

**Important**: The MQTT broker must support WebSockets (typically on port 8084 or 9001). Standard MQTT on port 1883/8883 is not accessible from browsers.

### Animation Timing

```yaml
animation:
  edgeDurationMs: 120      # Time for particle to traverse one edge
  targetFlashDurationMs: 180  # Duration of target flash effect
  particleSize: 5          # Radius of particles in pixels
  particleGlow: true       # Enable glow effect
  maxParticles: 500        # Maximum simultaneous particles (older ones are dropped)
```

### HTTP Method Colors

Customize colors for different HTTP methods:

```yaml
methods:
  GET: "#4CAF50"
  POST: "#2196F3"
  PUT: "#FF9800"
  PATCH: "#9C27B0"
  DELETE: "#F44336"
  OPTIONS: "#607D8B"
  HEAD: "#795548"
  DEFAULT: "#FFFFFF"
```

### Service Tree Structure

Define your service architecture as a tree:

```yaml
tree:
  id: server
  label: "Server"
  
  children:
    - id: backend
      label: "Backend"
      
      children:
        - id: api
          label: "API Service"
          
          children:
            - id: user-service
              label: "User Service"
              target: user-service  # This is an MQTT target
```

**Rules**:
- Every node must have a unique `id`
- Nodes with a `target` property are MQTT destinations
- Target nodes should not have children
- Target names must match MQTT message targets

## MQTT Event Format

The application listens for events in this format:

```json
{
  "type": "single_request",
  "target": "user-service",
  "method": "GET"
}
```

Example with mosquitto_pub:

```bash
mosquitto_pub \
  -h mqtt.example.com \
  -p 8084 \
  -u visualizer \
  -P 'password' \
  -t server/requests \
  -m '{"type":"single_request","target":"user-service","method":"POST"}'
```

## Usage

### Normal Mode

When connected to an MQTT broker:

1. Configure your MQTT broker in `public/config.yaml`
2. Run `npm run dev`
3. Real requests will appear as animated particles flowing through the tree

### Test/Simulation Mode

Without a real MQTT broker:

1. The app will show a "Disconnected" status
2. Use the bottom-right panel to generate test requests
3. Select a target and HTTP method
4. Click "Send Request"

### Fullscreen Mode

- Click the fullscreen button (◭) in the bottom-right
- Hides debug panel and controls
- Perfect for wall displays or projectors
- Press again to exit

### Interactive Controls

- **Mouse wheel** - Zoom in/out
- **Mouse drag** - Pan around the tree
- **"Reset" button** - Return to initial view
- **"Fullscreen" button** - Toggle fullscreen mode
- **Debug panel** - Click to expand/collapse statistics

## Architecture

The application is built with clean separation of concerns:

```
MQTT
  ↓
RequestEvent (normalized internal format)
  ↓
Target Lookup (find service in tree)
  ↓
Path Calculation (from root to target)
  ↓
Particle Animation (move along path)
  ↓
SVG Rendering (React + SVG)
```

This design makes it easy to:
- Replace MQTT with HTTP polling or WebSockets
- Change the visualization from browser to LED strips
- Add new event types
- Customize animation behavior

### Project Structure

```
src/
├── types.ts              # TypeScript interfaces
├── tree.ts              # Tree layout & validation
├── animation.ts         # Particle animation engine
├── config.ts            # Configuration loading
├── mqtt.ts              # MQTT client
├── App.tsx              # Main application
├── components/
│   ├── TreeVisualization.tsx  # SVG rendering
│   └── UI.tsx                 # Legend, debug panel, controls
├── main.tsx             # Entry point
└── styles.css           # Styling
```

## Performance

The visualization handles high traffic rates efficiently:

- Particles are tracked in memory, not as individual DOM elements
- SVG rendering uses a single canvas with efficient updates
- Particle count is bounded by `maxParticles` configuration
- Excess particles are silently dropped (acceptable for visualization)
- requestAnimationFrame ensures smooth 60fps animation

With default settings, the app can smoothly visualize 200+ simultaneous requests.

## Troubleshooting

### Cannot connect to MQTT

**Error**: "Failed to connect to MQTT"

**Solutions**:
- Verify the broker URL supports WebSockets (typically `:8084` or `:9001`)
- Check username/password credentials
- Ensure your MQTT user has `SUBSCRIBE` permission on the topic
- Test with `mosquitto_sub`: `mosquitto_sub -h broker.com -p 8084 -u user -P pass -t 'server/requests'`

### No events appearing

**Check**:
1. Is the MQTT connection status showing "Connected"?
2. Are events being sent to the correct topic?
3. Use test mode to verify animation works
4. Check browser console for errors

### Events not visualizing

**Possible issues**:
- Target name doesn't match a configured target in the tree
- Configuration has duplicate IDs
- Tree validation failed (check browser console)

### Slow performance

**Optimizations**:
- Reduce `maxParticles` in config
- Increase `edgeDurationMs` (slower particles = fewer drawn frames)
- Disable `particleGlow` effect
- Check browser's dev tools for performance issues

## Example Configurations

### Simple Linear Path

```yaml
tree:
  id: root
  label: "Gateway"
  
  children:
    - id: service
      label: "Service"
      target: service
```

### Complex Microservices

See `config.example.yaml` for a realistic multi-level tree with multiple backend services.

## MQTT Broker Setup

### Using Mosquitto with WebSockets

```bash
# mosquitto.conf
listener 8084
protocol websockets
```

Then run:
```bash
mosquitto -c mosquitto.conf
```

### Create a read-only user

```bash
# Create password file
mosquitto_passwd -c /etc/mosquitto/passwd visualizer

# mosquitto.conf
password_file /etc/mosquitto/passwd

# Set ACLs (acl_file)
user visualizer
topic read server/requests
```

## Security Considerations

- MQTT credentials in `public/config.yaml` are visible to browsers
- Use a dedicated MQTT user with **subscribe-only permissions**
- Do not publish credentials to public repositories
- Add `public/config.yaml` to `.gitignore`

## Future Enhancements

Planned features:
- Hot configuration reload
- WebSocket fallback for non-MQTT sources
- Custom node icons
- Traffic statistics and heatmaps
- Recording and playback of request flows
- Integration with physical LED displays

## License

See LICENSE file for details.

## Contributing

Contributions are welcome! The codebase emphasizes:
- Clean separation of concerns
- TypeScript for type safety
- Functional React components
- Performance-conscious animations
- Minimal dependencies
This is a tool for testing visualisations of requests towards a nginx server
