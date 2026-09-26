import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPortfolio, getProject } from "@/lib/portfolio/data";
import ProjectDetail from "@/components/portfolio/ProjectDetail";

export const revalidate = 3600;

// Pre-builds the current projects; ones added later render on first visit.
export async function generateStaticParams() {
  const { projects } = await getPortfolio();
  return projects.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const project = await getProject(slug);
  if (!project) return {};
  return {
    title: `${project.title} | Apex Cinematics`,
    description: project.story,
    alternates: { canonical: `https://apexcinematics.tech/work/${project.slug}` },
    openGraph: {
      type: "article", siteName: "Apex Cinematics", locale: "en_SG",
      title: project.title, description: project.story, images: project.cover ? [project.cover] : [],
    },
    twitter: { card: "summary_large_image", title: project.title, description: project.story, images: project.cover ? [project.cover] : [] },
  };
}

export default async function WorkPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = await getProject(slug);
  if (!project) notFound();
  return <ProjectDetail project={project} />;
}
