import { Storage } from "./base";

export class MemoryStorage<T> implements Storage<T> {
  private buffer: T[] = [];

  put(record: T) {
    this.buffer.push(record);
  }

<<<<<<< HEAD
  get(): T[] {
    const records = [...this.buffer];
    this.buffer = [];
    return records;
=======
  get(batchSize = 1000): T[] {
    return this.buffer.splice(0, batchSize);
>>>>>>> main
  }
}
