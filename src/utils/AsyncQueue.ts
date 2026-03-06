/**
 * Simple async task queue that processes tasks sequentially.
 * Reused from wow-recorder.
 */
export default class AsyncQueue {
  private queue: (() => Promise<void>)[] = [];
  private running = false;
  private limit: number;

  constructor(limit: number) {
    this.limit = limit;
  }

  public add(task: () => Promise<void>) {
    if (this.queue.length >= this.limit) return;
    this.queue.push(task);
    if (!this.running) this.run();
  }

  private async run() {
    this.running = true;

    while (this.queue.length) {
      const task = this.queue.shift()!;

      try {
        await task();
      } catch (e) {
        console.warn('[AsyncQueue] Task failed:', e);
      }
    }

    this.running = false;
  }
}
