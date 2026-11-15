import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import App from './App'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  window.history.replaceState(null, '', '/')
})

test('список показывает все данные в московском времени и сохраняет порядок API', async () => {
  const network = vi.fn().mockResolvedValue(
    Response.json([
      {
        id: 'b',
        meetingType: {
          id: 'type',
          title: '<b>Разбор</b>',
          description: '',
          durationMinutes: 30,
        },
        startsAt: '2026-12-16T21:30:00Z',
        endsAt: '2026-12-16T22:00:00Z',
        guestName: 'Анна',
        guestEmail: 'Anna@example.com',
      },
      {
        id: 'a',
        meetingType: {
          id: 'type2',
          title: 'Знакомство',
          description: '',
          durationMinutes: 20,
        },
        startsAt: '2026-12-17T07:00:00Z',
        endsAt: '2026-12-17T07:20:00Z',
        guestName: '李',
        guestEmail: 'li@example.com',
      },
    ]),
  )
  vi.stubGlobal('fetch', network)
  openMeetings()
  expect(
    await screen.findByRole('heading', { name: '<b>Разбор</b>' }),
  ).toBeVisible()
  expect(screen.getAllByText('17 декабря 2026 г.')).toHaveLength(2)
  expect(screen.getByText('00:30–01:00')).toBeVisible()
  expect(screen.getByText('Europe/Moscow')).toBeVisible()
  expect(screen.getByText('Анна')).toBeVisible()
  expect(screen.getByText('Anna@example.com')).toBeVisible()
  expect(
    screen.getAllByRole('listitem').map((item) => item.textContent),
  ).toEqual([
    expect.stringContaining('<b>Разбор</b>'),
    expect.stringContaining('Знакомство'),
  ])
  expect(network.mock.calls[0][0]).toBe('/api/meetings')
  expect(network.mock.calls[0][1].method).toBe('GET')
})

function openMeetings() {
  window.history.replaceState(null, '', '/owner/meetings')
  render(
    <MantineProvider>
      <App />
    </MantineProvider>,
  )
}

test('владелец видит загрузку, затем пустой список и ссылки между своими страницами', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json([])))
  openMeetings()
  expect(screen.getByRole('status')).toHaveTextContent('Загрузка встреч')
  expect(await screen.findByText('Предстоящих встреч нет')).toBeVisible()
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
    'Предстоящие встречи',
  )
  expect(screen.getByRole('link', { name: 'Типы встреч' })).toHaveAttribute(
    'href',
    '/owner/meeting-types',
  )
  expect(screen.getByRole('button', { name: 'Обновить' })).toBeEnabled()
})

test('ошибку можно повторить явно, а пустой список обновить без фонового опроса', async () => {
  const network = vi
    .fn()
    .mockResolvedValueOnce(Response.json({}, { status: 503 }))
    .mockResolvedValueOnce(Response.json([]))
    .mockRejectedValueOnce(new Error('network unavailable'))
  vi.stubGlobal('fetch', network)
  openMeetings()
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Не удалось загрузить встречи',
  )
  expect(screen.queryByText('Предстоящих встреч нет')).not.toBeInTheDocument()
  expect(network).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button', { name: 'Повторить' }))
  expect(screen.getByRole('status')).toHaveTextContent('Загрузка встреч')
  expect(screen.getByRole('button', { name: 'Обновить' })).toBeDisabled()
  expect(await screen.findByText('Предстоящих встреч нет')).toBeVisible()
  expect(network).toHaveBeenCalledTimes(2)
  fireEvent.click(screen.getByRole('button', { name: 'Обновить' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Не удалось загрузить встречи',
  )
  expect(network).toHaveBeenCalledTimes(3)
})
