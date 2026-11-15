package io.hexlet.calendar;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.context.jdbc.SqlMergeMode;
import org.springframework.context.annotation.Import;
import org.springframework.beans.factory.annotation.Autowired;
import tools.jackson.databind.ObjectMapper;
import static org.junit.jupiter.api.Assertions.assertEquals;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = "spring.datasource.url=jdbc:h2:mem:bookings;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=5000")
@Import(CalendarTests.TimeConfiguration.class)
@Sql("/catalog-fixture.sql")
@SqlMergeMode(SqlMergeMode.MergeMode.MERGE)
@Sql(statements = {"DELETE FROM meetings", "DELETE FROM meeting_types"},
        executionPhase = Sql.ExecutionPhase.AFTER_TEST_METHOD)
class BookingTests {
    @LocalServerPort private int port;
    @Autowired private ObjectMapper mapper;
    @Autowired private CalendarTests.ControlledClock clock;
    @Autowired private javax.sql.DataSource dataSource;

    @Test
    void waitingRequestRechecksTimeAfterCalendarLockIsReleased() throws Exception {
        try (var holder = dataSource.getConnection();
                var executor = java.util.concurrent.Executors.newVirtualThreadPerTaskExecutor()) {
            holder.setAutoCommit(false);
            holder.createStatement().executeQuery("SELECT id FROM owner_calendar WHERE id = 1 FOR UPDATE");
            var pending = executor.submit(() -> post("00000000-0000-0000-0000-000000000001",
                    "2026-11-16T06:15:00Z"));
            awaitDatabaseWaiter();
            clock.now.set(java.time.Instant.parse("2026-11-16T06:15:00Z"));
            holder.commit();
            var response = pending.get(10, java.util.concurrent.TimeUnit.SECONDS);
            assertEquals(400, response.statusCode());
            assertEquals("SLOT_EXPIRED", mapper.readTree(response.body()).get("code").asString());
            assertEquals("[]", get().body());
        }
    }

    @Test
    void lockTimeoutIsTechnicalAndRollsBackWithoutSaving() throws Exception {
        try (var holder = dataSource.getConnection();
                var executor = java.util.concurrent.Executors.newVirtualThreadPerTaskExecutor()) {
            holder.setAutoCommit(false);
            holder.createStatement().executeQuery("SELECT id FROM owner_calendar WHERE id = 1 FOR UPDATE");
            var pending = executor.submit(() -> post("00000000-0000-0000-0000-000000000001",
                    "2026-11-16T07:00:00Z"));
            awaitDatabaseWaiter();
            var response = pending.get(10, java.util.concurrent.TimeUnit.SECONDS);
            assertEquals(503, response.statusCode());
            assertEquals("SERVICE_UNAVAILABLE", mapper.readTree(response.body()).get("code").asString());
            holder.rollback();
            assertEquals("[]", get().body());
            assertEquals(201, post("00000000-0000-0000-0000-000000000001",
                    "2026-11-16T07:00:00Z").statusCode());
        }
    }

    private void awaitDatabaseWaiter() throws Exception {
        var deadline = System.nanoTime() + java.util.concurrent.TimeUnit.SECONDS.toNanos(3);
        try (var observer = dataSource.getConnection(); var statement = observer.createStatement()) {
            while (System.nanoTime() < deadline) {
                try (var rows = statement.executeQuery(
                        "SELECT COUNT(*) FROM INFORMATION_SCHEMA.SESSIONS WHERE BLOCKER_ID IS NOT NULL")) {
                    rows.next();
                    if (rows.getInt(1) > 0) { return; }
                }
                Thread.onSpinWait();
            }
        }
        throw new AssertionError("HTTP request never waited for calendar row lock");
    }

    @BeforeEach
    void resetTime() { clock.now.set(java.time.Instant.parse("2026-11-16T06:00:00Z")); }

