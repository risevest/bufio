export abstract class Storage<T> {
  abstract put(record: T): void;
  abstract get(batchSize?: number): T[];
}
