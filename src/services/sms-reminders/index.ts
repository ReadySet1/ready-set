import { prisma } from "@/lib/prisma";
import { getSheetData } from "@/lib/google-sheets/client";
import {
  parseDeliveryRows,
  filterByDate,
  groupByDriver,
  type DriverGroup,
} from "@/lib/google-sheets/parser";
import { getSmsProvider } from "@/lib/sms";
import { buildNextDayMessage, buildSameDayMessage } from "./message-builder";

export type ReminderType = "next_day" | "same_day";

export interface PreviewEntry {
  driverName: string;
  phone: string;
  orderCount: number;
  orderNumbers: string[];
  messagePreview: string;
  canSend: boolean;
  skipReason?: string;
}

export interface BatchSummary {
  batchId: string;
  type: ReminderType;
  targetDate: string;
  totalDrivers: number;
  totalSent: number;
  totalFailed: number;
  totalSkipped: number;
}

const DEFAULT_HELPDESK_AGENT = "Ready Set";
const MAX_CONCURRENCY = 10;

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  const queue = [...items];
  const running: Promise<void>[] = [];

  while (queue.length > 0 || running.length > 0) {
    while (running.length < limit && queue.length > 0) {
      const item = queue.shift()!;
      const promise = fn(item).then(() => {
        running.splice(running.indexOf(promise), 1);
      });
      running.push(promise);
    }
    if (running.length > 0) {
      await Promise.race(running);
    }
  }
}

function buildMessage(
  type: ReminderType,
  group: DriverGroup,
  targetDate: Date,
  helpdeskAgent: string,
): string {
  if (type === "next_day") {
    return buildNextDayMessage(
      group.driverName,
      targetDate,
      group.orders,
      helpdeskAgent,
    );
  }
  return buildSameDayMessage(
    group.driverName,
    targetDate,
    group.orders,
    helpdeskAgent,
  );
}

async function fetchAndParseSheet(
  targetDate: Date,
): Promise<DriverGroup[]> {
  const rows = await getSheetData("Drives - Coolfire");
  const parsed = parseDeliveryRows(rows);
  const filtered = filterByDate(parsed, targetDate);
  return groupByDriver(filtered);
}

export async function previewSmsReminderBatch(
  type: ReminderType,
  targetDate: Date,
  helpdeskAgent: string = DEFAULT_HELPDESK_AGENT,
): Promise<PreviewEntry[]> {
  const driverGroups = await fetchAndParseSheet(targetDate);

  return driverGroups.map((group) => {
    const message = buildMessage(type, group, targetDate, helpdeskAgent);
    const orderNumbers = group.orders.map((o) => o.routeOrder);

    if (!group.phone) {
      return {
        driverName: group.driverName,
        phone: "",
        orderCount: group.orders.length,
        orderNumbers,
        messagePreview: message,
        canSend: false,
        skipReason: "No phone number in sheet",
      };
    }

    return {
      driverName: group.driverName,
      phone: group.phone,
      orderCount: group.orders.length,
      orderNumbers,
      messagePreview: message,
      canSend: true,
    };
  });
}

export async function runSmsReminderBatch(
  type: ReminderType,
  targetDate: Date,
  triggeredBy: string = "cron",
  helpdeskAgent: string = DEFAULT_HELPDESK_AGENT,
  driverFilter?: string[],
): Promise<BatchSummary> {
  // Idempotency guard: cron retries and double-clicks must not send duplicate
  // SMS to drivers. Skip if a batch for this (type, targetDate) is already
  // in_progress or completed. Failed batches stay retryable.
  const existing = await prisma.smsReminderBatch.findFirst({
    where: {
      type,
      targetDate,
      status: { in: ["in_progress", "completed"] },
    },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    return {
      batchId: existing.id,
      type,
      targetDate: targetDate.toISOString().split("T")[0] ?? "",
      totalDrivers: existing.totalDrivers,
      totalSent: existing.totalSent,
      totalFailed: existing.totalFailed,
      totalSkipped: existing.totalSkipped,
    };
  }

  let driverGroups = await fetchAndParseSheet(targetDate);

  // Filter to specific drivers if requested
  if (driverFilter && driverFilter.length > 0) {
    const filterSet = new Set(driverFilter.map((d) => d.toLowerCase()));
    driverGroups = driverGroups.filter((g) =>
      filterSet.has(g.driverName.toLowerCase()),
    );
  }

  // Create batch record
  const batch = await prisma.smsReminderBatch.create({
    data: {
      type,
      targetDate,
      status: "in_progress",
      totalDrivers: driverGroups.length,
      triggeredBy,
    },
  });

  let totalSent = 0;
  let totalFailed = 0;
  let totalSkipped = 0;

  const smsProvider = getSmsProvider();

  await runWithConcurrency(driverGroups, MAX_CONCURRENCY, async (group) => {
    const message = buildMessage(type, group, targetDate, helpdeskAgent);
    const orderNumbers = group.orders.map((o) => o.routeOrder);

    if (!group.phone) {
      totalSkipped++;
      await prisma.smsReminderLog.create({
        data: {
          batchId: batch.id,
          driverName: group.driverName,
          messageBody: message,
          status: "skipped",
          errorMessage: "No phone number in sheet",
          orderNumbers,
        },
      });
      return;
    }

    const result = await smsProvider.send(group.phone, message);

    if (result.success) {
      totalSent++;
      await prisma.smsReminderLog.create({
        data: {
          batchId: batch.id,
          driverName: group.driverName,
          phoneNumber: group.phone,
          messageBody: message,
          status: "sent",
          providerMsgId: result.messageId,
          orderNumbers,
        },
      });
    } else {
      totalFailed++;
      await prisma.smsReminderLog.create({
        data: {
          batchId: batch.id,
          driverName: group.driverName,
          phoneNumber: group.phone,
          messageBody: message,
          status: "failed",
          errorMessage: result.error,
          orderNumbers,
        },
      });
    }
  });

  // Update batch with final counts
  await prisma.smsReminderBatch.update({
    where: { id: batch.id },
    data: {
      status: totalFailed > 0 && totalSent === 0 ? "failed" : "completed",
      totalSent,
      totalFailed,
      totalSkipped,
      completedAt: new Date(),
    },
  });

  return {
    batchId: batch.id,
    type,
    targetDate: targetDate.toISOString().split("T")[0] ?? "",
    totalDrivers: driverGroups.length,
    totalSent,
    totalFailed,
    totalSkipped,
  };
}
