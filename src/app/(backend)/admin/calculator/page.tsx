// Delivery Calculator System - Admin Interface (Updated to use Ready Set Food template)
// Flexible calculator system for all delivery types

import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import CalculatorClient from "./CalculatorClient";

// Server component for authentication and protection
export default async function CalculatorPage() {
  // Server-side authentication check to prevent unauthorized access
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    // Redirect to login if not authenticated
    redirect("/sign-in?returnTo=/admin/calculator");
  }

  // Check user role to ensure they have admin privileges
  const { data: profile } = await supabase
    .from("profiles")
    .select("type")
    .eq("id", user.id)
    .single();

  const userType = profile?.type?.toLowerCase() || '';
  
  if (!profile || !["admin", "super_admin", "helpdesk"].includes(userType)) {
    // Redirect to appropriate page if not an admin
    redirect("/");
  }

  return (
    <CalculatorClient userType={userType} />
  );
}