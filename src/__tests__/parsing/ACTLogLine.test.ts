import ACTLogLine from '../../parsing/ACTLogLine';

describe('ACTLogLine', () => {
  describe('ChangeZone (type 01)', () => {
    const raw =
      '01|2026-03-06T10:31:51.9220000-08:00|40A|Cloud Nine|595002a1bfbea018';
    const line = new ACTLogLine(raw);

    it('parses the event type', () => {
      expect(line.type).toBe(1);
    });

    it('parses the timestamp', () => {
      expect(line.timestamp).toBeInstanceOf(Date);
      expect(line.timestamp.getFullYear()).toBe(2026);
      expect(line.timestamp.getMonth()).toBe(2); // March = 2
      expect(line.timestamp.getDate()).toBe(6);
    });

    it('extracts data fields by index', () => {
      expect(line.field(0)).toBe('40A');
      expect(line.field(1)).toBe('Cloud Nine');
    });

    it('parses hex field', () => {
      expect(line.fieldHex(0)).toBe(0x40a);
    });

    it('reports correct data field count', () => {
      // 40A, Cloud Nine, hash = 3 fields, but hash is excluded = 2
      expect(line.dataFieldCount).toBe(2);
    });
  });

  describe('ChangePrimaryPlayer (type 02)', () => {
    const raw =
      '02|2026-03-06T10:31:51.9220000-08:00|1032524C|Hinanawi Tenshi|8d2cd4a564bd801b';
    const line = new ACTLogLine(raw);

    it('parses type 02', () => {
      expect(line.type).toBe(2);
    });

    it('extracts entity ID and name', () => {
      expect(line.field(0)).toBe('1032524C');
      expect(line.field(1)).toBe('Hinanawi Tenshi');
    });
  });

  describe('AddCombatant (type 03)', () => {
    const raw =
      '03|2026-03-06T10:31:51.9220000-08:00|1032524C|Hinanawi Tenshi|1E|52|0000|2E|Fenrir|0|0|60000|60000|10000|10000|||92.33|-88.18|12.00|-0.00|0b09cd8dc54a3cb6';
    const line = new ACTLogLine(raw);

    it('parses type 03', () => {
      expect(line.type).toBe(3);
    });

    it('extracts entity ID', () => {
      expect(line.field(0)).toBe('1032524C');
    });

    it('extracts player name', () => {
      expect(line.field(1)).toBe('Hinanawi Tenshi');
    });

    it('extracts job ID as hex', () => {
      expect(line.field(2)).toBe('1E');
      expect(line.fieldHex(2)).toBe(0x1e); // NIN
    });

    it('extracts world name', () => {
      expect(line.field(6)).toBe('Fenrir');
    });

    it('extracts position X as float', () => {
      // posX is at field index 15 (after two empty fields at 13,14)
      expect(line.fieldFloat(15)).toBeCloseTo(92.33, 1);
    });

    it('extracts position Y as float', () => {
      expect(line.fieldFloat(16)).toBeCloseTo(-88.18, 1);
    });
  });

  describe('ActorControl (type 33)', () => {
    const raw =
      '33|2026-03-06T10:32:24.7860000-08:00|80039C5D|40000001|12C|00|00|00|7efaaf875d78b5bd';
    const line = new ACTLogLine(raw);

    it('parses type 33', () => {
      expect(line.type).toBe(33);
    });

    it('extracts command as hex', () => {
      expect(line.fieldHex(1)).toBe(0x40000001); // COMMENCE
    });

    it('extracts data field as hex', () => {
      expect(line.fieldHex(2)).toBe(0x12c); // 300 seconds
    });
  });

  describe('edge cases', () => {
    it('returns empty string for missing fields', () => {
      const line = new ACTLogLine('01|2026-03-06T10:00:00.000-08:00|hash');
      expect(line.field(99)).toBe('');
    });

    it('returns 0 for non-numeric hex fields', () => {
      const line = new ACTLogLine(
        '01|2026-03-06T10:00:00.000-08:00|Hello World|hash',
      );
      // "Hello World" has no valid hex prefix, so parseInt returns NaN → 0
      expect(line.fieldHex(0)).toBe(0);
    });

    it('preserves raw string', () => {
      const raw = '01|2026-03-06T10:00:00.000-08:00|40A|Cloud Nine|hash';
      const line = new ACTLogLine(raw);
      expect(line.toString()).toBe(raw);
    });
  });
});
