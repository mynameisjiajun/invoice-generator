import { beforeEach, describe, expect, test, vi } from "vitest";
import { loadForm, storeForm, clearForm, emptyForm } from "./formStorage";

const mem = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
});

describe("formStorage", () => {
  beforeEach(() => mem.clear());

  test("round-trips a form", () => {
    const f = { ...emptyForm(), jobEvent: "Birthday Shoot" };
    storeForm(f);
    expect(loadForm()).toEqual(f);
  });

  test("returns null when empty or corrupt", () => {
    expect(loadForm()).toBeNull();
    mem.set("jjv.invoice.form.v1", "{not json");
    expect(loadForm()).toBeNull();
  });

  test("clearForm removes", () => {
    storeForm(emptyForm());
    clearForm();
    expect(loadForm()).toBeNull();
  });

  test("emptyForm defaults issueDate to today", () => {
    expect(emptyForm().issueDate).toBe(new Date().toISOString().slice(0, 10));
  });
});
