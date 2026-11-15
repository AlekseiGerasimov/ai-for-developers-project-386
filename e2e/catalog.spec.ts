import { expect, test } from '@playwright/test'

test('guest sees the H2 catalog from the home link and after a direct reload', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Выбрать встречу' }).focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/meetings$/)
  await expect(
    page.getByRole('heading', { name: 'Каталог типов встреч' }),
  ).toBeVisible()
  await expect(page.getByRole('listitem')).toHaveCount(3)
  await expect(page.getByRole('listitem').nth(0)).toHaveText(
    'ЗнакомствоОбсудим задачу20 мин',
  )
  await expect(page.getByRole('listitem').nth(1)).toHaveText(
    'ЗнакомствоПодробное знакомство30 мин',
  )
  await expect(page.getByRole('listitem').nth(2)).toHaveText(
    'КонсультацияРазберём вопросы60 мин',
  )
  await page.reload()
  await expect(page.getByText('Обсудим задачу')).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  await page.goto('/meetings')
  await expect(page.getByText('Разберём вопросы')).toBeVisible()
})
