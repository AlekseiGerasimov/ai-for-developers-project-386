import { useRef, useState } from 'react'
import {
  Configuration,
  MeetingsApi,
  MeetingFromJSON,
  MeetingToJSON,
  ResponseError,
  type ApiError,
  type Meeting,
  type Slot,
} from './api'

type Session = {
  name: string
  email: string
  state: 'draft' | 'uncertain' | 'success'
  meeting?: Meeting
}
const api = new MeetingsApi(new Configuration({ basePath: '' }))

export function useBooking(id: string, refresh: () => void) {
  const key = `booking:${id}`
  const [session, setSession] = useState<Session>(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(key) ?? 'null')
      if (
        saved &&
        typeof saved.name === 'string' &&
        typeof saved.email === 'string'
      )
        return {
          name: saved.name,
          email: saved.email,
          state:
            saved.state === 'success'
              ? 'success'
              : saved.state === 'uncertain'
                ? 'uncertain'
                : 'draft',
          meeting: saved.meeting ? MeetingFromJSON(saved.meeting) : undefined,
        }
    } catch {
      /* Ignore unavailable or invalid browser storage. */
    }
    return { name: '', email: '', state: 'draft' }
  })
  const [pending, setPending] = useState(false)
  const sending = useRef(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')

  function save(next: Session) {
    setSession(next)
    try {
      sessionStorage.setItem(
        key,
        JSON.stringify({
          ...next,
          meeting: next.meeting ? MeetingToJSON(next.meeting) : undefined,
        }),
      )
    } catch {
      /* Booking remains usable when browser storage is unavailable. */
    }
  }

  async function submit(slot: Slot) {
    if (sending.current || session.state !== 'draft') return
    const fields: Record<string, string> = {}
    if (!session.name.trim() || session.name.trim().length > 100)
      fields.guestName = 'Введите от 1 до 100 символов'
    if (
      !session.email.trim() ||
      session.email.trim().length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(session.email.trim())
    )
      fields.guestEmail = 'Введите корректный email до 254 символов'
    setErrors(fields)
    if (Object.keys(fields).length) return
    sending.current = true
    setPending(true)
    setMessage('')
    // A refresh during the request must restore an unresolved result.
    save({ ...session, state: 'uncertain' })
    try {
      const meeting = await api.createMeeting({
        createMeeting: {
          meetingTypeId: id,
          startsAt: slot.startsAt,
          guestName: session.name,
          guestEmail: session.email,
        },
      })
      save({ ...session, state: 'success', meeting })
    } catch (error) {
      let body: ApiError | undefined
      if (error instanceof ResponseError)
        body = await error.response.json().catch(() => undefined)
      if (body?.code === 'VALIDATION_ERROR') {
        save({ ...session, state: 'draft' })
        setErrors(
          Object.fromEntries(
            (body.fieldErrors ?? []).map((field) => [
              field.field,
              field.message,
            ]),
          ),
        )
        setMessage('Проверьте поля формы')
      } else if (
        body &&
        ['SLOT_TAKEN', 'SLOT_EXPIRED', 'INVALID_SLOT'].includes(body.code)
      ) {
        save({ ...session, state: 'draft' })
        setMessage(
          body.code === 'SLOT_TAKEN'
            ? 'Это время уже занято. Выберите другое.'
            : 'Выбранное время недоступно. Выберите другое.',
        )
        refresh()
      } else if (body?.code === 'MEETING_TYPE_NOT_FOUND') {
        save({ ...session, state: 'draft' })
        refresh()
      } else if (body?.code === 'SERVICE_UNAVAILABLE') {
        save({ ...session, state: 'draft' })
        setMessage('Сервис временно недоступен. Повторите попытку.')
      }
      // Missing, malformed and unexpected responses remain uncertain.
    } finally {
      sending.current = false
      setPending(false)
    }
  }

  return {
    ...session,
    pending,
    errors,
    message,
    setName: (name: string) => save({ ...session, name }),
    setEmail: (email: string) => save({ ...session, email }),
    submit,
    restart: () => {
      save({ ...session, state: 'draft', meeting: undefined })
      setMessage('')
      refresh()
    },
  }
}
