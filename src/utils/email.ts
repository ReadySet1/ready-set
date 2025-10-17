import { Resend } from 'resend';

type EmailPayload = {
  to: string;
  subject: string;
  html: string;
};

// Lazy initialization to avoid build-time errors when API key is not set
const getResendClient = () => {
  if (!process.env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not configured");
    return null;
  }
  return new Resend(process.env.RESEND_API_KEY);
};

export const sendEmail = async (data: EmailPayload) => {
  try {
    const resend = getResendClient();
    if (!resend) {
      console.warn("⚠️  Resend client not available - skipping email");
      throw new Error("Email service not configured");
    }

    const fromAddress = process.env.EMAIL_FROM || 'noreply@updates.readysetllc.com';

    const response = await resend.emails.send({
      to: data.to,
      from: fromAddress,
      subject: data.subject,
      html: data.html,
    });
        return response;
  } catch (error: any) {
    console.error('Error sending email:', error);
    if (error.response) {
      console.error(error.response.body);
    }
    throw error;
  }
};