import React from "react";
import { useRouter } from "next/navigation";

interface Props {
  orderNumber: string;
}

const VendorActionsSection: React.FC<Props> = ({ orderNumber }) => {
  const router = useRouter();

  const handleDashboard = () => router.push("/vendor");
  const handlePrint = () => window.print();
  const handleNewOrder = () => router.push("/catering-request");

  return (
    <section className="vendor-actions-section">
      <button onClick={handleDashboard}>View Dashboard</button>
      <button onClick={handlePrint}>Print Order Details</button>
      <button onClick={handleNewOrder}>Create Another Order</button>
    </section>
  );
};

export default VendorActionsSection;
