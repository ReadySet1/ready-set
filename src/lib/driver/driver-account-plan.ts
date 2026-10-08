/**
 * Planning helpers for `scripts/create-driver-account.ts`.
 *
 * The script creates driver logins on dev by default. Real pilot drivers need
 * accounts on production, so prod is an explicit, double-confirmed mode:
 * `--prod --confirm-prod <ref>`, and every connection URL must agree that it
 * is prod. A mixed environment would create the auth user in one Supabase
 * project and the profile in another, which is never recoverable cleanly.
 *
 * This module holds the pure decisions so they can be tested without a DB.
 * All I/O lives in the script.
 */

/** Supabase ref of the production project. */
export const PROD_PROJECT_REF = 'jiasmmmmhtreoacdpiby';

export type AccountTarget = 'dev' | 'prod';

export interface AccountTargetInput {
  databaseUrl?: string;
  directUrl?: string;
  supabaseUrl?: string;
  prod: boolean;
  confirmProd?: string;
}

const pointsAtProd = (url: string): boolean => url.includes(PROD_PROJECT_REF);

/**
 * Decide which environment the script is about to write to, or throw.
 * Must run before any client (Prisma or Supabase) is constructed.
 */
export function resolveAccountTarget(input: AccountTargetInput): AccountTarget {
  const { databaseUrl, directUrl, supabaseUrl, prod, confirmProd } = input;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set — run through `dotenv -e <env file> --`.');
  }
  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set.');
  }

  const urls: Array<[string, string]> = [
    ['DATABASE_URL', databaseUrl],
    ['NEXT_PUBLIC_SUPABASE_URL', supabaseUrl],
  ];
  if (directUrl) urls.push(['DIRECT_URL', directUrl]);

  if (!prod) {
    const prodVar = urls.find(([, url]) => pointsAtProd(url));
    if (prodVar) {
      throw new Error(
        `${prodVar[0]} points at the PRODUCTION Supabase project. ` +
          `To create a real driver account on prod, pass --prod --confirm-prod ${PROD_PROJECT_REF}.`,
      );
    }
    return 'dev';
  }

  const notProd = urls.filter(([, url]) => !pointsAtProd(url)).map(([name]) => name);
  if (notProd.length > 0) {
    throw new Error(
      `--prod was passed but ${notProd.join(', ')} does not point at production ` +
        `(mixed environment). Every URL must target ${PROD_PROJECT_REF}.`,
    );
  }

  if (confirmProd !== PROD_PROJECT_REF) {
    throw new Error(
      `--prod requires --confirm-prod ${PROD_PROJECT_REF} (the production project ref, typed out).`,
    );
  }

  return 'prod';
}

export interface AccountWriteInput {
  target: AccountTarget;
  authUserExists: boolean;
  /** Existing profile type, or null when there is no profile yet. */
  profileType: string | null;
  resetPassword: boolean;
}

export interface AccountWritePlan {
  setPassword: boolean;
}

/**
 * Decide what the script may change for this account, or throw.
 *
 * Prod is conservative: an existing non-driver profile is never converted (a
 * real admin or client must not lose their role to a typo), and an existing
 * user's password is only reset when explicitly asked for.
 */
export function planAccountWrite(input: AccountWriteInput): AccountWritePlan {
  const { target, authUserExists, profileType, resetPassword } = input;

  if (target === 'prod' && profileType !== null && profileType !== 'DRIVER') {
    throw new Error(
      `Existing profile is ${profileType}, not DRIVER. Refusing to change a real user's role on production.`,
    );
  }

  if (!authUserExists) return { setPassword: true };
  if (target === 'dev') return { setPassword: true };
  return { setPassword: resetPassword };
}

export interface AuthUserLike {
  id: string;
  email?: string | null;
}

export type ListAuthUsersPage<U extends AuthUserLike> = (
  page: number,
  perPage: number,
) => Promise<{ users: U[] }>;

/**
 * Find an auth user by email across every page of the admin users list.
 * `listUsers()` without paging only returns the first page, which silently
 * misses existing users on a project as large as prod.
 */
export async function findAuthUserByEmail<U extends AuthUserLike>(
  listPage: ListAuthUsersPage<U>,
  email: string,
  perPage = 1000,
): Promise<U | null> {
  const wanted = email.toLowerCase();
  for (let page = 1; ; page += 1) {
    const { users } = await listPage(page, perPage);
    const match = users.find((u) => u.email?.toLowerCase() === wanted);
    if (match) return match;
    if (users.length < perPage) return null;
  }
}
