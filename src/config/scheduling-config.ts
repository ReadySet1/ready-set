/**
 * Google Calendar appointment-booking links used by the marketing site.
 * Single source of truth — never hardcode these URLs in components or tests.
 *
 * They are three different calendars, not variants of one link; keep them
 * distinct unless the business confirms they should merge.
 */

/** Delivery / logistics booking calendar: catering, bakery, flowers,
 *  specialty, vendor and logistics pages, plus the promo popup. */
export const BOOKING_CALENDAR_URL =
  "https://calendar.google.com/calendar/appointments/schedules/AcZssZ0J6woLwahSRd6c1KrJ_X1cOl99VPr6x-Rp240gi87kaD28RsU1rOuiLVyLQKleUqoVJQqDEPVu?gv=true" as const;

/** Virtual-assistant consultation calendar: VA pages, free-resource guides,
 *  blog "Book Now" and the consultation popup. */
export const VA_CONSULTATION_CALENDAR_URL =
  "https://calendar.google.com/calendar/u/0/appointments/schedules/AcZssZ26Tewp9laqwen17F4qh13UwlakRL20eQ6LOJn7ANJ4swhUdFfc4inaFMixVsMghhFzE3nlpTSx?gv=true" as const;

/** Legacy appointments link embedded on /how-it-works. */
export const HOW_IT_WORKS_CALENDAR_URL =
  "https://calendar.google.com/calendar/appointments/AcZssZ1jHb5jHQLYMdGkYHDE1Joqi0ADTQ_QVVx1HcA=?gv=true&embedded=true" as const;
