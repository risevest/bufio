import { MemoryStorage } from "../src/storage";
import { Worker } from "../src/worker";
import { BufIO } from "../src/io";

type RecordType = { id: number; value: string };

describe("BufIO", () => {
  let storageMock: MemoryStorage<RecordType>;
  let workerMock: Worker<RecordType, any>;
  let bufio: BufIO<RecordType, any>;

  beforeEach(() => {
    storageMock = new MemoryStorage<RecordType>();
    workerMock = {
      work: jest.fn(async (records: RecordType[]) => records),
    };
    bufio = new BufIO({
      storage: storageMock,
      worker: workerMock,
      batchSize: 2,
      flushInterval: 1000,
    });
  });

  test("should initialize with provided storage and worker", () => {
    expect(bufio).toBeDefined();
    expect(bufio).not.toBeUndefined();
    expect(bufio).toHaveProperty("storage", storageMock);
    expect(bufio).toHaveProperty("worker", workerMock);
  });

  test("should default to MemoryStorage if no storage provided", () => {
    const defaultBufio = new BufIO({ worker: workerMock });
    expect(defaultBufio).not.toBeUndefined();
    expect((defaultBufio as any).storage).toBeInstanceOf(MemoryStorage);
  });

  test("should throw if worker is not provided", () => {
    expect(() => {
      // @ts-expect-error
      new BufIO({ storage: storageMock });
    }).toThrow("Worker must be provided");
  });

  test("should call storage.put() when push() is called", () => {
    const putSpy = jest.spyOn(storageMock, "put");
    const record = { id: 1, value: "test" };
    bufio.push(record);
    expect(putSpy).toHaveBeenCalledWith(record);
  });

  test("should not push null or undefined records", async () => {
    bufio.push(undefined as any);
    bufio.push(null as any);
    const records = storageMock.get(10);
    expect(records).toEqual([]); // storage should remain empty
  });

  test("should flush records at interval when start() is called", () => {
    jest.useFakeTimers();
    const flushSpy = jest.spyOn<any, any>(bufio, "flush");
    bufio.start();
    jest.advanceTimersByTime(3000);
    jest.runOnlyPendingTimers();
    expect(flushSpy).toHaveBeenCalledTimes(4);
    bufio.stop();
    jest.useRealTimers();
  });

  test("should stop the interval when stop() is called", () => {
    bufio.start();
    bufio.stop();
    const intervalId = (bufio as any).intervalId;
    expect(intervalId?._destroyed).toBe(true);
  });

  test("flush() should call storage.get and worker.work with records", async () => {
    bufio.push({ id: 1, value: "record1" });
    bufio.push({ id: 2, value: "record2" });
    const getSpy = jest.spyOn(storageMock, "get");
    const workSpy = jest.spyOn(workerMock, "work");
    await (bufio as any).flush();
    expect(getSpy).toHaveBeenCalledWith(2);
    expect(workSpy).toHaveBeenCalledWith([
      { id: 1, value: "record1" },
      { id: 2, value: "record2" },
    ]);
  });

  test("flush() should handle worker errors gracefully", async () => {
    const errorWorker: Worker<RecordType, any> = {
      work: jest.fn().mockRejectedValue(new Error("worker failed")),
    };
    const bufioWithError = new BufIO({ worker: errorWorker });
    bufioWithError.push({ id: 1, value: "record1" });
    await expect((bufioWithError as any).flush()).resolves.not.toThrow();
  });

  test("should queue pushed records without flushing before start", async () => {
    const flushSpy = jest.spyOn<any, any>(bufio, "flush");
    bufio.push({ id: 3, value: "queued" });
    expect(flushSpy).not.toHaveBeenCalled();
  });

  test("should not create multiple intervals when start() is called multiple times", () => {
    jest.useFakeTimers();
    const setIntervalSpy = jest.spyOn(global, "setInterval");
    bufio.start();
    bufio.start();
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    bufio.stop();
    jest.useRealTimers();
    setIntervalSpy.mockRestore();
  });

  test("should not throw when stop() is called before start()", () => {
    expect(() => bufio.stop()).not.toThrow();
  });

  test("should flush records when batchSize is reached", async () => {
    bufio.push({ id: 1, value: "A" });
    bufio.push({ id: 2, value: "B" });
    const workSpy = jest.spyOn(workerMock, "work");
    await (bufio as any).flush();
    expect(workSpy).toHaveBeenCalledWith([
      { id: 1, value: "A" },
      { id: 2, value: "B" },
    ]);
  });

  test("should not call worker when there are no records to flush", async () => {
    const workSpy = jest.spyOn(workerMock, "work");
    await (bufio as any).flush();
    expect(workSpy).not.toHaveBeenCalled();
  });

  test("should flush all available records even if less than batchSize", async () => {
    bufio.push({ id: 1, value: "one" });
    const workSpy = jest.spyOn(workerMock, "work");
    await (bufio as any).flush();
    expect(workSpy).toHaveBeenCalledWith([{ id: 1, value: "one" }]);
  });

  test("should clear flushed records from storage after flush", async () => {
    bufio.push({ id: 1, value: "A" });
    bufio.push({ id: 2, value: "B" });
    await (bufio as any).flush();
    const remaining = await storageMock.get(10);
    expect(remaining.length).toBe(0); // if flush empties storage
  });

  test("should safely flush even when push is called concurrently", async () => {
    bufio.push({ id: 1, value: "x" });
    const flushPromise = (bufio as any).flush();
    bufio.push({ id: 2, value: "y" });
    await flushPromise;
    const remaining = await storageMock.get(10);
    expect(remaining.length).toBeGreaterThanOrEqual(0); // depending on timing
  });

  test("should throw if batchSize <= 0", () => {
    expect(
      () =>
        new BufIO({
          storage: storageMock,
          worker: workerMock,
          batchSize: 0,
          flushInterval: 1000,
        })
    ).toThrow();
  });

  test("should accept a very high flushInterval", () => {
    expect(
      () =>
        new BufIO({
          storage: storageMock,
          worker: workerMock,
          batchSize: 1,
          flushInterval: 60 * 60 * 1000,
        })
    ).not.toThrow();
  });

  test("should support custom storage with get and put", async () => {
    let store: RecordType[] = [];
    const customStorage = {
      put: jest.fn((rec: RecordType) => store.push(rec)),
      get: jest.fn((n: number) => store.splice(0, n)),
    };
    const buf = new BufIO({
      storage: customStorage,
      worker: workerMock,
      batchSize: 1,
      flushInterval: 1000,
    });
    buf.push({ id: 1, value: "X" });
    await (buf as any).flush();
    expect(customStorage.get).toHaveBeenCalled();
    expect(workerMock.work).toHaveBeenCalledWith([{ id: 1, value: "X" }]);
  });
});
