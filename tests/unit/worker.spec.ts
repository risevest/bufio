import { expect } from "chai";
import { TestWorker } from "../helpers/worker";

describe("Worker", () => {
  it("TestWorker should process and store records", async () => {
    const worker = new TestWorker<string>();
    const inputRecords = ["a", "b", "c"];
    await worker.work(inputRecords);
    expect(worker.processed).to.deep.equal(inputRecords);
  });
});
