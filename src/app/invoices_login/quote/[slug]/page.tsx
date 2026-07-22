import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import QuoteCalculator from "@/components/QuoteCalculator";

export default async function QuotePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createServerSupabase();

  const { data: business } = await supabase
    .from("businesses")
    .select("id,name,slug")
    .eq("slug", slug)
    .is("archived_at", null)
    .maybeSingle();
  if (!business) notFound();

  const { data: settings } = await supabase
    .from("print_pricing_settings")
    .select("*")
    .eq("business_id", business.id)
    .maybeSingle();
  if (!settings) notFound();

  return <QuoteCalculator business={business} settings={settings} />;
}
