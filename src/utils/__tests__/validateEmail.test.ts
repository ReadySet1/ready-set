import { validateEmail } from '../validateEmail';

describe('validateEmail', () => {
  describe('valid emails', () => {
    it('should validate standard email format', () => {
      expect(validateEmail('test@example.com')).toBeTruthy();
      expect(validateEmail('user@domain.org')).toBeTruthy();
      expect(validateEmail('name@company.net')).toBeTruthy();
    });

    it('should validate email with subdomain', () => {
      expect(validateEmail('user@mail.example.com')).toBeTruthy();
      expect(validateEmail('test@sub.domain.org')).toBeTruthy();
    });

    it('should validate email with numbers', () => {
      expect(validateEmail('user123@example.com')).toBeTruthy();
      expect(validateEmail('test@123domain.com')).toBeTruthy();
    });

    it('should validate email with dots in local part', () => {
      expect(validateEmail('first.last@example.com')).toBeTruthy();
      expect(validateEmail('john.doe.smith@company.org')).toBeTruthy();
    });

    it('should validate email with plus sign', () => {
      expect(validateEmail('user+tag@example.com')).toBeTruthy();
    });

    it('should validate email with hyphens', () => {
      expect(validateEmail('user-name@example.com')).toBeTruthy();
      expect(validateEmail('test@my-domain.com')).toBeTruthy();
    });

    it('should validate email with underscores', () => {
      expect(validateEmail('user_name@example.com')).toBeTruthy();
    });

    it('should be case-insensitive', () => {
      expect(validateEmail('TEST@EXAMPLE.COM')).toBeTruthy();
      expect(validateEmail('Test@Example.Com')).toBeTruthy();
    });

    it('should validate email with IP address domain', () => {
      expect(validateEmail('user@[192.168.1.1]')).toBeTruthy();
    });
  });

  describe('invalid emails', () => {
    it('should reject email without @', () => {
      expect(validateEmail('invalidemail.com')).toBeFalsy();
    });

    it('should reject email without domain', () => {
      expect(validateEmail('user@')).toBeFalsy();
    });

    it('should reject email without local part', () => {
      expect(validateEmail('@example.com')).toBeFalsy();
    });

    it('should reject email with spaces', () => {
      expect(validateEmail('user name@example.com')).toBeFalsy();
      expect(validateEmail('user@exam ple.com')).toBeFalsy();
    });

    it('should reject email with double dots', () => {
      expect(validateEmail('user..name@example.com')).toBeFalsy();
    });

    it('should reject empty string', () => {
      expect(validateEmail('')).toBeFalsy();
    });

    it('should reject email without TLD', () => {
      expect(validateEmail('user@domain')).toBeFalsy();
    });

    it('should reject email with single character TLD', () => {
      expect(validateEmail('user@domain.c')).toBeFalsy();
    });

    it('should reject email with special characters in wrong places', () => {
      expect(validateEmail('user<name>@example.com')).toBeFalsy();
      expect(validateEmail('user(name)@example.com')).toBeFalsy();
    });
  });
});
