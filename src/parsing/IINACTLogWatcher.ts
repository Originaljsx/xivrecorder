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
import { EventEmitter } from 'stream';
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
  private timeout: number;
  private timer?: NodeJS.Timeout;
  private state: Record<string, FileState> = {};
  private queue = new AsyncQueue(Number.MAX_SAFE_INTEGER);
  private current = '';

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
  }

  /**
   * Stop watching.
   */
  public async unwatch() {
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
      const { bytesRead } = await read(handle, buffer, 0, bytes, position);

      if (bytesRead !== bytes) {
        console.warn(
          '[IINACTLogWatcher] Expected',
          bytes,
          'bytes but read',
          bytesRead,
        );
      }
    } finally {
      close(handle);
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
