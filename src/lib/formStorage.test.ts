import { beforeEach, describe, expect, test, vi } from "vitest";
import { loadForm, storeForm, clearForm, emptyForm } from "./formStorage";
import { plusDaysIso, todayLocalIso } from "./date";

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

describe("stale dates on a restored form", () => {
  const today = todayLocalIso();
  const stale = { ...emptyForm(), issueDate: "2026-01-05", dueDate: "2026-02-04" };

  test("rolls an untouched issue date forward to today", () => {
    // The form autosaves on every keystroke and is restored days later. Left
    // alone, the invoice goes out dated whenever the form was last typed in.
    storeForm(stale);
    const restored = loadForm()!;
    expect(restored.issueDate).toBe(today);
  });

  test("an untouched due date keeps tracking issue + 30", () => {
    storeForm(stale);
    expect(loadForm()!.dueDate).toBe(plusDaysIso(today, 30));
  });

  test("never overwrites a deliberately backdated invoice", () => {
    // Invoicing last month's job. The owner chose this date on purpose.
    storeForm({ ...stale, issueTouched: true });
    const restored = loadForm()!;
    expect(restored.issueDate).toBe("2026-01-05");
    expect(restored.dueDate).toBe("2026-02-04");
  });

  test("keeps a hand-set due date while still refreshing the issue date", () => {
    storeForm({ ...stale, dueDate: "2026-01-12", dueTouched: true });
    const restored = loadForm()!;
    expect(restored.issueDate).toBe(today);
    expect(restored.dueDate).toBe("2026-01-12");
  });

  test("treats a form saved before the flags existed as untouched", () => {
    // Forms already in localStorage have no issueTouched/dueTouched fields.
    const legacy = { ...emptyForm(), issueDate: "2026-01-05", dueDate: "2026-02-04" };
    delete (legacy as Partial<typeof legacy>).issueTouched;
    delete (legacy as Partial<typeof legacy>).dueTouched;
    storeForm(legacy);
    expect(loadForm()!.issueDate).toBe(today);
  });

  test("a form saved today is returned untouched", () => {
    const fresh = { ...emptyForm(), jobEvent: "Today's shoot" };
    storeForm(fresh);
    expect(loadForm()).toEqual(fresh);
  });
});
