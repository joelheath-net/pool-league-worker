-- Migration: Rematch & Game ID Overhaul
-- Replaces the composite (player1_id, player2_id, rematch_id) identity on game_revisions
-- with a dedicated `games` table keyed by an AUTOINCREMENT `id` primary key (`gameId`),
-- storing `home_player_id`, `away_player_id`, and server-calculated `rematch_id`.
-- Preserves 100% of existing games, revisions, authors, timestamps, and match outcomes.

DROP TRIGGER IF EXISTS prevent_game_revision_updates;
DROP TRIGGER IF EXISTS prevent_game_revision_deletions;

CREATE TABLE _migration_game_map (
    game_id              INTEGER PRIMARY KEY AUTOINCREMENT,
    player1_id           TEXT    NOT NULL,
    player2_id           TEXT    NOT NULL,
    legacy_rematch_id    INTEGER NOT NULL,
    computed_rematch_id  INTEGER NOT NULL
);

WITH DistinctGames AS (
    SELECT
        player1_id,
        player2_id,
        rematch_id AS legacy_rematch_id,
        MIN(played_at) AS first_played_at,
        MIN(authored_at) AS first_authored_at,
        ROW_NUMBER() OVER (
            PARTITION BY
                CASE WHEN player1_id < player2_id THEN player1_id ELSE player2_id END,
                CASE WHEN player1_id < player2_id THEN player2_id ELSE player1_id END
            ORDER BY rematch_id ASC, MIN(played_at) ASC, MIN(authored_at) ASC, player1_id ASC
        ) - 1 AS computed_rematch_id
    FROM game_revisions
    GROUP BY player1_id, player2_id, rematch_id
)
INSERT INTO _migration_game_map (
    player1_id,
    player2_id,
    legacy_rematch_id,
    computed_rematch_id
)
SELECT
    player1_id,
    player2_id,
    legacy_rematch_id,
    computed_rematch_id
FROM DistinctGames
ORDER BY first_played_at ASC, first_authored_at ASC, player1_id ASC, player2_id ASC, legacy_rematch_id ASC;

CREATE TABLE games (
    id               INTEGER   PRIMARY KEY AUTOINCREMENT,
    home_player_id   TEXT      NOT NULL,
    away_player_id   TEXT      NOT NULL,
    rematch_id       INTEGER   NOT NULL CHECK (typeof(rematch_id) = 'integer' AND rematch_id >= 0),

    CHECK (home_player_id != away_player_id),

    FOREIGN KEY (home_player_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (away_player_id) REFERENCES users(id) ON DELETE CASCADE
);

INSERT INTO games (id, home_player_id, away_player_id, rematch_id)
SELECT
    game_id,
    player1_id,
    player2_id,
    computed_rematch_id
FROM _migration_game_map
ORDER BY game_id ASC;

CREATE TABLE game_revisions_new (
    game_id          INTEGER   NOT NULL,
    revision_id      INTEGER   NOT NULL  DEFAULT 0 CHECK (typeof(revision_id) = 'integer' AND revision_id >= 0),
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

INSERT INTO game_revisions_new (
    game_id,
    revision_id,
    winner_id,
    author_id,
    authored_at,
    balls_remaining,
    fouled_on_black,
    played_at
)
SELECT
    m.game_id,
    CAST(gr.revision_id AS INTEGER) AS revision_id,
    gr.winner_id,
    gr.author_id,
    gr.authored_at,
    MAX(0, MIN(8, CAST(ROUND(gr.balls_remaining) AS INTEGER))) AS balls_remaining,
    CASE WHEN gr.fouled_on_black THEN 1 ELSE 0 END AS fouled_on_black,
    gr.played_at
FROM game_revisions gr
JOIN _migration_game_map m
    ON m.player1_id = gr.player1_id
   AND m.player2_id = gr.player2_id
   AND m.legacy_rematch_id = gr.rematch_id
ORDER BY m.game_id ASC, gr.revision_id ASC;

DROP TABLE _migration_game_map;
DROP TABLE game_revisions;

ALTER TABLE game_revisions_new RENAME TO game_revisions;

CREATE UNIQUE INDEX idx_games_pair_rematch
    ON games (
        CASE WHEN home_player_id < away_player_id THEN home_player_id ELSE away_player_id END,
        CASE WHEN home_player_id < away_player_id THEN away_player_id ELSE home_player_id END,
        rematch_id
    );

CREATE INDEX idx_game_revisions_game_id ON game_revisions(game_id);
