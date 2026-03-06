/**
 * Base class for all recorded activities.
 * Adapted from wow-recorder's Activity.ts, removing Flavour abstraction.
 */
import crypto from 'crypto';
import { PlayerDeathType, Metadata } from '../main/types';
import Combatant from '../main/Combatant';
import { VideoCategory } from '../types/VideoCategory';

export default abstract class Activity {
  protected _category: VideoCategory;
  protected _result: boolean;
  protected _combatantMap: Map<string, Combatant>;
  protected _startDate: Date;
  protected _deaths: PlayerDeathType[];
  protected _endDate?: Date;
  protected _zoneID?: number;
  protected _playerEntityId?: string;
  protected _overrun: number = 0;

  constructor(startDate: Date, category: VideoCategory) {
    this._result = false;
    this._combatantMap = new Map();
    this._startDate = startDate;
    this._category = category;
    this._deaths = [];
  }

  abstract getMetadata(): Metadata;
  abstract getFileName(): string;

  get category() {
    return this._category;
  }

  set category(value: VideoCategory) {
    this._category = value;
  }

  get result() {
    return this._result;
  }

  set result(value: boolean) {
    this._result = value;
  }

  get combatantMap() {
    return this._combatantMap;
  }

  get startDate() {
    return this._startDate;
  }

  set startDate(value: Date) {
    this._startDate = value;
  }

  get endDate() {
    return this._endDate;
  }

  set endDate(value: Date | undefined) {
    this._endDate = value;
  }

  get zoneID() {
    return this._zoneID;
  }

  set zoneID(value: number | undefined) {
    this._zoneID = value;
  }

  get playerEntityId() {
    return this._playerEntityId;
  }

  set playerEntityId(value: string | undefined) {
    this._playerEntityId = value;
  }

  get overrun() {
    return this._overrun;
  }

  set overrun(value: number) {
    this._overrun = value;
  }

  get deaths() {
    return this._deaths;
  }

  /**
   * Duration in seconds.
   */
  get duration(): number {
    if (!this.endDate) {
      throw new Error('Failed to get duration of in-progress activity');
    }

    const baseDuration =
      (this.endDate.getTime() - this.startDate.getTime()) / 1000;
    return baseDuration + this.overrun;
  }

  /**
   * Get the player's combatant record.
   */
  get player(): Combatant {
    if (!this.playerEntityId) {
      throw new Error(
        'Failed to get player combatant, playerEntityId not set',
      );
    }

    const player = this.getCombatant(this.playerEntityId);

    if (!player) {
      throw new Error('Player not found in combatants');
    }

    return player;
  }

  /**
   * End the activity with a result.
   */
  end(endDate: Date, result: boolean) {
    this.endDate = endDate;
    this.result = result;
  }

  getCombatant(entityId: string): Combatant | undefined {
    return this.combatantMap.get(entityId);
  }

  addCombatant(combatant: Combatant) {
    this.combatantMap.set(combatant.entityId, combatant);
  }

  addDeath(death: PlayerDeathType) {
    this.deaths.push(death);
  }

  /**
   * Generate a unique hash for deduplication.
   */
  getUniqueHash(): string {
    const deterministicFields = [this.category, this.result].map((f) =>
      f.toString(),
    );

    const sortedNames: string[] = [];
    Array.from(this.combatantMap.values())
      .map((c) => c.name)
      .sort()
      .forEach((name) => {
        if (name) sortedNames.push(name);
      });

    const uniqueString =
      deterministicFields.join(' ') + sortedNames.join(' ');

    // Create a fresh hash each time since digest() can only be called once.
    return crypto.createHash('md5').update(uniqueString).digest('hex');
  }
}
