"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SingleOnDemandOrder from "@/components/Orders/OnDemand/SingleOnDemandOrder";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Home, Truck } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

const OrderPage = () => {
  const [orderNumber, setOrderNumber] = useState("");
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    // Get the order number from the URL
    if (pathname) {
      const pathSegments = pathname.split("/");
      const lastSegment = pathSegments[pathSegments.length - 1];
      if (lastSegment) {
        // Decode the order number to handle special characters like slashes
        setOrderNumber(decodeURIComponent(lastSegment));
      }
    }
  }, [pathname]);

  const handleDeleteSuccess = () => {
    router.push("/admin/on-demand-orders");
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-slate-50">
      <div className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-white px-6 shadow-sm">
        <Button
          onClick={() => router.push("/admin/on-demand-orders")}
          variant="ghost"
          size="icon"
          className="mr-2 h-9 w-9 text-slate-500 hover:text-cyan-600"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="sr-only">Back to orders</span>
        </Button>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/admin/" className="flex items-center">
                  <Home className="mr-1 h-4 w-4" />
                  Dashboard
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link
                  href="/admin/on-demand-orders"
                  className="flex items-center"
                >
                  <Truck className="mr-1 h-4 w-4" />
                  On-Demand Orders
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="font-medium text-cyan-600">
                Order {orderNumber}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <div className="flex-1">
        <SingleOnDemandOrder
          onDeleteSuccess={handleDeleteSuccess}
          showHeader={false}
        />
      </div>
    </div>
  );
};

export default OrderPage;
