import { MantineProvider } from '@mantine/core'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
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
  sessionStorage.clear()
  vi.unstubAllGlobals()
  window.history.replaceState(null, '', '/')
})

test('booking uses selected slot and restores confirmation after reload without POST', async () => {
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      expect(JSON.parse(String(init.body))).toEqual({
        meetingTypeId: type.id,
        startsAt: '2026-11-17T06:00:00.000Z',
        guestName: 'Гость',
        guestEmail: 'Guest@example.com',
      })
      return Response.json(
        {
          id: 'saved',
          meetingType: type,
          ...availability.slots[0],
          guestName: 'Гость',
          guestEmail: 'Guest@example.com',
        },
        { status: 201 },
      )
    }
    return Response.json(url.endsWith('/slots') ? availability : type)
  })
  vi.stubGlobal('fetch', fetch)
  openCalendar()
  fireEvent.click(await screen.findByRole('button', { name: '09:00–09:20' }))
  fireEvent.change(screen.getByLabelText('Имя'), { target: { value: 'Гость' } })
  fireEvent.change(screen.getByLabelText('Email'), {
    target: { value: 'Guest@example.com' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Подтвердить запись' }))
  expect(await screen.findByText('Встреча подтверждена')).toBeVisible()
  cleanup()
  openCalendar()
  expect(await screen.findByText('Встреча подтверждена')).toBeVisible()
  expect(screen.getByText('Guest@example.com')).toBeVisible()
  expect(
    fetch.mock.calls.filter(([, init]) => init?.method === 'POST'),
  ).toHaveLength(1)
  fireEvent.click(screen.getByRole('button', { name: 'Записаться ещё' }))
  expect(
    await screen.findByRole('button', { name: '09:00–09:20' }),
  ).toBeVisible()
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

async function fillBooking() {
  fireEvent.click(await screen.findByRole('button', { name: '09:00–09:20' }))
  fireEvent.change(screen.getByLabelText('Имя'), { target: { value: 'Гость' } })
  fireEvent.change(screen.getByLabelText('Email'), {
    target: { value: 'Guest@example.com' },
  })
}

test.each(['SLOT_TAKEN', 'SLOT_EXPIRED', 'INVALID_SLOT'])(
  'slot error %s reloads availability and retains guest fields',
  async (code) => {
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST')
        return Response.json(
          { code },
          { status: code === 'SLOT_TAKEN' ? 409 : 400 },
        )
      return Response.json(url.endsWith('/slots') ? availability : type)
    })
    vi.stubGlobal('fetch', fetch)
    openCalendar()
    await fillBooking()
    fireEvent.click(screen.getByRole('button', { name: 'Подтвердить запись' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Выберите другое',
    )
    expect(screen.queryByLabelText('Имя')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '09:00–09:20' }))
    expect(screen.getByLabelText('Имя')).toHaveValue('Гость')
    expect(screen.getByLabelText('Email')).toHaveValue('Guest@example.com')
    expect(
      fetch.mock.calls.filter(([url]) => url.endsWith('/slots')),
    ).toHaveLength(2)
  },
)

test('lost response remains uncertain across reload and needs explicit calendar return', async () => {
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST') throw new TypeError('Connection lost')
    return Response.json(url.endsWith('/slots') ? availability : type)
  })
  vi.stubGlobal('fetch', fetch)
  openCalendar()
  await fillBooking()
  fireEvent.click(screen.getByRole('button', { name: 'Подтвердить запись' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Не удалось подтвердить результат записи',
  )
  cleanup()
  openCalendar()
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Встреча могла сохраниться',
  )
  expect(
    screen.queryByRole('button', { name: 'Подтвердить запись' }),
  ).not.toBeInTheDocument()
  expect(
    fetch.mock.calls.filter(([, init]) => init?.method === 'POST'),
  ).toHaveLength(1)
  fireEvent.click(screen.getByRole('button', { name: 'Вернуться к календарю' }))
  fireEvent.click(await screen.findByRole('button', { name: '09:00–09:20' }))
  expect(screen.getByLabelText('Имя')).toHaveValue('Гость')
})

test('pending booking blocks double submit and a refresh restores uncertainty without POST', async () => {
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST') return new Promise<Response>(() => {})
    return Response.json(url.endsWith('/slots') ? availability : type)
  })
  vi.stubGlobal('fetch', fetch)
  openCalendar()
  await fillBooking()
  const submit = screen.getByRole('button', { name: 'Подтвердить запись' })
  fireEvent.click(submit)
  fireEvent.click(submit)
  expect(screen.getByRole('button', { name: 'Запись…' })).toBeDisabled()
  await waitFor(() =>
    expect(
      fetch.mock.calls.filter(([, init]) => init?.method === 'POST'),
    ).toHaveLength(1),
  )
  cleanup()
  openCalendar()
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Не удалось подтвердить результат записи',
  )
  expect(
    fetch.mock.calls.filter(([, init]) => init?.method === 'POST'),
  ).toHaveLength(1)
})

test('field errors stay near inputs and draft reload preserves fields without selected time', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST')
        return Response.json(
          {
            code: 'VALIDATION_ERROR',
            fieldErrors: [{ field: 'guestEmail', message: 'Проверьте адрес' }],
          },
          { status: 400 },
        )
      return Response.json(url.endsWith('/slots') ? availability : type)
    }),
  )
  openCalendar()
  await fillBooking()
  fireEvent.click(screen.getByRole('button', { name: 'Подтвердить запись' }))
  expect(await screen.findByText('Проверьте адрес')).toBeVisible()
  expect(screen.getByLabelText('Email')).toHaveValue('Guest@example.com')
  cleanup()
  openCalendar()
  expect(
    await screen.findByRole('button', { name: '09:00–09:20' }),
  ).toHaveAttribute('aria-pressed', 'false')
  expect(screen.queryByLabelText('Email')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '09:00–09:20' }))
  expect(screen.getByLabelText('Email')).toHaveValue('Guest@example.com')
})
