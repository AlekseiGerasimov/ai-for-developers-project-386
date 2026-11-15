import { Anchor, Button, Stack, Text, Textarea, TextInput } from '@mantine/core'
import { useRef, useState } from 'react'
import {
  Configuration,
  MeetingTypesApi,
  ResponseError,
  type ApiError,
  type MeetingType,
} from './api'
import MeetingCatalog from './MeetingCatalog'

const api = new MeetingTypesApi(new Configuration({ basePath: '' }))

export default function OwnerMeetingTypes() {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [duration, setDuration] = useState('30')
  const [pending, setPending] = useState(false)
  const sending = useRef(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')
  const [created, setCreated] = useState<MeetingType>()
  const [revision, setRevision] = useState(0)

  async function submit() {
    if (sending.current) return
    const fields: Record<string, string> = {}
    if (!title.trim() || title.trim().length > 100)
      fields.title = 'Введите от 1 до 100 символов'
    if (!description.trim() || description.trim().length > 2000)
      fields.description = 'Введите от 1 до 2000 символов'
    if (
      !/^\d+$/.test(duration) ||
      Number(duration) < 1 ||
      Number(duration) > 480
    )
      fields.durationMinutes = 'Введите целое число от 1 до 480'
    setErrors(fields)
    if (Object.keys(fields).length) return
    sending.current = true
    setPending(true)
    setMessage('')
    setCreated(undefined)
    try {
      const result = await api.createMeetingType({
        createMeetingType: {
          title,
          description,
          durationMinutes: Number(duration),
        },
      })
      setCreated(result)
      setTitle('')
      setDescription('')
      setDuration('30')
      setRevision((value) => value + 1)
    } catch (error) {
      if (error instanceof ResponseError) {
        const body: ApiError | undefined = await error.response
          .json()
          .catch(() => undefined)
        if (body?.code === 'VALIDATION_ERROR') {
          setErrors(
            Object.fromEntries(
              (body.fieldErrors ?? []).map((field) => [
                field.field,
                field.message,
              ]),
            ),
          )
          setMessage('Проверьте поля формы')
        } else
          setMessage(
            'Не удалось создать тип встречи. Обновите список перед новой попыткой.',
          )
      } else {
        setMessage(
          'Не удалось подтвердить результат создания. Тип встречи мог сохраниться. Обновите список перед новой попыткой.',
        )
      }
    } finally {
      sending.current = false
      setPending(false)
    }
  }

  return (
    <Stack>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
        noValidate
      >
        <Stack>
          <TextInput
            id="meeting-type-title"
            label="Название"
            value={title}
            onChange={(event) => setTitle(event.currentTarget.value)}
            error={errors.title}
            disabled={pending}
          />
          <Textarea
            id="meeting-type-description"
            label="Описание"
            value={description}
            onChange={(event) => setDescription(event.currentTarget.value)}
            error={errors.description}
            disabled={pending}
            rows={3}
          />
          <TextInput
            id="meeting-type-duration"
            label="Длительность, минут"
            inputMode="numeric"
            value={duration}
            onChange={(event) => setDuration(event.currentTarget.value)}
            error={errors.durationMinutes}
            disabled={pending}
          />
          <Button type="submit" disabled={pending}>
            {pending ? 'Создание…' : 'Создать тип встречи'}
          </Button>
        </Stack>
      </form>
      {message && <Text role="alert">{message}</Text>}
      {created && (
        <Stack gap="xs">
          <Text role="status">Тип встречи создан</Text>
          <Anchor href={`/meetings/${created.id}`}>Публичная ссылка</Anchor>
        </Stack>
      )}
      <Button
        variant="light"
        disabled={pending}
        onClick={() => setRevision((value) => value + 1)}
      >
        Обновить список
      </Button>
      <MeetingCatalog key={revision} />
    </Stack>
  )
}
