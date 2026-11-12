import { test, expect } from '@playwright/test'

test('opens the spreadsheet workspace and switches to SQL Studio', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('DataForge', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'sales_data.csv', exact: true })).toBeVisible()
  await page.getByRole('button', { name: /SQL Studio/ }).click()
  await expect(page.getByText('SQL Studio', { exact: true })).toBeVisible()
})

test('opens the data cleaning actions', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Clean data' }).click()
  await expect(page.getByRole('button', { name: 'Remove duplicate rows' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Replay pipeline (0)' })).toBeVisible()
})

test('runs full SQL in the browser engine', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /SQL Studio/ }).click()
  await page.locator('textarea').fill('SELECT region, COUNT(*) AS orders FROM sales GROUP BY region ORDER BY orders DESC')
  await page.getByRole('button', { name: /Run query/ }).click()
  await expect(page.locator('.results-head span')).toContainText('rows returned', { timeout: 30_000 })
})

test('renders flexible chart views', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Chart', exact: true }).click()
  await expect(page.getByText('Chart builder', { exact: true })).toBeVisible()
  const view = page.locator('.chart-controls select').nth(2)
  await view.selectOption('line')
  await expect(page.locator('.chart-line')).toBeVisible()
  await view.selectOption('pie')
  await expect(page.locator('.chart-pie')).toBeVisible()
})

test('joins multiple workspace tabs in browser SQL', async ({ page }) => {
  await page.goto('/')
  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles({ name: 'customers.csv', mimeType: 'text/csv', buffer: Buffer.from('customer_id,segment\n1,VIP\n2,New') })
  await expect(page.getByRole('button', { name: 'customers.csv', exact: true })).toBeVisible()
  await page.locator('.add-tab').click()
  await fileInput.setInputFiles({ name: 'orders.csv', mimeType: 'text/csv', buffer: Buffer.from('order_id,customer_id,total\nA-1,1,100\nA-2,2,200') })
  await page.getByRole('button', { name: /SQL Studio/ }).click()
  await page.locator('textarea').fill('SELECT sales.order_id, customers.segment FROM sales JOIN customers ON sales.customer_id = customers.customer_id ORDER BY sales.order_id')
  await page.getByRole('button', { name: /Run query/ }).click()
  await expect(page.locator('.results-head span')).toContainText('2 rows returned', { timeout: 30_000 })
})

test('replays a transform pipeline from the cleaning menu', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Clean data' }).click()
  await page.getByRole('button', { name: 'Uppercase active column' }).click()
  await expect(page.getByRole('button', { name: 'Replay pipeline (1)' })).toBeVisible()
  await page.getByRole('button', { name: 'Replay pipeline (1)' }).click()
  await expect(page.getByText(/1 pipeline steps replayed/)).toBeVisible()
})

test('creates a pivot tab from the cleaning menu', async ({ page }) => {
  await page.goto('/')
  page.on('dialog', async dialog => {
    if (dialog.message().startsWith('Group rows')) await dialog.accept('region')
    else if (dialog.message().startsWith('Value column')) await dialog.accept('revenue')
    else await dialog.accept('SUM')
  })
  await page.getByRole('button', { name: 'Clean data' }).click()
  await page.getByRole('button', { name: 'Create pivot' }).click()
  await expect(page.getByRole('button', { name: 'pivot_region', exact: true })).toBeVisible()
})

test('merges two datasets from the join UI', async ({ page }) => {
  await page.goto('/')
  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles({ name: 'customers.csv', mimeType: 'text/csv', buffer: Buffer.from('customer_id,segment\n1,VIP\n2,New') })
  await page.locator('.add-tab').click()
  await fileInput.setInputFiles({ name: 'orders.csv', mimeType: 'text/csv', buffer: Buffer.from('customer_id,total\n1,100\n2,200') })
  const answers = ['2', 'customer_id']
  page.on('dialog', dialog => dialog.accept(answers.shift() ?? ''))
  await page.getByRole('button', { name: 'Clean data' }).click()
  await page.getByRole('button', { name: 'Join another tab' }).click()
  await expect(page.getByRole('columnheader', { name: /segment/ })).toBeVisible()
})
