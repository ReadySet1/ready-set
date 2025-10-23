"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  FileText,
  CheckCircle,
  XCircle,
  Calendar,
  Trash2,
  ExternalLink,
  RefreshCw,
  User,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  GraduationCap,
  Award,
  MessageSquare,
  Clock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { JobApplication, ApplicationStatus } from "@/types/job-application";

// Enhanced status config with modern styling
const statusConfig = {
  [ApplicationStatus.PENDING]: { 
    className: "bg-gradient-to-r from-amber-50 to-amber-100 text-amber-800 border border-amber-200", 
    icon: <Clock className="h-3 w-3 mr-1" />,
    color: "amber"
  },
  [ApplicationStatus.APPROVED]: { 
    className: "bg-gradient-to-r from-emerald-50 to-emerald-100 text-emerald-800 border border-emerald-200", 
    icon: <CheckCircle className="h-3 w-3 mr-1" />,
    color: "emerald"
  },
  [ApplicationStatus.REJECTED]: { 
    className: "bg-gradient-to-r from-red-50 to-red-100 text-red-800 border border-red-200", 
    icon: <XCircle className="h-3 w-3 mr-1" />,
    color: "red"
  },
  [ApplicationStatus.INTERVIEWING]: { 
    className: "bg-gradient-to-r from-blue-50 to-blue-100 text-blue-800 border border-blue-200", 
    icon: <Calendar className="h-3 w-3 mr-1" />,
    color: "blue"
  },
};

const getStatusConfig = (status: ApplicationStatus) => {
  return statusConfig[status] || { 
    className: "bg-gradient-to-r from-gray-50 to-gray-100 text-gray-800 border border-gray-200", 
    icon: null,
    color: "gray"
  };
};

type ApplicationDetailDialogProps = {
  application: JobApplication | null;
  open: boolean;
  onClose: () => void;
  onStatusChange: (id: string, status: ApplicationStatus) => void;
  onDeleteClick: (application: JobApplication) => void;
  isSubmitting: boolean;
  error: string | null;
  canDeleteApplications: boolean;
};

