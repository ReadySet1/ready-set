# Master Plan — Toggleable CTA buttons (Flowers + Catering)

**Goal:** put two yellow CTA buttons behind an in-code visibility flag, defaulted to OFF,
so they can be restored by flipping a boolean instead of reverting a commit.

| # | Button | Page | Component |
|---|--------|------|-----------|
| 1 | `How Our Service Works` | `/flowers-deliveries` | `src/components/FlowersDelivery/FlowersAbout.tsx` |
| 2 | `Get Started` | `/catering-deliveries` | `src/components/FoodDelivery/CateringFeatures.tsx` |

**Branch:** `fix/hide-cta-buttons` off `origin/development`
**Scope:** 5 files — 1 new config module, 2 components, 2 test files. Nothing else.
**Base verified against:** `origin/development` @ `16b1a1fa` (merge of PR #497).

---

## 0. Pre-flight findings (already verified — do not re-litigate)

1. **Blast radius is one page each.** `FlowersAbout` is imported only by
   `src/app/(site)/flowers-deliveries/page.tsx`. `CateringFeatures` is imported only by
   `src/app/(site)/catering-deliveries/page.tsx`. No shared layout, no other route.
2. **Neither page loses its only conversion path.** `/flowers-deliveries` keeps the
   `Get Started` CTA inside `ServiceFeaturesSection.tsx` (opens the quote form);
   `/catering-deliveries` keeps the `How Our Service Works` link inside
   `CateringAbout.tsx` plus ScheduleDialog triggers in FoodHeader, CateringStats
   and CateringContact. Both CTAs are hidden as a marketing decision, not because
   they were duplicates — the flowers CTA linked to /vendor-hero (a different
   destination) and the catering CTA opened the booking dialog (same action but
   redundant with three other triggers on the page).
3. **Both components are client components** (`"use client"` + framer-motion), so the flag
   must be readable in the browser bundle. A module-scope constant satisfies this; see
   §10 for the env-var caveat if this ever needs per-environment control.
4. **Existing tests assert these buttons render.** With the flag defaulted OFF they go red
   unless updated — the biggest "you broke something" risk here. See §5.
5. **Imports stay.** Unlike a deletion, `Link` in `FlowersAbout.tsx` and `ScheduleDialog`
   in `CateringFeatures.tsx` remain referenced inside the conditional, so there are no
   orphaned-import lint errors to clean up.

---

## 1. Approach decision

### 1.1 Why a conditional render, not CSS

| Option | Verdict |
|---|---|
| CSS `hidden` class | ✗ Node stays in the DOM. `<Link>` still prefetches, `ScheduleDialog` still mounts. A sheet over the furniture, not a toggle. |
| Delete the JSX | ✗ Rejected — Fer wants it toggleable in-code, not archived in git history. |
| **`{flag && <JSX/>}` behind a named constant** | ✓ **Chosen.** React never mounts the subtree, so zero runtime cost when off, and re-enabling is a one-character diff. |

### 1.2 Why NOT `src/lib/feature-flags.ts`

The repo already has a feature-flag system. **We are deliberately not using it.** Reasons,
so this doesn't get flagged in review:

- It is 443 lines built for *runtime, per-user rollout*: percentage rollouts, user-ID
  allowlists, role gating, a `FeatureFlagStore` class.
- It imports `@/lib/logging/realtime-logger` and `@/constants/realtime-config`. Wiring it
  into two static marketing components would drag a logger and the realtime config into the
  marketing client bundle to answer a boolean.
- Different concern entirely: that system answers *"should **this user** get **this
  feature** right now?"*. Ours answers *"is **this button** part of the site?"* — one
  answer, same for everybody, decided at build time.

> Analogy: `src/lib/feature-flags.ts` is the dimmer switch with per-room scheduling.
> What we need is the light switch by the door.

If Emman prefers consolidation into the existing system, that is a follow-up refactor,
not this PR. Say so in the PR description rather than pre-emptively building it.

---

## 2. Branch setup

```bash
cd /Users/fersanz/Documents/ready-set
git fetch origin
git switch -c fix/hide-cta-buttons origin/development
git status --porcelain   # clean apart from this untracked plan doc
git log -1 --oneline     # expect 16b1a1fa or newer
```

If `development` has moved past `16b1a1fa`, re-read both components before editing — the
anchors in §4 must still match byte-for-byte.

---

## 3. NEW FILE — `src/config/marketing-cta-config.ts`

Lives in `src/config/` alongside `cache-config.ts`, `mileage-config.ts`,
`upload-config.ts` — same `*-config.ts` naming convention. Create it exactly as below:

```ts
/**
 * Marketing CTA Visibility
 *
 * Build-time, site-wide visibility switches for call-to-action buttons on the public
 * marketing pages. One answer for every visitor — no per-user rollout, no runtime
 * evaluation. For gradual/percentage rollout of application features, use
 * `src/lib/feature-flags.ts` instead.
 *
 * To restore a button: flip its value to `true` and ship. Nothing else to change.
 */

export const MARKETING_CTA_FLAGS = {
  /**
   * "How Our Service Works" pill in `FlowersAbout`, under the florist photo
   * on /flowers-deliveries. Links to /vendor-hero.
   * Disabled 2026-08 as a marketing decision — NOT because it was a duplicate.
   * The "Get Started" CTA in ServiceFeaturesSection opens the quote form: a
   * different action to a different destination.
   */
  FLOWERS_ABOUT_SERVICE_WORKS: false,

  /**
   * "Get Started" ScheduleDialog trigger in `CateringFeatures`, under the three
   * feature cards on /catering-deliveries. Opens the Google Calendar booking flow.
   * Disabled 2026-08 as a marketing decision — NOT because it was a duplicate.
   */
  CATERING_FEATURES_GET_STARTED: false,
} as const;

export type MarketingCtaFlag = keyof typeof MARKETING_CTA_FLAGS;

/**
 * Read a CTA visibility flag.
 *
 * Declared to return `boolean` rather than the literal type, so consumers do not get
 * spurious "this condition is always false" narrowing from the `as const` object.
 */
export function isMarketingCtaEnabled(flag: MarketingCtaFlag): boolean {
  return MARKETING_CTA_FLAGS[flag];
}
```

**Why an accessor function and not a raw import of the const:** two reasons.
First, the `as const` object types both values as the literal `false`, and TypeScript
would then narrow `{FLAG && <JSX/>}` in a way that makes the JSX branch look dead —
the declared `boolean` return breaks that. Second, a function is trivially mockable in
Jest (`jest.mock` + `mockReturnValue`), which is what lets §5 test **both** states.

---

## 4. Component changes

### 4.1 — `src/components/FlowersDelivery/FlowersAbout.tsx`

**Edit A — add the import** after the existing `import Link from "next/link";` (line 7):

```tsx
import { isMarketingCtaEnabled } from "@/config/marketing-cta-config";
```

**Edit B — read the flag** as the first statement inside the component, above `const stats`:

```tsx
const FlowersAbout: React.FC = () => {
  const showServiceWorksCta = isMarketingCtaEnabled(
    "FLOWERS_ABOUT_SERVICE_WORKS",
  );

  const stats = [
```

**Edit C — wrap the CTA block.** Find this exact block in the right-hand column, directly
after the image `<div>`, and wrap it in the conditional:

```tsx
            {showServiceWorksCta && (
              <motion.div
                className="mt-8"
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.8 }}
              >
                <Link
                  href="/vendor-hero"
                  className="inline-block rounded-full bg-yellow-400 px-12 py-4 text-lg font-extrabold text-gray-900 transition-all hover:-translate-y-0.5 hover:bg-yellow-500 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-offset-2"
                >
                  How Our Service Works
                </Link>
              </motion.div>
            )}
```

Note the whole block gains one indent level (2 spaces). **Do not change any className,
href, or motion prop** — the only semantic change is the wrapper. Run Prettier
(`pnpm pre-push-check` covers it) so the reindent is canonical.

**Untouched:** the outer `<motion.div className="flex flex-col items-center justify-center">`,
the image block, `StatCard`, the stats grid, the `Link` import (still used above).

### 4.2 — `src/components/FoodDelivery/CateringFeatures.tsx`

**Edit A — add the import** after `import ScheduleDialog from "@/components/Logistics/Schedule";`:

```tsx
import { isMarketingCtaEnabled } from "@/config/marketing-cta-config";
```

**Edit B — read the flag** as the first statement inside `CateringFeatures`, above
`const features`:

```tsx
const CateringFeatures: React.FC = () => {
  const showGetStartedCta = isMarketingCtaEnabled(
    "CATERING_FEATURES_GET_STARTED",
  );

  const features = [
```

**Edit C — wrap the CTA block** (the last child of `<div className="mx-auto max-w-7xl px-4">`):

```tsx
        {showGetStartedCta && (
          <motion.div
            className="mt-16 flex justify-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
          >
            <ScheduleDialog
              buttonText="Get Started"
              dialogTitle="Schedule an Appointment"
              dialogDescription="Choose a convenient time for your appointment."
              calendarUrl="https://calendar.google.com/calendar/appointments/schedules/AcZssZ0J6woLwahSRd6c1KrJ_X1cOl99VPr6x-Rp240gi87kaD28RsU1rOuiLVyLQKleUqoVJQqDEPVu?gv=true"
              customButton={
                <motion.button
                  className="rounded-lg bg-yellow-400 px-12 py-4 font-[Montserrat] text-lg font-extrabold text-gray-800 shadow-md transition-all hover:translate-y-[-2px] hover:bg-yellow-500 hover:shadow-lg"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Get Started
                </motion.button>
              }
            />
          </motion.div>
        )}
```

Keep the `{/* Get Started Button */}` comment directly above the conditional.

**Untouched:** `FeatureCard`, the `features` array (all three), the
`More Than Just Delivery` heading, `aria-labelledby="catering-features-heading"`, and the
`MapPin / Headset / Truck` imports.

**Known tradeoff — bundle size.** `ScheduleDialog` is a static import, so it stays in the
`/catering-deliveries` chunk even while the flag is off. That is the price of keeping the
toggle a one-character flip. Converting to `next/dynamic` would shed the weight but makes
re-enabling a code change again — **out of scope, do not do it here.**

---

## 5. Test updates (mandatory — these fail otherwise)

The payoff of the flag approach: tests now cover **both** states, so the toggle itself is
verified, not just the current setting.

### 5.1 — `src/components/FlowersDelivery/__tests__/FlowersAbout.test.tsx`

**Edit A — add a mock** alongside the existing `@/lib/cloudinary` mock, *before* the
`import FlowersAbout from "../FlowersAbout";` line (~line 51):

```tsx
// Mock the CTA visibility flag so both states can be exercised
jest.mock("@/config/marketing-cta-config", () => ({
  isMarketingCtaEnabled: jest.fn(),
}));
```

**Edit B — import the mocked fn** immediately after the `FlowersAbout` import:

```tsx
import { isMarketingCtaEnabled } from "@/config/marketing-cta-config";

const mockIsMarketingCtaEnabled = isMarketingCtaEnabled as jest.MockedFunction<
  typeof isMarketingCtaEnabled
>;
```

**Edit C — add a `beforeEach`** as the first statement inside `describe("FlowersAbout", ...)`,
so every existing test keeps rendering against the production default:

```tsx
  beforeEach(() => {
    mockIsMarketingCtaEnabled.mockReturnValue(false);
  });
```

**Edit D — replace the whole `describe("CTA Link", ...)` block** (~line 117):

```tsx
  describe("CTA Link", () => {
    it("does not render the 'How Our Service Works' link when the flag is off", () => {
      render(<FlowersAbout />);
      expect(
        screen.queryByRole("link", { name: /how our service works/i }),
      ).not.toBeInTheDocument();
    });

    it("renders the 'How Our Service Works' link when the flag is on", () => {
      mockIsMarketingCtaEnabled.mockReturnValue(true);
      render(<FlowersAbout />);

      const link = screen.getByRole("link", {
        name: /how our service works/i,
      });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", "/vendor-hero");
    });

    it("reads the FLOWERS_ABOUT_SERVICE_WORKS flag", () => {
      render(<FlowersAbout />);
      expect(mockIsMarketingCtaEnabled).toHaveBeenCalledWith(
        "FLOWERS_ABOUT_SERVICE_WORKS",
      );
    });
  });
```

The third test is the one that catches a copy-paste error where both components read the
same flag key — a genuinely easy mistake here, and invisible to the other two tests.

### 5.2 — `src/components/FoodDelivery/__tests__/CateringFeatures.test.tsx`

**Keep the existing `jest.mock("@/components/Logistics/Schedule", ...)` factory.** It is
still needed for the flag-on tests. (This is the opposite of the delete-based plan.)

**Edit A — add the flag mock** directly after that ScheduleDialog mock block (~line 32):

```tsx
jest.mock("@/config/marketing-cta-config", () => ({
  isMarketingCtaEnabled: jest.fn(),
}));

import { isMarketingCtaEnabled } from "@/config/marketing-cta-config";

const mockIsMarketingCtaEnabled = isMarketingCtaEnabled as jest.MockedFunction<
  typeof isMarketingCtaEnabled
>;
```

**Edit B — extend the existing `beforeEach`** in `describe("CateringFeatures", ...)`
(currently `jest.clearAllMocks()`):

```tsx
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsMarketingCtaEnabled.mockReturnValue(false);
  });
```

`clearAllMocks()` wipes the return value, so the `mockReturnValue` **must** come after it.
Getting this order backwards is the most likely way this file goes red.

**Edit C — rewrite `describe("ScheduleDialog Integration", ...)`** (~lines 142–197). Keep
all three existing assertions, but gate them behind the flag and add the off-state test:

```tsx
  describe("ScheduleDialog Integration", () => {
    it("does not render the Get Started button when the flag is off", () => {
      render(<CateringFeatures />);
      expect(
        screen.queryByRole("button", { name: "Get Started" }),
      ).not.toBeInTheDocument();
      expect(screen.queryByTestId("schedule-dialog")).not.toBeInTheDocument();
    });

    it("reads the CATERING_FEATURES_GET_STARTED flag", () => {
      render(<CateringFeatures />);
      expect(mockIsMarketingCtaEnabled).toHaveBeenCalledWith(
        "CATERING_FEATURES_GET_STARTED",
      );
    });

    describe("when the flag is on", () => {
      beforeEach(() => {
        mockIsMarketingCtaEnabled.mockReturnValue(true);
      });

      // ...the three existing tests move in here UNCHANGED:
      //   "renders the Get Started button section"
      //   "renders the ScheduleDialog with correct props"
      //   "renders the custom button within ScheduleDialog"
    });
  });
```

Move the three existing test bodies verbatim — do not rewrite their assertions. The
class-traversal test that walks up looking for `mt-16 flex justify-center` still passes:
the conditional adds no DOM node, so the ancestor chain is unchanged.

**Edit D — fix `it("applies motion props to Get Started button section", ...)`** inside
`describe("Animation and Motion", ...)` (~line 311). It calls
`getByRole("button", { name: "Get Started" })`, which now throws. Add one line at the top
of the test body:

```tsx
    it("applies motion props to Get Started button section", () => {
      mockIsMarketingCtaEnabled.mockReturnValue(true);
      render(<CateringFeatures />);
      // ...rest unchanged
    });
```

**Edit E — leave `import userEvent` alone.** Already unused on `development`; a
pre-existing condition, and touching it widens the diff for no reason.

**Do not touch** the `Component Rendering`, `Feature Cards Grid`, `FeatureCard Component`,
`Accessibility`, or `Responsive Design` blocks — none reference the CTA.

### 5.3 — Optional: a test for the config module

`src/config/__tests__/` exists. A ~15-line test asserting both flags are `false` and that
`isMarketingCtaEnabled` returns them is cheap insurance against someone flipping a value
by accident. **Ask Fer before adding it** — it is a 6th file and the brief says minimal
scope.

---

## 6. 🚫 DO-NOT-TOUCH list

The same two strings appear elsewhere. Different buttons, different sections, **out of scope**:

| File | Line | What it is | Why it stays |
|---|---|---|---|
| `src/components/FoodDelivery/CateringAbout.tsx` | ~140–151 | its own `How Our Service Works` link | Catering *About* section. Not requested; removing it leaves `/catering-deliveries` with no service explainer. |
| `src/components/FlowersDelivery/ServiceFeaturesSection.tsx` | ~297 | its own `ctaLabel="Get Started"` | Flowers *Service Features* section. Not requested. |
| `src/components/VendorLanding/VendorHero.tsx` | — | shares the `More Than Just Delivery` copy | Different page (`/vendor-hero`). |
| `src/lib/feature-flags.ts` + `src/constants/realtime-config.ts` | — | the realtime rollout system | See §1.2. Not extended, not imported, not modified. |
| `src/app/(site)/*/page.tsx` | — | page composition | No component unmounts; only inner JSX changes. |

---

## 7. Verification

**Step 1 — diff discipline.** Exactly 5 files, no more:

```bash
git status --porcelain
git diff --stat
```

Expected: the new `src/config/marketing-cta-config.ts`, plus `FlowersAbout.tsx`,
`FlowersAbout.test.tsx`, `CateringFeatures.tsx`, `CateringFeatures.test.tsx`.
Anything else → stop and revert it.

**Step 2 — the two greps that prove the flag is wired, not the text deleted.**
Both must still return hits:

```bash
grep -n "How Our Service Works" src/components/FlowersDelivery/FlowersAbout.tsx
grep -n "Get Started" src/components/FoodDelivery/CateringFeatures.tsx
```

And each component must reference its own flag key — not the same one twice:

```bash
grep -n "isMarketingCtaEnabled" src/components/FlowersDelivery/FlowersAbout.tsx \
                                src/components/FoodDelivery/CateringFeatures.tsx
```

**Step 3 — targeted tests:**

```bash
pnpm test src/components/FlowersDelivery/__tests__/FlowersAbout.test.tsx
pnpm test src/components/FoodDelivery/__tests__/CateringFeatures.test.tsx
pnpm test src/components/FoodDelivery/__tests__/CateringAbout.test.tsx
pnpm test src/components/FlowersDelivery/__tests__/FlowersServiceFeatures.test.tsx
pnpm test "src/app/(site)/catering-deliveries/__tests__/page.test.tsx"
```

The last three are the **neighbours** — untouched and must stay green. That is the proof
we didn't hit the wrong button.

**Step 4 — gatekeepers:**

```bash
pnpm pre-push-check
pnpm test:ci
```

Known-acceptable baseline noise (pre-existing on `development`, **not** ours):
- 6 TypeScript errors already present on `development`
- the `AddressManager` pagination test failure

Anything *new* beyond those two belongs to this change and must be fixed before pushing.

**Step 5 — visual QA (`pnpm dev`), flag OFF:**

| Route | Expect gone | Expect still there |
|---|---|---|
| `/flowers-deliveries` | yellow pill under the florist photo | stats grid (2019 / 157K+ / 98% / 200+), photo, hero, `Get Started` in Service Features, contact section |
| `/catering-deliveries` | yellow `Get Started` under the 3 cards | `More Than Just Delivery` heading, all 3 cards, `How Our Service Works` in the About section, contact section |

Check at 375px and desktop — the hidden blocks carried `mt-8` / `mt-16`, so confirm nothing
collapses awkwardly against the next section.

**Step 6 — prove the toggle works.** Temporarily flip both flags to `true` in
`marketing-cta-config.ts`, reload both pages, confirm both buttons return *and* the
catering `Get Started` still opens the Google Calendar dialog. **Then flip both back to
`false`** and re-run `git diff` to confirm the config file reads `false` on both lines.

> This step is the whole point of the flag approach. Skipping it ships an untested switch.

---

## 8. Commit & PR

Claude Code stages only; **Fer commits manually** with `gitmoji -c` per house rules.

```bash
git add src/config/marketing-cta-config.ts \
        src/components/FlowersDelivery/FlowersAbout.tsx \
        src/components/FlowersDelivery/__tests__/FlowersAbout.test.tsx \
        src/components/FoodDelivery/CateringFeatures.tsx \
        src/components/FoodDelivery/__tests__/CateringFeatures.test.tsx
# then, manually:
gitmoji -c    # 🚩 add or update feature flags — suggested subject:
              # "gate duplicate flowers and catering CTAs behind marketing flags"
```

PR: `fix/hide-cta-buttons` → `development`. In the description include:
- before/after screenshots of both pages
- the DO-NOT-TOUCH table from §6, so the reviewer can see the near-miss files were
  deliberately left alone
- the §1.2 rationale for not extending `src/lib/feature-flags.ts`, so it reads as a
  decision rather than an oversight

**Decide before opening the PR** whether this plan doc rides along. It is currently
untracked at `docs/plans/hide-cta-buttons.md` — either `git add` it or delete it.

---

## 9. Rollback & re-enable

Two different operations now, which is the advantage over deletion:

- **Re-enable a button (business change):** flip one value to `true` in
  `src/config/marketing-cta-config.ts`, ship. One-line diff, tests already cover it.
- **Revert the whole mechanism (technical change):** `git revert <sha>`. Five files, no
  schema, config, or dependency changes — nothing to un-migrate or re-seed.

---

## 10. Appendix — env-var override (NOT part of this PR)

If these ever need to differ per environment (visible on `development`, hidden on
production), the extension is small — but **do not build it now**:

```ts
// Next.js only inlines NEXT_PUBLIC_* into the client bundle on LITERAL property access.
// process.env[someVariable] returns undefined in the browser. This constraint is already
// documented in src/lib/feature-flags.ts — follow the same literal-access pattern.
const ENV_OVERRIDES: Record<MarketingCtaFlag, string | undefined> = {
  FLOWERS_ABOUT_SERVICE_WORKS:
    process.env.NEXT_PUBLIC_CTA_FLOWERS_ABOUT_SERVICE_WORKS,
  CATERING_FEATURES_GET_STARTED:
    process.env.NEXT_PUBLIC_CTA_CATERING_FEATURES_GET_STARTED,
};

export function isMarketingCtaEnabled(flag: MarketingCtaFlag): boolean {
  const override = ENV_OVERRIDES[flag];
  if (override !== undefined) return override === "true";
  return MARKETING_CTA_FLAGS[flag];
}
```

That would also require `.env.example` entries and Vercel environment configuration on
both `development` and `production` — which is exactly why it is a separate ticket. The
accessor-function signature in §3 was chosen so this change touches only the function
body, never the components or their tests.

---

## Checklist

- [ ] Branch `fix/hide-cta-buttons` created from `origin/development`
- [ ] `src/config/marketing-cta-config.ts` created, both flags `false`
- [ ] `FlowersAbout.tsx` — import, flag read, JSX wrapped
- [ ] `CateringFeatures.tsx` — import, flag read, JSX wrapped
- [ ] `FlowersAbout.test.tsx` — mock, `beforeEach`, CTA Link block rewritten
- [ ] `CateringFeatures.test.tsx` — mock, `beforeEach` order, describe restructured, motion test fixed
- [ ] `git diff --stat` shows exactly 5 files
- [ ] Neighbour test suites still green (CateringAbout, FlowersServiceFeatures, catering page)
- [ ] `pnpm pre-push-check` + `pnpm test:ci` clean apart from the two known baseline issues
- [ ] Visual QA both routes, both breakpoints, flag OFF
- [ ] Toggle proven by flipping both to `true` and back (§7 step 6)
- [ ] Staged with `git add`; commit left to Fer via `gitmoji -c`
