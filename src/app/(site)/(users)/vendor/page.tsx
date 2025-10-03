import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function VendorDashboardPage() {
  const user = await getCurrentUser();

  // Ensure user is logged in, otherwise send to sign-in page
  if (!user) {
    redirect("/sign-in");
  }

  // Redirect all authenticated traffic to the unified dashboard
  redirect("/client");
}
