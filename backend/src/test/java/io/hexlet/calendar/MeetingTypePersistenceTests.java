package io.hexlet.calendar;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.web.server.context.WebServerApplicationContext;
import com.zaxxer.hikari.HikariDataSource;

import static org.junit.jupiter.api.Assertions.assertEquals;

class MeetingTypePersistenceTests {
    @TempDir
    private Path temporary;

    @Test
    void createdMeetingSurvivesMigrationAndDatabaseFailureIsTechnical() throws Exception {
        var database = temporary.resolve("bookings").toString().replace('\\', '/');
        var args = new String[] {"--server.port=0", "--spring.datasource.url=jdbc:h2:file:" + database,
            "--spring.profiles.active=e2e"};
        var oldSchemaArgs = new String[] {args[0], args[1], args[2], "--spring.flyway.target=2"};
        String created;
        try (var client = HttpClient.newHttpClient()) {
            try (var context = SpringApplication.run(CalendarApplication.class, oldSchemaArgs)) {
                var port = ((WebServerApplicationContext) context).getWebServer().getPort();
                var type = client.send(HttpRequest.newBuilder()
                        .uri(URI.create("http://localhost:" + port + "/api/meeting-types"))
                        .header("Content-Type", "application/json").POST(HttpRequest.BodyPublishers.ofString("""
                                {"title":"Сохраняется","description":"Встреча","durationMinutes":20}
                                """)).build(), HttpResponse.BodyHandlers.ofString());
                var mapper = context.getBean(tools.jackson.databind.ObjectMapper.class);
                var id = mapper.readTree(type.body()).get("id").asString();
                var response = client.send(HttpRequest.newBuilder()
                        .uri(URI.create("http://localhost:" + port + "/api/meetings"))
                        .header("Content-Type", "application/json").POST(HttpRequest.BodyPublishers.ofString(
                                "{\"meetingTypeId\":\"" + id + "\",\"startsAt\":\"2026-11-17T07:00:00Z\","
                                + "\"guestName\":\"Гость\",\"guestEmail\":\"Guest@example.com\"}"))
                        .build(), HttpResponse.BodyHandlers.ofString());
                assertEquals(201, response.statusCode());
                created = response.body();
            }
            try (var context = SpringApplication.run(CalendarApplication.class, args)) {
                var port = ((WebServerApplicationContext) context).getWebServer().getPort();
                var uri = URI.create("http://localhost:" + port + "/api/meetings");
                var response = client.send(HttpRequest.newBuilder().uri(uri).GET().build(),
                        HttpResponse.BodyHandlers.ofString());
                assertEquals("[" + created + "]", response.body());
                var mapper = context.getBean(tools.jackson.databind.ObjectMapper.class);
                var name = "𐐀".repeat(100);
                var unicode = client.send(HttpRequest.newBuilder().uri(uri)
                        .header("Content-Type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(java.util.Map.of(
                                "meetingTypeId", mapper.readTree(created).get("meetingType").get("id").asString(),
                                "startsAt", "2026-11-18T07:00:00Z", "guestName", name,
                                "guestEmail", "Guest@example.com"))))
                        .build(), HttpResponse.BodyHandlers.ofString());
                assertEquals(201, unicode.statusCode());
                var upcoming = client.send(HttpRequest.newBuilder().uri(uri).GET().build(),
                        HttpResponse.BodyHandlers.ofString());
                assertEquals("[" + created + "," + unicode.body() + "]", upcoming.body());
                assertEquals(name, mapper.readTree(unicode.body()).get("guestName").asString());
                context.getBean(HikariDataSource.class).close();
                var failed = client.send(HttpRequest.newBuilder().uri(uri).header("Content-Type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString("""
                                {"meetingTypeId":"00000000-0000-0000-0000-000000000001",
                                "startsAt":"2026-11-17T07:00:00Z","guestName":"A","guestEmail":"a@example.com"}
                                """)).build(), HttpResponse.BodyHandlers.ofString());
                assertEquals(503, failed.statusCode());
                org.junit.jupiter.api.Assertions.assertTrue(failed.body().contains("SERVICE_UNAVAILABLE"));
            }
        }
    }

    @Test
    void unavailableDatabaseReturnsTechnicalErrorWithoutSqlDetails() throws Exception {
        try (var context = SpringApplication.run(CalendarApplication.class,
                "--server.port=0", "--spring.datasource.url=jdbc:h2:mem:unavailable");
                var client = HttpClient.newHttpClient()) {
            context.getBean(HikariDataSource.class).close();
            var port = ((WebServerApplicationContext) context).getWebServer().getPort();
            var response = client.send(HttpRequest.newBuilder()
                    .uri(URI.create("http://localhost:" + port + "/api/meeting-types"))
                    .GET().build(), HttpResponse.BodyHandlers.ofString());
            assertEquals(503, response.statusCode());
            assertEquals("{\"code\":\"SERVICE_UNAVAILABLE\",\"message\":\"Сервис временно недоступен\",\"fieldErrors\":[]}",
                    response.body());
        }
    }

    @Test
    void createdTypeSurvivesMigrationAndAcceptsUnicodeAtMaximumLengths() throws Exception {
        var database = temporary.resolve("calendar").toString().replace('\\', '/');
        var args = new String[] {"--server.port=0", "--spring.datasource.url=jdbc:h2:file:" + database};
        var oldSchemaArgs = new String[] {args[0], args[1], "--spring.flyway.target=2"};
        String created;
        try (var client = HttpClient.newHttpClient()) {
            try (var context = SpringApplication.run(CalendarApplication.class, oldSchemaArgs)) {
                var port = ((WebServerApplicationContext) context).getWebServer().getPort();
                var response = client.send(HttpRequest.newBuilder()
                        .uri(URI.create("http://localhost:" + port + "/api/meeting-types"))
                        .header("Content-Type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString("""
                                {"title":"Сохраняется","description":"После перезапуска","durationMinutes":480}
                                """)).build(), HttpResponse.BodyHandlers.ofString());
                assertEquals(201, response.statusCode());
                created = response.body();
            }
            try (var context = SpringApplication.run(CalendarApplication.class, args)) {
                var port = ((WebServerApplicationContext) context).getWebServer().getPort();
                var response = client.send(HttpRequest.newBuilder()
                        .uri(URI.create("http://localhost:" + port + "/api/meeting-types"))
                        .GET().build(), HttpResponse.BodyHandlers.ofString());
                assertEquals(200, response.statusCode());
                assertEquals("[" + created + "]", response.body());
                var mapper = context.getBean(tools.jackson.databind.ObjectMapper.class);
                var uri = URI.create("http://localhost:" + port + "/api/meeting-types");
                var title = "𐐀".repeat(100);
                var description = "𐐀".repeat(2000);
                var unicode = client.send(HttpRequest.newBuilder().uri(uri)
                        .header("Content-Type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(java.util.Map.of(
                                "title", title, "description", description, "durationMinutes", 20))))
                        .build(), HttpResponse.BodyHandlers.ofString());
                assertEquals(201, unicode.statusCode());
                var catalog = client.send(HttpRequest.newBuilder().uri(uri).GET().build(),
                        HttpResponse.BodyHandlers.ofString());
                assertEquals(2, mapper.readTree(catalog.body()).size());
                org.junit.jupiter.api.Assertions.assertTrue(catalog.body().contains(created));
                org.junit.jupiter.api.Assertions.assertTrue(catalog.body().contains(unicode.body()));
                assertEquals(title, mapper.readTree(unicode.body()).get("title").asString());
                assertEquals(description, mapper.readTree(unicode.body()).get("description").asString());
            }
        }
    }
}