    @ParameterizedTest
    @CsvSource({"00000000-0000-0000-0000-000000000003", "00000000-0000-0000-0000-000000000001"})
    void simultaneousPartialOverlapOnEmptyCalendarHasOneWinnerAcrossTypes(String secondType) throws Exception {
        try (var executor = java.util.concurrent.Executors.newVirtualThreadPerTaskExecutor()) {
            var ready = new java.util.concurrent.CountDownLatch(2);
            var start = new java.util.concurrent.CountDownLatch(1);
            var first = executor.submit(() -> {
                ready.countDown();
                start.await();
                return post("00000000-0000-0000-0000-000000000003", "2026-11-16T07:00:00Z").statusCode();
            });
            var second = executor.submit(() -> {
                ready.countDown();
                start.await();
                return post(secondType, "2026-11-16T07:30:00Z").statusCode();
            });
            org.junit.jupiter.api.Assertions.assertTrue(ready.await(5, java.util.concurrent.TimeUnit.SECONDS));
            start.countDown();
            var results = new java.util.ArrayList<>(java.util.List.of(first.get(), second.get()));
            java.util.Collections.sort(results);
            assertEquals(java.util.List.of(201, 409), results);
            assertEquals(1, mapper.readTree(get().body()).size());
        }
    }

    @Test
    void adjacencyAndConcurrentNonOverlappingBookingsBothSucceed() throws Exception {
        assertEquals(201, post("00000000-0000-0000-0000-000000000003", "2026-11-16T07:00:00Z").statusCode());
        assertEquals(201, post("00000000-0000-0000-0000-000000000001", "2026-11-16T08:00:00Z").statusCode());
        try (var executor = java.util.concurrent.Executors.newVirtualThreadPerTaskExecutor()) {
            var gate = new java.util.concurrent.CyclicBarrier(2);
            var first = executor.submit(() -> { gate.await(); return post(
                    "00000000-0000-0000-0000-000000000001", "2026-11-16T09:00:00Z").statusCode(); });
            var second = executor.submit(() -> { gate.await(); return post(
                    "00000000-0000-0000-0000-000000000002", "2026-11-16T10:00:00Z").statusCode(); });
            assertEquals(201, first.get());
            assertEquals(201, second.get());
        }
        assertEquals(4, mapper.readTree(get().body()).size());
    }

    @Test
    void bookingReturnsSavedMeetingAndUpcomingList() throws Exception {
        var response = post("00000000-0000-0000-0000-000000000001", "2026-11-16T10:00:00+03:00");
        assertEquals(201, response.statusCode());
        var body = mapper.readTree(response.body());
        assertEquals("2026-11-16T07:00:00Z", body.get("startsAt").asString());
        assertEquals("2026-11-16T07:20:00Z", body.get("endsAt").asString());
        assertEquals("Guest", body.get("guestName").asString());
        assertEquals("Guest@Example.com", body.get("guestEmail").asString());
        assertEquals("[" + response.body() + "]", get().body());
    }

    @Test
    @Sql(statements = """
            INSERT INTO meetings VALUES
            ('00000000-0000-0000-0000-000000000040','00000000-0000-0000-0000-000000000001',
              '2026-11-16T05:00:00Z','2026-11-16T05:20:00Z','Past','past@example.com'),
            ('00000000-0000-0000-0000-000000000041','00000000-0000-0000-0000-000000000001',
              '2026-11-16T06:00:00Z','2026-11-16T06:20:00Z','Now','now@example.com'),
            ('00000000-0000-0000-0000-000000000042','00000000-0000-0000-0000-000000000003',
              '2026-12-16T07:00:00Z','2026-12-16T08:00:00Z','Later','later@example.com'),
            ('00000000-0000-0000-0000-000000000043','00000000-0000-0000-0000-000000000002',
              '2026-11-17T07:00:00Z','2026-11-17T07:30:00Z','Second','second@example.com'),
            ('00000000-0000-0000-0000-000000000044','00000000-0000-0000-0000-000000000001',
              '2026-11-17T07:00:00Z','2026-11-17T07:20:00Z','Third','third@example.com');
            """)
    void upcomingIsStrictFutureSortedByStartThenIdIncludingBeyondBookingWindow() throws Exception {
        var response = get();
        assertEquals(200, response.statusCode());
        var meetings = mapper.readTree(response.body());
        assertEquals(3, meetings.size());
        assertEquals("Second", meetings.get(0).get("guestName").asString());
        assertEquals("Third", meetings.get(1).get("guestName").asString());
        assertEquals("Later", meetings.get(2).get("guestName").asString());
        assertEquals(60, meetings.get(2).get("meetingType").get("durationMinutes").asInt());
    }

