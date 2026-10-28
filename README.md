# FilamentGuard - Smart Filament Storage Monitor

EDIS capstone, **Milestone 1: software prototype.** A web dashboard for monitoring humidity and temperature inside a 3D-printer filament storage box ("Dry Box Unit 01"), driven entirely by a **simulated** sensor.

## Setup

Requires Node.js 20+ and npm.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # Vitest + React Testing Library (single run)
npm run typecheck  # strict TypeScript
npm run build      # typecheck + production build into dist/
npm run preview    # serve the production build
```

## What is simulated

- **All sensor data.** Humidity and temperature come from `SimulatedSensorProvider` (sliders, quick actions, optional automatic random walk). Every reading is tagged `source: 'simulated'` and the UI shows a "SIMULATION MODE" badge. No hardware is connected.
- The **audible alert is a UI state only** ("Buzzer (simulated): SOUNDING / SILENCED"). No sound is played and no buzzer exists.
- "Sensor fault" in the simulator emits an unavailable reading to demonstrate the error path.

## What is NOT implemented yet

- ESP32 / DHT11 firmware, Wi-Fi/MQTT/HTTP/WebSocket transport, and a hardware `SensorProvider`.
- Real audio or buzzer output, push/email notifications, multiple devices.
- Backend, authentication, cloud sync. Data lives only in this browser's `localStorage`.
- Validated material limits. Thresholds are **provisional demo values**, not safety limits.

## Monitoring rules

- **Safe**: humidity <= threshold. **Breach**: humidity > threshold (strict; exactly equal is safe). No hysteresis: a reading flickering around the threshold opens/closes events accordingly.
- A breach opens exactly one event (id, start, peak, material and threshold at start). While it is active, only the peak is updated. A reading back at or below the threshold closes it. A later breach opens a new event.
- **Acknowledge** silences the simulated buzzer and records acknowledgment on the event; the breach and monitoring continue.
- **Invalid readings** (null, NaN, infinite, outside 0-100 %RH, bad temperature/timestamp) produce a "SENSOR DATA ERROR" state, never "safe". An open event stays open and its alert state unchanged until a valid reading arrives.
- **Changing material or a threshold** re-evaluates the latest valid reading immediately (not while the sensor is unavailable). An already open event keeps its original material/threshold; if the new threshold makes the reading safe, that event closes, and if safe becomes breach, a new event is opened under the new material.
- Default provisional thresholds: PLA 35, PETG 25, TPU 20, Nylon 15 % RH. Threshold edits are applied on blur/Enter and must be between 1 and 100.
- **Reset demo** (confirmation required) erases all events, history, saved settings and simulator values, returning to defaults (PLA, default thresholds, 28 % RH, 24 C, auto-mode off).
- Persisted: settings, last 120 samples, up to 500 events, last simulator slider values. Automatic mode is never resumed after refresh. Malformed or unavailable storage is tolerated and surfaced as a warning.

## Architecture

```
src/
  app/                     App shell and composition
  components/              Shared UI primitives
  features/
    monitoring/            engine.ts (pure rules), appState.ts (reducer), status banner, metrics, chart
    simulator/               simulator panel
    events/                  history table, CSV export
    settings/                defaults/validation, material + threshold UI
  hooks/                   useFilamentGuard (sensor -> engine -> storage wiring), useSimulator
  services/
    sensor/                SensorProvider interface, SimulatedSensorProvider
    storage/               StorageService interface + validated localStorage implementation
  types/  utils/  test/
```

Data flow: `SensorProvider` -> `dispatch({type:'reading'})` -> `appReducer` -> pure `applyReading` engine -> UI + persistence. The engine has no React, clock, or storage dependencies (timestamps arrive with readings/actions), so duplicate events are impossible by construction, including under React Strict Mode.

**Replacing the simulator with an ESP32:** implement `SensorProvider` (`start`, `stop`, `subscribe`) and emit `SensorReading` objects with `source: 'esp32-dht11'`; the engine and dashboard do not change. (The simulator panel is typed to `SimulatedSensorProvider` and would be hidden for a hardware provider.)

## Tests

`npm test` covers: threshold rule and boundary, event lifecycle, peak tracking, acknowledgment, material re-evaluation, event immutability, invalid readings, durations, storage corruption/failure, CSV escaping/content, simulator bounds and start/stop, and UI flows (breach lifecycle, Strict Mode, refresh persistence, reset confirmation, CSV download, live duration). Responsive checks only assert the presence of responsive layout classes; there is no real-viewport/browser test.
