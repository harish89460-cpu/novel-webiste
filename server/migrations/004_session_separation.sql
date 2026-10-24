-- Migration 004: Session Separation for Readers vs Author & Admin
-- Enforces strict database-level session separation between normal reader logins and author logins

ALTER TABLE sessions ADD COLUMN session_type VARCHAR(20) NOT NULL DEFAULT 'reader';
CREATE INDEX idx_sessions_type ON sessions(session_type);
