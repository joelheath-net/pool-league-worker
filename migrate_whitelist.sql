-- Migration to create whitelisted_emails table
CREATE TABLE IF NOT EXISTS whitelisted_emails (
    email       TEXT PRIMARY KEY NOT NULL COLLATE NOCASE,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
