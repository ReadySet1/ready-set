import {
  getCloudinaryUrl,
  getResponsiveCloudinaryUrl,
  localPathToPublicId,
} from '../url-builder';

describe('cloudinary url-builder', () => {
  describe('getCloudinaryUrl', () => {
    it('should generate basic URL with default auto optimizations', () => {
      const url = getCloudinaryUrl('logo/logo-dark');

      expect(url).toContain('res.cloudinary.com');
      expect(url).toContain('f_auto');
      expect(url).toContain('q_auto');
      expect(url).toContain('ready-set/logo/logo-dark');
    });

    it('should handle publicId with leading slash', () => {
      const url = getCloudinaryUrl('/logo/logo-dark');

      expect(url).toContain('ready-set/logo/logo-dark');
      expect(url).not.toContain('ready-set//logo');
    });

    it('should apply width transformation', () => {
      const url = getCloudinaryUrl('hero/hero-bg', { width: 1920 });

      expect(url).toContain('w_1920');
    });

    it('should apply height transformation', () => {
      const url = getCloudinaryUrl('hero/hero-bg', { height: 1080 });

      expect(url).toContain('h_1080');
    });

    it('should apply both width and height', () => {
      const url = getCloudinaryUrl('hero/hero-bg', { width: 1920, height: 1080 });

      expect(url).toContain('w_1920');
      expect(url).toContain('h_1080');
    });

    it('should apply crop transformation', () => {
      const url = getCloudinaryUrl('hero/hero-bg', { crop: 'fill' });

      expect(url).toContain('c_fill');
    });

    it('should apply gravity transformation', () => {
      const url = getCloudinaryUrl('hero/hero-bg', { gravity: 'center' });

      expect(url).toContain('g_center');
    });

    it('should apply custom format', () => {
      const url = getCloudinaryUrl('logo/logo-dark', { format: 'webp' });

      expect(url).toContain('f_webp');
      expect(url).not.toContain('f_auto');
    });

    it('should apply custom quality', () => {
      const url = getCloudinaryUrl('logo/logo-dark', { quality: 80 });

      expect(url).toContain('q_80');
      expect(url).not.toContain('q_auto');
    });

    it('should apply DPR transformation', () => {
      const url = getCloudinaryUrl('logo/logo-dark', { dpr: 2 });

      expect(url).toContain('dpr_2');
    });

    it('should apply all transformations together', () => {
      const url = getCloudinaryUrl('hero/hero-bg', {
        width: 1920,
        height: 1080,
        crop: 'fill',
        gravity: 'auto',
        quality: 85,
        format: 'webp',
        dpr: 2,
      });

      expect(url).toContain('w_1920');
      expect(url).toContain('h_1080');
      expect(url).toContain('c_fill');
      expect(url).toContain('g_auto');
      expect(url).toContain('q_85');
      expect(url).toContain('f_webp');
      expect(url).toContain('dpr_2');
    });
  });

  describe('getResponsiveCloudinaryUrl', () => {
    it('should return src and srcSet', () => {
      const result = getResponsiveCloudinaryUrl('hero/hero-bg', [640, 1024, 1920]);

      expect(result).toHaveProperty('src');
      expect(result).toHaveProperty('srcSet');
    });

    it('should generate srcSet with width descriptors', () => {
      const result = getResponsiveCloudinaryUrl('hero/hero-bg', [640, 1024]);

      expect(result.srcSet).toContain('640w');
      expect(result.srcSet).toContain('1024w');
    });

    it('should include width in each srcSet URL', () => {
      const result = getResponsiveCloudinaryUrl('hero/hero-bg', [640, 1024]);

      expect(result.srcSet).toContain('w_640');
      expect(result.srcSet).toContain('w_1024');
    });

    it('should preserve base options in srcSet URLs', () => {
      const result = getResponsiveCloudinaryUrl('hero/hero-bg', [640, 1024], {
        crop: 'fill',
        quality: 80,
      });

      expect(result.srcSet).toContain('c_fill');
      expect(result.srcSet).toContain('q_80');
    });

    it('should handle single breakpoint', () => {
      const result = getResponsiveCloudinaryUrl('hero/hero-bg', [800]);

      expect(result.srcSet).toContain('w_800');
      expect(result.srcSet).toContain('800w');
    });

    it('should handle empty breakpoints array', () => {
      const result = getResponsiveCloudinaryUrl('hero/hero-bg', []);

      expect(result.src).toContain('ready-set/hero/hero-bg');
      expect(result.srcSet).toBe('');
    });
  });

  describe('localPathToPublicId', () => {
    it('should remove /images/ prefix', () => {
      const publicId = localPathToPublicId('/images/logo/logo-dark.png');

      expect(publicId).toBe('logo/logo-dark');
    });

    it('should remove file extension', () => {
      const publicId = localPathToPublicId('/images/hero/hero-bg.jpg');

      expect(publicId).toBe('hero/hero-bg');
    });

    it('should handle different extensions', () => {
      expect(localPathToPublicId('/images/icon.svg')).toBe('icon');
      expect(localPathToPublicId('/images/photo.webp')).toBe('photo');
      expect(localPathToPublicId('/images/image.jpeg')).toBe('image');
    });

    it('should handle nested paths', () => {
      const publicId = localPathToPublicId('/images/brands/company/logo.png');

      expect(publicId).toBe('brands/company/logo');
    });

    it('should handle path without /images/ prefix', () => {
      const publicId = localPathToPublicId('logo/logo-dark.png');

      expect(publicId).toBe('logo/logo-dark');
    });

    it('should handle path with dots in filename', () => {
      const publicId = localPathToPublicId('/images/logo/logo.v2.dark.png');

      expect(publicId).toBe('logo/logo.v2.dark');
    });
  });
});
