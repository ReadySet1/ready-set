import {
  CONFIG_KEY_MAX_LENGTH,
  NEW_CLIENT_TEMPLATE_ID,
  buildNewClientConfiguration,
  slugifyConfigKey,
  validateConfigKey,
} from '../new-client-configuration';
import {
  GENERIC_TEMPLATE,
  getConfiguration,
  validateConfiguration,
} from '../client-configurations';

describe('slugifyConfigKey', () => {
  it('lowercases, strips punctuation and joins words with dashes', () => {
    expect(slugifyConfigKey('HY Food Co.')).toBe('hy-food-co');
    expect(slugifyConfigKey('  Ready   Set  ')).toBe('ready-set');
    expect(slugifyConfigKey('Café Olé!')).toBe('cafe-ole');
  });

  it('returns an empty string when nothing usable remains', () => {
    expect(slugifyConfigKey('!!!')).toBe('');
  });
});

describe('validateConfigKey', () => {
  it('accepts lowercase dash-separated keys', () => {
    expect(validateConfigKey('new-client-2')).toBeNull();
  });

  it.each([
    ['', 'required'],
    ['New Client', 'lowercase'],
    ['-leading', 'lowercase'],
    ['a'.repeat(CONFIG_KEY_MAX_LENGTH + 1), 'characters'],
  ])('rejects %p', (key, fragment) => {
    const error = validateConfigKey(key);
    expect(error).toEqual(expect.stringContaining(fragment));
  });
});

describe('buildNewClientConfiguration', () => {
  const now = new Date('2026-10-15T00:00:00Z');

  it('starts from the generic template and applies the identity fields', () => {
    expect(getConfiguration(NEW_CLIENT_TEMPLATE_ID)).toBe(GENERIC_TEMPLATE);

    const config = buildNewClientConfiguration(
      { id: 'new-client', clientName: '  New Client ', vendorName: ' Vendor ' },
      now,
    );

    expect(config.id).toBe('new-client');
    expect(config.clientName).toBe('New Client');
    expect(config.vendorName).toBe('Vendor');
    expect(config.isActive).toBe(true);
    expect(config.description).toBeUndefined();
    expect(config.notes).toBeUndefined();
    expect(config.createdAt).toEqual(now);
    expect(config.updatedAt).toEqual(now);
    expect(config.pricingTiers).toEqual(GENERIC_TEMPLATE.pricingTiers);
    expect(config.driverPaySettings).toEqual(GENERIC_TEMPLATE.driverPaySettings);
    expect(config.mileageRate).toBe(GENERIC_TEMPLATE.mileageRate);
  });

  it('defaults the vendor name to the client name', () => {
    const config = buildNewClientConfiguration({ id: 'acme', clientName: 'Acme' }, now);
    expect(config.vendorName).toBe('Acme');
  });

  it('does not share nested references with the template', () => {
    const config = buildNewClientConfiguration({ id: 'acme', clientName: 'Acme' }, now);
    config.pricingTiers[0]!.regularRate = 999;
    expect(GENERIC_TEMPLATE.pricingTiers[0]!.regularRate).not.toBe(999);
  });

  it('produces a configuration that passes validateConfiguration', () => {
    const config = buildNewClientConfiguration({ id: 'acme', clientName: 'Acme' }, now);
    expect(validateConfiguration(config)).toEqual({ valid: true, errors: [] });
  });
});
