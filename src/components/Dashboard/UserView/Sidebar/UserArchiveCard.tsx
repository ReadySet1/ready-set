// src/components/Dashboard/UserView/Sidebar/UserArchiveCard.tsx

"use client";

import { useState } from "react";
import { Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/utils/supabase/client";
import toast from "react-hot-toast";

interface UserArchiveCardProps {
  userId: string;
  userEmail?: string;
  userName?: string;
  onArchiveSuccess?: () => void;
}

export default function UserArchiveCard({
  userId,
  userEmail,
  userName,
  onArchiveSuccess,
}: UserArchiveCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [reason, setReason] = useState("");

  const supabase = createClient();

  const handleArchive = async () => {
    setIsLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch(`/api/users/${userId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: session ? `Bearer ${session.access_token}` : "",
        },
        body: JSON.stringify({ reason }),
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || `Failed to archive user: ${response.status}`
        );
      }

      toast.success("User has been archived successfully");
      setIsOpen(false);
      setReason("");

      if (onArchiveSuccess) {
        onArchiveSuccess();
      }
    } catch (error) {
      console.error("Archive user error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to archive user"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const displayName = userName || userEmail || "this user";

  return (
    <>
      <Card>
        <CardHeader className="border-b bg-red-50 pb-3">
          <CardTitle className="flex items-center text-red-600">
            <Archive className="mr-2 h-5 w-5" />
            Archive User
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <p className="mb-4 text-sm text-slate-600">
            Archiving a user will remove their access to the platform but keep
            their data for record purposes.
          </p>
          <Button
            variant="destructive"
            className="bg-red-600 hover:bg-red-700"
            size="sm"
            onClick={() => setIsOpen(true)}
          >
            Archive User
          </Button>
        </CardContent>
      </Card>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Archive className="h-5 w-5 text-red-500" />
              Archive User
            </DialogTitle>
            <DialogDescription>
              This will archive &quot;{displayName}&quot; and remove their
              access to the platform. The user can be restored later if needed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="archive-reason">Reason for archiving (optional)</Label>
              <Textarea
                id="archive-reason"
                placeholder="e.g., Account violation, User request, Duplicate account..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="mt-2"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsOpen(false);
                setReason("");
              }}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleArchive}
              disabled={isLoading}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {isLoading ? "Archiving..." : "Archive User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
