import fs from "fs";
import path from "path";
import { Storage } from "./types";

export class FileStorage<T> implements Storage<T> {
  private filepath: string;

  constructor(filename: string = "buffer.json") {
    this.filepath = path.resolve(__dirname, filename);
    fs.writeFileSync(this.filepath, "[]");
  }

  put(record: T) {
    const data = this.get();
    data.push(record);
    fs.writeFileSync(this.filepath, JSON.stringify(data, null, 2));
  }

  get(start = 0, end?: number): T[] {
    const raw = fs.readFileSync(this.filepath, "utf-8");
    const all: T[] = JSON.parse(raw);
    const slice = all.slice(start, end);
    const remaining = all.slice(slice.length);
    fs.writeFileSync(this.filepath, JSON.stringify(remaining));
    return slice;
  }
}
