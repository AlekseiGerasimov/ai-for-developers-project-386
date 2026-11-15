-- H2 VARCHAR limits count UTF-16 units; one Unicode code point may use two.
-- Application validation keeps the limits of 100/2000/100 code points.
ALTER TABLE meeting_types ALTER COLUMN title VARCHAR(200);
ALTER TABLE meeting_types ALTER COLUMN description VARCHAR(4000);
ALTER TABLE meetings ALTER COLUMN guest_name VARCHAR(200);
