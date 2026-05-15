# DroneEar Changelog

---

## v2.1.3 — Always-on hearing pill, scrollable history, brand icon (2026-05-15)

### Why this release
Testers reported playing YouTube drone clips and seeing nothing in History,
plus the empty History screen wouldn't even scroll. v2.1.2 surfaced the model
output only in Debug Mode — most users never enable that. This release makes
the listen feedback always visible and ships the new brand-aligned icon set.

### Listen screen — always-on "hearing" indicator
- A small pill under the radar status now shows `HEARING: <category> <confidence>%`
  continuously, regardless of Debug Mode. The pipeline is no longer silent
  when test sounds fall below the verdict threshold.
- Wired to the same `lastRawCategory` / `lastRawConfidence` Zustand fields that
  Debug Mode introduced in v2.1.2.

### Detection sensitivity
- Default `confidenceThreshold` lowered from **0.75 → 0.60**. Phone-speaker
  playback of YouTube drone clips arrives at lower SPL than a real drone and
  rarely clears 0.75; 0.60 catches those tests without flooding the log with
  obvious false positives. Users who previously set their own threshold keep
  their saved value (persist store untouched).

### History screen
- Empty state wrapped in a `ScrollView` so the "why is this empty?"
  explanation + the Engage Sensors + Settings buttons remain reachable on
  small devices and with long translations (German, Hindi, Korean).

### Brand icon
- New aero-style icon set applied across all platforms:
  `icon.png` (iOS / default), Android adaptive layers
  (`android-icon-foreground` + `android-icon-background` + `android-icon-monochrome`),
  and `splash-icon.png`.
- Alpha channel stripped from iOS `icon.png` and the Android background layer
  (both opaque slots — Apple rejects alpha on app icons). Foreground +
  monochrome + splash retain alpha (intentional transparency).
- Previous icons archived to `assets/images/_backup-<timestamp>/` locally
  (gitignored) so a rollback is one copy away if needed.

### Internationalisation
- New `hearing` string in the Translations interface and across all 15
  locales (KO, EN, UK, AR, AR_GULF, HE, HI, UR, TL, DE, ES, FR, IT, ZH, JA).

### Verification
- `tsc --noEmit`: 0 errors.
- `jest`: 13 suites / 155 tests all passing.

---

## v2.1.2 — Debug visibility & empty-history guidance (2026-05-15)

### Why this release
Users testing with non-drone sounds (voice, music, claps) reported "nothing
gets logged" — which is correct behaviour (the model filters those out as
BACKGROUND), but the app gave no feedback to explain it. This release surfaces
what the model actually heard, and tells users *why* a quiet history is not
a broken app.

### Debug inference surface
- `AudioClassifierEngine` now emits a new `onRaw(category, confidence)`
  callback for every classified frame, regardless of confidence threshold,
  category filter (`BACKGROUND`/`AMBIENT`), or temporal voting.
- Wired through `ThreatDetector.onRawInference` → `useThreatDetector` →
  `detectionStore.lastRawCategory` / `lastRawConfidence`.
- Listen-screen debug panel (visible when Debug Mode is on) adds a second
  card showing `Heard: <category>` + `Confidence: <%>`. Users can now see
  the model classify their test sound as e.g. `BACKGROUND 23%` instead of
  staring at silence.

### Empty-history UX
- The history empty state now explicitly explains: "Only sounds matching
  DroneEar's drone acoustic models are logged. Everyday sounds (voice,
  music, claps) are filtered out as background. Lower the confidence
  threshold in Settings, or enable Debug Mode to see what the model is
  hearing."
- Adds a Settings shortcut button next to the existing "Engage Sensors"
  button so users can jump straight to the threshold/debug toggle.

### Internationalisation
- New `emptyHistoryWhyNot` string in the Translations interface and across
  all 15 locales (KO, EN, UK, AR, AR_GULF, HE, HI, UR, TL, DE, ES, FR, IT,
  ZH, JA).

### Verification
- `tsc --noEmit`: 0 errors.
- `jest`: 13 suites / 155 tests all passing.

---

## v2.1.1 — Stability & i18n layout fixes (2026-05-15)

