# MQTT Request Flow Tree Visualizer — Implementation Specification

## 1. Goal

Build a small locally running visualization application that connects to an MQTT broker and visualizes incoming HTTP request events as animated particles traveling through a configurable tree.

The purpose of the application is to prototype the physical visualization concept before building the eventual LED/ESP32 version.

The application should make it feel as if requests are physically flowing through a network:

```text
                         SERVER
                            │
             ┌──────────────┼──────────────┐
             │              │              │
          frontend       swimresults      other
             │              │              │
             │        ┌─────┴─────┐        │
             │        │           │        │
          website   athletes     races    ...
                       │
                       ▼
              swimresults-athlete-service-productive
````

When an MQTT event arrives, a bright animated particle should appear at the root and travel rapidly along the tree edges until it reaches the configured target leaf.

The visualization should be visually attractive and responsive, but the implementation should remain small and easy to modify.

---

# 2. Core concept

The application receives events like:

```json
{
  "type": "single_request",
  "target": "swimresults-athlete-service-productive",
  "method": "GET"
}
```

The application knows nothing about Nginx routing.

Instead, it has a local visualization configuration describing the tree.

For example:

```yaml
tree:
  id: server
  label: "Server"

  children:

    - id: swimresults
      label: "Swimresults"

      children:
        - id: athletes
          label: "Athletes"

          children:
            - id: swimresults-athlete-service-productive
              label: "Athlete Service"
              target: swimresults-athlete-service-productive

        - id: races
          label: "Races"

          children:
            - id: swimresults-race-service-productive
              label: "Race Service"
              target: swimresults-race-service-productive
```

The `target` property identifies an MQTT target.

When:

```json
{
  "type": "single_request",
  "target": "swimresults-athlete-service-productive",
  "method": "GET"
}
```

arrives, the application finds that leaf and animates:

```text
Server
  ↓
Swimresults
  ↓
Athletes
  ↓
Athlete Service
```

---

# 3. Technology recommendation

Build the UI as a local web application.

Recommended stack:

* TypeScript
* React
* Vite
* SVG for the tree and animations
* MQTT over WebSockets for browser MQTT connectivity

Alternatively, if browser MQTT/WebSocket support is inconvenient, create a tiny local backend that connects to MQTT and forwards events to the browser over WebSocket.

Prefer the browser-only approach if the MQTT broker supports WebSockets.

The application should run locally with:

```bash
npm install
npm run dev
```

and be accessible through:

```text
http://localhost:5173
```

---

# 4. Important MQTT consideration

A normal browser cannot connect directly to an MQTT broker using the raw TCP MQTT protocol.

Therefore the application must support:

## Preferred

MQTT over WebSockets.

Configuration:

```yaml
mqtt:
  url: "wss://mqtt.example.com:8084/mqtt"
  username: "visualizer"
  password: "..."
  topic: "server/requests"
```

The exact WebSocket port/path must be configurable.

Do NOT assume that MQTT TCP port `8883` can be used directly by the browser.

If the existing broker only exposes MQTT/TLS on `8883`, provide a small local backend option:

```text
MQTT broker
    ↓
local Go/Node MQTT bridge
    ↓
WebSocket
    ↓
browser visualization
```

The preferred implementation is nevertheless a direct browser MQTT connection when the broker supports MQTT over WebSockets.

---

# 5. MQTT configuration

The application should have a configuration file.

Example:

```yaml
mqtt:
  url: "wss://mqtt.example.com:8084/mqtt"
  username: "visualizer"
  password: "change-me"
  topic: "server/requests"
  clientId: "request-tree-visualizer"

tree:
  id: server
  label: "Server"

  children:
    - id: swimresults
      label: "Swimresults"

      children:
        - id: athletes
          label: "Athletes"

          children:
            - id: swimresults-athlete-service-productive
              label: "Athlete Service"
              target: swimresults-athlete-service-productive

        - id: races
          label: "Races"

          children:
            - id: swimresults-race-service-productive
              label: "Race Service"
              target: swimresults-race-service-productive

    - id: frontend
      label: "Frontend"

      children:
        - id: frontend-productive
          label: "Frontend"
          target: frontend-productive
```

---

# 6. Tree configuration

The tree is the most important configuration concept.

Each node should have:

```yaml
id: unique-id
label: Display Name
children: []
target: optional-target-name
```

Example:

```yaml
- id: backend
  label: "Backend"
  children:
    - id: api
      label: "API"
      children:
        - id: user-service
          label: "User Service"
          target: user-service
