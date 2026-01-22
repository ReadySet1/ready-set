import { Metadata } from "next";
import MultiStopCalculatorDemo from "@/components/calculator/MultiStopCalculatorDemo";

export const metadata: Metadata = {
  title: "Delivery Calculator Demo | Ready Set",
  description: "Try our multi-stop delivery cost calculator. See transparent pricing for catering and specialty deliveries.",
};

export default function CalculatorDemoPage() {
  return <MultiStopCalculatorDemo />;
}
