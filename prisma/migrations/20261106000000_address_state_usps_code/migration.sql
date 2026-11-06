-- Backfill addresses.state to the USPS 2-letter code.
--
-- Saved addresses carried full state names ("California", and "CALIFORNIA" from
-- the old POST /api/addresses uppercase-only normalization), which blocked admin
-- order creation with "State must be 2 characters". New writes now go through
-- normalizeStateCode() in src/lib/utils/state-code.ts; this brings existing rows
-- in line. Keep the VALUES table in sync with USPS_CODE_BY_NAME there (a Jest
-- test enforces it).
--
-- Data-only and idempotent: only rows whose trimmed, case-folded state is a
-- known US state / territory name, or a 2-letter value that is not yet
-- uppercased/trimmed, are touched. Anything unmapped (e.g. Mexican states such
-- as "Guanajuato" used by the Leon field-test drives) is left exactly as is.

-- 1. Full US state / territory names → USPS code.
UPDATE "addresses" AS a
SET "state" = m.code
FROM (VALUES
  ('ALABAMA', 'AL'),
  ('ALASKA', 'AK'),
  ('ARIZONA', 'AZ'),
  ('ARKANSAS', 'AR'),
  ('CALIFORNIA', 'CA'),
  ('COLORADO', 'CO'),
  ('CONNECTICUT', 'CT'),
  ('DELAWARE', 'DE'),
  ('FLORIDA', 'FL'),
  ('GEORGIA', 'GA'),
  ('HAWAII', 'HI'),
  ('IDAHO', 'ID'),
  ('ILLINOIS', 'IL'),
  ('INDIANA', 'IN'),
  ('IOWA', 'IA'),
  ('KANSAS', 'KS'),
  ('KENTUCKY', 'KY'),
  ('LOUISIANA', 'LA'),
  ('MAINE', 'ME'),
  ('MARYLAND', 'MD'),
  ('MASSACHUSETTS', 'MA'),
  ('MICHIGAN', 'MI'),
  ('MINNESOTA', 'MN'),
  ('MISSISSIPPI', 'MS'),
  ('MISSOURI', 'MO'),
  ('MONTANA', 'MT'),
  ('NEBRASKA', 'NE'),
  ('NEVADA', 'NV'),
  ('NEW HAMPSHIRE', 'NH'),
  ('NEW JERSEY', 'NJ'),
  ('NEW MEXICO', 'NM'),
  ('NEW YORK', 'NY'),
  ('NORTH CAROLINA', 'NC'),
  ('NORTH DAKOTA', 'ND'),
  ('OHIO', 'OH'),
  ('OKLAHOMA', 'OK'),
  ('OREGON', 'OR'),
  ('PENNSYLVANIA', 'PA'),
  ('RHODE ISLAND', 'RI'),
  ('SOUTH CAROLINA', 'SC'),
  ('SOUTH DAKOTA', 'SD'),
  ('TENNESSEE', 'TN'),
  ('TEXAS', 'TX'),
  ('UTAH', 'UT'),
  ('VERMONT', 'VT'),
  ('VIRGINIA', 'VA'),
  ('WASHINGTON', 'WA'),
  ('WEST VIRGINIA', 'WV'),
  ('WISCONSIN', 'WI'),
  ('WYOMING', 'WY'),
  ('DISTRICT OF COLUMBIA', 'DC'),
  ('WASHINGTON DC', 'DC'),
  ('WASHINGTON D.C.', 'DC'),
  ('PUERTO RICO', 'PR'),
  ('GUAM', 'GU'),
  ('AMERICAN SAMOA', 'AS'),
  ('NORTHERN MARIANA ISLANDS', 'MP'),
  ('US VIRGIN ISLANDS', 'VI'),
  ('U.S. VIRGIN ISLANDS', 'VI')
) AS m(name, code)
WHERE upper(regexp_replace(btrim(a."state"), '\s+', ' ', 'g')) = m.name;

-- 2. 2-letter values that are lowercase or padded → trimmed + uppercased.
UPDATE "addresses"
SET "state" = upper(btrim("state"))
WHERE length(btrim("state")) = 2
  AND "state" <> upper(btrim("state"));
