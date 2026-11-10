import { expect } from "chai";

import { BufIO } from "../src";
import { createWorker, deferred, FakeStorage } from "./helpers";

type RecordType = { id: number };

function record(id: number): RecordType {
  return { id };
}

/**
 * Advance fake timers and let the async flush() calls they trigger settle.
 */
function tick(ms: number) {
  return jest.advanceTimersByTimeAsync(ms);
}

describe("BufIO", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe("constructor", () => {
    it("should default to MemoryStorage when no storage is provided", async () => {
      const work = jest.fn(async (records: RecordType[]) => records);
      const bufio = new BufIO<RecordType, RecordType>({
        worker: createWorker(work),
      });

      bufio.push(record(1));
      bufio.start();
      await tick(5000);

      expect(work.mock.calls.length).to.equal(1);
      expect(work.mock.calls[0][0]).to.deep.equal([record(1)]);
    });

    it("should default flushInterval to 5000ms", async () => {
      const work = jest.fn(async (records: RecordType[]) => records);
      const bufio = new BufIO<RecordType, RecordType>({
        worker: createWorker(work),
      });

      bufio.push(record(1));
      bufio.start();

      await tick(4999);
      expect(work.mock.calls.length).to.equal(0);

      await tick(1);
      expect(work.mock.calls.length).to.equal(1);
    });

    it("should use a custom flushInterval", async () => {
      const work = jest.fn(async (records: RecordType[]) => records);
      const bufio = new BufIO<RecordType, RecordType>({
        worker: createWorker(work),
        flushInterval: 1000,
      });

      bufio.push(record(1));
      bufio.start();

      await tick(999);
      expect(work.mock.calls.length).to.equal(0);

      await tick(1);
      expect(work.mock.calls.length).to.equal(1);
    });

    it("should pass batchSize through to storage.get()", async () => {
      const work = jest.fn(async (records: RecordType[]) => records);
      const storage = new FakeStorage<RecordType>();
      const bufio = new BufIO<RecordType, RecordType>({
        worker: createWorker(work),
        storage,
        batchSize: 7,
        flushInterval: 1000,
      });

      bufio.push(record(1));
      bufio.start();
      await tick(1000);

      expect(storage.getCalls).to.deep.equal([7]);
    });
  });

  describe("push", () => {
    it("should buffer records without calling the worker immediately", () => {
      const work = jest.fn(async (records: RecordType[]) => records);
      const storage = new FakeStorage<RecordType>();
      const bufio = new BufIO<RecordType, RecordType>({
        worker: createWorker(work),
        storage,
        flushInterval: 1000,
      });

      bufio.push(record(1));
      bufio.push(record(2));

      expect(storage.puts).to.deep.equal([record(1), record(2)]);
      expect(work.mock.calls.length).to.equal(0);
    });

    it("should flush multiple records together in insertion order", async () => {
      const work = jest.fn(async (records: RecordType[]) => records);
      const bufio = new BufIO<RecordType, RecordType>({
        worker: createWorker(work),
        flushInterval: 1000,
      });

      bufio.start();
      bufio.push(record(1));
      bufio.push(record(2));
      bufio.push(record(3));

      await tick(1000);

      expect(work.mock.calls.length).to.equal(1);
      expect(work.mock.calls[0][0]).to.deep.equal([
        record(1),
        record(2),
        record(3),
      ]);
    });

    it("should include records pushed after start() in the next flush", async () => {
      const work = jest.fn(async (records: RecordType[]) => records);
      const bufio = new BufIO<RecordType, RecordType>({
        worker: createWorker(work),
        flushInterval: 1000,
      });

      bufio.start();
      bufio.push(record(1));
      await tick(1000);

      bufio.push(record(2));
      await tick(1000);

      expect(work.mock.calls.length).to.equal(2);
      expect(work.mock.calls[0][0]).to.deep.equal([record(1)]);
      expect(work.mock.calls[1][0]).to.deep.equal([record(2)]);
    });
  });

  describe("batching", () => {
    it("should flush at most batchSize records per tick", async () => {
      const work = jest.fn(async (records: RecordType[]) => records);
      const bufio = new BufIO<RecordType, RecordType>({
        worker: createWorker(work),
        batchSize: 2,
        flushInterval: 1000,
      });

      bufio.start();
      for (let id = 1; id <= 5; id++) {
        bufio.push(record(id));
      }

      await tick(1000);
      expect(work.mock.calls.length).to.equal(1);
      expect(work.mock.calls[0][0]).to.deep.equal([record(1), record(2)]);

      await tick(1000);
      expect(work.mock.calls.length).to.equal(2);
      expect(work.mock.calls[1][0]).to.deep.equal([record(3), record(4)]);

      await tick(1000);
      expect(work.mock.calls.length).to.equal(3);
      expect(work.mock.calls[2][0]).to.deep.equal([record(5)]);
    });

    it("should not call the worker when the buffer is empty", async () => {
      const work = jest.fn(async (records: RecordType[]) => records);
      const bufio = new BufIO<RecordType, RecordType>({
        worker: createWorker(work),
        flushInterval: 1000,
      });

      bufio.start();
      await tick(3000);

      expect(work.mock.calls.length).to.equal(0);
    });

    it("should flush on later ticks after an empty tick", async () => {
      const work = jest.fn(async (records: RecordType[]) => records);
      const bufio = new BufIO<RecordType, RecordType>({
        worker: createWorker(work),
        flushInterval: 1000,
      });

      bufio.start();
      await tick(1000);
      bufio.push(record(1));
      await tick(1000);

      expect(work.mock.calls.length).to.equal(1);
      expect(work.mock.calls[0][0]).to.deep.equal([record(1)]);
    });

    it("should flush records buffered while work() is in flight", async () => {
      const firstFlush = deferred<RecordType[]>();
      let call = 0;
      const work = jest.fn((records: RecordType[]) => {
        call += 1;
        return call === 1 ? firstFlush.promise : Promise.resolve(records);
      });
      const bufio = new BufIO<RecordType, RecordType>({
        worker: createWorker(work),
        flushInterval: 1000,
      });

      bufio.start();
      bufio.push(record(1));
      await tick(1000); // first flush is now awaiting the worker

      bufio.push(record(2)); // buffered while the first flush is in flight
      firstFlush.resolve([record(1)]);
      await tick(0); // let the first flush settle

      await tick(1000); // next tick delivers the buffered record
      expect(work.mock.calls.length).to.equal(2);
      expect(work.mock.calls[1][0]).to.deep.equal([record(2)]);
    });
  });

  describe("lifecycle", () => {
    it("should not flush after stop()", async () => {
      const work = jest.fn(async (records: RecordType[]) => records);
      const bufio = new BufIO<RecordType, RecordType>({
        worker: createWorker(work),
        flushInterval: 1000,
      });

      bufio.start();
      bufio.push(record(1));
      await tick(1000);
      expect(work.mock.calls.length).to.equal(1);

      bufio.stop();
      bufio.push(record(2));
      await tick(3000);

      expect(work.mock.calls.length).to.equal(1);
    });

    it("should clear the flush timer on stop()", () => {
      const work = jest.fn(async (records: RecordType[]) => records);
      const bufio = new BufIO<RecordType, RecordType>({
        worker: createWorker(work),
        flushInterval: 1000,
      });

      expect(jest.getTimerCount()).to.equal(0);

      bufio.start();
      expect(jest.getTimerCount()).to.equal(1);

      bufio.stop();
      expect(jest.getTimerCount()).to.equal(0);
    });
  });

  describe("error handling", () => {
    it("should pass the error and the failed batch to onError", async () => {
      const error = new Error("boom");
      const onError = jest.fn();
      const worker = createWorker<RecordType>(async () => {
        throw error;
      });
      const bufio = new BufIO<RecordType, RecordType>({
        worker,
        flushInterval: 1000,
        onError,
      });

      bufio.start();
      bufio.push(record(1));
      bufio.push(record(2));
      await tick(1000);

      expect(onError.mock.calls.length).to.equal(1);
      expect(onError.mock.calls[0][0]).to.equal(error);
      expect(onError.mock.calls[0][1]).to.deep.equal([record(1), record(2)]);
    });

    it("should keep flushing after a failed batch", async () => {
      const error = new Error("boom");
      const onError = jest.fn();
      const work = jest.fn(async (records: RecordType[]) => {
        if (work.mock.calls.length === 1) {
          throw error;
        }
        return records;
      });
      const bufio = new BufIO<RecordType, RecordType>({
        worker: createWorker(work),
        flushInterval: 1000,
        onError,
      });

      bufio.start();
      bufio.push(record(1));
      await tick(1000);

      bufio.push(record(2));
      await tick(1000);

      expect(work.mock.calls.length).to.equal(2);
      expect(onError.mock.calls.length).to.equal(1);
      expect(work.mock.calls[1][0]).to.deep.equal([record(2)]);
    });

    it("should swallow worker rejections when onError is not provided", async () => {
      const work = jest.fn(async (records: RecordType[]) => {
        if (work.mock.calls.length === 1) {
          throw new Error("boom");
        }
        return records;
      });
      const bufio = new BufIO<RecordType, RecordType>({
        worker: createWorker(work),
        flushInterval: 1000,
      });

      bufio.start();
      bufio.push(record(1));
      await tick(1000);

      bufio.push(record(2));
      await tick(1000);

      expect(work.mock.calls.length).to.equal(2);
      expect(work.mock.calls[1][0]).to.deep.equal([record(2)]);
    });
  });
});
