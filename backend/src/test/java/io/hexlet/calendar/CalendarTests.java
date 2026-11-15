package io.hexlet.calendar;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
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

    @Test
    @Sql(statements = """
            INSERT INTO meetings VALUES ('00000000-0000-0000-0000-000000000010',
              '00000000-0000-0000-0000-000000000003', '2026-11-16T07:00:00Z',
              '2026-11-16T08:00:00Z', 'Guest', 'guest@example.com');
            """)
    void savedMeetingOfAnotherTypeBlocksEveryOverlapButAllowsAdjacency() throws Exception {
        var body = mapper.readTree(get("00000000-0000-0000-0000-000000000001/slots").body());
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
        Clock testClock() {
            return Clock.fixed(Instant.parse("2026-11-16T06:00:00Z"), ZoneOffset.UTC);
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
