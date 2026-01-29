"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  Mail,
  AlertTriangle,
  Loader2,
  Users,
  Send,
  Megaphone,
  Tag,
  MessageSquare,
  FileText,
} from "lucide-react";
import type { BulkEmailRequest } from "@/types/bulk-operations";

type EmailTemplate = BulkEmailRequest["template"];

interface BulkEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  onSend: (request: Omit<BulkEmailRequest, "userIds">) => Promise<void>;
  isLoading?: boolean;
}

const templateConfig: Record<
  EmailTemplate,
  { label: string; icon: React.ReactNode; description: string }
> = {
  announcement: {
    label: "Announcement",
    icon: <Megaphone className="h-4 w-4" />,
    description: "General announcements and updates",
  },
  promotion: {
    label: "Promotion",
    icon: <Tag className="h-4 w-4" />,
    description: "Marketing and promotional content",
  },
  survey: {
    label: "Survey",
    icon: <MessageSquare className="h-4 w-4" />,
    description: "Request feedback from users",
  },
  custom: {
    label: "Custom",
    icon: <FileText className="h-4 w-4" />,
    description: "Custom email with your own content",
  },
};

/**
 * Dialog for sending bulk emails to selected users
 */
export function BulkEmailDialog({
  open,
  onOpenChange,
  selectedCount,
  onSend,
  isLoading = false,
}: BulkEmailDialogProps) {
  const [template, setTemplate] = useState<EmailTemplate>("announcement");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    if (!isLoading) {
      setTemplate("announcement");
      setSubject("");
      setBody("");
      setError(null);
      onOpenChange(false);
    }
  };

  const handleSend = async () => {
    // Validate
    if (!subject.trim()) {
      setError("Subject is required");
      return;
    }

    if (!body.trim()) {
      setError("Email body is required");
      return;
    }

    if (subject.length > 200) {
      setError("Subject must be 200 characters or less");
      return;
    }

    setError(null);

    try {
      await onSend({
        template,
        subject: subject.trim(),
        body: body.trim(),
      });
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send email");
    }
  };

  const isValid = subject.trim().length > 0 && body.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-blue-500" />
            Send Bulk Email
          </DialogTitle>
          <DialogDescription>
            Send an email to {selectedCount} selected{" "}
            {selectedCount === 1 ? "user" : "users"}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Error alert */}
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Recipients info */}
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <Users className="h-4 w-4 text-slate-500" />
            <span className="text-sm text-slate-700">
              <strong>{selectedCount}</strong> {selectedCount === 1 ? "recipient" : "recipients"}
            </span>
          </div>

          {/* Template selector */}
          <div className="space-y-2">
            <Label htmlFor="email-template">Template</Label>
            <Select
              value={template}
              onValueChange={(value) => setTemplate(value as EmailTemplate)}
              disabled={isLoading}
            >
              <SelectTrigger id="email-template">
                <SelectValue placeholder="Select a template" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(templateConfig) as EmailTemplate[]).map((key) => {
                  const config = templateConfig[key];
                  return (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        {config.icon}
                        <span>{config.label}</span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500">
              {templateConfig[template].description}
            </p>
          </div>

          {/* Subject */}
          <div className="space-y-2">
            <Label htmlFor="email-subject">Subject</Label>
            <Input
              id="email-subject"
              placeholder="Enter email subject..."
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={200}
              disabled={isLoading}
            />
            <p className="text-xs text-slate-500">{subject.length}/200 characters</p>
          </div>

          {/* Body */}
          <div className="space-y-2">
            <Label htmlFor="email-body">Message</Label>
            <Textarea
              id="email-body"
              placeholder="Enter your email message..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              disabled={isLoading}
              className="resize-none"
            />
            <p className="text-xs text-slate-500">
              You can use basic formatting. Links will be automatically converted.
            </p>
          </div>

          {/* Loading progress */}
          {isLoading && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                <span className="text-sm font-medium text-slate-700">
                  Sending to {selectedCount} {selectedCount === 1 ? "user" : "users"}...
                </span>
              </div>
              <Progress value={undefined} className="h-2" indicatorClassName="bg-blue-500" />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={!isValid || isLoading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Send Email
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
