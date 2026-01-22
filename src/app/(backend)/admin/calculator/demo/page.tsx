// Admin Demo Calculator - Shows driver earnings for internal use
// Protected route - only accessible to admin, super_admin, and helpdesk users

import { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import MultiStopCalculatorDemo from "@/components/calculator/MultiStopCalculatorDemo";

export const metadata: Metadata = {
  title: "Calculator Demo (Admin) | Ready Set",
  description: "Internal delivery cost calculator with driver earnings breakdown.",
};

export default async function AdminCalculatorDemoPage() {
  // Server-side authentication check
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in?returnTo=/admin/calculator/demo");
  }

  // Check user role
  const { data: profile } = await supabase
    .from("profiles")
    .select("type")
    .eq("id", user.id)
    .single();

  const userType = profile?.type?.toLowerCase() || '';

  if (!profile || !["admin", "super_admin", "helpdesk"].includes(userType)) {
    redirect("/");
  }

  return <MultiStopCalculatorDemo showDriverEarnings={true} />;
}
