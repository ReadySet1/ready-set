# File Upload API Documentation

## Overview

The file upload API provides secure file upload functionality with support for multiple file types including images, PDFs, and Microsoft Office documents (Word, Excel, PowerPoint).

## Endpoints

### POST `/api/file-uploads`

Upload a file to the system.

**Authentication**: Required (Supabase session)

**Request**:
- `Content-Type`: `multipart/form-data`
- Form fields:
  - `file`: File to upload (required)
  - `entityId`: ID of the entity this file belongs to (required)
  - `entityType`: Type of entity (`catering_request`, `user`, etc.) (required)
  - `category`: File category (`attachment`, `document`, etc.) (optional, default: `attachment`)
  - `userType`: User type (`client`, `vendor`, `admin`) (optional, auto-detected)

**Supported File Types**:
- Images: JPEG, JPG, PNG, GIF, WebP
- Documents: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX
- Text: TXT, CSV

**Response**:
```json
{
  "success": true,
  "file": {
    "id": "file-id",
    "fileName": "document.pdf",
    "filePath": "path/to/file",
    "fileUrl": "https://signed-url...",
    "fileSize": 1024,
    "mimeType": "application/pdf"
  }
}
```

**Error Responses**:
- `401`: Unauthorized
- `400`: Bad request (invalid file type, size, etc.)
- `500`: Server error

### POST `/api/file-uploads/catering/upload`

Upload a file specifically for a catering request.

**Authentication**: Required (Supabase session)

**Request**: Same as `/api/file-uploads` but `entityType` defaults to `catering_request`

**Response**: Same as `/api/file-uploads`

## Security Features

- **RLS Policies**: All uploads are protected by Row-Level Security policies
- **Signed URLs**: Files are accessed via time-limited signed URLs
- **File Type Validation**: Only allowed MIME types are accepted
- **Size Limits**: 100MB maximum file size
- **Virus Scanning**: Files are scanned for malicious content (quarantine bucket)

## Storage Buckets

- **fileUploader**: Primary bucket for user files and documents
- **quarantine**: Temporary storage for files pending security scan

## Related Issues

- REA-53: Document upload security fixes and PowerPoint support

