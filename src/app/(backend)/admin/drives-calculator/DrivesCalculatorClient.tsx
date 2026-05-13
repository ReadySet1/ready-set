"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Calculator,
  CalendarIcon,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  SkipForward,
  FileSpreadsheet,
} from "lucide-react";
import { format } from "date-fns";

interface DriveCalculationOutput {
  totalMileage: number;
  mileageRate: number;
  totalMileagePay: number;
  driverTotalBasePay: number;
  bonusVariance: number;
  readySetFee: number;
  readySetAddonFee: number;
  readySetMileageRate: number;
  readySetTotalFee: number;
  toll: number;
  tip: number;
  driverBonusPay: number;
  adjustment: number;
  totalDriverPay: number;
}

interface DriveCalculationResult {
  rowIndex: number;
  status: "calculated" | "skipped" | "error";
  reason?: string;
  vendorName: string;
  driverName: string;
  client: string;
  date: string;
  headcount: number;
  foodCost: number;
  configId: string | null;
  output?: DriveCalculationOutput;
}

interface PipelinePreviewResult {
  rows: DriveCalculationResult[];
  summary: {
    total: number;
    calculated: number;
    skipped: number;
    errors: number;
    unmappedVendors: string[];
  };
}

interface AvailableConfig {
  id: string;
  label: string;
}

const AVAILABLE_CONFIGS: AvailableConfig[] = [
  { id: "ready-set-food-standard", label: "Ready Set Food - Standard (Destino)" },
  { id: "ready-set-food-premium", label: "Ready Set Food - Premium (Destino)" },
  { id: "kasa", label: "Kasa" },
  { id: "cater-valley", label: "CaterValley" },
  { id: "try-hungry", label: "Try Hungry" },
  { id: "hy-food-company-direct", label: "HY Food Company" },
  { id: "generic-template", label: "Generic Template" },
];

function formatCurrency(value: number): string {
  return `$${value.toFixed(2)}`;
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "calculated":
      return (
        <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
          <CheckCircle2 className="mr-1 h-3 w-3" />
          Calculated
        </Badge>
      );
    case "skipped":
      return (
        <Badge variant="secondary">
          <SkipForward className="mr-1 h-3 w-3" />
          Skipped
        </Badge>
      );
    case "error":
      return (
        <Badge variant="destructive">
          <XCircle className="mr-1 h-3 w-3" />
          Error
        </Badge>
      );
    default:
      return <Badge>{status}</Badge>;
  }
}

interface DrivesCalculatorClientProps {
  userType: string;
}

