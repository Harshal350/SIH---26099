-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- The application schema is managed by Flyway/JPA and will be created on application start.
-- This init script only ensures the extension and vector-related readiness.
