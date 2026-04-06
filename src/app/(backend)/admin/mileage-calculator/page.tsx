import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import MileageCalculatorClient from "./MileageCalculatorClient";

export default async function MileageCalculatorPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in?returnTo=/admin/mileage-calculator");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("type")
    .eq("id", user.id)
    .single();

  const userType = profile?.type?.toLowerCase() || "";

  if (!profile || !["admin", "super_admin", "helpdesk"].includes(userType)) {
    redirect("/");
  }

  return <MileageCalculatorClient userType={userType} />;
}
