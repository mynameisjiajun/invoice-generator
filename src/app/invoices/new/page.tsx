import InvoiceForm from "@/components/InvoiceForm";

export default async function NewInvoicePage({ searchParams }: {
  searchParams: Promise<{ duplicate?: string; draft?: string }>;
}) {
  const { duplicate, draft } = await searchParams;
  return <InvoiceForm duplicateId={duplicate} draftId={draft} />;
}
