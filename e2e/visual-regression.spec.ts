import { test, expect } from '@playwright/test';

/**
 * Visual Regression Tests for Palette Color Changes
 * 
 * These tests capture screenshots of components affected by the color palette migration
 * from yellow to amber. Run with --update-snapshots to update baseline images after
 * intentional visual changes.
 * 
 * To update snapshots:
 *   pnpm exec playwright test e2e/visual-regression.spec.ts --update-snapshots
 */

test.describe('Visual Regression - Color Palette', () => {
  test.beforeEach(async ({ page }) => {
    // Set consistent viewport for stable screenshots
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test('Newsletter component - Subscribe button colors', async ({ page }) => {
    // Navigate to a page that contains the Newsletter component
    // Adjust the URL based on where Newsletter is displayed
    await page.goto('/');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Find newsletter component (adjust selector based on actual implementation)
    const newsletterSection = page.locator('[data-testid="newsletter"], .newsletter, footer').first();
    
    // Take screenshot of newsletter component
    await expect(newsletterSection).toHaveScreenshot('newsletter-component.png', {
      maxDiffPixels: 100, // Allow small differences for dynamic content
    });
  });

  test('Apply page - Hero section with amber gradient', async ({ page }) => {
    await page.goto('/apply');
    await page.waitForLoadState('networkidle');
    
    // Wait for hero section to be visible
    const heroSection = page.locator('section').first();
    await heroSection.waitFor({ state: 'visible' });
    
    // Take screenshot of hero section
    await expect(heroSection).toHaveScreenshot('apply-page-hero.png', {
      maxDiffPixels: 200,
    });
  });

  test('Apply page - Position cards with amber accents', async ({ page }) => {
    await page.goto('/apply');
    await page.waitForLoadState('networkidle');
    
    // Scroll to positions section
    await page.evaluate(() => {
      const positionsSection = document.getElementById('positions');
      if (positionsSection) {
        positionsSection.scrollIntoView({ behavior: 'instant' });
      }
    });
    
    await page.waitForTimeout(500); // Wait for scroll animation
    
    // Find position cards
    const positionCards = page.locator('[id="positions"]').first();
    
    await expect(positionCards).toHaveScreenshot('apply-page-positions.png', {
      maxDiffPixels: 300,
    });
  });

  test('Apply page - Application form with amber focus states', async ({ page }) => {
    await page.goto('/apply');
    await page.waitForLoadState('networkidle');
    
    // Scroll to form section
    await page.evaluate(() => {
      const formSection = document.getElementById('apply-now');
      if (formSection) {
        formSection.scrollIntoView({ behavior: 'instant' });
      }
    });
    
    await page.waitForTimeout(500);
    
    // Focus on first input to show focus ring
    const firstInput = page.locator('input[type="text"], input[type="email"]').first();
    await firstInput.focus();
    await page.waitForTimeout(200); // Wait for focus animation
    
    // Take screenshot of form with focus state
    const formSection = page.locator('[id="apply-now"]').first();
    await expect(formSection).toHaveScreenshot('apply-page-form-focus.png', {
      maxDiffPixels: 200,
    });
  });

  test('Catering Modal - Amber gradient header and buttons', async ({ page }) => {
    await page.goto('/apply');
    await page.waitForLoadState('networkidle');
    
    // Scroll to positions section
    await page.evaluate(() => {
      const positionsSection = document.getElementById('positions');
      if (positionsSection) {
        positionsSection.scrollIntoView({ behavior: 'instant' });
      }
    });
    
    await page.waitForTimeout(500);
    
    // Click "Learn More" button to open modal
    const learnMoreButton = page.locator('button:has-text("Learn More")').first();
    await learnMoreButton.click();
    
    // Wait for modal to appear
    await page.waitForSelector('[role="dialog"]', { state: 'visible' });
    await page.waitForTimeout(300); // Wait for modal animation
    
    // Take screenshot of modal
    const modal = page.locator('[role="dialog"]').first();
    await expect(modal).toHaveScreenshot('catering-modal.png', {
      maxDiffPixels: 300,
    });
    
    // Close modal
    await page.keyboard.press('Escape');
  });

  test('VA Modal - Amber gradient header and buttons', async ({ page }) => {
    await page.goto('/apply');
    await page.waitForLoadState('networkidle');
    
    // Scroll to positions section
    await page.evaluate(() => {
      const positionsSection = document.getElementById('positions');
      if (positionsSection) {
        positionsSection.scrollIntoView({ behavior: 'instant' });
      }
    });
    
    await page.waitForTimeout(500);
    
    // Click second "Learn More" button (VA position)
    const learnMoreButtons = page.locator('button:has-text("Learn More")');
    await learnMoreButtons.nth(1).click();
    
    // Wait for modal to appear
    await page.waitForSelector('[role="dialog"]', { state: 'visible' });
    await page.waitForTimeout(300);
    
    // Take screenshot of modal
    const modal = page.locator('[role="dialog"]').first();
    await expect(modal).toHaveScreenshot('va-modal.png', {
      maxDiffPixels: 300,
    });
    
    // Close modal
    await page.keyboard.press('Escape');
  });

  test('File Upload component - Amber hover and focus states', async ({ page }) => {
    await page.goto('/apply');
    await page.waitForLoadState('networkidle');
    
    // Scroll to form section
    await page.evaluate(() => {
      const formSection = document.getElementById('apply-now');
      if (formSection) {
        formSection.scrollIntoView({ behavior: 'instant' });
      }
    });
    
    await page.waitForTimeout(500);
    
    // Navigate to Documents step (step 3) where file uploads are
    // This might require clicking through steps or using URL params
    const documentsStep = page.locator('input[type="file"]').first();
    
    if (await documentsStep.isVisible()) {
      // Hover over file input to show hover state
      await documentsStep.hover();
      await page.waitForTimeout(200);
      
      // Take screenshot
      const fileUploadContainer = documentsStep.locator('..').first();
      await expect(fileUploadContainer).toHaveScreenshot('file-upload-hover.png', {
        maxDiffPixels: 150,
      });
    }
  });

  test('Mobile viewport - Apply page responsive design', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/apply');
    await page.waitForLoadState('networkidle');
    
    // Take full page screenshot on mobile
    await expect(page).toHaveScreenshot('apply-page-mobile.png', {
      fullPage: true,
      maxDiffPixels: 500,
    });
  });

  test('Tablet viewport - Apply page responsive design', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    
    await page.goto('/apply');
    await page.waitForLoadState('networkidle');
    
    // Take full page screenshot on tablet
    await expect(page).toHaveScreenshot('apply-page-tablet.png', {
      fullPage: true,
      maxDiffPixels: 500,
    });
  });
});