```

Only nodes with a `target` property are MQTT destinations.

These are called **leaf targets**.

A target should normally be a leaf.

The application should validate that:

* every `id` is unique
* every `target` is unique
* target nodes exist in the tree
* a target node does not have children

---

# 7. Arbitrary tree depth

Do not hard-code a particular tree structure.

The user should be able to create:

```text
Server
 ├── A
 │   ├── B
 │   │   └── C
 │   │       └── Target
 │   └── D
 │       └── Target
 └── E
     ├── F
     └── G
         └── Target
```

or:

```text
Server
 ├── Target A
 ├── Target B
 └── Target C
```

The visualization should work for arbitrary depth.

---

# 8. Tree layout

Use a visually pleasing hierarchical layout.

The root should normally appear near the top center.

Children should branch downward.

For example:

```text
                           ● SERVER
                          /        \
                         /          \
                       ●              ●
                    Frontend       Backend
                                  /       \
                                 /         \
                               ●             ●
                             API          Workers
                           /     \
                          /       \
                        ●           ●
                     Users        Races
```

Edges should be drawn behind the nodes.

Use SVG rather than HTML borders because SVG makes animation along arbitrary edges considerably easier.

---

# 9. Node appearance

Nodes should be visually clear but relatively subtle.

Suggested design:

* circular node
* label underneath or beside it
* inactive nodes dimmed
* active nodes brighten when traffic reaches them
* target nodes visually distinguishable
* root node slightly larger

Example conceptual appearance:

```text
               ◉
             Server

              │
         ┌────┴────┐
         │         │

        ◉           ◉
     Frontend     Backend
```

Do not overuse colors for the static tree.

Most color should come from the animated request particles.

---

# 10. Request animation

This is the central feature.

When an event arrives:

```json
{
  "type": "single_request",
  "target": "swimresults-athlete-service-productive",
  "method": "GET"
}
```

the application should:

1. Find the target.
2. Find its path back to the root.
3. Reverse that path.
4. Create an animation traveling from root → target.
5. Remove the particle after it reaches the target.

Example:

```text
Root
 ↓
Swimresults
 ↓
Athletes
 ↓
Athlete Service
```

The animation should look like a request rapidly flowing through the system.

---

# 11. Particle behavior

Each request should create one animated particle.

The particle should:

* have the HTTP-method color
* move quickly
* glow slightly
* travel exactly along the edges
* move smoothly
* disappear shortly after reaching the target

For example:

```text
          ●
          │
          │
          ✦   ← moving request
          │
          │
          ●
         / \
        /   \
       ●     ●
```

The particle should not teleport from node to node.

It should visibly travel along the connecting edge.

---

# 12. Animation timing

The visualization should feel fast.

Suggested default:

```yaml
animation:
  edgeDurationMs: 120
  nodePauseMs: 20
```

For a four-node path:

```text
Server
  ↓ 120ms
Group
  ↓ 120ms
Subsystem
  ↓ 120ms
Target
```

Total approximately:

```text
360–500ms
```

The animation should be configurable.

Possible settings:

```yaml
animation:
  edgeDurationMs: 120
  targetFlashDurationMs: 180
  particleSize: 5
  particleGlow: true
```

---

# 13. Continuous traffic

The application must support many simultaneous requests.

For example, if 50 MQTT events arrive within a second:

```text
Server
 │
 ✦
 │     ✦
 │          ✦
 ├───────✦───────
 │
 │ ✦
 │        ✦
```

all particles should be allowed to animate independently.

Do NOT wait for one animation to finish before processing the next request.

Each event should create an independent animation object.

---

# 14. High request rates

Real traffic may occasionally be hundreds of requests per second.

Rendering hundreds or thousands of individual DOM/SVG animation objects can become expensive.

Implement a configurable maximum number of simultaneously visible particles.

Example:

```yaml
animation:
  maxParticles: 500
```

If the limit is reached, the application should drop visual particles rather than slowing down or freezing.

Important:

**Dropping visualization events is acceptable.**

This is a visualization, not a reliable event-processing system.

The MQTT subscriber should continue processing events even if the UI is overloaded.

---

# 15. Traffic burst behavior

At high traffic rates, the UI should still look visually interesting.

Possible behavior:

```text
100 requests/sec
       ↓
visualization
       ↓
