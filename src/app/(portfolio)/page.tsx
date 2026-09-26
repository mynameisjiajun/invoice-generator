import Portfolio from "@/components/portfolio/Portfolio";
import { getPortfolio } from "@/lib/portfolio/data";

// Content is edited at /invoices_login/portfolio; saving there refreshes this
// page immediately. The hourly revalidate is only a backstop.
export const revalidate = 3600;

export default async function HomePage() {
  const { projects, aboutPhoto } = await getPortfolio();
  return <Portfolio projects={projects} aboutPhoto={aboutPhoto} />;
}
