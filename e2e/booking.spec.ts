import { expect, test } from '@playwright/test'

test('two guests with a stale selection recover from conflict without losing fields', async ({
  page,
  browser,
}, testInfo) => {
  await page.goto('/owner/meeting-types')
  await page
    .getByLabel('Название')
    .fill(`Явная запись ${testInfo.project.name}`)
  await page.getByLabel('Описание').fill('Бронирование в настоящем календаре')
  await page.getByLabel('Длительность, минут').fill('20')
  await page.getByRole('button', { name: 'Создать тип встречи' }).click()
  const link = page.getByRole('link', { name: 'Публичная ссылка' })
  await expect(link).toBeVisible()
  const publicPath = await link.getAttribute('href')
  await link.click()
  const dayIndex = testInfo.project.name === 'desktop' ? 7 : 8
  await page
    .getByRole('group', { name: 'Выберите день' })
    .getByRole('button')
    .nth(dayIndex)
    .click()
  await page.getByRole('button', { name: '10:00–10:20' }).click()
  await page.getByLabel('Имя', { exact: true }).fill('Первый гость')
  await page.getByLabel('Email', { exact: true }).fill('First@Example.com')

  const secondContext = await browser.newContext({
    baseURL: testInfo.project.use.baseURL,
    viewport: testInfo.project.use.viewport,
  })
  const second = await secondContext.newPage()
  try {
    await second.goto(new URL(publicPath!, page.url()).href)
    await second
      .getByRole('group', { name: 'Выберите день' })
      .getByRole('button')
      .nth(dayIndex)
      .click()
    await second.getByRole('button', { name: '10:00–10:20' }).click()
    await second.getByLabel('Имя', { exact: true }).fill('Второй гость')
    await second.getByLabel('Email', { exact: true }).fill('Second@Example.com')

    const posts: string[] = []
    page.on('request', (request) => {
      if (
        request.method() === 'POST' &&
        request.url().endsWith('/api/meetings')
      )
        posts.push(request.url())
    })
    await page.getByRole('button', { name: 'Подтвердить запись' }).click()
    await expect(
      page.getByRole('heading', { name: 'Встреча подтверждена' }),
    ).toBeVisible()
    await expect(page.getByText('First@Example.com')).toBeVisible()
    await page.reload()
    await expect(
      page.getByRole('heading', { name: 'Встреча подтверждена' }),
    ).toBeVisible()
    expect(posts).toHaveLength(1)

    await second.getByRole('button', { name: 'Подтвердить запись' }).click()
    await expect(second.getByRole('alert')).toHaveText(
      'Это время уже занято. Выберите другое.',
    )
    await second
      .getByRole('group', { name: 'Выберите день' })
      .getByRole('button')
      .nth(dayIndex)
      .click()
    await expect(
      second.getByRole('button', { name: '10:00–10:20' }),
    ).toHaveCount(0)
    await second.getByRole('button', { name: '11:00–11:20' }).click()
    await expect(second.getByLabel('Имя', { exact: true })).toHaveValue(
      'Второй гость',
    )
    await expect(second.getByLabel('Email', { exact: true })).toHaveValue(
      'Second@Example.com',
    )
    await second.getByRole('button', { name: 'Подтвердить запись' }).click()
    await expect(
      second.getByRole('heading', { name: 'Встреча подтверждена' }),
    ).toBeVisible()
    expect(
      await second.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
  } finally {
    await secondContext.close()
  }
})
