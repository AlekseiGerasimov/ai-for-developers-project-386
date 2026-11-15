import { Anchor, Button, Group, Stack, Text, Title } from '@mantine/core'
import { useEffect, useState } from 'react'
import {
  CalendarApi,
  Configuration,
  ResponseError,
  type Availability,
  type MeetingType,
  type Slot,
} from './api'

const api = new CalendarApi(new Configuration({ basePath: '' }))
const zone = 'Europe/Moscow'
const dayKey = (date: Date) =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: zone }).format(date)
const dayLabel = (date: Date) =>
  new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'long',
  }).format(date)
const time = (date: Date) =>
  new Intl.DateTimeFormat('ru-RU', {
    timeZone: zone,
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
const interval = (slot: Slot) => `${time(slot.startsAt)}–${time(slot.endsAt)}`

export default function MeetingCalendar({ id }: { id: string }) {
  const [data, setData] = useState<{
    type: MeetingType
    availability: Availability
  }>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [missing, setMissing] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [day, setDay] = useState('')
  const [selected, setSelected] = useState<Slot>()

  useEffect(() => {
    let active = true
    Promise.all([api.getMeetingType({ id }), api.getSlots({ id })])
      .then(([type, availability]) => {
        if (active) {
          setData({ type, availability })
          setDay(
            availability.slots[0] ? dayKey(availability.slots[0].startsAt) : '',
          )
          setLoading(false)
        }
      })
      .catch(async (error: unknown) => {
        let notFound = false
        if (error instanceof ResponseError) {
          try {
            notFound =
              (await error.response.json()).code === 'MEETING_TYPE_NOT_FOUND'
          } catch {
            /* A malformed response is a load error. */
          }
        }
        if (active) {
          setMissing(notFound)
          setError(!notFound)
          setLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [id, attempt])

  if (missing)
    return (
      <Stack>
        <Text>Тип встречи не найден</Text>
        <Anchor href="/meetings">В каталог</Anchor>
      </Stack>
    )
  if (error)
    return (
      <Stack>
        <Text role="alert">Не удалось загрузить календарь</Text>
        <Button
          onClick={() => {
            setLoading(true)
            setError(false)
            setAttempt(attempt + 1)
          }}
        >
          Повторить
        </Button>
      </Stack>
    )
  if (loading || !data) return <Text role="status">Загрузка календаря…</Text>
  const dates = Array.from({ length: 14 }, (_, index) => {
    const start = data.availability.windowStartDate
    const date = new Date(
      Date.UTC(start.getFullYear(), start.getMonth(), start.getDate()),
    )
    date.setUTCDate(date.getUTCDate() + index)
    return date
  })
  const slots = data.availability.slots.filter(
    (slot) => dayKey(slot.startsAt) === day,
  )
  return (
    <Stack>
      <Title order={1}>{data.type.title}</Title>
      <Text style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
        {data.type.description}
      </Text>
      <Text>{data.type.durationMinutes} мин</Text>
      <Text>Часовой пояс владельца: {data.availability.timeZone}</Text>
      {!data.availability.slots.length && (
        <Text>В ближайшие 14 дней свободного времени нет</Text>
      )}
      <Group role="group" aria-label="Выберите день" gap="xs">
        {dates.map((date) => {
          const key = date.toISOString().slice(0, 10)
          return (
            <Button
              key={key}
              variant={key === day ? 'filled' : 'light'}
              aria-pressed={key === day}
              disabled={
                !data.availability.slots.some(
                  (slot) => dayKey(slot.startsAt) === key,
                )
              }
              onClick={() => {
                setDay(key)
                setSelected(undefined)
              }}
            >
              {dayLabel(date)}
            </Button>
          )
        })}
      </Group>
      <Group role="group" aria-label="Выберите время" gap="xs">
        {slots.map((slot) => (
          <Button
            key={slot.startsAt.toISOString()}
            variant="outline"
            aria-pressed={slot === selected}
            onClick={() => setSelected(slot)}
          >
            {interval(slot)}
          </Button>
        ))}
      </Group>
      {selected && (
        <Text role="status">
          Выбрано: {data.type.title}, {data.type.durationMinutes} мин,{' '}
          {dayLabel(new Date(`${day}T12:00:00Z`))}, {interval(selected)},{' '}
          {data.availability.timeZone}
        </Text>
      )}
      <Anchor href="/meetings">В каталог</Anchor>
    </Stack>
  )
}
