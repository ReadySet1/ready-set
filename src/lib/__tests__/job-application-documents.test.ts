import {
  DRIVER_DOCUMENTS,
  LEGACY_DRIVER_DOCUMENTS,
  categoryBase,
  findDocumentByCategory,
  getDocumentLabel,
  requiredDriverDocuments,
} from "@/lib/job-application-documents";

describe("job application document config", () => {
  it("requires exactly license, insurance, vehicle photo, catering bags and cart/dolly for drivers", () => {
    const required = requiredDriverDocuments().map((doc) => doc.key).sort();

    expect(required).toEqual(
      ["cart_dolly", "car_photo", "catering_bags", "insurance", "license"].sort(),
    );
  });

  it("keeps registration, second ID, food handler and HIPAA optional", () => {
    const optional = DRIVER_DOCUMENTS.filter((doc) => !doc.required)
      .map((doc) => doc.key)
      .sort();

    expect(optional).toEqual(["food_handler", "hipaa", "registration", "second_id"]);
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

  it("uses the upload category the form sends for each document", () => {
    for (const doc of DRIVER_DOCUMENTS) {
      expect(doc.category).toBe(`job-applications/temp/${doc.key}`);
    }
  });

  it("strips the temp prefix from a category", () => {
    expect(categoryBase("job-applications/temp/catering_bags")).toBe("catering_bags");
    expect(categoryBase("license")).toBe("license");
  });

  it.each([
    ["job-applications/temp/second_id", "secondIdFilePath", "secondIdFileId"],
    ["job-applications/temp/catering_bags", "cateringBagsPhotoFilePath", "cateringBagsFileId"],
    ["job-applications/temp/cart_dolly", "cartDollyPhotoFilePath", "cartDollyFileId"],
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
