import { test, expect } from '@playwright/test';

function collectBrowserErrors(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(`pageerror: ${error.stack || error.message}`));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(`console.error: ${message.text()}`);
  });
  return errors;
}

test('initializes the full lab without browser errors', async ({ page }) => {
  const errors = collectBrowserErrors(page);
  await page.goto('/simulator.html', { waitUntil: 'networkidle' });

  await expect(page.locator('[data-app-version]').first()).toHaveText('v0.8.3');
  await expect(page.locator('#bootError')).toBeHidden();
  await expect(page.locator('#scene canvas')).toHaveCount(1);
  await expect(page.locator('#driverCards .driver')).toHaveCount(4);
  await expect(page.locator('#brainInputCanvas')).toBeVisible();
  await expect(page.locator('#brainLibrary .brain-entry')).toHaveCount(1);
  await expect(page.locator('#storageStatus')).not.toContainText('Starting local storage');

  expect(errors, errors.join('\n\n')).toEqual([]);
});

test('can begin learning and produce experience', async ({ page }) => {
  const errors = collectBrowserErrors(page);
  await page.goto('/simulator.html', { waitUntil: 'networkidle' });

  await page.getByRole('button', { name: /Start learning/ }).click();
  await expect(page.locator('#runBtn')).toContainText('Pause learning');
  await expect.poll(async () => {
    const text = await page.locator('#experienceText').innerText();
    return Number(text.split('/')[0].trim()) || 0;
  }, { timeout: 20_000 }).toBeGreaterThan(0);

  await expect(page.locator('#bootError')).toBeHidden();
  expect(errors, errors.join('\n\n')).toEqual([]);
});
