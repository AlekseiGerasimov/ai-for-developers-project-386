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
import MeetingCatalog from './MeetingCatalog'
import MeetingCalendar from './MeetingCalendar'
import OwnerMeetingTypes from './OwnerMeetingTypes'
import OwnerMeetings from './OwnerMeetings'

export default function App() {
  const isCatalog = window.location.pathname === '/meetings'
  const calendar = window.location.pathname.match(/^\/meetings\/([^/]+)$/)
  const isOwner = window.location.pathname === '/owner/meeting-types'
  const isOwnerMeetings = window.location.pathname === '/owner/meetings'

  return (
    <Container component="main" size="sm" py={{ base: 'xl', sm: 80 }}>
      <Paper withBorder radius="lg" p={{ base: 'lg', sm: 'xl' }}>
        <Stack gap="xl">
          {isOwnerMeetings ? (
            <>
              <Title order={1}>Предстоящие встречи</Title>
              <OwnerMeetings />
              <Anchor href="/owner/meeting-types">Типы встреч</Anchor>
              <Anchor href="/meetings">Каталог типов встреч</Anchor>
            </>
          ) : isOwner ? (
            <>
              <Title order={1}>Типы встреч владельца</Title>
              <OwnerMeetingTypes />
              <Anchor href="/owner/meetings">Предстоящие встречи</Anchor>
              <Anchor href="/meetings">Каталог типов встреч</Anchor>
            </>
          ) : calendar ? (
            <MeetingCalendar id={calendar[1]} />
          ) : isCatalog ? (
            <>
              <Title order={1}>Каталог типов встреч</Title>
              <MeetingCatalog />
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
          <Anchor href="/owner/meeting-types">Владельцу</Anchor>
        </Stack>
      </Paper>
    </Container>
  )
}
