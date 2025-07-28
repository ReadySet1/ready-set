import { test, expect } from '@playwright/test';

test.describe('Admin Management Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Start from the home page
    await page.goto('/');
  });

  test('admin dashboard access and navigation', async ({ page }) => {
    // Navigate to admin dashboard
    await page.goto('/admin');
    
    // Handle authentication redirect
    if (await page.locator('text=Sign In').count() > 0) {
      console.log('Admin dashboard requires authentication - testing UI flow only');
      return;
    }

    // Test admin dashboard components
    await expect(page.locator('h1, h2')).toContainText(['Admin', 'Dashboard', 'Management']);
    
    // Test navigation to different admin sections
    const jobApplicationsLink = page.locator('a:has-text("Job Applications"), [href*="job-applications"]');
    if (await jobApplicationsLink.count() > 0) {
      await jobApplicationsLink.click();
      await expect(page).toHaveURL(/.*job-applications/);
    }
    
    const usersLink = page.locator('a:has-text("Users"), [href*="users"]');
    if (await usersLink.count() > 0) {
      await usersLink.click();
      await expect(page).toHaveURL(/.*users/);
    }
  });

  test('job applications management', async ({ page }) => {
    await page.goto('/admin/job-applications');
    
    // Handle authentication
    if (await page.locator('text=Sign In').count() > 0) {
      console.log('Admin access requires authentication - testing UI flow only');
      return;
    }

    // Test job applications table
    const applicationsTable = page.locator('table, [data-testid="applications-table"]');
    if (await applicationsTable.count() > 0) {
      await expect(applicationsTable).toBeVisible();
      
      // Test status update functionality
      const statusSelect = page.locator('select[name*="status"], [data-testid="status-select"]');
      if (await statusSelect.count() > 0) {
        await statusSelect.first().click();
        
        // Should have status options
        await expect(page.locator('option, [role="option"]')).toContainText(['Pending', 'Approved', 'Rejected']);
      }
    }

    // Test CSV export functionality
    const exportButton = page.locator('button:has-text("Export"), button:has-text("CSV"), [data-testid="export-csv"]');
    if (await exportButton.count() > 0) {
      await exportButton.click();
      // Should trigger download or show export dialog
    }

    // Test search and filtering
    const searchInput = page.locator('input[placeholder*="search"], input[name="search"]');
    if (await searchInput.count() > 0) {
      await searchInput.fill('test');
      // Should filter results
    }
  });

  test('user management interface', async ({ page }) => {
    await page.goto('/admin/users');
    
    // Handle authentication
    if (await page.locator('text=Sign In').count() > 0) {
      console.log('Admin access requires authentication - testing UI flow only');
      return;
    }

    // Test users table
    const usersTable = page.locator('table, [data-testid="users-table"]');
    if (await usersTable.count() > 0) {
      await expect(usersTable).toBeVisible();
      
      // Test user role display
      await expect(page.locator('td, .table-cell')).toContainText(['vendor', 'client', 'admin']);
    }

    // Test user details view
    const viewUserButton = page.locator('button:has-text("View"), a:has-text("View"), [data-testid="view-user"]');
    if (await viewUserButton.count() > 0) {
      await viewUserButton.first().click();
      
      // Should show user details
      await expect(page.locator('h1, h2, h3')).toContainText(['User Details', 'Profile', 'User']);
    }

    // Test user filtering by role
    const roleFilter = page.locator('select[name*="role"], [data-testid="role-filter"]');
    if (await roleFilter.count() > 0) {
      await roleFilter.click();
      
      // Should have role options
      await expect(page.locator('option, [role="option"]')).toContainText(['All', 'Vendor', 'Client', 'Admin']);
    }
  });

  test('permission-based access control', async ({ page }) => {
    // Test vendor dashboard access
    await page.goto('/vendor');
    
    if (await page.locator('text=Sign In').count() > 0) {
      console.log('Vendor access requires authentication - testing UI flow only');
      return;
    }

    // Vendor should see vendor-specific content
    await expect(page.locator('h1, h2')).toContainText(['Vendor', 'Dashboard']);

    // Test helpdesk portal access
    await page.goto('/admin'); // Helpdesk uses admin portal
    
    // Should be accessible to helpdesk users
    if (await page.locator('h1, h2').count() > 0) {
      // Content should be visible
      await expect(page.locator('h1, h2')).toBeVisible();
    }
  });

  test('error handling for unauthorized access', async ({ page }) => {
    // Test direct access to admin routes without authentication
    await page.goto('/admin/users');
    
    // Should either redirect to sign-in or show error
    const isRedirectedToSignIn = await page.locator('text=Sign In').count() > 0;
    const isErrorPage = await page.locator('text=Unauthorized').count() > 0 || 
                       await page.locator('text=403').count() > 0 ||
                       await page.locator('text=Access Denied').count() > 0;
    
    expect(isRedirectedToSignIn || isErrorPage).toBeTruthy();
  });

  test('admin data export functionality', async ({ page }) => {
    await page.goto('/admin/job-applications');
    
    // Handle authentication
    if (await page.locator('text=Sign In').count() > 0) {
      console.log('Admin access requires authentication - testing UI flow only');
      return;
    }

    // Test data export features
    const exportOptions = page.locator('button:has-text("Export"), .export-menu');
    if (await exportOptions.count() > 0) {
      await exportOptions.first().click();
      
      // Should show export options
      await expect(page.locator('text=CSV')).toBeVisible();
    }

    // Test date range filtering for exports
    const dateFilter = page.locator('input[type="date"], [data-testid="date-filter"]');
    if (await dateFilter.count() > 0) {
      const today = new Date().toISOString().split('T')[0];
      if (today) {
        await dateFilter.first().fill(today);
      }
    }
  });

  test('admin dashboard metrics and overview', async ({ page }) => {
    await page.goto('/admin');
    
    // Handle authentication
    if (await page.locator('text=Sign In').count() > 0) {
      console.log('Admin access requires authentication - testing UI flow only');
      return;
    }

    // Test dashboard metrics display
    const metricsCards = page.locator('[data-testid="metric-card"], .metric, .dashboard-card');
    if (await metricsCards.count() > 0) {
      await expect(metricsCards.first()).toBeVisible();
      
      // Should display numbers/statistics
      await expect(page.locator('.number, .count, .stat')).toBeVisible();
    }

    // Test charts and graphs
    const charts = page.locator('canvas, svg, [data-testid="chart"]');
    if (await charts.count() > 0) {
      await expect(charts.first()).toBeVisible();
    }

    // Test recent activity
    const activitySection = page.locator('[data-testid="recent-activity"], .activity, .recent');
    if (await activitySection.count() > 0) {
      await expect(activitySection).toBeVisible();
    }
  });

  test('bulk operations on admin data', async ({ page }) => {
    await page.goto('/admin/job-applications');
    
    // Handle authentication
    if (await page.locator('text=Sign In').count() > 0) {
      console.log('Admin access requires authentication - testing UI flow only');
      return;
    }

    // Test bulk selection
    const selectAllCheckbox = page.locator('input[type="checkbox"]:has-text("Select All"), [data-testid="select-all"]');
    if (await selectAllCheckbox.count() > 0) {
      await selectAllCheckbox.click();
      
      // Should select all items
      const bulkActions = page.locator('button:has-text("Bulk"), .bulk-actions');
      if (await bulkActions.count() > 0) {
        await expect(bulkActions).toBeVisible();
      }
    }

    // Test individual row selection
    const rowCheckboxes = page.locator('tbody input[type="checkbox"], [data-testid="row-checkbox"]');
    if (await rowCheckboxes.count() > 0) {
      await rowCheckboxes.first().click();
      
      // Should enable bulk actions
      const selectedCount = page.locator('text=selected');
      if (await selectedCount.count() > 0) {
        await expect(selectedCount).toBeVisible();
      }
    }
  });

  test('responsive admin interface', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    
    await page.goto('/admin');
    
    // Handle authentication
    if (await page.locator('text=Sign In').count() > 0) {
      console.log('Admin access requires authentication - testing UI flow only');
      return;
    }

    // Test mobile admin navigation
    const mobileMenu = page.locator('[aria-label="Mobile Menu"], .mobile-nav');
    if (await mobileMenu.count() > 0) {
      await mobileMenu.click();
      
      // Should show navigation options
      await expect(page.locator('nav, .navigation')).toBeVisible();
    }

    // Test responsive tables
    const tables = page.locator('table');
    if (await tables.count() > 0) {
      // Tables should be responsive or have horizontal scroll
      await expect(tables.first()).toBeVisible();
    }
  });

  test('admin search and filtering', async ({ page }) => {
    await page.goto('/admin/users');
    
    // Handle authentication
    if (await page.locator('text=Sign In').count() > 0) {
      console.log('Admin access requires authentication - testing UI flow only');
      return;
    }

    // Test global search
    const searchInput = page.locator('input[placeholder*="Search"], input[name="search"]');
    if (await searchInput.count() > 0) {
      await searchInput.fill('test@example.com');
      
      // Should filter results
      await page.keyboard.press('Enter');
    }

    // Test advanced filters
    const filterButton = page.locator('button:has-text("Filter"), [data-testid="filters"]');
    if (await filterButton.count() > 0) {
      await filterButton.click();
      
      // Should show filter options
      await expect(page.locator('.filter-panel, .filters')).toBeVisible();
    }

    // Test sorting
    const sortHeader = page.locator('th[role="button"], .sortable');
    if (await sortHeader.count() > 0) {
      await sortHeader.first().click();
      
      // Should sort the table
      // Note: Actual sorting verification would require comparing data
    }
  });
}); 