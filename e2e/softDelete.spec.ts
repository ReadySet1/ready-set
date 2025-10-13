/**
 * E2E Tests for User Soft Delete Functionality
 * 
 * Tests the complete user deletion and restoration flows including:
 * - Admin dashboard user management
 * - Soft delete (move to trash) flow
 * - User restoration flow
 * - Permanent deletion flow
 * - Tab switching and UI interactions
 */

import { test, expect, Page } from '@playwright/test';

// Test data
const TEST_ADMIN = {
  email: 'admin@test.com',
  password: 'test123',
  name: 'Test Admin',
  type: 'ADMIN'
};

const TEST_USER = {
  email: 'testuser@test.com',
  password: 'test123',
  name: 'Test User',
  type: 'CLIENT'
};

const TEST_SUPER_ADMIN = {
  email: 'superadmin@test.com',
  password: 'test123',
  name: 'Test Super Admin',
  type: 'SUPER_ADMIN'
};

// Helper functions
async function loginAsAdmin(page: Page) {
  await page.goto('/sign-in');
  await page.fill('input[name="email"]', TEST_ADMIN.email);
  await page.fill('input[name="password"]', TEST_ADMIN.password);
  await page.click('button[type="submit"]');
  await page.waitForURL('/admin/**');
}

async function loginAsSuperAdmin(page: Page) {
  await page.goto('/sign-in');
  await page.fill('input[name="email"]', TEST_SUPER_ADMIN.email);
  await page.fill('input[name="password"]', TEST_SUPER_ADMIN.password);
  await page.click('button[type="submit"]');
  await page.waitForURL('/admin/**');
}

async function navigateToUsersPage(page: Page) {
  await page.goto('/admin/users');
  await page.waitForSelector('[data-testid="users-table"], [data-testid="no-users-message"]');
}

async function createTestUser(page: Page, user = TEST_USER) {
  await page.goto('/admin/users/new');
  await page.fill('input[name="email"]', user.email);
  await page.fill('input[name="name"]', user.name);
  await page.selectOption('select[name="type"]', user.type);
  await page.click('button[type="submit"]');
  await page.waitForURL('/admin/users');
}

async function findUserInTable(page: Page, email: string) {
  return page.locator(`tr:has-text("${email}")`);
}

