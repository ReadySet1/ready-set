"use client";

import React, { useState, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Upload,
  FileText,
  AlertTriangle,
  CheckCircle,
  X,
  Download,
  Loader2,
} from "lucide-react";

interface ImportResult {
  success: string[];
  failed: Array<{ row: number; email: string; reason: string }>;
}

interface BulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: (result: ImportResult) => void;
}

interface PreviewRow {
  email: string;
  name: string;
  type: string;
  status: string;
}

/**
 * Dialog for bulk importing users from CSV
 */
export function BulkImportDialog({
  open,
  onOpenChange,
  onImportComplete,
}: BulkImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = useCallback(() => {
    setFile(null);
    setPreview([]);
    setError(null);
    setIsImporting(false);
    setProgress(0);
    setResults(null);
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onOpenChange(false);
  }, [resetState, onOpenChange]);

  const parseCSVPreview = useCallback((content: string): PreviewRow[] => {
    const lines = content.split(/\r?\n/).filter((line) => line.trim());
    if (lines.length < 2) return [];

    // Skip header, take first 5 data rows
    const dataLines = lines.slice(1, 6);

    return dataLines.map((line) => {
      const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
      return {
        email: values[0] || "",
        name: values[1] || "",
        type: values[2] || "",
        status: values[3] || "",
      };
    });
  }, []);

  const handleFileSelect = useCallback(
    async (selectedFile: File) => {
      setError(null);
      setResults(null);

      // Validate file type
      if (!selectedFile.name.endsWith(".csv") && selectedFile.type !== "text/csv") {
        setError("Please select a CSV file");
        return;
      }

      // Validate file size (10MB)
      if (selectedFile.size > 10 * 1024 * 1024) {
        setError("File size exceeds 10MB limit");
        return;
      }

      try {
        const content = await selectedFile.text();
        const lines = content.split(/\r?\n/).filter((line) => line.trim());

        if (lines.length < 2) {
          setError("CSV must have a header row and at least one data row");
          return;
        }

        // Validate headers
        const firstLine = lines[0];
        if (!firstLine) {
          setError("CSV file has no header row");
          return;
        }
        const headers = firstLine.split(",").map((h) => h.trim().toLowerCase().replace(/^"|"$/g, ""));
        const requiredHeaders = ["email", "type", "status"];
        const missing = requiredHeaders.filter((h) => !headers.includes(h));

        if (missing.length > 0) {
          setError(`Missing required columns: ${missing.join(", ")}`);
          return;
        }

        setFile(selectedFile);
        setPreview(parseCSVPreview(content));
      } catch (err) {
        setError("Failed to read file");
      }
    },
    [parseCSVPreview]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) {
        handleFileSelect(droppedFile);
      }
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleImport = async () => {
    if (!file) return;

    setIsImporting(true);
    setProgress(0);
    setError(null);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setProgress((prev) => Math.min(prev + 10, 90));
    }, 200);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/users/bulk/import", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      clearInterval(progressInterval);
      setProgress(100);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Import failed");
      }

      setResults(data.results);
      onImportComplete(data.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      clearInterval(progressInterval);
      setIsImporting(false);
    }
  };

  const downloadFailedRows = () => {
    if (!results?.failed.length) return;

    const csv = [
      "Row,Email,Error",
      ...results.failed.map(
        (f) => `${f.row},"${f.email}","${f.reason.replace(/"/g, '""')}"`
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "import-errors.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadTemplate = () => {
    const template = [
      "Email,Name,Type,Status,Contact Name,Contact Number,Company Name,Website,Street 1,Street 2,City,State,ZIP",
      "user@example.com,John Doe,VENDOR,ACTIVE,John,555-1234,Acme Inc,https://acme.com,123 Main St,,Austin,TX,78701",
    ].join("\n");

    const blob = new Blob([template], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "user-import-template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-green-500" />
            Import Users from CSV
          </DialogTitle>
          <DialogDescription>
            Upload a CSV file to import multiple users at once.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Download template link */}
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={downloadTemplate}
              className="text-amber-600 hover:text-amber-700"
            >
              <Download className="mr-1 h-4 w-4" />
              Download Template
            </Button>
          </div>

          {/* Error alert */}
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Results summary */}
          {results && (
            <div className="space-y-3">
              <Alert className={results.failed.length === 0 ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}>
                {results.failed.length === 0 ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                )}
                <AlertDescription>
                  <strong>{results.success.length}</strong> users imported successfully.
                  {results.failed.length > 0 && (
                    <span className="text-amber-700">
                      {" "}<strong>{results.failed.length}</strong> failed.
                    </span>
                  )}
                </AlertDescription>
              </Alert>

              {results.failed.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-700">Failed Rows</span>
                    <Button variant="ghost" size="sm" onClick={downloadFailedRows}>
                      <Download className="mr-1 h-4 w-4" />
                      Download Errors
                    </Button>
                  </div>
                  <ScrollArea className="h-[150px] rounded border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[60px]">Row</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Error</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {results.failed.slice(0, 10).map((f, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-slate-600">{f.row}</TableCell>
                            <TableCell className="text-slate-600">{f.email}</TableCell>
                            <TableCell className="text-red-600 text-sm">{f.reason}</TableCell>
                          </TableRow>
                        ))}
                        {results.failed.length > 10 && (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center text-slate-500 text-sm">
                              ... and {results.failed.length - 10} more errors
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              )}
            </div>
          )}

          {/* File dropzone */}
          {!results && !isImporting && (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => fileInputRef.current?.click()}
              className={`
                flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 cursor-pointer transition-colors
                ${file ? "border-green-300 bg-green-50" : "border-slate-300 hover:border-amber-400 hover:bg-amber-50"}
              `}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                className="hidden"
              />
              {file ? (
                <>
                  <FileText className="h-10 w-10 text-green-500 mb-2" />
                  <p className="text-sm font-medium text-green-700">{file.name}</p>
                  <p className="text-xs text-green-600 mt-1">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                      setPreview([]);
                    }}
                    className="mt-2 text-slate-500"
                  >
                    <X className="mr-1 h-4 w-4" />
                    Remove
                  </Button>
                </>
              ) : (
                <>
                  <Upload className="h-10 w-10 text-slate-400 mb-2" />
                  <p className="text-sm text-slate-600">
                    Drag and drop a CSV file, or click to browse
                  </p>
                  <p className="text-xs text-slate-400 mt-1">Max file size: 10MB</p>
                </>
              )}
            </div>
          )}

          {/* Preview table */}
          {preview.length > 0 && !results && !isImporting && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">Preview (first 5 rows)</p>
              <ScrollArea className="h-[150px] rounded border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-slate-600">{row.email}</TableCell>
                        <TableCell className="text-slate-600">{row.name || "-"}</TableCell>
                        <TableCell className="text-slate-600">{row.type}</TableCell>
                        <TableCell className="text-slate-600">{row.status}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          )}

          {/* Progress */}
          {isImporting && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
                <span className="text-sm font-medium text-slate-700">Importing users...</span>
              </div>
              <Progress value={progress} className="h-2" indicatorClassName="bg-amber-500" />
              <p className="text-xs text-slate-500 text-center">{progress}% complete</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isImporting}>
            {results ? "Close" : "Cancel"}
          </Button>
          {!results && (
            <Button
              onClick={handleImport}
              disabled={!file || isImporting}
              className="bg-green-600 hover:bg-green-700"
            >
              {isImporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Import Users
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
