import { app, ipcMain, powerMonitor } from 'electron';
import { uIOhook, UiohookKeyboardEvent } from 'uiohook-napi';
import {
  buildClipMetadata,
  getMetadataForVideo,
  getOBSFormattedDate,
  isManualRecordHotKey,
  nextKeyPressPromise,
  nextMousePressPromise,
} from './util';
import { VideoCategory } from '../types/VideoCategory';
import Poller from '../utils/Poller';
import FFXIVLogHandler from '../parsing/FFXIVLogHandler';
import Recorder from './Recorder';
import ConfigService from '../config/ConfigService';
import {
  RecStatus,
  VideoQueueItem,
  MicStatus,
  FFXIVProcessEvent,
  BaseConfig,
  ActivityStatus,
} from './types';
import {
  getObsVideoConfig,
  getObsAudioConfig,
  getOverlayConfig,
  getBaseConfig,
  validateBaseConfig,
} from '../utils/configUtils';
import { ERecordingState } from './obsEnums';
import VideoProcessQueue from './VideoProcessQueue';
import LogHandler from 'parsing/LogHandler';
import { PTTKeyPressEvent } from 'types/KeyTypesUIOHook';
import { send } from './main';
import DiskClient from 'storage/DiskClient';

/**
 * Manager class — central coordinator between all subsystems.
 */
export default class Manager {
  private poller = Poller.getInstance();
  private recorder = Recorder.getInstance();
  private cfg = ConfigService.getInstance();

  /**
   * FFXIV log handler.
   */
  private logHandler: FFXIVLogHandler | undefined;

  /**
   * If the config is valid or not.
   */
  private configValid = false;

  /**
   * The config message, typically used to show the user why their config is
   * invalid.
   */
  private configMessage = '';

  /**
   * If we are in the middle of a reconfigure or not.
   */
  private reconfiguring = false;

  /**
   * If the audio settings are open or not. We want the audio devices to
   * be attached to power the volmeters in the case they are on display,
   * even if FFXIV is closed. But we want the audio devices disconnected if
   * both the settings and FFXIV are closed to allow Windows to naturally sleep.
   */
  private audioSettingsOpen = false;

  /**
   * It's confusing if you try to change the hotkey to something similar and
   * it starts a recording mid changing it, so set this to true while doing so.
   */
  private manualHotKeyDisabled = false;

  constructor() {
    console.info('[Manager] Creating manager');
    this.setupListeners();

    this.recorder.on('state-change', () => {
      setTimeout(() => this.refreshStatus(), 0);
    });

    this.poller
      .on(FFXIVProcessEvent.STARTED, () => this.onFFXIVStarted())
      .on(FFXIVProcessEvent.STOPPED, () => this.onFFXIVStopped());
  }

  /**
   * Run the startup configuration. Run once, on startup.
   */
  public async startup() {
    console.info('[Manager] Starting up');
    this.reconfiguring = true;
    let success = false;

    try {
      await this.configureBase(true);
      success = true;
    } catch (error) {
      console.error('[Manager] Failed to configure base on startup', error);
      this.setConfigInvalid(String(error));
    }

    await this.configureObsVideo();
    await this.configureObsAudio();
    await this.configureObsOverlay();

    if (success) {
      this.setConfigValid();
      this.poller.start();
    }

    this.reconfiguring = false;
  }

  /**
   * Reconfigure the base settings. This exists because we need the recorder
   * to be stopped to do this, and because the user can input invalid settings
   * which we want to catch.
   */
  public async reconfigureBase() {
    console.info('[Manager] Reconfiguring base');

    await this.recorder.forceStop(true);
    this.reconfiguring = true;
    this.refreshStatus();
    let success = false;

    try {
      await this.configureBase(false);
      success = true;
    } catch (error) {
      console.error('[Manager] Failed to configure base', error);
      this.setConfigInvalid(String(error));
    }

    if (success) {
      this.setConfigValid();
      this.poller.start();
    }

    this.reconfiguring = false;
    this.refreshStatus();

    await DiskClient.getInstance().refreshStatus();
    await DiskClient.getInstance().refreshVideos();
  }

