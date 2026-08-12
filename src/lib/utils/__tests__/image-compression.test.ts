/**
 * Tests for the POD image compression utility.
 *
 * Field bug (2026-08-11): browser-image-compression's maxSizeMB is best-effort,
 * so a modern phone photo "compressed to about 2MB" could land at 2.0-2.3MB and
 * straddle the server's exact size cap. The util must now (a) target a size
 * comfortably under the cap, (b) retry with progressively lower quality and
 * dimensions when the output is still over the client-side limit, and (c)
 * surface a clear error instead of letting a doomed upload proceed.
 */

jest.mock('browser-image-compression', () => ({
  __esModule: true,
  default: jest.fn(),
}));

import imageCompression from 'browser-image-compression';
import {
  compressImage,
  ImageValidationError,
  POD_PHOTO_TOO_LARGE_ERROR,
} from '../image-compression';
import {
  DEFAULT_POD_COMPRESSION_OPTIONS,
  POD_CLIENT_MAX_COMPRESSED_SIZE_BYTES,
  POD_MAX_UPLOAD_SIZE_BYTES,
} from '@/types/proof-of-delivery';

const mockedCompression = imageCompression as unknown as jest.Mock;

const MB = 1024 * 1024;

/** Creates a real File of exactly `size` bytes. */
const makeFile = (size: number, name = 'photo.jpg', type = 'image/jpeg'): File =>
  new File([new Uint8Array(size)], name, { type });

describe('compressImage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('compression targets', () => {
    it('targets 1.5MB / 1600px so the output lands comfortably under the server cap', () => {
      expect(DEFAULT_POD_COMPRESSION_OPTIONS.maxSizeMB).toBe(1.5);
      expect(DEFAULT_POD_COMPRESSION_OPTIONS.maxWidthOrHeight).toBe(1600);
    });

    it('keeps the client-side limit under the server cap by a safety margin', () => {
      expect(POD_CLIENT_MAX_COMPRESSED_SIZE_BYTES).toBeLessThan(POD_MAX_UPLOAD_SIZE_BYTES);
    });

    it('passes the tightened defaults to browser-image-compression', async () => {
      mockedCompression.mockResolvedValueOnce(makeFile(1 * MB));

      await compressImage(makeFile(5 * MB));

      expect(mockedCompression).toHaveBeenCalledTimes(1);
      expect(mockedCompression).toHaveBeenCalledWith(
        expect.any(File),
        expect.objectContaining({
          maxSizeMB: 1.5,
          maxWidthOrHeight: 1600,
        })
      );
    });

    it('returns a small JPEG untouched (no compression round-trip)', async () => {
      const small = makeFile(1 * MB);

      const result = await compressImage(small);

      expect(mockedCompression).not.toHaveBeenCalled();
      expect(result.wasCompressed).toBe(false);
      expect(result.file).toBe(small);
    });
  });

  describe('size guarantee loop', () => {
    it('retries with progressively lower quality/dimensions until under the client limit', async () => {
      // First pass "compresses" to 3.8MB (over the client limit), second lands at 2MB.
      mockedCompression
        .mockResolvedValueOnce(makeFile(POD_CLIENT_MAX_COMPRESSED_SIZE_BYTES + 300 * 1024))
        .mockResolvedValueOnce(makeFile(2 * MB));

      const result = await compressImage(makeFile(8 * MB));

      expect(mockedCompression).toHaveBeenCalledTimes(2);

      const firstOptions = mockedCompression.mock.calls[0][1];
      const retryOptions = mockedCompression.mock.calls[1][1];
      expect(retryOptions.initialQuality).toBeLessThan(firstOptions.initialQuality);
      expect(retryOptions.maxWidthOrHeight).toBeLessThan(firstOptions.maxWidthOrHeight);

      expect(result.wasCompressed).toBe(true);
      expect(result.compressedSize).toBeLessThanOrEqual(POD_CLIENT_MAX_COMPRESSED_SIZE_BYTES);
    });

    it('surfaces a clear error when the output still exceeds the limit after all retries', async () => {
      // Every attempt stays over the client-side limit.
      mockedCompression.mockResolvedValue(
        makeFile(POD_CLIENT_MAX_COMPRESSED_SIZE_BYTES + 300 * 1024)
      );

      await expect(compressImage(makeFile(9 * MB))).rejects.toThrow(POD_PHOTO_TOO_LARGE_ERROR);

      // Initial attempt + bounded retries — never an infinite loop.
      expect(mockedCompression.mock.calls.length).toBeGreaterThanOrEqual(3);
      expect(mockedCompression.mock.calls.length).toBeLessThanOrEqual(4);
    });

    it('throws an ImageValidationError with SIZE_TOO_LARGE for the over-limit case', async () => {
      mockedCompression.mockResolvedValue(
        makeFile(POD_CLIENT_MAX_COMPRESSED_SIZE_BYTES + 300 * 1024)
      );

      await expect(compressImage(makeFile(9 * MB))).rejects.toMatchObject({
        name: 'ImageValidationError',
        code: 'SIZE_TOO_LARGE',
      });
    });
  });

  describe('input validation (pre-compression)', () => {
    it('rejects files over the pre-compression input cap', async () => {
      await expect(compressImage(makeFile(11 * MB))).rejects.toThrow(ImageValidationError);
      expect(mockedCompression).not.toHaveBeenCalled();
    });

    it('rejects unsupported file types', async () => {
      await expect(
        compressImage(makeFile(1 * MB, 'doc.pdf', 'application/pdf'))
      ).rejects.toMatchObject({ code: 'INVALID_TYPE' });
    });
  });
});
