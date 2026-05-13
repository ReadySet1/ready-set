import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import DrivesCalculatorClient from "./DrivesCalculatorClient";

export default async function DrivesCalculatorPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in?returnTo=/admin/drives-calculator");
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

  return <DrivesCalculatorClient userType={userType} />;
}
