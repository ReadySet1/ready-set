// src/components/Dashboard/UserView/Tabs/FilesTab.tsx

import UserFilesDisplay from "@/components/User/user-files-display";
import UserProfileUploads from "@/components/Uploader/user-profile-uploads";
import { UploadHooks, UserFormValues } from "../types";
import { Upload } from "lucide-react";

interface FilesTabProps {
  userId: string;
  refreshTrigger: number;
  uploadHooks: UploadHooks;
  userType: Exclude<UserFormValues["type"], null>;
  setRefreshTrigger: React.Dispatch<React.SetStateAction<number>>;
}

export default function FilesTab({ 
  userId, 
  refreshTrigger,
  uploadHooks,
  userType,
  setRefreshTrigger
}: FilesTabProps) {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-dashed bg-slate-50 p-6">
        <div className="mb-6 text-center">
          <Upload className="mx-auto h-8 w-8 text-slate-400" />
          <h3 className="mt-2 text-sm font-medium text-slate-700">
            Upload Files
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Drag and drop files or click to browse
          </p>
        </div>
        <UserProfileUploads
          uploadHooks={uploadHooks}
          userType={userType}
          onUploadSuccess={() => setRefreshTrigger((prev) => prev + 1)}
        />
      </div>

      <div className="rounded-lg border p-6">
        <h3 className="mb-4 text-base font-medium text-slate-800">
          Uploaded Documents
        </h3>
        {userId ? (
          <UserFilesDisplay
            userId={userId}
            refreshTrigger={refreshTrigger}
          />
        ) : (
          <div className="text-center text-slate-500">
            <p>Loading user information...</p>
          </div>
        )}
      </div>
    </div>
  );
}
