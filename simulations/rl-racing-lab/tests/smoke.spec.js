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

  await expect(page.locator('[data-app-version]').first()).toHaveText('v1.2.3');
  await expect(page.locator('#bootError')).toBeHidden();
  await expect(page.locator('#scene canvas')).toHaveCount(1);
  await expect(page.locator('#visionChip')).toContainText('40×16');
  await expect(page.locator('#brainChip')).toContainText('651→48→15');
  await expect(page.locator('#vehicleSpeedText')).toContainText('km/h');
  await expect(page.locator('#slipText')).toContainText('°');
  await expect(page.locator('#driverCards .driver')).toHaveCount(1);
  await expect(page.locator('#driverCards .driver-pov').first()).toHaveAttribute('width','40');
  await expect(page.locator('#driverCards .driver-pov').first()).toHaveAttribute('height','16');
  await expect(page.locator('#brainInputCanvas')).toBeVisible();
  await expect(page.locator('#brainLibrary .brain-entry')).toHaveCount(1);
  await expect(page.locator('#storageStatus')).not.toContainText('Starting local storage');
  await expect(page.locator('#avgLapTime')).toHaveText('—');
  await expect(page.locator('#bestLapTime')).toHaveText('—');
  await expect(page.locator('#lapTimeChart')).toBeVisible();

  await expect(page.locator('#trainingCarCount')).toHaveValue('1');
  await expect(page.locator('#resetMode')).toHaveValue('never');
  await expect(page.locator('#trainingStaggered')).toBeChecked();
  await expect(page.locator('#trainingCarCollisions')).not.toBeChecked();
  await expect(page.locator('#trackMirror')).not.toBeChecked();
  await expect(page.locator('#autoTrackSwitch')).not.toBeChecked();

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
test('can configure parallel learners and mirrored training', async ({ page }) => {
  const errors = collectBrowserErrors(page);
  await page.goto('/simulator.html', { waitUntil: 'networkidle' });
  await page.locator('#trainingCarCount').selectOption('6');
  await expect(page.locator('#driverCards .driver')).toHaveCount(6);
  await page.locator('#trackMirror').check();
  await expect(page.locator('#trackText')).toContainText('mirrored');
  await page.locator('#trainingCarCollisions').check();
  await expect(page.locator('#trainingCarCollisions')).toBeChecked();
  await expect(page.locator('#bootError')).toBeHidden();
  expect(errors, errors.join('\n\n')).toEqual([]);
});

