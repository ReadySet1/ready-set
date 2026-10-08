import {
  PROD_PROJECT_REF,
  findAuthUserByEmail,
  planAccountWrite,
  resolveAccountTarget,
} from '@/lib/driver/driver-account-plan';

const DEV_REF = 'devdevdevdevdevdevde';

const PROD = {
  databaseUrl: `postgresql://postgres.${PROD_PROJECT_REF}:pw@aws-0-us-west-1.pooler.supabase.com:6543/postgres`,
  directUrl: `postgresql://postgres:pw@db.${PROD_PROJECT_REF}.supabase.co:5432/postgres`,
  supabaseUrl: `https://${PROD_PROJECT_REF}.supabase.co`,
};

const DEV = {
  databaseUrl: `postgresql://postgres.${DEV_REF}:pw@aws-0-us-west-1.pooler.supabase.com:6543/postgres`,
  directUrl: `postgresql://postgres:pw@db.${DEV_REF}.supabase.co:5432/postgres`,
  supabaseUrl: `https://${DEV_REF}.supabase.co`,
};

describe('PROD_PROJECT_REF', () => {
  it('is the production Supabase project ref', () => {
    expect(PROD_PROJECT_REF).toBe('jiasmmmmhtreoacdpiby');
  });
});

describe('resolveAccountTarget', () => {
  it('resolves dev when every URL points at dev and --prod is absent', () => {
    expect(resolveAccountTarget({ ...DEV, prod: false })).toBe('dev');
  });

  it('resolves dev when DIRECT_URL is not set', () => {
    expect(resolveAccountTarget({ ...DEV, directUrl: undefined, prod: false })).toBe('dev');
  });

  it('throws when DATABASE_URL is missing', () => {
    expect(() => resolveAccountTarget({ ...DEV, databaseUrl: undefined, prod: false })).toThrow(
      /DATABASE_URL/,
    );
  });

  it('throws when NEXT_PUBLIC_SUPABASE_URL is missing', () => {
    expect(() => resolveAccountTarget({ ...DEV, supabaseUrl: '', prod: false })).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL/,
    );
  });

  it.each([
    ['databaseUrl', { ...DEV, databaseUrl: PROD.databaseUrl }],
    ['directUrl', { ...DEV, directUrl: PROD.directUrl }],
    ['supabaseUrl', { ...DEV, supabaseUrl: PROD.supabaseUrl }],
  ])('refuses prod in %s without --prod and names the flags to pass', (_field, urls) => {
    expect(() => resolveAccountTarget({ ...urls, prod: false })).toThrow(
      new RegExp(`--prod --confirm-prod ${PROD_PROJECT_REF}`),
    );
  });

  it('resolves prod when every URL is prod and the ref is confirmed', () => {
    expect(resolveAccountTarget({ ...PROD, prod: true, confirmProd: PROD_PROJECT_REF })).toBe(
      'prod',
    );
  });

  it('resolves prod when DIRECT_URL is not set', () => {
    expect(
      resolveAccountTarget({
        ...PROD,
        directUrl: undefined,
        prod: true,
        confirmProd: PROD_PROJECT_REF,
      }),
    ).toBe('prod');
  });

  it.each([
    ['databaseUrl', { ...PROD, databaseUrl: DEV.databaseUrl }],
    ['directUrl', { ...PROD, directUrl: DEV.directUrl }],
    ['supabaseUrl', { ...PROD, supabaseUrl: DEV.supabaseUrl }],
  ])('refuses --prod when %s is not prod (mixed environment)', (_field, urls) => {
    expect(() =>
      resolveAccountTarget({ ...urls, prod: true, confirmProd: PROD_PROJECT_REF }),
    ).toThrow(/mixed|not point at production/i);
  });

  it('refuses --prod against an all-dev environment', () => {
    expect(() =>
      resolveAccountTarget({ ...DEV, prod: true, confirmProd: PROD_PROJECT_REF }),
    ).toThrow(/not point at production/);
  });

  it('refuses --prod without --confirm-prod', () => {
    expect(() => resolveAccountTarget({ ...PROD, prod: true })).toThrow(/--confirm-prod/);
  });

  it('refuses --prod with the wrong confirmation ref', () => {
    expect(() =>
      resolveAccountTarget({ ...PROD, prod: true, confirmProd: 'jiasmmmmhtreoacdpib' }),
    ).toThrow(/--confirm-prod/);
  });
});