up to 500 particles
       ↓
additional events are dropped visually
```

Do not try to queue unlimited events.

The application should remain responsive.

---

# 16. HTTP method colors

HTTP methods should have distinct colors.

Use a configurable mapping.

Example:

```yaml
methods:
  GET: "#4CAF50"
  POST: "#2196F3"
  PUT: "#FF9800"
  PATCH: "#9C27B0"
  DELETE: "#F44336"
  OPTIONS: "#607D8B"
  HEAD: "#795548"
```

The exact colors are not important.

The important requirement is:

* different methods are visually distinguishable
* colors are configurable

Unknown methods should use a fallback color:

```yaml
methods:
  DEFAULT: "#FFFFFF"
```

---

# 17. Method legend

Display a small legend in the UI:

```text
GET       ●
POST      ●
PUT       ●
PATCH     ●
DELETE    ●
```

Use the same colors as the particles.

The legend should only show methods configured in the configuration file.

---

# 18. Target highlighting

When a request reaches the target:

1. the target node should briefly glow
2. the particle should disappear
3. optionally emit a small pulse/ripple from the node

Example:

```text
             ◉
            / \
           /   \
          ◉     ◉
               ✦
                ↓
               ◉
          "Athlete Service"
```

Then:

```text
          ◉
         ~~~
        ~~~~~
       ~~~~~~~
```

The target flash should be subtle but visible.

---

# 19. Edge activity

Optionally animate the edge itself very briefly as the particle passes.

For example:

```text
normal:

●────────────●

active:

●══════✦═════●
```

The particle itself should remain the primary visual indicator.

Do not make the entire tree permanently glow under high traffic.

---

# 20. Root activity

The root node can react to every request.

When a request begins:

```text
◉ SERVER
```

briefly becomes:

```text
◎ SERVER
```

or pulses.

This makes it clear that all traffic originates from the server.

At high traffic rates, throttle the root pulse animation so it doesn't become a flashing mess.

---

# 21. MQTT event handling

Subscribe to the configured topic:

```text
server/requests
```

For every MQTT message:

1. parse JSON
2. validate `type`
3. extract `target`
4. extract `method`
5. find target
6. animate request

Expected event:

```json
{
  "type": "single_request",
  "target": "swimresults-athlete-service-productive",
  "method": "GET"
}
```

---

# 22. Unsupported event types

Currently only:

```text
single_request
```

needs to be implemented.

For example:

```json
{
  "type": "something_else"
}
```

should be ignored.

Do not crash the application.

Log the event type at debug level if useful.

---

# 23. Unknown targets

If an MQTT message contains:

```json
{
  "type": "single_request",
  "target": "unknown-service",
  "method": "GET"
}
```

and no matching configured target exists:

* do not animate it
* do not crash
* increment an internal counter
* optionally show the number of unknown targets in debug information

Log:

```text
Received request for unknown target: unknown-service
```

at debug or warning level.

---

# 24. Invalid MQTT messages

Malformed JSON must not crash the UI.

Example:

```text
this isn't JSON
```

Ignore it.

The MQTT connection must remain active.

---

# 25. MQTT reconnect

If the connection drops:

* automatically reconnect
* show connection status in the UI
* continue running the visualization

Display something like:

```text
● MQTT Connected
```

or:

```text
● MQTT Disconnected
```

Use a subtle status indicator.

---

# 26. Configuration UI

For the first version, configuration should be file-based.

Do NOT build a complex graphical tree editor initially.

The primary configuration file should be:

```text
config.yaml
```

The user should be able to modify it and restart/reload the application.

Optionally support hot reload later.

---

# 27. Example complete configuration

```yaml
mqtt:
  url: "wss://mqtt.example.com:8084/mqtt"
  username: "visualizer"
  password: "secret"
  topic: "server/requests"
  clientId: "request-tree-visualizer"

animation:
  edgeDurationMs: 120
  targetFlashDurationMs: 180
  particleSize: 5
  particleGlow: true
  maxParticles: 500

methods:
  GET: "#4CAF50"
  POST: "#2196F3"
  PUT: "#FF9800"
  PATCH: "#9C27B0"
  DELETE: "#F44336"
  OPTIONS: "#607D8B"
  HEAD: "#795548"
  DEFAULT: "#FFFFFF"

