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
op listMeetingTypes(): MeetingType[];

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
op getMeetingType(@path @format("uuid") id: string): MeetingType;

@route("/api/meeting-types/{id}/slots")
@tag("Calendar")
@get
op getSlots(@path @format("uuid") id: string): Availability;
