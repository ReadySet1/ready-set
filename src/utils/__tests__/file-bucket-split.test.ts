/**
 * Tests for the pure bucket-split helpers used by the order files route.
 *
 * POD artifacts (proof-of-delivery photos, pickup signatures) live in the
 * 'delivery-proofs' bucket while every other upload lives in the default
 * 'fileUploader' bucket. Signing a POD path against the default bucket
 * produces a broken URL — the route must split paths per bucket and merge
 * the signed-URL maps back together.
 */

import {
  isPodFileCategory,
  mergeSignedUrlMaps,
  splitFilePathsByBucket,
} from '../file-bucket-split';

describe('isPodFileCategory', () => {
  it('matches the exact stored categories', () => {
    // Exact values written by prisma.fileUpload.create in the pod and
    // signature routes.
    expect(isPodFileCategory('proof_of_delivery')).toBe(true);
    expect(isPodFileCategory('pickup_signature')).toBe(true);
  });

  it('matches case-insensitively and ignores surrounding whitespace', () => {
    expect(isPodFileCategory('Proof_Of_Delivery')).toBe(true);
    expect(isPodFileCategory(' PICKUP_SIGNATURE ')).toBe(true);
  });

  it('rejects non-POD categories and missing values', () => {
    expect(isPodFileCategory('catering-order')).toBe(false);
    expect(isPodFileCategory('on-demand')).toBe(false);
    expect(isPodFileCategory('')).toBe(false);
    expect(isPodFileCategory(null)).toBe(false);
    expect(isPodFileCategory(undefined)).toBe(false);
  });
});

describe('splitFilePathsByBucket', () => {
  it('routes POD categories to podPaths and everything else to defaultPaths', () => {
    const files = [
      { filePath: 'catering/menu.pdf', category: 'catering-order' },
      { filePath: 'pod/order-1/photo.jpg', category: 'proof_of_delivery' },
      { filePath: 'pod/order-1/signature.png', category: 'pickup_signature' },
      { filePath: 'misc/invoice.pdf', category: null },
    ];

    expect(splitFilePathsByBucket(files)).toEqual({
      podPaths: ['pod/order-1/photo.jpg', 'pod/order-1/signature.png'],
      defaultPaths: ['catering/menu.pdf', 'misc/invoice.pdf'],
    });
  });

  it('skips files without a filePath', () => {
    const files = [
      { filePath: null, category: 'proof_of_delivery' },
      { filePath: '', category: 'catering-order' },
    ];

    expect(splitFilePathsByBucket(files)).toEqual({
      podPaths: [],
      defaultPaths: [],
    });
  });

  it('returns empty groups for an empty list', () => {
    expect(splitFilePathsByBucket([])).toEqual({
      podPaths: [],
      defaultPaths: [],
    });
  });
});

describe('mergeSignedUrlMaps', () => {
  it('merges maps so the response lookup shape is unchanged', () => {
    const defaults = new Map([['a.pdf', 'https://signed/a']]);
    const pods = new Map([['pod/b.jpg', 'https://signed/b']]);

    const merged = mergeSignedUrlMaps(defaults, pods);

    expect(merged.size).toBe(2);
    expect(merged.get('a.pdf')).toBe('https://signed/a');
    expect(merged.get('pod/b.jpg')).toBe('https://signed/b');
  });

  it('handles empty maps', () => {
    expect(mergeSignedUrlMaps(new Map(), new Map()).size).toBe(0);
  });
});
