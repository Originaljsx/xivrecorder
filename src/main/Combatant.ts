/**
 * Represents an FFXIV combatant parsed from IINACT AddCombatant (type 03)
 * log lines.
 */
import { RawCombatant } from './types';

export default class Combatant {
  private _entityId: string;
  private _name?: string;
  private _jobId?: number;
  private _level?: number;
  private _worldName?: string;
  private _teamId?: number;

  constructor(entityId: string) {
    this._entityId = entityId;
  }

  get entityId() {
    return this._entityId;
  }

  set entityId(value: string) {
    this._entityId = value;
  }

  get name() {
    return this._name;
  }

  set name(value: string | undefined) {
    this._name = value;
  }

  get jobId() {
    return this._jobId;
  }

  set jobId(value: number | undefined) {
    this._jobId = value;
  }

  get level() {
    return this._level;
  }

  set level(value: number | undefined) {
    this._level = value;
  }

  get worldName() {
    return this._worldName;
  }

  set worldName(value: string | undefined) {
    this._worldName = value;
  }

  get teamId() {
    return this._teamId;
  }

  set teamId(value: number | undefined) {
    this._teamId = value;
  }

  /**
   * Whether this combatant has enough data to be meaningful.
   */
  isFullyDefined(): boolean {
    return (
      this._name !== undefined &&
      this._jobId !== undefined &&
      this._teamId !== undefined
    );
  }

  /**
   * Serialize to a plain object for metadata storage.
   */
  getRaw(): RawCombatant {
    const raw: RawCombatant = { _entityId: this._entityId };
    if (this._name !== undefined) raw._name = this._name;
    if (this._jobId !== undefined) raw._jobId = this._jobId;
    if (this._level !== undefined) raw._level = this._level;
    if (this._worldName !== undefined) raw._worldName = this._worldName;
    if (this._teamId !== undefined) raw._teamId = this._teamId;
    return raw;
  }
}