tree:
  id: server
  label: "Server"

  children:

    - id: frontend
      label: "Frontend"

      children:
        - id: frontend-productive
          label: "Frontend"
          target: frontend-productive

    - id: swimresults
      label: "Swimresults"

      children:
        - id: athletes
          label: "Athletes"

          children:
            - id: swimresults-athlete-service-productive
              label: "Athlete Service"
              target: swimresults-athlete-service-productive

        - id: races
          label: "Races"

          children:
            - id: swimresults-race-service-productive
              label: "Race Service"
              target: swimresults-race-service-productive

    - id: administration
      label: "Administration"

      children:
        - id: admin-api
          label: "Admin API"

          children:
            - id: admin-user-service
              label: "User Service"
              target: admin-user-service

            - id: admin-event-service
              label: "Event Service"
              target: admin-event-service
```

---

# 28. Visual style

Aim for a dark, futuristic infrastructure-monitoring aesthetic.

The visualization should resemble:

* network topology
* data center visualization
* sci-fi network map
* distributed system graph

Suggested:

```text
dark background
thin subdued edges
dim nodes
bright glowing particles
method-specific colors
subtle animation
```

Avoid excessive UI decoration.

The tree and traffic should dominate the screen.

---

# 29. Full-screen mode

Provide a full-screen visualization mode.

The application should have a button:

```text
Fullscreen
```

When enabled:

* hide configuration/debug UI
* maximize the tree
* hide unnecessary browser-like controls
* keep MQTT status minimally visible

This is important because the eventual goal is potentially displaying this on a large screen/projector.

---

# 30. Debug panel

Provide a collapsible debug/status panel.

It should show:

```text
MQTT
Connected

Topic
server/requests

Messages received
12,492

Events visualized
11,840

Unknown targets
3

Invalid messages
0

Active particles
87
```

This is useful while developing the visualization.

The debug panel should be hidden by default in presentation/fullscreen mode.

---

# 31. Event counters

Maintain in-memory counters:

```text
messagesReceived
eventsVisualized
eventsDropped
unknownTargets
invalidMessages
```

These do not need to be persisted.

Optionally show:

```text
Requests/sec
```

using a rolling one-second counter.

This will make the prototype useful for experimenting with different traffic volumes.

---

# 32. Performance visualization

Optionally display a small traffic indicator:

```text
REQUESTS / SEC

███████████████████  142
```

This is useful for comparing visual behavior under different loads.

Keep it secondary to the actual tree.

---

# 33. Tree layout implementation

Implement a deterministic tree layout.

A simple recursive layout is acceptable.

For example:

1. calculate the width required by each subtree
2. position leaves evenly
3. position each parent at the center of its children
4. position levels vertically

This produces:

```text
                   root
                /        \
               /          \
             A              B
           /   \          /   \
          C     D        E     F
```

The layout should automatically adapt when the configuration changes.

Do not hard-code coordinates.

---

# 34. Zoom and pan

The visualization should support:

* mouse wheel zoom
* drag-to-pan
* reset view

Controls:

```text
Zoom +
Zoom -
Reset
Fullscreen
```

Keyboard shortcuts are optional.

The user should be able to create fairly large trees without losing the ability to navigate them.

---

# 35. Responsive layout

The visualization should adapt to:

* laptop screen
* large monitor
* projector

The tree should use the available viewport.

Avoid fixed pixel dimensions wherever possible.

SVG `viewBox` is recommended.

---

# 36. Animation implementation

Prefer an animation system based on:

```text
requestAnimationFrame
```

or a well-supported animation library.

Do not create one React state update every frame for every particle if that causes unnecessary rendering.

A recommended architecture is:

```text
React
  ↓
tree structure / configuration
  ↓
SVG rendering

Animation engine
  ↓
particle positions
  ↓
requestAnimationFrame
```

Keep high-frequency animation state outside normal React component state when appropriate.

The application must remain smooth with many simultaneous particles.

---

# 37. Particle path representation

When a target is configured:

```text
target → parent → parent → root
```

precompute:

```text
root → parent → parent → target
```

and store the path.

For each edge, store:

```text
start node
end node
start coordinates
end coordinates
```

A particle can then interpolate:

```text
x = startX + (endX - startX) * progress
y = startY + (endY - startY) * progress
```

where:

```text
progress = 0.0 → 1.0
```

This is sufficient for straight edges.

---

# 38. Optional curved edges

Straight edges are sufficient for version 1.

However, structure the renderer so curved SVG paths could be introduced later.

For example:

```text
        ●
       ╱
      ╱
     ●
