/**
 * Manually-triggered recording activity.
 */
import Activity from './Activity';
import { Metadata } from '../main/types';
import { VideoCategory } from '../types/VideoCategory';

export default class Manual extends Activity {
  constructor(startDate: Date) {
    super(startDate, VideoCategory.Manual);
    this._overrun = 0;
  }

  getFileName(): string {
    return `Manual Recording`;
  }

  getMetadata(): Metadata {
    return {
      category: this.category,
      result: true,
      duration: this.duration,
      deaths: [],
      combatants: [],
      overrun: this.overrun,
      date: this.startDate.getTime(),
      uniqueHash: this.getUniqueHash(),
    };
  }
}
