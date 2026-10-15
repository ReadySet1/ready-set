import { DriverStatus } from '@/types/user';
import {
  DELIVERY_PHOTO_CATEGORY,
  PICKUP_PHOTO_CATEGORY,
  hasUploadInCategory,
  requiredPhotoForTransition,
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
