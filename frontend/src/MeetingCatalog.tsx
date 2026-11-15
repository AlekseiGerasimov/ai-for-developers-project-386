import { Anchor, Button, Paper, Stack, Text, Title } from '@mantine/core'
import { useEffect, useState } from 'react'
import { Configuration, MeetingTypesApi, type MeetingType } from './api'

const api = new MeetingTypesApi(new Configuration({ basePath: '' }))

export default function MeetingCatalog() {
  const [loading, setLoading] = useState(true)
  const [types, setTypes] = useState<MeetingType[]>([])
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    api
      .listMeetingTypes()
      .then((data) => {
        if (active) {
          setTypes(data)
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

  if (loading) return <Text role="status">Загрузка каталога…</Text>
  if (error)
    return (
      <Stack>
        <Text role="alert">Не удалось загрузить каталог</Text>
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
  if (!types.length) return <Text>Пока нет типов встреч</Text>
  return (
    <Stack component="ul" p={0} m={0} style={{ listStyle: 'none' }}>
      {types.map((type) => (
        <Paper
          component="li"
          key={type.id}
          withBorder
          p="md"
          radius="md"
          style={{ overflowWrap: 'anywhere' }}
        >
          <Title order={2} size="h3">
            <Anchor href={`/meetings/${type.id}`} inherit>
              {type.title}
            </Anchor>
          </Title>
          <Text style={{ whiteSpace: 'pre-wrap' }}>{type.description}</Text>
          <Text c="dimmed">{type.durationMinutes} мин</Text>
        </Paper>
      ))}
    </Stack>
  )
}
