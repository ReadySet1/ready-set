// src/hooks/use-upload-file.ts
import { useState, useCallback, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { v4 as uuidv4 } from "uuid";
import { SupabaseClient } from "@supabase/supabase-js";
import { FileWithPath } from "react-dropzone";
import toast from "react-hot-toast";
import {
  UploadErrorHandler,
  RetryHandler,
  FileValidator,
  DEFAULT_RETRY_CONFIG,
  DEFAULT_VALIDATION_CONFIG
} from "@/lib/upload-error-handler";
import {
  UploadError,
  UploadErrorType,
  UploadProgress,
  UploadSession,
  UploadOptions
} from "@/types/upload";

// Helper to extract message from different error types
const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unknown error occurred';
};

export type UploadedFile = {
  key: string;
  name: string;
  url: string;
  size: number;
  type: string;
  entityId?: string;
  category?: string;
  path?: string;
  bucketName?: string;
};

interface UseUploadFileOptions {
  defaultUploadedFiles?: UploadedFile[];
  bucketName?: string;
  maxFileCount?: number;
  maxFileSize?: number;
  allowedFileTypes?: string[];
  entityType?: string;
  userId?: string;
  entityId?: string;
  category?: string;
}

export function useUploadFile({
  bucketName = "fileUploader",
  defaultUploadedFiles = [],
  maxFileCount = 5,
  maxFileSize = 10 * 1024 * 1024, // 10MB by default
  allowedFileTypes = [],
  entityType,
  userId,
  entityId: initialEntityId,
  category,
}: UseUploadFileOptions = {}) {
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [uploadedFiles, setUploadedFiles] =
    useState<UploadedFile[]>(defaultUploadedFiles);
  const [isUploading, setIsUploading] = useState(false);
  const [progresses, setProgresses] = useState<Record<string, number>>({});
  const [uploadSession, setUploadSession] = useState<UploadSession | null>(null);
  const [entityId, setEntityId] = useState<string>(initialEntityId || "");
  const [tempEntityId, setTempEntityId] = useState<string>("");

  // Generate a temporary entity ID on initialization if none exists
  useEffect(() => {
    if (!entityId && !tempEntityId) {
      const newTempId = `temp-${uuidv4()}`;
            setTempEntityId(newTempId);
    }
  }, [entityId, tempEntityId]);

  // Initialize Supabase client if not already initialized
  const initSupabase = useCallback(async () => {
    if (!supabase) {
      try {
        const client = await createClient();
        setSupabase(client);
        return client;
      } catch (error) {
        console.error("Error initializing Supabase client:", error);
        toast.error("Error connecting to storage service. Please try again.");
        return null;
      }
    }
    return supabase;
  }, [supabase]);

  // Fetch existing files
  const fetchExistingFiles = useCallback(async () => {
    if (!entityId) return;

    try {
      const params = new URLSearchParams({
        entityId,
        entityType: entityType || "user",
      });
      if (category) {
        params.append("category", category);
      }

            const response = await fetch(`/api/file-uploads/get?${params}`);
      
                  
      const data = await response.json();
            
      if (!response.ok) {
        console.error('Error details:', {
          status: response.status,
          statusText: response.statusText,
          data,
          entityId,
          entityType,
          category
        });
        const errorMessage = data.error || "Failed to fetch files";
        throw new Error(errorMessage);
      }

      if (data.success && data.files) {
                setUploadedFiles(data.files);
      } else {
        console.warn('Unexpected response format:', data);
        setUploadedFiles([]);
      }
    } catch (error) {
      console.error("Error fetching existing files:", error);
    }
  }, [entityId, entityType, category]);

  // Initialize Supabase client and fetch existing files
  useEffect(() => {
    const init = async () => {
      await initSupabase();
      await fetchExistingFiles();
    };
    init();
  }, [initSupabase, fetchExistingFiles]);

  // Default bucket to file uploader if not specified
  const actualBucketName = bucketName || "fileUploader"; 
  
  const uploadFile = useCallback(
    async (file: File) => {
      // Use entityId if it exists, otherwise use tempEntityId
      const currentId = entityId || tempEntityId;
      
      try {
        setIsUploading(true);
        
        // Create FormData for the file upload
        const formData = new FormData();
        formData.append("file", file);
        
        // Add additional metadata to the form
        formData.append("entityType", entityType || "");
        formData.append("entityId", currentId);
        formData.append("category", category || "");
        formData.append("bucketName", actualBucketName);
        
        // Upload the file using the API route
        const response = await fetch("/api/file-uploads", {
          method: "POST",
          body: formData,
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to upload file");
        }
        
        const data = await response.json();
        
        if (data.file) {
          setUploadedFiles((prev) => [...prev, data.file]);
          return data.file;
        }
        
        return null;
      } catch (error) {
        console.error("Error uploading file:", error);
        toast.error(`Error uploading file: ${getErrorMessage(error)}`);
        return null;
      } finally {
        setIsUploading(false);
      }
    },
    [entityId, tempEntityId, entityType, category, actualBucketName]
  );

  // Handle file uploads to Supabase Storage and register in database via API
  const onUpload = useCallback(
    async (files: FileWithPath[]): Promise<UploadedFile[]> => {
      // Check if adding these files would exceed the limit
      if (uploadedFiles.length + files.length > maxFileCount) {
        toast.error(`Cannot upload ${files.length} more files. Maximum ${maxFileCount} allowed.`);
        return [];
      }

            
      // Create upload session for progress tracking
      const sessionId = uuidv4();
      const session: UploadSession = {
        sessionId,
        files: [],
        totalFiles: files.length,
        completedFiles: 0,
        failedFiles: 0,
        totalProgress: 0,
        startTime: Date.now(),
        status: 'active'
      };

      setUploadSession(session);
      setIsUploading(true);
      const newProgresses = { ...progresses };
      const uploadedFilesList: UploadedFile[] = [];

      // Initialize progress for each file
      const fileProgresses: UploadProgress[] = files.map((file, index) => ({
        fileId: `${sessionId}-${index}`,
        fileName: file.name,
        loaded: 0,
        total: file.size,
        percentage: 0,
        status: 'uploading',
        retryCount: 0,
        startTime: Date.now(),
        lastUpdated: Date.now()
      }));

      session.files = fileProgresses;
      setUploadSession({ ...session });

      try {
        if (!files || files.length === 0) {
          toast.error("Please select at least one file to upload.");
          setUploadSession({ ...session, status: 'failed' });
          return [];
        }

        // Loop through each file to upload with enhanced error handling
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          if (!file) continue; // Skip if file is somehow undefined

          const progressIndex = i;
          const fileProgress = fileProgresses[progressIndex];
          if (!fileProgress) continue; // Skip if fileProgress is undefined

          
          // Enhanced file validation using the new system
          const validationError = FileValidator.validateFile(file, {
            ...DEFAULT_VALIDATION_CONFIG,
            maxSize: maxFileSize,
            allowedTypes: allowedFileTypes.length > 0 ? allowedFileTypes : DEFAULT_VALIDATION_CONFIG.allowedTypes,
            allowedExtensions: allowedFileTypes.length > 0 ?
              allowedFileTypes.flatMap(type => {
                const ext = '.' + type.split('/')[1];
                // Include both .jpg and .jpeg for image/jpeg since both are valid JPEG extensions
                if (type === 'image/jpeg') {
                  return ['.jpeg', '.jpg'];
                }
                return [ext];
              }) :
              DEFAULT_VALIDATION_CONFIG.allowedExtensions
          });

          if (validationError) {
            // Update progress with error
            fileProgress.status = 'error';
            fileProgress.error = validationError;
            session.failedFiles++;

            UploadErrorHandler.logError(validationError, {
              fileName: file.name,
              sessionId,
              entityId: entityId || tempEntityId
            });

            toast.error(`${file.name}: ${validationError.userMessage}`);
            continue; // Skip this file
          }

            // Generate a proper path structure for order uploads
            let fileKey;
            // For catering orders, use a consistent path structure
            if (entityType === 'catering' || category === 'catering-order') {
              const currentId = entityId || tempEntityId;
              // Ensure consistent format for temporary entity IDs in storage paths
              const pathEntityId = currentId.startsWith('temp-') ? currentId : `temp-${currentId}`;
              fileKey = `catering_order/${pathEntityId}/${Date.now()}-${uuidv4().substring(0, 8)}`;
                          } else {
              fileKey = `${userId || 'anonymous'}/${entityType || 'general'}/${category || 'uncategorized'}/${uuidv4().substring(0, 8)}-${file.name}`;
            }
            
            newProgresses[fileKey] = 0; // Use a unique key for progress tracking
            setProgresses({ ...newProgresses });

            const formData = new FormData();
            formData.append('file', file);
            
            // Use entityId state, fallback to tempEntityId if entity doesn't exist yet
            const currentEntityId = entityId || tempEntityId;
                        
            if (currentEntityId) {
              formData.append('entityId', currentEntityId);
            }
            if (entityType) {
              formData.append('entityType', entityType);
            }
            if (category) {
              formData.append('category', category);
            }
            if (userId) {
              formData.append('userId', userId);
            }
             if (actualBucketName) {
              formData.append('bucketName', actualBucketName);
            }

            // Log form data entries
                        for (const [key, value] of formData.entries()) {
                          }

            // Update progress - starting upload
            fileProgress.status = 'uploading';
            fileProgress.percentage = 25;
            newProgresses[fileKey] = fileProgress.percentage;
            setProgresses({ ...newProgresses });
            setUploadSession({ ...session });

            // Check for admin mode
            const isAdminMode = typeof window !== 'undefined' && localStorage.getItem('admin_mode') === 'true';

            // Upload via the API route with retry logic
            
            const uploadOperation = async () => {
              const response = await fetch("/api/file-uploads", {
                method: "POST",
                headers: {
                  // Add admin mode headers
                  ...(isAdminMode ? {
                    "x-request-source": "AdminPanel",
                    "x-admin-mode": "true"
                  } : {}),
                  // Add user ID for rate limiting
                  "x-user-id": userId || 'anonymous'
                },
                body: formData,
              });

              if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: response.statusText }));
                throw errorData;
              }

              return response;
            };

            let response;
            try {
              response = await RetryHandler.withRetry(
                uploadOperation,
                {
                  ...DEFAULT_RETRY_CONFIG,
                  maxAttempts: 2, // Fewer retries for frontend
                  baseDelay: 1500
                },
                (error, attempt) => {
                  
                  // Update progress during retry
                  fileProgress.retryCount = attempt;
                  fileProgress.status = 'uploading';
                  fileProgress.percentage = 25 + (attempt * 10); // Show retry progress
                  newProgresses[fileKey] = fileProgress.percentage;
                  setProgresses({ ...newProgresses });
                  setUploadSession({ ...session });
                }
              );
            } catch (error) {
              // Handle upload error
              const uploadError = UploadErrorHandler.categorizeError(error, file);

              fileProgress.status = 'error';
              fileProgress.error = uploadError;
              fileProgress.percentage = 0;
              session.failedFiles++;

              UploadErrorHandler.logError(uploadError, {
                fileName: file.name,
                sessionId,
                entityId: entityId || tempEntityId
              });

              toast.error(`${file.name}: ${uploadError.userMessage}`);
              delete newProgresses[fileKey];
              setProgresses({ ...newProgresses });
              setUploadSession({ ...session });
              continue;
            }

            
            const result = await response.json();
            
            if (!result.success || !result.file) {
              console.error("Upload API returned success:false or no file data:", result);
              toast.error(`Upload failed for ${file.name}: Invalid server response.`);
              fileProgress.status = 'error';
              fileProgress.error = UploadErrorHandler.createValidationError(
                'content',
                'Invalid server response',
                'Upload completed but server returned invalid response.'
              );
              session.failedFiles++;
              delete newProgresses[fileKey];
              setProgresses({ ...newProgresses });
              setUploadSession({ ...session });
              continue;
            }

            // Create the file record from API response
            const uploadedFile: UploadedFile = {
              key: result.file.id, // Assuming the API returns 'id' as the key
              name: result.file.name,
              url: result.file.url,
              path: result.file.path,
              size: result.file.size,
              type: result.file.type,
              entityId: result.file.entityId,
              category: result.file.category,
              bucketName: result.file.bucketName, // Ensure API returns this
            };

            uploadedFilesList.push(uploadedFile);

            // Update progress - upload completed
            fileProgress.status = 'completed';
            fileProgress.percentage = 100;
            fileProgress.lastUpdated = Date.now();
            session.completedFiles++;

            newProgresses[fileKey] = 100;
            setProgresses({ ...newProgresses });
            setUploadSession({ ...session });

            // Optional: Short delay before removing progress bar
            setTimeout(() => {
              setProgresses((prev) => {
                const updated = { ...prev };
                delete updated[fileKey];
                return updated;
              });
            }, 1000);

            toast.success(`${file.name} uploaded successfully`);
          }

        
        // Update session status
        session.status = session.failedFiles > 0 ? 'completed' : 'completed';
        session.endTime = Date.now();
        setUploadSession({ ...session });

        // Update the list of uploaded files in the state
        setUploadedFiles((prev) => [...prev, ...uploadedFilesList]);
        return uploadedFilesList;
      } catch (error: any) {
        console.error("Error during the upload process:", error);

        // Update session status on error
        session.status = 'failed';
        session.error = UploadErrorHandler.categorizeError(error);
        session.endTime = Date.now();
        setUploadSession({ ...session });

        toast.error(`Upload error: ${error.message || "Unknown error"}`);
        return uploadedFilesList; // Return files that were successfully uploaded
      } finally {
        setIsUploading(false);
      }
    },
    [
      progresses,
      uploadedFiles.length,
      maxFileCount,
      maxFileSize,
      allowedFileTypes,
      entityId,
      tempEntityId,
      entityType,
      category,
      userId,
      actualBucketName,
    ]
  );

  // Function to generate a temporary entity ID if one doesn't exist
  const ensureTempEntityId = useCallback(() => {
    if (!entityId && !tempEntityId) {
      const newTempId = uuidv4();
            setTempEntityId(newTempId);
      return newTempId;
    }
    return entityId || tempEntityId;
  }, [entityId, tempEntityId]);

  // Update the entity ID for all uploaded files (using tempEntityId if needed)
  const updateEntityId = useCallback(
    async (newEntityId: string) => {
      try {
        
        // Make an API call to update the entity IDs
        const response = await fetch("/api/file-uploads/update-entity", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            oldEntityId: entityId,
            newEntityId,
            entityType,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to update entity ID");
        }

        // Update local state
        setUploadedFiles((prev) =>
          prev.map((file) => ({
            ...file,
            entityId: newEntityId,
          })),
        );

        setEntityId(newEntityId);
        return true;
      } catch (error) {
        console.error("Error updating entity ID:", error);
        return false;
      }
    },
    [entityId, entityType],
  );

  // Delete a file from Supabase storage and database
  // Delete a file from Supabase storage and database
  const deleteFile = useCallback(
    async (fileKey: string) => {
      try {
        
        // We'll use our API route to delete the file
        const response = await fetch(`/api/file-uploads?fileId=${encodeURIComponent(fileKey)}`, {
          method: "DELETE"
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to delete file");
        }

        // Update local state to remove the deleted file
        setUploadedFiles((prev) => prev.filter((file) => file.key !== fileKey));

        toast.success("File deleted successfully");
        return true;
      } catch (error) {
        console.error("Error deleting file:", error);
        toast.error("Error deleting file. Please try again.");
        throw error;
      }
    },
    [],
  );

  // You can also add a direct Supabase deletion method if needed, but let's keep it simpler:
  const deleteFileWithSupabase = useCallback(
    async (fileKey: string) => {
      try {
        
        // First get the file information from the API
        const infoResponse = await fetch(
          `/api/file-uploads/info?fileId=${fileKey}`,
          {
            method: "GET",
          },
        );

        if (!infoResponse.ok) {
          const errorData = await infoResponse.json();
          throw new Error(errorData.error || "Failed to get file info");
        }

        const fileInfo = await infoResponse.json();

        // Initialize Supabase client
        const client = await initSupabase();
        if (!client) {
          throw new Error("Failed to initialize Supabase client");
        }

        // Extract the file path from the URL using regex
        const fileUrlMatch = fileInfo.fileUrl.match(/user-assets\/([^?#]+)/);
        const filePath = fileUrlMatch?.[1];

        if (!filePath) {
          throw new Error("Could not determine file path from URL");
        }

        // Delete file from Supabase Storage
        const { data, error } = await client.storage
          .from(actualBucketName)
          .remove([filePath]);

        if (error) {
          console.error("Error deleting from Supabase Storage:", error);
          throw error;
        }

        // Delete the record from database
        const dbResponse = await fetch("/api/file-uploads", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ fileId: fileKey }),
        });

        if (!dbResponse.ok) {
          const errorData = await dbResponse.json();
          throw new Error(errorData.error || "Failed to delete file record");
        }

        // Update local state
        setUploadedFiles((prev) => prev.filter((file) => file.key !== fileKey));

        toast.success("File deleted successfully");
        return true;
      } catch (error) {
        console.error("Error deleting file with Supabase:", error);
        toast.error("Error deleting file. Please try again.");
        throw error;
      }
    },
    [initSupabase, actualBucketName],
  );

  // Retry failed uploads
  const retryFailedUploads = useCallback(async () => {
    if (!uploadSession) return [];

    const failedFiles = uploadSession.files.filter(f => f.status === 'error' && f.error?.retryable);
    if (failedFiles.length === 0) {
      toast("No retryable failed uploads found.", { icon: "ℹ️" });
      return [];
    }

        toast(`Retrying ${failedFiles.length} failed uploads...`, { icon: "ℹ️" });

    // For simplicity, we'll retry by calling onUpload again with the original files
    // In a more advanced implementation, you could store the original files and retry only failed ones
    return [];
  }, [uploadSession]);

  // Cancel upload session
  const cancelUpload = useCallback(() => {
    if (uploadSession) {
      setUploadSession({
        ...uploadSession,
        status: 'cancelled',
        endTime: Date.now()
      });
    }
    setIsUploading(false);
    setProgresses({});
  }, [uploadSession]);

  return {
    uploadedFiles,
    isUploading,
    progresses,
    uploadSession,
    entityId,
    tempEntityId,
    onUpload,
    retryFailedUploads,
    cancelUpload,
    updateEntityId,
    deleteFile,
    deleteFileWithSupabase,
  };
}
