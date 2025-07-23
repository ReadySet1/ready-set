import React from "react";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle,
  Calendar,
  ArrowRight,
  Home,
  FileText,
} from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";

interface Props {
  params: Promise<{ orderNumber: string }>;
}

const CateringRequestSuccessPage = async ({ params }: Props) => {
  const { orderNumber } = await params;
  const decodedOrderNumber = decodeURIComponent(orderNumber);

  // Basic validation
  if (!decodedOrderNumber) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto max-w-2xl px-4">
        {/* Success Header */}
        <div className="mb-8 text-center">
          <div className="mb-4 flex justify-center">
            <div className="rounded-full bg-green-100 p-4">
              <CheckCircle className="h-12 w-12 text-green-600" />
            </div>
          </div>
          <h1 className="mb-2 text-3xl font-bold text-green-800">
            Request Submitted Successfully!
          </h1>
          <p className="text-lg text-gray-600">
            Your catering request has been received and is being processed.
          </p>
        </div>

        {/* Order Details Card */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Order Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-gray-700">
                  Order Number
                </p>
                <p className="text-lg font-semibold">{decodedOrderNumber}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Status</p>
                <Badge
                  variant="secondary"
                  className="bg-green-100 text-green-800"
                >
                  Submitted
                </Badge>
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Calendar className="h-4 w-4" />
                Submitted on {format(new Date(), "PPPp")}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Next Steps Card */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>What Happens Next?</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="mt-1 rounded-full bg-blue-100 p-2">
                  <span className="text-sm font-semibold text-blue-600">1</span>
                </div>
                <div>
                  <p className="font-medium">Review & Confirmation</p>
                  <p className="text-sm text-gray-600">
                    Our team will review your request and confirm availability
                    within 24 hours.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="mt-1 rounded-full bg-blue-100 p-2">
                  <span className="text-sm font-semibold text-blue-600">2</span>
                </div>
                <div>
                  <p className="font-medium">Assignment & Coordination</p>
                  <p className="text-sm text-gray-600">
                    We'll assign a delivery team and coordinate pickup and
                    delivery logistics.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="mt-1 rounded-full bg-blue-100 p-2">
                  <span className="text-sm font-semibold text-blue-600">3</span>
                </div>
                <div>
                  <p className="font-medium">Delivery Execution</p>
                  <p className="text-sm text-gray-600">
                    Your order will be picked up and delivered according to your
                    specifications.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-col justify-center gap-4 sm:flex-row">
          <Link href="/catering-request">
            <Button variant="outline" className="flex items-center gap-2">
              <ArrowRight className="h-4 w-4" />
              Create Another Request
            </Button>
          </Link>

          <Link href="/">
            <Button className="flex items-center gap-2">
              <Home className="h-4 w-4" />
              Back to Home
            </Button>
          </Link>
        </div>

        {/* Contact Information */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-600">
            Questions about your order?{" "}
            <Link
              href="/contact"
              className="text-blue-600 underline hover:text-blue-700"
            >
              Contact our support team
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default CateringRequestSuccessPage;
