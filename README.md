# BufIO  
_A Configurable Buffered I/O Library for Efficient Batch Processing_

---

## Overview

**BufIO** is a generic, configurable, and storage-agnostic buffered input/output library designed to improve the performance of systems that process high-frequency background jobs. Inspired by the widely used **write-behind caching** strategy in operating systems, file systems, databases, and distributed caches, BufIO optimizes throughput by **buffering records and processing them in batches at configurable intervals**.

BufIO decouples record ingestion from processing, allowing you to push records quickly without immediately writing to a database or external service. This design reduces resource consumption, lowers connection churn, and increases system scalability.

---

## Key Features
- **Push-based API** for fast record ingestion.
- **Configurable batch size and flush interval.**
- **Pluggable storage system** (in-memory, database, file, etc.).
- **Pluggable worker processor** (e.g., DB insert, API call).
- Extensible: supports backpressure, priority queues, and retries (future roadmap).
- Built on proven **write-behind caching principles**.

---

## Use Cases
- Background job batching
- Database write optimization
- Buffered API calls
- Log processing
- Metrics aggregation

---

## Getting Started

### Installation
```bash
yarn add @risemaxi/bufio
```

### Basic Example
```typescript
import { BufIO, MemoryStorage } from '@risemaxi/bufio';

const memory = new MemoryStorage<RecordType>();

const worker = {
  async work(records: RecordType[]) {
    await db.batchInsert(records); // Example batch write
    return records;
  }
};

const bufio = new BufIO({
  storage: memory,
  worker,
  batchSize: 50,
  flushInterval: 3000
});

bufio.start();

// Push records (e.g., in a job consumer)
queueConsumer.on('job', (job) => {
  bufio.push(job.payload);
});
```

---

## Configuration Options

| Option          | Description                            | Default   |
|-----------------|----------------------------------------|-----------|
| `batchSize`     | Number of records to flush per batch    | 100       |
| `flushInterval` | Interval (ms) to flush buffered records | 5000 ms   |

---

## Architecture

```plaintext
Job Producer
    |
    v
bufio.push(record)
    |
    v
User-provided Storage <--- flush() ---> Worker.process(records)
```

BufIO acts as a write-behind buffer, periodically flushing stored records in configurable batches.

---

## Why BufIO?

BufIO addresses a common bottleneck in high-throughput systems: frequent individual writes to databases or services. By buffering records and processing them in batches, BufIO improves system efficiency and scalability while remaining decoupled and easy to integrate into any architecture.

---

## Contributing

Contributions are welcome! Please open issues, suggest features, or submit pull requests as we continue to develop BufIO into a stable, open-source library.

---

## License

MIT License