-- Partial UNIQUE index on api_key_hash for active, non-deleted partners.
-- Prevents two active rows from sharing the same hash, which would let
-- findFirst({ where: { apiKeyHash, isActive: true, deletedAt: null }})
-- return a nondeterministic row and let the same key authenticate as
-- either partner. See PR #402 pre-landing review #2.
--
-- Soft-deleted rows and inactive rows are allowed to repeat hashes
-- (historic rotation, key reuse after revoke) without violating the
-- constraint.

CREATE UNIQUE INDEX "api_partners_active_api_key_hash_key"
  ON "public"."api_partners" ("api_key_hash")
  WHERE "deleted_at" IS NULL AND "is_active" = true;

-- Also enforce UNIQUE on order_prefix for non-deleted partners. Two partners
-- sharing a prefix (admin error, or attack via duplicate row insertion) lets
-- buildOrderNumber and isPartnerOrder both return ambiguous results: an order
-- with "PX-foo" could be claimed by either partner depending on which row the
-- planner returns. Same logic as api_key_hash: soft-deleted rows can repeat,
-- so we use a partial unique index. See PR #402 pre-landing review #8.
CREATE UNIQUE INDEX "api_partners_active_order_prefix_key"
  ON "public"."api_partners" ("order_prefix")
  WHERE "deleted_at" IS NULL;
