// bufio.ts
import { Storage, Worker, BufIOConfig } from "./types";

export class BufIO<T, U> {
  private storage: Storage<T>;
  private worker: Worker<T, U>;
  private batchSize: number;
  private flushInterval: number;
  private intervalId?: NodeJS.Timeout;
  private onError?: (err: Error, records: T[]) => void;

  // metrics
  public flushCount = 0;
  public successCount = 0;
  public failureCount = 0;

  constructor({
    storage,
    worker,
    batchSize = 100,
    flushInterval = 5000,
    onError,
  }: BufIOConfig<T, U>) {
    this.storage = storage;
    this.worker = worker;
    this.batchSize = batchSize;
    this.flushInterval = flushInterval;
    this.onError = onError;
  }

  public push(record: T) {
    this.storage.put(record);
  }

  public start() {
    this.intervalId = setInterval(() => this.flush(), this.flushInterval);
  }

  public stop() {
    if (this.intervalId) clearInterval(this.intervalId);
  }

  private async flush() {
    const records = this.storage.get(0, this.batchSize);
    if (!records.length) return;

    this.flushCount++;

    try {
      await this.worker.work(records);
      this.successCount++;
      console.log(`[BufIO] Flushed ${records.length} record(s).`);
    } catch (err: any) {
      this.failureCount++;
      console.error(`[BufIO] Error during flush:`, err);
      if (this.onError) this.onError(err, records);
    }
  }
}
