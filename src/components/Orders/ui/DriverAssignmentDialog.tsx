// src/components/Orders/ui/DriverAssignmentDialog.tsx

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Driver } from "@/types/order";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Search, Truck, Phone, CheckCircle, RadioTower, X, Info, UserCheck } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

interface DriverAssignmentDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  isDriverAssigned: boolean;
  drivers: Driver[];
  selectedDriver: string | null;
  onDriverSelection: (driverId: string) => void;
  onAssignOrEditDriver: () => void;
}

const DriverAssignmentDialog: React.FC<DriverAssignmentDialogProps> = ({
  isOpen,
  onOpenChange,
  isDriverAssigned,
  drivers,
  selectedDriver,
  onDriverSelection,
  onAssignOrEditDriver,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredDrivers, setFilteredDrivers] = useState<Driver[]>(drivers);
  const itemsPerPage = 4; // Reduced for better mobile experience

  // Filter drivers when search term or drivers array changes
  useEffect(() => {
    if (searchTerm.trim() === "") {
      setFilteredDrivers(drivers);
    } else {
      const lowercaseSearch = searchTerm.toLowerCase();
      const filtered = drivers.filter(
        (driver) =>
          (driver.name?.toLowerCase().includes(lowercaseSearch) ?? false) ||
          (driver.contactNumber && driver.contactNumber.includes(searchTerm)),
      );
      setFilteredDrivers(filtered);
    }
    // Reset to first page when filters change
    setCurrentPage(1);
  }, [searchTerm, drivers]);

  const indexOfLastDriver = currentPage * itemsPerPage;
  const indexOfFirstDriver = indexOfLastDriver - itemsPerPage;
  const currentDrivers = filteredDrivers.slice(
    indexOfFirstDriver,
    indexOfLastDriver,
  );
  const totalPages = Math.ceil(filteredDrivers.length / itemsPerPage);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Get initials for avatar
  const getInitials = (name: string): string => {
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  // Handle clearing the search
  const clearSearch = () => {
    setSearchTerm("");
  };

  // Get the selected driver object
  const getSelectedDriver = (): Driver | undefined => {
    return drivers.find((driver) => driver.id === selectedDriver);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-[700px] max-h-[90vh] bg-white border-none shadow-2xl rounded-2xl overflow-hidden p-0 gap-0">
        <DialogHeader className="pt-6 px-4 sm:px-6 pb-4 bg-gradient-to-r from-yellow-50 via-primary/10 to-white border-b">
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl font-bold bg-gradient-to-r from-primary to-custom-yellow bg-clip-text text-transparent">
            <Truck className="h-5 w-5 text-primary" />
            {isDriverAssigned ? "Update Driver Assignment" : "Assign Driver"}
          </DialogTitle>
          <DialogDescription className="text-slate-600 text-sm sm:text-base">
            {isDriverAssigned
              ? "Select a different driver to update the current assignment."
              : "Select a driver to assign to this order."}
          </DialogDescription>
        </DialogHeader>

        <div className="px-4 sm:px-6 py-4 flex-1 overflow-hidden">
          {/* Show selected driver at the top if one is selected */}
          <AnimatePresence>
            {selectedDriver && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="mb-4"
              >
                <div className="mb-2 text-sm font-medium text-slate-600 flex items-center">
                  <UserCheck className="h-3.5 w-3.5 mr-1.5 text-primary" />
                  Selected Driver
                </div>
                <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-gradient-to-r from-yellow-50 to-primary/10 p-3 sm:p-4 shadow-sm">
                  <Avatar className="h-10 w-10 sm:h-12 sm:w-12 border-2 border-primary/20 shadow-sm">
                    <AvatarFallback className="bg-gradient-to-br from-primary to-custom-yellow text-white font-semibold">
                      {getInitials(getSelectedDriver()?.name || "")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-800 truncate">
                      {getSelectedDriver()?.name}
                    </div>
                    <div className="flex items-center gap-1 text-sm text-slate-600">
                      <Phone className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{getSelectedDriver()?.contactNumber || "No phone"}</span>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className="border-primary/30 bg-primary/20 text-primary font-medium shadow-sm flex-shrink-0"
                  >
                    <CheckCircle className="mr-1 h-3 w-3" />
                    <span className="hidden sm:inline">Selected</span>
                    <span className="sm:hidden">✓</span>
                  </Badge>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="relative mb-4">
            <div className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400">
              <Search className="h-4 w-4" />
            </div>
            <Input
              placeholder="Search drivers by name or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-9 border-slate-200 focus:border-primary focus:ring-primary/20 transition-colors rounded-lg h-11"
            />
            {searchTerm && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {currentDrivers.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
              className="py-8 sm:py-12 text-center"
            >
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
                <Truck className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-800 mb-2">
                No drivers found
              </h3>
              <p className="mx-auto max-w-sm text-slate-500 text-sm sm:text-base">
                {searchTerm
                  ? `No drivers match "${searchTerm}". Try a different search term.`
                  : "There are no drivers available to assign."}
              </p>
            </motion.div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm">
              {/* Desktop Table View */}
              <div className="hidden sm:block">
                <ScrollArea className="h-[280px]">
                  <Table>
                    <TableHeader className="bg-gradient-to-r from-slate-50 to-white sticky top-0 z-10">
                      <TableRow>
                        <TableHead className="w-[300px] font-semibold text-slate-700">Driver</TableHead>
                        <TableHead className="font-semibold text-slate-700">Status</TableHead>
                        <TableHead className="text-right font-semibold text-slate-700">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <AnimatePresence>
                        {currentDrivers.map((driver, index) => (
                          <motion.tr
                            key={driver.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2, delay: index * 0.05 }}
                            className={
                              selectedDriver === driver.id 
                                ? "bg-gradient-to-r from-yellow-50 to-white border-l-4 border-l-primary" 
                                : "hover:bg-slate-50/50 transition-colors"
                            }
                          >
                            <TableCell className="py-4">
                              <div className="flex items-center gap-3">
                                <Avatar className={`h-10 w-10 border-2 ${selectedDriver === driver.id ? 'border-primary/30 shadow-sm' : 'border-slate-200'}`}>
                                  <AvatarFallback
                                    className={
                                      selectedDriver === driver.id
                                        ? "bg-gradient-to-br from-primary to-custom-yellow text-white font-semibold"
                                        : "bg-slate-100 text-slate-600"
                                    }
                                  >
                                    {getInitials(driver.name ?? "")}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <div className="font-medium text-slate-800">{driver.name}</div>
                                  <div className="flex items-center gap-1 text-sm text-slate-500">
                                    <Phone className="h-3 w-3" />
                                    {driver.contactNumber || "No phone"}
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className="border-green-200 bg-green-50 text-green-700 shadow-sm"
                              >
                                <RadioTower className="mr-1 h-3 w-3" />
                                Active
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                onClick={() => onDriverSelection(driver.id)}
                                variant={
                                  selectedDriver === driver.id ? "default" : "outline"
                                }
                                size="sm"
                                className={
                                  selectedDriver === driver.id
                                    ? "bg-gradient-to-r from-primary to-custom-yellow hover:from-primary/90 hover:to-custom-yellow/90 text-white shadow-sm font-medium"
                                    : "border-slate-200 text-slate-600 hover:border-primary/30 hover:text-primary hover:bg-yellow-50 transition-all"
                                }
                              >
                                {selectedDriver === driver.id ? (
                                  <>
                                    <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
                                    Selected
                                  </>
                                ) : (
                                  "Select"
                                )}
                              </Button>
                            </TableCell>
                          </motion.tr>
                        ))}
                      </AnimatePresence>
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>

              {/* Mobile Card View */}
              <div className="sm:hidden">
                <ScrollArea className="h-[280px] px-2">
                  <div className="space-y-3 py-2">
                    <AnimatePresence>
                      {currentDrivers.map((driver, index) => (
                        <motion.div
                          key={driver.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.2, delay: index * 0.05 }}
                          className={`rounded-lg border p-3 transition-all ${
                            selectedDriver === driver.id
                              ? "border-primary/30 bg-gradient-to-r from-yellow-50 to-primary/10 shadow-sm"
                              : "border-slate-200 bg-white hover:border-slate-300"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <Avatar className={`h-12 w-12 border-2 ${selectedDriver === driver.id ? 'border-primary/30' : 'border-slate-200'}`}>
                              <AvatarFallback
                                className={
                                  selectedDriver === driver.id
                                    ? "bg-gradient-to-br from-primary to-custom-yellow text-white font-semibold"
                                    : "bg-slate-100 text-slate-600"
                                }
                              >
                                {getInitials(driver.name ?? "")}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-slate-800 truncate">{driver.name}</div>
                              <div className="flex items-center gap-1 text-sm text-slate-500 mb-1">
                                <Phone className="h-3 w-3 flex-shrink-0" />
                                <span className="truncate">{driver.contactNumber || "No phone"}</span>
                              </div>
                              <Badge
                                variant="outline"
                                className="border-green-200 bg-green-50 text-green-700 text-xs"
                              >
                                <RadioTower className="mr-1 h-2.5 w-2.5" />
                                Active
                              </Badge>
                            </div>
                            <Button
                              onClick={() => onDriverSelection(driver.id)}
                              variant={selectedDriver === driver.id ? "default" : "outline"}
                              size="sm"
                              className={
                                selectedDriver === driver.id
                                  ? "bg-gradient-to-r from-primary to-custom-yellow hover:from-primary/90 hover:to-custom-yellow/90 text-white shadow-sm font-medium"
                                  : "border-slate-200 text-slate-600 hover:border-primary/30 hover:text-primary hover:bg-yellow-50 transition-all"
                              }
                            >
                              {selectedDriver === driver.id ? (
                                <CheckCircle className="h-4 w-4" />
                              ) : (
                                "Select"
                              )}
                            </Button>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </ScrollArea>
              </div>

              {totalPages > 1 && (
                <div className="border-t bg-gradient-to-r from-slate-50 to-white p-3">
                  <Pagination>
                    <PaginationContent className="flex-wrap gap-1">
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() =>
                            handlePageChange(Math.max(1, currentPage - 1))
                          }
                          className={`cursor-pointer transition-colors hover:text-primary text-sm ${currentPage === 1 ? "pointer-events-none opacity-50" : ""}`}
                        />
                      </PaginationItem>
                      {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                        let page;
                        if (totalPages <= 5) {
                          page = i + 1;
                        } else if (currentPage <= 3) {
                          page = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          page = totalPages - 4 + i;
                        } else {
                          page = currentPage - 2 + i;
                        }
                        return (
                          <PaginationItem key={page}>
                            <PaginationLink
                              onClick={() => handlePageChange(page)}
                              isActive={currentPage === page}
                              className={`cursor-pointer transition-all text-sm ${
                                currentPage === page 
                                  ? "bg-gradient-to-r from-primary to-custom-yellow text-white hover:from-primary/90 hover:to-custom-yellow/90 shadow-sm font-medium" 
                                  : "hover:bg-yellow-50 hover:text-primary"
                              }`}
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      })}
                      <PaginationItem>
                        <PaginationNext
                          onClick={() =>
                            handlePageChange(
                              Math.min(totalPages, currentPage + 1),
                            )
                          }
                          className={`cursor-pointer transition-colors hover:text-primary text-sm ${currentPage === totalPages ? "pointer-events-none opacity-50" : ""}`}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </div>
          )}

          <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-100 text-blue-700 text-sm">
            <Info className="h-4 w-4 flex-shrink-0 text-blue-500 mt-0.5" />
            <p>Assigned drivers will be notified immediately about the order details and pickup information.</p>
          </div>
        </div>

        <DialogFooter className="bg-gradient-to-r from-slate-50 to-white p-4 sm:p-6 border-t flex flex-col-reverse sm:flex-row gap-3 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors h-11"
          >
            Cancel
          </Button>
          <Button
            onClick={onAssignOrEditDriver}
            disabled={!selectedDriver}
            className="w-full sm:w-auto bg-gradient-to-r from-primary to-custom-yellow hover:from-primary/90 hover:to-custom-yellow/90 text-white shadow-sm transition-all hover:shadow-md font-medium h-11 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDriverAssigned ? "Update Driver" : "Assign Driver"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DriverAssignmentDialog;
