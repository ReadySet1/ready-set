"use client";

import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MessageSquareText,
  Send,
  Eye,
  History,
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Phone,
} from "lucide-react";
import toast from "react-hot-toast";

interface PreviewEntry {
  driverName: string;
  phone: string;
  orderCount: number;
  orderNumbers: string[];
  messagePreview: string;
  canSend: boolean;
  skipReason?: string;
}

interface BatchLog {
  id: string;
  driverName: string;
  phoneNumber: string | null;
  messageBody: string;
  status: string;
  errorMessage: string | null;
  createdAt: string;
  deliveredAt: string | null;
}

interface Batch {
  id: string;
  type: string;
  targetDate: string;
  status: string;
  totalDrivers: number;
  totalSent: number;
  totalFailed: number;
  totalSkipped: number;
  triggeredBy: string | null;
  createdAt: string;
  completedAt: string | null;
  logs: BatchLog[];
}

// --- Preview & Send Tab ---

function PreviewSendTab() {
  const [targetDate, setTargetDate] = useState("");
  const [type, setType] = useState<"next_day" | "same_day">("next_day");
  const [helpdeskAgent, setHelpdeskAgent] = useState("");
  const [preview, setPreview] = useState<PreviewEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [expandedDriver, setExpandedDriver] = useState<string | null>(null);
  const [sendResult, setSendResult] = useState<{
    totalSent: number;
    totalFailed: number;
    totalSkipped: number;
  } | null>(null);

  const handlePreview = async () => {
    if (!targetDate) {
      toast.error("Please select a date");
      return;
    }

    setLoading(true);
    setPreview(null);
    setSendResult(null);

    try {
      const res = await fetch("/api/admin/sms-reminders/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          targetDate,
          helpdeskAgent: helpdeskAgent || undefined,
        }),
      });

      const data = (await res.json()) as {
        preview?: PreviewEntry[];
        error?: string;
      };

      if (!res.ok) {
        throw new Error(data.error ?? "Failed to load preview");
      }

      setPreview(data.preview ?? []);

      if (!data.preview || data.preview.length === 0) {
        toast("No deliveries found for this date", { icon: "📋" });
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load preview",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSendAll = async () => {
    if (!targetDate || !preview) return;

    const sendable = preview.filter((p) => p.canSend);
    if (sendable.length === 0) {
      toast.error("No drivers with valid phone numbers to send to");
      return;
    }

    if (
      !window.confirm(
        `Send ${type === "next_day" ? "next-day" : "same-day"} SMS to ${sendable.length} driver(s)?`,
      )
    ) {
      return;
    }

    setSending(true);
    setSendResult(null);

    try {
      const res = await fetch("/api/admin/sms-reminders/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          targetDate,
          helpdeskAgent: helpdeskAgent || undefined,
        }),
      });

      const data = (await res.json()) as {
        result?: {
          totalSent: number;
          totalFailed: number;
          totalSkipped: number;
        };
        error?: string;
      };

      if (!res.ok) {
        throw new Error(data.error ?? "Failed to send");
      }

      const result = data.result;
      if (result) {
        setSendResult(result);
        toast.success(
          `Sent: ${result.totalSent}, Failed: ${result.totalFailed}, Skipped: ${result.totalSkipped}`,
        );
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to send reminders",
      );
    } finally {
      setSending(false);
    }
  };

  const handleSendSingle = async (driverName: string) => {
    if (!targetDate) return;

    if (
      !window.confirm(
        `Send ${type === "next_day" ? "next-day" : "same-day"} SMS to ${driverName}?`,
      )
    ) {
      return;
    }

    setSending(true);

    try {
      const res = await fetch("/api/admin/sms-reminders/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          targetDate,
          helpdeskAgent: helpdeskAgent || undefined,
          drivers: [driverName],
        }),
      });

      const data = (await res.json()) as {
        result?: { totalSent: number };
        error?: string;
      };

      if (!res.ok) {
        throw new Error(data.error ?? "Failed to send");
      }

      toast.success(`SMS sent to ${driverName}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : `Failed to send to ${driverName}`,
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Configure</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="targetDate">Delivery Date</Label>
              <Input
                id="targetDate"
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Message Type</Label>
              <Select
                value={type}
                onValueChange={(v) => setType(v as "next_day" | "same_day")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="next_day">Next-Day Confirmation</SelectItem>
                  <SelectItem value="same_day">Same-Day Confirmation</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="helpdeskAgent">Helpdesk Agent (optional)</Label>
              <Input
                id="helpdeskAgent"
                placeholder="Default: Ready Set"
                value={helpdeskAgent}
                onChange={(e) => setHelpdeskAgent(e.target.value)}
              />
            </div>

            <div className="flex items-end">
              <Button
                onClick={handlePreview}
                disabled={loading || !targetDate}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <Eye className="mr-2 h-4 w-4" />
                    Load Preview
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Send Result */}
      {sendResult && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="font-medium text-green-900">
                Batch complete:
              </span>
              <Badge variant="default">{sendResult.totalSent} sent</Badge>
              {sendResult.totalFailed > 0 && (
                <Badge variant="destructive">
                  {sendResult.totalFailed} failed
                </Badge>
              )}
              {sendResult.totalSkipped > 0 && (
                <Badge variant="secondary">
                  {sendResult.totalSkipped} skipped
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview Table */}
      {preview && preview.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">
                Preview ({preview.length} driver{preview.length !== 1 ? "s" : ""})
              </CardTitle>
              <CardDescription>
                {preview.filter((p) => p.canSend).length} ready to send,{" "}
                {preview.filter((p) => !p.canSend).length} missing phone
              </CardDescription>
            </div>
            <Button
              onClick={handleSendAll}
              disabled={sending || preview.filter((p) => p.canSend).length === 0}
            >
              {sending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send All
                </>
              )}
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {preview.map((entry) => (
                <div
                  key={entry.driverName}
                  className={`rounded-lg border p-4 ${
                    !entry.canSend
                      ? "border-yellow-200 bg-yellow-50"
                      : "border-gray-200"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div>
                        <span className="font-medium">{entry.driverName}</span>
                        <div className="flex items-center gap-2 mt-1">
                          {entry.canSend ? (
                            <div className="flex items-center gap-1 text-sm text-gray-600">
                              <Phone className="h-3 w-3" />
                              {entry.phone}
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-sm text-yellow-700">
                              <AlertTriangle className="h-3 w-3" />
                              {entry.skipReason}
                            </div>
                          )}
                          <Badge variant="secondary">
                            {entry.orderCount} order
                            {entry.orderCount !== 1 ? "s" : ""}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {entry.canSend && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSendSingle(entry.driverName)}
                          disabled={sending}
                        >
                          <Send className="h-3 w-3 mr-1" />
                          Send
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setExpandedDriver(
                            expandedDriver === entry.driverName
                              ? null
                              : entry.driverName,
                          )
                        }
                      >
                        {expandedDriver === entry.driverName ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {expandedDriver === entry.driverName && (
                    <pre className="mt-3 whitespace-pre-wrap rounded bg-gray-100 p-3 text-sm font-mono">
                      {entry.messagePreview}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {preview && preview.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            No deliveries found for the selected date.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// --- History Tab ---

function HistoryTab() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchHistory = async (p: number = 1) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/sms-reminders/history?page=${p}&limit=10`,
      );
      const data = (await res.json()) as {
        batches: Batch[];
        pagination: { totalPages: number };
        error?: string;
      };

      if (!res.ok) throw new Error(data.error ?? "Failed to load history");

      setBatches(data.batches);
      setTotalPages(data.pagination.totalPages);
      setPage(p);
      setLoaded(true);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load history",
      );
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  const formatTargetDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-600" />;
      case "in_progress":
        return <Loader2 className="h-4 w-4 animate-spin text-blue-600" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    }
  };

  return (
    <div className="space-y-4">
      {!loaded && (
        <div className="text-center py-8">
          <Button onClick={() => fetchHistory(1)} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <History className="mr-2 h-4 w-4" />
                Load History
              </>
            )}
          </Button>
        </div>
      )}

      {loaded && batches.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            No SMS reminder batches yet.
          </CardContent>
        </Card>
      )}

      {batches.map((batch) => (
        <Card key={batch.id}>
          <CardContent className="pt-6">
            <div
              className="flex items-center justify-between cursor-pointer"
              onClick={() =>
                setExpandedBatch(
                  expandedBatch === batch.id ? null : batch.id,
                )
              }
            >
              <div className="flex items-center gap-3">
                {statusIcon(batch.status)}
                <div>
                  <div className="font-medium">
                    {batch.type === "next_day"
                      ? "Next-Day"
                      : "Same-Day"}{" "}
                    — {formatTargetDate(batch.targetDate)}
                  </div>
                  <div className="text-sm text-gray-500">
                    {formatDate(batch.createdAt)} · by{" "}
                    {batch.triggeredBy ?? "unknown"}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant="default">{batch.totalSent} sent</Badge>
                {batch.totalFailed > 0 && (
                  <Badge variant="destructive">
                    {batch.totalFailed} failed
                  </Badge>
                )}
                {batch.totalSkipped > 0 && (
                  <Badge variant="secondary">
                    {batch.totalSkipped} skipped
                  </Badge>
                )}
                {expandedBatch === batch.id ? (
                  <ChevronUp className="h-4 w-4 text-gray-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                )}
              </div>
            </div>

            {expandedBatch === batch.id && batch.logs.length > 0 && (
              <div className="mt-4 space-y-2 border-t pt-4">
                {batch.logs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between rounded border p-3 text-sm"
                  >
                    <div>
                      <span className="font-medium">{log.driverName}</span>
                      {log.phoneNumber && (
                        <span className="ml-2 text-gray-500">
                          {log.phoneNumber}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {log.status === "sent" && (
                        <Badge
                          variant="default"
                          className="bg-blue-100 text-blue-800"
                        >
                          Sent
                        </Badge>
                      )}
                      {log.status === "delivered" && (
                        <Badge
                          variant="default"
                          className="bg-green-100 text-green-800"
                        >
                          Delivered
                        </Badge>
                      )}
                      {log.status === "failed" && (
                        <Badge variant="destructive">
                          Failed{log.errorMessage ? `: ${log.errorMessage}` : ""}
                        </Badge>
                      )}
                      {log.status === "skipped" && (
                        <Badge variant="secondary">
                          Skipped{log.errorMessage ? `: ${log.errorMessage}` : ""}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {loaded && totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || loading}
            onClick={() => fetchHistory(page - 1)}
          >
            Previous
          </Button>
          <span className="flex items-center text-sm text-gray-500">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages || loading}
            onClick={() => fetchHistory(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

// --- Main Component ---

export default function SmsRemindersClient() {
  return (
    <div className="flex-1 space-y-6 p-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <MessageSquareText className="h-6 w-6 text-blue-600" />
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            SMS Reminders
          </h1>
        </div>
        <p className="text-gray-600">
          Send automated SMS reminders to drivers about their daily deliveries.
          Data is sourced from the Coolfire Google Sheet.
        </p>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="pt-6">
          <Tabs defaultValue="preview" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="preview" className="flex items-center gap-2">
                <Send className="h-4 w-4" />
                Preview & Send
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center gap-2">
                <History className="h-4 w-4" />
                History
              </TabsTrigger>
            </TabsList>

            <TabsContent value="preview">
              <PreviewSendTab />
            </TabsContent>

            <TabsContent value="history">
              <HistoryTab />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
