import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import Breadcrumb from "@/components/Common/Breadcrumb";
import VendorCalculatorCard from "@/components/calculator/VendorCalculatorCard";

export const metadata = {
  title: "Delivery Cost Estimator | Ready Set",
  description: "Estimate your delivery cost before placing an order.",
};

export default async function CalculatorPage() {
  const user = await getCurrentUser();

  if (!user?.id) {
    redirect("/sign-in");
  }

  if (user.role?.toUpperCase() !== "VENDOR") {
    redirect("/client");
  }

  return (
    <>
      <Breadcrumb
        pageName="Delivery Cost Estimator"
        pageDescription="Estimate your delivery cost"
      />
      <div className="shadow-default dark:border-strokedark dark:bg-boxdark sm:p-7.5 rounded-sm border border-stroke bg-white p-5">
        <div className="mx-auto max-w-2xl">
          <VendorCalculatorCard />
        </div>
      </div>
    </>
  );
}
