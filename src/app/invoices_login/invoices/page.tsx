import InvoiceList from "@/components/InvoiceList";

// ?tab=quotes opens the Quotes tab (e.g. after deleting a quote).
export default async function Home({ searchParams }: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  return <InvoiceList initialTab={tab === "quotes" ? "quotes" : "invoices"} />;
}
