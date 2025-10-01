// src/components/Uploader/enhanced-file-uploader.tsx
import React, { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useUploadFile } from "@/hooks/use-upload-file";
import { UploadProgress, UploadErrorType } from "@/types/upload";
import { FileValidator } from "@/lib/upload-error-handler";
import toast from "react-hot-toast";

interface EnhancedFileUploaderProps {
  entityType?: string;
  entityId?: string;
  category?: string;
  maxFileCount?: number;
  maxFileSize?: number;
  allowedFileTypes?: string[];
  onUploadComplete?: (files: any[]) => void;
  onUploadError?: (error: any) => void;
}

export function EnhancedFileUploader({
  entityType = "user",
  entityId,
  category = "",
  maxFileCount = 5,
  maxFileSize = 10 * 1024 * 1024,
  allowedFileTypes = [],
  onUploadComplete,
  onUploadError,
}: EnhancedFileUploaderProps) {
  const [isDragActive, setIsDragActive] = useState(false);

  const {
    uploadedFiles,
    isUploading,
    progresses,
    uploadSession,
    onUpload,
    retryFailedUploads,
    cancelUpload,
  } = useUploadFile({
    entityType,
    entityId,
    category,
    maxFileCount,
    maxFileSize,
    allowedFileTypes,
  });

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;

      try {
        const uploaded = await onUpload(acceptedFiles);
        if (uploaded.length > 0 && onUploadComplete) {
          onUploadComplete(uploaded);
        }
      } catch (error) {
        console.error("Upload failed:", error);
        if (onUploadError) {
          onUploadError(error);
        }
      }
    },
    [onUpload, onUploadComplete, onUploadError],
  );

  const {
    getRootProps,
    getInputProps,
    isDragActive: dropzoneDragActive,
  } = useDropzone({
    onDrop,
    multiple: true,
    maxFiles: maxFileCount,
    maxSize: maxFileSize,
    accept:
      allowedFileTypes.length > 0
        ? allowedFileTypes.reduce(
            (acc, type) => {
              acc[type] = [];
              return acc;
            },
            {} as Record<string, string[]>,
          )
        : undefined,
    disabled: isUploading,
  });

  const handleRetry = async () => {
    try {
      await retryFailedUploads();
    } catch (error) {
      console.error("Retry failed:", error);
      toast.error("Failed to retry uploads");
    }
  };

  const handleCancel = () => {
    cancelUpload();
    toast("Upload cancelled", { icon: "ℹ️" });
  };

  return (
    <div className="w-full space-y-4">
      {/* Upload Zone */}
      <div
        {...getRootProps()}
        className={`relative cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
          isUploading
            ? "cursor-not-allowed border-gray-300 bg-gray-50"
            : dropzoneDragActive
              ? "border-blue-500 bg-blue-50"
              : "border-gray-300 hover:border-gray-400 hover:bg-gray-50"
        }`}
      >
        <input {...getInputProps()} />
        <div className="space-y-4">
          <div className="mx-auto h-12 w-12 text-gray-400">
            <svg
              className="h-full w-full"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>

          <div>
            <p className="text-lg font-medium text-gray-900">
              {isUploading
                ? "Uploading files..."
                : "Drop files here or click to browse"}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              {allowedFileTypes.length > 0
                ? `Supported formats: ${allowedFileTypes.join(", ")}`
                : "All file types supported"}
              {" • "}
              Max {maxFileCount} files,{" "}
              {FileValidator.formatFileSize(maxFileSize)} each
            </p>
          </div>
        </div>
      </div>

      {/* Upload Session Progress */}
      {uploadSession && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-900">
              Upload Progress
            </h3>
            <div className="flex space-x-2">
              {uploadSession.failedFiles > 0 && (
                <button
                  onClick={handleRetry}
                  className="rounded-md bg-blue-600 px-3 py-1 text-sm text-white transition-colors hover:bg-blue-700"
                >
                  Retry Failed ({uploadSession.failedFiles})
                </button>
              )}
              {isUploading && (
                <button
                  onClick={handleCancel}
                  className="rounded-md bg-red-600 px-3 py-1 text-sm text-white transition-colors hover:bg-red-700"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>

          {/* Overall Progress */}
          <div className="mb-4">
            <div className="mb-1 flex items-center justify-between text-sm text-gray-600">
              <span>
                {uploadSession.completedFiles} of {uploadSession.totalFiles}{" "}
                files completed
              </span>
              <span>
                {Math.round(
                  (uploadSession.completedFiles / uploadSession.totalFiles) *
                    100,
                )}
                %
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-gray-200">
              <div
                className="h-2 rounded-full bg-blue-600 transition-all duration-300"
                style={{
                  width: `${(uploadSession.completedFiles / uploadSession.totalFiles) * 100}%`,
                }}
              />
            </div>
          </div>

          {/* Individual File Progress */}
          <div className="max-h-60 space-y-2 overflow-y-auto">
            {uploadSession.files.map((fileProgress) => (
              <div
                key={fileProgress.fileId}
                className="flex items-center space-x-3 rounded-md bg-gray-50 p-2"
              >
                <div className="flex-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="truncate font-medium text-gray-900">
                      {fileProgress.fileName}
                    </span>
                    <span className="text-gray-500">
                      {fileProgress.percentage}%
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full rounded-full bg-gray-200">
                    <div
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        fileProgress.status === "error"
                          ? "bg-red-500"
                          : fileProgress.status === "completed"
                            ? "bg-green-500"
                            : "bg-blue-500"
                      }`}
                      style={{ width: `${fileProgress.percentage}%` }}
                    />
                  </div>
                  {fileProgress.error && (
                    <p className="mt-1 text-xs text-red-600">
                      {fileProgress.error.userMessage}
                    </p>
                  )}
                  {fileProgress.retryCount > 0 && (
                    <p className="mt-1 text-xs text-blue-600">
                      Retrying... (attempt {fileProgress.retryCount + 1})
                    </p>
                  )}
                </div>
                <div className="text-xs text-gray-500">
                  {fileProgress.status === "error" &&
                    fileProgress.error?.retryable && (
                      <span className="text-blue-600">Retryable</span>
                    )}
                  {fileProgress.status === "completed" && (
                    <span className="text-green-600">✓</span>
                  )}
                  {fileProgress.status === "error" &&
                    !fileProgress.error?.retryable && (
                      <span className="text-red-600">Failed</span>
                    )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Uploaded Files List */}
      {uploadedFiles.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-medium text-gray-900">
            Uploaded Files ({uploadedFiles.length})
          </h3>
          <div className="max-h-60 space-y-2 overflow-y-auto">
            {uploadedFiles.map((file) => (
              <div
                key={file.key}
                className="flex items-center justify-between rounded-md bg-gray-50 p-2"
              >
                <div className="flex items-center space-x-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
                    <svg
                      className="h-4 w-4 text-blue-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="truncate text-sm font-medium text-gray-900">
                      {file.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {FileValidator.formatFileSize(file.size)} • {file.type}
                    </p>
                  </div>
                </div>
                <a
                  href={file.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-blue-600 hover:text-blue-800"
                >
                  View
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
