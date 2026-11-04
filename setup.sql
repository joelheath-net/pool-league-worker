CREATE TABLE IF NOT EXISTS users (
    id                               TEXT PRIMARY KEY NOT NULL,
    email                            TEXT UNIQUE      NOT NULL,
    name                             TEXT             NOT NULL,
    role                             TEXT             DEFAULT 'user' NOT NULL CHECK (role IN ('user', 'admin')),
    team                             TEXT             DEFAULT 'My Team' NOT NULL,
    team_color                       TEXT             DEFAULT '#ffffff' NOT NULL,
    participating                    BOOLEAN          DEFAULT 1 NOT NULL CHECK (participating IN (0, 1)),
    google_refresh_token             TEXT,
    google_access_token              TEXT,
    google_access_token_expires_at   DATETIME
);


CREATE TABLE IF NOT EXISTS games (
    id               INTEGER   PRIMARY KEY AUTOINCREMENT,
    home_player_id   TEXT      NOT NULL,
    away_player_id   TEXT      NOT NULL,
    rematch_id       INTEGER   NOT NULL CHECK (typeof(rematch_id) = 'integer' AND rematch_id >= 0),
    is_deleted       BOOLEAN   NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),

    CHECK (home_player_id != away_player_id),

    FOREIGN KEY (home_player_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (away_player_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_games_pair_rematch
    ON games (
        CASE WHEN home_player_id < away_player_id THEN home_player_id ELSE away_player_id END,
        CASE WHEN home_player_id < away_player_id THEN away_player_id ELSE home_player_id END,
        rematch_id
    )
    WHERE is_deleted = 0;


CREATE TABLE IF NOT EXISTS game_revisions (
    game_id          INTEGER   NOT NULL,
    revision_id      INTEGER   NOT NULL  DEFAULT 0 CHECK (typeof(revision_id) = 'integer' AND revision_id >= 0),
    is_deleted       BOOLEAN   NOT NULL  DEFAULT 0 CHECK (is_deleted IN (0, 1)),
    winner_id        TEXT      NOT NULL,

    author_id        TEXT      NOT NULL,
    authored_at      DATETIME  NOT NULL  DEFAULT CURRENT_TIMESTAMP,

    balls_remaining  INTEGER   NOT NULL  CHECK (typeof(balls_remaining) = 'integer' AND balls_remaining >= 0 AND balls_remaining <= 8),
    fouled_on_black  BOOLEAN   NOT NULL  CHECK (fouled_on_black IN (0, 1)),
    played_at        DATETIME  NOT NULL,

    PRIMARY KEY (game_id, revision_id),

    FOREIGN KEY (game_id)   REFERENCES games(id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (winner_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_game_revisions_game_id ON game_revisions(game_id);


CREATE TABLE IF NOT EXISTS archived_seasons (
    id    INTEGER  PRIMARY KEY  AUTOINCREMENT,
    name  TEXT     NOT NULL
);


CREATE TABLE IF NOT EXISTS archived_tables (
    season_id        INTEGER  NOT NULL,
    player_id        TEXT     NOT NULL,
    name             TEXT     NOT NULL,
    team             TEXT     NOT NULL,
    team_color       TEXT     NOT NULL,

    points           INTEGER  NOT NULL,
    wins             INTEGER  NOT NULL,
    losses           INTEGER  NOT NULL,
    fouls_on_black   INTEGER  NOT NULL,
    balls_remaining  INTEGER  NOT NULL,

    PRIMARY KEY (season_id, player_id),

    FOREIGN KEY (season_id) REFERENCES archived_seasons(id) ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS whitelisted_emails (
    email       TEXT PRIMARY KEY NOT NULL COLLATE NOCASE,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS push_subscriptions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     TEXT NOT NULL,
    endpoint    TEXT NOT NULL UNIQUE,
    p256dh      TEXT NOT NULL,
    auth        TEXT NOT NULL,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);
