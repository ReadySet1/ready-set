import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import JobApplicationForm from "@/components/Apply/ApplyForm";
import { toast } from "@/components/ui/use-toast";

let mockFilesByCategory: Record<string, { key: string; path: string; category: string }[]> = {};

jest.mock("@/hooks/use-job-application-upload", () => ({
  useJobApplicationUpload: ({ category }: { category: string }) => ({
    uploadedFiles: mockFilesByCategory[category] ?? [],
    setUploadedFiles: jest.fn(),
    onUpload: jest.fn(),
    deleteFile: jest.fn(),
    isUploading: false,
    progresses: {},
  }),
}));
jest.mock("@/contexts/ApplicationSessionContext", () => ({
  useApplicationSession: () => ({
    session: { uploadToken: "test-token" },
    createSession: jest.fn(),
    markSessionCompleted: jest.fn(),
    resetSession: jest.fn(),
  }),
}));
jest.mock("next/navigation", () => ({ useSearchParams: () => ({ get: () => null }) }));
jest.mock("@/components/ui/use-toast", () => ({ toast: jest.fn() }));

const REQUIRED_KEYS = ["license", "insurance", "second_id", "car_photo", "catering_bags", "cart_dolly"];
const STEP_1_VALUES = {
  role: "Driver for Catering Deliveries",
  firstName: "Jane",
  lastName: "Driver",
  email: "jane@example.com",
  phone: "555-123-4567",
  "address.street": "1 Main St",
  "address.city": "Austin",
  "address.state": "TX",
  "address.zip": "78701",
};

const upload = (key: string, category = `job-applications/temp/${key}`) => {
  mockFilesByCategory[`job-applications/temp/${key}`] = [{ key: `${key}-id`, path: `temp/${key}.pdf`, category }];
};
const clickNext = () => fireEvent.click(screen.getAllByRole("button", { name: "Next" }).at(-1)!);
const missingToast = (label: string) =>
  expect.objectContaining({ description: `Please upload your ${label}` });

async function submitDocumentsStep() {
  const { container } = render(<JobApplicationForm />);
  for (const [name, value] of Object.entries(STEP_1_VALUES)) {
    fireEvent.change(container.querySelector(`[name="${name}"]`)!, { target: { value } });
  }
  clickNext();
  await screen.findByText("Driver Application");
  clickNext();
  await screen.findByRole("heading", { name: "Documents" });
  clickNext();
}

describe("ApplyForm driver document validation", () => {
  beforeEach(() => {
    mockFilesByCategory = {};
    jest.mocked(toast).mockClear();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, id: "app-1" }),
    }) as jest.Mock;
  });

  async function expectSubmitted() {
    fireEvent.click(await screen.findByRole("button", { name: "Submit Application" }));
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith("/api/job-applications", expect.anything()),
    );
    expect(toast).not.toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
  }

  it("blocks a driver who has not uploaded the Second Form of ID", async () => {
    REQUIRED_KEYS.filter((key) => key !== "second_id").forEach((key) => upload(key));

    await submitDocumentsStep();

    await waitFor(() => expect(toast).toHaveBeenCalledWith(missingToast("Second Form of ID")));
    expect(screen.getByRole("heading", { name: "Documents" })).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("submits a driver with the six required documents and no optional ones", async () => {
    REQUIRED_KEYS.forEach((key) => upload(key));

    await submitDocumentsStep();

    await expectSubmitted();
  });

  it("checks each document by its key, not by the category on the uploaded file", async () => {
    REQUIRED_KEYS.forEach((key) => upload(key));
    // The server returns a category that does not match the second ID hook's key.
    upload("second_id", "job-applications/temp/second-id");

    await submitDocumentsStep();

    await expectSubmitted();
  });
});
