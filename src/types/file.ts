// types/file.ts
export interface FileUpload {
    id: string;
    fileName: string;
    fileType: string | null;
    fileSize: number;
    fileUrl: string;
    filePath?: string | null; // Storage path for generating signed URLs
    entityType: string;
    entityId: string;
    category?: string;
    uploadedAt: Date;
    updatedAt: Date;
    userId?: string;
    cateringRequestId?: number;
    onDemandId?: number;
    isTemporary: boolean;
  }