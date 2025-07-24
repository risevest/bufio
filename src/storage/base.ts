export abstract class Storage<T> {
  abstract put(record: T): void;
<<<<<<< HEAD
  abstract get(): T[];
=======
  abstract get(batchSize?: number): T[];
>>>>>>> main
}
