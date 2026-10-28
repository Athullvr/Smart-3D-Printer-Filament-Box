# FilamentGuard hardware integration (Phase 3)

Status: the **web side** and a **mock endpoint** are implemented and tested. **No real ESP32 or DHT11 has been connected or verified.** The UI labels hardware mode "HARDWARE MODE (UNVERIFIED)" until that changes.

## Architecture

```
ESP32 + DHT11 ──(HTTP GET /api/reading)──▶ HttpSensorProvider ─▶ SensorReading ─▶ monitoring engine ─▶ UI / storage
SimulatedSensorProvider ───────────────────────────────────────▲   (same engine, same interface: SensorProvider)
```

- `SensorProvider` (`src/services/sensor/types.ts`) is the provider-neutral interface (`start`, `stop`, `subscribe`).
- `HttpSensorProvider` (`httpSensor.ts`) polls the device; `contract.ts` validates payloads. The engine is unchanged apart from carrying the data source on events and honouring a provider-supplied error message.
- The browser is a **read-only consumer**: it only sends `GET`. Nothing in the web app can change, silence or disable the device.

### Safety responsibilities (important)
- **Physical monitoring and alerts must run in the ESP32 firmware**: it samples the DHT11, compares against its own stored threshold, and drives its own buzzer/LED, with no dependence on the browser, Wi-Fi or this page.
- Closing the page, a network outage, or an app bug cannot disable device-side alerting. The web app can only *display* data.
- "Acknowledge" in the dashboard is **dashboard-local**. It does not silence the physical buzzer. (A future, explicitly designed device command would be needed for that.)
- The web app's thresholds are not pushed to the device yet. Until a device-config feature exists, the firmware threshold and the dashboard threshold can differ. Keep them aligned manually.

## Transport: HTTP polling (only transport implemented)

| Item | Value |
|---|---|
| Endpoint | `GET <base>/api/reading` (default in UI: `http://localhost:8787/api/reading`) |
| Content type | `application/json` |
| Poll interval | 2 s between the end of one request and the start of the next (no overlapping requests) |
| Request timeout | 3 s (headers + body); a timeout counts as a disconnect |
| Stale threshold | 10 s with no *new* measurement (browser clock) |
| CORS | The device must send `Access-Control-Allow-Origin: *` (or the app origin), and answer `OPTIONS` if the browser preflights |

### Payload

```json
{
  "deviceId": "dry-box-01",
  "humidity": 31.5,
  "temperature": 24.1,
  "timestamp": 1730000000000,
  "valid": true,
  "error": "optional text, used when valid is false"
}
```

| Field | Type | Rules |
|---|---|---|
| `deviceId` | string | required, non-empty, max 64 chars |
| `humidity` | number or null | % RH, finite, 0-100 inclusive. Required when `valid=true`; `null` allowed when `valid=false` |
| `temperature` | number or null | degrees Celsius, finite, -40..125. Same null rule |
| `timestamp` | integer | required, measurement time, epoch milliseconds, > 0 |
| `valid` | boolean | required. `false` = device could not take a valid measurement (e.g. DHT11 checksum/timeout) |
| `error` | string | optional, max 200 chars, only used when `valid=false` |

### Behaviour

| Situation | Result in the app |
|---|---|
| Valid, new measurement | Forwarded to the engine; connection `Connected` |
| `valid:false` from device | Engine gets an unavailable reading with the device's error: "SENSOR DATA ERROR" (never "safe") |
| Malformed JSON shape / out-of-range value / NaN-like | Rejected ("Rejected malformed reading: ..."), unavailable state, not counted as a fresh measurement |
| HTTP error, network error, timeout, non-JSON | `Disconnected`, "SENSOR DISCONNECTED", unavailable state |
| Same `(deviceId, timestamp)` as the last accepted reading | Treated as the same measurement: **not forwarded** (no duplicate events) |
| No new measurement for >10 s while the endpoint still answers | `Stale data`, "SENSOR DATA STALE", unavailable state (reported once, not every poll) |
| Reconnect / new measurement | Back to `Connected`; the engine closes or continues events by the normal rule |
| Endpoint returns an *old* measurement after an outage | `Stale` until a new measurement arrives |

