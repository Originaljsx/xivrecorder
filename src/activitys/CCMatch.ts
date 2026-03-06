/**
 * Crystalline Conflict match activity.
 */
import Activity from './Activity';
import { Metadata } from '../main/types';
import { VideoCategory } from '../types/VideoCategory';
import { ccTerritories, ccCustomIds } from '../main/constants';

export default class CCMatch extends Activity {
  private _zoneName: string;

  constructor(startDate: Date, zoneId: number) {
    super(startDate, VideoCategory.CrystallineConflict);
    this._zoneID = zoneId;
    this._zoneName = ccTerritories[zoneId] || 'Unknown Arena';
    // Small overrun to capture post-match animations/results screen.
    this._overrun = 3;
  }

  get zoneName(): string {
    return this._zoneName;
  }

  /**
   * Whether this is a custom match (vs ranked/casual).
   */
  get isCustom(): boolean {
    return this._zoneID !== undefined && ccCustomIds.has(this._zoneID);
  }

  getFileName(): string {
    const playerName = this.playerEntityId
      ? this.combatantMap.get(this.playerEntityId)?.name || 'Unknown'
      : 'Unknown';

    const matchType = this.isCustom ? 'Custom CC' : 'CC Match';
    return `${playerName} - ${this._zoneName} - ${matchType}`;
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
      uniqueHash: this.getUniqueHash(),
    };
  }
}
