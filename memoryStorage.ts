import { Storage } from "./types";

export class MemoryStorage<T> implements Storage<T> {
  private buffer: T[] = [];

  put(record: T) {
    this.buffer.push(record);
  }

  get(start = 0, end?: number) {
    const toReturn = this.buffer.slice(start, end);
    this.buffer.splice(start, toReturn.length);
    return toReturn;
  }
}
