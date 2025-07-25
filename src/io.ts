import { MemoryStorage, Storage } from "./storage";

import { Worker } from "./worker";

export class BufIO<T, U> {
  private storage: Storage<T>;
  private worker: Worker<T, U>;
  private flushInterval: number;
  private batchSize?: number;
  private intervalId?: NodeJS.Timeout;
  private onError?: (err: Error, records: T[]) => void;

  constructor(config: {
    worker: Worker<T, U>;
    storage?: Storage<T>;
    batchSize?: number;
    flushInterval?: number;
    onError?: (err: Error, records: T[]) => void;
  }) {
    this.storage = config.storage ?? new MemoryStorage<T>();
    this.worker = config.worker;
    this.batchSize = config.batchSize;
    this.flushInterval = config.flushInterval ?? 5000;
    this.onError = config.onError;
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
    const records = this.storage.get(this.batchSize);
    if (!records.length) return;

    try {
      await this.worker.work(records);
    } catch (err: any) {
      if (this.onError) this.onError(err, records);
    }
  }
}