export const ApplicationDetailDialog: React.FC<ApplicationDetailDialogProps> = ({
  application,
  open,
  onClose,
  onStatusChange,
  onDeleteClick,
  isSubmitting,
  error,
  canDeleteApplications,
}) => {
  if (!application) return null;

  // Format date helper
  const formatDate = (dateString: string | Date) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Open document utility function
  const openDocument = (url: string | null) => {
    if (!url) return;
    window.open(url, "_blank");
  };

  // Get document sources from both legacy fields and new fileUploads
  // Helper function to convert category to friendly label
  const getCategoryLabel = (category: string): string => {
    const categoryMap: Record<string, string> = {
      'resume': 'Resume',
      'license': 'Driver\'s License',
      'insurance': 'Insurance',
      'registration': 'Vehicle Registration',
      'food_handler': 'Food Handler Certificate',
      'hipaa': 'HIPAA Certificate',
      'driver_photo': 'Driver Photo',
      'car_photo': 'Vehicle Photo',
      'equipment_photo': 'Equipment Photo',
    };

    // Extract the base category from paths like "job-applications/temp/license"
    const match = category.match(/\/(license|insurance|registration|food_handler|hipaa|driver_photo|car_photo|equipment_photo|resume)$/);
    if (match && match[1]) {
      return categoryMap[match[1]] || category;
    }

    // Check for exact match
    if (categoryMap[category]) {
      return categoryMap[category];
    }

    // Fallback: capitalize first letter
    return category.charAt(0).toUpperCase() + category.slice(1).replace(/_/g, ' ');
  };

  const getDocumentSources = () => {
    const sources: { label: string; url: string | null; category?: string; icon: React.ReactNode }[] = [];

    // Add resume
    if (application.resumeUrl) {
      sources.push({ label: "Resume", url: application.resumeUrl, icon: <FileText className="h-4 w-4" /> });
    }

    // Add driver's license if applicable
    if (application.driversLicenseUrl) {
      sources.push({ label: "Driver's License", url: application.driversLicenseUrl, icon: <Award className="h-4 w-4" /> });
    }

    // Add insurance if applicable
    if (application.insuranceUrl) {
      sources.push({ label: "Insurance", url: application.insuranceUrl, icon: <FileText className="h-4 w-4" /> });
    }

    // Add vehicle registration if applicable
    if (application.vehicleRegUrl) {
      sources.push({ label: "Vehicle Registration", url: application.vehicleRegUrl, icon: <FileText className="h-4 w-4" /> });
    }

    // Add food handler if applicable
    if (application.foodHandlerUrl) {
      sources.push({ label: "Food Handler Certificate", url: application.foodHandlerUrl, icon: <Award className="h-4 w-4" /> });
    }

    // Add HIPAA if applicable
    if (application.hipaaUrl) {
      sources.push({ label: "HIPAA Certificate", url: application.hipaaUrl, icon: <Award className="h-4 w-4" /> });
    }

    // Add photos if applicable
    if (application.driverPhotoUrl) {
      sources.push({ label: "Driver Photo", url: application.driverPhotoUrl, icon: <User className="h-4 w-4" /> });
    }

    if (application.carPhotoUrl) {
      sources.push({ label: "Vehicle Photo", url: application.carPhotoUrl, icon: <FileText className="h-4 w-4" /> });
    }

    if (application.equipmentPhotoUrl) {
      sources.push({ label: "Equipment Photo", url: application.equipmentPhotoUrl, icon: <FileText className="h-4 w-4" /> });
    }

    // Add any file uploads
    if (application.fileUploads?.length) {
      application.fileUploads.forEach(upload => {
        const friendlyLabel = upload.category ? getCategoryLabel(upload.category) : upload.fileName;
        sources.push({
          label: friendlyLabel,
          url: upload.fileUrl,
          category: upload.category,
          icon: <FileText className="h-4 w-4" />
        });
      });
    }

    return sources;
  };

  const documentSources = getDocumentSources();
  const statusInfo = getStatusConfig(application.status);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen && !isSubmitting) {
        onClose();
      }
    }}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center text-white font-bold text-xl">
                {application.firstName[0]}{application.lastName[0]}
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold text-slate-800">
                  {application.firstName} {application.lastName}
                </DialogTitle>
                <p className="text-slate-600 mt-1">{application.position}</p>
              </div>
            </div>
            <Badge className={`${statusInfo.className} flex items-center gap-1 px-4 py-2 font-semibold text-sm rounded-full shadow-sm`}>
              {statusInfo.icon}
              {application.status}
            </Badge>
          </div>
        </DialogHeader>
        
        <div className="space-y-8">
          {/* Personal Information */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-slate-50 rounded-2xl p-6"
          >
            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <User className="h-5 w-5 text-blue-600" />
              Personal Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-slate-400" />
                  <div>
                    <div className="text-sm font-medium text-slate-500">Email</div>
                    <div className="text-slate-800">{application.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-slate-400" />
                  <div>
                    <div className="text-sm font-medium text-slate-500">Phone</div>
                    <div className="text-slate-800">{application.phone || "N/A"}</div>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <MapPin className="h-4 w-4 text-slate-400 mt-1" />
                  <div>
                    <div className="text-sm font-medium text-slate-500">Address</div>
                    <div className="text-slate-800">
                      {application.addressStreet}<br />
                      {application.addressCity}, {application.addressState} {application.addressZip}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-slate-400" />
                  <div>
                    <div className="text-sm font-medium text-slate-500">Applied</div>
                    <div className="text-slate-800">{formatDate(application.createdAt)}</div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Qualifications */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="bg-white rounded-2xl border border-slate-200 p-6"
          >
            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-purple-600" />
              Qualifications
            </h3>
            <div className="space-y-6">
              <div>
                <div className="text-sm font-medium text-slate-500 mb-2 flex items-center gap-2">
                  <GraduationCap className="h-4 w-4" />
                  Education
                </div>
                <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-700 whitespace-pre-line">
                  {application.education || "N/A"}
                </div>
              </div>
              
              <div>
                <div className="text-sm font-medium text-slate-500 mb-2 flex items-center gap-2">
                  <Briefcase className="h-4 w-4" />
                  Work Experience
                </div>
                <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-700 whitespace-pre-line">
                  {application.workExperience || "N/A"}
                </div>
              </div>
              
              <div>
                <div className="text-sm font-medium text-slate-500 mb-2 flex items-center gap-2">
                  <Award className="h-4 w-4" />
                  Skills
                </div>
                <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-700 whitespace-pre-line">
                  {application.skills || "N/A"}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Cover Letter */}
          {application.coverLetter && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              className="bg-white rounded-2xl border border-slate-200 p-6"
            >
              <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-green-600" />
                Cover Letter
              </h3>
              <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-700 whitespace-pre-line max-h-48 overflow-y-auto">
                {application.coverLetter}
              </div>
            </motion.div>
          )}

          {/* Documents */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.3 }}
            className="bg-white rounded-2xl border border-slate-200 p-6"
          >
            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5 text-indigo-600" />
              Documents
            </h3>
            {documentSources.length === 0 ? (
              <div className="text-center py-8">
                <div className="mx-auto w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                  <FileText className="h-6 w-6 text-slate-400" />
                </div>
                <p className="text-slate-500">No documents available</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {documentSources.map((doc, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    className="justify-start h-auto p-5 hover:bg-indigo-50 hover:border-indigo-300 transition-all duration-200 border-slate-200 rounded-xl"
                    onClick={() => doc.url && openDocument(doc.url)}
                    disabled={!doc.url}
                  >
                    <div className="flex items-center gap-3 w-full">
                      <div className="flex-shrink-0 w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600">
                        {doc.icon}
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <div className="font-semibold text-sm text-slate-800 truncate">{doc.label}</div>
                        <div className="text-xs text-slate-500 mt-0.5">Click to view</div>
                      </div>
                      <ExternalLink className="flex-shrink-0 h-4 w-4 text-slate-400" />
                    </div>
                  </Button>
                ))}
              </div>
            )}
          </motion.div>
        </div>
        
        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm flex items-center gap-2"
          >
            <XCircle className="h-4 w-4" />
            {error}
          </motion.div>
        )}
        
        <DialogFooter className="mt-8 flex-col sm:flex-row gap-3 sm:justify-between sm:gap-0 pt-6 border-t border-slate-200">
          {canDeleteApplications && (
            <Button
              variant="destructive"
              onClick={() => onDeleteClick(application)}
              disabled={isSubmitting}
              className="sm:order-1 bg-red-600 hover:bg-red-700 rounded-xl"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Application
            </Button>
          )}
          
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl"
            >
              Close
            </Button>
            
            <Button
              variant="default"
              onClick={() => onStatusChange(application.id, ApplicationStatus.APPROVED)}
              disabled={isSubmitting || application.status === ApplicationStatus.APPROVED}
              className="bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve
                </>
              )}
            </Button>
            
            <Button
              variant="default"
              onClick={() => onStatusChange(application.id, ApplicationStatus.INTERVIEWING)}
              disabled={isSubmitting || application.status === ApplicationStatus.INTERVIEWING}
              className="bg-blue-600 hover:bg-blue-700 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
            >
              <Calendar className="h-4 w-4 mr-2" />
              Interview
            </Button>
            
            <Button
              variant="default"
              onClick={() => onStatusChange(application.id, ApplicationStatus.REJECTED)}
              disabled={isSubmitting || application.status === ApplicationStatus.REJECTED}
              className="bg-red-600 hover:bg-red-700 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Reject
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}; 