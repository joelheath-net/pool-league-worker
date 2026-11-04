import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import fullApp from '../src/index.js';
import { signAuthToken } from '../src/token-service.js';

const TEST_SECRET = 'rematch-overhaul-test-secret-0123456789abcdef';

const SETUP_SQL = readFileSync(resolve(process.cwd(), 'setup.sql'), 'utf8');
const MIGRATION_SQL = readFileSync(
    resolve(process.cwd(), 'migrations/0001_rematch_overhaul.sql'),
    'utf8'
);

const LEGACY_SCHEMA_SQL = `
CREATE TABLE users (
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

CREATE TABLE game_revisions (
    player1_id       TEXT      NOT NULL,
    player2_id       TEXT      NOT NULL,
    winner_id        TEXT      NOT NULL,

    rematch_id       INTEGER   NOT NULL  DEFAULT 0,
    revision_id      INTEGER   NOT NULL  DEFAULT 0,

    author_id        TEXT      NOT NULL,
    authored_at      DATETIME  NOT NULL  DEFAULT CURRENT_TIMESTAMP,

    balls_remaining  INTEGER   NOT NULL  CHECK (balls_remaining >= 0 AND balls_remaining <= 8),
    fouled_on_black  BOOLEAN   NOT NULL  CHECK (fouled_on_black IN (0, 1)),
    played_at        DATETIME  NOT NULL,

    PRIMARY KEY (player1_id, player2_id, rematch_id, revision_id),

    CHECK (player1_id != player2_id),

    FOREIGN KEY (author_id)  REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (player1_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (player2_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (winner_id)  REFERENCES users(id) ON DELETE CASCADE
);

CREATE TRIGGER prevent_game_revision_updates
BEFORE UPDATE ON game_revisions
BEGIN
    SELECT RAISE(ABORT, 'Direct updates to game_revisions are forbidden.');
END;

CREATE TRIGGER prevent_game_revision_deletions
BEFORE DELETE ON game_revisions
BEGIN
    SELECT RAISE(ABORT, 'Deletions from game_revisions are forbidden.');
END;

CREATE TABLE archived_seasons (
    id    INTEGER  PRIMARY KEY  AUTOINCREMENT,
    name  TEXT     NOT NULL
);

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

CREATE TABLE whitelisted_emails (
    email       TEXT PRIMARY KEY NOT NULL COLLATE NOCASE,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE push_subscriptions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     TEXT NOT NULL,
    endpoint    TEXT NOT NULL UNIQUE,
    p256dh      TEXT NOT NULL,
    auth        TEXT NOT NULL,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
`;

/**
 * Wraps Node's built-in SQLite DatabaseSync in a Cloudflare D1-compatible async interface.
 */
function createSqliteD1Adapter(sqlite) {
    sqlite.exec('PRAGMA foreign_keys = ON;');

    const executeBound = (sql, params) => {
        const stmt = sqlite.prepare(sql);
        return {
            sql,
            params,
            async first(colName) {
                const row = stmt.get(...params);
                if (!row) return null;
                return colName ? row[colName] : { ...row };
            },
            async all() {
                const rows = stmt.all(...params).map((r) => ({ ...r }));
                return { success: true, results: rows, meta: {} };
            },
            async run() {
                const info = stmt.run(...params);
                return {
                    success: true,
                    results: [],
                    meta: {
                        changes: Number(info.changes),
                        last_row_id: Number(info.lastInsertRowid)
                    }
                };
            }
        };
    };

    return {
        sqlite,
        prepare(sql) {
            return {
                bind(...params) {
                    return executeBound(sql, params);
                },
                async first(colName) {
                    return executeBound(sql, []).first(colName);
                },
                async all() {
                    return executeBound(sql, []).all();
                },
                async run() {
                    return executeBound(sql, []).run();
                }
            };
        },
        async batch(statements) {
            sqlite.exec('BEGIN TRANSACTION;');
            try {
                const results = [];
                for (const statement of statements) {
                    results.push(await statement.run());
                }
                sqlite.exec('COMMIT;');
                return results;
            } catch (err) {
                sqlite.exec('ROLLBACK;');
                throw err;
            }
        }
    };
}

