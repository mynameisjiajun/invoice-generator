import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

// Words the owner never wants on the public site: no travel, no revision
// counts, no packages/pricing hints, no Telegram/WhatsApp contact.
const FORBIDDEN = /travel|revision|package|overseas|whatsapp|telegram|t\.me\/|#rates/i;

// Code comments may mention these freely; only shipped copy and markup count.
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const PUBLIC_DIRS = ["src/components/portfolio", "src/app/(portfolio)"];
const publicSources = () =>
  PUBLIC_DIRS.flatMap((dir) =>
    fs.readdirSync(dir, { recursive: true, encoding: "utf8" })
      .filter((f) => /\.(tsx?|json)$/.test(f) && !f.includes(".test."))
      .map((f) => path.join(dir, f)),
  );

describe("public copy guard", () => {
  it("ignores comments but catches copy", () => {
    expect(FORBIDDEN.test(stripComments("// WhatsApp previews\nconst a = 1;"))).toBe(false);
    expect(FORBIDDEN.test(stripComments('<p>Based in Singapore · Available for travel</p>'))).toBe(true);
    expect(stripComments('href="https://www.instagram.com/x"')).toContain("instagram.com/x");
  });

  it("no public page or component mentions a forbidden topic", () => {
    const offenders = publicSources().flatMap((file) =>
      stripComments(fs.readFileSync(file, "utf8"))
        .split("\n")
        .filter((line) => FORBIDDEN.test(line))
        .map((line) => `${file}: ${line.trim()}`),
    );
    expect(offenders).toEqual([]);
  });
});
