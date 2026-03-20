import { RemoteIDParser, ODID_SERVICE_UUID } from '../src/core/ble/RemoteIDParser';

describe('RemoteIDParser', () => {
  describe('ODID_SERVICE_UUID', () => {
    it('should be FFFA', () => {
      expect(ODID_SERVICE_UUID).toBe('FFFA');
    });
  });

  describe('parseMessage', () => {
    it('should parse Basic ID message (type 0x0)', () => {
      // Build a Basic ID message: byte0=[type=0x0|idType=1], byte1=uaType=2
      const data = new Uint8Array(25);
      data[0] = (0x0 << 4) | 1; // messageType=0 (Basic ID), idType=1
      data[1] = 2; // uaType=2 (Helicopter/Multirotor)
      const serial = 'TEST12345678';
      for (let i = 0; i < serial.length; i++) {
        data[2 + i] = serial.charCodeAt(i);
      }
      const result = RemoteIDParser.parseMessage(data);
      expect(result).not.toBeNull();
      expect(result!.serialNumber).toBe(serial);
      expect(result!.idType).toBe(1);
      expect(result!.uaType).toBe(2);
    });

    it('should parse Location message (type 0x1)', () => {
      const data = new Uint8Array(25);
      data[0] = 0x1 << 4; // messageType=1 (Location)
      data[1] = 0x00; // status
      data[2] = 90; // heading: 90 * 2 = 180 degrees
      data[3] = 40; // speed raw
      data[4] = 73; // vertical speed: (73-63)*0.5 = 5 m/s

      // Latitude: 37.5665 (encoded as int32 LE, 37.5665 * 1e7 = 375665000)
      const latEncoded = Math.round(37.5665 * 1e7);
      data[5] = latEncoded & 0xFF;
      data[6] = (latEncoded >> 8) & 0xFF;
      data[7] = (latEncoded >> 16) & 0xFF;
      data[8] = (latEncoded >> 24) & 0xFF;

      // Longitude: 126.978 (encoded as int32 LE)
      const lonEncoded = Math.round(126.978 * 1e7);
      data[9] = lonEncoded & 0xFF;
      data[10] = (lonEncoded >> 8) & 0xFF;
      data[11] = (lonEncoded >> 16) & 0xFF;
      data[12] = (lonEncoded >> 24) & 0xFF;

      const result = RemoteIDParser.parseMessage(data);
      expect(result).not.toBeNull();
      expect(result!.uavLatitude).toBeCloseTo(37.5665, 3);
      expect(result!.uavLongitude).toBeCloseTo(126.978, 3);
      expect(result!.heading).toBe(180);
      expect(result!.verticalSpeed).toBe(5);
    });

    it('should parse System message (type 0x4)', () => {
      const data = new Uint8Array(25);
      data[0] = 0x4 << 4; // messageType=4 (System)
      data[1] = 0x00;

      // Operator latitude: 37.55 (int32 LE)
      const opLat = Math.round(37.55 * 1e7);
      data[2] = opLat & 0xFF;
      data[3] = (opLat >> 8) & 0xFF;
      data[4] = (opLat >> 16) & 0xFF;
      data[5] = (opLat >> 24) & 0xFF;

      // Operator longitude: 126.97 (int32 LE)
      const opLon = Math.round(126.97 * 1e7);
      data[6] = opLon & 0xFF;
      data[7] = (opLon >> 8) & 0xFF;
      data[8] = (opLon >> 16) & 0xFF;
      data[9] = (opLon >> 24) & 0xFF;

      const result = RemoteIDParser.parseMessage(data);
      expect(result).not.toBeNull();
      expect(result!.operatorLatitude).toBeCloseTo(37.55, 3);
      expect(result!.operatorLongitude).toBeCloseTo(126.97, 3);
    });

    it('should parse Operator ID message (type 0x5)', () => {
      const data = new Uint8Array(25);
      data[0] = 0x5 << 4; // messageType=5 (Operator ID)
      data[1] = 0x00;
      const opId = 'OP-KR-001';
      for (let i = 0; i < opId.length; i++) {
        data[2 + i] = opId.charCodeAt(i);
      }
      const result = RemoteIDParser.parseMessage(data);
      expect(result).not.toBeNull();
      expect(result!.registrationId).toBe(opId);
    });

    it('should return null for empty data', () => {
      const result = RemoteIDParser.parseMessage(new Uint8Array(0));
      expect(result).toBeNull();
    });

    it('should return null for too-short data', () => {
      const result = RemoteIDParser.parseMessage(new Uint8Array(1));
      expect(result).toBeNull();
    });

    it('should return null for unknown message type', () => {
      const data = new Uint8Array(25);
      data[0] = 0x3 << 4; // Unknown type 3
      const result = RemoteIDParser.parseMessage(data);
      expect(result).toBeNull();
    });
  });

  describe('parseMessagePack', () => {
    it('should parse single message as pack', () => {
      const data = new Uint8Array(25);
      data[0] = (0x0 << 4) | 1;
      data[1] = 2;
      const serial = 'PACK1';
      for (let i = 0; i < serial.length; i++) data[2 + i] = serial.charCodeAt(i);

      const results = RemoteIDParser.parseMessagePack(data);
      expect(results.length).toBe(1);
      expect(results[0].serialNumber).toBe(serial);
    });

    it('should return empty for empty data', () => {
      expect(RemoteIDParser.parseMessagePack(new Uint8Array(0))).toEqual([]);
    });
  });

  describe('mergeMessages', () => {
    it('should merge multiple partial results', () => {
      const parts = [
        { serialNumber: 'SN123', idType: 1 as const },
        { uavLatitude: 37.5, uavLongitude: 126.9, heading: 90 },
        { operatorLatitude: 37.4, operatorLongitude: 126.8 },
      ];
      const merged = RemoteIDParser.mergeMessages(parts);
      expect(merged.serialNumber).toBe('SN123');
      expect(merged.uavLatitude).toBe(37.5);
      expect(merged.heading).toBe(90);
      expect(merged.operatorLatitude).toBe(37.4);
      expect(merged.lastSeen).toBeDefined();
    });
  });

  describe('getUATypeName', () => {
    it('should return correct name for known types', () => {
      expect(RemoteIDParser.getUATypeName(0)).toBe('Undeclared');
      expect(RemoteIDParser.getUATypeName(1)).toBe('Aeroplane');
      expect(RemoteIDParser.getUATypeName(2)).toBe('Helicopter/Multirotor');
      expect(RemoteIDParser.getUATypeName(15)).toBe('Other');
    });

    it('should return Unknown for invalid types', () => {
      expect(RemoteIDParser.getUATypeName(99)).toBe('Unknown');
    });
  });
});
