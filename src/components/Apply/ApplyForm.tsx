// src/components/Apply/ApplyForm.tsx

"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useForm } from "react-hook-form";
import { ChevronDown, ArrowLeft, ArrowRight } from "lucide-react";
import { useJobApplicationUpload, UploadedFile as HookUploadedFile } from "@/hooks/use-job-application-upload";
import { toast } from "@/components/ui/use-toast";
import { FileUpload } from "./FileUpload";
import { v4 as uuidv4 } from "uuid";
import { motion } from "framer-motion";
import { useSearchParams } from "next/navigation";

// Helper to generate accept string from allowed file types
const generateAcceptString = (types: string[]): string => types.join(",");

// Define allowed file types
const RESUME_TYPES = [".pdf", ".doc", ".docx"];
const IMAGE_PDF_TYPES = [".pdf", ".jpg", ".jpeg", ".png"];

// Form steps structure
type FormStep = {
  id: number;
  name: string;
  shortName?: string; // Add short name for mobile display
  fields: string[];
};

// Define form steps
const FORM_STEPS: FormStep[] = [
  {
    id: 1,
    name: "Position & Personal Info",
    shortName: "Info",
    fields: ["role", "firstName", "lastName", "email", "phone", "address"],
  },
  {
    id: 2, 
    name: "Experience & Skills",
    shortName: "Skills",
    fields: ["education", "workExperience", "skills", "coverLetter"],
  },
  {
    id: 3,
    name: "Documents",
    shortName: "Docs",
    fields: ["resume", "driversLicense", "insurance", "vehicleRegistration", 
             "foodHandler", "hipaa", "driverPhoto", "carPhoto", "equipmentPhoto"],
  },
  {
    id: 4,
    name: "Review & Submit",
    shortName: "Submit",
    fields: [],
  },
];

const positions = [
  {
    title: "Driver for Catering Deliveries",
    description:
      "Join our team and help us deliver exceptional dining experiences to our clients.",
  },
  {
    title: "Virtual Assistant",
    description:
      "Help businesses achieve sustainable growth and success across the US.",
  },
  {
    title: "Other Positions",
    description: "Interested in other opportunities at Ready Set? Let us know!",
  },
];

// Type for the form data managed by react-hook-form
interface FormData {
  role: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
  education?: string;
  workExperience?: string;
  skills: string[]; // Array for multiple skills
  coverLetter?: string;
  // File fields are handled by hooks, but keys can be useful for RHF
  resume?: FileList | null;
  driversLicense?: FileList | null;
  insurance?: FileList | null;
  vehicleRegistration?: FileList | null;
  foodHandler?: FileList | null;
  hipaa?: FileList | null;
  driverPhoto?: FileList | null;
  carPhoto?: FileList | null;
  equipmentPhoto?: FileList | null;
}

// Type for the data structure sent to the API endpoint
interface SubmissionData {
  role: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  education?: string;
  workExperience?: string;
  skills: string[];
  coverLetter?: string;
  // Store the file *paths* (Supabase Storage paths)
  resumeFilePath: string | null;
  driversLicenseFilePath: string | null;
  insuranceFilePath: string | null;
  vehicleRegFilePath: string | null;
  foodHandlerFilePath: string | null;
  hipaaFilePath: string | null;
  driverPhotoFilePath: string | null;
  carPhotoFilePath: string | null;
  equipmentPhotoFilePath: string | null;
  // Keep File IDs if needed for updating FileUpload records later
  resumeFileId: string | null;
  driversLicenseFileId: string | null;
  insuranceFileId: string | null;
  vehicleRegFileId: string | null;
  foodHandlerFileId: string | null;
  hipaaFileId: string | null;
  driverPhotoFileId: string | null;
  carPhotoFileId: string | null;
  equipmentPhotoFileId: string | null;
}

// Type for the expected API response
interface JobApplicationResponse {
  success: boolean;
  id?: string;
  error?: string;
  details?: string;
}

// Component to handle search params extraction
const SearchParamsHandler = ({ 
  onRoleChange 
}: { 
  onRoleChange: (role: string | null) => void 
}) => {
  const searchParams = useSearchParams();
  const roleFromUrl = searchParams?.get('role');
  
  useEffect(() => {
    onRoleChange(roleFromUrl);
  }, [roleFromUrl, onRoleChange]);
  
  return null;
};

