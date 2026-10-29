import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { openPhotoPicker } from "../src/lib/photo-picker";

class Picker extends EventTarget {
  type = "";
  accept = "";
  className = "";
  tabIndex = 0;
  files: File[] = [];
  clicks = 0;
  removed = false;
  click() { this.clicks++; }
  remove() { this.removed = true; }
}

describe("photo picker lifecycle", () => {
  let inputs: Picker[];
  let doc: EventTarget & { visibilityState: string };
  let win: EventTarget;
  let tasks: Map<number, () => void>;
  let id: number;
  const original = Object.getOwnPropertyDescriptors(globalThis);
  beforeEach(() => {
    inputs = [];
    tasks = new Map();
    id = 0;
    doc = Object.assign(new EventTarget(), {
      visibilityState: "visible",
      body: { appendChild: () => {} },
      createElement: () => { const input = new Picker(); inputs.push(input); return input; },
    });
    win = new EventTarget();
    Object.assign(globalThis, {
      document: doc, window: win,
      setInterval: (fn: () => void) => { tasks.set(++id, fn); return id; },
      setTimeout: (fn: () => void) => { tasks.set(++id, fn); return id; },
      clearInterval: (key: number) => tasks.delete(key),
      clearTimeout: (key: number) => tasks.delete(key),
    });
  });
  afterEach(() => {
    for (const key of ["document", "window", "setInterval", "setTimeout", "clearInterval", "clearTimeout"]) {
      const descriptor = original[key];
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  });
  const current = () => {
    const input = inputs.at(-1);
    if (!input) throw new Error("Picker did not open");
    return input;
  };
  test("native cancel allows repeated reopening without delivering an empty photo", () => {
    const files: File[] = [];
    for (let n = 0; n < 4; n++) {
      openPhotoPicker(f => files.push(f), "image/*");
      expect(current().clicks).toBe(1);
      current().dispatchEvent(new Event("cancel"));
      expect(current().removed).toBe(true);
      expect(tasks.size).toBe(0);
    }
    expect(new Set(inputs).size).toBe(4);
    expect(files).toEqual([]);
  });
  test("empty change preserves the existing selected image", () => {
    let selected = new File(["existing"], "existing.jpg");
    openPhotoPicker(f => { selected = f; });
    current().dispatchEvent(new Event("change"));
    expect(selected.name).toBe("existing.jpg");
    expect(tasks.size).toBe(0);
  });
  test.each(["focus", "pageshow", "visibilitychange"])("return via %s without change cleans the cancelled session", event => {
    openPhotoPicker(() => { throw new Error("Cancellation delivered a file"); });
    (event === "visibilitychange" ? doc : win).dispatchEvent(new Event(event));
    for (const fn of [...tasks.values()]) fn();
    expect(current().removed).toBe(true);
    expect(tasks.size).toBe(0);
    const cleanup = openPhotoPicker(() => {});
    expect(current().clicks).toBe(1);
    cleanup();
  });
  test("delayed file after return is delivered once and cancels pending callbacks", () => {
    const files: File[] = [];
    openPhotoPicker(f => files.push(f));
    win.dispatchEvent(new Event("focus"));
    const pending = [...tasks.values()];
    const photo = new File(["photo"], "photo.jpg");
    current().files = [photo];
    current().dispatchEvent(new Event("change"));
    pending.forEach(fn => fn());
    expect(files).toEqual([photo]);
    expect(tasks.size).toBe(0);
  });
  test("reopening and unmount discard stale callbacks", () => {
    const files: File[] = [];
    const cleanup = openPhotoPicker(f => files.push(f));
    const stale = current();
    const pending = [...tasks.values()];
    cleanup();
    const close = openPhotoPicker(f => files.push(f));
    stale.files = [new File(["stale"], "old.jpg")];
    stale.dispatchEvent(new Event("change"));
    pending.forEach(fn => fn());
    close();
    expect(files).toEqual([]);
    expect(tasks.size).toBe(0);
  });
});