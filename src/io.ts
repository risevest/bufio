<<<<<<< HEAD
import { Storage } from "./storage/base";
import { MemoryStorage } from "./storage/memory";
=======
import { MemoryStorage, Storage } from "./storage";

>>>>>>> main
import { Worker } from "./worker";

export class BufIO<T, U> {
  private storage: Storage<T>;
  private worker: Worker<T, U>;
  private flushInterval: number;
<<<<<<< HEAD
=======
  private batchSize?: number;
>>>>>>> main
  private intervalId?: NodeJS.Timeout;
  private onError?: (err: Error, records: T[]) => void;

  constructor(config: {
<<<<<<< HEAD
    storage?: Storage<T>;
    worker: Worker<T, U>;
=======
    worker: Worker<T, U>;
    storage?: Storage<T>;
    batchSize?: number;
>>>>>>> main
    flushInterval?: number;
    onError?: (err: Error, records: T[]) => void;
  }) {
    this.storage = config.storage ?? new MemoryStorage<T>();
    this.worker = config.worker;
<<<<<<< HEAD
=======
    this.batchSize = config.batchSize;
>>>>>>> main
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
<<<<<<< HEAD
    const records = this.storage.get();
=======
    const records = this.storage.get(this.batchSize);
>>>>>>> main
    if (!records.length) return;

    try {
      await this.worker.work(records);
    } catch (err: any) {
      if (this.onError) this.onError(err, records);
    }
  }
}
