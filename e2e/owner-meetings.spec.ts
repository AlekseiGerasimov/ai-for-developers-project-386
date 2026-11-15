import { expect, test } from '@playwright/test'

test('owner creates a type, guest books and reloads confirmation, owner sees the meeting', async ({
  page,
}, info) => {
  const title = `Полный путь ${info.project.name}`
  const name = `Гость ${info.project.name}`
  const email = `Guest.${info.project.name}@example.com`
  const day = info.project.name === 'desktop' ? 25 : 26
  await page.goto('/owner/meeting-types')
  await page.getByLabel('Название').fill(title)
  await page
    .getByLabel('Описание')
    .fill('Встреча из полного браузерного сценария')
  await page.getByLabel('Длительность, минут').fill('20')
  await page.getByRole('button', { name: 'Создать тип встречи' }).click()
  const publicLink = page.getByRole('link', { name: 'Публичная ссылка' })
  await expect(publicLink).toBeVisible()
  await publicLink.focus()
  await page.keyboard.press('Enter')
  await page
    .getByRole('group', { name: 'Выберите день' })
    .getByRole('button', { name: new RegExp(`${day} ноября`) })
    .click()
  const slot = page.getByRole('button', { name: '12:00–12:20' })
  await slot.focus()
  await page.keyboard.press('Enter')
  await page.getByLabel('Имя', { exact: true }).pressSequentially(name)
  await page.getByLabel('Email', { exact: true }).pressSequentially(email)
  const posts: string[] = []
  page.on('request', (request) => {
    if (
      request.method() === 'POST' &&
      new URL(request.url()).pathname === '/api/meetings'
    )
      posts.push(request.url())
  })
  await page.getByRole('button', { name: 'Подтвердить запись' }).click()
  await expect(
    page.getByText('Встреча подтверждена', { exact: true }),
  ).toBeVisible()
  await page.reload()
  await expect(
    page.getByText('Встреча подтверждена', { exact: true }),
  ).toBeVisible()
  expect(posts).toHaveLength(1)
  const response = await page.goto('/owner/meetings')
  expect(response?.status()).toBe(200)
  await page.reload()
  const meeting = page
    .getByRole('listitem')
    .filter({ has: page.getByRole('heading', { name: title, exact: true }) })
  await expect(meeting).toContainText(`${day} ноября 2026 г.`)
  await expect(meeting).toContainText('12:00–12:20')
  await expect(meeting).toContainText(name)
  await expect(meeting).toContainText(email)
  await expect(page.getByText('Europe/Moscow', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Обновить', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(meeting).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await page.getByRole('link', { name: 'Типы встреч', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/owner\/meeting-types$/)
  await page
    .getByRole('link', { name: 'Предстоящие встречи', exact: true })
    .click()
  await expect(meeting).toBeVisible()
  expect(posts).toHaveLength(1)
})
