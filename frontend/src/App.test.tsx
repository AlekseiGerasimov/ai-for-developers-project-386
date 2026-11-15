import { MantineProvider } from '@mantine/core'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import App from './App'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  window.history.replaceState(null, '', '/')
})

test('каталог показывает загрузку и пустое состояние', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json([])))
  window.history.replaceState(null, '', '/meetings')
  render(
    <MantineProvider>
      <App />
    </MantineProvider>,
  )

  expect(
    screen.getByRole('heading', { level: 1, name: 'Каталог типов встреч' }),
  ).toBeVisible()
  expect(screen.getByRole('status')).toHaveTextContent('Загрузка')
  expect(await screen.findByText('Пока нет типов встреч')).toBeVisible()
  expect(screen.getByRole('link', { name: 'На главную' })).toHaveAttribute(
    'href',
    '/',
  )
})

test('каталог показывает полные данные типов из сети', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      Response.json([
        {
          id: 'd29fe6b4-a141-4ba0-9d98-b738cfe0ec7c',
          title: 'Знакомство',
          description: 'Обсудим задачу',
          durationMinutes: 30,
        },
      ]),
    ),
  )
  window.history.replaceState(null, '', '/meetings')
  render(
    <MantineProvider>
      <App />
    </MantineProvider>,
  )
  expect(
    await screen.findByRole('heading', { name: 'Знакомство' }),
  ).toBeVisible()
  expect(screen.getByText('Обсудим задачу')).toBeVisible()
  expect(screen.getByText('30 мин')).toBeVisible()
})

test('ошибку загрузки можно явно повторить', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce(Response.json({}, { status: 503 }))
      .mockResolvedValueOnce(Response.json([])),
  )
  window.history.replaceState(null, '', '/meetings')
  render(
    <MantineProvider>
      <App />
    </MantineProvider>,
  )
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Не удалось загрузить каталог',
  )
  fireEvent.click(screen.getByRole('button', { name: 'Повторить' }))
  expect(await screen.findByText('Пока нет типов встреч')).toBeVisible()
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
