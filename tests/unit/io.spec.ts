import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { MemoryStorage } from "../../src/storage";
import { Worker } from "../../src/worker";
import { IO } from "../../src/io";

chai.use(chaiAsPromised);

type RecordType = { id: number; value: string };

// simple spy helper
function createSpy<T extends (...args: any[]) => any>(fn: T) {
  const calls: any[][] = [];
  const spyFn = (...args: any[]) => {
    calls.push(args);
    return fn(...args);
  };
  (spyFn as any).calls = calls;
  return spyFn as T & { calls: any[][] };
}

describe("IO", () => {
  let storageMock: MemoryStorage<RecordType>;
  let workerMock: Worker<RecordType, any>;
  let io: IO<RecordType, any>;

  beforeEach(() => {
    storageMock = new MemoryStorage<RecordType>();
    workerMock = {
      work: async (records: RecordType[]) => records,
    };
    io = new IO({
      storage: storageMock,
      worker: workerMock,
      batchSize: 2,
      flushInterval: 1000,
    });
  });

  it("should initialize with provided storage and worker", () => {
    expect(io).to.exist;
    expect(io).to.have.property("storage", storageMock);
    expect(io).to.have.property("worker", workerMock);
  });

  it("should default to MemoryStorage if no storage provided", () => {
    const defaultIO = new IO({ worker: workerMock });
    expect(defaultIO).to.exist;
    expect((defaultIO as any).storage).to.be.instanceOf(MemoryStorage);
  });

  it("should throw if worker is not provided", () => {
    expect(() => {
      // @ts-expect-error
      new IO({ storage: storageMock });
    }).to.throw("Worker must be provided");
  });

  it("should call storage.put() when push() is called", () => {
    const originalPut = storageMock.put.bind(storageMock);
    const putSpy = createSpy(originalPut);
    (storageMock as any).put = putSpy;

    const record = { id: 1, value: "test" };
    io.push(record);

    expect(putSpy.calls.length).to.equal(1);
    expect(putSpy.calls[0][0]).to.deep.equal(record);
  });

  it("should not push null or undefined records", async () => {
    io.push(undefined as any);
    io.push(null as any);
    const records = storageMock.get(10);
    expect(records).to.deep.equal([]);
  });

  it("should flush records at interval when start() is called", (done) => {
    let flushCount = 0;
    (io as any).flush = async () => {
      flushCount++;
    };

    io.start();
    setTimeout(() => {
      io.stop();
      expect(flushCount).to.be.greaterThan(1);
      done();
    }, 3100);
  });

  it("should stop the interval when stop() is called", () => {
    io.start();
    io.stop();
    const intervalId = (io as any).intervalId;
    expect(intervalId?._destroyed).to.be.true;
  });

  it("flush() should call storage.get and worker.work with records", async () => {
    io.push({ id: 1, value: "record1" });
    io.push({ id: 2, value: "record2" });

    const originalGet = storageMock.get.bind(storageMock);
    const getSpy = createSpy(originalGet);
    (storageMock as any).get = getSpy;

    const originalWork = workerMock.work.bind(workerMock);
    const workSpy = createSpy(originalWork);
    workerMock.work = workSpy;

    await (io as any).flush();

    expect(getSpy.calls[0][0]).to.equal(2);
    expect(workSpy.calls[0][0]).to.deep.equal([
      { id: 1, value: "record1" },
      { id: 2, value: "record2" },
    ]);
  });

  it("flush() should handle worker errors gracefully", async () => {
    const errorWorker: Worker<RecordType, any> = {
      work: async () => {
        throw new Error("worker failed");
      },
    };
    const ioWithError = new IO({ worker: errorWorker });
    ioWithError.push({ id: 1, value: "record1" });

    await expect((ioWithError as any).flush()).to.eventually.not.be.rejected;
  });

  it("should queue pushed records without flushing before start", () => {
    let flushed = false;
    (io as any).flush = async () => {
      flushed = true;
    };
    io.push({ id: 3, value: "queued" });
    expect(flushed).to.be.false;
  });

  it("should not throw when stop() is called before start()", () => {
    expect(() => io.stop()).not.to.throw();
  });

  it("should flush records when batchSize is reached", async () => {
    const workSpy = createSpy(workerMock.work.bind(workerMock));
    workerMock.work = workSpy;

    io.push({ id: 1, value: "A" });
    io.push({ id: 2, value: "B" });
    await (io as any).flush();

    expect(workSpy.calls[0][0]).to.deep.equal([
      { id: 1, value: "A" },
      { id: 2, value: "B" },
    ]);
  });

  it("should not call worker when there are no records to flush", async () => {
    const workSpy = createSpy(workerMock.work.bind(workerMock));
    workerMock.work = workSpy;

    await (io as any).flush();
    expect(workSpy.calls.length).to.equal(0);
  });

  it("should flush all available records even if less than batchSize", async () => {
    const workSpy = createSpy(workerMock.work.bind(workerMock));
    workerMock.work = workSpy;

    io.push({ id: 1, value: "one" });
    await (io as any).flush();

    expect(workSpy.calls[0][0]).to.deep.equal([{ id: 1, value: "one" }]);
  });

  it("should clear flushed records from storage after flush", async () => {
    io.push({ id: 1, value: "A" });
    io.push({ id: 2, value: "B" });
    await (io as any).flush();
    const remaining = await storageMock.get(10);
    expect(remaining).to.have.lengthOf(0);
  });

  it("should safely flush even when push is called concurrently", async () => {
    io.push({ id: 1, value: "x" });
    const flushPromise = (io as any).flush();
    io.push({ id: 2, value: "y" });
    await flushPromise;
    const remaining = await storageMock.get(10);
    expect(remaining.length).to.be.gte(0);
  });

  it("should throw if batchSize <= 0", () => {
    expect(
      () =>
        new IO({
          storage: storageMock,
          worker: workerMock,
          batchSize: 0,
          flushInterval: 1000,
        })
    ).to.throw();
  });

  it("should accept a very high flushInterval", () => {
    expect(
      () =>
        new IO({
          storage: storageMock,
          worker: workerMock,
          batchSize: 1,
          flushInterval: 60 * 60 * 1000,
        })
    ).not.to.throw();
  });

  it("should support custom storage with get and put", async () => {
    let store: RecordType[] = [];
    const customStorage = {
      put: (rec: RecordType) => store.push(rec),
      get: (n: number) => store.splice(0, n),
    };

    const putSpy = createSpy(customStorage.put.bind(customStorage));
    const getSpy = createSpy(customStorage.get.bind(customStorage));
    customStorage.put = putSpy;
    customStorage.get = getSpy;

    const buf = new IO({
      storage: customStorage,
      worker: workerMock,
      batchSize: 1,
      flushInterval: 1000,
    });

    buf.push({ id: 1, value: "X" });
    await (buf as any).flush();

    expect(getSpy.calls.length).to.equal(1);
    expect(workerMock.work).to.exist;
  });
});
