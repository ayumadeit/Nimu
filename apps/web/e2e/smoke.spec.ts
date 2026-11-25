import { test, expect } from '@playwright/test';

test.describe('Nimu E2E User Journeys & Smoke Suite', () => {
  const timestamp = Date.now();
  const testUser = {
    email: `companion_${timestamp}@nimu.test`,
    password: 'NimuPassword#2026',
    displayName: 'Ayu Companion',
  };

  test('Complete Onboarding & Theme Selection', async ({ page }) => {
    await page.goto('/');

    // Check if on login page and switch to register
    const registerLink = page.getByRole('button', { name: /create an account/i });
    if (await registerLink.isVisible()) {
      await registerLink.click();
    }

    // Fill registration form
    await page.fill('input[type="email"]', testUser.email);
    await page.fill('input[type="password"]', testUser.password);
    await page.click('button:has-text("Create Account")');

    // Land on welcome onboarding
    await expect(page.getByText(/welcome to your quiet space/i)).toBeVisible({ timeout: 10000 });
    // Pick theme and continue
    await page.click('button:has-text("Step inside")');

    // Assert landed on Home Dashboard
    await expect(page.getByText(/Home/i)).toBeVisible();
    await expect(page.getByText(/Recent Notes/i)).toBeVisible();
  });

  test('Create Note and Verify Autosave', async ({ page }) => {
    await page.goto('/#notes');

    // Click new note
    const newNoteBtn = page.getByRole('button', { name: /new note/i });
    await newNoteBtn.click();

    // Type in note title and body
    const titleInput = page.getByPlaceholder(/Untitled Note/i);
    await titleInput.fill(`Test Note ${timestamp}`);

    // Wait for autosave feedback
    await expect(page.getByText(/Safely tucked away/i)).toBeVisible({ timeout: 5000 });
  });

  test('Sticky Board Interaction', async ({ page }) => {
    await page.goto('/#sticky');

    // Click add sticky
    const addStickyBtn = page.getByRole('button', { name: /new note/i });
    if (await addStickyBtn.isVisible()) {
      await addStickyBtn.click();
    }

    // Verify sticky exists
    await expect(page.locator('textarea')).toBeVisible();
  });

  test('Record Expense and Check Dashboard', async ({ page }) => {
    await page.goto('/#finance');

    // Open add transaction modal or form
    const addBtn = page.getByRole('button', { name: /add expense|new transaction/i });
    if (await addBtn.isVisible()) {
      await addBtn.click();

      // Enter details
      await page.fill('input[placeholder*="Description"]', 'Morning Cardamom Chai');
      await page.fill('input[type="number"]', '120');
      await page.click('button:has-text("Save")');
    }

    // Return to dashboard
    await page.goto('/#home');
    await expect(page.getByText(/Morning Cardamom Chai/i)).toBeVisible();
  });

  test('Command Palette (⌘K) Search & Navigation', async ({ page }) => {
    await page.goto('/');

    // Press keyboard shortcut ⌘K or Ctrl+K
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+K' : 'Control+K');

    // Verify command palette opened
    const searchInput = page.getByPlaceholder(/Search notes, stickies, transactions/i);
    await expect(searchInput).toBeVisible();

    // Type query
    await searchInput.fill('Chai');
    await page.keyboard.press('Escape');
    await expect(searchInput).not.toBeVisible();
  });

  test('Data Portability & Export Trigger', async ({ page }) => {
    await page.goto('/#settings');

    // Switch to Data tab
    const dataTab = page.getByRole('button', { name: /Data Portability/i });
    await dataTab.click();

    // Verify export buttons are active
    await expect(page.getByRole('button', { name: /Download Markdown/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Download CSV/i })).toBeVisible();
  });
});
