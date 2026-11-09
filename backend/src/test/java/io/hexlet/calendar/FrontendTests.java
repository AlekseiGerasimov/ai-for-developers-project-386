package io.hexlet.calendar;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class FrontendTests {
    @LocalServerPort
    private int port;

    @Test
    void servesApplicationAndItsAssetsAtPublicPageUrls() throws Exception {
        try (var client = HttpClient.newHttpClient()) {
            for (var page : new String[] {"/", "/meetings"}) {
                var response = get(client, page);
                assertEquals(200, response.statusCode(), page);
                assertTrue(contentType(response).startsWith("text/html"), page);
                assertTrue(response.body().contains("<div id=\"root\"></div>"), page);

                var assets = Pattern.compile("(?:src|href)=\"(/assets/[^\"]+)\"")
                        .matcher(response.body()).results()
                        .map(match -> match.group(1)).toList();
                assertTrue(assets.stream().anyMatch(asset -> asset.endsWith(".js")));
                assertTrue(assets.stream().anyMatch(asset -> asset.endsWith(".css")));
                for (var asset : assets) {
                    var resource = get(client, asset);
                    assertEquals(200, resource.statusCode(), asset);
                    assertFalse(resource.body().isBlank(), asset);
                    if (asset.endsWith(".js")) {
                        assertTrue(contentType(resource).contains("javascript"), asset);
                    } else if (asset.endsWith(".css")) {
                        assertTrue(contentType(resource).startsWith("text/css"), asset);
                    }
                }
            }
        }
    }

    @Test
    void missingApiAndStaticResourcesRemainNotFound() throws Exception {
        try (var client = HttpClient.newHttpClient()) {
            for (var route : new String[] {"/api/missing", "/assets/missing.js", "/missing"}) {
                assertEquals(404, get(client, route).statusCode(), route);
            }
        }
    }

    private HttpResponse<String> get(HttpClient client, String route) throws Exception {
        var request = HttpRequest.newBuilder()
                .uri(URI.create("http://localhost:" + port + route))
                .timeout(Duration.ofSeconds(5)).GET().build();
        return client.send(request, HttpResponse.BodyHandlers.ofString());
    }

    private String contentType(HttpResponse<?> response) {
        return response.headers().firstValue("Content-Type").orElse("");
    }
}
