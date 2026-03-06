/**
 * Base class for log handlers.
 *
 * Manages the activity lifecycle state machine:
 *   - startActivity(activity): begins recording
 *   - endActivity(): cleanly ends the current activity
 *   - forceEndActivity(): forcefully ends (e.g. on zone out)
 *
 * Adapted from wow-recorder's LogHandler.ts, simplified to remove
 * Flavour abstraction and WoW-specific event handling.
 */
import { EventEmitter } from 'events';
import Activity from '../activitys/Activity';

export default abstract class LogHandler extends EventEmitter {
  /** The currently active recording activity, if any. */
  static activity: Activity | undefined;

  /** Whether we're in the overrun period after an activity ends. */
  static overrunning = false;

  /**
   * Start recording a new activity.
   */
  static startActivity(activity: Activity) {
    if (LogHandler.activity) {
      console.warn(
        '[LogHandler] startActivity called while activity already active, forcing end',
      );
      LogHandler.forceEndActivity();
    }

    console.info(
      '[LogHandler] Starting activity:',
      activity.category,
      activity.zoneID,
    );

    LogHandler.activity = activity;
    LogHandler.overrunning = false;
  }

  /**
   * End the current activity cleanly.
   */
  static endActivity() {
    if (!LogHandler.activity) {
      console.warn('[LogHandler] endActivity called with no active activity');
      return;
    }

    console.info(
      '[LogHandler] Ending activity:',
      LogHandler.activity.category,
    );

    LogHandler.overrunning = true;

    // After the overrun period, clear the activity.
    const overrunMs = (LogHandler.activity.overrun || 0) * 1000;

    setTimeout(() => {
      LogHandler.overrunning = false;
      LogHandler.activity = undefined;
    }, overrunMs);
  }

  /**
   * Force end the current activity (e.g. zone change away from arena).
   */
  static forceEndActivity(timeDelta?: number) {
    if (!LogHandler.activity) {
      console.warn(
        '[LogHandler] forceEndActivity called with no active activity',
      );
      return;
    }

    console.info(
      '[LogHandler] Force ending activity:',
      LogHandler.activity.category,
    );

    const endDate = new Date();

    if (timeDelta !== undefined) {
      endDate.setTime(endDate.getTime() - timeDelta * 1000);
    }

    LogHandler.activity.end(endDate, LogHandler.activity.result);
    LogHandler.overrunning = false;
    LogHandler.activity = undefined;
  }

  /**
   * Whether an activity is currently being recorded.
   */
  static isActivityInProgress(): boolean {
    return LogHandler.activity !== undefined;
  }
}
