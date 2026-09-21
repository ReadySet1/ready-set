import React from "react";
import { render } from "@testing-library/react";
import GlobalError from "../global-error";
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

describe("app/global-error.tsx — ChunkLoadError", () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRecover.mockReturnValue(false);
    // global-error.tsx owns its own <html>/<body>, which jsdom already has.
    // Silence the resulting nesting warning; it is a test-harness artifact.
    consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it("attempts the one-time guarded recovery for a chunk error", () => {
    const error = new Error("Loading chunk 17 failed.") as Error & {
      digest?: string;
    };
    error.name = "ChunkLoadError";

    render(<GlobalError error={error} reset={jest.fn()} />, {
      // global-error renders its own <html>/<body>
      container: document.documentElement,
    });

    expect(mockRecover).toHaveBeenCalledTimes(1);
  });

  it("does not attempt recovery for a non-chunk error", () => {
    const error = new Error("boom") as Error & { digest?: string };

    render(<GlobalError error={error} reset={jest.fn()} />, {
      container: document.documentElement,
    });

    expect(mockRecover).not.toHaveBeenCalled();
  });
});
