package io.hexlet.calendar;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.beans.PropertyEditorSupport;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.UUID;
import org.springframework.boot.jackson.autoconfigure.JsonMapperBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.bind.WebDataBinder;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.InitBinder;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.MapperFeature;
import tools.jackson.core.JsonParser;
import tools.jackson.core.JsonToken;
import tools.jackson.databind.DeserializationContext;
import tools.jackson.databind.cfg.CoercionAction;
import tools.jackson.databind.cfg.CoercionInputShape;
import tools.jackson.databind.deser.std.StdDeserializer;
import tools.jackson.databind.module.SimpleModule;
import tools.jackson.databind.type.LogicalType;

@Configuration
@ControllerAdvice(annotations = RestController.class)
public class ApiInputConfiguration {
    @InitBinder
    public void bindUuid(WebDataBinder binder) {
        // A converter failure can fall back to Spring's permissive UUID property editor.
        binder.registerCustomEditor(UUID.class, new PropertyEditorSupport() {
            @Override
            public void setAsText(String text) {
                setValue(parseUuid(text));
            }
        });
    }

    private static UUID parseUuid(String input) {
        var id = UUID.fromString(input);
        if (!id.toString().equalsIgnoreCase(input)) {
            throw new IllegalArgumentException("Expected a UUID in 8-4-4-4-12 format");
        }
        return id;
    }

    @Bean
    public JsonMapperBuilderCustomizer strictJsonInput() {
        return builder -> builder.disable(DeserializationFeature.ACCEPT_FLOAT_AS_INT)
                .disable(MapperFeature.ALLOW_COERCION_OF_SCALARS)
                .withCoercionConfig(LogicalType.Textual, config -> config
                        .setCoercion(CoercionInputShape.Integer, CoercionAction.Fail)
                        .setCoercion(CoercionInputShape.Float, CoercionAction.Fail)
                        .setCoercion(CoercionInputShape.Boolean, CoercionAction.Fail))
                .addModule(new SimpleModule()
                        .addDeserializer(OffsetDateTime.class, new IsoOffsetDateTimeDeserializer())
                        .addDeserializer(UUID.class, new UuidDeserializer()))
                .changeDefaultPropertyInclusion(value -> value.withValueInclusion(JsonInclude.Include.NON_NULL));
    }

    private static final class UuidDeserializer extends StdDeserializer<UUID> {
        private UuidDeserializer() {
            super(UUID.class);
        }

        @Override
        public UUID deserialize(JsonParser parser, DeserializationContext context) {
            if (!parser.hasToken(JsonToken.VALUE_STRING)) {
                return (UUID) context.handleUnexpectedToken(UUID.class, parser);
            }
            try {
                return parseUuid(parser.getString());
            } catch (IllegalArgumentException error) {
                return (UUID) context.handleWeirdStringValue(UUID.class, parser.getString(),
                        "Expected a UUID in 8-4-4-4-12 format");
            }
        }
    }

    private static final class IsoOffsetDateTimeDeserializer extends StdDeserializer<OffsetDateTime> {
        private IsoOffsetDateTimeDeserializer() {
            super(OffsetDateTime.class);
        }

        @Override
        public OffsetDateTime deserialize(JsonParser parser, DeserializationContext context) {
            if (!parser.hasToken(JsonToken.VALUE_STRING)) {
                return (OffsetDateTime) context.handleUnexpectedToken(OffsetDateTime.class, parser);
            }
            try {
                return OffsetDateTime.parse(parser.getString());
            } catch (DateTimeParseException error) {
                return (OffsetDateTime) context.handleWeirdStringValue(OffsetDateTime.class, parser.getString(),
                        "Expected an ISO 8601 timestamp with an explicit offset");
            }
        }
    }
}
