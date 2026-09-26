import { describe, expect, it } from "vitest";
import { splitImages } from "./ui";

const file = (name: string, type: string) => new File([new Uint8Array([1])], name, { type });

describe("splitImages", () => {
  it("keeps images, reports everything else by name", () => {
    const r = splitImages([file("a.jpg", "image/jpeg"), file("brief.pdf", "application/pdf"), file("b.webp", "image/webp")]);
    expect(r.images.map((f) => f.name)).toEqual(["a.jpg", "b.webp"]);
    expect(r.skipped).toEqual(["brief.pdf"]);
  });

  it("recognises iPhone HEIC files that arrive without a MIME type", () => {
    expect(splitImages([file("IMG_0001.HEIC", "")]).images).toHaveLength(1);
  });

  it("handles nothing selected", () => {
    expect(splitImages(null)).toEqual({ images: [], skipped: [] });
  });
});
