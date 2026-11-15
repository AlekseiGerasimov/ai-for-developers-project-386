package io.hexlet.calendar;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

@Configuration
@Profile("e2e")
public class BrowserTimeConfiguration {
    @Bean
    public Clock browserClock() {
        return Clock.fixed(Instant.parse("2026-11-16T06:00:00Z"), ZoneOffset.UTC);
    }
}
