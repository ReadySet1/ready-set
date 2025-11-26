// src/lib/email-preferences.ts
// Domain helpers for loading and updating email notification preferences.

import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/db/prisma";

export interface EmailPreferences {
  deliveryNotifications: boolean;
  promotionalEmails: boolean;
}

const DEFAULT_PREFERENCES: EmailPreferences = {
  deliveryNotifications: true,
  promotionalEmails: false,
};

/**
 * Get email preferences for a user.
 * Returns default preferences if user has no preferences record.
 */
export async function getEmailPreferencesForUser(
  userId: string
): Promise<EmailPreferences> {
  try {
    const preferences = await prisma.emailPreferences.findUnique({
      where: { userId },
    });

    if (!preferences) {
      return DEFAULT_PREFERENCES;
    }

    return {
      deliveryNotifications: preferences.deliveryNotifications,
      promotionalEmails: preferences.promotionalEmails,
    };
  } catch (error) {
    Sentry.captureException(error, {
      tags: { operation: "email-preferences-load" },
      extra: { userId },
    });
    return DEFAULT_PREFERENCES;
  }
}

/**
 * Update email preferences for a user.
 * Creates the record if it doesn't exist (upsert).
 */
export async function updateEmailPreferencesForUser(
  userId: string,
  updates: Partial<EmailPreferences>
): Promise<EmailPreferences> {
  const preferences = await prisma.emailPreferences.upsert({
    where: { userId },
    create: {
      userId,
      deliveryNotifications: updates.deliveryNotifications ?? true,
      promotionalEmails: updates.promotionalEmails ?? false,
    },
    update: {
      ...(updates.deliveryNotifications !== undefined && {
        deliveryNotifications: updates.deliveryNotifications,
      }),
      ...(updates.promotionalEmails !== undefined && {
        promotionalEmails: updates.promotionalEmails,
      }),
    },
  });

  return {
    deliveryNotifications: preferences.deliveryNotifications,
    promotionalEmails: preferences.promotionalEmails,
  };
}
