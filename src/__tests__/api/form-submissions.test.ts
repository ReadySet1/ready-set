/**
 * The logistics quote forms post here. The submission is persisted before the
 * notification email is attempted, so an email failure must never fail the
 * request — but it must not vanish either, which is what used to happen.
 */

import { POST } from "@/app/api/form-submissions/route";

jest.mock("@/lib/form-submissions", () => ({
  FormSubmissionService: {
    createSubmission: jest.fn(),
  },
}));

jest.mock("@/lib/email-service", () => ({
  EmailService: {
    sendFormSubmissionNotification: jest.fn(),
  },
}));

const { FormSubmissionService } = jest.requireMock("@/lib/form-submissions");
const { EmailService } = jest.requireMock("@/lib/email-service");

function validBody() {
  return {
    formType: "food",
    formData: {
      companyName: "Test Co",
      email: "tester@example.com",
      counties: ["Alameda"],
      pickupAddress: { street: "1 Test St" },
    },
  };
}

function request(body: unknown) {
  return new Request("https://readysetllc.com/api/form-submissions", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/form-submissions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    FormSubmissionService.createSubmission.mockResolvedValue({ id: "sub-1" });
    EmailService.sendFormSubmissionNotification.mockResolvedValue(undefined);
  });

  it("saves the submission and reports the email as delivered", async () => {
    const response = await POST(request(validBody()));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.emailDelivered).toBe(true);
    expect(FormSubmissionService.createSubmission).toHaveBeenCalledTimes(1);
  });

  it("still succeeds when the notification email throws, but says so", async () => {
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    EmailService.sendFormSubmissionNotification.mockRejectedValue(
      new Error("RESEND_API_KEY missing"),
    );

    const response = await POST(request(validBody()));
    const payload = await response.json();

    // The lead is saved, so the visitor must not see an error...
    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    // ...but the caller and the logs have to be able to tell nobody was mailed.
    expect(payload.emailDelivered).toBe(false);
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining("NOTIFICATION EMAIL FAILED"),
      expect.any(Error),
    );

    consoleError.mockRestore();
  });

  it("rejects a submission with no email address", async () => {
    const body = validBody();
    body.formData.email = "";

    const response = await POST(request(body));

    expect(response.status).toBe(400);
    expect(FormSubmissionService.createSubmission).not.toHaveBeenCalled();
  });

  it("rejects an unknown form type", async () => {
    const body = validBody();
    body.formType = "spaceship";

    const response = await POST(request(body));

    expect(response.status).toBe(400);
    expect(FormSubmissionService.createSubmission).not.toHaveBeenCalled();
  });
});
