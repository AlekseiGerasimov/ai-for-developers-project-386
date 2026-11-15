package io.hexlet.calendar;

import io.hexlet.calendar.api.CalendarApi;
import io.hexlet.calendar.model.Availability;
import io.hexlet.calendar.model.MeetingType;
import io.hexlet.calendar.model.Slot;
import java.time.Clock;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class CalendarController implements CalendarApi {
    private final JdbcTemplate jdbc;
    private final Clock clock;

    public CalendarController(JdbcTemplate jdbc, Clock clock) {
        this.jdbc = jdbc;
        this.clock = clock;
    }

    @Override
    public ResponseEntity<MeetingType> getMeetingType(UUID id) {
        return ResponseEntity.ok(jdbc.queryForObject(
                "SELECT * FROM meeting_types WHERE id = ?",
                (row, index) -> new MeetingType().id(id).title(row.getString("title"))
                        .description(row.getString("description"))
                        .durationMinutes(row.getInt("duration_minutes")), id));
    }

    @Override
    public ResponseEntity<Availability> getSlots(UUID id) {
        var type = getMeetingType(id).getBody();
        var now = clock.instant();
        var zone = ZoneId.of("Europe/Moscow");
        var today = LocalDate.ofInstant(now, zone);
        var slots = new ArrayList<Slot>();
        var occupied = jdbc.query("SELECT starts_at, ends_at FROM meetings WHERE starts_at < ? AND ends_at > ?",
                (row, index) -> new Slot().startsAt(row.getObject("starts_at", OffsetDateTime.class))
                        .endsAt(row.getObject("ends_at", OffsetDateTime.class)),
                today.plusDays(14).atStartOfDay(zone).toOffsetDateTime(),
                today.atStartOfDay(zone).toOffsetDateTime());
        for (var day = today; !day.isAfter(today.plusDays(13)); day = day.plusDays(1)) {
            if (day.getDayOfWeek() == DayOfWeek.SATURDAY || day.getDayOfWeek() == DayOfWeek.SUNDAY) {
                continue;
            }
            var closing = day.atTime(18, 0).atZone(zone).toInstant();
            for (var start = day.atTime(9, 0).atZone(zone).toInstant();
                    start.isBefore(closing); start = start.plusSeconds(900)) {
                var end = start.plusSeconds(type.getDurationMinutes() * 60L);
                var candidate = start;
                var overlaps = occupied.stream().anyMatch(meeting ->
                        meeting.getStartsAt().toInstant().isBefore(end)
                                && meeting.getEndsAt().toInstant().isAfter(candidate));
                if (start.isAfter(now) && !end.isAfter(closing) && !overlaps) {
                    slots.add(new Slot().startsAt(start.atOffset(ZoneOffset.UTC))
                            .endsAt(end.atOffset(ZoneOffset.UTC)));
                }
            }
        }
        return ResponseEntity.ok(new Availability().timeZone(zone.getId())
                .serverTime(OffsetDateTime.ofInstant(now, ZoneOffset.UTC))
                .windowStartDate(today).windowEndDate(today.plusDays(13)).slots(slots));
    }
}
