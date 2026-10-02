/**
 * Flowers Landing Page E2E Tests
 *
 * Tests for the public-facing floral delivery landing page at /flowers-deliveries
 *
 * This page:
 * - Does NOT require authentication
 * - Displays hero section, service features, about section, setup carousel, and contact form
 * - Contains CTA buttons for getting quotes and booking calls
 */

import { test, expect } from '@playwright/test';
import { isMarketingCtaEnabled } from '../src/config/marketing-cta-config';

test.describe('Flowers Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/flowers-deliveries');
    await page.waitForLoadState('domcontentloaded');
  });

  test('1. Page loads successfully', async ({ page }) => {
    // Title changed to "Flower Delivery Services" in the SEO pass (8bdb97e9).
    await expect(page).toHaveTitle(/Flower Delivery Services/i);
  });

  test.describe('FlowerHero Section', () => {
    test('2. Renders hero heading', async ({ page }) => {
      await expect(
        page.locator('h1:has-text("Your Go-To Flower")')
      ).toBeVisible();
    });

    test('3. Renders delivery count metric', async ({ page }) => {
      await expect(
        page.locator('text=157,000+ Floral Deliveries Completed')
      ).toBeVisible();
    });

    test('4. Renders Get a Quote button', async ({ page }) => {
      await expect(
        page.locator('button:has-text("Get a Quote")')
      ).toBeVisible();
    });

    test('5. Renders Book a Call button', async ({ page }) => {
      await expect(
        page.locator('button:has-text("Book a Call")')
      ).toBeVisible();
    });

    test('6. Renders hero image', async ({ page }) => {
      await expect(
        page.locator(
          'img[alt="Flower delivery driver handing a bouquet to a customer"]'
        )
      ).toBeVisible();
    });
  });

  test.describe('FlowersServiceFeatures Section', () => {
    test('7. Renders section title', async ({ page }) => {
      await expect(
        page.locator('text=More Than Just Delivery')
      ).toBeVisible();
    });

    test('8. Renders all three feature cards', async ({ page }) => {
      await expect(page.locator('text=Bulk Orders?')).toBeVisible();
      await expect(page.locator('text=Hands-On Support')).toBeVisible();
      await expect(
        page.locator('text=Personalized Delivery Service')
      ).toBeVisible();
    });

    test('9. Renders Get Started CTA button', async ({ page }) => {
      await expect(
        page.locator('button:has-text("Get Started")')
      ).toBeVisible();
    });
  });

  test.describe('FlowersAbout Section', () => {
    test('10. Renders about heading', async ({ page }) => {
      await expect(
        page.locator('h2:has-text("Keep Every Bouquet")')
      ).toBeVisible();
    });

    test('11. Renders stats grid', async ({ page }) => {
      // Exact match: the hero also says "157,000+ Floral Deliveries Completed".
      for (const label of [
        'Founded',
        'Deliveries Completed',
        'On-Time Delivery Rate',
        'Professional Drivers',
      ]) {
        await expect(page.getByText(label, { exact: true })).toBeVisible();
      }
    });

    test('12. "How Our Service Works" link follows the marketing CTA flag', async ({ page }) => {
      const serviceWorksLink = page.locator('a:has-text("How Our Service Works")');

      if (isMarketingCtaEnabled('FLOWERS_ABOUT_SERVICE_WORKS')) {
        await expect(serviceWorksLink.first()).toBeVisible();
      } else {
        // Absent from the DOM entirely — the flag short-circuits the render,
        // it does not merely hide the element with CSS.
        await expect(serviceWorksLink).toHaveCount(0);
      }
    });
  });

  test.describe('FlowersSetupCarousel Section', () => {
    test('13. Renders carousel with flower images', async ({ page }) => {
      const carouselImages = page.locator(
        'img[alt^="Flower arrangement"]'
      );
      await expect(carouselImages.first()).toBeVisible();
    });
  });

  test.describe('CateringContact Section', () => {
    test('14. Renders contact form heading', async ({ page }) => {
      await expect(
        page.locator('h2:has-text("Send us a message")')
      ).toBeVisible();
    });

    test('15. Renders all contact form fields', async ({ page }) => {
      await expect(page.locator('input#name')).toBeVisible();
      await expect(page.locator('input#email')).toBeVisible();
      await expect(page.locator('input#phone')).toBeVisible();
      await expect(page.locator('input#company')).toBeVisible();
      await expect(page.locator('textarea#message')).toBeVisible();
    });

    test('16. Renders submit button', async ({ page }) => {
      await expect(
        page.locator('button[type="submit"]:has-text("Submit")')
      ).toBeVisible();
    });

    test('17. Renders Partner With Us button', async ({ page }) => {
      await expect(
        page.locator('button:has-text("Partner With Us")')
      ).toBeVisible();
    });
  });
});
