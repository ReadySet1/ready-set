/**
 * Tests for the shared driver-ownership helper.
 *
 * Regression guard for the profile_id/user_id split: `drivers.profile_id` is
 * the canonical auth-user link (unique FK to profiles.id) while `user_id` is a
 * legacy duplicate that is NULL on most rows. Ownership checks that look at
 * `user_id` alone deny nearly every real driver, so these tests pin the
 * generated SQL to matching on BOTH columns.
 */

import {
  driverOwnershipCondition,
  getActionCaller,
  getDriverForUser,
  userOwnsDriver,
} from "../driver-ownership";
import { prisma } from "@/utils/prismaDB";
import { headers } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getUserRole } from "@/lib/auth";

jest.mock("@/utils/prismaDB", () => ({
  prisma: { $queryRawUnsafe: jest.fn() },
}));
jest.mock("next/headers", () => ({ headers: jest.fn() }));
jest.mock("@/utils/supabase/server", () => ({ createClient: jest.fn() }));
jest.mock("@/lib/auth", () => ({ getUserRole: jest.fn() }));

const mockQuery = (prisma as unknown as { $queryRawUnsafe: jest.Mock })
  .$queryRawUnsafe;

const DRIVER_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("driverOwnershipCondition", () => {
  it("matches on profile_id OR user_id (never user_id alone)", () => {
    const sql = driverOwnershipCondition(2);
    expect(sql).toContain("profile_id = $2::uuid");
    expect(sql).toContain("user_id = $2::uuid");
    expect(sql).toMatch(/OR/);
  });

  it("prefixes both columns with the table alias", () => {
    const sql = driverOwnershipCondition(3, "dr");
    expect(sql).toContain("dr.profile_id = $3::uuid");
    expect(sql).toContain("dr.user_id = $3::uuid");
  });
});

describe("userOwnsDriver", () => {
  it("returns false for a null driverId without touching the DB", async () => {
    expect(await userOwnsDriver(null, USER_ID)).toBe(false);
    expect(await userOwnsDriver(undefined, USER_ID)).toBe(false);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("queries by both linkage columns and returns true on a match", async () => {
    mockQuery.mockResolvedValue([{ id: DRIVER_ID }]);

    const owns = await userOwnsDriver(DRIVER_ID, USER_ID);

    expect(owns).toBe(true);
    const [sql, ...params] = mockQuery.mock.calls[0];
    expect(sql).toContain("profile_id = $2::uuid");
    expect(sql).toContain("user_id = $2::uuid");
    expect(sql).toContain("deleted_at IS NULL");
    expect(params).toEqual([DRIVER_ID, USER_ID]);
  });

  it("returns false when no row links the driver to the user", async () => {
    mockQuery.mockResolvedValue([]);
    expect(await userOwnsDriver(DRIVER_ID, USER_ID)).toBe(false);
  });

  it("adds the is_active filter only when requireActive is set", async () => {
    mockQuery.mockResolvedValue([{ id: DRIVER_ID }]);

    await userOwnsDriver(DRIVER_ID, USER_ID);
    expect(mockQuery.mock.calls[0][0]).not.toContain("is_active");

    await userOwnsDriver(DRIVER_ID, USER_ID, { requireActive: true });
    expect(mockQuery.mock.calls[1][0]).toContain("is_active = true");
  });
});

describe("getActionCaller (Bearer-or-cookie identity)", () => {
  const mockHeaders = headers as jest.Mock;
  const mockCreateClient = createClient as jest.Mock;
  const mockGetUserRole = getUserRole as jest.Mock;
  const mockGetUser = jest.fn();

  /** Minimal ReadonlyHeaders stand-in. Keys are matched lowercase. */
  const headerBag = (entries: Record<string, string>) => ({
    get: (name: string) => entries[name.toLowerCase()] ?? null,
  });

  beforeEach(() => {
    mockCreateClient.mockResolvedValue({ auth: { getUser: mockGetUser } });
    mockGetUserRole.mockResolvedValue("DRIVER");
    mockHeaders.mockResolvedValue(headerBag({}));
  });

  it("resolves identity from the Bearer token without touching cookie auth", async () => {
    // 2026-08 field failure: stale auth cookies, valid in-memory session — the
    // Bearer header must be enough on its own.
    mockHeaders.mockResolvedValue(headerBag({ authorization: "Bearer tok-123" }));
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });

    const caller = await getActionCaller();

    expect(caller).toEqual({ userId: USER_ID, isPrivileged: false });
    expect(mockGetUser).toHaveBeenCalledTimes(1);
    expect(mockGetUser).toHaveBeenCalledWith("tok-123");
  });

  it("uses cookie auth when there is no Authorization header", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });

    const caller = await getActionCaller();

    expect(caller).toEqual({ userId: USER_ID, isPrivileged: false });
    expect(mockGetUser).toHaveBeenCalledTimes(1);
    expect(mockGetUser).toHaveBeenCalledWith();
  });

  it("falls back to cookie auth when the Bearer token does not validate", async () => {
    mockHeaders.mockResolvedValue(headerBag({ authorization: "Bearer stale-tok" }));
    mockGetUser
      .mockResolvedValueOnce({ data: { user: null }, error: { message: "invalid JWT" } })
      .mockResolvedValueOnce({ data: { user: { id: USER_ID } }, error: null });

    const caller = await getActionCaller();

    expect(caller?.userId).toBe(USER_ID);
    expect(mockGetUser).toHaveBeenNthCalledWith(1, "stale-tok");
    expect(mockGetUser).toHaveBeenNthCalledWith(2);
  });

  it("falls back to cookie auth when headers() throws outside a request scope", async () => {
    mockHeaders.mockImplementation(() => {
      throw new Error("headers was called outside a request scope");
    });
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });

    const caller = await getActionCaller();

    expect(caller?.userId).toBe(USER_ID);
    expect(mockGetUser).toHaveBeenCalledWith();
  });

  it("returns null when neither transport authenticates", async () => {
    mockHeaders.mockResolvedValue(headerBag({ authorization: "Bearer stale-tok" }));
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    expect(await getActionCaller()).toBeNull();
  });

  it("marks ADMIN and SUPER_ADMIN callers as privileged", async () => {
    mockGetUserRole.mockResolvedValue("ADMIN");
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });

    const caller = await getActionCaller();

    expect(caller).toEqual({ userId: USER_ID, isPrivileged: true });
  });
});

describe("getDriverForUser", () => {
  it("resolves the driver row via both linkage columns", async () => {
    mockQuery.mockResolvedValue([
      { id: DRIVER_ID, is_active: true, current_shift_id: null },
    ]);

    const driver = await getDriverForUser(USER_ID);

    expect(driver).toEqual({
      id: DRIVER_ID,
      isActive: true,
      currentShiftId: null,
    });
    const [sql, ...params] = mockQuery.mock.calls[0];
    expect(sql).toContain("profile_id = $1::uuid");
    expect(sql).toContain("user_id = $1::uuid");
    expect(sql).toContain("deleted_at IS NULL");
    expect(params).toEqual([USER_ID]);
  });

  it("returns null when the user has no driver row", async () => {
    mockQuery.mockResolvedValue([]);
    expect(await getDriverForUser(USER_ID)).toBeNull();
  });
});
