// src/lib/email-preferences.ts
// Domain helpers for loading and updating email notification preferences.

import { createAdminClient } from "@/utils/supabase/server";
import type { Tables } from "@/types/supabase";

export type EmailPreferencesRow = Tables<"email_preferences">;

export interface EmailPreferences {
  deliveryNotifications: boolean;
  promotionalEmails: boolean;
}

const DEFAULT_PREFERENCES: EmailPreferences = {
  deliveryNotifications: true,
  promotionalEmails: false,
};

export async function getEmailPreferencesForUser(
  userId: string
): Promise<EmailPreferences> {
  try {
    const supabase = await createAdminClient();

    const { data, error } = await supabase
      .from("email_preferences")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle<EmailPreferencesRow>();

    if (error) {
      console.error("Failed to load email preferences", { userId, error });
      return DEFAULT_PREFERENCES;
    }

    if (!data) {
      return DEFAULT_PREFERENCES;
    }

    return {
      deliveryNotifications: data.delivery_notifications ?? true,
      promotionalEmails: data.promotional_emails ?? false,
    };
  } catch (error) {
    console.error("Unexpected error loading email preferences", {
      userId,
      error,
    });
    return DEFAULT_PREFERENCES;
  }
}


