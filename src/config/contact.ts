/** Public contact mailbox shown on the marketing site and used as the
 *  last-resort recipient for quote-request notifications.
 *  Single source of truth — never hardcode the address elsewhere. */
export const CONTACT_EMAIL = "info@readysetllc.com" as const;
export const CONTACT_MAILTO = `mailto:${CONTACT_EMAIL}` as const;
