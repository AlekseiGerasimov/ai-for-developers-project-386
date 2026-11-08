import { useEffect, useState } from 'react'
import {
  Alert,
  Container,
  Loader,
  Paper,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { Configuration, HealthApi } from './api'

const api = new HealthApi(new Configuration({ basePath: '' }))

export default function App() {
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading')

  useEffect(() => {
    const controller = new AbortController()
    api.getHealth({ signal: controller.signal }).then(
      (health) => setState(health.status === 'ok' ? 'ok' : 'error'),
      () => {
        if (!controller.signal.aborted) setState('error')
      },
    )
    return () => controller.abort()
  }, [])

  return (
    <Container size="sm" py="xl">
      <Paper withBorder radius="lg" p="xl">
        <Stack>
          <Title order={1}>Календарь звонков</Title>
          <Text c="dimmed">Основа сервиса записи на встречи.</Text>
          <div role="status" aria-live="polite">
            {state === 'loading' && (
              <Loader aria-label="Проверяем соединение" />
            )}
            {state === 'ok' && (
              <Alert color="teal" title="Сервер доступен">
                Соединение установлено.
              </Alert>
            )}
            {state === 'error' && (
              <Alert color="red" title="Нет соединения">
                Не удалось связаться с сервером. Попробуйте обновить страницу.
              </Alert>
            )}
          </div>
        </Stack>
      </Paper>
    </Container>
  )
}
