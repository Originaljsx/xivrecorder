/**
 * Polls for the ffxiv_dx11.exe process.
 *
 * Uses `tasklist` command instead of wow-recorder's rust-ps.exe binary.
 */
import EventEmitter from 'events';
import { exec } from 'child_process';
import { FFXIVProcessEvent } from '../main/types';

export default class Poller extends EventEmitter {
  private static instance: Poller;
  private ffxivRunning = false;
  private timer?: NodeJS.Timeout;
  private pollIntervalMs = 5000;

  static getInstance() {
    if (!Poller.instance) Poller.instance = new Poller();
    return Poller.instance;
  }

  private constructor() {
    super();
  }

  public isFFXIVRunning() {
    return this.ffxivRunning;
  }

  public stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }

    this.ffxivRunning = false;
  }

  public start() {
    this.stop();
    this.poll(); // Initial check
    this.timer = setInterval(() => this.poll(), this.pollIntervalMs);
  }

  private poll() {
    exec(
      'tasklist /FI "IMAGENAME eq ffxiv_dx11.exe" /NH',
      (error, stdout) => {
        if (error) {
          console.warn('[Poller] tasklist error:', error.message);
          return;
        }

        const running = stdout.toLowerCase().includes('ffxiv_dx11.exe');

        if (this.ffxivRunning === running) return;

        this.ffxivRunning = running;

        if (running) {
          console.info('[Poller] FFXIV detected');
          this.emit(FFXIVProcessEvent.STARTED);
        } else {
          console.info('[Poller] FFXIV stopped');
          this.emit(FFXIVProcessEvent.STOPPED);
        }
      },
    );
  }
}