describe('planAccountWrite', () => {
  it('sets a password for a new auth user (dev)', () => {
    expect(
      planAccountWrite({ target: 'dev', authUserExists: false, profileType: null, resetPassword: false }),
    ).toEqual({ setPassword: true });
  });

  it('sets a password for a new auth user (prod)', () => {
    expect(
      planAccountWrite({ target: 'prod', authUserExists: false, profileType: null, resetPassword: false }),
    ).toEqual({ setPassword: true });
  });

  it('resets an existing user password on dev (unchanged behavior)', () => {
    expect(
      planAccountWrite({ target: 'dev', authUserExists: true, profileType: 'DRIVER', resetPassword: false }),
    ).toEqual({ setPassword: true });
  });

  it('never silently resets an existing user password on prod', () => {
    expect(
      planAccountWrite({ target: 'prod', authUserExists: true, profileType: 'DRIVER', resetPassword: false }),
    ).toEqual({ setPassword: false });
  });

  it('resets an existing user password on prod only with --reset-password', () => {
    expect(
      planAccountWrite({ target: 'prod', authUserExists: true, profileType: 'DRIVER', resetPassword: true }),
    ).toEqual({ setPassword: true });
  });

  it('refuses to change the role of an existing non-driver profile on prod', () => {
    expect(() =>
      planAccountWrite({ target: 'prod', authUserExists: true, profileType: 'CLIENT', resetPassword: false }),
    ).toThrow(/CLIENT/);
  });

  it('still converts a non-driver profile on dev (unchanged behavior)', () => {
    expect(
      planAccountWrite({ target: 'dev', authUserExists: true, profileType: 'CLIENT', resetPassword: false }),
    ).toEqual({ setPassword: true });
  });
});

describe('findAuthUserByEmail', () => {
  const user = (n: number) => ({ id: `id-${n}`, email: `user${n}@example.com` });

  it('finds a match on a later page', async () => {
    const pages = [[user(1), user(2)], [user(3), user(4)], [user(5)]];
    const listPage = jest.fn(async (page: number) => ({ users: pages[page - 1] ?? [] }));

    const found = await findAuthUserByEmail(listPage, 'user5@example.com', 2);

    expect(found).toEqual(user(5));
    expect(listPage).toHaveBeenCalledTimes(3);
    expect(listPage).toHaveBeenNthCalledWith(1, 1, 2);
    expect(listPage).toHaveBeenNthCalledWith(3, 3, 2);
  });

  it('matches case-insensitively', async () => {
    const listPage = jest.fn(async () => ({ users: [user(1)] }));
    await expect(findAuthUserByEmail(listPage, 'USER1@Example.COM')).resolves.toEqual(user(1));
  });

  it('stops at the first short page and returns null when absent', async () => {
    const pages = [[user(1), user(2)], [user(3)]];
    const listPage = jest.fn(async (page: number) => ({ users: pages[page - 1] ?? [] }));

    await expect(findAuthUserByEmail(listPage, 'nobody@example.com', 2)).resolves.toBeNull();
    expect(listPage).toHaveBeenCalledTimes(2);
  });

  it('stops on an empty page when the last full page was exactly perPage', async () => {
    const pages = [[user(1), user(2)]];
    const listPage = jest.fn(async (page: number) => ({ users: pages[page - 1] ?? [] }));

    await expect(findAuthUserByEmail(listPage, 'nobody@example.com', 2)).resolves.toBeNull();
    expect(listPage).toHaveBeenCalledTimes(2);
  });

  it('ignores users without an email', async () => {
    const listPage = jest.fn(async () => ({ users: [{ id: 'x', email: null }, user(1)] }));
    await expect(findAuthUserByEmail(listPage, 'user1@example.com')).resolves.toEqual(user(1));
  });

  it('defaults to 1000 users per page', async () => {
    const listPage = jest.fn(async () => ({ users: [] }));
    await findAuthUserByEmail(listPage, 'a@b.c');
    expect(listPage).toHaveBeenCalledWith(1, 1000);
  });
});
