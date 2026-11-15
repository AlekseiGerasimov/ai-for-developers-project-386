package io.hexlet.calendar;

import io.hexlet.calendar.api.MeetingTypesApi;
import io.hexlet.calendar.model.MeetingType;
import io.hexlet.calendar.model.CreateMeetingType;
import io.hexlet.calendar.model.FieldError;
import java.util.ArrayList;
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
    public ResponseEntity<MeetingType> createMeetingType(CreateMeetingType input) {
        var title = input.getTitle() == null ? "" : input.getTitle().strip();
        var description = input.getDescription() == null ? "" : input.getDescription().strip();
        var errors = new ArrayList<FieldError>();
        if (title.isEmpty() || title.codePointCount(0, title.length()) > 100) {
            errors.add(new FieldError().field("title").message("Введите от 1 до 100 символов"));
        }
        if (description.isEmpty() || description.codePointCount(0, description.length()) > 2000) {
            errors.add(new FieldError().field("description").message("Введите от 1 до 2000 символов"));
        }
        if (!errors.isEmpty()) {
            throw new ApiValidationException(errors);
        }
        var type = new MeetingType().id(UUID.randomUUID()).title(title)
                .description(description).durationMinutes(input.getDurationMinutes());
        jdbc.update("INSERT INTO meeting_types (id, title, description, duration_minutes) VALUES (?, ?, ?, ?)",
                type.getId(), title, description, type.getDurationMinutes());
        return ResponseEntity.status(201).body(type);
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
