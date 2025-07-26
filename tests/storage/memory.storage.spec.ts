import { MemoryStorage } from "../../src/storage";
import { expect } from "chai";
import { faker } from "@faker-js/faker";
import { multiply } from "../helpers";

type RecordType = { id: number; value: string };

function newRecord(extra?: Partial<RecordType>): RecordType {
  return {
    id: faker.number.int({ min: 1, max: 1000 }),
    value: faker.string.alphanumeric(10),
    ...extra,
  };
}

describe("MemoryStorage", () => {
  let storage: MemoryStorage<RecordType>;

  beforeEach(() => {
    storage = new MemoryStorage<RecordType>();
  });

  describe("constructor", () => {
    it("should initialize with an empty buffer", () => {
      expect(storage.get()).to.deep.equal([]);
    });
  });

  describe("put", () => {
    it("should store records using put()", () => {
      const record = newRecord();
      storage.put(record);

      const result = storage.get();
      expect(result).to.deep.equal([record]);
    });

    it("should mutate internal buffer after get()", () => {
      const rec1 = newRecord();
      const rec2 = newRecord();
      storage.put(rec1);
      storage.put(rec2);

      const first = storage.get(1);
      expect(first).to.deep.equal([rec1]);

      const second = storage.get();
      expect(second).to.deep.equal([rec2]);

      const third = storage.get();
      expect(third).to.deep.equal([]);
    });

    it("should handle putting undefined/null values", () => {
      storage.put(undefined as any);
      storage.put(null as any);
      
      const result = storage.get();
      expect(result).to.deep.equal([undefined, null]);
  });

      it("should maintain insertion order", () => {
      const records = Array.from({ length: 5 }, (_, i) => newRecord({ id: i }));
      records.forEach(r => storage.put(r));

      const result = storage.get();
      expect(result.map(r => r.id)).to.deep.equal([0, 1, 2, 3, 4]);
    });
  });





  describe("get", () => {
    it("should return all records if fewer than batchSize are present", () => {
      const records = multiply(2, newRecord);
      records.forEach((r) => storage.put(r));

      const result = storage.get(5);
      expect(result).to.deep.equal(records);

      const second = storage.get();
      expect(second).to.deep.equal([]);
    });

    it("should return up to batchSize records", () => {
      for (let i = 0; i < 10; i++) {
        storage.put(newRecord({ id: i }));
      }

      const batch = storage.get(4);
      expect(batch.length).to.equal(4);
      expect(batch.map((r) => r.id)).to.deep.equal([0, 1, 2, 3]);

      const remaining = storage.get();
      expect(remaining.length).to.equal(6);
    });

    it("should return an empty array if buffer is empty", () => {
      expect(storage.get()).to.deep.equal([]);
      expect(storage.get(10)).to.deep.equal([]);
    });

        it("should handle batchSize of 0", () => {
      const records = multiply(3, newRecord);
      records.forEach(r => storage.put(r));

      const result = storage.get(0);
      expect(result).to.deep.equal([]);
      

      const remaining = storage.get();
      expect(remaining).to.have.length(3);
    });
  });
});
