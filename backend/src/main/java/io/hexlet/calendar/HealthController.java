package io.hexlet.calendar;

import io.hexlet.calendar.api.HealthApi;
import io.hexlet.calendar.model.Health;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HealthController implements HealthApi {
    @Override
    public ResponseEntity<Health> getHealth() {
        return ResponseEntity.ok(new Health().status(Health.StatusEnum.OK));
    }
}
