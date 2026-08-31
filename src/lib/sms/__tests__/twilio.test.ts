/**
 * Twilio SMS provider — phone normalization and config guard.
 */

jest.mock('twilio', () => ({
  __esModule: true,
  default: jest.fn(() => ({ messages: { create: jest.fn() } })),
}));

import { normalizePhoneNumber, TwilioSmsProvider } from '../twilio';

const TWILIO_ENV = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER'] as const;

describe('normalizePhoneNumber', () => {
  it('prefixes a bare 10-digit US number with +1', () => {
    expect(normalizePhoneNumber('4155551234')).toBe('+14155551234');
  });

  it('strips formatting from a 10-digit number', () => {
    expect(normalizePhoneNumber('(415) 555-1234')).toBe('+14155551234');
  });

  it('prefixes an 11-digit number with a leading 1 with +', () => {
    expect(normalizePhoneNumber('14155551234')).toBe('+14155551234');
  });

  it('keeps an already E.164-formatted number unchanged', () => {
    expect(normalizePhoneNumber('+14155551234')).toBe('+14155551234');
  });

  it('strips spaces and dashes from a +-prefixed number', () => {
    expect(normalizePhoneNumber('+1 415-555-1234')).toBe('+14155551234');
  });
});

describe('TwilioSmsProvider constructor', () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of TWILIO_ENV) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of TWILIO_ENV) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it('throws when the Twilio env vars are missing', () => {
    expect(() => new TwilioSmsProvider()).toThrow(/Missing Twilio configuration/);
  });

  it('constructs when all three env vars are present', () => {
    process.env.TWILIO_ACCOUNT_SID = 'ACxxx';
    process.env.TWILIO_AUTH_TOKEN = 'token';
    process.env.TWILIO_PHONE_NUMBER = '+15550000000';

    expect(() => new TwilioSmsProvider()).not.toThrow();
  });
});