### Listen screen
- Eliminated full-screen flicker during listening. SensorEnforcementManager now
  short-circuits when mic quality / recording state hasn't actually changed, so
  the warning panel no longer re-creates its issue array (and re-fires the
  escalating haptic alarm) on every audio frame.
- Tactical radar sweep was a 90° pie-slice that users misread as a "detected
  sector" even with zero tracks. Replaced with a thin radial line rotating
  around the center (transformOrigin 50% 100%).
- MicQualityPanel SNR display is now snapped to an integer to stop the per-frame
  jitter between e.g. 2.5 ↔ 2.7 dB.
- React.memo wrappers removed from SensorIssuesPanel / MicQualityPanel —
  earlier they would render with stale theme/locale after a DAY↔NIGHT or
  language switch (memo bypasses internal hook updates).

### Recording & audio session
- Auto-recovery after a watchdog stall now notifies
  SensorEnforcementManager (new `onRecordingRecovered` callback). The
  "Recording stopped unexpectedly" warning no longer stays pinned in the
  panel after capture restarts.
- iOS Audio Session is now explicitly configured on every `startScanning`:
  `allowsRecordingIOS`, `playsInSilentModeIOS`, `staysActiveInBackground`,
  `interruptionModeIOS: DoNotMix`. System sounds, brief backgrounding, and
  notifications no longer silently drop capture.
- AudioCapture listener race fixed: stale data callbacks short-circuit via
  handler-identity check; stop() flips `isRecording` before touching the
  listener so in-flight frames bail safely.
- Rapid double-tap of the scan button can no longer launch two parallel
  startScanning flows (sync `scanStartingRef` mutex + body-wide try/finally).

### Settings / Explore / History / Onboarding
- Settings: theme/language/threshold chip rows rewritten as stacked blocks
  with `flexWrap: 'wrap'`. AMOLED / Deutsch / 95% chips no longer clip on
  smaller screens or in long-locale builds.
- Explore: range-by-pattern card converted to a column layout (label on top,
  value badge underneath, right-aligned) so longer English/German labels
  no longer push the "~3km+" badge off the viewport.
- History: filter pill row gets fixed height + minWidth + trailing
  paddingRight so the last severity pill is always fully scrollable.
- Onboarding: each step is wrapped in a vertical ScrollView with
  flexGrow + paddingBottom; the CONTINUE button on the BLE Detection step
  no longer gets clipped under the page-indicator dots.

### Map
- Dedicated empty state when GPS is unavailable / denied: a glass card with
  "Location unavailable" and a one-tap "OPEN SETTINGS" button
  (`Linking.openSettings()`). Previously the user saw a blank map view with
  no path to fix the underlying permission.
- `useMapData` guards against NaN/Infinity in user position and
  bearing/distance; non-finite values no longer silently disappear from
  react-native-maps.

### Core algorithms
- HybridEngine concurrency: replaced the nullable `_lock` with a
  pre-resolved Promise and switched to "snapshot prev → install own →
  await prev" pattern so concurrent `predict()` calls form a proper FIFO
  chain even from a cold start.
- DOAEstimator guards against NaN/Infinity in compass heading or relative
  bearing, preventing non-finite values from poisoning detection tracks
  and radar marker positions.
- EnvironmentDetector no longer reports INDOOR when the mic feed is
  identically silent (avgRms = 0, variance = 0); a muted / blocked mic
  now scores neutral so the verdict falls back to GPS + barometer.
- detectionStore caps `fusedDetections` at 500 entries (each carries a
  128-bin spectralSignature Float array — multi-hour sessions could
  otherwise climb into tens of MB of retained memory).

### BLE / Wi-Fi
- RealBLEAdapter only flips its `scanning` flag *after*
  `startDeviceScan()` returns without throwing; a synchronous failure no
  longer leaves the flag stuck on and a later stopScan() calling
  `stopDeviceScan()` on a scan that never started.
- useBLEScanner / useWiFiScanner now use a mounted flag, so the
  `isAvailable().then(...)` continuation can't setState on an unmounted
  hook.

### Voice alerts
- VoiceAlertManager queue is bounded even on the CRITICAL-priority path
  so a storm of critical detections can't grow it without bound.

