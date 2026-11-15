package io.hexlet.calendar;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.ZoneId;
import java.time.LocalDate;
import java.time.DayOfWeek;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import tools.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.context.jdbc.SqlMergeMode;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = "spring.datasource.url=jdbc:h2:mem:calendar;DB_CLOSE_DELAY=-1")
@Sql("/catalog-fixture.sql")
@SqlMergeMode(SqlMergeMode.MergeMode.MERGE)
@Import(CalendarTests.TimeConfiguration.class)
@Sql(statements = {"DELETE FROM meetings", "DELETE FROM meeting_types"},
        executionPhase = Sql.ExecutionPhase.AFTER_TEST_METHOD)
class CalendarTests {
    @LocalServerPort
    private int port;

    @Autowired
    private ObjectMapper mapper;

    @Autowired
    private ControlledClock clock;

    @BeforeEach
    void resetTime() {
        clock.now.set(Instant.parse("2026-11-16T06:00:00Z"));
    }

    static class ControlledClock extends Clock {
        private final AtomicReference<Instant> now = new AtomicReference<>();

        @Override
        public ZoneId getZone() { return ZoneOffset.UTC; }

        @Override
        public Clock withZone(ZoneId zone) { return Clock.fixed(instant(), zone); }

        @Override
        public Instant instant() { return now.get(); }
    }

    @ParameterizedTest
    @CsvSource({
        "2026-11-15T20:59:59Z, 2026-11-15, 2026-11-28, 2026-11-16T06:00:00Z, 2026-11-27T14:30:00Z",
        "2026-11-15T21:00:00Z, 2026-11-16, 2026-11-29, 2026-11-16T06:00:00Z, 2026-11-27T14:30:00Z",
        "2026-11-16T06:14:59.999Z, 2026-11-16, 2026-11-29, 2026-11-16T06:15:00Z, 2026-11-27T14:30:00Z",
        "2026-11-16T06:15:00Z, 2026-11-16, 2026-11-29, 2026-11-16T06:30:00Z, 2026-11-27T14:30:00Z",
        "2026-11-16T14:30:00Z, 2026-11-16, 2026-11-29, 2026-11-17T06:00:00Z, 2026-11-27T14:30:00Z",
        "2026-11-17T05:00:00Z, 2026-11-17, 2026-11-30, 2026-11-17T06:00:00Z, 2026-11-30T14:30:00Z"
    })
    void windowChangesAtMoscowMidnightAndStartsAreStrictlyFuture(String now, String firstDate,
            String lastDate, String firstStart, String lastStart) throws Exception {
        clock.now.set(Instant.parse(now));
        var body = mapper.readTree(get("00000000-0000-0000-0000-000000000001/slots").body());
        assertEquals(firstDate, body.get("windowStartDate").asString());
        assertEquals(lastDate, body.get("windowEndDate").asString());
        var slots = body.get("slots");
        assertEquals(firstStart, slots.get(0).get("startsAt").asString());
        assertEquals(lastStart, slots.get(slots.size() - 1).get("startsAt").asString());
        Instant previous = Instant.MIN;
        for (var slot : slots) {
            var start = Instant.parse(slot.get("startsAt").asString());
            var end = Instant.parse(slot.get("endsAt").asString());
            var local = start.atZone(ZoneId.of("Europe/Moscow"));
            assertTrue(start.isAfter(previous));
            assertTrue(start.isAfter(clock.instant()));
            assertTrue(local.getDayOfWeek() != DayOfWeek.SATURDAY && local.getDayOfWeek() != DayOfWeek.SUNDAY);
            assertTrue(local.getHour() >= 9 && end.atZone(local.getZone()).getHour() < 18);
            assertEquals(0, local.getMinute() % 15);
            assertEquals(0, local.getSecond());
            assertEquals(0, local.getNano());
            assertEquals(Duration.ofMinutes(20), Duration.between(start, end));
            assertTrue(!local.toLocalDate().isBefore(LocalDate.parse(firstDate)));
            assertTrue(!local.toLocalDate().isAfter(LocalDate.parse(lastDate)));
            previous = start;
        }
    }

    @Test
    @Sql(statements = "UPDATE meeting_types SET duration_minutes = 1 WHERE id = '00000000-0000-0000-0000-000000000001'")
    void oneMinuteDurationEndsExactlyOneMinuteLaterAndLastStartIs1745() throws Exception {
        var slots = mapper.readTree(get("00000000-0000-0000-0000-000000000001/slots").body()).get("slots");
        assertEquals("2026-11-16T06:16:00Z", slots.get(0).get("endsAt").asString());
        assertEquals("2026-11-27T14:45:00Z", slots.get(slots.size() - 1).get("startsAt").asString());
    }

