/**
 * Watches IINACT network log files for new lines.
 *
 * IINACT writes one log file per day to ~/Documents/IINACT/ with the
 * naming pattern Network_[version]_[YYYYMMDD].log. This watcher detects
 * the newest log file, reads new bytes as they're appended, parses them
 * into ACTLogLine objects, and emits events keyed by line type.
 *
 * Adapted from wow-recorder's CombatLogWatcher.
 */
import { EventEmitter } from 'events';
import fs, { watch, FSWatcher } from 'fs';
import util from 'util';
import path from 'path';
import ACTLogLine from './ACTLogLine';
import AsyncQueue from '../utils/AsyncQueue';

const open = util.promisify(fs.open);
const read = util.promisify(fs.read);
const close = util.promisify(fs.close);

interface FileState {
  name: string;
  size: number;
}

export default class IINACTLogWatcher extends EventEmitter {
  private logDir: string;
  private watcher?: FSWatcher;
  private pollTimer?: ReturnType<typeof setInterval>;
  private timeout: number;
  private timer?: NodeJS.Timeout;
  private state: Record<string, FileState> = {};
  private queue = new AsyncQueue(Number.MAX_SAFE_INTEGER);
  private current = '';
  private linesRead = 0;

  constructor(logDir: string, timeoutMinutes: number) {
    super();
    this.timeout = timeoutMinutes * 1000 * 60;
    this.logDir = logDir;
  }

  /**
   * Start watching the IINACT log directory.
   */
  public async watch() {
    await this.getLogDirectoryState();

    // Identify the newest log file as current
    this.current = this.findNewestLogFile();

    const fileCount = Object.keys(this.state).length;
    console.info(
      `[IINACTLogWatcher] Watching ${this.logDir} (${fileCount} log files, current: ${this.current || 'none'}, polling every 1000ms)`,
    );

    // Primary: poll every 1s (reliable on all systems including OneDrive)
    this.pollTimer = setInterval(() => this.pollCurrentFile(), 1000);

    // Bonus: fs.watch for lower-latency detection when it works
    try {
      this.watcher = watch(this.logDir);

      this.watcher.on('change', (_type, file) => {
        if (typeof file !== 'string') return;
        if (!file.startsWith('Network_') || !file.endsWith('.log')) return;

        if (file !== this.current) {
          console.info('[IINACTLogWatcher] New active log file:', file);
          this.current = file;
        }

        this.queue.add(() => this.process(file));
      });

      this.watcher.on('error', (err) => {
        console.warn('[IINACTLogWatcher] fs.watch error (polling still active):', err.message);
      });
    } catch (e) {
      console.warn('[IINACTLogWatcher] fs.watch failed, using polling only:', (e as Error).message);
    }
  }

  /**
   * Stop watching.
   */
  public async unwatch() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = undefined;
    }

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }

    if (this.watcher) {
      await this.watcher.close();
      this.watcher = undefined;
    }
  }

  /**
   * Read all existing Network_*.log files and record their sizes so we
   * only process new bytes going forward.
   */
  private async getLogDirectoryState() {
    let files: string[];

    try {
      files = await fs.promises.readdir(this.logDir);
    } catch {
      console.warn(
        '[IINACTLogWatcher] Could not read log directory:',
        this.logDir,
      );
      return;
    }

    const logFiles = files
      .filter((f) => f.startsWith('Network_') && f.endsWith('.log'))
      .sort();

    for (const file of logFiles) {
      const fullPath = path.join(this.logDir, file);

      try {
        const stat = await fs.promises.stat(fullPath);
        this.state[fullPath] = { name: fullPath, size: stat.size };
      } catch {
        // File may have been deleted between readdir and stat.
      }
    }
  }

  /**
   * Find the newest Network_*.log file by name (they sort chronologically).
   */
  private findNewestLogFile(): string {
    const paths = Object.keys(this.state).sort();
    if (paths.length === 0) return '';
    const newest = paths[paths.length - 1];
    return path.basename(newest);
  }

  /**
   * Poll the current log file for new bytes. Also checks for new/rotated files.
   */
  private async pollCurrentFile() {
    try {
      // Check for new log files (rotation at midnight)
      const files = await fs.promises.readdir(this.logDir);
      const logFiles = files
        .filter((f) => f.startsWith('Network_') && f.endsWith('.log'))
        .sort();

      if (logFiles.length > 0) {
        const newest = logFiles[logFiles.length - 1];
        if (newest !== this.current) {
          console.info('[IINACTLogWatcher] New active log file:', newest);
          this.current = newest;
          // Initialize state for new file
          const fullPath = path.join(this.logDir, newest);
          if (!this.state[fullPath]) {
            this.state[fullPath] = { name: fullPath, size: 0 };
          }
        }
      }

      if (!this.current) return;

      const fullPath = path.join(this.logDir, this.current);
      let stat;
      try {
        stat = await fs.promises.stat(fullPath);
      } catch {
        return;
      }

      const lastState = this.state[fullPath];
      const lastSize = lastState ? lastState.size : 0;

      if (stat.size > lastSize) {
        this.queue.add(() => this.process(this.current));
      }
    } catch (e) {
      console.warn('[IINACTLogWatcher] Poll error:', (e as Error).message);
    }
  }

  /**
   * Read new bytes from a log file and parse them into lines.
   */
  private async process(file: string) {
    const fullPath = path.join(this.logDir, file);

    let currentSize: number;

    try {
      const stat = await fs.promises.stat(fullPath);
      currentSize = stat.size;
    } catch {
      return;
    }

    const lastState = this.state[fullPath];
    const startPosition = lastState ? lastState.size : 0;
    const bytesToRead = currentSize - startPosition;

    if (bytesToRead < 1) return;

    await this.parseFileChunk(fullPath, bytesToRead, startPosition);
    this.state[fullPath] = { name: fullPath, size: currentSize };
  }

  /**
   * Read a chunk of bytes from a file and emit parsed log lines.
   */
  private async parseFileChunk(
    file: string,
    bytes: number,
    position: number,
  ) {
    const buffer = Buffer.alloc(bytes);
    const handle = await open(file, 'r');

    try {
      const { bytesRead } = await read(handle, buffer as unknown as Uint8Array, 0, bytes, position);

      if (bytesRead !== bytes) {
        console.warn(
          '[IINACTLogWatcher] Expected',
          bytes,
          'bytes but read',
          bytesRead,
        );
      }
    } finally {
      await close(handle);
    }

    const lines = buffer
      .toString('utf-8')
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s);

    for (const line of lines) {
      this.handleLogLine(line);
    }

    this.resetTimeout();
  }

  /**
   * Parse a raw line string and emit it as a typed event.
   */
  public handleLogLine(line: string) {
    try {
      const logLine = new ACTLogLine(line);
      this.emit(String(logLine.type), logLine);
      this.emit('line', logLine);

      this.linesRead++;
      if (this.linesRead === 1) {
        console.info('[IINACTLogWatcher] First log line received, watcher is active');
      } else if (this.linesRead % 1000 === 0) {
        console.info(`[IINACTLogWatcher] ${this.linesRead} lines processed`);
      }
    } catch (e) {
      // Skip malformed lines silently.
    }
  }

  private resetTimeout() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.emit('timeout', this.timeout);
    }, this.timeout);
  }
}