```

instead of:

```text
●
│
●
```

Do not implement complex edge routing unless needed.

---

# 39. Particle visual design

A particle could consist of:

```text
small bright circle
+
glow filter
+
optional short trailing line
```

Example:

```text
───────✦
```

The trail should point behind the particle.

The trail can make fast movement much easier to perceive.

Keep the trail short.

---

# 40. Different methods should feel different

The color is mandatory.

Optionally also vary:

* particle shape
* trail length
* glow intensity

However, do not make method-specific animation behavior too complicated.

Color should remain the primary distinction.

---

# 41. Target-specific visual identity

Optionally allow targets to define:

```yaml
target: swimresults-athlete-service-productive
icon: athlete
```

but this is not required for version 1.

Do not introduce a dependency on external icon libraries unless useful.

---

# 42. Testing without the real server

Include a development mode that generates fake requests.

For example:

```yaml
simulation:
  enabled: true
```

or a UI button:

```text
Generate Request
```

The simulator should allow:

```text
Target: [Athlete Service ▼]
Method: [GET ▼]

[Send Request]
```

Clicking `Send Request` should create exactly the same internal event as an MQTT message.

This is extremely useful for designing the visualization without needing real traffic.

---

# 43. Traffic simulator

Optionally provide:

```text
Traffic Simulation

[▶ Start]

Rate:
[ 10 ] requests/sec

Method:
[Random]

Targets:
[All]

Variation:
[Random]
```

This can generate realistic traffic for testing.

Example:

```text
10 req/s
30% GET
40% POST
20% PUT
10% DELETE
```

This functionality should be disabled or hidden in presentation mode.

---

# 44. Manual testing

The developer should be able to send an MQTT message manually.

Example:

```bash
mosquitto_pub \
  -h mqtt.example.com \
  -p 8883 \
  --cafile ca.crt \
  -u visualizer \
  -P 'password' \
  -t server/requests \
  -m '{"type":"single_request","target":"swimresults-athlete-service-productive","method":"GET"}'
```

The UI should immediately display a particle traveling:

```text
Server
 ↓
Swimresults
 ↓
Athletes
 ↓
Athlete Service
```

---

# 45. Suggested project structure

```text
request-tree-visualizer/
├── public/
│
├── src/
│   ├── components/
│   │   ├── Tree.tsx
│   │   ├── TreeNode.tsx
│   │   ├── TreeEdge.tsx
│   │   ├── Particle.tsx
│   │   ├── Legend.tsx
│   │   ├── DebugPanel.tsx
│   │   └── Controls.tsx
│   │
│   ├── mqtt/
│   │   ├── client.ts
│   │   └── types.ts
│   │
│   ├── tree/
│   │   ├── layout.ts
│   │   ├── paths.ts
│   │   └── types.ts
│   │
│   ├── animation/
│   │   ├── engine.ts
│   │   ├── particle.ts
│   │   └── types.ts
│   │
│   ├── config/
│   │   ├── config.ts
│   │   └── types.ts
│   │
│   ├── simulation/
│   │   └── simulator.ts
│   │
│   ├── App.tsx
│   ├── main.tsx
│   └── styles.css
│
├── config/
│   └── config.example.yaml
│
├── package.json
├── tsconfig.json
├── vite.config.ts
├── README.md
└── ...
```

The exact structure may differ, but keep the concerns separated.

---

# 46. Important architecture principle

Separate these concepts:

```text
MQTT
  ↓
Event

Event
  ↓
Target lookup

Target lookup
  ↓
Tree path

Tree path
  ↓
Animation

Animation
  ↓
Rendering
```

The renderer must NOT know anything about MQTT.

The MQTT client must NOT know anything about SVG.

This will make it much easier to eventually replace the browser renderer with:

```text
ESP32 + LEDs
```

or:

```text
Raspberry Pi + LED strips
```

while keeping the same event model.

---

# 47. Internal event model

Use an internal type such as:

```typescript
interface RequestEvent {
  type: "single_request";
  target: string;
  method: string;
}
```

Do not pass the MQTT message directly into rendering code.

Normalize it first.

---

# 48. Future compatibility with physical visualization

The visualizer should deliberately mirror the architecture of the eventual physical installation.

The conceptual pipeline should be:

```text
MQTT
  ↓
RequestEvent
  ↓
Target → Tree Path
  ↓
Animation
```

Later:

```text
MQTT
  ↓
