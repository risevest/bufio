import { Storage } from "./base";

export class MemoryStorage<T> implements Storage<T> {
  private buffer: T[] = [];

  put(record: T) {
    this.buffer.push(record);
  }

  get(batchSize = 1000): T[] {
    return this.buffer.splice(0, batchSize);
  }
}
