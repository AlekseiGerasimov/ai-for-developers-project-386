import {
  Anchor,
  Button,
  Container,
  List,
  Paper,
  Stack,
  Text,
  Title,
} from '@mantine/core'

export default function App() {
  const isCatalog = window.location.pathname === '/meetings'

  return (
    <Container component="main" size="sm" py={{ base: 'xl', sm: 80 }}>
      <Paper withBorder radius="lg" p={{ base: 'lg', sm: 'xl' }}>
        <Stack gap="xl">
          {isCatalog ? (
            <>
              <Title order={1}>Каталог типов встреч</Title>
              <Text c="dimmed">Запись пока недоступна.</Text>
              <Anchor href="/">На главную</Anchor>
            </>
          ) : (
            <>
              <Title order={1}>Запись на звонок</Title>
              <Text size="lg" c="dimmed">
                Выберите тип встречи и удобное время для звонка. Запись без
                регистрации.
              </Text>
              <Stack component="section" aria-labelledby="booking-steps-title">
                <Title order={2} size="h3" id="booking-steps-title">
                  Как записаться
                </Title>
                <List type="ordered" spacing="md">
                  <List.Item>Выберите встречу</List.Item>
                  <List.Item>Выберите время</List.Item>
                  <List.Item>Подтвердите запись</List.Item>
                </List>
              </Stack>
              <Button component="a" href="/meetings" size="lg" radius="md">
                Выбрать встречу
              </Button>
            </>
          )}
        </Stack>
      </Paper>
    </Container>
  )
}
