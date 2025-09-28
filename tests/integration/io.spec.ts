import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { IO } from "../../src/io";
import { MemoryStorage } from "../../src/storage/memory";
import { Worker } from "../../src/worker";
import { TestWorker } from "../helpers/worker";

chai.use(chaiAsPromised);

type RecordType = { id: number; value: string };

describe("IO Integration", () => {
  let storage: MemoryStorage<RecordType>;
  let worker: TestWorker<RecordType>;
  let io: IO<RecordType, RecordType>;

  beforeEach(() => {
    storage = new MemoryStorage<RecordType>();
    worker = new TestWorker();
    io = new IO({
      storage,
      worker,
      batchSize: 2,
      flushInterval: 100,
    });
  });

  afterEach(() => {
    io.stop();
  });

  it("should initialize with MemoryStorage and Worker", () => {
    expect(io).to.have.property("storage").that.equals(storage);
    expect(io).to.have.property("worker").that.equals(worker);
  });

  it("should push records into storage correctly", () => {
    io.push({ id: 1, value: "A" });
    io.push({ id: 2, value: "B" });
    const records = storage.get(10);
    expect(records).to.deep.equal([
      { id: 1, value: "A" },
      { id: 2, value: "B" },
    ]);
  });

  it("should flush records manually", async () => {
    io.push({ id: 1, value: "A" });
    io.push({ id: 2, value: "B" });

    await (io as any).flush();

    expect(worker.processed).to.deep.equal([
      { id: 1, value: "A" },
      { id: 2, value: "B" },
    ]);

    const remaining = storage.get(10);
    expect(remaining).to.be.empty;
  });

  it("should automatically flush records at interval", async () => {
    io.start();
    io.push({ id: 1, value: "X" });
    io.push({ id: 2, value: "Y" });

    await new Promise((resolve) => setTimeout(resolve, 200)); // wait for interval flush

    expect(worker.processed).to.deep.include.members([
      { id: 1, value: "X" },
      { id: 2, value: "Y" },
    ]);
  });

  it("should respect batchSize when flushing", async () => {
    io.push({ id: 1, value: "one" });
    io.push({ id: 2, value: "two" });
    io.push({ id: 3, value: "three" });

    await (io as any).flush();

    // first 2 processed, 1 left in storage
    expect(worker.processed).to.deep.equal([
      { id: 1, value: "one" },
      { id: 2, value: "two" },
    ]);
    expect(storage.get(10)).to.deep.equal([{ id: 3, value: "three" }]);
  });

  it("should handle worker errors gracefully", async () => {
    class FailingWorker implements Worker<RecordType, RecordType> {
      async work(): Promise<RecordType[]> {
        throw new Error("worker failed");
      }
    }
    const failingIO = new IO({
      storage: new MemoryStorage<RecordType>(),
      worker: new FailingWorker(),
      batchSize: 2,
      flushInterval: 100,
    });
    failingIO.push({ id: 99, value: "bad" });

    await expect((failingIO as any).flush()).to.be.fulfilled;
  });

  it("should stop flushing when stop() is called", async () => {
    io.start();
    io.stop();

    io.push({ id: 1, value: "stop-test" });
    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(worker.processed).to.not.deep.include({ id: 1, value: "stop-test" });
  });

  it("should handle concurrent push and flush safely", async () => {
    io.push({ id: 1, value: "X" });
    const flushPromise = (io as any).flush();
    io.push({ id: 2, value: "Y" });
    await flushPromise;

    // at least one record should remain in storage, but none should be lost
    const all = [...worker.processed, ...storage.get(10)];
    expect(all).to.deep.include.members([
      { id: 1, value: "X" },
      { id: 2, value: "Y" },
    ]);
  });
});
