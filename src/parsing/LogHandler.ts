import VideoProcessQueue from '../main/VideoProcessQueue';
import ConfigService from '../config/ConfigService';
import Recorder from '../main/Recorder';
import {
  PlayerDeathType,
  SoundAlerts,
  VideoQueueItem,
} from '../main/types';
import Activity from '../activitys/Activity';
import { VideoCategory } from '../types/VideoCategory';
import { allowRecordCategory } from '../utils/configUtils';
import { assert } from 'console';
import Manual from 'activitys/Manual';
import { playSoundAlert } from 'main/main';
import Poller from 'utils/Poller';
import { emitErrorReport } from 'main/util';

/**
 * LogHandler base class. Provides the activity lifecycle management and
 * recording integration. Game-specific log watching and event handling
 * is implemented in subclasses (e.g. FFXIVLogHandler).
 *
 * Static fields provide locking — we only allow one concurrent activity.
 */
export default class LogHandler {
  public static activity: Activity | undefined;

  public static overrunning = false;

  private static stateChangeCallback: () => void;

  public static setStateChangeCallback = (
    cb: typeof LogHandler.stateChangeCallback,
  ) => {
    this.stateChangeCallback = cb;
  };

  /**
   * Check if an activity is currently in progress.
   */
  public static isActivityInProgress(): boolean {
    return LogHandler.activity !== undefined;
  }

  /**
   * Start recording for the given activity.
   */
  public static async startActivity(activity: Activity) {
    const { category } = activity;
    const allowed = allowRecordCategory(ConfigService.getInstance(), category);

    if (!allowed) {
      console.info('[LogHandler] Not configured to record', category);
      return;
    }

    console.info(
      `[LogHandler] Start recording a video for category: ${category}`,
    );

    // Offset is the number of seconds to cut back into the buffer. That way
    // the buffer length is irrelevant. It is physically impossible to have
    // a negative offset. That would mean an activity started in the future.
    const offset = (Date.now() - activity.startDate.getTime()) / 1000;
    console.info(`[LogHandler] Calculated offset seconds`, offset);
    assert(offset >= 0);

    try {
      LogHandler.activity = activity;
      await Recorder.getInstance().startRecording(offset);
      LogHandler.stateChangeCallback();
    } catch (error) {
      console.error('[LogHandler] Error starting activity', String(error));
      LogHandler.activity = undefined;
    }
  }

  /**
   * End the recording after the overrun has elapsed. Every single activity
   * ending comes through this function.
   */
  public static async endActivity() {
    if (!LogHandler.activity) {
      console.error("[LogHandler] No active activity so can't stop");
      return;
    }

    console.info(
      `[LogHandler] Ending recording video for category: ${LogHandler.activity.category}`,
    );

    // It's important we clear the activity before we call stop as stop will
    // await for the overrun, and we might do weird things if the player
    // immediately starts a new activity while we're awaiting. See issue 291.
    const lastActivity = LogHandler.activity;
    LogHandler.overrunning = true;
    LogHandler.activity = undefined;

    const { overrun } = lastActivity;

    if (overrun > 0) {
      console.info('[LogHandler] Awaiting overrun:', overrun);
      LogHandler.stateChangeCallback();
      await new Promise((resolve) => setTimeout(resolve, 1000 * overrun));
      console.info('[LogHandler] Done awaiting overrun');
    }

    LogHandler.overrunning = false;
    const recorder = Recorder.getInstance();
    const poller = Poller.getInstance();

    let videoFile;

    const stopPromise = recorder.stop(); // Queue the stop.
    const ffxivRunning = poller.isFFXIVRunning();

    if (ffxivRunning) {
      // Immediately queue the buffer start so it's ready if we go instantly into another activity.
      console.info('[LogHandler] Queue buffer start as FFXIV still running');
      recorder.startBuffer(); // No assignment, we don't care about when it's done.
    }

    try {
      // Now await the stop so we get the file from the recorder.
      await stopPromise;
      videoFile = recorder.getAndClearLastFile();
    } catch (error) {
      console.error(
        '[LogHandler] Failed to stop recording, discarding video',
        error,
      );

      const report =
        'Failed to stop recording, discarding: ' + lastActivity.getFileName();
      emitErrorReport(report);

      return;
    }

    if (!videoFile) {
      console.error('[LogHandler] No video file available');

      const report =
        'No video file produced, discarding: ' + lastActivity.getFileName();
      emitErrorReport(report);

      return;
    }

    try {
      const metadata = lastActivity.getMetadata();
      const { duration } = metadata;
      const suffix = lastActivity.getFileName();

      const queueItem: VideoQueueItem = {
        source: videoFile,
        suffix,
        offset: 0,
        duration,
        metadata,
        clip: false,
      };

      VideoProcessQueue.getInstance().queueVideo(queueItem);
    } catch (error) {
      console.warn(
        '[LogHandler] Discarding video as failed to get Metadata:',
        String(error),
      );
    }
  }

  public static async forceEndActivity(timedelta = 0) {
    if (!LogHandler.activity) {
      console.error('[LogHandler] forceEndActivity called but no activity');
      return;
    }

    console.info('[LogHandler] Force ending activity, timedelta:', timedelta);
    const endDate = new Date();
    endDate.setTime(endDate.getTime() + timedelta * 1000);
    LogHandler.activity.overrun = 0;

    LogHandler.activity.end(endDate, false);
    await LogHandler.endActivity();
    LogHandler.activity = undefined;
  }

  public static dropActivity() {
    LogHandler.overrunning = false;
    LogHandler.activity = undefined;
  }

  /**
   * Handle the pressing of the manual recording hotkey.
   */
  public static async handleManualRecordingHotKey() {
    const sounds = ConfigService.getInstance().get('manualRecordSoundAlert');

    if (!LogHandler.activity) {
      console.info('[LogHandler] Starting manual recording');
      const startDate = new Date();
      const activity = new Manual(startDate);
      await LogHandler.startActivity(activity);
      if (sounds) playSoundAlert(SoundAlerts.MANUAL_RECORDING_START);
      return;
    }

    if (LogHandler.activity.category === VideoCategory.Manual) {
      console.info('[LogHandler] Stopping manual recording');
      const endDate = new Date();
      LogHandler.activity.end(endDate, true);
      await LogHandler.endActivity();
      if (sounds) playSoundAlert(SoundAlerts.MANUAL_RECORDING_STOP);
      return;
    }

    console.warn('[LogHandler] Unable to start manual recording');
    if (sounds) playSoundAlert(SoundAlerts.MANUAL_RECORDING_ERROR);
  }
}
