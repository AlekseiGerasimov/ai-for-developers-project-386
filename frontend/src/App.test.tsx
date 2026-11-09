import { MantineProvider } from '@mantine/core'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import App from './App'

afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '/')
})

test('каталог типов встреч содержит сообщение о недоступности записи и ссылку на главную', () => {
  window.history.replaceState(null, '', '/meetings')
  render(
    <MantineProvider>
      <App />
    </MantineProvider>,
  )

  expect(
    screen.getByRole('heading', { level: 1, name: 'Каталог типов встреч' }),
  ).toBeVisible()
  expect(screen.getByText('Запись пока недоступна.')).toBeVisible()
  expect(screen.getByRole('link', { name: 'На главную' })).toHaveAttribute(
    'href',
    '/',
  )
})

test('главная объясняет запись без регистрации и содержит ссылку на каталог типов встреч', () => {
  render(
    <MantineProvider>
      <App />
    </MantineProvider>,
  )

  expect(
    screen.getByRole('heading', { level: 1, name: 'Запись на звонок' }),
  ).toBeVisible()
  expect(
    screen.getByText(
      'Выберите тип встречи и удобное время для звонка. Запись без регистрации.',
    ),
  ).toBeVisible()
  const steps = screen.getByRole('region', { name: 'Как записаться' })
  expect(within(steps).getByRole('list')).toHaveTextContent(
    /Выберите встречу.*Выберите время.*Подтвердите запись/,
  )
  expect(screen.getByRole('link', { name: 'Выбрать встречу' })).toHaveAttribute(
    'href',
    '/meetings',
  )
})
