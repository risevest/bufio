export abstract class Worker<T, U> {
  abstract work(records: T[]): Promise<U[]>;
}