    @Test
    @Sql(statements = "UPDATE meeting_types SET duration_minutes = 480 WHERE id = '00000000-0000-0000-0000-000000000001'")
    void eightHourDurationAllowsLastStartAt1000EndingExactlyAt1800() throws Exception {
        var slots = mapper.readTree(get("00000000-0000-0000-0000-000000000001/slots").body()).get("slots");
        assertEquals(49, slots.size());
        assertEquals("2026-11-27T07:00:00Z", slots.get(slots.size() - 1).get("startsAt").asString());
        assertEquals("2026-11-27T15:00:00Z", slots.get(slots.size() - 1).get("endsAt").asString());
    }

    @Test
    void thirtyMinuteTypeCanFinishExactlyAtClosing() throws Exception {
        var slots = mapper.readTree(get("00000000-0000-0000-0000-000000000002/slots").body()).get("slots");
        assertEquals("2026-11-27T14:30:00Z", slots.get(slots.size() - 1).get("startsAt").asString());
        assertEquals("2026-11-27T15:00:00Z", slots.get(slots.size() - 1).get("endsAt").asString());
    }

    @Test
    @Sql("/calendar-full-fixture.sql")
    void fullyOccupiedWindowStillReturnsMetadataAndEmptySlots() throws Exception {
        var response = get("00000000-0000-0000-0000-000000000001/slots");
        assertEquals(200, response.statusCode());
        var body = mapper.readTree(response.body());
        assertEquals("Europe/Moscow", body.get("timeZone").asString());
        assertEquals("2026-11-16", body.get("windowStartDate").asString());
        assertEquals("2026-11-29", body.get("windowEndDate").asString());
        assertEquals(0, body.get("slots").size());
    }

    @Test
    void missingTypeAndMalformedIdReturnStructuredErrors() throws Exception {
        for (var suffix : new String[] {"", "/slots"}) {
            var missing = get("00000000-0000-0000-0000-000000000099" + suffix);
            assertEquals(404, missing.statusCode());
            assertEquals("MEETING_TYPE_NOT_FOUND", mapper.readTree(missing.body()).get("code").asString());
            var invalid = get("invalid" + suffix);
            assertEquals(400, invalid.statusCode());
            assertEquals("VALIDATION_ERROR", mapper.readTree(invalid.body()).get("code").asString());
        }
    }

    @Test
    @Sql(statements = """
            INSERT INTO meetings VALUES ('00000000-0000-0000-0000-000000000010',
              '00000000-0000-0000-0000-000000000003', '2026-11-16T07:00:00Z',
              '2026-11-16T08:00:00Z', 'Guest', 'guest@example.com');
            """)
    void savedMeetingOfAnotherTypeBlocksEveryOverlapButAllowsAdjacency() throws Exception {
        var body = mapper.readTree(get("00000000-0000-0000-0000-000000000002/slots").body());
        var starts = new java.util.ArrayList<String>();
        body.get("slots").forEach(slot -> starts.add(slot.get("startsAt").asString()));
        assertTrue(starts.contains("2026-11-16T06:30:00Z"));
        assertTrue(starts.contains("2026-11-16T08:00:00Z"));
        assertTrue(!starts.contains("2026-11-16T06:45:00Z"));
        assertTrue(!starts.contains("2026-11-16T07:30:00Z"));
        assertTrue(!starts.contains("2026-11-16T07:45:00Z"));
    }

    @TestConfiguration
    static class TimeConfiguration {
        @Bean
        @Primary
        ControlledClock testClock() {
            return new ControlledClock();
        }
    }

    @Test
    void availabilityUsesMoscowWindowAndStrictFutureGridWithoutRoundingDuration() throws Exception {
        var response = get("00000000-0000-0000-0000-000000000001/slots");
        assertEquals(200, response.statusCode());
        var body = mapper.readTree(response.body());
        assertEquals("Europe/Moscow", body.get("timeZone").asString());
        assertEquals("2026-11-16T06:00:00Z", body.get("serverTime").asString());
        assertEquals("2026-11-16", body.get("windowStartDate").asString());
        assertEquals("2026-11-29", body.get("windowEndDate").asString());
        assertEquals("2026-11-16T06:15:00Z", body.get("slots").get(0).get("startsAt").asString());
        assertEquals("2026-11-16T06:35:00Z", body.get("slots").get(0).get("endsAt").asString());
        assertEquals("2026-11-27T14:30:00Z", body.get("slots").get(body.get("slots").size() - 1)
                .get("startsAt").asString());
    }

    @Test
    void directLinkReturnsTheFullMeetingType() throws Exception {
        var response = get("00000000-0000-0000-0000-000000000001");
        assertEquals(200, response.statusCode());
        assertTrue(response.body().contains("\"durationMinutes\":20"));
        assertTrue(response.body().contains("Обсудим задачу"));
    }

    private HttpResponse<String> get(String path) throws Exception {
        try (var client = HttpClient.newHttpClient()) {
            return client.send(HttpRequest.newBuilder()
                    .uri(URI.create("http://localhost:" + port + "/api/meeting-types/" + path))
                    .GET().build(), HttpResponse.BodyHandlers.ofString());
        }
    }
}
