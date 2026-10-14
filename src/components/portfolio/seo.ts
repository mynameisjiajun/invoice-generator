// Brand signals for Google. "Apex Cinematics" collides with Apex Legends'
// cinematic trailers, so the site states its name, alternate names and
// Singapore focus explicitly instead of leaving Google to guess.
export const SITE = "https://apexcinematics.tech";

/** Site-name structured data: what Google prints above the result title. */
export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Apex Cinematics",
    alternateName: ["Apex Cinematics SG", "apexcinematics.tech"],
    url: `${SITE}/`,
  };
}
