"use client";

import { useEffect, useState } from "react";
import SingleOrder from "@/components/Orders/SingleOrder";
import { usePathname } from "next/navigation";

const OrderPage = () => {
  const [orderNumber, setOrderNumber] = useState("");
  const pathname = usePathname();

  useEffect(() => {
    // Get the order number from the URL
    if (pathname) {
      const pathSegments = pathname.split("/");
      const lastSegment = pathSegments[pathSegments.length - 1];
      if (lastSegment) {
        setOrderNumber(lastSegment);
      }
    }
  }, [pathname]);

  return (
    <div className="min-h-screen bg-slate-50">
      <SingleOrder showHeader={true} />
    </div>
  );
};

export default OrderPage;