### Persistence
- `settingsStore` persist gets `version: 1` plus a `migrate` function so
  future schema bumps can move user data safely; a corrupted payload
  also falls back to defaults instead of crashing on hydrate.

### Internationalization
- New `locationUnavailable` / `locationUnavailableHint` strings added to
  the `Translations` interface and to all 15 locale files
  (KO, EN, UK, AR, AR_GULF, HE, HI, UR, TL, DE, ES, FR, IT, ZH, JA).
- expo-location / expo-sensors plugin permission messages aligned with
  the corresponding infoPlist strings so users never see two different
  permission rationales for the same capability.

### Routing / providers
- Explicit `SafeAreaProvider` wrap added to the root layout so child
  screens using `useSafeAreaInsets` work correctly on notched devices.

### Dev infra
- New `src/utils/logger.ts` with `__DEV__`-gated log/warn (errors always
  emit). New code can adopt it incrementally; existing `console.*` left
  in place to avoid a 45-site sweep landing in this release.
- Silent `.catch(() => {})` blocks in BLE / Wi-Fi lifecycle replaced
  with `console.warn(...)` so production logs surface real failures.
- expo SDK patch updates: expo 54.0.33 → 54.0.34, expo-dev-client
  6.0.20 → 6.0.21, expo-file-system 19.0.21 → 19.0.22, expo-linking
  8.0.11 → 8.0.12, expo-web-browser 15.0.10 → 15.0.11.

### Verification
- `tsc --noEmit`: 0 errors.
- `jest`: 13 suites / 155 tests all passing.
- `expo lint`: 0 errors (only opt-in style warnings remain).
- `expo-doctor`: dependencies up to date.

---

# DroneEar v1.0 — Development Summary

**Date:** 2026-03-21
**Codebase:** 88 files, ~6,000 lines (TypeScript/React Native)
**Platform:** iOS + Android (Expo SDK 54, React Native 0.81)
**Languages:** 15 (KO, EN, UK, AR, AR_GULF, HE, HI, UR, TL, DE, ES, FR, IT, ZH, JA)

---

## Core Architecture

### Audio Detection Pipeline
```
Microphone (44.1kHz PCM)
  → FFT (2048-point Cooley-Tukey, pre-allocated buffers)
  → Mel Spectrogram (128 bins, 125-8000Hz)
  → MFCC (30 coefficients via DCT)
  → Hybrid Classification Engine
    ├─ Rule-based (ModelManager v2.0, 6 acoustic signatures)
    ├─ Gaussian ML (12-dimensional probabilistic classifier)
    └─ Fusion: both agree ×1.2, ML only ×0.9, rule only ×0.7
  → 3-frame temporal voting (60% consistency)
  → DOA bearing (GCC-PHAT stereo)
  → Distance estimation (inverse square law)
  → Doppler approach rate
  → Kalman 2D tracking
  → Detection output
```

### BLE Remote ID (iOS + Android)
```
react-native-ble-plx → RealBLEAdapter → BLERemoteIDScanner
  → RemoteIDParser (ASTM F3411: Basic ID, Location, System, Operator ID)
  → detectionStore.bleDevices
  → DetectionFusionEngine (bearing ±30°, time <5s, confidence ×1.3)
```

### WiFi Remote ID (Android Only)
```
WiFiRemoteIDModule (native) → AndroidWiFiAdapter → WiFiRemoteIDScanner
  → RemoteIDParser (same ASTM F3411 parser as BLE)
  → detectionStore.bleDevices (wifi_ prefix)
  → DetectionFusionEngine (transparent — same fusion logic)
```

### Platform Separation
```
iOS:  BLE + Audio        → NullWiFiAdapter (WiFi disabled)
Android: BLE + WiFi + Audio → AndroidWiFiAdapter + full features
```

---

## Features

### Detection
- 5 acoustic patterns: MULTIROTOR, SINGLE_ENGINE, SINGLE_ROTOR, JET_PROPULSION, PROPELLER_FIXED
- Hybrid AI classifier (rule-based + Gaussian ML fusion)
- BLE Remote ID scanning (ASTM F3411)
- WiFi Remote ID scanning (Android — WiFi Beacon + WiFi NAN)
- Audio + RF fusion engine (bearing/time matching)
- Kalman 2D tracking with ETA prediction
- Direction of Arrival (DOA) estimation
- Distance and approach rate estimation
- Environment detection (indoor/outdoor/uncertain)

