import {
  DRIVER_DOCUMENTS,
  LEGACY_DRIVER_DOCUMENTS,
  RESUME_DOCUMENT,
  categoryBase,
  findDocumentByCategory,
  getDocumentLabel,
  missingRequiredDriverDocuments,
  requiredDriverDocuments,
  type DriverDocumentKey,
} from "@/lib/job-application-documents";

describe("job application document config", () => {
  it("requires exactly license, insurance, second ID, vehicle photo, catering bags and cart/dolly for drivers", () => {
    const required = requiredDriverDocuments().map((doc) => doc.key).sort();

    expect(required).toEqual(
      ["cart_dolly", "car_photo", "catering_bags", "insurance", "license", "second_id"].sort(),
    );
  });

  it("keeps registration, food handler and HIPAA optional", () => {
    const optional = DRIVER_DOCUMENTS.filter((doc) => !doc.required)
      .map((doc) => doc.key)
      .sort();

    expect(optional).toEqual(["food_handler", "hipaa", "registration"]);
  });

  it("no longer offers driver photo or equipment photo for new applications", () => {
    const keys = DRIVER_DOCUMENTS.map((doc) => doc.key);

    expect(keys).not.toContain("driver_photo");
    expect(keys).not.toContain("equipment_photo");
    expect(LEGACY_DRIVER_DOCUMENTS.map((doc) => doc.key).sort()).toEqual([
      "driver_photo",
      "equipment_photo",
    ]);
  });

  it("keeps DriverDocumentKey in sync with the non-legacy driver documents", () => {
    // The apply form keys its upload hooks by DriverDocumentKey, so every
    // non-legacy document needs a key. The Record makes the compiler reject a
    // missing or unknown key here; the assertion catches config drift.
    const formDocumentKeys: Record<DriverDocumentKey, true> = {
      license: true,
      insurance: true,
      registration: true,
      second_id: true,
      food_handler: true,
      hipaa: true,
      car_photo: true,
      catering_bags: true,
      cart_dolly: true,
    };
    const legacyKeys = new Set(LEGACY_DRIVER_DOCUMENTS.map((doc) => doc.key));
    const configKeys = DRIVER_DOCUMENTS.map((doc) => doc.key)
      .filter((key) => !legacyKeys.has(key))
      .sort();

    expect(configKeys).toEqual(Object.keys(formDocumentKeys).sort());
  });

  it("uses the upload category the form sends for each document", () => {
    // Categories ApplyForm.tsx sends, plus the legacy ones older clients sent.
    const expected = [
      "job-applications/temp/resume",
      "job-applications/temp/license",
      "job-applications/temp/insurance",
      "job-applications/temp/registration",
      "job-applications/temp/food_handler",
      "job-applications/temp/hipaa",
      "job-applications/temp/driver_photo",
      "job-applications/temp/car_photo",
      "job-applications/temp/equipment_photo",
      "job-applications/temp/second_id",
      "job-applications/temp/catering_bags",
      "job-applications/temp/cart_dolly",
    ];
    const categories = [RESUME_DOCUMENT, ...DRIVER_DOCUMENTS, ...LEGACY_DRIVER_DOCUMENTS].map(
      (doc) => doc.category,
    );

    expect(categories.sort()).toEqual(expected.sort());
  });

  it("strips the temp prefix from a category", () => {
    expect(categoryBase("job-applications/temp/catering_bags")).toBe("catering_bags");
    expect(categoryBase("license")).toBe("license");
  });

  it.each([
    ["job-applications/temp/second_id", "secondIdFilePath", "secondIdFileId"],
    ["job-applications/temp/catering_bags", "cateringBagsPhotoFilePath", "cateringBagsPhotoFileId"],
    ["job-applications/temp/cart_dolly", "cartDollyPhotoFilePath", "cartDollyPhotoFileId"],
    ["job-applications/temp/registration", "vehicleRegFilePath", "vehicleRegFileId"],
    ["registration", "vehicleRegFilePath", "vehicleRegFileId"],
    ["job-applications/temp/driver_photo", "driverPhotoFilePath", "driverPhotoFileId"],
    ["equipment_photo", "equipmentPhotoFilePath", "equipmentPhotoFileId"],
    ["job-applications/temp/resume", "resumeFilePath", "resumeFileId"],
  ])("maps category %s to column %s and payload field %s", (category, column, fileIdField) => {
    const doc = findDocumentByCategory(category);

    expect(doc?.filePathColumn).toBe(column);
    expect(doc?.fileIdField).toBe(fileIdField);
  });

  it("maps every document to an existing JobApplication column", () => {
    // jest.setup.ts mocks @prisma/client globally; the real enum lives in the actual module.
    const { Prisma } = jest.requireActual<typeof import("@prisma/client")>("@prisma/client");
    const columns = Object.values(Prisma.JobApplicationScalarFieldEnum) as string[];
    const documents = [RESUME_DOCUMENT, ...DRIVER_DOCUMENTS, ...LEGACY_DRIVER_DOCUMENTS];

    for (const doc of documents) {
      expect(columns).toContain(doc.filePathColumn);
    }
  });

  it("returns undefined for an unknown category", () => {
    expect(findDocumentByCategory("job-applications/temp/unknown")).toBeUndefined();
  });

  it.each([
    ["job-applications/temp/catering_bags", "Catering Bags Photo"],
    ["job-applications/temp/cart_dolly", "Cart/Dolly Photo"],
    ["job-applications/temp/second_id", "Second Form of ID"],
    ["job-applications/temp/driver_photo", "Driver Photo"],
    ["equipment_photo", "Equipment Photo"],
    ["registration", "Vehicle Registration"],
    ["car_photo", "Vehicle Photo"],
  ])("labels %s as %s", (category, label) => {
    expect(getDocumentLabel(category)).toBe(label);
  });

  it("falls back to a readable label for unknown categories", () => {
    expect(getDocumentLabel("other_file")).toBe("Other file");
  });
});

describe("missingRequiredDriverDocuments", () => {
  const REQUIRED_KEYS = ["license", "insurance", "second_id", "car_photo", "catering_bags", "cart_dolly"];
  const missingKeys = (categories: (string | null | undefined)[]) =>
    missingRequiredDriverDocuments(categories).map((doc) => doc.key);

  it("lists every required document in config order when nothing is uploaded", () => {
    expect(missingKeys([])).toEqual(REQUIRED_KEYS);
  });

  it.each(["", "job-applications/temp/"])("is satisfied by all required categories (prefix %p)", (prefix) => {
    expect(missingKeys(REQUIRED_KEYS.map((key) => `${prefix}${key}`))).toEqual([]);
  });

  it.each(REQUIRED_KEYS)("reports only %s when it is the one missing", (missing) => {
    const uploaded = REQUIRED_KEYS.filter((key) => key !== missing);

    expect(missingKeys(uploaded)).toEqual([missing]);
  });

  it("does not count optional or legacy documents toward the required ones", () => {
    const uploaded = ["registration", "food_handler", "hipaa", "driver_photo", "equipment_photo"];

    expect(missingKeys(uploaded)).toEqual(REQUIRED_KEYS);
  });

  it("ignores empty and unknown categories", () => {
    expect(missingKeys([null, undefined, "", "other", "uploads/license"])).toEqual(REQUIRED_KEYS);
  });
});
