// src/app/(site)/catering-request/page.tsx

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Session, AuthChangeEvent } from "@supabase/supabase-js";
import { Loader2, ClipboardCheck } from "lucide-react";
import Faq from "@/components/Faq";
import SectionTitle from "@/components/Common/SectionTitle";
import CateringRequestForm from "@/components/CateringRequest/CateringRequestForm";
import { DeliveryChecklistModal } from "@/components/CateringRequest/DeliveryChecklistModal";
import { createClient } from "@/utils/supabase/client";

const CateringPage = () => {
  const router = useRouter();
  const [supabase, setSupabase] = useState<any>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showChecklistModal, setShowChecklistModal] = useState(false);

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

  // Authentication is now enforced at the middleware level
  // This client-side check is kept as a fallback for edge cases
  useEffect(() => {
    if (!isLoading && !session) {
      router.push("/sign-in?returnTo=/catering-request");
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

  // Don't render content until authentication is verified
  if (!session) {
    return null;
  }

  return (
    <section
      id="catering-request"
      className="bg-gray-50 pb-16 pt-32 dark:bg-gray-900 lg:pb-24"
    >
      <div className="container px-4 sm:px-6 lg:px-8">
        <div className="mb-12">
          <SectionTitle
            title="Catering Request"
            subtitle="Professional Delivery"
            paragraph="Complete the form below to request catering services. Click the checklist button to view our 8-point delivery guidelines."
            center
          />
        </div>

        {/* Checklist Modal Button */}
        <div className="mx-auto mb-6 max-w-3xl">
          <button
            onClick={() => setShowChecklistModal(true)}
            className="flex items-center gap-2 rounded-md bg-blue-50 px-4 py-2 text-blue-700 transition-colors hover:bg-blue-100 hover:text-blue-800"
          >
            <ClipboardCheck className="h-5 w-5" />
            <span className="font-medium">View 8-Point Delivery Checklist</span>
          </button>
        </div>

        <div className="mx-auto">
          <CateringRequestForm />
        </div>

        {/* Checklist Modal */}
        <DeliveryChecklistModal
          isOpen={showChecklistModal}
          onClose={() => setShowChecklistModal(false)}
        />

        {/* <div className="mt-16">
          <h2 className="mb-8 text-center text-2xl font-bold text-gray-800 dark:text-white">
            Frequently Asked Questions
          </h2>
          <Faq />
        </div> */}
      </div>
    </section>
  );
};

export default CateringPage;