### UI/UX
- 3 themes: DAY, NIGHT (NVG-compatible), AMOLED
- Tactical radar display
- Real-time spectrogram visualization
- Interactive map with drone markers (acoustic/BLE/WiFi/fused/operator)
- Detection history with source badges
- 6-step onboarding flow
- BLE/WiFi scan status badges on main screen
- Platform-specific WiFi info banners

### Alerts
- Voice alerts (scan start, status, threats, environment warnings)
- Haptic feedback on detection
- Battery alerts: 50% (voice), 30% (voice + dialog), 15% (critical)
- Threat severity classification (CRITICAL/HIGH/MEDIUM/LOW)

### Settings
- Independent BLE / WiFi scan toggles
- 4 device profiles (BALANCED, SAMSUNG, HIGH_SENSITIVITY, RAW_EXPERT)
- Confidence threshold adjustment
- Theme / Language selection
- Alert vibration, sound, voice toggles
- Privacy policy link
- Reset onboarding (with confirmation dialog)

---

## Quality Metrics

### Debugging Rounds
| Round | Issues Fixed | Focus |
|-------|-------------|-------|
| 1 | 72 | Initial bugs, type errors, null safety |
| 2 | 53 | Deep audit + ErrorBoundary |
| 3 | 10 | Mock/fake data removal |
| 4 | 10 | Residual cleanup |
| 5 | — | Hybrid ML engine implementation |
| 6 | 24 | BACKGROUND filter, DAY mode, BLE lifecycle |
| 7 | 7 | Apple Privacy Manifest, FFT optimization, battery |
| 8 | 26 | Apple HIG (11pt fonts, WCAG AA contrast) |
| 9 | 8 | Track ID bug, stereo buffers, state mutation |
| 10 | 5 | i18n completeness, Dynamic Type defense |
| 11 | 4 | Async rejection, StatusBar, division guard |
| 12 | — | Google Play compliance (privacy policy, permissions) |
| 13 | 4 | Pre-rationale dialogs for all dangerous permissions |
| 14 | 6 | WiFi scanner lifecycle, background pause/resume |
| **Total** | **~230+** | |

### Apple App Store Compliance (10/10)
- Privacy Manifest (PrivacyInfo.xcprivacy) ✅
- All text ≥ 11pt ✅
- WCAG AA 4.5:1 contrast (all 3 themes) ✅
- Touch targets ≥ 44pt ✅
- Dynamic Type defense (tabBarAllowFontScaling) ✅
- NSUsageDescription for all permissions ✅
- No hardcoded English in user-visible UI ✅
- ITSAppUsesNonExemptEncryption: false ✅
- UIBackgroundModes: audio (justified) ✅
- Error boundaries with recovery UI ✅

### Google Play Compliance (14/14)
- Pre-rationale Alert for all dangerous permissions ✅
- RECORD_AUDIO, FINE_LOCATION, BLUETOOTH_SCAN, NEARBY_WIFI_DEVICES ✅
- targetSdkVersion: 35 ✅
- Privacy policy (HTML + in-app link) ✅
- AAB format ✅
- Data Safety: zero data collection ✅
- No analytics/crash reporting SDKs ✅
- Store listing metadata ✅

### Code Quality
- TypeScript strict: 0 errors
- No TODO/FIXME/HACK comments
- No console.log without __DEV__ guard
- No hardcoded credentials
- No unused imports
- No non-null assertions (!)
- Platform isolation: 3-layer guard system

---

## File Structure

