import { expect, test } from '@playwright/test'

test('guest opens a direct calendar, selects day and time with keyboard and reloads', async ({
  page,
}) => {
  const response = await page.goto(
    '/meetings/00000000-0000-0000-0000-000000000001',
  )
  expect(response?.status()).toBe(200)
  await expect(page.getByRole('heading', { name: 'Знакомство' })).toBeVisible()
  await expect(
    page.getByText('Часовой пояс владельца: Europe/Moscow'),
  ).toBeVisible()
  const days = page
    .getByRole('group', { name: 'Выберите день' })
    .getByRole('button')
  await expect(days).toHaveCount(14)
  await expect(days.nth(0)).toHaveAttribute('aria-pressed', 'true')
  await expect(days.nth(5)).toBeDisabled()
  await expect(page.getByRole('status')).toHaveCount(0)
  const firstTime = page.getByRole('button', { name: '09:15–09:35' })
  await firstTime.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('status')).toHaveText(
    /Выбрано: Знакомство, 20 мин.*16 ноября.*09:15–09:35/,
  )
  await days.nth(1).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('status')).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: '09:00–09:20' }),
  ).toHaveAttribute('aria-pressed', 'false')
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  await page.reload()
  await expect(days.nth(0)).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('status')).toHaveCount(0)
  await page.goto('/meetings/00000000-0000-0000-0000-000000000099')
  await expect(page.getByText('Тип встречи не найден')).toBeVisible()
  await page.getByRole('link', { name: 'В каталог' }).click()
  await expect(
    page.getByRole('heading', { name: 'Каталог типов встреч' }),
  ).toBeVisible()
})
