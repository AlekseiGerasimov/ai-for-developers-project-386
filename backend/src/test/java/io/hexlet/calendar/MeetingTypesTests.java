package io.hexlet.calendar;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.jdbc.Sql;
import tools.jackson.databind.ObjectMapper;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = "spring.datasource.url=jdbc:h2:mem:catalog-empty;DB_CLOSE_DELAY=-1")
class MeetingTypesTests {
    @Test
    void invalidFieldsAndMalformedJsonUseSharedErrorContract() throws Exception {
        try (var client = HttpClient.newHttpClient()) {
            for (var body : new String[] {
                "{\"title\":\"  \",\"description\":\"x\",\"durationMinutes\":20}",
                "{\"title\":\"x\",\"description\":\" \",\"durationMinutes\":20}",
                "{\"title\":\"x\",\"description\":\"x\",\"durationMinutes\":0}",
                "{\"title\":\"x\",\"description\":\"x\",\"durationMinutes\":1.5}",
                "{}", "{", "{\"title\":{},\"description\":\"x\",\"durationMinutes\":20}",
                "{\"title\":null,\"description\":\"x\",\"durationMinutes\":20}",
                "{\"title\":\"x\",\"description\":\"x\",\"durationMinutes\":481}",
                "{\"title\":\"x\",\"description\":\"x\",\"durationMinutes\":\"20\"}",
                "{\"title\":123,\"description\":\"x\",\"durationMinutes\":20}",
                "{\"title\":false,\"description\":\"x\",\"durationMinutes\":20}",
                "{\"title\":\"x\",\"description\":123.5,\"durationMinutes\":20}",
                "{\"title\":\"x\",\"description\":true,\"durationMinutes\":20}",
                "{\"title\":\"" + "a".repeat(101) + "\",\"description\":\"x\",\"durationMinutes\":20}",
                "{\"title\":\"x\",\"description\":\"" + "a".repeat(2001) + "\",\"durationMinutes\":20}",
                "{\"title\":\"" + "𐐀".repeat(101) + "\",\"description\":\"x\",\"durationMinutes\":20}",
                "{\"title\":\"x\",\"description\":\"" + "𐐀".repeat(2001) + "\",\"durationMinutes\":20}"
            }) {
                var response = client.send(HttpRequest.newBuilder()
                        .uri(URI.create("http://localhost:" + port + "/api/meeting-types"))
                        .header("Content-Type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString(body)).build(), HttpResponse.BodyHandlers.ofString());
                assertEquals(400, response.statusCode(), body);
                var error = mapper.readTree(response.body());
                assertEquals("VALIDATION_ERROR", error.get("code").asText(), body);
                assertTrue(error.get("fieldErrors").isArray(), body);
            }
        }
    }

    @ParameterizedTest
    @ValueSource(strings = {"a", "𐐀"})
    @Sql(statements = "DELETE FROM meeting_types", executionPhase = Sql.ExecutionPhase.AFTER_TEST_METHOD)
    void trimmedMaximumLengthsAndDuplicateTitlesAreAllowed(String letter) throws Exception {
        try (var client = HttpClient.newHttpClient()) {
            for (var duration : new int[] {1, 480}) {
                var body = "{\"title\":\" " + letter.repeat(100) + " \",\"description\":\" "
                        + letter.repeat(2000) + " \",\"durationMinutes\":" + duration + "}";
                var response = client.send(HttpRequest.newBuilder()
                        .uri(URI.create("http://localhost:" + port + "/api/meeting-types"))
                        .header("Content-Type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString(body)).build(), HttpResponse.BodyHandlers.ofString());
                assertEquals(201, response.statusCode());
                assertEquals(letter.repeat(100), mapper.readTree(response.body()).get("title").asText());
                assertEquals(letter.repeat(2000), mapper.readTree(response.body()).get("description").asText());
            }
            var catalog = client.send(HttpRequest.newBuilder()
                    .uri(URI.create("http://localhost:" + port + "/api/meeting-types"))
                    .GET().build(), HttpResponse.BodyHandlers.ofString());
            assertEquals(2, mapper.readTree(catalog.body()).size());
        }
    }
    @Test
    @Sql(statements = "DELETE FROM meeting_types", executionPhase = Sql.ExecutionPhase.AFTER_TEST_METHOD)
    void ownerCreatesTrimmedTypeThatAppearsInCatalog() throws Exception {
        try (var client = HttpClient.newHttpClient()) {
            var response = client.send(HttpRequest.newBuilder()
                    .uri(URI.create("http://localhost:" + port + "/api/meeting-types"))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString("""
                            {"title":"  Знакомство  ","description":" Обсудим задачу ","durationMinutes":20}
                            """)).build(), HttpResponse.BodyHandlers.ofString());
            assertEquals(201, response.statusCode());
            var created = mapper.readTree(response.body());
            java.util.UUID.fromString(created.get("id").asText());
            assertEquals("Знакомство", created.get("title").asText());
            assertEquals("Обсудим задачу", created.get("description").asText());
            assertEquals(20, created.get("durationMinutes").asInt());
            var catalog = client.send(HttpRequest.newBuilder()
                    .uri(URI.create("http://localhost:" + port + "/api/meeting-types"))
                    .GET().build(), HttpResponse.BodyHandlers.ofString());
            assertEquals(created, mapper.readTree(catalog.body()).get(0));
        }
    }
    @LocalServerPort
    private int port;

    @Autowired
    private ObjectMapper mapper;

    @Test
    @Sql("/catalog-fixture.sql")
    @Sql(statements = "DELETE FROM meeting_types", executionPhase = Sql.ExecutionPhase.AFTER_TEST_METHOD)
    void catalogReturnsFullObjectsOrderedByTitleThenId() throws Exception {
        try (var client = HttpClient.newHttpClient()) {
            var response = client.send(HttpRequest.newBuilder()
                    .uri(URI.create("http://localhost:" + port + "/api/meeting-types"))
                    .GET().build(), HttpResponse.BodyHandlers.ofString());
            assertEquals(200, response.statusCode());
            assertTrue(response.headers().firstValue("Content-Type").orElse("")
                    .startsWith("application/json"));
            assertEquals(mapper.readTree("""
                    [
                      {"id":"00000000-0000-0000-0000-000000000001","title":"Знакомство",
                       "description":"Обсудим задачу","durationMinutes":20},
                      {"id":"00000000-0000-0000-0000-000000000002","title":"Знакомство",
                       "description":"Подробное знакомство","durationMinutes":30},
                      {"id":"00000000-0000-0000-0000-000000000003","title":"Консультация",
                       "description":"Разберём вопросы","durationMinutes":60}
                    ]
                    """), mapper.readTree(response.body()));
        }
    }

    @Test
    void newCalendarHasAnEmptyCatalog() throws Exception {
        try (var client = HttpClient.newHttpClient()) {
            var response = client.send(HttpRequest.newBuilder()
                    .uri(URI.create("http://localhost:" + port + "/api/meeting-types"))
                    .GET().build(), HttpResponse.BodyHandlers.ofString());
            assertEquals(200, response.statusCode());
            assertTrue(response.headers().firstValue("Content-Type").orElse("")
                    .startsWith("application/json"));
            assertEquals("[]", response.body());
        }
    }
}
