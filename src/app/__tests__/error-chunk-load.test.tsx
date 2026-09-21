import React from "react";
import { render, screen } from "@testing-library/react";
import AppError from "../error";
import { recoverFromChunkLoadError } from "@/lib/chunk-load-recovery";

jest.mock("@/lib/monitoring/sentry", () => ({
  captureException: jest.fn(),
}));

jest.mock("@/lib/chunk-load-recovery", () => ({
  ...jest.requireActual("@/lib/chunk-load-recovery"),
  recoverFromChunkLoadError: jest.fn(() => false),
}));

const mockRecover = recoverFromChunkLoadError as jest.MockedFunction<
  typeof recoverFromChunkLoadError
>;

function chunkError(): Error & { digest?: string } {
  const error = new Error("Loading chunk 4821 failed.") as Error & {
    digest?: string;
  };
  error.name = "ChunkLoadError";
  return error;
}

describe("app/error.tsx — ChunkLoadError", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRecover.mockReturnValue(false);
  });

  it("renders the chunk-load fallback instead of the generic segment error", () => {
    render(<AppError error={chunkError()} reset={jest.fn()} />);

    expect(screen.getByText("Loading Error")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /clear cache & reload/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Something went wrong!")).not.toBeInTheDocument();
  });

  it("attempts the one-time guarded recovery for a chunk error", () => {
    render(<AppError error={chunkError()} reset={jest.fn()} />);

    expect(mockRecover).toHaveBeenCalledTimes(1);
    expect(mockRecover).toHaveBeenCalledWith(
      expect.objectContaining({ name: "ChunkLoadError" }),
    );
  });

  it("keeps the generic segment error UI for a non-chunk error", () => {
    const error = new Error("boom") as Error & { digest?: string };

    render(<AppError error={error} reset={jest.fn()} />);

    expect(screen.getByText("Something went wrong!")).toBeInTheDocument();
    expect(screen.queryByText("Loading Error")).not.toBeInTheDocument();
    expect(mockRecover).not.toHaveBeenCalled();
  });
});
