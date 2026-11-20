import React from "react";
import { render, screen } from "@testing-library/react";
import { ApplicationDetailDialog } from "../ApplicationDetailDialog";
import { ApplicationStatus, JobApplication } from "@/types/job-application";
import type { FileUpload } from "@/types/file";

function upload(id: string, category: string): FileUpload {
  return {
    id,
    fileName: `${id}.jpg`,
    fileType: "image/jpeg",
    fileSize: 1024,
    fileUrl: `https://signed/${id}`,
    filePath: `job-applications/app-1/${id}.jpg`,
    entityType: "job_application",
    entityId: "app-1",
    category,
    uploadedAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    isTemporary: false,
  };
}

function application(fileUploads: FileUpload[]): JobApplication {
  return {
    id: "app-1",
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
    phone: null,
    position: "Driver for Catering Deliveries",
    addressStreet: "1 Main St",
    addressCity: "Austin",
    addressState: "TX",
    addressZip: "78701",
    education: "",
    workExperience: "",
    skills: "",
    coverLetter: null,
    resumeUrl: "",
    driversLicenseUrl: null,
    insuranceUrl: null,
    vehicleRegUrl: null,
    status: ApplicationStatus.PENDING,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    deletedAt: null,
    fileUploads,
  };
}

function renderDialog(app: JobApplication) {
  return render(
    <ApplicationDetailDialog
      application={app}
      open
      onClose={jest.fn()}
      onStatusChange={jest.fn()}
      onDeleteClick={jest.fn()}
      isSubmitting={false}
      error={null}
      canDeleteApplications={false}
    />,
  );
}

describe("ApplicationDetailDialog documents", () => {
  // Regression guard: old applications must keep showing these after the label refactor.
  it("keeps showing driver photo and equipment photo on existing applications", () => {
    renderDialog(
      application([
        upload("driver", "job-applications/temp/driver_photo"),
        upload("equipment", "equipment_photo"),
        upload("registration", "job-applications/temp/registration"),
      ]),
    );

    expect(screen.getByText("Driver Photo")).toBeInTheDocument();
    expect(screen.getByText("Equipment Photo")).toBeInTheDocument();
    expect(screen.getByText("Vehicle Registration")).toBeInTheDocument();
  });

  it("labels the new catering bags, cart/dolly and second ID uploads", () => {
    renderDialog(
      application([
        upload("bags", "job-applications/temp/catering_bags"),
        upload("cart", "job-applications/temp/cart_dolly"),
        upload("second-id", "job-applications/temp/second_id"),
      ]),
    );

    expect(screen.getByText("Catering Bags Photo")).toBeInTheDocument();
    expect(screen.getByText("Cart/Dolly Photo")).toBeInTheDocument();
    expect(screen.getByText("Second Form of ID")).toBeInTheDocument();
  });
});
