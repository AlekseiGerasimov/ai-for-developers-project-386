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
    void createdTypeSurvivesApplicationRestartUsingSameFile() throws Exception {
        var database = temporary.resolve("calendar").toString().replace('\\', '/');
        var args = new String[] {"--server.port=0", "--spring.datasource.url=jdbc:h2:file:" + database};
        String created;
        try (var client = HttpClient.newHttpClient()) {
            try (var context = SpringApplication.run(CalendarApplication.class, args)) {
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
            }
        }
    }
}
