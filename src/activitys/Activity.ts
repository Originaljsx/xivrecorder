import crypto from 'crypto';
import { PlayerDeathType, Metadata } from '../main/types';
import Combatant from '../main/Combatant';
import { VideoCategory } from '../types/VideoCategory';

/**
 * Abstract activity class.
 */
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

  get zoneID() {
    return this._zoneID;
  }

  set zoneID(zoneID) {
    this._zoneID = zoneID;
  }

  get category() {
    return this._category;
  }

  set category(category) {
    this._category = category;
  }

  get startDate() {
    return this._startDate;
  }

  set startDate(date) {
    this._startDate = date;
  }

  get result() {
    return this._result;
  }

  set result(result) {
    this._result = result;
  }

  get deaths() {
    return this._deaths;
  }

  get playerEntityId() {
    return this._playerEntityId;
  }

  set playerEntityId(id) {
    this._playerEntityId = id;
  }

  get endDate() {
    return this._endDate;
  }

  set endDate(date) {
    this._endDate = date;
  }

  get combatantMap() {
    return this._combatantMap;
  }

  set combatantMap(cm) {
    this._combatantMap = cm;
  }

  get overrun() {
    return this._overrun;
  }

  set overrun(s) {
    console.info('[Activity] Setting overrun to', s);
    this._overrun = s;
  }

  get duration() {
    if (!this.endDate) {
      throw new Error('Failed to get duration of in-progress activity');
    }

    const baseDuration =
      (this.endDate.getTime() - this.startDate.getTime()) / 1000;

    return baseDuration + this.overrun;
  }

  get player() {
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

  end(endDate: Date, result: boolean) {
    this.endDate = endDate;
    this.result = result;
  }

  getCombatant(entityId: string) {
    return this.combatantMap.get(entityId);
  }

  addCombatant(combatant: Combatant) {
    this.combatantMap.set(combatant.entityId, combatant);
  }

  addDeath(death: PlayerDeathType) {
    this.deaths.push(death);
  }

  /**
   * Gets fields from the metadata that are deterministic and hashes them.
   * This is used to correlate videos; deliberately excludes fields that
   * vary from player to player.
   */
  getUniqueHash(): string {
    const deterministicFields = [this.category, this.result].map((f) =>
      f.toString(),
    );

    const sortedNames: string[] = [];

    Array.from(this.combatantMap.values())
      .map((combatant) => combatant.name)
      .sort()
      .forEach((name) => {
        if (name) sortedNames.push(name);
      });

    const uniqueString = deterministicFields.join(' ') + sortedNames.join(' ');

    // Create a fresh hash each time since digest() can only be called once.
    return crypto.createHash('md5').update(uniqueString).digest('hex');
  }
}
