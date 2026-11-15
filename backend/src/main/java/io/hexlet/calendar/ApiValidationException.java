package io.hexlet.calendar;

import io.hexlet.calendar.model.FieldError;
import java.util.List;

public class ApiValidationException extends RuntimeException {
    private final List<FieldError> fields;

    public ApiValidationException(List<FieldError> fields) {
        super("Некорректные поля");
        this.fields = fields;
    }

    public List<FieldError> getFields() {
        return fields;
    }
}
