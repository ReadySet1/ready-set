/**
 * Single source of truth for job-application document uploads: the upload
 * category the form sends, the submit payload field carrying the FileUpload id,
 * the JobApplication column that stores the moved file path, the admin label,
 * and whether a driver applicant must provide it.
 */

const TEMP_CATEGORY_PREFIX = "job-applications/temp/";

export type JobApplicationFilePathColumn =
  | "resumeFilePath"
  | "driversLicenseFilePath"
  | "insuranceFilePath"
  | "vehicleRegFilePath"
  | "foodHandlerFilePath"
  | "hipaaFilePath"
  | "driverPhotoFilePath"
  | "carPhotoFilePath"
  | "equipmentPhotoFilePath"
  | "secondIdFilePath"
  | "cateringBagsPhotoFilePath"
  | "cartDollyPhotoFilePath";

export interface ApplicationDocument {
  /** Category base, e.g. "license" for "job-applications/temp/license". */
  key: string;
  /** Category the apply form sends with the upload. */
  category: string;
  /** Submit payload field carrying the FileUpload id. */
  fileIdField: string;
  /** JobApplication column (and payload path field) for the moved file. */
  filePathColumn: JobApplicationFilePathColumn;
  label: string;
}

export interface DriverDocument extends ApplicationDocument {
  required: boolean;
  accept: readonly string[];
}

const IMAGE_TYPES = [".jpg", ".jpeg", ".png"] as const;
const IMAGE_PDF_TYPES = [".pdf", ".jpg", ".jpeg", ".png"] as const;

function defineDocument(
  key: string,
  fileIdField: string,
  filePathColumn: JobApplicationFilePathColumn,
  label: string,
): ApplicationDocument {
  return { key, category: `${TEMP_CATEGORY_PREFIX}${key}`, fileIdField, filePathColumn, label };
}

export const RESUME_DOCUMENT: ApplicationDocument = defineDocument(
  "resume",
  "resumeFileId",
  "resumeFilePath",
  "Resume",
);

/** Documents a new driver applicant can upload. */
export const DRIVER_DOCUMENTS: readonly DriverDocument[] = [
  {
    ...defineDocument("license", "driversLicenseFileId", "driversLicenseFilePath", "Driver's License"),
    required: true,
    accept: IMAGE_PDF_TYPES,
  },
  {
    ...defineDocument("insurance", "insuranceFileId", "insuranceFilePath", "Insurance"),
    required: true,
    accept: IMAGE_PDF_TYPES,
  },
  {
    ...defineDocument("registration", "vehicleRegFileId", "vehicleRegFilePath", "Vehicle Registration"),
    required: false,
    accept: IMAGE_PDF_TYPES,
  },
  {
    ...defineDocument("second_id", "secondIdFileId", "secondIdFilePath", "Second Form of ID"),
    required: false,
    accept: IMAGE_PDF_TYPES,
  },
  {
    ...defineDocument("food_handler", "foodHandlerFileId", "foodHandlerFilePath", "Food Handler Certificate"),
    required: false,
    accept: IMAGE_PDF_TYPES,
  },
  {
    ...defineDocument("hipaa", "hipaaFileId", "hipaaFilePath", "HIPAA Certificate"),
    required: false,
    accept: IMAGE_PDF_TYPES,
  },
  {
    ...defineDocument("car_photo", "carPhotoFileId", "carPhotoFilePath", "Vehicle Photo"),
    required: true,
    accept: IMAGE_TYPES,
  },
  {
    ...defineDocument("catering_bags", "cateringBagsPhotoFileId", "cateringBagsPhotoFilePath", "Catering Bags Photo"),
    required: true,
    accept: IMAGE_TYPES,
  },
  {
    ...defineDocument("cart_dolly", "cartDollyPhotoFileId", "cartDollyPhotoFilePath", "Cart/Dolly Photo"),
    required: true,
    accept: IMAGE_TYPES,
  },
];

/**
 * No longer offered to new applicants. Kept so existing applications keep
 * their labels and so older clients still get their uploads mapped.
 */
export const LEGACY_DRIVER_DOCUMENTS: readonly ApplicationDocument[] = [
  defineDocument("driver_photo", "driverPhotoFileId", "driverPhotoFilePath", "Driver Photo"),
  defineDocument("equipment_photo", "equipmentPhotoFileId", "equipmentPhotoFilePath", "Equipment Photo"),
];

const ALL_DOCUMENTS: readonly ApplicationDocument[] = [
  RESUME_DOCUMENT,
  ...DRIVER_DOCUMENTS,
  ...LEGACY_DRIVER_DOCUMENTS,
];

/** Every payload field that may carry a FileUpload id for a submission. */
export const APPLICATION_FILE_ID_FIELDS: readonly string[] = ALL_DOCUMENTS.map(
  (doc) => doc.fileIdField,
);

export function requiredDriverDocuments(): DriverDocument[] {
  return DRIVER_DOCUMENTS.filter((doc) => doc.required);
}

/** Strips only the exact "job-applications/temp/" prefix. */
export function categoryBase(category: string): string {
  return category.startsWith(TEMP_CATEGORY_PREFIX)
    ? category.slice(TEMP_CATEGORY_PREFIX.length)
    : category;
}

/** Matches only "<key>" or "job-applications/temp/<key>". */
export function findDocumentByCategory(category: string): ApplicationDocument | undefined {
  const key = categoryBase(category);
  return ALL_DOCUMENTS.find((doc) => doc.key === key);
}

/**
 * Admin-facing label. Like the previous dialog logic, any "/<key>" suffix is
 * recognised; unknown categories fall back to a capitalised, de-underscored form.
 */
export function getDocumentLabel(category: string): string {
  const lastSegment = category.slice(category.lastIndexOf("/") + 1);
  const doc = ALL_DOCUMENTS.find((d) => d.key === lastSegment);
  if (doc) return doc.label;
  return category.charAt(0).toUpperCase() + category.slice(1).replace(/_/g, " ");
}