const JobApplicationForm = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isSubmitted, setIsSubmitted] = useState(false);
  // Use simple timestamp-based ID instead of UUID format to avoid Prisma's UUID validation
  const tempEntityId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  
  // Add a state to track if user came from signup
  const [fromSignup, setFromSignup] = useState<boolean>(false);
  // State to store the role from URL
  const [roleFromUrl, setRoleFromUrl] = useState<string | null>(null);
  
  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors, isSubmitting: formIsSubmitting, isDirty, isValid },
    trigger,
  } = useForm<FormData>({
    mode: "onChange",  // Enable real-time validation
    defaultValues: {
      role: "",
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      address: {
        street: "",
        city: "",
        state: "",
        zip: "",
      },
      education: "",
      workExperience: "",
      skills: ["", "", ""],
      coverLetter: "",
      // Initialize file fields (even though they are managed by hooks, RHF needs keys)
      resume: null,
      driversLicense: null,
      insurance: null,
      vehicleRegistration: null,
      foodHandler: null,
      hipaa: null,
      driverPhoto: null,
      carPhoto: null,
      equipmentPhoto: null,
    },
  });

  // Handle role changes from URL parameter
  const handleRoleChange = React.useCallback((role: string | null) => {
    if (role) {
      setValue('role', role, { shouldValidate: true });
      setFromSignup(true);
      setRoleFromUrl(role);
      
      // Only validate the role but start at step 1
      const isValidRole = positions.some(p => p.title === role);
      if (isValidRole) {
        // Short delay to ensure field is set before validating
        setTimeout(() => {
          trigger('role');
          // Keep user at step 1, don't advance to step 2
        }, 100);
      }
    }
  }, [setValue, trigger]);

  const selectedRole = watch("role");
  const isDriverRole = selectedRole === "Driver for Catering Deliveries";

  const resumeUpload = useJobApplicationUpload({
    bucketName: "user-assets",
    category: "job-applications/temp/resume",
    entityType: "job_application",
    entityId: tempEntityId,
    allowedFileTypes: RESUME_TYPES,
    maxFileCount: 1,
  });

  const licenseUpload = useJobApplicationUpload({
    bucketName: "user-assets",
    category: "job-applications/temp/license",
    entityType: "job_application",
    entityId: tempEntityId,
    allowedFileTypes: IMAGE_PDF_TYPES,
    maxFileCount: 1,
  });

  const insuranceUpload = useJobApplicationUpload({
    bucketName: "user-assets",
    category: "job-applications/temp/insurance",
    entityType: "job_application",
    entityId: tempEntityId,
    allowedFileTypes: IMAGE_PDF_TYPES,
    maxFileCount: 1,
  });

  const registrationUpload = useJobApplicationUpload({
    bucketName: "user-assets",
    category: "job-applications/temp/registration",
    entityType: "job_application",
    entityId: tempEntityId,
    allowedFileTypes: IMAGE_PDF_TYPES,
    maxFileCount: 1,
  });

  const foodHandlerUpload = useJobApplicationUpload({
    bucketName: "user-assets",
    category: "job-applications/temp/food_handler",
    entityType: "job_application",
    entityId: tempEntityId,
    allowedFileTypes: IMAGE_PDF_TYPES,
    maxFileCount: 1,
  });

  const hipaaUpload = useJobApplicationUpload({
    bucketName: "user-assets",
    category: "job-applications/temp/hipaa",
    entityType: "job_application",
    entityId: tempEntityId,
    allowedFileTypes: IMAGE_PDF_TYPES,
    maxFileCount: 1,
  });

  const driverPhotoUpload = useJobApplicationUpload({
    bucketName: "user-assets",
    category: "job-applications/temp/driver_photo",
    entityType: "job_application",
    entityId: tempEntityId,
    allowedFileTypes: [".jpg", ".jpeg", ".png"],
    maxFileCount: 1,
  });

  const carPhotoUpload = useJobApplicationUpload({
    bucketName: "user-assets",
    category: "job-applications/temp/car_photo",
    entityType: "job_application",
    entityId: tempEntityId,
    allowedFileTypes: [".jpg", ".jpeg", ".png"],
    maxFileCount: 1,
  });

  const equipmentPhotoUpload = useJobApplicationUpload({
    bucketName: "user-assets",
    category: "job-applications/temp/equipment_photo",
    entityType: "job_application",
    entityId: tempEntityId,
    allowedFileTypes: [".jpg", ".jpeg", ".png"],
    maxFileCount: 1,
  });

  // Watch for role changes to trigger validation
  React.useEffect(() => {
    if (isDirty) {
      trigger();  // Re-validate form when role changes
    }
  }, [selectedRole, isDirty, trigger]);

  // Handle step navigation
  const goToNextStep = async (event?: React.MouseEvent) => {
    // Prevent any default form submission
    if (event) {
      event.preventDefault();
    }
    
    // *** Keep file validation specifically before moving from Step 3 ***
    if (currentStep === 3) {
      const role = watch("role"); // Get the selected role
      const fileValidationErrors = validateFiles(role);
      if (fileValidationErrors.length > 0) {
        // If file validation fails, show errors and stop navigation
        fileValidationErrors.forEach(error => {
          toast({
            title: "Missing Documents",
            description: error,
            variant: "destructive",
          });
        });
        return; // Stop navigation
      }
    }
    
    // If step-specific validation passes (only file check for step 3), proceed
    setCurrentStep(prev => Math.min(prev + 1, FORM_STEPS.length));
    // Remove scroll to top behavior
  };

  const goToPrevStep = (event?: React.MouseEvent) => {
    // Prevent any default form submission
    if (event) {
      event.preventDefault();
    }
    
    setCurrentStep(prev => Math.max(prev - 1, 1));
    // Remove scroll to top behavior
  };

  const renderError = (
    error: { message?: string } | undefined,
  ): React.ReactNode => {
    if (error) {
      return <p className="mt-1 text-sm text-red-600">{error.message}</p>;
    }
    return null;
  };

  const onSubmit = async (formData: FormData) => {
    console.log("Form submission started", { formData });
    
    // Validate required files based on role
    const fileValidationErrors = validateFiles(formData.role);
    if (fileValidationErrors.length > 0) {
      fileValidationErrors.forEach(error => {
        toast({
          title: "Error",
          description: error,
          variant: "destructive",
        });
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { address, role, ...otherData } = formData;

      // Filter out empty skills
      const filteredSkills = otherData.skills.filter(skill => skill.trim() !== "");

      const submissionData: SubmissionData = {
        ...otherData,
        skills: filteredSkills,
        role,
        address: {
          street: address?.street || "",
          city: address?.city || "",
          state: address?.state || "",
          zip: address?.zip || ""
        },
        // Log the first file of each category to help debug
        resumeFilePath: resumeUpload.uploadedFiles[0] ? resumeUpload.uploadedFiles[0].path : null,
        driversLicenseFilePath: licenseUpload.uploadedFiles[0] ? licenseUpload.uploadedFiles[0].path : null,
        insuranceFilePath: insuranceUpload.uploadedFiles[0] ? insuranceUpload.uploadedFiles[0].path : null,
        vehicleRegFilePath: registrationUpload.uploadedFiles[0] ? registrationUpload.uploadedFiles[0].path : null,
        foodHandlerFilePath: foodHandlerUpload.uploadedFiles[0] ? foodHandlerUpload.uploadedFiles[0].path : null,
        hipaaFilePath: hipaaUpload.uploadedFiles[0] ? hipaaUpload.uploadedFiles[0].path : null,
        driverPhotoFilePath: driverPhotoUpload.uploadedFiles[0] ? driverPhotoUpload.uploadedFiles[0].path : null,
        carPhotoFilePath: carPhotoUpload.uploadedFiles[0] ? carPhotoUpload.uploadedFiles[0].path : null,
        equipmentPhotoFilePath: equipmentPhotoUpload.uploadedFiles[0] ? equipmentPhotoUpload.uploadedFiles[0].path : null,
        resumeFileId: resumeUpload.uploadedFiles[0] ? resumeUpload.uploadedFiles[0].key : null,
        driversLicenseFileId: licenseUpload.uploadedFiles[0] ? licenseUpload.uploadedFiles[0].key : null,
        insuranceFileId: insuranceUpload.uploadedFiles[0] ? insuranceUpload.uploadedFiles[0].key : null,
        vehicleRegFileId: registrationUpload.uploadedFiles[0] ? registrationUpload.uploadedFiles[0].key : null,
        foodHandlerFileId: foodHandlerUpload.uploadedFiles[0] ? foodHandlerUpload.uploadedFiles[0].key : null,
        hipaaFileId: hipaaUpload.uploadedFiles[0] ? hipaaUpload.uploadedFiles[0].key : null,
        driverPhotoFileId: driverPhotoUpload.uploadedFiles[0] ? driverPhotoUpload.uploadedFiles[0].key : null,
        carPhotoFileId: carPhotoUpload.uploadedFiles[0] ? carPhotoUpload.uploadedFiles[0].key : null,
        equipmentPhotoFileId: equipmentPhotoUpload.uploadedFiles[0] ? equipmentPhotoUpload.uploadedFiles[0].key : null,
      };
      
      // Print out the uploaded files from each hook for debugging
      console.log("Resume Files:", resumeUpload.uploadedFiles);
      console.log("License Files:", licenseUpload.uploadedFiles);
      console.log("Insurance Files:", insuranceUpload.uploadedFiles);
      console.log("Registration Files:", registrationUpload.uploadedFiles);
      console.log("Driver Photo Files:", driverPhotoUpload.uploadedFiles);
      console.log("Car Photo Files:", carPhotoUpload.uploadedFiles);

      console.log("Submitting application data:", submissionData);

      const response = await fetch("/api/job-applications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(submissionData),
      });

      if (!response.ok) {
        const responseData = await response.json();
        throw new Error(responseData.error || `Failed to submit application: ${response.statusText}`);
      }

      const responseData = await response.json();
      console.log("API response:", responseData);

      toast({
        title: "Application Received",
        description: "Your application has been submitted successfully! We will contact you soon.",
        variant: "default",
      });

      // Set application as submitted instead of just resetting
      setIsSubmitted(true);

    } catch (error) {
      console.error("Submission error:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit application. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper function to validate required files
  const validateFiles = (role: string): string[] => {
    const errors: string[] = [];

    // Only require resume if NOT a driver role
    if (role !== "Driver for Catering Deliveries" && resumeUpload.uploadedFiles.length === 0) {
      errors.push("Please upload your resume");
    }

    // Driver-specific file requirements
    if (role === "Driver for Catering Deliveries") {
      if (licenseUpload.uploadedFiles.length === 0) {
        errors.push("Please upload your driver's license");
      }
      if (insuranceUpload.uploadedFiles.length === 0) {
        errors.push("Please upload your insurance");
      }
      if (registrationUpload.uploadedFiles.length === 0) {
        errors.push("Please upload your vehicle registration");
      }
      if (driverPhotoUpload.uploadedFiles.length === 0) {
        errors.push("Please upload your driver photo");
      }
      if (carPhotoUpload.uploadedFiles.length === 0) {
        errors.push("Please upload your car photo");
      }
    }

    return errors;
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <div className="overflow-hidden rounded-lg bg-white shadow-lg">
          {/* Wrap the SearchParamsHandler in a Suspense boundary */}
          <Suspense fallback={null}>
            <SearchParamsHandler onRoleChange={handleRoleChange} />
          </Suspense>

          <div className="bg-gradient-to-r from-yellow-400 to-amber-400 p-8">
            <h1 className="text-2xl font-bold text-white">
              Ready Set Career Application
            </h1>
            <p className="mt-2 text-white opacity-90">
              Join our growing team and make an impact
            </p>
          </div>

          {/* Add notification for users coming from signup */}
          {fromSignup && !isSubmitted && (
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 m-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.19-1.458-1.516-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-yellow-700">
                    <span className="font-medium">Application Process: </span> 
                    You've selected to apply as a {roleFromUrl === "Driver for Catering Deliveries" ? "Driver" : "Helpdesk Agent"}. 
                    Please complete this application form to be considered for the position.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Form steps UI */}
          <div className="relative mb-8">
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={goToPrevStep}
                className={`flex items-center text-gray-500 hover:text-gray-700 
                  ${currentStep === 1 ? "invisible" : ""}`}
                disabled={currentStep === 1}
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                <span className="text-sm">Back</span>
              </button>

              <div className="flex space-x-1">
                {FORM_STEPS.map((step) => (
                  <button
                    key={step.id}
                    className={`rounded-full h-2.5 w-2.5 ${
                      step.id === currentStep
                        ? "bg-yellow-500"
                        : step.id < currentStep
                        ? "bg-yellow-300"
                        : "bg-gray-300"
                    }`}
                    aria-label={`Go to step ${step.id}`}
                    onClick={() => {
                      // Only allow clicking on completed steps or the next available step
                      if (step.id <= currentStep) {
                        setCurrentStep(step.id);
                      }
                    }}
                  />
                ))}
              </div>

              <button
                onClick={goToNextStep}
                className={`flex items-center text-gray-500 hover:text-gray-700 ${
                  currentStep === 4 ? "invisible" : ""
                }`}
              >
                <span className="text-sm">Next</span>
                <ArrowRight className="h-4 w-4 ml-1" />
              </button>
            </div>

            <div className="w-full bg-gray-100 h-[4px] rounded-full max-w-3xl mx-auto px-6">
              <div 
                className="bg-yellow-400 h-full rounded-full transition-all duration-300 shadow-sm"
                style={{ width: `${((currentStep - 1) / (FORM_STEPS.length - 1)) * 100}%` }}
              />
            </div>
          </div>

          <h2 className="text-xl font-medium text-gray-800 mb-4 px-6 pt-6">
            {FORM_STEPS.find(step => step.id === currentStep)?.name}
          </h2>

          <form 
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-6 px-6 pb-6"
            noValidate
          >
            {/* Step 1: Position & Personal Info */}
            {currentStep === 1 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="space-y-4">
                  <label className="block text-sm font-medium text-gray-700">
                    Select Position *
                  </label>
                  <div className="relative">
                    <select
                      className={`block w-full rounded-md border ${
                        errors.role ? "border-red-500" : "border-gray-300"
                      } appearance-none bg-white px-3 py-2.5 focus:border-yellow-400 focus:outline-none focus:ring-1 focus:ring-yellow-400 text-gray-700`}
                      {...register("role", {
                        required: "Please select a position",
                      })}
                    >
                      <option value="">Choose a position</option>
                      {positions.map((pos, idx) => (
                        <option key={idx} value={pos.title}>
                          {pos.title}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-3 h-5 w-5 text-gray-400" />
                  </div>
                  {renderError(errors.role)}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      First Name *
                    </label>
                    <input
                      type="text"
                      className={`block w-full rounded-md border ${
                        errors.firstName ? "border-red-500" : "border-gray-200"
                      } px-4 py-2.5 focus:border-yellow-400 focus:outline-none focus:ring-1 focus:ring-yellow-400 text-gray-700`}
                      {...register("firstName", {
                        required: "First name is required",
                        minLength: {
                          value: 2,
                          message: "First name must be at least 2 characters",
                        },
                      })}
                    />
                    {renderError(errors.firstName)}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Last Name *
                    </label>
                    <input
                      type="text"
                      className={`block w-full rounded-md border ${
                        errors.lastName ? "border-red-500" : "border-gray-200"
                      } px-4 py-2.5 focus:border-yellow-400 focus:outline-none focus:ring-1 focus:ring-yellow-400 text-gray-700`}
                      {...register("lastName", {
                        required: "Last name is required",
                        minLength: {
                          value: 2,
                          message: "Last name must be at least 2 characters",
                        },
                      })}
                    />
                    {renderError(errors.lastName)}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email *
                    </label>
                    <input
                      type="email"
                      className={`block w-full rounded-md border ${
                        errors.email ? "border-red-500" : "border-gray-200"
                      } px-4 py-2.5 focus:border-yellow-400 focus:outline-none focus:ring-1 focus:ring-yellow-400 text-gray-700`}
                      {...register("email", {
                        required: "Email is required",
                        pattern: {
                          value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                          message: "Invalid email address",
                        },
                      })}
                    />
                    {renderError(errors.email)}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone
                      <span className="text-red-500 ml-1">*</span>
                    </label>
                    <input
                      type="tel"
                      className={`block w-full rounded-md border ${
                        errors.phone ? "border-red-500" : "border-gray-200"
                      } px-4 py-2.5 focus:border-yellow-400 focus:outline-none focus:ring-1 focus:ring-yellow-400 text-gray-700`}
                      {...register("phone", {
                        required: "Phone number is required",
                        pattern: {
                          value: /^[\d\s-+()]*$/,
                          message: "Invalid phone number format",
                        },
                      })}
                    />
                    {renderError(errors.phone)}
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Address *
                  </label>
                  <input
                    type="text"
                    placeholder="Street Address"
                    className={`block w-full rounded-md border ${
                      errors.address?.street
                        ? "border-red-500"
                        : "border-gray-200"
                    } px-4 py-2.5 focus:border-yellow-400 focus:outline-none focus:ring-1 focus:ring-yellow-400 text-gray-700`}
                    {...register("address.street", {
                      required: "Street address is required",
                    })}
                  />
                  {renderError(errors.address?.street)}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <input
                        type="text"
                        placeholder="City"
                        className={`block w-full rounded-md border ${
                          errors.address?.city
                            ? "border-red-500"
                            : "border-gray-200"
                        } px-4 py-2.5 focus:border-yellow-400 focus:outline-none focus:ring-1 focus:ring-yellow-400 text-gray-700`}
                        {...register("address.city", {
                          required: "City is required",
                        })}
                      />
                      {renderError(errors.address?.city)}
                    </div>
                    <div>
                      <input
                        type="text"
                        placeholder="State"
                        className={`block w-full rounded-md border ${
                          errors.address?.state
                            ? "border-red-500"
                            : "border-gray-200"
                        } px-4 py-2.5 focus:border-yellow-400 focus:outline-none focus:ring-1 focus:ring-yellow-400 text-gray-700`}
                        {...register("address.state", {
                          required: "State is required",
                        })}
                      />
                      {renderError(errors.address?.state)}
                    </div>
                  </div>

                  <input
                    type="text"
                    placeholder="ZIP Code"
                    className={`block w-full rounded-md border ${
                      errors.address?.zip ? "border-red-500" : "border-gray-200"
                    } px-4 py-2.5 focus:border-yellow-400 focus:outline-none focus:ring-1 focus:ring-yellow-400 text-gray-700`}
                    {...register("address.zip", {
                      required: "ZIP code is required",
                      pattern: {
                        value: /^\d{5}(-\d{4})?$/,
                        message: "Invalid ZIP code format",
                      },
                    })}
                  />
                  {renderError(errors.address?.zip)}
                </div>
              </motion.div>
            )}

            {/* Step 2: Experience & Skills - Only for non-driver roles */}
            {currentStep === 2 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                {!isDriverRole ? (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Education *
                      </label>
                      <textarea
                        className={`mt-1 block w-full rounded-md border ${
                          errors.education ? "border-red-500" : "border-gray-300"
                        } px-3 py-2 focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400`}
                        rows={3}
                        placeholder="List your educational background..."
                        {...register("education", {
                          required: "Education information is required",
                          minLength: {
                            value: 10,
                            message:
                              "Please provide more detail about your education",
                          },
                        })}
                      />
                      {renderError(errors.education)}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Work Experience *
                      </label>
                      <textarea
                        className={`mt-1 block w-full rounded-md border ${
                          errors.workExperience ? "border-red-500" : "border-gray-300"
                        } px-3 py-2 focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400`}
                        rows={4}
                        placeholder="Describe your relevant work experience..."
                        {...register("workExperience", {
                          required: "Work experience is required",
                          minLength: {
                            value: 20,
                            message:
                              "Please provide more detail about your work experience",
                          },
                        })}
                      />
                      {renderError(errors.workExperience)}
                    </div>

                    <div className="space-y-4">
                      <label className="block text-sm font-medium text-gray-700">
                        Main Skills *
                      </label>
                      {[0, 1, 2].map((index) => (
                        <div key={index}>
                          <input
                            type="text"
                            className={`block w-full rounded-md border ${
                              errors.skills?.[index]
                                ? "border-red-500"
                                : "border-gray-300"
                            } px-3 py-2 focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400`}
                            placeholder={`Skill ${index + 1} (e.g., ${
                              index === 0
                                ? "Customer Service"
                                : index === 1
                                  ? "Time Management"
                                  : "Problem Solving"
                            })`}
                            {...register(`skills.${index}`, {
                              required: "This skill is required",
                              minLength: {
                                value: 2,
                                message: "Skill must be at least 2 characters",
                              },
                            })}
                          />
                          {errors.skills?.[index] && (
                            <p className="mt-1 text-sm text-red-600">
                              {errors.skills[index].message}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Cover Letter
                      </label>
                      <textarea
                        className={`mt-1 block w-full rounded-md border ${
                          errors.coverLetter ? "border-red-500" : "border-gray-300"
                        } px-3 py-2 focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400`}
                        rows={4}
                        placeholder="Tell us why you're interested in this position..."
                        {...register("coverLetter")}
                      />
                      {renderError(errors.coverLetter)}
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8">
                    <div className="text-center">
                      <h3 className="text-lg font-medium text-gray-700 mb-2">
                        Driver Application
                      </h3>
                      <p className="text-gray-500">
                        For driver positions, please continue to the next section
                        to upload your required documents.
                      </p>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* Step 3: Documents */}
            {currentStep === 3 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                {isDriverRole ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-8">
                    {/* Driver's License Upload */}
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        Driver's License
                        <span className="text-red-500 ml-1">*</span>
                      </label>
                      <FileUpload
                        name="driversLicense"
                        label="Upload Driver's License"
                        startUpload={licenseUpload.onUpload as any}
                        file={licenseUpload.uploadedFiles[0] as HookUploadedFile || null}
                        deleteFile={licenseUpload.deleteFile}
                        accept={generateAcceptString(IMAGE_PDF_TYPES)}
                        isUploading={licenseUpload.isUploading}
                        progresses={licenseUpload.progresses}
                      />
                    </div>

                    {/* Insurance Upload */}
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        Proof of Insurance
                        <span className="text-red-500 ml-1">*</span>
                      </label>
                      <FileUpload
                        name="insurance"
                        label="Upload Insurance"
                        startUpload={insuranceUpload.onUpload as any}
                        file={insuranceUpload.uploadedFiles[0] as HookUploadedFile || null}
                        deleteFile={insuranceUpload.deleteFile}
                        accept={generateAcceptString(IMAGE_PDF_TYPES)}
                        isUploading={insuranceUpload.isUploading}
                        progresses={insuranceUpload.progresses}
                      />
                    </div>

                    {/* Vehicle Registration Upload */}
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        Vehicle Registration
                        <span className="text-red-500 ml-1">*</span>
                      </label>
                      <FileUpload
                        name="vehicleRegistration"
                        label="Upload Registration"
                        startUpload={registrationUpload.onUpload as any}
                        file={registrationUpload.uploadedFiles[0] as HookUploadedFile || null}
                        deleteFile={registrationUpload.deleteFile}
                        accept={generateAcceptString(IMAGE_PDF_TYPES)}
                        isUploading={registrationUpload.isUploading}
                        progresses={registrationUpload.progresses}
                      />
                    </div>

                    {/* Food Handler's Card Upload */}
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        Food Handler's Card
                      </label>
                      <FileUpload
                        name="foodHandler"
                        label="Upload Card (Optional)"
                        startUpload={foodHandlerUpload.onUpload as any}
                        file={foodHandlerUpload.uploadedFiles[0] as HookUploadedFile || null}
                        deleteFile={foodHandlerUpload.deleteFile}
                        accept={generateAcceptString(IMAGE_PDF_TYPES)}
                        isUploading={foodHandlerUpload.isUploading}
                        progresses={foodHandlerUpload.progresses}
                      />
                    </div>
                    
                    {/* Driver Photo Upload */}
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        Driver Photo
                        <span className="text-red-500 ml-1">*</span>
                      </label>
                      <FileUpload
                        name="driverPhoto"
                        label="Upload Photo"
                        startUpload={driverPhotoUpload.onUpload as any}
                        file={driverPhotoUpload.uploadedFiles[0] as HookUploadedFile || null}
                        deleteFile={driverPhotoUpload.deleteFile}
                        accept={generateAcceptString([".jpg", ".jpeg", ".png"])}
                        isUploading={driverPhotoUpload.isUploading}
                        progresses={driverPhotoUpload.progresses}
                      />
                    </div>

                    {/* Car Photo Upload */}
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        Car Photo
                        <span className="text-red-500 ml-1">*</span>
                      </label>
                      <FileUpload
                        name="carPhoto"
                        label="Upload Photo"
                        startUpload={carPhotoUpload.onUpload as any}
                        file={carPhotoUpload.uploadedFiles[0] as HookUploadedFile || null}
                        deleteFile={carPhotoUpload.deleteFile}
                        accept={generateAcceptString([".jpg", ".jpeg", ".png"])}
                        isUploading={carPhotoUpload.isUploading}
                        progresses={carPhotoUpload.progresses}
                      />
                    </div>

                    {/* Equipment Photo Upload */}
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        Equipment Photo
                      </label>
                      <FileUpload
                        name="equipmentPhoto"
                        label="Upload Photo (Optional)"
                        startUpload={equipmentPhotoUpload.onUpload as any}
                        file={equipmentPhotoUpload.uploadedFiles[0] as HookUploadedFile || null}
                        deleteFile={equipmentPhotoUpload.deleteFile}
                        accept={generateAcceptString([".jpg", ".jpeg", ".png"])}
                        isUploading={equipmentPhotoUpload.isUploading}
                        progresses={equipmentPhotoUpload.progresses}
                      />
                    </div>

                    {/* HIPAA Certification Upload */}
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        HIPAA Certification
                      </label>
                      <FileUpload
                        name="hipaa"
                        label="Upload Certificate (Optional)"
                        startUpload={hipaaUpload.onUpload as any}
                        file={hipaaUpload.uploadedFiles[0] as HookUploadedFile || null}
                        deleteFile={hipaaUpload.deleteFile}
                        accept={generateAcceptString(IMAGE_PDF_TYPES)}
                        isUploading={hipaaUpload.isUploading}
                        progresses={hipaaUpload.progresses}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Resume Upload - for non-driver roles */}
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        Resume
                        <span className="text-red-500 ml-1">*</span>
                      </label>
                      <FileUpload
                        name="resume"
                        label="Upload Resume (.pdf, .doc, .docx)"
                        startUpload={resumeUpload.onUpload as any}
                        file={resumeUpload.uploadedFiles[0] as HookUploadedFile || null}
                        deleteFile={resumeUpload.deleteFile}
                        accept={generateAcceptString(RESUME_TYPES)}
                        isUploading={resumeUpload.isUploading}
                        progresses={resumeUpload.progresses}
                      />
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* Step 4: Review & Submit */}
            {currentStep === 4 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 mb-6">
                  <h3 className="text-lg font-medium text-yellow-800 mb-2">Application Review</h3>
                  <p className="text-yellow-700">
                    Please review your application details below before submitting. Once submitted, your application will be reviewed by our team and we will contact you soon regarding next steps.
                  </p>
                </div>

                <div className="space-y-4 divide-y divide-gray-200">
                  <div className="pt-2">
                    <h4 className="font-medium text-gray-700">Position</h4>
                    <p className="mt-1">{watch("role") || "Not selected"}</p>
                  </div>

                  <div className="pt-2">
                    <h4 className="font-medium text-gray-700">Personal Information</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-1">
                      <p>Name: {watch("firstName")} {watch("lastName")}</p>
                      <p>Email: {watch("email")}</p>
                      <p>Phone: {watch("phone") || "Not provided"}</p>
                      <p>Address: {watch("address.street")}, {watch("address.city")}, {watch("address.state")} {watch("address.zip")}</p>
                    </div>
                  </div>

                  {!isDriverRole && (
                    <>
                      <div className="pt-2">
                        <h4 className="font-medium text-gray-700">Education & Experience</h4>
                        <p className="mt-1 text-sm">{watch("education")}</p>
                        <h4 className="font-medium text-gray-700 mt-2">Work Experience</h4>
                        <p className="mt-1 text-sm">{watch("workExperience")}</p>
                      </div>

                      <div className="pt-2">
                        <h4 className="font-medium text-gray-700">Skills</h4>
                        <ul className="mt-1 list-disc list-inside">
                          {watch("skills").filter(Boolean).map((skill, index) => (
                            <li key={index} className="text-sm">{skill}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="pt-2">
                        <h4 className="font-medium text-gray-700">Documents</h4>
                        <p className="mt-1">Resume: {resumeUpload.uploadedFiles.length > 0 ? "Uploaded" : "Not uploaded"}</p>
                      </div>
                    </>
                  )}

                  {isDriverRole && (
                    <div className="pt-2">
                      <h4 className="font-medium text-gray-700">Required Documents</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-1">
                        <p>Driver's License: {licenseUpload.uploadedFiles.length > 0 ? "Uploaded" : "Not uploaded"}</p>
                        <p>Insurance: {insuranceUpload.uploadedFiles.length > 0 ? "Uploaded" : "Not uploaded"}</p>
                        <p>Vehicle Registration: {registrationUpload.uploadedFiles.length > 0 ? "Uploaded" : "Not uploaded"}</p>
                        <p>Food Handler's Card: {foodHandlerUpload.uploadedFiles.length > 0 ? "Uploaded" : "Not provided"}</p>
                        <p>Driver Photo: {driverPhotoUpload.uploadedFiles.length > 0 ? "Uploaded" : "Not uploaded"}</p>
                        <p>Car Photo: {carPhotoUpload.uploadedFiles.length > 0 ? "Uploaded" : "Not uploaded"}</p>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between pt-6 border-t border-gray-200">
              {currentStep > 1 ? (
                <button
                  type="button"
                  onClick={(e) => goToPrevStep(e)}
                  className="flex items-center px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-yellow-400"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Previous
                </button>
              ) : (
                <div></div> // Empty div to maintain flex spacing
              )}

              {currentStep < FORM_STEPS.length ? (
                <button
                  type="button"
                  onClick={(e) => goToNextStep(e)}
                  className="flex items-center px-5 py-2.5 text-sm font-medium text-white bg-yellow-400 border border-transparent rounded-md hover:bg-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-400"
                >
                  Next
                  <ArrowRight className="w-4 h-4 ml-2" />
                </button>
              ) : (
                <button
                  type="button" 
                  onClick={handleSubmit(onSubmit)}
                  disabled={isSubmitting}
                  className="px-5 py-2.5 text-sm font-medium text-white bg-yellow-400 border border-transparent rounded-md hover:bg-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-400 disabled:opacity-50"
                >
                  {isSubmitting ? "Submitting..." : "Submit Application"}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default JobApplicationForm;
