import InvoiceForm from "@/components/InvoiceForm";

export default async function NewInvoicePage({ searchParams }: {
  searchParams: Promise<{ duplicate?: string; draft?: string; customer?: string; job?: string; jobDate?: string }>;
}) {
  const { duplicate, draft, customer, job, jobDate } = await searchParams;
  // ?customer=…&job=…&jobDate=… — used by "Create invoice" on a website enquiry.
  const customerId = customer ? Number(customer) : NaN;
  const prefill = Number.isInteger(customerId) && customerId > 0
    ? { customerId, jobEvent: job?.slice(0, 120), jobDate: jobDate?.slice(0, 80) }
    : undefined;
  return <InvoiceForm duplicateId={duplicate} draftId={draft} prefill={prefill} />;
}
