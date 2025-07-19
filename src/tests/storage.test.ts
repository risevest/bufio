import { MemoryStorage } from "../storage/memory";

describe("MemoryStorage", () => {
  it("should store and retrieve records", () => {
    const storage = new MemoryStorage<number>();

    storage.put(1);
    storage.put(2);

    const records = storage.get();

    expect(records).toEqual([1, 2]);
  });

  it("should clear buffer after get()", () => {
    const storage = new MemoryStorage<number>();

    storage.put(3);
    storage.get(); 

    expect(storage.get()).toEqual([]); 
  });
});



