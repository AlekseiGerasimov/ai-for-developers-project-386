import "@typespec/http";
import "@typespec/openapi";
import "@typespec/openapi3";

using TypeSpec.Http;

@service(#{ title: "Calendar API" })
@TypeSpec.OpenAPI.info(#{ version: "0.1.0" })
namespace Calendar;

model Health {
  status: "ok";
}

@route("/api/health")
@tag("Health")
@get
op getHealth(): Health;

model MeetingType {
  @format("uuid") id: string;
  @minLength(1) @maxLength(100) title: string;
  @minLength(1) @maxLength(2000) description: string;
  @minValue(1) @maxValue(480) durationMinutes: int32;
}

@route("/api/meeting-types")
@tag("MeetingTypes")
@get

op listMeetingTypes(): MeetingType[] | ServiceUnavailable | InternalError;

model CreateMeetingType {
  @doc("Plain text, trimmed before validating length 1–100.") title: string;
  @doc("Plain text, trimmed before validating length 1–2000.") description: string;
  @minValue(1) @maxValue(480) durationMinutes: int32;
}

model FieldError {
  field: string;
  message: string;
}

model ApiError {
  code: string;
  message: string;
  fieldErrors?: FieldError[];
}

@error model ValidationError {
  @statusCode statusCode: 400;
  @body body: ApiError;
}

@error model ServiceUnavailable {
  @statusCode statusCode: 503;
  @body body: ApiError;
}

@error model InternalError {
  @statusCode statusCode: 500;
  @body body: ApiError;
}

@route("/api/meeting-types")
@tag("MeetingTypes")
@post
op createMeetingType(@body input: CreateMeetingType): {
  @statusCode statusCode: 201;
  @body body: MeetingType;
} | ValidationError | ServiceUnavailable | InternalError;
model Slot {
  startsAt: utcDateTime;
  endsAt: utcDateTime;
}

model Availability {
  timeZone: string;
  serverTime: utcDateTime;
  windowStartDate: plainDate;
  windowEndDate: plainDate;
  slots: Slot[];
}

@route("/api/meeting-types/{id}")
@tag("Calendar")
@get
op getMeetingType(@path @format("uuid") id: string): MeetingType | MeetingTypeNotFound | ValidationError | ServiceUnavailable | InternalError;

@route("/api/meeting-types/{id}/slots")
@tag("Calendar")
@get
op getSlots(@path @format("uuid") id: string): Availability | MeetingTypeNotFound | ValidationError | ServiceUnavailable | InternalError;

@error model MeetingTypeNotFound {
  @statusCode statusCode: 404;
  @body body: ApiError;
}

model CreateMeeting {
  @format("uuid") meetingTypeId: string;
  startsAt: utcDateTime;
  guestName: string;
  guestEmail: string;
}

model Meeting {
  @format("uuid") id: string;
  meetingType: MeetingType;
  startsAt: utcDateTime;
  endsAt: utcDateTime;
  @minLength(1) @maxLength(100) guestName: string;
  @maxLength(254) guestEmail: string;
}

@error model SlotTaken {
  @statusCode statusCode: 409;
  @body body: ApiError;
}

@route("/api/meetings")
@tag("Meetings")
@post
op createMeeting(@body input: CreateMeeting): {
  @statusCode statusCode: 201;
  @body body: Meeting;
} | ValidationError | MeetingTypeNotFound | SlotTaken | ServiceUnavailable | InternalError;

@route("/api/meetings")
@tag("Meetings")
@get
op listMeetings(): Meeting[] | ServiceUnavailable | InternalError;