export default function DrivesCalculatorClient({
  userType,
}: DrivesCalculatorClientProps) {
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [forceRecalculate, setForceRecalculate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [writing, setWriting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PipelinePreviewResult | null>(null);
  const [vendorOverrides, setVendorOverrides] = useState<Record<string, string>>({});
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [writeResult, setWriteResult] = useState<{
    written: number;
    errors: string[];
  } | null>(null);

  const canWrite = ["admin", "super_admin"].includes(userType);

  const handlePreview = useCallback(async () => {
    if (!startDate || !endDate) return;

    setLoading(true);
    setError(null);
    setPreview(null);
    setWriteResult(null);

    try {
      const res = await fetch("/api/drives-pipeline/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          forceRecalculate,
          vendorOverrides:
            Object.keys(vendorOverrides).length > 0
              ? vendorOverrides
              : undefined,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error || "Preview failed");
        return;
      }

      setPreview(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview request failed");
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, forceRecalculate, vendorOverrides]);

  const handleWrite = useCallback(async () => {
    if (!preview) return;

    setWriting(true);
    setShowConfirmDialog(false);
    setError(null);

    try {
      const calculatedRows = preview.rows.filter(
        (r) => r.status === "calculated",
      );

      const res = await fetch("/api/drives-pipeline/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ results: calculatedRows }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error || "Write failed");
        return;
      }

      setWriteResult(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Write request failed");
    } finally {
      setWriting(false);
    }
  }, [preview]);

  const handleVendorOverride = useCallback(
    (vendor: string, configId: string) => {
      setVendorOverrides((prev) => ({ ...prev, [vendor]: configId }));
    },
    [],
  );

  const calculatedCount =
    preview?.rows.filter((r) => r.status === "calculated").length ?? 0;

  return (
    <div className="container mx-auto max-w-7xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <FileSpreadsheet className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Drives Calculator</h1>
          <p className="text-sm text-muted-foreground">
            Calculate distances and costs for drives, then write results back to
            the Google Sheet
          </p>
        </div>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Calculate Drives
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            {/* Start Date */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Start Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-[200px] justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* End Date */}
            <div className="space-y-2">
              <label className="text-sm font-medium">End Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-[200px] justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Force Recalculate */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="forceRecalculate"
                checked={forceRecalculate}
                onChange={(e) => setForceRecalculate(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <label htmlFor="forceRecalculate" className="text-sm">
                Force recalculate (overwrite existing values)
              </label>
            </div>

            {/* Preview Button */}
            <Button
              onClick={handlePreview}
              disabled={!startDate || !endDate || loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Calculating...
                </>
              ) : (
                <>
                  <Calculator className="mr-2 h-4 w-4" />
                  Preview
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="flex items-center gap-2 pt-6">
            <XCircle className="h-5 w-5 text-destructive" />
            <span className="text-destructive">{error}</span>
          </CardContent>
        </Card>
      )}

      {/* Write Result */}
      {writeResult && (
        <Card className="border-green-500">
          <CardContent className="flex items-center gap-2 pt-6">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <span className="text-green-700">
              Successfully wrote {writeResult.written} rows to the sheet.
              {writeResult.errors.length > 0 && (
                <span className="text-destructive">
                  {" "}
                  Errors: {writeResult.errors.join("; ")}
                </span>
              )}
            </span>
          </CardContent>
        </Card>
      )}

      {/* Unmapped Vendors */}
      {preview && preview.summary.unmappedVendors.length > 0 && (
        <Card className="border-yellow-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-700">
              <AlertTriangle className="h-5 w-5" />
              Unmapped Vendors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              These vendor names could not be matched to a calculator
              configuration. Select a configuration for each, then click Preview
              again.
            </p>
            <div className="space-y-3">
              {preview.summary.unmappedVendors.map((vendor) => (
                <div key={vendor} className="flex items-center gap-3">
                  <span className="min-w-[200px] text-sm font-medium">
                    {vendor}
                  </span>
                  <Select
                    value={vendorOverrides[vendor] || ""}
                    onValueChange={(value) =>
                      handleVendorOverride(vendor, value)
                    }
                  >
                    <SelectTrigger className="w-[300px]">
                      <SelectValue placeholder="Select configuration..." />
                    </SelectTrigger>
                    <SelectContent>
                      {AVAILABLE_CONFIGS.map((config) => (
                        <SelectItem key={config.id} value={config.id}>
                          {config.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview Summary */}
      {preview && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Preview Results</CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{preview.summary.total} total</Badge>
                <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                  {preview.summary.calculated} calculated
                </Badge>
                <Badge variant="secondary">
                  {preview.summary.skipped} skipped
                </Badge>
                {preview.summary.errors > 0 && (
                  <Badge variant="destructive">
                    {preview.summary.errors} errors
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Results Table */}
            <div className="max-h-[600px] overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky top-0 bg-background">Row</TableHead>
                    <TableHead className="sticky top-0 bg-background">Status</TableHead>
                    <TableHead className="sticky top-0 bg-background">Date</TableHead>
                    <TableHead className="sticky top-0 bg-background">Vendor</TableHead>
                    <TableHead className="sticky top-0 bg-background">Driver</TableHead>
                    <TableHead className="sticky top-0 bg-background">Client</TableHead>
                    <TableHead className="sticky top-0 bg-background text-right">HC</TableHead>
                    <TableHead className="sticky top-0 bg-background text-right">Miles</TableHead>
                    <TableHead className="sticky top-0 bg-background text-right">Driver Pay</TableHead>
                    <TableHead className="sticky top-0 bg-background text-right">RS Fee</TableHead>
                    <TableHead className="sticky top-0 bg-background text-right">RS Total</TableHead>
                    <TableHead className="sticky top-0 bg-background">Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.rows.map((row) => (
                    <TableRow
                      key={row.rowIndex}
                      className={
                        row.status === "error"
                          ? "bg-red-50"
                          : row.status === "skipped"
                            ? "bg-gray-50"
                            : ""
                      }
                    >
                      <TableCell className="font-mono text-xs">
                        {row.rowIndex}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={row.status} />
                      </TableCell>
                      <TableCell className="text-sm">{row.date}</TableCell>
                      <TableCell className="max-w-[150px] truncate text-sm">
                        {row.vendorName}
                      </TableCell>
                      <TableCell className="text-sm">{row.driverName}</TableCell>
                      <TableCell className="max-w-[150px] truncate text-sm">
                        {row.client}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {row.headcount || "-"}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {row.output?.totalMileage?.toFixed(1) ?? "-"}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        {row.output
                          ? formatCurrency(row.output.totalDriverPay)
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {row.output
                          ? formatCurrency(row.output.readySetFee)
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {row.output
                          ? formatCurrency(row.output.readySetTotalFee)
                          : "-"}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                        {row.reason || row.configId || ""}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Write Button */}
            {canWrite && calculatedCount > 0 && (
              <div className="mt-4 flex justify-end">
                <Button
                  onClick={() => setShowConfirmDialog(true)}
                  disabled={writing}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {writing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Writing...
                    </>
                  ) : (
                    <>
                      <FileSpreadsheet className="mr-2 h-4 w-4" />
                      Write {calculatedCount} rows to Sheet
                    </>
                  )}
                </Button>
              </div>
            )}

            {!canWrite && calculatedCount > 0 && (
              <p className="mt-4 text-sm text-muted-foreground">
                You need admin access to write results to the sheet.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Write to Google Sheet</DialogTitle>
            <DialogDescription>
              You are about to write {calculatedCount} calculated values to the
              &quot;Drives - Coolfire&quot; sheet. This will update the financial
              columns (Total Mileage through Total Driver Pay) for each
              calculated row.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleWrite}
              className="bg-green-600 hover:bg-green-700"
            >
              Write to Sheet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
