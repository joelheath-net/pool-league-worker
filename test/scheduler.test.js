import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import fullApp from '../src/index.js';
import { calculateOutstandingGames } from '../src/scheduler.js';

const SETUP_SQL = readFileSync(resolve(process.cwd(), 'setup.sql'), 'utf8');

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

describe('Scheduler Overhaul: Prioritise First Matchups & Player Availability', () => {
    describe('Unit tests: calculateOutstandingGames()', () => {
        const fiveUsers = [
            { id: 'alice', name: 'Alice', team: 'Team A', teamColor: '#111111', participating: true },
            { id: 'bob', name: 'Bob', team: 'Team B', teamColor: '#222222', participating: true },
            { id: 'charlie', name: 'Charlie', team: 'Team C', teamColor: '#333333', participating: true },
            { id: 'david', name: 'David', team: 'Team D', teamColor: '#444444', participating: true },
            { id: 'eve', name: 'Eve', team: 'Team E', teamColor: '#555555', participating: true }
        ];

        // Alice, Bob, Charlie have all played each other once (2 games each), David & Eve have played 0 games
        const gamesWhereTwoPlayedNone = [
            { homePlayerId: 'alice', awayPlayerId: 'bob', rematchId: 0 },
            { homePlayerId: 'alice', awayPlayerId: 'charlie', rematchId: 0 },
            { homePlayerId: 'bob', awayPlayerId: 'charlie', rematchId: 0 }
        ];

        it('completes ALL first matchups before scheduling any second matchup by default (prioritiseFirstMatchups = true)', () => {
            const result = calculateOutstandingGames({
                users: fiveUsers,
                games: gamesWhereTwoPlayedNone,
                rematchRounds: 2
            });

            expect(result.prioritiseFirstMatchups).toBe(true);
            // 5 players * 4 / 2 = 10 pairs * 2 rounds = 20 total games; 3 played -> 17 outstanding
            expect(result.totalOutstanding).toBe(17);

            // There are 7 unplayed First Match games (10 pairs - 3 already played) and 10 Rematch 1 games.
            // Every single one of the first 7 scheduled games MUST be 'First Match'!
            const firstSevenRounds = result.games.slice(0, 7).map((g) => g.roundName);
            expect(firstSevenRounds).toEqual(Array(7).fill('First Match'));

            // And the remaining 10 games MUST be 'Rematch 1'
            const remainingTenRounds = result.games.slice(7).map((g) => g.roundName);
            expect(remainingTenRounds).toEqual(Array(10).fill('Rematch 1'));

            // Specifically, Game 1 is David vs Eve (First Match), and Game 2 is NOT David vs Eve Rematch 1
            expect([result.games[0].homePlayer.id, result.games[0].awayPlayer.id]).toEqual(['david', 'eve']);
            expect(result.games[0].roundName).toBe('First Match');
            expect([result.games[1].homePlayer.id, result.games[1].awayPlayer.id]).not.toEqual(['david', 'eve']);
            expect(result.games[1].roundName).toBe('First Match');
        });

        it('schedules immediate rematches for players with the fewest games when prioritiseFirstMatchups = false', () => {
            const result = calculateOutstandingGames({
                users: fiveUsers,
                games: gamesWhereTwoPlayedNone,
                rematchRounds: 2,
                prioritiseFirstMatchups: false
            });

            expect(result.prioritiseFirstMatchups).toBe(false);

            // Game 1: David vs Eve (First Match, both at 0 games)
            expect([result.games[0].homePlayer.id, result.games[0].awayPlayer.id]).toEqual(['david', 'eve']);
            expect(result.games[0].roundName).toBe('First Match');

            // Game 2: David vs Eve AGAIN (Rematch 1, both at 1 game, whereas Alice/Bob/Charlie have 2 games)
            expect([result.games[1].homePlayer.id, result.games[1].awayPlayer.id]).toEqual(['david', 'eve']);
            expect(result.games[1].roundName).toBe('Rematch 1');
        });

        it('reschedules around available players rather than merely filtering the full schedule', () => {
            // Alice and Bob have played 1 game each (against Eve).
            // Charlie and David have played 0 games.
            const games = [
                { homePlayerId: 'alice', awayPlayerId: 'eve', rematchId: 0 },
                { homePlayerId: 'bob', awayPlayerId: 'eve', rematchId: 0 }
            ];

            // 1. When Alice, Bob, Charlie, David are all available:
            // Step 1 picks Charlie vs David (0 games each -> after step 1, all four have 1 game).
            // Step 2 then picks Alice vs Bob (tie-broken alphabetically 'Alice:Bob' before 'Alice:Charlie').
            const allFourAvailable = calculateOutstandingGames({
                users: fiveUsers,
                games,
                rematchRounds: 1,
                availablePlayerIds: ['alice', 'bob', 'charlie', 'david']
            });
            expect([allFourAvailable.games[0].homePlayer.id, allFourAvailable.games[0].awayPlayer.id]).toEqual(['charlie', 'david']);
            expect([allFourAvailable.games[1].homePlayer.id, allFourAvailable.games[1].awayPlayer.id]).toEqual(['alice', 'bob']);

            // 2. Now suppose David is NOT available today (only Alice, Bob, Charlie are available):
            // If we merely filtered out David from allFourAvailable, Alice vs Bob would be first!
            // Instead, because David is unavailable, Charlie still has 0 games played and is scheduled first (Alice vs Charlie)!
            const withoutDavid = calculateOutstandingGames({
                users: fiveUsers,
                games,
                rematchRounds: 1,
                availablePlayerIds: ['alice', 'bob', 'charlie']
            });
            expect(withoutDavid.availableCount).toBe(3);
            expect(withoutDavid.participatingCount).toBe(5);
            expect(withoutDavid.totalOutstanding).toBe(3); // (Alice,Charlie), (Bob,Charlie), (Alice,Bob)
            expect([withoutDavid.games[0].homePlayer.id, withoutDavid.games[0].awayPlayer.id]).toEqual(['alice', 'charlie']);
            expect([withoutDavid.games[1].homePlayer.id, withoutDavid.games[1].awayPlayer.id]).toEqual(['bob', 'charlie']);
            expect([withoutDavid.games[2].homePlayer.id, withoutDavid.games[2].awayPlayer.id]).toEqual(['alice', 'bob']);
        });

        it('returns empty schedule when fewer than 2 available players are selected', () => {
            const oneAvailable = calculateOutstandingGames({
                users: fiveUsers,
                games: [],
                rematchRounds: 2,
                availablePlayerIds: ['alice']
            });
            expect(oneAvailable.games).toEqual([]);
            expect(oneAvailable.totalOutstanding).toBe(0);
            expect(oneAvailable.participatingCount).toBe(5);
            expect(oneAvailable.availableCount).toBe(1);

            const noneAvailable = calculateOutstandingGames({
                users: fiveUsers,
                games: [],
                rematchRounds: 2,
                availablePlayerIds: []
            });
            expect(noneAvailable.games).toEqual([]);
            expect(noneAvailable.totalOutstanding).toBe(0);
            expect(noneAvailable.availableCount).toBe(0);
        });
    });

    describe('Integration tests: /api/outstanding-games & /outstanding-games view', () => {
        let sqlite;
        let env;

        beforeEach(() => {
            sqlite = new DatabaseSync(':memory:');
            sqlite.exec(SETUP_SQL);
            const insertUser = sqlite.prepare(`
                INSERT INTO users (id, email, name, role, team, team_color, participating)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `);
            insertUser.run('alice', 'alice@example.com', 'Alice', 'admin', 'Team A', '#1e88e5', 1);
            insertUser.run('bob', 'bob@example.com', 'Bob', 'user', 'Team B', '#43a047', 1);
            insertUser.run('charlie', 'charlie@example.com', 'Charlie', 'user', 'Team C', '#e53935', 1);
            insertUser.run('david', 'david@example.com', 'David', 'user', 'Team D', '#fb8c00', 1);

            env = {
                JWT_SECRET: 'scheduler-test-secret-0123456789abcdef',
                DB: createSqliteD1Adapter(sqlite)
            };
        });

        afterEach(() => {
            sqlite.close();
        });

        it('supports prioritiseFirstMatchups and available query parameters on GET /api/outstanding-games', async () => {
            // Seed Alice vs Bob and Alice vs Charlie (so Alice=2, Bob=1, Charlie=1, David=0)
            // Also seed Bob vs Charlie so Alice, Bob, Charlie all have 2 games and David has 0
            const insertGame = sqlite.prepare(`
                INSERT INTO games (id, home_player_id, away_player_id, rematch_id, is_deleted)
                VALUES (?, ?, ?, ?, 0)
            `);
            const insertRev = sqlite.prepare(`
                INSERT INTO game_revisions (game_id, revision_id, winner_id, author_id, balls_remaining, fouled_on_black, played_at)
                VALUES (?, 0, ?, 'alice', 2, 0, '2026-02-01')
            `);
            insertGame.run(1, 'alice', 'bob', 0);
            insertRev.run(1, 'alice');
            insertGame.run(2, 'alice', 'charlie', 0);
            insertRev.run(2, 'alice');
            insertGame.run(3, 'bob', 'charlie', 0);
            insertRev.run(3, 'bob');

            // Default GET /api/outstanding-games?rounds=2 -> prioritiseFirstMatchups=true
            const defaultRes = await fullApp.request('https://example.com/api/outstanding-games?rounds=2', {}, env);
            expect(defaultRes.status).toBe(200);
            const defaultData = await defaultRes.json();
            expect(defaultData.prioritiseFirstMatchups).toBe(true);
            expect(defaultData.players).toHaveLength(4);
            // First 3 games must be David's First Matches against Alice, Bob, Charlie
            expect(defaultData.games.slice(0, 3).map((g) => g.roundName)).toEqual([
                'First Match',
                'First Match',
                'First Match'
            ]);

            // Filter by available=alice,bob,david (Charlie unavailable)
            const filteredRes = await fullApp.request(
                'https://example.com/api/outstanding-games?rounds=2&available=alice,bob,david',
                {},
                env
            );
            expect(filteredRes.status).toBe(200);
            const filteredData = await filteredRes.json();
            expect(filteredData.availableCount).toBe(3);
            expect(filteredData.participatingCount).toBe(4);
            for (const g of filteredData.games) {
                expect(g.homePlayer.id).not.toBe('charlie');
                expect(g.awayPlayer.id).not.toBe('charlie');
            }

            // Empty available= (all players unticked)
            const emptyRes = await fullApp.request(
                'https://example.com/api/outstanding-games?rounds=2&available=',
                {},
                env
            );
            expect(emptyRes.status).toBe(200);
            const emptyData = await emptyRes.json();
            expect(emptyData.availableCount).toBe(0);
            expect(emptyData.games).toEqual([]);
        });

        it('renders the "Prioritise first matchups" toggle (checked by default) and collapsed available players list on /outstanding-games', async () => {
            const pageRes = await fullApp.request('https://example.com/outstanding-games', {}, env);
            expect(pageRes.status).toBe(200);
            const html = await pageRes.text();

            expect(html).toContain('Prioritise first matchups');
            expect(html).toContain('id="prioritise-first-matchups"');
            expect(html).toMatch(/id="prioritise-first-matchups"[^>]*checked/);
            expect(html).toContain('id="available-players-details"');
            expect(html).toContain('id="available-players-list"');
            expect(html).toContain('Calculate Outstanding Games');
        });
    });
});
