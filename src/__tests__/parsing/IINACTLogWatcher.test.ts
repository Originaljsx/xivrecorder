import fs from 'fs';
import path from 'path';
import os from 'os';
import IINACTLogWatcher from '../../parsing/IINACTLogWatcher';

describe('IINACTLogWatcher', () => {
  let tmpDir: string;
  let watcher: IINACTLogWatcher;

  beforeEach(async () => {
    tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'iinact-test-'));
    watcher = new IINACTLogWatcher(tmpDir, 30);
  });

  afterEach(async () => {
    await watcher.unwatch();
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  });

  it('detects lines appended to a log file via polling', async () => {
    const logFile = path.join(tmpDir, 'Network_30009_20260306.log');
    // Create file before watching so initial state is recorded
    await fs.promises.writeFile(logFile, '');

    await watcher.watch();

    const received: string[] = [];
    watcher.on('line', (line) => {
      received.push(line.raw);
    });

    // Append a valid IINACT log line
    const logLine =
      '01|2026-03-06T10:00:00.0000000-08:00|40A|Cloud Nine|abc123\n';
    await fs.promises.appendFile(logFile, logLine);

    // Wait for poll interval + processing
    await new Promise((resolve) => setTimeout(resolve, 2000));

    expect(received.length).toBe(1);
    expect(received[0]).toContain('Cloud Nine');
  });

  it('detects file rotation to a new log file', async () => {
    const oldFile = path.join(tmpDir, 'Network_30009_20260305.log');
    await fs.promises.writeFile(oldFile, '01|2026-03-05T23:59:00.0000000-08:00|40A|Old Zone|abc\n');

    await watcher.watch();

    const received: string[] = [];
    watcher.on('line', (line) => {
      received.push(line.raw);
    });

    // Create a new day's log file
    const newFile = path.join(tmpDir, 'Network_30009_20260306.log');
    const logLine =
      '01|2026-03-06T00:01:00.0000000-08:00|40A|New Zone|def456\n';
    await fs.promises.writeFile(newFile, logLine);

    // Wait for poll to detect new file and read it
    await new Promise((resolve) => setTimeout(resolve, 2000));

    expect(received.length).toBe(1);
    expect(received[0]).toContain('New Zone');
  });

  it('handles empty directory gracefully', async () => {
    await watcher.watch();

    // Wait a poll cycle — should not crash
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // No errors thrown = success
  });
});
