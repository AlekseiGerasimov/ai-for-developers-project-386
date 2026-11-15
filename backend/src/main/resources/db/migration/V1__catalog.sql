CREATE TABLE owner_calendar (
    id INTEGER PRIMARY KEY CHECK (id = 1)
);
INSERT INTO owner_calendar (id) VALUES (1);

CREATE TABLE meeting_types (
    id UUID PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    description VARCHAR(2000) NOT NULL,
    duration_minutes INTEGER NOT NULL CHECK (duration_minutes BETWEEN 1 AND 480)
);
