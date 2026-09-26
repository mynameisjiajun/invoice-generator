import { describe, expect, it } from "vitest";
import { parseYouTubeId, photoUrl, rowsToProjects, type PhotoRow, type ProjectRow } from "./projects";

const SB = "https://abc.supabase.co";

const row = (over: Partial<ProjectRow>): ProjectRow => ({
  id: "p1", slug: "shoot", title: "Shoot", type: "photo", story: "Story", tags: [],
  youtube_id: null, instagram_url: null, cover: null, position: 0, published: true, ...over,
});
const photo = (over: Partial<PhotoRow>): PhotoRow => ({
  id: "f1", project_id: "p1", path: "shoot/a.jpg", alt: "", position: 0, ...over,
});

describe("photoUrl", () => {
  it("turns a storage path into the public bucket URL", () => {
    expect(photoUrl("shoot/a b.jpg", SB)).toBe(`${SB}/storage/v1/object/public/portfolio/shoot/a%20b.jpg`);
  });
  it("leaves full URLs and site-relative paths alone", () => {
    expect(photoUrl("https://i.ytimg.com/vi/x/maxresdefault.jpg", SB)).toBe("https://i.ytimg.com/vi/x/maxresdefault.jpg");
    expect(photoUrl("/work/ggs-iceland.jpg", SB)).toBe("/work/ggs-iceland.jpg");
  });
});

describe("parseYouTubeId", () => {
  it.each([
    ["QsSV2IPbqhA", "QsSV2IPbqhA"],
    ["https://www.youtube.com/watch?v=QsSV2IPbqhA&t=10s", "QsSV2IPbqhA"],
    ["https://youtu.be/QsSV2IPbqhA?si=abc", "QsSV2IPbqhA"],
    ["https://www.youtube.com/shorts/QsSV2IPbqhA", "QsSV2IPbqhA"],
    ["https://www.youtube.com/embed/QsSV2IPbqhA", "QsSV2IPbqhA"],
    ["  https://m.youtube.com/watch?feature=share&v=QsSV2IPbqhA ", "QsSV2IPbqhA"],
  ])("%s → %s", (input, id) => {
    expect(parseYouTubeId(input)).toBe(id);
  });
  it("rejects things that aren't YouTube videos", () => {
    expect(parseYouTubeId("https://instagram.com/p/xyz")).toBeNull();
    expect(parseYouTubeId("")).toBeNull();
  });
});

describe("rowsToProjects", () => {
  it("sorts projects and photos by position and builds URLs", () => {
    const out = rowsToProjects(
      [row({ id: "b", slug: "b", position: 2 }), row({ id: "a", slug: "a", position: 1 })],
      [photo({ id: "2", project_id: "a", path: "a/2.jpg", position: 1 }), photo({ id: "1", project_id: "a", path: "a/1.jpg", position: 0 })],
      SB,
    );
    expect(out.map((p) => p.slug)).toEqual(["a", "b"]);
    expect(out[0].photos.map((p) => p.src)).toEqual([
      `${SB}/storage/v1/object/public/portfolio/a/1.jpg`,
      `${SB}/storage/v1/object/public/portfolio/a/2.jpg`,
    ]);
    expect(out[1].photos).toEqual([]);
  });

  it("cover: explicit, else first photo, else YouTube thumbnail, else none", () => {
    const [explicit, first, yt, none] = rowsToProjects(
      [
        row({ id: "e", position: 0, cover: "e/cover.jpg" }),
        row({ id: "f", position: 1 }),
        row({ id: "y", position: 2, type: "video", youtube_id: "QsSV2IPbqhA" }),
        row({ id: "n", position: 3, type: "video", instagram_url: "https://instagram.com/reel/x" }),
      ],
      [photo({ project_id: "e", path: "e/1.jpg" }), photo({ id: "g", project_id: "f", path: "f/1.jpg" })],
      SB,
    );
    expect(explicit.cover).toBe(`${SB}/storage/v1/object/public/portfolio/e/cover.jpg`);
    expect(first.cover).toBe(`${SB}/storage/v1/object/public/portfolio/f/1.jpg`);
    expect(yt.cover).toBe("https://i.ytimg.com/vi/QsSV2IPbqhA/maxresdefault.jpg");
    expect(none.cover).toBeUndefined();
  });

  it("fills in alt text when a photo has none", () => {
    const [p] = rowsToProjects([row({ title: "Car Care" })], [photo({ alt: "" })], SB);
    expect(p.photos[0].alt).toBe("Car Care — photo 1");
  });
});
