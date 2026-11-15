package io.hexlet.calendar;

import io.hexlet.calendar.api.MeetingTypesApi;
import io.hexlet.calendar.model.MeetingType;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class MeetingTypesController implements MeetingTypesApi {
    private final JdbcTemplate jdbc;

    public MeetingTypesController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public ResponseEntity<List<MeetingType>> listMeetingTypes() {
        return ResponseEntity.ok(jdbc.query(
                "SELECT id, title, description, duration_minutes FROM meeting_types ORDER BY title, id",
                (row, index) -> new MeetingType()
                        .id(row.getObject("id", UUID.class))
                        .title(row.getString("title"))
                        .description(row.getString("description"))
                        .durationMinutes(row.getInt("duration_minutes"))));
    }
}
