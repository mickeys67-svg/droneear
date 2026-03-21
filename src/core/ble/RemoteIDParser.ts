/**
 * Remote ID Parser — ASTM F3411 / ASD-STAN EN 4709-002
 *
 * Decodes BLE advertising packets containing Open Drone ID messages.
 * Supports 4 message types:
 *   0x0 — Basic ID (serial number, UA type)
 *   0x1 — Location/Vector (lat, lon, alt, speed, heading)
 *   0x4 — System (operator location, area info)
 *   0x5 — Operator ID (operator registration string)
 *
 * Reference: ASTM F3411-22a, Section 7 (Message Pack encoding)
 */

import type { RemoteIDData, UAType, RemoteIDType } from '../../types';

// ===== ASTM F3411 Constants =====

/** Open Drone ID BLE service UUID (16-bit) */
export const ODID_SERVICE_UUID = 'FFFA';

/** Message type codes (first 4 bits of byte 0) */
const MSG_BASIC_ID = 0x0;
const MSG_LOCATION = 0x1;
const MSG_SYSTEM = 0x4;
const MSG_OPERATOR_ID = 0x5;

/** Invalid coordinate sentinel */
const INVALID_LAT_LON = 0;
const INVALID_ALT = -1000;

// ===== Parser =====

export class RemoteIDParser {
  /**
   * Parse a single Open Drone ID message from raw bytes.
   * Returns partial RemoteIDData (caller should merge with existing state).
   */
  static parseMessage(data: Uint8Array): Partial<RemoteIDData> | null {
    if (!data || data.length < 2) return null;

    const msgType = (data[0] >> 4) & 0x0F;

    switch (msgType) {
      case MSG_BASIC_ID:
        return this.parseBasicID(data);
      case MSG_LOCATION:
        return this.parseLocation(data);
      case MSG_SYSTEM:
        return this.parseSystem(data);
      case MSG_OPERATOR_ID:
        return this.parseOperatorID(data);
      default:
        return null; // Unknown message type — skip
    }
  }

  /**
   * Parse a Message Pack (multiple messages concatenated).
   * ASTM F3411 allows packing up to 10 messages in a single advertisement.
   */
  static parseMessagePack(data: Uint8Array): Partial<RemoteIDData>[] {
    if (!data || data.length < 2) return [];

    const results: Partial<RemoteIDData>[] = [];
    const msgSize = 25; // Standard ODID message size

    // Message pack starts with header byte (0xF) + count
    const headerType = (data[0] >> 4) & 0x0F;
    if (headerType === 0xF && data.length >= 2) {
      const msgCount = data[1];
      for (let i = 0; i < msgCount; i++) {
        const offset = 2 + i * msgSize;
        if (offset + msgSize > data.length) break;
        const msg = data.slice(offset, offset + msgSize);
        const parsed = this.parseMessage(msg);
        if (parsed) results.push(parsed);
      }
    } else {
      // Single message (not a pack)
      const parsed = this.parseMessage(data);
      if (parsed) results.push(parsed);
    }

    return results;
  }

  /**
   * Merge multiple partial RemoteIDData into a single complete record.
   */
  static mergeMessages(parts: Partial<RemoteIDData>[]): RemoteIDData {
    const merged: RemoteIDData = {};
    for (const part of parts) {
      // Only assign defined values to avoid overwriting valid data with undefined
      for (const [key, value] of Object.entries(part)) {
        if (value !== undefined) {
          (merged as any)[key] = value;
        }
      }
    }
    merged.lastSeen = Date.now();
    return merged;
  }

  // ===== Message Type Parsers =====

  /**
   * Basic ID Message (0x0) — 25 bytes
   * Byte 0: [type:4][idType:4]
   * Byte 1: uaType
   * Bytes 2-21: UAS ID (20 chars, null-padded ASCII)
   */
  private static parseBasicID(data: Uint8Array): Partial<RemoteIDData> | null {
    if (data.length < 22) return null;

    const idType = data[0] & 0x0F;
    const uaType = data[1] as UAType;
    const idBytes = data.slice(2, 22);
    const serialNumber = this.decodeASCII(idBytes);

    return {
      idType: idType as RemoteIDType,
      uaType,
      serialNumber: serialNumber || undefined,
    };
  }

