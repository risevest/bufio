export interface Storage<T> {
  put(record: T): void;
  get(start?: number, end?: number): T[];
}

export interface Worker<T, U> {
  work(records: T[]): Promise<U[]>;
}

export interface BufIOConfig<T, U> {
  storage: Storage<T>;
  worker: Worker<T, U>;
  batchSize?: number;
  flushInterval?: number;
  onError?: (err: Error, records: T[]) => void;
}
