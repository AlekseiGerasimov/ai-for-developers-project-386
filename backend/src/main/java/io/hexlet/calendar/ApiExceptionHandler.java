package io.hexlet.calendar;

import io.hexlet.calendar.model.ApiError;
import io.hexlet.calendar.model.FieldError;
import jakarta.validation.ConstraintViolationException;
import java.util.List;
import org.springframework.dao.DataAccessException;
import org.springframework.transaction.TransactionException;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@RestControllerAdvice(annotations = RestController.class)
public class ApiExceptionHandler {
    @ExceptionHandler(SlotException.class)
    public ResponseEntity<ApiError> slot(SlotException error) {
        return ResponseEntity.status(error.getCode().equals("SLOT_TAKEN") ? 409 : 400)
                .body(new ApiError().code(error.getCode()).message("Выберите другое время"));
    }
    @ExceptionHandler(MeetingTypeNotFoundException.class)
    public ResponseEntity<ApiError> missing(MeetingTypeNotFoundException error) {
        return ResponseEntity.status(404).body(new ApiError().code("MEETING_TYPE_NOT_FOUND")
                .message("Тип встречи не найден"));
    }

    @ExceptionHandler(ApiValidationException.class)
    public ResponseEntity<ApiError> validation(ApiValidationException error) {
        return invalid(error.getFields());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiError> fields(MethodArgumentNotValidException error) {
        return invalid(error.getBindingResult().getFieldErrors().stream()
                .map(field -> new FieldError().field(field.getField()).message("Некорректное значение"))
                .toList());
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ApiError> constraints(ConstraintViolationException error) {
        return invalid(error.getConstraintViolations().stream().map(violation -> {
            var path = violation.getPropertyPath().toString();
            return new FieldError().field(path.substring(path.lastIndexOf('.') + 1))
                    .message("Некорректное значение");
        }).toList());
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiError> json(HttpMessageNotReadableException error) {
        return invalid(List.of(new FieldError().field("body").message("Некорректный JSON или тип поля")));
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ApiError> parameter(MethodArgumentTypeMismatchException error) {
        return invalid(List.of(new FieldError().field(error.getName()).message("Некорректное значение")));
    }

    @ExceptionHandler({DataAccessException.class, TransactionException.class})
    public ResponseEntity<ApiError> unavailable(RuntimeException error) {
        return ResponseEntity.status(503).body(new ApiError().code("SERVICE_UNAVAILABLE")
                .message("Сервис временно недоступен"));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> unexpected(Exception error) {
        return ResponseEntity.status(500).body(new ApiError().code("INTERNAL_ERROR")
                .message("Не удалось выполнить запрос"));
    }

    private ResponseEntity<ApiError> invalid(List<FieldError> fields) {
        return ResponseEntity.badRequest().body(new ApiError().code("VALIDATION_ERROR")
                .message("Проверьте поля запроса").fieldErrors(fields));
    }
}
