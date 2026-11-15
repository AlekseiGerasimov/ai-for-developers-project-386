package io.hexlet.calendar;

import io.hexlet.calendar.api.CalendarApi;
import io.hexlet.calendar.model.Availability;
import io.hexlet.calendar.model.MeetingType;
import io.hexlet.calendar.model.Slot;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.dao.EmptyResultDataAccessException;
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
        try {
            return ResponseEntity.ok(jdbc.queryForObject(
                "SELECT * FROM meeting_types WHERE id = ?",
                (row, index) -> new MeetingType().id(id).title(row.getString("title"))
                        .description(row.getString("description"))
                        .durationMinutes(row.getInt("duration_minutes")), id));
        } catch (EmptyResultDataAccessException error) {
            throw new MeetingTypeNotFoundException();
        }
    }

    @Override
    public ResponseEntity<Availability> getSlots(UUID id) {
        var type = getMeetingType(id).getBody();
        var now = clock.instant();
        var zone = BookingPolicy.ZONE;
        var windowStart = BookingPolicy.windowStart(now);
        var windowEnd = BookingPolicy.windowEnd(now);
        var slots = new ArrayList<Slot>();
        var occupied = jdbc.query("SELECT starts_at, ends_at FROM meetings WHERE starts_at < ? AND ends_at > ?",
                (row, index) -> new Slot().startsAt(row.getObject("starts_at", OffsetDateTime.class))
                        .endsAt(row.getObject("ends_at", OffsetDateTime.class)),
                windowEnd.plusDays(1).atStartOfDay(zone).toOffsetDateTime(),
                windowStart.atStartOfDay(zone).toOffsetDateTime());
        for (var start : BookingPolicy.candidateStarts(now)) {
            var end = start.plusSeconds(type.getDurationMinutes() * 60L);
            var overlaps = occupied.stream().anyMatch(meeting ->
                    meeting.getStartsAt().toInstant().isBefore(end)
                            && meeting.getEndsAt().toInstant().isAfter(start));
            if (BookingPolicy.valid(start, end, now) && !overlaps) {
                slots.add(new Slot().startsAt(start.atOffset(ZoneOffset.UTC))
                        .endsAt(end.atOffset(ZoneOffset.UTC)));
            }
        }
        return ResponseEntity.ok(new Availability().timeZone(zone.getId())
                .serverTime(OffsetDateTime.ofInstant(now, ZoneOffset.UTC))
                .windowStartDate(windowStart).windowEndDate(windowEnd).slots(slots));
    }
}
