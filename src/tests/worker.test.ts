import { Worker } from "../worker";

type TestRecord = { num: number };

class TestWorker extends Worker<TestRecord, number> {
  async work(records: TestRecord[]): Promise<number[]> {
    return records.map((r) => r.num * 2);
  }
}

describe("Worker", () => {
  it("should process records correctly", async () => {
    const worker = new TestWorker();
    const records = [{ num: 2 }, { num: 5 }];

    const results = await worker.work(records);

    expect(results).toEqual([4, 10]);
  });

    it("should handle empty records", async () => {
        const worker = new TestWorker();
        const results = await worker.work([]);
    
        expect(results).toEqual([]);
    });
});
