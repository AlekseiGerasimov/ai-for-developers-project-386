package io.hexlet.calendar;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;

final class BookingPolicy {
    static final ZoneId ZONE = ZoneId.of("Europe/Moscow");

    private BookingPolicy() { }

    static boolean valid(Instant start, Instant end, Instant now) {
        var local = start.atZone(ZONE);
        var today = LocalDate.ofInstant(now, ZONE);
        return start.isAfter(now) && !local.toLocalDate().isBefore(today)
                && !local.toLocalDate().isAfter(today.plusDays(13))
                && local.getDayOfWeek() != DayOfWeek.SATURDAY
                && local.getDayOfWeek() != DayOfWeek.SUNDAY
                && !local.toLocalTime().isBefore(LocalTime.of(9, 0))
                && !end.isAfter(local.toLocalDate().atTime(18, 0).atZone(ZONE).toInstant())
                && local.getMinute() % 15 == 0 && local.getSecond() == 0 && local.getNano() == 0;
    }
}