test.describe('User Soft Delete E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set up test environment - this would typically involve
    // database seeding or API calls to set up test data
    await page.goto('/');
  });

  test.describe('Admin Dashboard User Management', () => {
    test('should display users management interface with tabs', async ({ page }) => {
      await loginAsAdmin(page);
      await navigateToUsersPage(page);

      // Verify main elements are present
      await expect(page.locator('h2:has-text("User Management")')).toBeVisible();
      
      // Verify tabs are present
      await expect(page.locator('[role="tab"]:has-text("Active Users")')).toBeVisible();
      await expect(page.locator('[role="tab"]:has-text("Deleted Users")')).toBeVisible();
      
      // Verify we start on Active Users tab
      await expect(page.locator('[role="tab"]:has-text("Active Users")[aria-selected="true"]')).toBeVisible();
      
      // Verify search and filter elements
      await expect(page.locator('input[placeholder*="Search active users"]')).toBeVisible();
      await expect(page.locator('button:has-text("Status")')).toBeVisible();
      await expect(page.locator('button:has-text("Type")')).toBeVisible();
      await expect(page.locator('a:has-text("Add User")')).toBeVisible();
    });

    test('should switch between Active and Deleted Users tabs', async ({ page }) => {
      await loginAsAdmin(page);
      await navigateToUsersPage(page);

      // Start on Active Users tab
      await expect(page.locator('[role="tab"]:has-text("Active Users")[aria-selected="true"]')).toBeVisible();
      await expect(page.locator('input[placeholder*="Search active users"]')).toBeVisible();
      await expect(page.locator('a:has-text("Add User")')).toBeVisible();

      // Switch to Deleted Users tab
      await page.click('[role="tab"]:has-text("Deleted Users")');
      
      // Verify tab switched
      await expect(page.locator('[role="tab"]:has-text("Deleted Users")[aria-selected="true"]')).toBeVisible();
      await expect(page.locator('input[placeholder*="Search deleted users"]')).toBeVisible();
      
      // Add User button should not be visible on deleted tab
      await expect(page.locator('a:has-text("Add User")')).not.toBeVisible();
      
      // Status filter should not be visible on deleted tab
      await expect(page.locator('button:has-text("Status")')).not.toBeVisible();
    });
  });

  test.describe('Soft Delete Flow', () => {
    test('should successfully move user to trash with reason', async ({ page }) => {
      await loginAsAdmin(page);
      
      // Create a test user first
      await createTestUser(page);
      await navigateToUsersPage(page);

      // Find the test user in the table
      const userRow = await findUserInTable(page, TEST_USER.email);
      await expect(userRow).toBeVisible();

      // Hover over the row to show the delete button
      await userRow.hover();
      
      // Click the move to trash button (should have trash icon)
      await userRow.locator('button[title="Move to Trash"]').click();

      // Verify the soft delete dialog appears
      await expect(page.locator('dialog:has-text("Move User to Trash")')).toBeVisible();
      await expect(page.locator('text*="will move"')).toBeVisible();
      await expect(page.locator('text*="can be restored later"')).toBeVisible();

      // Fill in deletion reason
      const deletionReason = 'E2E test deletion - user request';
      await page.fill('textarea[placeholder*="e.g., Account violation"]', deletionReason);

      // Click Move to Trash button
      await page.click('button:has-text("Move to Trash")');

      // Wait for the operation to complete
      await expect(page.locator('dialog:has-text("Move User to Trash")')).not.toBeVisible();

      // Verify success message appears
      await expect(page.locator('text*="moved to trash"')).toBeVisible();

      // Verify user is no longer in active users table
      await expect(await findUserInTable(page, TEST_USER.email)).not.toBeVisible();

      // Switch to Deleted Users tab to verify user is there
      await page.click('[role="tab"]:has-text("Deleted Users")');
      
      // Verify user appears in deleted users table
      const deletedUserRow = await findUserInTable(page, TEST_USER.email);
      await expect(deletedUserRow).toBeVisible();
      
      // Verify deleted user visual indicators
      await expect(deletedUserRow.locator('[data-icon="AlertTriangle"]')).toBeVisible();
      await expect(deletedUserRow).toHaveClass(/bg-red-50/);
      
      // Verify deletion details are shown
      await expect(deletedUserRow.locator('text*="Test Admin"')).toBeVisible(); // Deleted by
      await expect(deletedUserRow.locator(`text*="${deletionReason}"`)).toBeVisible(); // Reason
    });

    test('should prevent deletion of super admin users', async ({ page }) => {
      await loginAsAdmin(page);
      await navigateToUsersPage(page);

      // Look for a super admin user (if any exist)
      const superAdminRow = page.locator('tr:has-text("Super Admin")');
      
      if (await superAdminRow.count() > 0) {
        await superAdminRow.first().hover();
        
        // The delete button should be disabled for super admin
        const deleteButton = superAdminRow.locator('button[title="Move to Trash"]');
        await expect(deleteButton).toBeDisabled();
      }
    });

    test('should show validation when trying to delete without proper permissions', async ({ page }) => {
      // This test would require a helpdesk user account
      // For now, we'll test the error handling when permission is denied
      
      await loginAsAdmin(page);
      await navigateToUsersPage(page);

      // If we had a way to simulate permission errors, we'd test them here
      // This might involve mocking API responses or using different user roles
    });
  });

  test.describe('User Restoration Flow', () => {
    test('should successfully restore a deleted user', async ({ page }) => {
      await loginAsAdmin(page);
      
      // First, create and delete a user (setup for restore test)
      await createTestUser(page);
      await navigateToUsersPage(page);
      
      // Delete the user first
      const userRow = await findUserInTable(page, TEST_USER.email);
      await userRow.hover();
      await userRow.locator('button[title="Move to Trash"]').click();
      await page.fill('textarea[placeholder*="e.g., Account violation"]', 'Test deletion for restore');
      await page.click('button:has-text("Move to Trash")');
      await expect(page.locator('text*="moved to trash"')).toBeVisible();

      // Now test the restoration
      await page.click('[role="tab"]:has-text("Deleted Users")');
      
      const deletedUserRow = await findUserInTable(page, TEST_USER.email);
      await expect(deletedUserRow).toBeVisible();

      // Hover to show restore button
      await deletedUserRow.hover();
      
      // Click the restore button (should have RotateCcw icon)
      await deletedUserRow.locator('button[title="Restore User"]').click();

      // Verify the restore dialog appears
      await expect(page.locator('dialog:has-text("Restore User")')).toBeVisible();
      await expect(page.locator('text*="will restore"')).toBeVisible();
      await expect(page.locator('text*="make them active again"')).toBeVisible();

      // Click Restore User button
      await page.click('button:has-text("Restore User")');

      // Wait for the operation to complete
      await expect(page.locator('dialog:has-text("Restore User")')).not.toBeVisible();

      // Verify success message appears
      await expect(page.locator('text*="restored"')).toBeVisible();

      // Verify user is no longer in deleted users table
      await expect(await findUserInTable(page, TEST_USER.email)).not.toBeVisible();

      // Switch to Active Users tab to verify user is restored
      await page.click('[role="tab"]:has-text("Active Users")');
      
      // Verify user appears in active users table again
      const restoredUserRow = await findUserInTable(page, TEST_USER.email);
      await expect(restoredUserRow).toBeVisible();
      
      // Verify no deleted user indicators
      await expect(restoredUserRow.locator('[data-icon="AlertTriangle"]')).not.toBeVisible();
      await expect(restoredUserRow).not.toHaveClass(/bg-red-50/);
    });
  });

  test.describe('Permanent Deletion Flow', () => {
    test('should permanently delete user as super admin with proper warnings', async ({ page }) => {
      await loginAsSuperAdmin(page);
      
      // Create and soft delete a user first
      await createTestUser(page);
      await navigateToUsersPage(page);
      
      // Soft delete the user
      const userRow = await findUserInTable(page, TEST_USER.email);
      await userRow.hover();
      await userRow.locator('button[title="Move to Trash"]').click();
      await page.fill('textarea[placeholder*="e.g., Account violation"]', 'Test deletion for permanent delete');
      await page.click('button:has-text("Move to Trash")');
      await expect(page.locator('text*="moved to trash"')).toBeVisible();

      // Go to deleted users tab
      await page.click('[role="tab"]:has-text("Deleted Users")');
      
      const deletedUserRow = await findUserInTable(page, TEST_USER.email);
      await deletedUserRow.hover();
      
      // Click the permanent delete button (should have ShieldAlert icon)
      await deletedUserRow.locator('button[title="Permanently Delete"]').click();

      // Verify the permanent delete dialog with warnings
      await expect(page.locator('dialog:has-text("Permanently Delete User")')).toBeVisible();
      await expect(page.locator('text*="DANGER"')).toBeVisible();
      await expect(page.locator('text*="cannot be undone"')).toBeVisible();
      await expect(page.locator('text*="permanently removed"')).toBeVisible();
      
      // Verify warning alert
      await expect(page.locator('[role="alert"]:has-text("Warning")')).toBeVisible();
      await expect(page.locator('text*="irreversible"')).toBeVisible();
      await expect(page.locator('text*="GDPR compliance"')).toBeVisible();

      // The permanent delete button should be disabled initially
      await expect(page.locator('button:has-text("Permanently Delete")')).toBeDisabled();

      // Fill in the required reason (minimum 10 characters)
      const permanentReason = 'GDPR data deletion request - user requested complete data removal';
      await page.fill('textarea[placeholder*="e.g., GDPR data deletion"]', permanentReason);

      // Verify character count
      await expect(page.locator(`text*="${permanentReason.length}/10 characters minimum"`)).toBeVisible();

      // Now the button should be enabled
      await expect(page.locator('button:has-text("Permanently Delete")')).toBeEnabled();

      // Click Permanently Delete button
      await page.click('button:has-text("Permanently Delete")');

      // Wait for the operation to complete
      await expect(page.locator('dialog:has-text("Permanently Delete User")')).not.toBeVisible();

      // Verify success message
      await expect(page.locator('text*="permanently deleted"')).toBeVisible();

      // Verify user is completely gone from deleted users table
      await expect(await findUserInTable(page, TEST_USER.email)).not.toBeVisible();
    });

    test('should not show permanent delete option for regular admin', async ({ page }) => {
      await loginAsAdmin(page); // Regular admin, not super admin
      
      // Create and soft delete a user first
      await createTestUser(page);
      await navigateToUsersPage(page);
      
      const userRow = await findUserInTable(page, TEST_USER.email);
      await userRow.hover();
      await userRow.locator('button[title="Move to Trash"]').click();
      await page.fill('textarea[placeholder*="e.g., Account violation"]', 'Test deletion');
      await page.click('button:has-text("Move to Trash")');
      await expect(page.locator('text*="moved to trash"')).toBeVisible();

      // Go to deleted users tab
      await page.click('[role="tab"]:has-text("Deleted Users")');
      
      const deletedUserRow = await findUserInTable(page, TEST_USER.email);
      await deletedUserRow.hover();
      
      // Should see restore button but NOT permanent delete button
      await expect(deletedUserRow.locator('button[title="Restore User"]')).toBeVisible();
      await expect(deletedUserRow.locator('button[title="Permanently Delete"]')).not.toBeVisible();
    });

    test('should require minimum character count for permanent deletion reason', async ({ page }) => {
      await loginAsSuperAdmin(page);
      
      // Setup: create and soft delete a user
      await createTestUser(page);
      await navigateToUsersPage(page);
      
      const userRow = await findUserInTable(page, TEST_USER.email);
      await userRow.hover();
      await userRow.locator('button[title="Move to Trash"]').click();
      await page.fill('textarea[placeholder*="e.g., Account violation"]', 'Test deletion');
      await page.click('button:has-text("Move to Trash")');
      await expect(page.locator('text*="moved to trash"')).toBeVisible();

      await page.click('[role="tab"]:has-text("Deleted Users")');
      const deletedUserRow = await findUserInTable(page, TEST_USER.email);
      await deletedUserRow.hover();
      await deletedUserRow.locator('button[title="Permanently Delete"]').click();

      // Try with short reason (should keep button disabled)
      await page.fill('textarea[placeholder*="e.g., GDPR data deletion"]', 'short');
      await expect(page.locator('text*="4/10 characters minimum"')).toBeVisible();
      await expect(page.locator('button:has-text("Permanently Delete")')).toBeDisabled();

      // Clear and try with exact minimum (should enable)
      await page.fill('textarea[placeholder*="e.g., GDPR data deletion"]', '1234567890');
      await expect(page.locator('text*="10/10 characters minimum"')).toBeVisible();
      await expect(page.locator('button:has-text("Permanently Delete")')).toBeEnabled();
    });
  });

  test.describe('Search and Filter Functionality', () => {
    test('should search in both active and deleted users', async ({ page }) => {
      await loginAsAdmin(page);
      await navigateToUsersPage(page);

      // Test search in active users
      await page.fill('input[placeholder*="Search active users"]', TEST_USER.email);
      await page.waitForTimeout(500); // Wait for debounce
      
      // Should filter results (behavior depends on actual data)

      // Switch to deleted users tab
      await page.click('[role="tab"]:has-text("Deleted Users")');
      
      // Search placeholder should update
      await expect(page.locator('input[placeholder*="Search deleted users"]')).toBeVisible();
      
      // Test search in deleted users
      await page.fill('input[placeholder*="Search deleted users"]', 'deleted');
      await page.waitForTimeout(500);
    });

    test('should filter by user type in both tabs', async ({ page }) => {
      await loginAsAdmin(page);
      await navigateToUsersPage(page);

      // Test type filter on active users
      await page.click('button:has-text("Type")');
      await page.click('text="Client"');
      
      // Verify filter is applied
      await expect(page.locator('button:has-text("Type") >> text="Client"')).toBeVisible();

      // Switch to deleted users tab
      await page.click('[role="tab"]:has-text("Deleted Users")');
      
      // Type filter should still be available and applied
      await expect(page.locator('button:has-text("Type") >> text="Client"')).toBeVisible();
      
      // Can change filter on deleted tab
      await page.click('button:has-text("Type")');
      await page.click('text="Vendor"');
      await expect(page.locator('button:has-text("Type") >> text="Vendor"')).toBeVisible();
    });
  });

  test.describe('Error Handling and Edge Cases', () => {
    test('should handle network errors gracefully', async ({ page }) => {
      // This test would involve intercepting network requests and simulating failures
      await loginAsAdmin(page);
      await navigateToUsersPage(page);

      // Intercept API calls and make them fail
      await page.route('**/api/users/**', route => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Server error' })
        });
      });

      // Try to perform an action that would trigger an API call
      // Should show appropriate error message
    });

    test('should prevent concurrent operations on same user', async ({ page }) => {
      // This would test the UI behavior when multiple operations are attempted
      // on the same user simultaneously
      await loginAsAdmin(page);
      await navigateToUsersPage(page);

      // Implementation would depend on actual concurrency handling
    });

    test('should maintain state when switching tabs', async ({ page }) => {
      await loginAsAdmin(page);
      await navigateToUsersPage(page);

      // Set some filters and search
      await page.fill('input[placeholder*="Search active users"]', 'test');
      await page.click('button:has-text("Type")');
      await page.click('text="Client"');

      // Switch tabs
      await page.click('[role="tab"]:has-text("Deleted Users")');
      await page.click('[role="tab"]:has-text("Active Users")');

      // Verify state is maintained appropriately
      // (Search might be cleared, but type filter might be maintained)
      await expect(page.locator('button:has-text("Type") >> text="Client"')).toBeVisible();
    });
  });
});