  /**
   * Configure the base config.
   */
  private async configureBase(startup: boolean) {
    const config = getBaseConfig(this.cfg);
    await validateBaseConfig(config);
    await this.applyBaseConfig(config, startup);
  }

  /**
   * Force a recording to stop regardless of the scenario.
   */
  public async forceStop() {
    if (!LogHandler.activity) {
      console.info('[Manager] No activity to force end');
      return;
    }

    console.info('[Manager] Force ending activity');
    LogHandler.forceEndActivity();
  }

  private setConfigValid() {
    this.configValid = true;
    this.configMessage = '';
    this.refreshStatus();
  }

  private setConfigInvalid(reason: string) {
    this.configValid = false;
    this.configMessage = reason;
    this.refreshStatus();
  }

  /**
   * Refresh the recorder and mic status icons in the UI.
   */
  public refreshStatus() {
    if (this.reconfiguring) {
      this.refreshRecStatus(RecStatus.Reconfiguring);
      return;
    }

    if (!this.configValid) {
      this.refreshRecStatus(
        RecStatus.InvalidConfig,
        String(this.configMessage),
      );
      return;
    }

    const inOverrun = LogHandler.overrunning;

    if (inOverrun) {
      this.refreshRecStatus(RecStatus.Overrunning);
    } else if (LogHandler.activity) {
      const activityStatus: ActivityStatus = {
        category: LogHandler.activity.category,
        start: LogHandler.activity.startDate.getTime(),
      };

      this.refreshRecStatus(RecStatus.Recording, '', activityStatus);
    } else if (this.recorder.obsState === ERecordingState.Recording) {
      this.refreshRecStatus(RecStatus.ReadyToRecord);
    } else if (this.recorder.obsState === ERecordingState.None) {
      this.refreshRecStatus(RecStatus.WaitingForFFXIV);
    }

    this.refreshMicStatus(this.recorder.obsMicState);
    this.redrawPreview();
  }

  private refreshRecStatus(
    status: RecStatus,
    msg = '',
    activityStatus: ActivityStatus | null = null,
  ) {
    send('updateRecStatus', status, msg);
    send('updateActivityStatus', activityStatus);
  }

  private refreshMicStatus(status: MicStatus) {
    send('updateMicStatus', status);
  }

  private redrawPreview() {
    setTimeout(() => send('redrawPreview'), 100);
  }

  /**
   * Called when the FFXIV process is detected. Attaches audio sources
   * and starts the buffer recording.
   */
  private async onFFXIVStarted() {
    console.info('[Manager] Detected FFXIV is running');
    this.recorder.attachCaptureSource();

    const audioConfig = getObsAudioConfig(this.cfg);
    this.recorder.configureAudioSources(audioConfig);

    try {
      await this.recorder.startBuffer();
    } catch (error) {
      console.error('[Manager] OBS failed to record when FFXIV started', error);
    }
  }

  /**
   * Called when the FFXIV process is detected to have exited.
   */
  private async onFFXIVStopped() {
    console.info('[Manager] Detected FFXIV not running');
    const inActivity = Boolean(LogHandler.activity);

    if (inActivity) {
      console.info('[Manager] Force ending activity');
      LogHandler.forceEndActivity();
    } else {
      await this.recorder.forceStop(true);
    }

    this.recorder.clearFindWindowInterval();

    if (!this.audioSettingsOpen) {
      this.recorder.removeAudioSources();
    }
  }

  /**
   * Configure the base OBS config and create the log handler.
   */
  private async applyBaseConfig(config: BaseConfig, startup: boolean) {
    await this.recorder.configureBase(config, startup);

    LogHandler.activity = undefined;
    LogHandler.overrunning = false;
    LogHandler.setStateChangeCallback(() => this.refreshStatus());

    if (!startup && this.logHandler) {
      console.info('[Manager] Not startup, so reset log handler');
      this.logHandler.destroy();
      this.logHandler = undefined;
    }

    if (config.recordCrystallineConflict) {
      this.logHandler = new FFXIVLogHandler(config.iinactLogPath);

      // Wire up buffer start event from log handler.
      this.logHandler.on('start-buffer', async () => {
        if (this.recorder.obsState === ERecordingState.Recording) {
          console.info('[Manager] Already buffering, ignoring start-buffer');
          return;
        }

        if (this.poller.isFFXIVRunning()) {
          try {
            await this.recorder.startBuffer();
          } catch (error) {
            console.error('[Manager] Failed to start buffer', error);
          }
        }
      });

      await this.logHandler.start();
    }
  }

