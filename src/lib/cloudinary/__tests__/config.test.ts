import { cloudinaryConfig, CLOUDINARY_BASE_URL, getCloudinaryApiConfig } from '../config';

describe('cloudinary config', () => {
  describe('cloudinaryConfig', () => {
    it('should have cloudName property', () => {
      expect(cloudinaryConfig).toHaveProperty('cloudName');
      expect(typeof cloudinaryConfig.cloudName).toBe('string');
    });

    it('should have folder property', () => {
      expect(cloudinaryConfig).toHaveProperty('folder');
      expect(cloudinaryConfig.folder).toBe('ready-set');
    });

    it('should use default cloudName if env var not set', () => {
      // cloudName should have a fallback value
      expect(cloudinaryConfig.cloudName).toBeTruthy();
    });
  });

  describe('CLOUDINARY_BASE_URL', () => {
    it('should be a valid Cloudinary URL', () => {
      expect(CLOUDINARY_BASE_URL).toContain('https://res.cloudinary.com');
    });

    it('should contain the cloud name', () => {
      expect(CLOUDINARY_BASE_URL).toContain(cloudinaryConfig.cloudName);
    });

    it('should include image/upload path', () => {
      expect(CLOUDINARY_BASE_URL).toContain('/image/upload');
    });
  });

  describe('getCloudinaryApiConfig', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      jest.resetModules();
      process.env = { ...originalEnv };
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    it('should throw error when API key is missing', () => {
      process.env.CLOUDINARY_API_KEY = '';
      process.env.CLOUDINARY_API_SECRET = 'test-secret';

      expect(() => getCloudinaryApiConfig()).toThrow('Cloudinary API credentials not configured');
    });

    it('should throw error when API secret is missing', () => {
      process.env.CLOUDINARY_API_KEY = 'test-key';
      process.env.CLOUDINARY_API_SECRET = '';

      expect(() => getCloudinaryApiConfig()).toThrow('Cloudinary API credentials not configured');
    });

    it('should throw error when both credentials are missing', () => {
      process.env.CLOUDINARY_API_KEY = '';
      process.env.CLOUDINARY_API_SECRET = '';

      expect(() => getCloudinaryApiConfig()).toThrow('Cloudinary API credentials not configured');
    });

    it('should return config when credentials are present', () => {
      process.env.CLOUDINARY_API_KEY = 'test-key';
      process.env.CLOUDINARY_API_SECRET = 'test-secret';

      const config = getCloudinaryApiConfig();

      expect(config).toHaveProperty('cloud_name');
      expect(config).toHaveProperty('api_key', 'test-key');
      expect(config).toHaveProperty('api_secret', 'test-secret');
    });

    it('should include cloud_name in config', () => {
      process.env.CLOUDINARY_API_KEY = 'test-key';
      process.env.CLOUDINARY_API_SECRET = 'test-secret';

      const config = getCloudinaryApiConfig();

      expect(config.cloud_name).toBe(cloudinaryConfig.cloudName);
    });
  });
});
