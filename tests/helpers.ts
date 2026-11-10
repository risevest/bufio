import { Storage } from "../src/storage";
import { Worker } from "../src/worker";

/**
 * Generate multiple version using a mock data function.
 * @param n number of values to generate
 * @param fn mock data function
 */
export function multiply<T>(n: number, fn: () => T): T[] {
  const results: T[] = [];

  for (let i = 0; i < n; i++) {
    results.push(fn());
  }

  return results;
}

/**
 * Create a promise together with its resolve/reject functions.
 *  This one only finishes when the test calls `resolve()` or `reject()`,
 * so a test can pause something and look at it mid-flight.
 */
export function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: any) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

/**
 * Build a Worker from a plain async function without repeating the
 * object literal in every test.
 */
export function createWorker<T, U = T>(
  work: (records: T[]) => Promise<U[]>,
): Worker<T, U> {
  return { work };
}

/**
 * Storage implementation that records how BufIO interacts with it.
 * `puts` captures every buffered record and `getCalls` captures the
 * arguments passed to `get()`.
 */
export class FakeStorage<T> implements Storage<T> {
  public readonly puts: T[] = [];
  public readonly getCalls: Array<number | undefined> = [];

  private buffer: T[] = [];

  put(record: T) {
    this.puts.push(record);
    this.buffer.push(record);
  }

  get(batchSize?: number): T[] {
    this.getCalls.push(batchSize);

    const size = batchSize ?? this.buffer.length;
    return this.buffer.splice(0, size);
  }
}
