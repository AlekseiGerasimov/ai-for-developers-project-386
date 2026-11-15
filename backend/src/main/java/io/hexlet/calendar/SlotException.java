package io.hexlet.calendar;

public class SlotException extends RuntimeException {
    private final String code;

    public SlotException(String code) {
        super(code);
        this.code = code;
    }

    public String getCode() { return code; }
}