    @Test
    void unknownTypeAndMalformedInputsHaveStructuredErrors() throws Exception {
        var missing = post("00000000-0000-0000-0000-000000000099", "2026-11-16T07:00:00Z");
        assertEquals(404, missing.statusCode());
        assertEquals("MEETING_TYPE_NOT_FOUND", mapper.readTree(missing.body()).get("code").asString());
        for (var json : java.util.List.of("null", "{}", "{", """
                {"meetingTypeId":"bad","startsAt":"2026-11-16T07:00:00Z","guestName":"A","guestEmail":"a@b.com"}
                """, """
                {"meetingTypeId":"00000000-0000-0000-0000-000000000001","startsAt":"2026-11-16T07:00:00",
                "guestName":"A","guestEmail":"a@b.com"}
                """)) {
            var response = postJson(json);
            assertEquals(400, response.statusCode());
            assertEquals("VALIDATION_ERROR", mapper.readTree(response.body()).get("code").asString());
        }
    }

    @Test
    void invalidGuestFieldsAreRejectedWithoutSaving() throws Exception {
        for (var field : java.util.List.of("guestName", "guestEmail")) {
            for (var value : java.util.List.of("", "   ", "x".repeat(255))) {
                var input = new java.util.HashMap<String, String>();
                input.put("meetingTypeId", "00000000-0000-0000-0000-000000000001");
                input.put("startsAt", "2026-11-16T07:00:00Z");
                input.put("guestName", "Guest");
                input.put("guestEmail", "Guest@example.com");
                input.put(field, value);
                var response = postJson(mapper.writeValueAsString(input));
                assertEquals(400, response.statusCode());
                var body = mapper.readTree(response.body());
                assertEquals("VALIDATION_ERROR", body.get("code").asString());
                assertEquals(field, body.get("fieldErrors").get(0).get("field").asString());
            }
        }
        assertEquals(400, postJson("""
                {"meetingTypeId":"00000000-0000-0000-0000-000000000001","startsAt":"2026-11-16T07:00:00Z",
                "guestName":"Guest","guestEmail":"not-an-email"}
                """).statusCode());
        assertEquals("[]", get().body());
    }

    @ParameterizedTest
    @CsvSource({
        "2026-11-16T06:00:00Z, SLOT_EXPIRED",
        "2026-11-16T05:45:00Z, SLOT_EXPIRED",
        "2026-11-16T07:01:00Z, INVALID_SLOT",
        "2026-11-16T07:00:01Z, INVALID_SLOT",
        "2026-11-16T07:00:00.001Z, INVALID_SLOT",
        "2026-11-16T15:00:00Z, INVALID_SLOT",
        "2026-11-17T05:45:00Z, INVALID_SLOT",
        "2026-11-21T07:00:00Z, INVALID_SLOT",
        "2026-11-30T07:00:00Z, INVALID_SLOT"
    })
    void bookingRechecksTheWholeCalendarPolicy(String start, String code) throws Exception {
        var response = post("00000000-0000-0000-0000-000000000001", start);
        assertEquals(400, response.statusCode());
        assertEquals(code, mapper.readTree(response.body()).get("code").asString());
        assertEquals("[]", get().body());
    }

    private HttpResponse<String> post(String type, String start) throws Exception {
        return postJson("{\"meetingTypeId\":\"" + type + "\",\"startsAt\":\"" + start
                        + "\",\"guestName\":\" Guest \",\"guestEmail\":\" Guest@Example.com \"}");
    }

    private HttpResponse<String> postJson(String json) throws Exception {
        try (var client = HttpClient.newHttpClient()) {
            return client.send(HttpRequest.newBuilder().uri(URI.create("http://localhost:" + port + "/api/meetings"))
                    .header("Content-Type", "application/json").POST(HttpRequest.BodyPublishers.ofString(json))
                    .build(), HttpResponse.BodyHandlers.ofString());
        }
    }

    private HttpResponse<String> get() throws Exception {
        try (var client = HttpClient.newHttpClient()) {
            return client.send(HttpRequest.newBuilder().uri(URI.create("http://localhost:" + port + "/api/meetings"))
                    .GET().build(), HttpResponse.BodyHandlers.ofString());
        }
    }
}
