import { getAddressInfo } from '../addresses';

describe('addresses', () => {
  describe('getAddressInfo', () => {
    it('should return formatted address', async () => {
      const address = '123 Main St, Austin, TX 78701';
      const result = await getAddressInfo(address);

      expect(result.formatted).toBe(address);
    });

    it('should return empty components object', async () => {
      const result = await getAddressInfo('test address');

      expect(result.components).toEqual({});
    });

    it('should handle empty string', async () => {
      const result = await getAddressInfo('');

      expect(result.formatted).toBe('');
      expect(result.components).toEqual({});
    });

    it('should handle special characters in address', async () => {
      const address = '123 O\'Connor St, Austin, TX';
      const result = await getAddressInfo(address);

      expect(result.formatted).toBe(address);
    });

    it('should handle unicode characters', async () => {
      const address = '123 Calle Niño, México';
      const result = await getAddressInfo(address);

      expect(result.formatted).toBe(address);
    });
  });
});
