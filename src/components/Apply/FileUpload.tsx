import React, { useState } from "react";
import { FileWithPath } from "react-dropzone";
// import { JobApplicationUploader } from "./JobApplicationUploader"; // Removed as it's not used and was commented out
import { UseFormRegister } from "react-hook-form";
import type { FormData } from "./types";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileCheck, Upload, X, Loader2 } from 'lucide-react';
import { UploadedFile } from "@/hooks/use-upload-file"; // Assuming type location
import { Progress } from "@/components/ui/progress";

interface FileUploadProps {
  name: keyof FormData;
  label: string;
  // register: UseFormRegister<FormData>; // register is passed but not used, removing
  required?: boolean;
  error?: { message?: string };
  // uploadConfig: { // uploadConfig is passed but not used directly, removing
  //   category: string;
  //   entityType: string;
  //   entityId: string;
  //   allowedFileTypes: string[];
  // };
  startUpload: (files: FileWithPath[]) => Promise<UploadedFile[]>;
  isUploading: boolean; // Using this now
  progresses?: Record<string, number>; // Using this now
  accept?: string;
  // fileId: string | null; // Replacing with UploadedFile object
  file: UploadedFile | null;
  deleteFile: (key: string) => Promise<boolean>;
}

export function FileUpload({
  label,
  required,
  // error,
  // uploadConfig,
  // onUploadComplete,
  startUpload,
  isUploading,
  progresses,
  accept = 'application/pdf',
  // fileId,
  // onFileUpload
  file,
  deleteFile,
  error // Error prop from react-hook-form if needed for field-level display
}: FileUploadProps) {
  const [fileName, setFileName] = useState<string | null>(file?.name || null);
  const progress = fileName ? progresses?.[fileName] : null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputFile = e.target.files?.[0];
    if (!inputFile) return;

    // Update local state to show file name while uploading
    setFileName(inputFile.name);

    // Delegate upload to the hook
    startUpload([inputFile as FileWithPath]).catch(() => {
      // Reset filename if upload fails, rely on hook's toast for error message
      setFileName(null);
    });

    // Reset input value to allow re-uploading the same file
    e.target.value = "";
  };

  const handleRemove = async () => {
    if (!file?.key) return;
    try {
      await deleteFile(file.key);
      setFileName(null); // Clear local file name on successful delete
    } catch {
      // Error handled by hook's toast
    }
  };

  const displayFileName = file?.name || fileName;

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </Label>

      {!file && !isUploading ? (
        <div className="relative">
          <Input
            type="file"
            accept={accept}
            onChange={handleFileChange}
            disabled={isUploading}
            className="w-full h-12 cursor-pointer border-2 border-dashed border-slate-300 hover:border-yellow-400 focus:border-yellow-500 transition-colors rounded-xl bg-slate-50 hover:bg-yellow-50 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-yellow-100 file:text-yellow-700 hover:file:bg-yellow-200"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <Upload className="h-5 w-5 text-slate-400" />
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 p-4 border-2 border-slate-200 rounded-xl bg-white shadow-sm">
          <div className="flex-shrink-0">
            {isUploading && progress !== 100 ? (
              <Loader2 className="h-6 w-6 animate-spin text-yellow-500" />
            ) : (
              <FileCheck className="h-6 w-6 text-green-600" />
            )}
          </div>
          
          <div className="flex-grow min-w-0 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700 truncate pr-2">
                {displayFileName ?? 'File'}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="flex-shrink-0 h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg"
                onClick={handleRemove}
                disabled={isUploading}
                aria-label="Remove file"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            {isUploading && typeof progress === 'number' && progress < 100 && (
              <div className="space-y-1">
                <Progress value={progress} className="h-2 bg-slate-200" />
                <div className="flex justify-between items-center text-xs text-slate-500">
                  <span>Uploading...</span>
                  <span>{Math.round(progress)}%</span>
                </div>
              </div>
            )}
            
            {!isUploading && file && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-xs text-green-700 font-medium">Upload complete</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Display react-hook-form error if provided */}
      {error?.message && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-2 rounded-lg">
          <X className="h-4 w-4 flex-shrink-0" />
          <span>{error.message}</span>
        </div>
      )}
    </div>
  );
} 