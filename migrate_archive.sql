BEGIN TRANSACTION;

ALTER TABLE archived_tables RENAME TO archived_tables_old;

CREATE TABLE archived_tables (
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

INSERT INTO archived_tables (
    season_id,
    player_id,
    name,
    team,
    team_color,
    points,
    wins,
    losses,
    fouls_on_black,
    balls_remaining
)
SELECT
    old_table.season_id,
    old_table.player_id,
    COALESCE(u.name, 'Unknown Player') AS name,
    COALESCE(u.team, 'My Team') AS team,
    COALESCE(u.team_color, '#ffffff') AS team_color,
    old_table.points,
    old_table.wins,
    old_table.losses,
    old_table.fouls_on_black,
    old_table.balls_remaining
FROM archived_tables_old AS old_table
LEFT JOIN users AS u
    ON u.id = old_table.player_id;

DROP TABLE archived_tables_old;

COMMIT;
