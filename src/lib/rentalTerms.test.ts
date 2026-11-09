import { describe, expect, it } from "vitest";
import { RENTAL_ACK, RENTAL_TERMS, rentalTermsPlainText } from "./rentalTerms";

describe("rental terms", () => {
  it("has sections 1-12 in order", () => {
    expect(RENTAL_TERMS.map((s) => s.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it("resolves every 'Section X.Y' cross-reference to a real clause", () => {
    const refs = [...rentalTermsPlainText().matchAll(/Section (\d+)\.(\d+)/g)];
    expect(refs.length).toBeGreaterThan(3);
    for (const [ref, sec, clause] of refs) {
      const s = RENTAL_TERMS.find((x) => x.n === Number(sec));
      expect(s, ref).toBeDefined();
      expect(s!.clauses.length, ref).toBeGreaterThanOrEqual(Number(clause));
    }
  });

  it("keeps the clauses the acknowledgement and cross-references point at", () => {
    const clause = (n: number, i: number) => RENTAL_TERMS[n - 1].clauses[i - 1];
    expect(clause(4, 1).lead).toBe("Inspection at collection:");
    expect(clause(2, 4).text).toMatch(/^All amounts are in Singapore Dollars/);
    expect(clause(6, 4).lead).toBe("Loss, theft or irreparable damage:");
    expect(clause(11, 6).lead).toBe("Renting for a company:");
  });

  it("states the invoice number is recorded on the signature section", () => {
    expect(RENTAL_TERMS[0].clauses[1].text).toContain("The invoice number is recorded on the signature section");
  });

  it("has the four acknowledgement points", () => {
    expect(RENTAL_ACK.points).toHaveLength(4);
  });
});
