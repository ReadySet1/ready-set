import { NextRequest, NextResponse } from "next/server";
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
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const messageSid = formData.get("MessageSid") as string | null;
    const messageStatus = formData.get("MessageStatus") as string | null;

    if (!messageSid || !messageStatus) {
      return NextResponse.json(
        { error: "Missing MessageSid or MessageStatus" },
        { status: 400 },
      );
    }

    // Map Twilio statuses to our status values
    const statusMap: Record<string, string> = {
      delivered: "delivered",
      undelivered: "failed",
      failed: "failed",
    };

    const newStatus = statusMap[messageStatus];

    // Only update on terminal statuses
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

    // Twilio expects 200 response
    return new NextResponse(null, { status: 200 });
  } catch (error) {
    console.error("Twilio webhook error:", error);
    return new NextResponse(null, { status: 200 });
  }
}
