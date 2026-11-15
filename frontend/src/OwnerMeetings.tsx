import { Button, Paper, Stack, Text, Title } from '@mantine/core'
import { useEffect, useState } from 'react'
import { Configuration, MeetingsApi, type Meeting } from './api'

const api = new MeetingsApi(new Configuration({ basePath: '' }))
const date = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Europe/Moscow',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})
const time = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Europe/Moscow',
  hour: '2-digit',
  minute: '2-digit',
})

export default function OwnerMeetings() {
  const [loading, setLoading] = useState(true)
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  function refresh() {
    setLoading(true)
    setError(false)
    setAttempt((value) => value + 1)
  }
  useEffect(() => {
    let active = true
    void api
      .listMeetings()
      .then((data) => {
        if (active) {
          setMeetings(data)
          setLoading(false)
        }
      })
      .catch(() => {
        if (active) {
          setError(true)
          setLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [attempt])
  return (
    <Stack>
      {loading ? (
        <Text role="status">Загрузка встреч…</Text>
      ) : error ? (
        <Text role="alert">Не удалось загрузить встречи</Text>
      ) : !meetings.length ? (
        <Text>Предстоящих встреч нет</Text>
      ) : (
        <>
          <Text>Europe/Moscow</Text>
          <Stack component="ul" p={0} m={0} style={{ listStyle: 'none' }}>
            {meetings.map((meeting) => (
              <Paper
                component="li"
                key={meeting.id}
                withBorder
                p="md"
                radius="md"
                style={{ overflowWrap: 'anywhere' }}
              >
                <Title order={2} size="h3">
                  {meeting.meetingType.title}
                </Title>
                <Text>{date.format(meeting.startsAt)}</Text>
                <Text>
                  {time.format(meeting.startsAt)}–{time.format(meeting.endsAt)}
                </Text>
                <Text>{meeting.guestName}</Text>
                <Text>{meeting.guestEmail}</Text>
              </Paper>
            ))}
          </Stack>
        </>
      )}
      <Button disabled={loading} onClick={refresh}>
        {error ? 'Повторить' : 'Обновить'}
      </Button>
    </Stack>
  )
}
