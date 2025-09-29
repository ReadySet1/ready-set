"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import SingleOrder from "@/components/Orders/SingleOrder";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Home, Package } from "lucide-react";

const VendorOrderPage = () => {
  const [orderNumber, setOrderNumber] = useState("");
  const params = useParams();
  const router = useRouter();

  useEffect(() => {
    // Get the order number from the URL params
    if (params?.order_number) {
      const rawOrderNumber = Array.isArray(params.order_number) 
        ? params.order_number[0] 
        : params.order_number;
      
      if (rawOrderNumber) {
        setOrderNumber(decodeURIComponent(rawOrderNumber));
      }
    }
  }, [params]);

  const handleDeleteSuccess = () => {
    router.push("/vendor");
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-slate-50">
      <div className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-white px-6 shadow-sm">
        <Button
          onClick={() => router.push("/vendor")}
          variant="ghost"
          size="icon"
          className="mr-2 h-9 w-9 text-slate-500 hover:text-blue-600"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="sr-only">Back to vendor dashboard</span>
        </Button>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/vendor" className="flex items-center">
                  <Home className="mr-1 h-4 w-4" />
                  Vendor Dashboard
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link
                  href="/vendor"
                  className="flex items-center"
                >
                  <Package className="mr-1 h-4 w-4" />
                  Deliveries
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="font-medium text-blue-600">
                Order {orderNumber}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <div className="flex-1">
        <SingleOrder 
          onDeleteSuccess={handleDeleteSuccess} 
          showHeader={false}
          canAssignDriver={false}
          canUpdateDriverStatus={false}
          canDeleteOrder={false}
          canEditOrder={true}
        />
      </div>
    </div>
  );
};

export default VendorOrderPage;
