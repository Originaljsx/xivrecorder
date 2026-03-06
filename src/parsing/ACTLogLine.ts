/**
 * Parser for IINACT network log lines.
 *
 * IINACT network log format:
 *   DecimalType|ISO8601Timestamp|field1|field2|...|hash
 *
 * Example:
 *   01|2026-03-06T10:31:51.9220000-08:00|40A|Cloud Nine|595002a1bfbea018
 *
 * Fields are pipe-delimited. The first field is the decimal event type,
 * the second is an ISO 8601 timestamp, and the last is a hash.
 */
export default class ACTLogLine {
  private fields: string[];

  /** Decimal event type (e.g. 1 for ChangeZone, 3 for AddCombatant). */
  public readonly type: number;

  /** Parsed timestamp. */
  public readonly timestamp: Date;

  constructor(public readonly raw: string) {
    this.fields = raw.split('|');
    this.type = parseInt(this.fields[0], 10);
    this.timestamp = new Date(this.fields[1]);
  }

  /**
   * Get a data field by index. Index 0 is the first field after the
   * timestamp (i.e. fields[2] in the raw split).
   */
  field(index: number): string {
    return this.fields[index + 2] ?? '';
  }

  /**
   * Get a data field parsed as a hex integer.
   */
  fieldHex(index: number): number {
    return parseInt(this.field(index), 16) || 0;
  }

  /**
   * Get a data field parsed as a decimal integer.
   */
  fieldInt(index: number): number {
    return parseInt(this.field(index), 10) || 0;
  }

  /**
   * Get a data field parsed as a float.
   */
  fieldFloat(index: number): number {
    return parseFloat(this.field(index)) || 0;
  }

  /**
   * Total number of data fields (excluding type, timestamp, and hash).
   */
  get dataFieldCount(): number {
    // fields[0] = type, fields[1] = timestamp, fields[last] = hash
    return Math.max(0, this.fields.length - 3);
  }

  toString(): string {
    return this.raw;
  }
}
