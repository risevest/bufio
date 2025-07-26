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

  test("should call storage.put() when push() is called", () => {
    const putSpy = jest.spyOn(storageMock, "put");
    const record = { id: 1, value: "test" };
    bufio.push(record);
    expect(putSpy).toHaveBeenCalledWith(record);
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
    // Node.js timers are not set to null, but are destroyed after clearInterval
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
});
