CREATE TABLE meetings (
    id UUID PRIMARY KEY,
    meeting_type_id UUID NOT NULL REFERENCES meeting_types(id),
    starts_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
    guest_name VARCHAR(100) NOT NULL,
    guest_email VARCHAR(254) NOT NULL,
    CHECK (ends_at > starts_at)
);
CREATE INDEX meetings_interval ON meetings(starts_at, ends_at);
