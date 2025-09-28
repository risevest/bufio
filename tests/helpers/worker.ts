import { Worker } from "../../src/worker/base";

export class TestWorker<T> implements Worker<T, T> {
  public processed: T[] = [];

  async work(records: T[]): Promise<T[]> {
    this.processed.push(...records);
    return records;
  }
}
