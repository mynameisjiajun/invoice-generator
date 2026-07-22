import { describe, expect, it } from "vitest";
import { PROJECTS, getProject, projectSlugs } from "./projects";

describe("portfolio projects data", () => {
  it("has at least one project and unique slugs", () => {
    expect(PROJECTS.length).toBeGreaterThan(0);
    const slugs = projectSlugs();
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("every project has the fields the pages rely on", () => {
    for (const p of PROJECTS) {
      expect(p.slug).toMatch(/^[a-z0-9-]+$/);
      expect(p.title.length).toBeGreaterThan(0);
      expect(["video", "photo"]).toContain(p.type);
      expect(p.cover.length).toBeGreaterThan(0);
      expect(p.story.length).toBeGreaterThan(0);
      expect(p.photos.length).toBeGreaterThan(0);
    }
  });

  it("never mentions gear or drones in tags/copy (user has neither)", () => {
    const banned = /sony|a7s|drone|lens|glass/i;
    for (const p of PROJECTS) {
      expect(p.tags.join(" ")).not.toMatch(banned);
      expect(p.story).not.toMatch(banned);
    }
  });

  it("getProject finds by slug and returns undefined for unknown", () => {
    expect(getProject(PROJECTS[0].slug)).toBe(PROJECTS[0]);
    expect(getProject("nope")).toBeUndefined();
  });
});
