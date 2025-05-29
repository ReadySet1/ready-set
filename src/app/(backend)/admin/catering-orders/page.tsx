// src/app/(backend)/admin/catering-orders/page.tsx

import React from "react";
import { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import CateringOrdersPage from "@/components/Orders/CateringOrders/CateringOrdersPage";
import { PageHeader } from "@/components/Dashboard/ui/PageHeader"; // Adjust import path if needed
import { serverLogger } from "@/utils/server-logger";

export const metadata: Metadata = {
  title: "Catering Orders | Admin Dashboard",
  description: "Manage and track all catering orders across the platform",
};

interface SearchParams {
  page?: string;
  status?: string;
}

const Orders = async ({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) => {
  const params = await searchParams;
  const currentPath = '/admin/catering-orders';

  // Server-side authentication check to prevent unauthorized access
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    // Log the authentication failure and redirect
    serverLogger.warn(
      'Auth redirect: User not authenticated', 
      'auth',
      {
        path: currentPath,
        redirectTo: `/sign-in?returnTo=${currentPath}`
      }
    );
    
    // Redirect to login if not authenticated
    redirect("/sign-in?returnTo=/admin/catering-orders");
  }

  // Check user role to ensure they have admin privileges
  const { data: profile } = await supabase
    .from("profiles")
    .select("type")
    .eq("id", user.id)
    .single();

  const userType = profile?.type?.toLowerCase() || '';
  
  if (!profile || !["admin", "super_admin", "helpdesk"].includes(userType)) {
    // Log the authorization failure
    serverLogger.warn(
      'Auth redirect: User not authorized', 
      'auth',
      {
        path: currentPath,
        redirectTo: '/',
        userId: user.id,
        userRole: userType || 'unknown'
      }
    );
    
    // Redirect to appropriate page if not an admin or helpdesk
    redirect("/");
  }

  // Log successful access
  serverLogger.info(
    'Auth check successful: Catering Orders page accessed',
    'auth',
    {
      userId: user.id,
      userRole: userType,
      path: currentPath
    }
  );

  return (
    // Mobile-first responsive wrapper with proper spacing
    <div className="flex w-full flex-col min-h-screen"> 
      {/* Mobile-responsive header wrapper with proper padding */}
      <div className="px-4 sm:px-6 lg:px-6 pt-4 sm:pt-6 pb-0"> 
        <PageHeader
          breadcrumbs={[
            { label: "Dashboard", href: "/admin" },
            // { label: "Orders", href: "/admin/orders" }, // Removed intermediate step if not needed
            { label: "Catering Orders", href: "/admin/catering-orders", active: true },
          ]}
        />
      </div>
      {/* Main content with mobile-responsive padding and flex-grow for full height */}
      <div className="flex-1 px-0 sm:px-0">
        <CateringOrdersPage /> 
      </div>
    </div>
  );
};

export default Orders;