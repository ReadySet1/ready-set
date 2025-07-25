import React, { useCallback, useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import { Loader2, Users } from "lucide-react";
import { clientsData } from "@/components/Clients/clientsData";
import { Client } from "@/types/client";
import CateringRequestForm from "./CateringRequestForm";
import { z } from "zod";
import type { SupabaseClient, Session } from "@supabase/supabase-js";

// Extend the catering form schema to require clientId
const adminCateringSchema = z.object({
  clientId: z.number({ required_error: "Client is required" }),
});

export type AdminCateringFormData = z.infer<typeof adminCateringSchema> & any;

// NOTE: This component is not currently used in production. It is kept for future admin/helpdesk use or as a demo. It does not require external supabase/session props.
const AdminCateringRequestForm: React.FC = () => {
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<AdminCateringFormData>({
    resolver: zodResolver(adminCateringSchema),
    defaultValues: { clientId: undefined },
  });

  const onSubmit = useCallback(
    async (data: AdminCateringFormData) => {
      if (!selectedClient) {
        toast.error("Please select a client.");
        return;
      }
      setIsSubmitting(true);
      try {
        // Here you would POST to your API with the selected client and form data
        // Example: await createCateringOrder({ ...data, clientId: selectedClient.id })
        toast.success("Order created for " + selectedClient.title);
        reset();
        setSelectedClient(null);
        // router.push("/admin/orders"); // Optionally redirect
      } catch (err) {
        toast.error("Failed to create order");
      } finally {
        setIsSubmitting(false);
      }
    },
    [selectedClient, reset],
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      <div>
        <label
          htmlFor="clientId"
          className="mb-2 block text-sm font-medium text-gray-700"
        >
          Select Client
        </label>
        <Controller
          name="clientId"
          control={control}
          render={({ field }) => (
            <select
              {...field}
              id="clientId"
              onChange={(e) => {
                const clientId = Number(e.target.value);
                const client =
                  clientsData.find((c) => c.id === clientId) || null;
                setSelectedClient(client);
                field.onChange(clientId);
              }}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
              name="clientId"
            >
              <option value="">Select a client...</option>
              {clientsData.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.title}
                </option>
              ))}
            </select>
          )}
        />
        {errors.clientId && (
          <p className="mt-1 text-xs text-red-500">
            {errors.clientId.message as string}
          </p>
        )}
      </div>

      {/* Render the original CateringRequestForm, passing selectedClient as a prop if needed */}
      <div className="border-t pt-6">
        {selectedClient ? (
          <div className="italic text-gray-500">
            CateringRequestForm would render here in a real admin context, with
            proper supabase/session props.
          </div>
        ) : (
          <div className="italic text-gray-500">
            Please select a client to fill out the form.
          </div>
        )}
      </div>

      <div className="mt-8 flex items-center justify-center">
        <button
          type="submit"
          disabled={isSubmitting || !selectedClient}
          className={`relative w-full rounded-md px-6 py-3 font-medium text-white transition ${
            isSubmitting || !selectedClient
              ? "cursor-not-allowed bg-blue-400"
              : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          <div
            className={`flex items-center justify-center ${isSubmitting ? "opacity-0" : ""}`}
          >
            Create Catering Order
          </div>
          {isSubmitting && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-white" />
              <span className="ml-2">Submitting...</span>
            </div>
          )}
        </button>
      </div>
    </form>
  );
};

export default AdminCateringRequestForm;