  private configureObsVideo() {
    const config = getObsVideoConfig(this.cfg);
    this.recorder.configureVideoSources(config);
  }

  private configureObsAudio() {
    const isFFXIVRunning = this.poller.isFFXIVRunning();
    const shouldConfigure = isFFXIVRunning || this.audioSettingsOpen;

    if (!shouldConfigure) {
      console.info("[Manager] Won't configure audio sources, FFXIV not running");
      return;
    }

    const config = getObsAudioConfig(this.cfg);
    this.recorder.configureAudioSources(config);
  }

  private configureObsOverlay() {
    const config = getOverlayConfig(this.cfg);
    this.recorder.configureOverlayImageSource(config);
  }

  private setupListeners() {
    this.cfg.on('change', (key: string, value: unknown) => {
      if (key === 'startUp') {
        const isStartUp = value === true;
        console.info('[Main] OS level set start-up behaviour:', isStartUp);

        app.setLoginItemSettings({
          openAtLogin: isStartUp,
        });
      }
    });

    // Clipping listener.
    ipcMain.on('clip', async (_event, args) => {
      console.info('[Manager] Clip request received with args', args);

      const source = args[0];
      const offset = args[1];
      const duration = args[2];

      const sourceMetadata = await getMetadataForVideo(source);
      const now = new Date();
      const clipMetadata = buildClipMetadata(sourceMetadata, duration, now);

      const clipQueueItem: VideoQueueItem = {
        source,
        suffix: `Clipped at ${getOBSFormattedDate(now)}`,
        offset,
        duration,
        clip: true,
        metadata: clipMetadata,
      };

      VideoProcessQueue.getInstance().queueVideo(clipQueueItem);
    });

    // Manual recording from UI button.
    ipcMain.on('toggleManualRecording', async () => {
      if (!this.cfg.get('manualRecord')) {
        return;
      }

      if (!this.poller.isFFXIVRunning()) {
        console.warn('[Manager] FFXIV not running when manual hotkey pressed');
        return;
      }

      if (this.recorder.obsState !== ERecordingState.Recording) {
        console.warn('[Manager] Recorder not ready when manual hotkey pressed');
        return;
      }

      LogHandler.handleManualRecordingHotKey();
    });

    // Force stop button.
    ipcMain.on('forceStopRecording', async () => {
      LogHandler.forceEndActivity();
    });

    // Get the next key pressed by the user.
    ipcMain.handle('getNextKeyPress', async (): Promise<PTTKeyPressEvent> => {
      this.manualHotKeyDisabled = true;

      const event = await Promise.race([
        nextKeyPressPromise(),
        nextMousePressPromise(),
      ]);

      this.manualHotKeyDisabled = false;
      return event;
    });

    // Manual recording hotkey listener.
    uIOhook.on('keydown', (event: UiohookKeyboardEvent) => {
      if (this.manualHotKeyDisabled) return;

      if (!this.cfg.get('manualRecord')) return;

      if (!isManualRecordHotKey(event)) return;

      if (!this.poller.isFFXIVRunning()) {
        console.warn('[Manager] FFXIV not running when manual hotkey pressed');
        return;
      }

      if (this.recorder.obsState !== ERecordingState.Recording) {
        console.warn('[Manager] Recorder not ready when manual hotkey pressed');
        return;
      }

      LogHandler.handleManualRecordingHotKey();
    });

    // Sleep/wake handlers.
    powerMonitor.on('suspend', async () => {
      console.info('[Manager] Detected Windows is going to sleep.');
      LogHandler.dropActivity();
      this.poller.stop();
      await this.recorder.forceStop(false);
    });

    powerMonitor.on('resume', async () => {
      console.info('[Manager] Detected Windows waking up from a sleep.');
      await this.recorder.forceStop(true);
      this.poller.start();
    });
  }
}
