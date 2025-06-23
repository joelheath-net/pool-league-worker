CREATE TABLE IF NOT EXISTS users (
    id                               TEXT PRIMARY KEY NOT NULL,
    email                            TEXT UNIQUE      NOT NULL,
    name                             TEXT             NOT NULL,
    role                             TEXT             DEFAULT 'user' NOT NULL CHECK (role IN ('user', 'admin')),
    team                             TEXT             DEFAULT 'My Team' NOT NULL,
    team_color                       TEXT             DEFAULT '#ffffff' NOT NULL,
    google_refresh_token             TEXT,
    google_access_token              TEXT,
    google_access_token_expires_at   DATETIME
);


CREATE TABLE IF NOT EXISTS game_revisions (
    player1_id       TEXT      NOT NULL,
    player2_id       TEXT      NOT NULL,
    rematch_id       INTEGER   NOT NULL,
    winner_id        TEXT      NOT NULL,
    
    revision_id      INTEGER   NOT NULL   DEFAULT 0,
    author_id        TEXT      NOT NULL,
    authored_at      DATETIME  NOT NULL   DEFAULT CURRENT_TIMESTAMP,

    balls_remaining  INTEGER   NOT NULL,
    fouled_on_black  BOOLEAN   NOT NULL   CHECK (fouled_on_black IN (0, 1)),
    played_at        DATETIME  NOT NULL,

    PRIMARY KEY (player1_id, player2_id, rematch_id, revision_id),

    FOREIGN KEY (player1_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (player2_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (author_id)  REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (winner_id)  REFERENCES users(id) ON DELETE CASCADE
);


-- CREATE TRIGGER IF NOT EXISTS prevent_game_revision_updates
-- BEFORE UPDATE ON game_revisions
-- BEGIN
--     SELECT RAISE(ABORT, 'Game revisions cannot be updated');
-- END;


-- CREATE TRIGGER IF NOT EXISTS prevent_game_revision_deletions
-- BEFORE DELETE ON game_revisions
-- BEGIN
--     SELECT RAISE(ABORT, 'Game revisions cannot be deleted');
-- END;