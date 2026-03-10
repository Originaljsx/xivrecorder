/**
 * Raid/trial encounter pull activity.
 *
 * Each pull (combat engagement to wipe or kill) is a separate activity.
 */
import Activity from './Activity';
import { Metadata } from '../main/types';
import { VideoCategory } from '../types/VideoCategory';

export default class RaidEncounter extends Activity {
  private _zoneName: string;
  private _pullNumber: number;

  constructor(
    startDate: Date,
    zoneId: number,
    zoneName: string,
    pullNumber: number,
  ) {
    super(startDate, VideoCategory.Raids);
    this._zoneID = zoneId;
    this._zoneName = zoneName;
    this._pullNumber = pullNumber;
    // 2-second overrun to capture the moment of kill/wipe.
    this._overrun = 2;
    // 5-second pre-pull buffer for positioning/countdown context.
    this._bufferSeconds = 5;
  }

  get zoneName(): string {
    return this._zoneName;
  }

  get pullNumber(): number {
    return this._pullNumber;
  }

  getFileName(): string {
    const playerName = this.playerEntityId
      ? this.combatantMap.get(this.playerEntityId)?.name || 'Unknown'
      : 'Unknown';

    return `${playerName} - ${this._zoneName} - Pull ${this._pullNumber}`;
  }

  getMetadata(): Metadata {
    const combatants = Array.from(this.combatantMap.values()).map((c) =>
      c.getRaw(),
    );

    const playerCombatant = this.playerEntityId
      ? this.combatantMap.get(this.playerEntityId)
      : undefined;

    return {
      category: this.category,
      zoneID: this.zoneID,
      zoneName: this._zoneName,
      result: this.result,
      duration: this.duration,
      deaths: this.deaths,
      combatants,
      player: playerCombatant?.getRaw(),
      overrun: this.overrun,
      date: this.startDate.getTime(),
      tag: `Pull ${this._pullNumber}`,
      uniqueHash: this.getUniqueHash(),
    };
  }
}