function seedUsers(sqlite) {
    const insertUser = sqlite.prepare(`
        INSERT INTO users (id, email, name, role, team, team_color, participating)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insertUser.run('alice', 'alice@example.com', 'Alice', 'admin', 'Cue Masters', '#1e88e5', 1);
    insertUser.run('bob', 'bob@example.com', 'Bob', 'user', 'Chalk Dust', '#43a047', 1);
    insertUser.run('charlie', 'charlie@example.com', 'Charlie', 'user', 'Eight Ballers', '#e53935', 1);
    insertUser.run('spectator', 'spec@example.com', 'Spectator', 'user', 'Bench', '#757575', 0);
}

describe('Rematch Overhaul, Schema Migration & Strict Validation', () => {
    let sqlite;
    let d1;
    let env;
    let aliceJwt;
    let bobJwt;

    beforeEach(async () => {
        sqlite = new DatabaseSync(':memory:');
        d1 = createSqliteD1Adapter(sqlite);
        env = {
            JWT_SECRET: TEST_SECRET,
            GOOGLE_CLIENT_ID: 'test-client-id',
            GOOGLE_CLIENT_SECRET: 'test-client-secret',
            DB: d1
        };
        aliceJwt = (await signAuthToken({ id: 'alice', email: 'alice@example.com' }, env)).jwt;
        bobJwt = (await signAuthToken({ id: 'bob', email: 'bob@example.com' }, env)).jwt;
    });

    afterEach(() => {
        sqlite.close();
    });

    describe('D1 Migration (migrations/0001_rematch_overhaul.sql)', () => {
        it('migrates all legacy games, multi-revision histories, reversed pairs, and fractional balls without data loss', async () => {
            sqlite.exec(LEGACY_SCHEMA_SQL);
            seedUsers(sqlite);

            const insertLegacy = sqlite.prepare(`
                INSERT INTO game_revisions (
                    player1_id, player2_id, winner_id, rematch_id, revision_id,
                    author_id, authored_at, balls_remaining, fouled_on_black, played_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            // Game 1 (earliest): Alice vs Bob, initially Alice won (rev 0), then edited so Bob won with fractional 3.6 balls (rev 1)
            insertLegacy.run(
                'alice', 'bob', 'alice', 0, 0,
                'alice', '2026-01-10T12:00:00Z', 3, 0, '2026-01-10'
            );
            insertLegacy.run(
                'alice', 'bob', 'bob', 0, 1,
                'bob', '2026-01-10T13:00:00Z', 3.6, 0, '2026-01-10'
            );

            // Game 2: Alice vs Charlie, Alice won via foul on black
            insertLegacy.run(
                'alice', 'charlie', 'alice', 0, 0,
                'alice', '2026-01-15T18:00:00Z', 2, 1, '2026-01-15'
            );

            // Game 3: Legacy non-canonical reversed order (Bob vs Alice) with duplicate rematch_id = 0
            insertLegacy.run(
                'bob', 'alice', 'alice', 0, 0,
                'bob', '2026-01-20T19:00:00Z', 5, 0, '2026-01-20'
            );

            // Apply migration script
            sqlite.exec(MIGRATION_SQL);

            // Temporary table must be dropped
            const tempTable = sqlite
                .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='_migration_game_map'")
                .get();
            expect(tempTable).toBeUndefined();

            // Verify games table has all 3 distinct matches in chronological order
            const gamesRows = sqlite.prepare('SELECT * FROM games ORDER BY id ASC').all();
            expect(gamesRows).toHaveLength(3);
            expect(gamesRows.map((g) => ({ ...g }))).toEqual([
                { id: 1, home_player_id: 'alice', away_player_id: 'bob', rematch_id: 0 },
                { id: 2, home_player_id: 'alice', away_player_id: 'charlie', rematch_id: 0 },
                { id: 3, home_player_id: 'bob', away_player_id: 'alice', rematch_id: 1 }
            ]);

            // Verify all 4 revisions survived and fractional 3.6 was rounded to integer 4
            const revRows = sqlite
                .prepare('SELECT game_id, revision_id, winner_id, balls_remaining FROM game_revisions ORDER BY game_id ASC, revision_id ASC')
                .all();
            expect(revRows.map((r) => ({ ...r }))).toEqual([
                { game_id: 1, revision_id: 0, winner_id: 'alice', balls_remaining: 3 },
                { game_id: 1, revision_id: 1, winner_id: 'bob', balls_remaining: 4 },
                { game_id: 2, revision_id: 0, winner_id: 'alice', balls_remaining: 2 },
                { game_id: 3, revision_id: 0, winner_id: 'alice', balls_remaining: 5 }
            ]);

            // Verify GET /api/game-list returns latest revisions in the new API contract
            const gameListRes = await fullApp.request('https://example.com/api/game-list', {}, env);
            expect(gameListRes.status).toBe(200);
            const gameList = await gameListRes.json();
            expect(gameList).toHaveLength(3);

            // Ordered by played_at DESC, game_id DESC -> game 3, game 2, game 1
            expect(gameList[0]).toMatchObject({
                gameId: 3,
                homePlayerId: 'bob',
                awayPlayerId: 'alice',
                winnerHome: false, // Alice won, and Alice is awayPlayerId on game 3
                rematchId: 1,
                revisionId: 0,
                ballsRemaining: 5,
                fouledOnBlack: false,
                playedAt: '2026-01-20'
            });
            expect(gameList[2]).toMatchObject({
                gameId: 1,
                homePlayerId: 'alice',
                awayPlayerId: 'bob',
                winnerHome: false, // Revision 1 changed winner to Bob (away)
                rematchId: 0,
                revisionId: 1,
                ballsRemaining: 4,
                fouledOnBlack: false,
                playedAt: '2026-01-10'
            });
            // Legacy fields must not leak in responses
            for (const g of gameList) {
                expect(g.player1Id).toBeUndefined();
                expect(g.player2Id).toBeUndefined();
                expect(g.winnerId).toBeUndefined();
            }

            // Verify GET /api/auth/audit-log returns all 4 revisions
            const auditRes = await fullApp.request(
                'https://example.com/api/auth/audit-log',
                { headers: { Cookie: `auth_token=${aliceJwt}` } },
                env
            );
            expect(auditRes.status).toBe(200);
            const auditLog = await auditRes.json();
            expect(auditLog).toHaveLength(4);

            // Verify logging a new game after migration continues gameId=4 and computes rematchId=2 for Alice vs Bob
            const postRes = await fullApp.request(
                'https://example.com/api/participating/games',
                {
                    method: 'POST',
                    headers: { Cookie: `auth_token=${aliceJwt}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        homePlayerId: 'alice',
                        awayPlayerId: 'bob',
                        winnerHome: true,
                        ballsRemaining: 1,
                        fouledOnBlack: false,
                        playedAt: '2026-01-25'
                    })
                },
                env
            );
            expect(postRes.status).toBe(201);
            const postBody = await postRes.json();
            expect(postBody.gameId).toBe(4);

            const fetchedGame4Res = await fullApp.request(
                'https://example.com/api/participating/games/4',
                { headers: { Cookie: `auth_token=${aliceJwt}` } },
                env
            );
            expect(fetchedGame4Res.status).toBe(200);
            expect(await fetchedGame4Res.json()).toMatchObject({
                gameId: 4,
                homePlayerId: 'alice',
                awayPlayerId: 'bob',
                winnerHome: true,
                rematchId: 2,
                revisionId: 0,
                ballsRemaining: 1
            });
        });
    });

    describe('Server-Computed Rematches, Game Editing & Leaderboard Integration', () => {
        beforeEach(() => {
            sqlite.exec(SETUP_SQL);
            seedUsers(sqlite);
        });

        it('computes rematch rounds automatically regardless of home/away orientation and resolves winnerHome accurately', async () => {
            // Match 1: Alice (home) vs Bob (away), winnerHome: true -> Alice wins, rematchId = 0
            const r1 = await fullApp.request(
                'https://example.com/api/participating/games',
                {
                    method: 'POST',
                    headers: { Cookie: `auth_token=${aliceJwt}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        homePlayerId: 'alice',
                        awayPlayerId: 'bob',
                        winnerHome: true,
                        ballsRemaining: 4,
                        fouledOnBlack: false,
                        playedAt: '2026-02-01'
                    })
                },
                env
            );
            expect(r1.status).toBe(201);
            const { gameId: g1 } = await r1.json();
            expect(g1).toBe(1);

            // Match 2: Swapped home/away — Bob (home) vs Alice (away), winnerHome: false -> Alice wins again, rematchId = 1
            const r2 = await fullApp.request(
                'https://example.com/api/participating/games',
                {
                    method: 'POST',
                    headers: { Cookie: `auth_token=${bobJwt}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        homePlayerId: 'bob',
                        awayPlayerId: 'alice',
                        winnerHome: false,
                        ballsRemaining: 2,
                        fouledOnBlack: true,
                        playedAt: '2026-02-02'
                    })
                },
                env
            );
            expect(r2.status).toBe(201);
            const { gameId: g2 } = await r2.json();
            expect(g2).toBe(2);

            // Match 3: Alice vs Charlie -> separate pair, must start at rematchId = 0
            const r3 = await fullApp.request(
                'https://example.com/api/participating/log-game',
                {
                    method: 'POST',
                    headers: { Cookie: `auth_token=${aliceJwt}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        homePlayerId: 'alice',
                        awayPlayerId: 'charlie',
                        winnerHome: false,
                        ballsRemaining: 6,
                        fouledOnBlack: false,
                        playedAt: '2026-02-03'
                    })
                },
                env
            );
            expect(r3.status).toBe(201);
            const { gameId: g3 } = await r3.json();
            expect(g3).toBe(3);

            // Check individual games
            const game1 = await (
                await fullApp.request(
                    `https://example.com/api/participating/games/${g1}`,
                    { headers: { Cookie: `auth_token=${aliceJwt}` } },
                    env
                )
            ).json();
            const game2 = await (
                await fullApp.request(
                    `https://example.com/api/participating/games/${g2}`,
                    { headers: { Cookie: `auth_token=${aliceJwt}` } },
                    env
                )
            ).json();
            const game3 = await (
                await fullApp.request(
                    `https://example.com/api/participating/games/${g3}`,
                    { headers: { Cookie: `auth_token=${aliceJwt}` } },
                    env
                )
            ).json();

            expect(game1).toMatchObject({ gameId: 1, homePlayerId: 'alice', awayPlayerId: 'bob', winnerHome: true, rematchId: 0 });
            expect(game2).toMatchObject({ gameId: 2, homePlayerId: 'bob', awayPlayerId: 'alice', winnerHome: false, rematchId: 1 });
            expect(game3).toMatchObject({ gameId: 3, homePlayerId: 'alice', awayPlayerId: 'charlie', winnerHome: false, rematchId: 0 });

            // Check leaderboard tallies:
            // Alice: 2 wins (vs Bob x2), 1 loss (vs Charlie, 6 balls)
            // Bob: 0 wins, 2 losses (4 + 2 = 6 balls, 1 foul on black)
            // Charlie: 1 win, 0 losses
            const lb = await (await fullApp.request('https://example.com/api/leaderboard', {}, env)).json();
            const byId = Object.fromEntries(lb.map((p) => [p.playerId, p]));
            expect(byId.alice).toEqual({ playerId: 'alice', wins: 2, losses: 1, ballsRemaining: 6, foulsOnBlack: 0 });
            expect(byId.bob).toEqual({ playerId: 'bob', wins: 0, losses: 2, ballsRemaining: 6, foulsOnBlack: 1 });
            expect(byId.charlie).toEqual({ playerId: 'charlie', wins: 1, losses: 0, ballsRemaining: 0, foulsOnBlack: 0 });

            // Check outstanding games for 2 rematch rounds across 3 participating players (3 pairs * 2 = 6 total games, 3 played -> 3 left)
            // Alice vs Bob already played rematch 0 & 1, so Alice vs Bob has 0 outstanding games!
            const outRes = await fullApp.request('https://example.com/api/outstanding-games?rounds=2', {}, env);
            expect(outRes.status).toBe(200);
            const outData = await outRes.json();
            expect(outData.totalOutstanding).toBe(3);
            for (const fixture of outData.games) {
                const pair = [fixture.homePlayer.id, fixture.awayPlayer.id].sort().join(':');
                expect(pair).not.toBe('alice:bob');
            }

            // Edit Game 1 via PATCH /api/participating/games/1 so Bob wins instead of Alice
            const patchRes = await fullApp.request(
                'https://example.com/api/participating/games/1',
                {
                    method: 'PATCH',
                    headers: { Cookie: `auth_token=${bobJwt}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        homePlayerId: 'alice',
                        awayPlayerId: 'bob',
                        winnerHome: false,
                        ballsRemaining: 7,
                        fouledOnBlack: false,
                        playedAt: '2026-02-01'
                    })
                },
                env
            );
            expect(patchRes.status).toBe(200);

            const updatedGame1 = await (
                await fullApp.request(
                    'https://example.com/api/participating/games/1',
                    { headers: { Cookie: `auth_token=${aliceJwt}` } },
                    env
                )
            ).json();
            expect(updatedGame1).toMatchObject({
                gameId: 1,
                homePlayerId: 'alice',
                awayPlayerId: 'bob',
                winnerHome: false,
                rematchId: 0,
                revisionId: 1,
                ballsRemaining: 7,
                authorId: 'bob'
            });

            // Leaderboard reflects revision 1: Alice now has 1 win, 2 losses (6 + 7 = 13 balls); Bob has 1 win, 1 loss (2 balls)
            const lbAfter = await (await fullApp.request('https://example.com/api/leaderboard', {}, env)).json();
            const byIdAfter = Object.fromEntries(lbAfter.map((p) => [p.playerId, p]));
            expect(byIdAfter.alice).toEqual({ playerId: 'alice', wins: 1, losses: 2, ballsRemaining: 13, foulsOnBlack: 0 });
            expect(byIdAfter.bob).toEqual({ playerId: 'bob', wins: 1, losses: 1, ballsRemaining: 2, foulsOnBlack: 1 });

            // Archive season clears both games and game_revisions cleanly
            const archiveRes = await fullApp.request(
                'https://example.com/api/admin/archive-season',
                {
                    method: 'POST',
                    headers: { Cookie: `auth_token=${aliceJwt}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ seasonName: 'Spring 2026' })
                },
                env
            );
            expect(archiveRes.status).toBe(200);
            expect(sqlite.prepare('SELECT COUNT(*) AS cnt FROM games').get().cnt).toBe(0);
            expect(sqlite.prepare('SELECT COUNT(*) AS cnt FROM game_revisions').get().cnt).toBe(0);

            // Log one more game and verify /api/admin/reset-db clears both tables too
            const afterArchivePost = await fullApp.request(
                'https://example.com/api/participating/games',
                {
                    method: 'POST',
                    headers: { Cookie: `auth_token=${aliceJwt}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        homePlayerId: 'alice',
                        awayPlayerId: 'bob',
                        winnerHome: true,
                        ballsRemaining: 2,
                        fouledOnBlack: false,
                        playedAt: '2026-03-01'
                    })
                },
                env
            );
            expect(afterArchivePost.status).toBe(201);
            const resetRes = await fullApp.request(
                'https://example.com/api/admin/reset-db',
                {
                    method: 'POST',
                    headers: { Cookie: `auth_token=${aliceJwt}` }
                },
                env
            );
            expect(resetRes.status).toBe(200);
            expect(sqlite.prepare('SELECT COUNT(*) AS cnt FROM games').get().cnt).toBe(0);
            expect(sqlite.prepare('SELECT COUNT(*) AS cnt FROM game_revisions').get().cnt).toBe(0);
        });

        it('enforces integer CHECK constraint on balls_remaining at the SQLite database layer too', () => {
            sqlite.prepare("INSERT INTO games (home_player_id, away_player_id, rematch_id) VALUES ('alice', 'bob', 0)").run();
            expect(() => {
                sqlite
                    .prepare(`
                        INSERT INTO game_revisions (
                            game_id, revision_id, winner_id, author_id, balls_remaining, fouled_on_black, played_at
                        )
                        VALUES (1, 0, 'alice', 'alice', 3.5, 0, '2026-02-01')
                    `)
                    .run();
            }).toThrow();
        });
    });

    describe('Strict Data Format Validation on Logging & Editing Games', () => {
        const validPayload = {
            homePlayerId: 'alice',
            awayPlayerId: 'bob',
            winnerHome: true,
            ballsRemaining: 3,
            fouledOnBlack: false,
            playedAt: '2026-02-10'
        };

        beforeEach(async () => {
            sqlite.exec(SETUP_SQL);
            seedUsers(sqlite);

            // Seed game #1 for edit validation tests
            await fullApp.request(
                'https://example.com/api/participating/games',
                {
                    method: 'POST',
                    headers: { Cookie: `auth_token=${aliceJwt}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(validPayload)
                },
                env
            );
        });

        const postGame = (body) =>
            fullApp.request(
                'https://example.com/api/participating/games',
                {
                    method: 'POST',
                    headers: { Cookie: `auth_token=${aliceJwt}`, 'Content-Type': 'application/json' },
                    body: typeof body === 'string' ? body : JSON.stringify(body)
                },
                env
            );

        const patchGame = (gameId, body) =>
            fullApp.request(
                `https://example.com/api/participating/games/${gameId}`,
                {
                    method: 'PATCH',
                    headers: { Cookie: `auth_token=${aliceJwt}`, 'Content-Type': 'application/json' },
                    body: typeof body === 'string' ? body : JSON.stringify(body)
                },
                env
            );

        it('rejects fractional, negative, >8, and non-numeric ballsRemaining on both POST and PATCH', async () => {
            const invalidBallsValues = [3.5, 0.1, 7.999, -0.5, -1, 9, 100, '3', '', null, true, false, {}, []];

            for (const badBalls of invalidBallsValues) {
                const postRes = await postGame({ ...validPayload, ballsRemaining: badBalls });
                expect(postRes.status, `POST ballsRemaining=${JSON.stringify(badBalls)}`).toBe(400);

                const patchRes = await patchGame(1, { ...validPayload, ballsRemaining: badBalls });
                expect(patchRes.status, `PATCH ballsRemaining=${JSON.stringify(badBalls)}`).toBe(400);
            }

            // Boundary integers 0 and 8 are accepted
            expect((await postGame({ ...validPayload, ballsRemaining: 0 })).status).toBe(201);
            expect((await patchGame(1, { ...validPayload, ballsRemaining: 8 })).status).toBe(200);
        });

        it('rejects non-boolean winnerHome and fouledOnBlack values', async () => {
            for (const badBool of [1, 0, 'true', 'false', 'alice', null]) {
                expect((await postGame({ ...validPayload, winnerHome: badBool })).status).toBe(400);
                expect((await patchGame(1, { ...validPayload, winnerHome: badBool })).status).toBe(400);

                expect((await postGame({ ...validPayload, fouledOnBlack: badBool })).status).toBe(400);
                expect((await patchGame(1, { ...validPayload, fouledOnBlack: badBool })).status).toBe(400);
            }
        });

        it('rejects permissive Date.parse quirks, impossible calendar dates, pre-2000 dates, and future dates', async () => {
            const invalidDates = [
                'banana 2',
                '2026',
                '2026-2-5',
                '10/02/2026',
                '2026-02-29', // 2026 is not a leap year
                '2026-02-31', // Rollover date
                '2026-04-31',
                '2026-00-10',
                '2026-13-01',
                '1999-12-31',
                '2099-01-01', // Future date
                '2026-02-10T12:00:00Z',
                1700000000000,
                null,
                ''
            ];

            for (const badDate of invalidDates) {
                const postRes = await postGame({ ...validPayload, playedAt: badDate });
                expect(postRes.status, `POST playedAt=${JSON.stringify(badDate)}`).toBe(400);

                const patchRes = await patchGame(1, { ...validPayload, playedAt: badDate });
                expect(patchRes.status, `PATCH playedAt=${JSON.stringify(badDate)}`).toBe(400);
            }

            // Valid leap year date 2024-02-29 is accepted
            expect((await postGame({ ...validPayload, playedAt: '2024-02-29' })).status).toBe(201);
        });

        it('rejects malformed JSON, non-object bodies, missing fields, and unexpected or legacy fields', async () => {
            expect((await postGame('{invalid-json')).status).toBe(400);
            expect((await patchGame(1, '{invalid-json')).status).toBe(400);

            expect((await postGame('null')).status).toBe(400);
            expect((await postGame('[]')).status).toBe(400);
            expect((await postGame('"string"')).status).toBe(400);

            // Missing each required field
            for (const key of Object.keys(validPayload)) {
                const copy = { ...validPayload };
                delete copy[key];
                expect((await postGame(copy)).status).toBe(400);
                expect((await patchGame(1, copy)).status).toBe(400);
            }

            // Legacy / extra fields rejected (clients cannot sneak in rematchId or winnerId)
            expect((await postGame({ ...validPayload, rematchId: 5 })).status).toBe(400);
            expect((await postGame({ ...validPayload, winnerId: 'alice' })).status).toBe(400);
            expect((await postGame({ ...validPayload, player1Id: 'alice' })).status).toBe(400);
            expect((await patchGame(1, { ...validPayload, rematchId: 0 })).status).toBe(400);
        });

        it('validates player IDs, participation status, and blocks changing or swapping players on PATCH', async () => {
            // Same player
            expect((await postGame({ ...validPayload, awayPlayerId: 'alice' })).status).toBe(400);

            // Empty / whitespace-padded IDs
            expect((await postGame({ ...validPayload, homePlayerId: '' })).status).toBe(400);
            expect((await postGame({ ...validPayload, homePlayerId: ' alice ' })).status).toBe(400);

            // Non-existent user -> 404
            expect((await postGame({ ...validPayload, awayPlayerId: 'ghost-user' })).status).toBe(404);

            // Non-participating user -> 400
            expect((await postGame({ ...validPayload, awayPlayerId: 'spectator' })).status).toBe(400);

            // Changing or swapping players on an existing game via PATCH -> 400
            expect((await patchGame(1, { ...validPayload, awayPlayerId: 'charlie' })).status).toBe(400);
            expect(
                (await patchGame(1, {
                    ...validPayload,
                    homePlayerId: 'bob',
                    awayPlayerId: 'alice'
                })).status
            ).toBe(400);
        });

        it('validates :gameId URL parameters and rounds query parameters strictly', async () => {
            for (const badId of ['0', '-1', '1.5', 'abc', '01', '1e2']) {
                const getRes = await fullApp.request(
                    `https://example.com/api/participating/games/${badId}`,
                    { headers: { Cookie: `auth_token=${aliceJwt}` } },
                    env
                );
                expect(getRes.status, `GET gameId=${badId}`).toBe(400);

                const patchRes = await patchGame(badId, validPayload);
                expect(patchRes.status, `PATCH gameId=${badId}`).toBe(400);
            }

            // Valid integer ID that doesn't exist -> 404
            const missingGet = await fullApp.request(
                'https://example.com/api/participating/games/999',
                { headers: { Cookie: `auth_token=${aliceJwt}` } },
                env
            );
            expect(missingGet.status).toBe(404);
            expect((await patchGame(999, validPayload)).status).toBe(404);

            // Strict rounds validation on /api/outstanding-games
            for (const badRounds of ['0', '-2', '1.5', '2abc', '100']) {
                const res = await fullApp.request(
                    `https://example.com/api/outstanding-games?rounds=${badRounds}`,
                    {},
                    env
                );
                expect(res.status, `rounds=${badRounds}`).toBe(400);
            }
        });
    });
});
