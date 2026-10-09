import {
  BOOKING_CALENDAR_URL,
  HOW_IT_WORKS_CALENDAR_URL,
  VA_CONSULTATION_CALENDAR_URL,
} from "../scheduling-config";

describe("scheduling config", () => {
  it("BOOKING_CALENDAR_URL is the delivery/logistics booking calendar", () => {
    expect(BOOKING_CALENDAR_URL).toBe(
      "https://calendar.google.com/calendar/appointments/schedules/AcZssZ0J6woLwahSRd6c1KrJ_X1cOl99VPr6x-Rp240gi87kaD28RsU1rOuiLVyLQKleUqoVJQqDEPVu?gv=true",
    );
  });

  it("VA_CONSULTATION_CALENDAR_URL is the virtual-assistant consultation calendar", () => {
    expect(VA_CONSULTATION_CALENDAR_URL).toBe(
      "https://calendar.google.com/calendar/u/0/appointments/schedules/AcZssZ26Tewp9laqwen17F4qh13UwlakRL20eQ6LOJn7ANJ4swhUdFfc4inaFMixVsMghhFzE3nlpTSx?gv=true",
    );
  });

  it("HOW_IT_WORKS_CALENDAR_URL is the embedded calendar on /how-it-works", () => {
    expect(HOW_IT_WORKS_CALENDAR_URL).toBe(
      "https://calendar.google.com/calendar/appointments/AcZssZ1jHb5jHQLYMdGkYHDE1Joqi0ADTQ_QVVx1HcA=?gv=true&embedded=true",
    );
  });

  it("keeps the three calendars distinct", () => {
    expect(
      new Set([
        BOOKING_CALENDAR_URL,
        VA_CONSULTATION_CALENDAR_URL,
        HOW_IT_WORKS_CALENDAR_URL,
      ]).size,
    ).toBe(3);
  });
});