Design notes:
- The engine timestamp is the **browser receive time**, so a wrong or unset ESP32 clock cannot corrupt event times or staleness. The device's own time is kept as `measuredAt` and shown in the device panel.
- Duplicates are detected by equality with the last accepted `(deviceId, timestamp)`, not by "newer than", so a device whose clock resets is still accepted. Therefore the firmware **must change `timestamp` for every new measurement** (a measurement counter in the low digits is fine if there is no RTC).
- An open event cannot span data sources: switching source (or restarting into a different source) closes the active event at that time. Event history is kept; chart samples are cleared. Each event and CSV row records its `data_source`.
- Unavailable data never closes an active event and never reads as safe.

## Mock ESP32

No dependencies. Not real hardware.

```bash
npm run mock:esp32            # http://127.0.0.1:8787 (random-walk humidity)
AUTO=0 PORT=9000 npm run mock:esp32
```

Control it with `POST /mock/control` (JSON patch; `GET /mock/state` shows state):

```bash
curl -X POST localhost:8787/mock/control -d '{"auto":false,"humidity":55}'           # breach for PLA (35)
curl -X POST localhost:8787/mock/control -d '{"humidity":20}'                         # back to safe
curl -X POST localhost:8787/mock/control -d '{"valid":false,"error":"DHT11 timeout"}' # device-reported fault
curl -X POST localhost:8787/mock/control -d '{"valid":true}'
curl -X POST localhost:8787/mock/control -d '{"frozen":true}'                         # same measurement forever -> stale after 10 s
curl -X POST localhost:8787/mock/control -d '{"frozen":false}'
curl -X POST localhost:8787/mock/control -d '{"failing":true}'                        # HTTP 503 -> disconnected
curl -X POST localhost:8787/mock/control -d '{"delayMs":5000}'                        # slower than the 3 s timeout
curl -X POST localhost:8787/mock/control -d '{"corrupt":"malformed"}'                 # or "out-of-range" / "none"
```

Then `npm run dev`, choose **Hardware (HTTP)** under "Data source".

## Connecting a physical ESP32 later (checklist)

1. **Firmware first.** Implement DHT11 sampling, local threshold comparison, and local buzzer/LED alerting that work with Wi-Fi and the browser both absent. Test those alerts on the bench before touching the web app.
2. **Expose `GET /api/reading`** returning the exact payload above (use ArduinoJson or similar). Use `valid:false` + `error` on a failed DHT11 read (the DHT11 reads at most about once per second; sample at >= 1-2 s intervals).
3. **Timestamps:** use NTP epoch milliseconds if possible; otherwise a value that changes on every new measurement.
4. **CORS:** add `Access-Control-Allow-Origin: *` to the response and handle `OPTIONS` with `204`.
5. **Network:** put the ESP32 on the same LAN as the browser; give it a static IP or DHCP reservation / mDNS name. Find the URL, e.g. `http://192.168.1.50/api/reading`; check with `curl -i` that the JSON and CORS header are correct.
6. **Mixed content:** a page served over `https://` cannot call an `http://` device. Use the local dev server (`http://localhost`) or serve the app over plain HTTP on the LAN for the prototype.
7. **Point the app at it:** open the app, choose **Hardware (HTTP)**, enter the URL, press **Apply**. Confirm: Connected, device ID shown, values match the device's serial output.
8. **Verify, in this order:** normal readings; breathe on the sensor (humidity rises, breach); unplug the DHT11 (device `valid:false` -> error state); power off the ESP32 (Disconnected); reconnect (recovers); confirm the **physical** alert still fires while the browser tab is closed.
9. Only after step 8 passes should the UI wording "UNVERIFIED" be removed, and record the test date and firmware version.
10. Security: this prototype has no authentication on the device endpoint. Keep it on a trusted LAN; do not expose it to the internet.

## Known limitations
- Polling only (no push, no WebSocket/MQTT). Latency is up to one poll interval.
- Single device. Thresholds and acknowledgements are not synced to the device.
- Poll/timeout/stale values are constructor options, not yet user-configurable.
- Background tabs may throttle timers, delaying polls and stale detection.
