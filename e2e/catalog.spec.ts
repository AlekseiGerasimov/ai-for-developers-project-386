import { expect, test } from '@playwright/test'

test('owner creates a type and guest sees its safe plain text in catalog', async ({
  page,
}, info) => {
  const title = `Разбор ${info.project.name}`
  await page.goto('/')
  await page.getByRole('link', { name: 'Владельцу' }).click()
  await expect(page).toHaveURL(/\/owner\/meeting-types$/)
  await page.reload()
  await page.getByLabel('Название').fill(title)
  await page.getByLabel('Описание').fill('<b>Обычный текст</b>')
  await page.getByLabel('Длительность, минут').fill('20')
  await page.getByRole('button', { name: 'Создать тип встречи' }).click()
  await expect(
    page.getByText('Тип встречи создан', { exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Публичная ссылка' }),
  ).toHaveAttribute('href', /\/meetings\/[0-9a-f-]{36}$/)
  await expect(
    page.getByRole('heading', { name: title, exact: true }),
  ).toBeVisible()
  await page.goto('/meetings')
  const card = page
    .getByRole('listitem')
    .filter({ has: page.getByRole('heading', { name: title, exact: true }) })
  await expect(card).toContainText('<b>Обычный текст</b>')
  await expect(card.locator('b')).toHaveCount(0)
  await expect(card).toContainText('20 мин')
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
})

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