```
src/
├── core/
│   ├── audio/
│   │   ├── AudioCapture.ts          — PCM capture + base64 decode
│   │   ├── FFTProcessor.ts          — Cooley-Tukey FFT (pre-allocated)
│   │   ├── MelSpectrogram.ts        — Mel filterbank + MFCC
│   │   ├── AlertToneGenerator.ts    — Warning sound synthesis
│   │   └── VoiceAlertManager.ts     — TTS voice announcements
│   ├── ml/
│   │   ├── ModelManager.ts          — Rule-based classifier (v2.0)
│   │   ├── GaussianClassifier.ts    — Probabilistic ML classifier
│   │   ├── HybridEngine.ts          — Rule + ML fusion engine
│   │   └── AudioClassifier.ts       — Pipeline orchestrator
│   ├── detection/
│   │   ├── ThreatDetector.ts        — Main detection coordinator
│   │   ├── DetectionFusionEngine.ts — Audio + BLE/WiFi fusion
│   │   ├── DOAEstimator.ts          — Direction of Arrival
│   │   └── KalmanFilter2D.ts        — 2D tracking filter
│   ├── ble/
│   │   ├── BLERemoteIDScanner.ts    — BLE ASTM F3411 scanner
│   │   ├── RealBLEAdapter.ts        — react-native-ble-plx bridge
│   │   ├── RemoteIDParser.ts        — ASTM F3411 message decoder
│   │   └── createBLEAdapter.ts      — Factory (Real/Null)
│   ├── wifi/
│   │   ├── WiFiRemoteIDScanner.ts   — WiFi Remote ID scanner
│   │   └── WiFiNativeModule.ts      — Android native bridge
│   ├── sensors/
│   │   ├── EnvironmentDetector.ts   — Indoor/outdoor detection
│   │   └── SensorEnforcementManager.ts — Sensor health monitoring
│   └── DroneDatabase.ts             — Drone model probability DB
├── hooks/
│   ├── useThreatDetector.ts         — Main detection hook
│   ├── useBLEScanner.ts             — BLE scanner hook
│   ├── useWiFiScanner.ts            — WiFi scanner hook (Android)
│   ├── useTheme.ts                  — Theme hook
│   ├── useMapData.ts                — Map marker computation
│   └── useTranslation.ts            — i18n hook
├── stores/
│   ├── detectionStore.ts            — Detection state (Zustand)
│   ├── settingsStore.ts             — User preferences (MMKV)
│   └── historyStore.ts              — Detection history
├── components/
│   ├── radar/TacticalRadar.tsx
│   ├── spectrogram/TacticalSpectrogram.tsx
│   ├── alerts/ThreatAlert.tsx
│   ├── alerts/EnvironmentWarningBanner.tsx
│   ├── scan/ScanButton.tsx
│   ├── scan/ActiveThreatsList.tsx
│   ├── map/DroneMapView.tsx
│   └── TrackingOverlay.tsx
├── constants/
│   ├── theme.ts                     — 3 theme definitions
│   ├── glass.ts                     — Glass design tokens
│   └── micConfig.ts                 — Device profiles
├── i18n/
│   ├── translations.ts              — KO/EN/UK + type definitions
│   └── lang/ (12 files)             — AR, AR_GULF, DE, ES, FR, HE, HI, IT, JA, TL, UR, ZH
└── utils/
    ├── platform.ts                  — Platform utilities
    ├── blePermissions.ts            — BLE permission handler
    └── wifiPermissions.ts           — WiFi permission handler

app/
├── _layout.tsx                      — Root layout + error boundary
├── onboarding.tsx                   — 6-step first-run
└── (tabs)/
    ├── _layout.tsx                  — Tab navigator
    ├── index.tsx                    — Main scan screen
    ├── map.tsx                      — Detection map
    ├── history.tsx                  — Detection history
    ├── settings.tsx                 — App settings
    └── explore.tsx                  — Detection details

store-listing/
├── android/
│   ├── short-description.txt
│   └── full-description.txt
└── privacy-policy.html
```

---

## Deployment Status

| Platform | Build | Submit | Status |
|----------|-------|--------|--------|
| Android | EAS (AAB) | Google Play internal | Ready |
| iOS | EAS (IPA) | TestFlight | Pending Apple Developer account |

---

## Next Steps (v2.0)

- [ ] Android WiFi native module (Java/Kotlin) implementation
- [ ] TFLite/CoreML trained model (replace Gaussian classifier)
- [ ] Spectral subtraction noise preprocessing
- [ ] Native FFT (KissFFT/vDSP) for 10x performance
- [ ] Push notifications for background detection
- [ ] Detection data export (CSV/JSON)
- [ ] Multi-device mesh detection network
