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

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  window.history.replaceState(null, '', '/')
})

test('владелец создаёт тип через сеть и получает публичную ссылку', async () => {
  const created = {
    id: 'd29fe6b4-a141-4ba0-9d98-b738cfe0ec7c',
    title: 'Разбор',
    description: 'Задача',
    durationMinutes: 20,
  }
  const network = vi
    .fn()
    .mockResolvedValueOnce(Response.json([]))
    .mockResolvedValueOnce(Response.json(created, { status: 201 }))
    .mockResolvedValueOnce(Response.json([created]))
  vi.stubGlobal('fetch', network)
  window.history.replaceState(null, '', '/owner/meeting-types')
  render(
    <MantineProvider>
      <App />
    </MantineProvider>,
  )
  expect(await screen.findByText('Пока нет типов встреч')).toBeVisible()
  fireEvent.change(screen.getByLabelText('Название'), {
    target: { value: 'Разбор' },
  })
  fireEvent.change(screen.getByLabelText('Описание'), {
    target: { value: 'Задача' },
  })
  fireEvent.change(screen.getByLabelText('Длительность, минут'), {
    target: { value: '20' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Создать тип встречи' }))
  expect(await screen.findByText('Тип встречи создан')).toBeVisible()
  expect(await screen.findByRole('heading', { name: 'Разбор' })).toBeVisible()
  expect(
    screen.getByRole('link', { name: 'Публичная ссылка' }),
  ).toHaveAttribute('href', `/meetings/${created.id}`)
  expect(screen.getByLabelText('Название')).toHaveValue('')
  expect(network.mock.calls[1][1].body).toBe(
    JSON.stringify({
      title: 'Разбор',
      description: 'Задача',
      durationMinutes: 20,
    }),
  )
})

test('owner can create a type at Unicode character limits but cannot exceed them', async () => {
  const title = '𐐀'.repeat(100)
  const description = '𐐀'.repeat(2000)
  const created = {
    id: 'd29fe6b4-a141-4ba0-9d98-b738cfe0ec7c',
    title,
    description,
    durationMinutes: 30,
  }
  const network = vi
    .fn()
    .mockResolvedValueOnce(Response.json([]))
    .mockResolvedValueOnce(Response.json(created, { status: 201 }))
    .mockResolvedValueOnce(Response.json([created]))
  vi.stubGlobal('fetch', network)
  window.history.replaceState(null, '', '/owner/meeting-types')
  render(
    <MantineProvider>
      <App />
    </MantineProvider>,
  )
  await screen.findByText('Пока нет типов встреч')
  fireEvent.change(screen.getByLabelText('Название'), {
    target: { value: title + '𐐀' },
  })
  fireEvent.change(screen.getByLabelText('Описание'), {
    target: { value: description + '𐐀' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Создать тип встречи' }))
  expect(screen.getByText('Введите от 1 до 100 символов')).toBeVisible()
  expect(screen.getByText('Введите от 1 до 2000 символов')).toBeVisible()
  fireEvent.change(screen.getByLabelText('Название'), {
    target: { value: ` ${title} ` },
  })
  fireEvent.change(screen.getByLabelText('Описание'), {
    target: { value: ` ${description} ` },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Создать тип встречи' }))
  expect(await screen.findByText('Тип встречи создан')).toBeVisible()
  expect(await screen.findByRole('heading', { name: title })).toBeVisible()
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

test('владелец сохраняет поля при ошибке, блокирует повтор и явно обновляет список после потери ответа', async () => {
  let rejectPost: (error: Error) => void = () => {}
  const network = vi
    .fn()
    .mockResolvedValueOnce(Response.json([]))
    .mockImplementationOnce(
      () =>
        new Promise<Response>((_resolve, reject) => {
          rejectPost = reject
        }),
    )
    .mockResolvedValueOnce(Response.json([]))
  vi.stubGlobal('fetch', network)
  window.history.replaceState(null, '', '/owner/meeting-types')
  render(
    <MantineProvider>
      <App />
    </MantineProvider>,
  )
  await screen.findByText('Пока нет типов встреч')
  fireEvent.change(screen.getByLabelText('Название'), {
    target: { value: 'Разбор' },
  })
  fireEvent.change(screen.getByLabelText('Описание'), {
    target: { value: 'Вопрос' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Создать тип встречи' }))
  expect(screen.getByRole('button', { name: 'Создание…' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Создание…' }))
  await waitFor(() => expect(network).toHaveBeenCalledTimes(2))
  rejectPost(new Error('response lost'))
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Тип встречи мог сохраниться',
  )
  expect(screen.queryByText('Тип встречи создан')).not.toBeInTheDocument()
  expect(screen.getByLabelText('Название')).toHaveValue('Разбор')
  expect(network).toHaveBeenCalledTimes(2)
  fireEvent.click(screen.getByRole('button', { name: 'Обновить список' }))
  await screen.findByText('Пока нет типов встреч')
  expect(network).toHaveBeenCalledTimes(3)
})

test('серверные ошибки выводятся у полей и не очищают форму', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce(Response.json([]))
      .mockResolvedValueOnce(
        Response.json(
          {
            code: 'VALIDATION_ERROR',
            message: 'Ошибка',
            fieldErrors: [{ field: 'title', message: 'Исправьте название' }],
          },
          { status: 400 },
        ),
      ),
  )
  window.history.replaceState(null, '', '/owner/meeting-types')
  render(
    <MantineProvider>
      <App />
    </MantineProvider>,
  )
  await screen.findByText('Пока нет типов встреч')
  fireEvent.change(screen.getByLabelText('Название'), {
    target: { value: 'Разбор' },
  })
  fireEvent.change(screen.getByLabelText('Описание'), {
    target: { value: 'Вопрос' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Создать тип встречи' }))
  expect(await screen.findByText('Исправьте название')).toBeVisible()
  expect(screen.getByLabelText('Название')).toHaveValue('Разбор')
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