RequestEvent
  ↓
Target → Physical LED Path
  ↓
LED animation
```

Therefore the tree configuration should remain independent of the browser.

---

# 49. Configuration reload

If straightforward, implement a development-only reload mechanism.

For example:

```text
[Reload Config]
```

or automatically reload when the YAML file changes.

When reloading:

1. parse config
2. validate config
3. calculate tree layout
4. rebuild target lookup
5. replace configuration atomically

If the new configuration is invalid:

* keep the old configuration
* display the error
* do not break the running visualization

This is optional for version 1 but very useful during experimentation.

---

# 50. Error handling

Errors should be visible but should not crash the application unnecessarily.

Examples:

```text
Unable to connect to MQTT
Invalid configuration
Duplicate target
Unknown target
Malformed MQTT message
```

Use a clear status panel.

---

# 51. Security

The MQTT credentials are sensitive.

Do not commit real credentials.

Provide:

```text
config.example.yaml
```

with placeholders:

```yaml
mqtt:
  url: "wss://mqtt.example.com:8084/mqtt"
  username: "..."
  password: "..."
```

Add:

```text
config.yaml
```

to `.gitignore`.

If the application is browser-only, remember that MQTT credentials supplied to the browser are inherently accessible to the browser/user.

This is acceptable for a local visualization tool, but the MQTT account should have **subscribe-only permissions** to the request topic.

It should NOT have publish permissions.

Ideally create a dedicated MQTT user:

```text
request-visualizer
```

with permission to:

```text
SUBSCRIBE server/requests
```

only.

---

# 52. README requirements

The README should explain:

1. what the project does
2. architecture
3. prerequisites
4. local installation
5. configuration
6. MQTT WebSocket requirements
7. tree configuration
8. method colors
9. running the simulator
10. fullscreen mode
11. troubleshooting MQTT connection
12. how to manually publish a test request

Example:

```bash
npm install
npm run dev
```

---

# 53. Definition of done

The implementation is complete when:

* [ ] application runs locally
* [ ] configuration is loaded from YAML
* [ ] MQTT connection works
* [ ] MQTT topic is configurable
* [ ] MQTT reconnect works
* [ ] `single_request` events are parsed
* [ ] HTTP method is parsed
* [ ] tree is configurable
* [ ] arbitrary tree depth works
* [ ] target leaves are configurable
* [ ] target → root path is correctly calculated
* [ ] requests animate from root to target
* [ ] particles follow tree edges
* [ ] multiple requests can animate simultaneously
* [ ] particle colors depend on HTTP method
* [ ] target flashes when reached
* [ ] unknown targets don't crash the application
* [ ] malformed messages don't crash the application
* [ ] particle count is bounded
* [ ] tree can be zoomed/panned
* [ ] fullscreen mode exists
* [ ] MQTT connection status is visible
* [ ] debug statistics are visible
* [ ] fake request generation works
* [ ] example configuration is included
* [ ] README is included
* [ ] no real credentials are committed

---

# 54. Example final experience

The application should feel approximately like this:

```text
┌───────────────────────────────────────────────────────────────┐
│                                                               │
│                         ◉ SERVER                              │
│                        /       \                              │
│                       /         \                             │
│                      /           \                            │
│                   ◉               ◉                           │
│               FRONTEND        SWIMRESULTS                     │
│                                   │                           │
│                         ┌─────────┴─────────┐                 │
│                         │                   │                 │
│                       ◉                     ◉                 │
│                   ATHLETES                RACES              │
│                       │                     │                 │
│                       ✦                     │                 │
│                       │                     ✦                 │
│                       ▼                     │                 │
│                       ◉                     ◉                 │
│                  ATHLETE SERVICE        RACE SERVICE          │
│                                                               │
│                                                               │
│ GET ●   POST ●   PUT ●   DELETE ●           MQTT ● Connected  │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

A GET request would appear as a green/selected-color particle:

```text
SERVER
  │
  ✦
  │
  ● SWIMRESULTS
  │
  ✦
  │
  ● ATHLETES
  │
  ✦
  │
  ◉ ATHLETE SERVICE
```

A POST arriving immediately afterward would create a second particle with its own color and animation.

The overall effect should be that **the server appears to be continuously emitting streams of requests into the different subsystems**, with busy services visibly receiving more particles than rarely-used services.

The implementation should prioritize this visual feeling over building a conventional monitoring dashboard.