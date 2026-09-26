import type { Metadata } from "next";
import Portfolio from "@/components/portfolio/Portfolio";
import { getPortfolio } from "@/lib/portfolio/data";

// Content is edited at /invoices_login/portfolio; saving there refreshes this
// page immediately. The hourly revalidate is only a backstop.
export const revalidate = 3600;

const SITE = "https://apexcinematics.tech";
const TITLE = "Apex Cinematics | Videography & Photography, Singapore";
const DESCRIPTION =
  "Photo and film for events, stories and brands in Singapore. Event coverage, documentaries and social media content by Apex Cinematics.";

// Link previews (WhatsApp, Instagram, iMessage, LinkedIn…) use the lead
// photo project's cover, so the preview changes along with the site.
export async function generateMetadata(): Promise<Metadata> {
  const { projects } = await getPortfolio();
  const image = projects.find((p) => p.cover && !p.cover.includes("ytimg.com"))?.cover ?? projects[0]?.cover;
  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: SITE },
    openGraph: {
      type: "website",
      url: SITE,
      siteName: "Apex Cinematics",
      locale: "en_SG",
      title: TITLE,
      description: DESCRIPTION,
      images: image ? [{ url: image, alt: "Work by Apex Cinematics" }] : [],
    },
    twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: image ? [image] : [] },
  };
}

export default async function HomePage() {
  const { projects, aboutPhoto } = await getPortfolio();

  // Tells Google this is a Singapore photo/video business (for local results
  // and the business panel), not just a page of pictures.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name: "Apex Cinematics",
    url: SITE,
    description: DESCRIPTION,
    email: "chuajiajun2705@gmail.com",
    image: projects.map((p) => p.cover).filter((c): c is string => !!c).slice(0, 3).map((c) => new URL(c, SITE).toString()),
    founder: { "@type": "Person", name: "Chua Jia Jun" },
    address: { "@type": "PostalAddress", addressLocality: "Singapore", addressCountry: "SG" },
    areaServed: { "@type": "Country", name: "Singapore" },
    knowsAbout: ["Event videography", "Event photography", "Documentary film", "Social media content"],
    sameAs: ["https://www.instagram.com/mynameisjiajun"],
  };

  return (
    <>
      <script
        type="application/ld+json"
        // Server-built JSON (fixed strings + project cover URLs). "<" is
        // escaped per the Next.js JSON-LD guide so no value can close the tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <Portfolio projects={projects} aboutPhoto={aboutPhoto} />
    </>
  );
}
