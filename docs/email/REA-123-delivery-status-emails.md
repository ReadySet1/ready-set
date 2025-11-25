## REA-123 Delivery Status Email Notifications

- **Provider**: SendGrid via `src/lib/email/sendgrid.ts` (`SendGridEmailProvider`).
- **Service**: High-level API in `src/services/notifications/email.ts` (`sendDeliveryStatusEmail`), with basic retry (3 attempts, exponential backoff) and structured error logging.
- **Templates**: File-based HTML templates under `src/templates/emails/` plus shared components in `src/templates/emails/components/`.
- **Preferences**: Backed by `public.email_preferences` (Supabase) and accessed via `src/lib/email-preferences.ts` (`getEmailPreferencesForUser`); defaults to delivery notifications on, promos off.
- **Integration**: Catering status updates (`src/app/api/catering-requests/[orderId]/status/route.ts`) call `sendDeliveryStatusEmail` after validating transitions and running external webhooks, and honor user preferences.
- **Rollout**: Use environment configuration to control SENDGRID_* secrets; you can disable sending by omitting `SENDGRID_API_KEY` in non-production or by early-returning based on a feature flag around the `sendDeliveryStatusEmail` call.


