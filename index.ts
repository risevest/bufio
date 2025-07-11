import { BufIO } from "./bufio";
import { MemoryStorage } from "./memoryStorage";
// import { FileStorage } from "./fileStorage";
import { simulateJobProducer } from "./jobProducer";

type Job = { id: number; payload: string };

let id = 1;
const generator = () => ({
  id: id++,
  payload: id % 10 === 0 ? "fail" : `data-${id}`,
});

const memoryBufio = new BufIO<Job, Job>({
  storage: new MemoryStorage<Job>(),
  worker: {
    async work(records) {
      console.log("[Worker] Processing:", records);
      if (records.some((r) => r.payload === "fail"))
        throw new Error("Intentional failure");
      return records;
    },
  },
  batchSize: 5,
  flushInterval: 10000,
  onError: (err, records) =>
    console.warn("Dead-letter queue simulation:", records),
});

memoryBufio.start();
simulateJobProducer(memoryBufio, generator, 25, 300);
