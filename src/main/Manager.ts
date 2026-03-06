/**
 * Main application manager — orchestrates FFXIV process detection,
 * log handling, and recording.
 *
 * Adapted from wow-recorder's Manager.ts.
 */
import { ipcMain, powerMonitor } from 'electron';
import ConfigService from '../config/ConfigService';
import FFXIVLogHandler from '../parsing/FFXIVLogHandler';
import LogHandler from '../parsing/LogHandler';
import Poller from '../utils/Poller';
import { FFXIVProcessEvent, RecStatus } from './types';

export default class Manager {
  private poller: Poller;
  private cfg: ConfigService;
  private logHandler?: FFXIVLogHandler;
  private recStatus: RecStatus = RecStatus.WaitingForFFXIV;

  constructor() {
    this.cfg = ConfigService.getInstance();
    this.poller = Poller.getInstance();
  }

  /**
   * Start the manager — begin polling for FFXIV and set up IPC.
   */
  async startup() {
    console.info('[Manager] Starting up');

    this.poller.on(FFXIVProcessEvent.STARTED, () => this.onFFXIVStarted());
    this.poller.on(FFXIVProcessEvent.STOPPED, () => this.onFFXIVStopped());
    this.poller.start();

    this.setupListeners();

    console.info('[Manager] Startup complete');
  }

  /**
   * Shut down the manager.
   */
  async shutdown() {
    console.info('[Manager] Shutting down');
    this.poller.stop();

    if (this.logHandler) {
      await this.logHandler.stop();
      this.logHandler = undefined;
    }
  }

  /**
   * Called when FFXIV process is detected.
   */
  private async onFFXIVStarted() {
    console.info('[Manager] FFXIV started');

    const logPath = this.cfg.get('iinactLogPath');
    this.logHandler = new FFXIVLogHandler(logPath);

    // Wire up activity events to the recorder.
    this.logHandler.on('start-buffer', () => {
      console.info('[Manager] Start buffer (entered CC zone)');
      this.recStatus = RecStatus.Recording;
      // TODO: Start OBS buffer recording.
    });

    this.logHandler.on('activity-start', (activity) => {
      console.info('[Manager] Activity started:', activity.category);
      this.recStatus = RecStatus.Recording;
      // TODO: Start OBS recording.
    });

    this.logHandler.on('activity-end', (activity) => {
      console.info('[Manager] Activity ended:', activity.category);
      this.recStatus = RecStatus.ReadyToRecord;
      // TODO: Stop OBS recording, save video.
    });

    this.logHandler.on('force-end', () => {
      console.info('[Manager] Activity force ended');
      this.recStatus = RecStatus.ReadyToRecord;
      // TODO: Stop OBS recording, discard or save.
    });

    await this.logHandler.start();
    this.recStatus = RecStatus.ReadyToRecord;
  }

  /**
   * Called when FFXIV process exits.
   */
  private async onFFXIVStopped() {
    console.info('[Manager] FFXIV stopped');

    if (LogHandler.isActivityInProgress()) {
      LogHandler.forceEndActivity();
    }

    if (this.logHandler) {
      await this.logHandler.stop();
      this.logHandler = undefined;
    }

    this.recStatus = RecStatus.WaitingForFFXIV;
  }

  /**
   * Set up IPC event listeners for renderer communication.
   */
  private setupListeners() {
    ipcMain.on('getRecStatus', (event) => {
      event.returnValue = this.recStatus;
    });

    ipcMain.on('getConfig', (event) => {
      event.returnValue = this.cfg.getAll();
    });

    ipcMain.on('setConfig', (_event, key: string, value: unknown) => {
      this.cfg.set(key as any, value as any);
    });

    // Suspend/resume: stop/start log watching to avoid stale state.
    powerMonitor.on('suspend', async () => {
      console.info('[Manager] System suspending');

      if (this.logHandler) {
        await this.logHandler.stop();
      }
    });

    powerMonitor.on('resume', async () => {
      console.info('[Manager] System resuming');

      if (this.poller.isFFXIVRunning() && this.logHandler) {
        await this.logHandler.start();
      }
    });
  }

  getRecStatus(): RecStatus {
    return this.recStatus;
  }
}
