// src/app/(site)/catering-request/page.tsx

"use client";

import { useState, useEffect } from "react";
import { Session, AuthChangeEvent } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import CateringRequestForm from "@/components/CateringRequest/CateringRequestForm";
import { CateringFormErrorBoundary } from "@/components/ErrorBoundary/CateringFormErrorBoundary";

// Checklist Component
const DeliveryChecklist = () => {
  const [isOpen, setIsOpen] = useState(false);

  const checklistItems = [
    "Verify pickup location and delivery address details",
    "Confirm headcount and order total accuracy",
    "Double-check order number from brokerage service",
    "Verify pickup and delivery time windows",
    "Check if a host is needed and for how long",
    "Note any special delivery or setup instructions",
    "Confirm payment details are accurate",
    "Include any necessary dietary restrictions or allergen information",
  ];

  return (
    <div className="mx-auto mb-8 max-w-3xl py-4">
      <div
        className="flex cursor-pointer items-center justify-between rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:bg-gray-50"
        onClick={() => setIsOpen(!isOpen)}
      >
        <h3 className="text-lg font-medium text-gray-800">
          8-Point Delivery Checklist
        </h3>
        {/* <ChevronDown className={`h-5 w-5 transform text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} /> */}
      </div>

      {isOpen && (
        <div className="mt-2 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <ul className="space-y-2">
            {checklistItems.map((item, index) => (
              <li key={index} className="flex items-start">
                <span className="mr-2 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-800">
                  {index + 1}
                </span>
                <span className="text-gray-700">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

// --- Main Page Component ---
const CateringPageContent = () => {
  const router = useRouter();
  const [supabase, setSupabase] = useState<any>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize Supabase client
  useEffect(() => {
    const initSupabase = async () => {
      const client = await createClient();
      setSupabase(client);
    };

    initSupabase();
  }, []);

  useEffect(() => {
    // Skip if Supabase client is not yet initialized
    if (!supabase) return;

    // Fetch the session when the component mounts
    const fetchSession = async () => {
      try {
        setIsLoading(true);
        const { data } = await supabase.auth.getSession();
        setSession(data.session);
      } catch (error) {
        console.error("Error fetching session:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSession();

    // Set up auth state listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        setSession(session);
      },
    );

    // Clean up subscription on unmount
    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]); // Depend on supabase client

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !session) {
      router.push("/login?redirect=/catering");
    }
  }, [session, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <p className="ml-4 text-lg font-semibold">Loading...</p>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="bg-gray-50 py-8 sm:py-12">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">
            Catering Request
          </h1>
          <p className="mt-4 text-lg text-gray-600">
            Submit your catering delivery request
          </p>
        </div>

        <CateringRequestForm />
      </div>
    </div>
  );
};

const CateringPage = () => {
  return (
    <CateringFormErrorBoundary>
      <CateringPageContent />
    </CateringFormErrorBoundary>
  );
};

export default CateringPage;
