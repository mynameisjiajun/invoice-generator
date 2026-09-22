import { describe, expect, it } from "vitest";
import { displayText, parseAmount, simulateTyping } from "./numberInput";

describe("displayText", () => {
  it("lets the in-progress draft win over the parsed number", () => {
    // The crux of the fix: "87." must survive on screen even though the
    // model has already rounded it to 87.
    expect(displayText("87.", 87)).toBe("87.");
    expect(displayText("", 0)).toBe("");
    expect(displayText("0.", 0)).toBe("0.");
  });
  it("derives from the number once editing has finished", () => {
    expect(displayText(null, 87.5)).toBe("87.5");
    expect(displayText(null, 450)).toBe("450");
  });
  it("shows 0 as empty so the placeholder stays visible", () => {
    expect(displayText(null, 0)).toBe("");
  });
});

describe("parseAmount", () => {
  it.each([
    ["87.50", 87.5],
    ["87.", 87],
    ["0.5", 0.5],
    [".5", 0.5],
    ["450", 450],
    ["", 0],
    [".", 0],
    ["abc", 0],
  ])("%s -> %s", (text, expected) => {
    expect(parseAmount(text)).toBe(expected);
  });
});

describe("simulateTyping — the 100x regression guard", () => {
  it("types a price with cents without shifting the decimal", () => {
    // Before the fix this returned 8750: the controlled value rewrote the
    // text on every keystroke, dropping the "." and shifting every digit
    // after it one place left. A silent 100x error on a real invoice.
    expect(simulateTyping("87.50")).toEqual({ text: "87.50", value: 87.5 });
  });

  it.each([
    ["87.50", 87.5],
    ["1.5", 1.5],
    ["0.5", 0.5],
    ["12.05", 12.05],
    ["450", 450],
    ["1234.56", 1234.56],
  ])("typing %s yields %s", (keys, expected) => {
    expect(simulateTyping(keys).value).toBe(expected);
  });

  it("re-normalises the text on blur but never changes the value", () => {
    expect(simulateTyping("87.", { commit: true })).toEqual({ text: "87", value: 87 });
    expect(simulateTyping("007", { commit: true })).toEqual({ text: "7", value: 7 });
    expect(simulateTyping("87.50", { commit: true })).toEqual({ text: "87.5", value: 87.5 });
  });

  it("leaves an emptied field at zero rather than NaN", () => {
    expect(simulateTyping("", { commit: true })).toEqual({ text: "", value: 0 });
  });
});
