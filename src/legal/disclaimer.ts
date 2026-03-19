/**
 * DroneEar Legal Disclaimer
 *
 * This module contains all legal disclaimer text used throughout the app.
 * English source strings — the i18n system handles translations.
 */

export const LEGAL_VERSION = '1.0.0';

export const DISCLAIMER = {
  title: 'Disclaimer & Limitations',

  body: `DroneEar is an acoustic pattern analysis tool designed for informational and reference purposes only. It is NOT a security system, defense system, radar, or surveillance device.

This app estimates similar drone types by analyzing sound characteristics captured through your device's microphone. All results represent statistical pattern matches against a reference library of acoustic signatures and may not accurately reflect the actual aircraft or object producing the sound.

IMPORTANT LIMITATIONS:

1. ESTIMATION ONLY — All identifications are probabilistic estimates based on acoustic patterns. They are not definitive identifications of any specific aircraft, drone, or other object.

2. NO GUARANTEED DETECTION — The app does not guarantee detection of any specific aircraft, drone, or airborne object. Environmental conditions, device hardware, background noise, distance, and many other factors may affect results.

3. NO INTENT OR THREAT ASSESSMENT — The app makes no determination whatsoever about the purpose, intent, operator, legality, or danger level of any detected or undetected aircraft.

4. NOT FOR SAFETY-CRITICAL USE — Do not rely on this app for any safety-critical, security-critical, or life-safety decisions. This includes but is not limited to decisions regarding personal safety, property protection, airspace security, or emergency response.

5. LIMITATION OF LIABILITY — The developers, contributors, and distributors of DroneEar accept no liability for:
   - Failed, missed, or delayed detections
   - Incorrect, inaccurate, or misleading pattern classifications
   - Any actions taken or decisions made based on app output
   - Any direct, indirect, incidental, consequential, or special damages arising from the use of, or inability to use, this application

By using DroneEar, you acknowledge and accept these limitations in full.`,

  shortNotice:
    'DroneEar is an acoustic pattern estimation tool for reference purposes only. Results are probabilistic and may not reflect actual aircraft. Do not use for safety-critical decisions. See full disclaimer for details.',

  resultDisclaimer:
    'This result is a probabilistic acoustic pattern match for reference only. It does not confirm the identity, intent, or threat level of any aircraft.',
} as const;

export type DisclaimerKeys = keyof typeof DISCLAIMER;
