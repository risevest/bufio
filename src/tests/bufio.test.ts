import { BufIO } from "../io";
import { Worker } from "../worker";
import { MemoryStorage } from "../storage/memory";

type TestRecord = { num: number };


class TestWorker extends Worker<TestRecord, number> {
  processed: TestRecord[] = [];

  async work(records: TestRecord[]): Promise<number[]> {
    this.processed.push(...records);
    return records.map((r) => r.num * 2);
  }
}

describe("BufIO", () => {
  it("should flush records and call worker", async () => {
    const worker = new TestWorker();
    const storage = new MemoryStorage<TestRecord>();

    const bufio = new BufIO<TestRecord, number>({
      worker,
      storage,
      flushInterval: 1000
    });

    bufio.push({ num: 2 });
    bufio.push({ num: 3 });


    // @ts-ignore
    const result = await bufio["flush"]();

    expect(worker.processed).toEqual([{ num: 2 }, { num: 3 }]);
    // expect(result).toEqual([4, 6]);
  });

  it("should call onError if worker fails", async () => {
    class FailingWorker extends Worker<TestRecord, boolean> {
      async work(): Promise<boolean[]> {
        throw new Error("Worker failed");
      }
    }

    const onErrorMock = jest.fn();

    const bufio = new BufIO<TestRecord, boolean>({
      worker: new FailingWorker(),
      onError: onErrorMock
    });

    bufio.push({ num: 3 });

    // @ts-ignore
    await bufio["flush"]();

    expect(onErrorMock).toHaveBeenCalled();
    expect(onErrorMock.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(onErrorMock.mock.calls[0][1]).toEqual([{ num: 3 }]);
  });
});