  /**
   * Location/Vector Message (0x1) — 25 bytes
   * Contains: status, direction, speed, vertical speed, lat, lon, altitude
   */
  private static parseLocation(data: Uint8Array): Partial<RemoteIDData> | null {
    if (data.length < 18) return null;

    // Byte 1: status (operational status)
    // Byte 2: direction (heading in degrees / 2, so 0-179 = 0-358°)
    const headingRaw = data[2];
    const heading = headingRaw <= 179 ? headingRaw * 2 : undefined;

    // Byte 3: speed in 0.25 m/s units (multiplier in high bit)
    const speedMultiplier = (data[3] & 0x80) ? 0.75 : 0.25;
    const speedRaw = data[3] & 0x7F;
    const speed = speedRaw < 127 ? speedRaw * speedMultiplier + ((data[3] & 0x80) ? 31.75 : 0) : undefined;

    // Byte 4: vertical speed in 0.5 m/s, offset by 63
    const vsRaw = data[4];
    const verticalSpeed = vsRaw < 126 ? (vsRaw - 63) * 0.5 : undefined;

    // Bytes 5-8: latitude (int32, 1e-7 degrees)
    const latRaw = this.readInt32LE(data, 5);
    const uavLatitude = latRaw !== 0 ? latRaw / 1e7 : undefined;

    // Bytes 9-12: longitude (int32, 1e-7 degrees)
    const lonRaw = this.readInt32LE(data, 9);
    const uavLongitude = lonRaw !== 0 ? lonRaw / 1e7 : undefined;

    // Bytes 13-14: pressure altitude (uint16, 0.5m steps, offset -1000m)
    const altRaw = this.readUint16LE(data, 13);
    const uavAltitude = altRaw !== 0xFFFF ? altRaw * 0.5 - 1000 : undefined;

    return {
      heading,
      speed,
      verticalSpeed,
      uavLatitude,
      uavLongitude,
      uavAltitude,
    };
  }

  /**
   * System Message (0x4) — 25 bytes
   * Contains: operator location, area count, area radius
   */
  private static parseSystem(data: Uint8Array): Partial<RemoteIDData> | null {
    if (data.length < 18) return null;

    // Bytes 2-5: operator latitude (int32, 1e-7 degrees)
    const opLatRaw = this.readInt32LE(data, 2);
    const operatorLatitude = opLatRaw !== 0 ? opLatRaw / 1e7 : undefined;

    // Bytes 6-9: operator longitude (int32, 1e-7 degrees)
    const opLonRaw = this.readInt32LE(data, 6);
    const operatorLongitude = opLonRaw !== 0 ? opLonRaw / 1e7 : undefined;

    return {
      operatorLatitude,
      operatorLongitude,
    };
  }

  /**
   * Operator ID Message (0x5) — 25 bytes
   * Contains: operator ID type + 20-char ASCII ID
   */
  private static parseOperatorID(data: Uint8Array): Partial<RemoteIDData> | null {
    if (data.length < 22) return null;

    // Byte 1: operator ID type
    const idBytes = data.slice(2, 22);
    const registrationId = this.decodeASCII(idBytes);

    return {
      registrationId: registrationId || undefined,
    };
  }

  // ===== Utility =====

  private static decodeASCII(bytes: Uint8Array): string {
    let str = '';
    for (let i = 0; i < bytes.length; i++) {
      if (bytes[i] === 0) break;
      str += String.fromCharCode(bytes[i]);
    }
    return str.trim();
  }

  private static readInt32LE(data: Uint8Array, offset: number): number {
    if (offset + 4 > data.length) return 0;
    return (
      data[offset] |
      (data[offset + 1] << 8) |
      (data[offset + 2] << 16) |
      (data[offset + 3] << 24)
    );
  }

  private static readUint16LE(data: Uint8Array, offset: number): number {
    if (offset + 2 > data.length) return 0xFFFF;
    return data[offset] | (data[offset + 1] << 8);
  }

  /**
   * Get human-readable UA type name.
   */
  static getUATypeName(uaType: number): string {
    const names: Record<number, string> = {
      0: 'Undeclared',
      1: 'Aeroplane',
      2: 'Helicopter/Multirotor',
      3: 'Gyroplane',
      4: 'Hybrid Lift (VTOL)',
      5: 'Ornithopter',
      6: 'Glider',
      7: 'Kite',
      8: 'Free Balloon',
      9: 'Captive Balloon',
      10: 'Airship',
      11: 'Parachute',
      12: 'Rocket',
      13: 'Tethered Aircraft',
      14: 'Ground Obstacle',
      15: 'Other',
    };
    return names[uaType] || 'Unknown';
  }
}
