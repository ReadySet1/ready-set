import { getRecoveryStrategy } from "../error-recovery";
import {
  CHUNK_RELOAD_SESSION_KEY,
  hasAttemptedChunkReload,
  isChunkLoadError,
  markChunkReloadAttempted,
  recoverFromChunkLoadError,
} from "../chunk-load-recovery";

// jsdom makes window.location.reload non-configurable, so the reload itself
// cannot be spied on. The recovery action is owned by getRecoveryStrategy();
// this suite asserts the delegation and the one-time guard, while
// error-recovery.test.ts asserts the strategy really carries a reload action.
jest.mock("../error-recovery", () => ({
  getRecoveryStrategy: jest.fn(),
}));

const mockGetRecoveryStrategy = getRecoveryStrategy as jest.MockedFunction<
  typeof getRecoveryStrategy
>;

describe("chunk-load-recovery", () => {
  describe("isChunkLoadError", () => {
    it("detects an error named ChunkLoadError", () => {
      const error = new Error("boom");
      error.name = "ChunkLoadError";
      expect(isChunkLoadError(error)).toBe(true);
    });

    it("detects webpack's 'Loading chunk N failed' message", () => {
      expect(
        isChunkLoadError(
          new Error(
            "Loading chunk app/global-error-3f1a failed.\n(timeout: https://www.readysetllc.com/_next/static/chunks/app/global-error-3f1a.js)",
          ),
        ),
      ).toBe(true);
    });

    it("detects a ChunkLoadError mentioned in the message only", () => {
      expect(
        isChunkLoadError(new Error("ChunkLoadError: something went wrong")),
      ).toBe(true);
    });

    it("detects a failed CSS chunk", () => {
      expect(
        isChunkLoadError(new Error("Loading CSS chunk 12 failed.")),
      ).toBe(true);
    });

    it("ignores an unrelated error", () => {
      expect(isChunkLoadError(new TypeError("x is not a function"))).toBe(
        false,
      );
    });

    it("ignores a missing error", () => {
      expect(isChunkLoadError(undefined)).toBe(false);
      expect(isChunkLoadError(null)).toBe(false);
    });
  });

  describe("one-time reload guard", () => {
    beforeEach(() => {
      window.sessionStorage.clear();
    });

    it("reports no attempt on a fresh session", () => {
      expect(hasAttemptedChunkReload()).toBe(false);
    });

    it("remembers an attempt once marked", () => {
      markChunkReloadAttempted();
      expect(window.sessionStorage.getItem(CHUNK_RELOAD_SESSION_KEY)).toBe("1");
      expect(hasAttemptedChunkReload()).toBe(true);
    });

    it("survives sessionStorage throwing (private mode)", () => {
      const spy = jest
        .spyOn(Storage.prototype, "getItem")
        .mockImplementation(() => {
          throw new Error("denied");
        });

      expect(hasAttemptedChunkReload()).toBe(false);
      spy.mockRestore();
    });
  });

  describe("recoverFromChunkLoadError", () => {
    let fallbackAction: jest.Mock;

    const chunkError = () => {
      const error = new Error("Loading chunk 42 failed.");
      error.name = "ChunkLoadError";
      return error;
    };

    beforeEach(() => {
      window.sessionStorage.clear();
      fallbackAction = jest.fn();
      mockGetRecoveryStrategy.mockReset();
      mockGetRecoveryStrategy.mockReturnValue({ maxRetries: 2, fallbackAction });
    });

    it("runs the recovery action once for a chunk load error", () => {
      expect(recoverFromChunkLoadError(chunkError())).toBe(true);
      expect(fallbackAction).toHaveBeenCalledTimes(1);
      expect(hasAttemptedChunkReload()).toBe(true);
    });

    it("does not recover a second time in the same session", () => {
      recoverFromChunkLoadError(chunkError());
      fallbackAction.mockClear();

      expect(recoverFromChunkLoadError(chunkError())).toBe(false);
      expect(fallbackAction).not.toHaveBeenCalled();
    });

    it("never recovers for a non-chunk error", () => {
      expect(recoverFromChunkLoadError(new Error("nope"))).toBe(false);
      expect(fallbackAction).not.toHaveBeenCalled();
      expect(hasAttemptedChunkReload()).toBe(false);
    });

    it("does not burn the attempt when the strategy has no recovery action", () => {
      mockGetRecoveryStrategy.mockReturnValue({ maxRetries: 2 });

      expect(recoverFromChunkLoadError(chunkError())).toBe(false);
      expect(hasAttemptedChunkReload()).toBe(false);
    });
  });
});
