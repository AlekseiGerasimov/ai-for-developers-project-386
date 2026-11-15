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

const type = {
  id: '00000000-0000-0000-0000-000000000001',
  title: 'Знакомство',
  description: 'Обсудим задачу',
  durationMinutes: 20,
}
const availability = {
  timeZone: 'Europe/Moscow',
  serverTime: '2026-11-16T06:00:00Z',
  windowStartDate: '2026-11-16',
  windowEndDate: '2026-11-29',
  slots: [
    { startsAt: '2026-11-17T06:00:00Z', endsAt: '2026-11-17T06:20:00Z' },
    { startsAt: '2026-11-18T07:00:00Z', endsAt: '2026-11-18T07:20:00Z' },
  ],
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  window.history.replaceState(null, '', '/')
})

function openCalendar() {
  window.history.replaceState(null, '', `/meetings/${type.id}`)
  render(
    <MantineProvider>
      <App />
    </MantineProvider>,
  )
}

test('all dates are visible, first available day selected, time selected manually in Moscow', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) =>
      Response.json(url.endsWith('/slots') ? availability : type),
    ),
  )
  openCalendar()
  expect(screen.getByRole('status')).toHaveTextContent('Загрузка')
  expect(
    await screen.findByRole('heading', { name: 'Знакомство' }),
  ).toBeVisible()
  expect(screen.getByText('Обсудим задачу')).toBeVisible()
  expect(screen.getByText(/Europe\/Moscow/)).toBeVisible()
  const days = within(
    screen.getByRole('group', { name: 'Выберите день' }),
  ).getAllByRole('button')
  expect(days).toHaveLength(14)
  expect(days[0]).toBeDisabled()
  expect(days[1]).toHaveAttribute('aria-pressed', 'true')
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '09:00–09:20' }))
  expect(screen.getByRole('status')).toHaveTextContent(
    /Выбрано.*17.*09:00–09:20/,
  )
  fireEvent.click(days[2])
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: '10:00–10:20' })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
})

test('a failed availability load offers an explicit retry and distinguishes empty slots', async () => {
  let failed = true
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (!url.endsWith('/slots')) return Response.json(type)
      if (failed)
        return Response.json({ code: 'SERVICE_UNAVAILABLE' }, { status: 503 })
      return Response.json({ ...availability, slots: [] })
    }),
  )
  openCalendar()
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Не удалось загрузить календарь',
  )
  failed = false
  fireEvent.click(screen.getByRole('button', { name: 'Повторить' }))
  expect(
    await screen.findByText('В ближайшие 14 дней свободного времени нет'),
  ).toBeVisible()
  expect(
    within(screen.getByRole('group', { name: 'Выберите день' })).getAllByRole(
      'button',
    ),
  ).toHaveLength(14)
})

test('missing meeting type shows a catalog link instead of empty availability', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      Response.json({ code: 'MEETING_TYPE_NOT_FOUND' }, { status: 404 }),
    ),
  )
  openCalendar()
  expect(await screen.findByText('Тип встречи не найден')).toBeVisible()
  expect(screen.getByRole('link', { name: 'В каталог' })).toHaveAttribute(
    'href',
    '/meetings',
  )
  expect(
    screen.queryByRole('button', { name: 'Повторить' }),
  ).not.toBeInTheDocument()
})
