import { describe, expect, it } from "vitest";
import { SITE, websiteJsonLd } from "./seo";

describe("websiteJsonLd", () => {
  it("names the site so Google shows 'Apex Cinematics', not the domain", () => {
    expect(websiteJsonLd()).toEqual({
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Apex Cinematics",
      alternateName: ["Apex Cinematics SG", "apexcinematics.tech"],
      url: `${SITE}/`,
    });
  });
});
