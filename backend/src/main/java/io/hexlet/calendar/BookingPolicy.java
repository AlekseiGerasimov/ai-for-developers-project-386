package io.hexlet.calendar;

import java.time.DayOfWeek;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;

final class BookingPolicy {
    static final ZoneId ZONE = ZoneId.of("Europe/Moscow");
    private static final int WINDOW_DAYS = 14;
    private static final LocalTime WORK_START = LocalTime.of(9, 0);
    private static final LocalTime WORK_END = LocalTime.of(18, 0);
    private static final Duration START_STEP = Duration.ofMinutes(15);

    private BookingPolicy() { }

    static LocalDate windowStart(Instant now) {
        return LocalDate.ofInstant(now, ZONE);
    }

    static LocalDate windowEnd(Instant now) {
        return windowStart(now).plusDays(WINDOW_DAYS - 1);
    }

    static List<Instant> candidateStarts(Instant now) {
        var starts = new ArrayList<Instant>();
        var lastDay = windowEnd(now);
        for (var day = windowStart(now); !day.isAfter(lastDay); day = day.plusDays(1)) {
            if (!isWorkingDay(day)) {
                continue;
            }
            var closing = day.atTime(WORK_END).atZone(ZONE).toInstant();
            for (var start = day.atTime(WORK_START).atZone(ZONE).toInstant();
                    start.isBefore(closing); start = start.plus(START_STEP)) {
                starts.add(start);
            }
        }
        return starts;
    }

    static boolean valid(Instant start, Instant end, Instant now) {
        var local = start.atZone(ZONE);
        return start.isAfter(now) && !local.toLocalDate().isBefore(windowStart(now))
                && !local.toLocalDate().isAfter(windowEnd(now))
                && isWorkingDay(local.toLocalDate())
                && !local.toLocalTime().isBefore(WORK_START)
                && !end.isAfter(local.toLocalDate().atTime(WORK_END).atZone(ZONE).toInstant())
                && Duration.between(WORK_START, local.toLocalTime()).toSeconds() % START_STEP.toSeconds() == 0
                && local.getNano() == 0;
    }

    private static boolean isWorkingDay(LocalDate day) {
        return day.getDayOfWeek() != DayOfWeek.SATURDAY && day.getDayOfWeek() != DayOfWeek.SUNDAY;
    }
}
