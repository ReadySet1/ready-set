import { DriverStatus } from '@/types/user';
import {
  DELIVERY_PHOTO_CATEGORY,
  PICKUP_PHOTO_CATEGORY,
  POD_MAX_PHOTOS,
  POD_PHOTO_LIMIT_CODE,
  countUploadsInCategory,
  hasUploadInCategory,
  requiredPhotoForTransition,
  stageGateMessage,
} from '../stage-photos';

describe('hasUploadInCategory', () => {
  it('matches the stored category case-insensitively and ignores whitespace', () => {
    const files = [{ category: ' Pickup_Photo ' }, { category: null }];
    expect(hasUploadInCategory(files, PICKUP_PHOTO_CATEGORY)).toBe(true);
    expect(hasUploadInCategory(files, DELIVERY_PHOTO_CATEGORY)).toBe(false);
  });

  it('is false for empty, null, undefined or malformed lists', () => {
    expect(hasUploadInCategory([], PICKUP_PHOTO_CATEGORY)).toBe(false);
    expect(hasUploadInCategory(null, PICKUP_PHOTO_CATEGORY)).toBe(false);
    expect(hasUploadInCategory(undefined, PICKUP_PHOTO_CATEGORY)).toBe(false);
    expect(hasUploadInCategory('nope' as unknown as [], PICKUP_PHOTO_CATEGORY)).toBe(false);
    expect(hasUploadInCategory([null, {} as { category?: string }], PICKUP_PHOTO_CATEGORY)).toBe(
      false,
    );
  });
});

describe('requiredPhotoForTransition', () => {
  it('requires the pickup photo to mark PICKED_UP', () => {
    expect(requiredPhotoForTransition(DriverStatus.PICKED_UP)).toEqual({
      category: PICKUP_PHOTO_CATEGORY,
      code: 'PICKUP_PHOTO_REQUIRED',
      message: expect.stringMatching(/photo of the order/i),
    });
  });

  it('requires the delivery photo to mark COMPLETED', () => {
    expect(requiredPhotoForTransition(DriverStatus.COMPLETED)).toEqual({
      category: DELIVERY_PHOTO_CATEGORY,
      code: 'POD_REQUIRED',
      message: expect.stringMatching(/photo of the setup/i),
    });
  });

  it('requires nothing for the other stages', () => {
    for (const status of [
      DriverStatus.ASSIGNED,
      DriverStatus.EN_ROUTE_TO_VENDOR,
      DriverStatus.ARRIVED_AT_VENDOR,
      DriverStatus.EN_ROUTE_TO_CLIENT,
      DriverStatus.ARRIVED_TO_CLIENT,
    ]) {
      expect(requiredPhotoForTransition(status)).toBeNull();
    }
    expect(requiredPhotoForTransition('CANCELLED')).toBeNull();
    expect(requiredPhotoForTransition(null)).toBeNull();
  });
});

describe('stageGateMessage (plain driver copy for a 422 gate code)', () => {
  it('prefers the server message when one was sent', () => {
    expect(stageGateMessage('POD_REQUIRED', 'Server copy')).toBe('Server copy');
  });

  it.each([
    ['PICKUP_PHOTO_REQUIRED', /photo of the order/i],
    ['POD_REQUIRED', /photo of the setup/i],
    ['RECIPIENT_REQUIRED', /recipient's signature/i],
    ['PICKUP_CONFIRMATION_REQUIRED', /handed over the order/i],
    ['SHIFT_REQUIRED', /start your shift/i],
  ])('falls back to plain copy for %s', (code, copy) => {
    expect(stageGateMessage(code)).toMatch(copy);
    expect(stageGateMessage(code, '   ')).toMatch(copy);
  });

  it('returns null for an unknown code', () => {
    expect(stageGateMessage('SOMETHING_ELSE')).toBeNull();
    expect(stageGateMessage(undefined)).toBeNull();
  });
});

describe('proof-of-delivery photo cap', () => {
  it('allows up to three photos per order', () => {
    expect(POD_MAX_PHOTOS).toBe(3);
    expect(POD_PHOTO_LIMIT_CODE).toBe('POD_PHOTO_LIMIT');
  });

  it('countUploadsInCategory counts every matching upload, not just the first', () => {
    const files = [
      { category: 'proof_of_delivery' },
      { category: 'pickup_photo' },
      { category: 'Proof_Of_Delivery' },
      null,
    ];
    expect(countUploadsInCategory(files, DELIVERY_PHOTO_CATEGORY)).toBe(2);
    expect(countUploadsInCategory(null, DELIVERY_PHOTO_CATEGORY)).toBe(0);
  });
});
