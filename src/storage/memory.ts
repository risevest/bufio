import { Storage } from "./base";

export class MemoryStorage<T> implements Storage<T> {
  private buffer: T[] = [];

  put(record: T) {
    this.buffer.push(record);
  }

  get(): T[] {
    const records = [...this.buffer];
    this.buffer = [];
    return records;
  }
}
