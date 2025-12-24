SELECT
    table_name,
    column_name,
    data_type,
    character_maximum_length,
    column_default,
    is_nullable,
    ordinal_position
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name IN ('documents', 'generation_tasks', 'audit_sessions')
ORDER BY table_name, ordinal_position;