import React from "react";
import { render, screen } from "@testing-library/react";
import GlobalErrorBoundary from "../GlobalErrorBoundary";
import { recoverFromChunkLoadError } from "@/lib/chunk-load-recovery";

jest.mock("@/lib/monitoring/sentry", () => ({
  captureException: jest.fn(),
}));

jest.mock("@/lib/error-logging", () => ({
  collectErrorContext: jest.fn(() => ({})),
}));

jest.mock("@/lib/chunk-load-recovery", () => ({
  ...jest.requireActual("@/lib/chunk-load-recovery"),
  recoverFromChunkLoadError: jest.fn(() => false),
}));

const mockRecover = recoverFromChunkLoadError as jest.MockedFunction<
  typeof recoverFromChunkLoadError
>;

function Boom({ error }: { error: Error }): React.ReactElement {
  throw error;
}

function chunkError(): Error {
  const error = new Error(
    "Loading chunk app/global-error-3f1a failed.\n(error: https://readysetllc.com/_next/static/chunks/app/global-error-3f1a.js)",
  );
  error.name = "ChunkLoadError";
  return error;
}

describe("GlobalErrorBoundary — ChunkLoadError", () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRecover.mockReturnValue(false);
    // React logs the caught error; silence it to keep test output readable.
    consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it("renders the chunk-load fallback instead of the generic error UI", () => {
    render(
      <GlobalErrorBoundary>
        <Boom error={chunkError()} />
      </GlobalErrorBoundary>,
    );

    expect(screen.getByText("Loading Error")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /clear cache & reload/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
  });

  it("attempts the one-time guarded recovery for a chunk error", () => {
    render(
      <GlobalErrorBoundary>
        <Boom error={chunkError()} />
      </GlobalErrorBoundary>,
    );

    expect(mockRecover).toHaveBeenCalledTimes(1);
    expect(mockRecover).toHaveBeenCalledWith(
      expect.objectContaining({ name: "ChunkLoadError" }),
    );
  });

  it("still renders the generic error UI for a non-chunk error", () => {
    render(
      <GlobalErrorBoundary>
        <Boom error={new Error("totally unrelated")} />
      </GlobalErrorBoundary>,
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.queryByText("Loading Error")).not.toBeInTheDocument();
    expect(mockRecover).not.toHaveBeenCalled();
  });
});
