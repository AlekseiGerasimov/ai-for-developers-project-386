INSERT INTO meetings (id, meeting_type_id, starts_at, ends_at, guest_name, guest_email)
SELECT RANDOM_UUID(), '00000000-0000-0000-0000-000000000003',
    DATEADD('HOUR', h.x, DATEADD('DAY', d.x, TIMESTAMP WITH TIME ZONE '2026-11-16 06:00:00Z')),
    DATEADD('HOUR', h.x + 1, DATEADD('DAY', d.x, TIMESTAMP WITH TIME ZONE '2026-11-16 06:00:00Z')),
    'Guest', 'guest@example.com'
FROM SYSTEM_RANGE(0, 13) d CROSS JOIN SYSTEM_RANGE(0, 8) h
WHERE MOD(d.x, 7) < 5;
