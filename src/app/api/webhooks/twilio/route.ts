import { NextRequest, NextResponse } from "next/server";
import { validateRequest } from "twilio";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Twilio sends status callbacks to this endpoint when an SMS delivery status changes.
 * Configure this URL in the Twilio console for your sending phone number's status callback.
 *
 * Twilio sends form-encoded POST data with fields:
 * - MessageSid: The unique ID of the message
 * - MessageStatus: queued, sent, delivered, undelivered, failed
 *
 * Every request is verified via X-Twilio-Signature (HMAC-SHA1 over URL + sorted params)
 * using TWILIO_AUTH_TOKEN. Unsigned or mismatched requests are rejected — without this,
 * any caller could mark messages as delivered/failed and poison our audit trail.
 */
export async function POST(request: NextRequest) {
  try {
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!authToken) {
      console.error("Twilio webhook: TWILIO_AUTH_TOKEN not set — refusing request");
      return new NextResponse(null, { status: 500 });
    }

    const signature = request.headers.get("x-twilio-signature") ?? "";
    const formData = await request.formData();

    const params: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      params[key] = typeof value === "string" ? value : "";
    }

    const webhookUrl =
      process.env.TWILIO_WEBHOOK_URL ?? request.nextUrl.toString();

    if (!validateRequest(authToken, signature, webhookUrl, params)) {
      console.warn("Twilio webhook: invalid signature");
      return new NextResponse(null, { status: 403 });
    }

    const messageSid = params.MessageSid ?? null;
    const messageStatus = params.MessageStatus ?? null;

    if (!messageSid || !messageStatus) {
      return NextResponse.json(
        { error: "Missing MessageSid or MessageStatus" },
        { status: 400 },
      );
    }

    const statusMap: Record<string, string> = {
      delivered: "delivered",
      undelivered: "failed",
      failed: "failed",
    };

    const newStatus = statusMap[messageStatus];

    if (newStatus) {
      await prisma.smsReminderLog.updateMany({
        where: { providerMsgId: messageSid },
        data: {
          status: newStatus,
          ...(newStatus === "delivered" ? { deliveredAt: new Date() } : {}),
          ...(newStatus === "failed"
            ? { errorMessage: `Twilio status: ${messageStatus}` }
            : {}),
        },
      });
    }

    return new NextResponse(null, { status: 200 });
  } catch (error) {
    console.error("Twilio webhook error:", error);
    return new NextResponse(null, { status: 200 });
  }
}
