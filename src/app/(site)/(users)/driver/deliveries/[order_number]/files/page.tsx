'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Download, FileText, Loader2, Paperclip, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FileUploader } from '@/components/Uploader/basic-file-uploader';
import { useDriverDelivery } from '@/hooks/useDriverDelivery';

interface OrderFile {
  id: string;
  fileName: string;
  fileUrl: string;
  category?: string | null;
  uploadedAt?: string;
}

const OrderFilesPage = () => {
  const params = useParams();
  const router = useRouter();

  const orderNumber = (() => {
    if (!params?.order_number) return '';
    const raw = Array.isArray(params.order_number) ? params.order_number[0] : params.order_number;
    return raw ? decodeURIComponent(raw) : '';
  })();

  const { delivery, isLoading: isDeliveryLoading, error: deliveryError } = useDriverDelivery(orderNumber);

  const [files, setFiles] = useState<OrderFile[]>([]);
  const [isFilesLoading, setIsFilesLoading] = useState(true);
  const [filesError, setFilesError] = useState<string | null>(null);

  // Upload state
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const fetchFiles = useCallback(async () => {
    if (!orderNumber) return;
    setIsFilesLoading(true);
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderNumber)}/files`);
      if (!res.ok) throw new Error('Failed to fetch files');
      const data = await res.json();
      setFiles(data.files ?? []);
      setFilesError(null);
    } catch (err) {
      setFilesError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsFilesLoading(false);
    }
  }, [orderNumber]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const handleUpload = async (filesToUpload: File[]) => {
    if (!delivery) return;
    setIsUploading(true);
    try {
      for (const file of filesToUpload) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('category', 'delivery-proof');
        formData.append('entityType', 'order');
        formData.append('entityId', delivery.id);

        const res = await fetch('/api/file-uploads/', {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) throw new Error(`Failed to upload ${file.name}`);
      }
      setUploadFiles([]);
      await fetchFiles();
    } catch (err) {
      console.error('Upload error:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleBack = () => {
    router.push(`/driver/deliveries/${encodeURIComponent(orderNumber)}`);
  };

  if (isDeliveryLoading) {
    return (
      <div className="flex items-center justify-center h-[100dvh]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (deliveryError || !delivery) {
    return (
      <div className="flex flex-col items-center justify-center h-[100dvh] px-4">
        <p className="text-red-600 mb-3">{deliveryError || 'Delivery not found'}</p>
        <button type="button" onClick={handleBack} className="text-sm font-medium text-gray-700 underline">
          Back to Cockpit
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-gray-50">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-white border-b px-4 h-14 flex items-center gap-3">
        <button
          type="button"
          onClick={handleBack}
          className="w-11 h-11 rounded-full flex items-center justify-center hover:bg-gray-100"
          aria-label="Back to cockpit"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <h1 className="text-base font-semibold text-gray-900">
          Files — #{delivery.orderNumber}
        </h1>
      </div>

      <div className="px-4 py-5 space-y-4 max-w-lg mx-auto">
        {/* Existing files */}
        <div className="bg-white rounded-xl border p-4 space-y-3">
          <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-1.5">
            <Paperclip className="w-4 h-4 text-gray-500" />
            Order Files
          </h3>

          {isFilesLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : filesError ? (
            <div className="text-center py-4">
              <p className="text-sm text-red-600 mb-2">{filesError}</p>
              <Button variant="outline" size="sm" onClick={fetchFiles}>
                Retry
              </Button>
            </div>
          ) : files.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No files attached to this order.</p>
          ) : (
            <div className="space-y-2">
              {files.map((file) => (
                <a
                  key={file.id}
                  href={file.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 rounded-lg border hover:bg-gray-50 transition-colors"
                >
                  <FileText className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{file.fileName}</p>
                    {file.category && (
                      <p className="text-xs text-gray-500 capitalize">{file.category.replace(/-/g, ' ')}</p>
                    )}
                  </div>
                  <Download className="w-4 h-4 text-gray-400 flex-shrink-0" />
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Upload */}
        <div className="bg-white rounded-xl border p-4 space-y-3">
          <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-1.5">
            <Upload className="w-4 h-4 text-gray-500" />
            Upload Files
          </h3>
          <FileUploader
            value={uploadFiles}
            onValueChange={setUploadFiles}
            onUpload={handleUpload}
            onUploadSuccess={fetchFiles}
            maxFileCount={5}
            multiple
            disabled={isUploading}
          />
        </div>
      </div>
    </div>
  );
};

export default OrderFilesPage;
