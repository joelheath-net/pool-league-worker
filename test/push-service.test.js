import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { diffRankings, getLeaderboardRanks } from '../src/push-service.js';
import { rankLeaderboardPlayers, getLeaderboardStats } from '../src/database.js';
import fullApp from '../src/index.js';

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

describe('Push Service - diffRankings', () => {
    it('detects rank improvements and drops correctly', () => {
        const oldRanks = {
            'player-1': 1,
            'player-2': 2,
            'player-3': 3,
            'player-4': 4
        };

        // player-3 beats someone and climbs to #2; player-2 drops to #3; 1 and 4 stay unchanged
        const newRanks = {
            'player-1': 1,
            'player-2': 3,
            'player-3': 2,
            'player-4': 4
        };

        const changes = diffRankings(oldRanks, newRanks);

        expect(changes).toHaveLength(2);

        const player3Change = changes.find((c) => c.playerId === 'player-3');
        expect(player3Change).toEqual({
            playerId: 'player-3',
            oldRank: 3,
            newRank: 2,
            improved: true
        });

        const player2Change = changes.find((c) => c.playerId === 'player-2');
        expect(player2Change).toEqual({
            playerId: 'player-2',
            oldRank: 2,
            newRank: 3,
            improved: false
        });
    });

    it('returns empty array when no ranks have changed', () => {
        const ranks = {
            'player-1': 1,
            'player-2': 2
        };
        const changes = diffRankings(ranks, ranks);
        expect(changes).toEqual([]);
    });

    it('handles new players entering the leaderboard', () => {
        const oldRanks = {
            'player-1': 1
        };
        const newRanks = {
            'player-1': 1,
            'player-new': 2
        };

        const changes = diffRankings(oldRanks, newRanks);
        expect(changes).toHaveLength(1);
        expect(changes[0]).toEqual({
            playerId: 'player-new',
            oldRank: null,
            newRank: 2,
            improved: true
        });
    });
});

describe('Leaderboard Ranking Single Source of Truth & Head-to-Head Tiebreaker', () => {
    let sqlite;
    let d1;
    let env;

    beforeEach(() => {
        sqlite = new DatabaseSync(':memory:');
        sqlite.exec(SETUP_SQL);
        d1 = createSqliteD1Adapter(sqlite);
        env = { DB: d1 };

        const insertUser = sqlite.prepare(`
            INSERT INTO users (id, email, name, role, team, team_color, participating)
            VALUES (?, ?, ?, 'user', ?, '#123456', 1)
        `);
        insertUser.run('player-a', 'a@example.com', 'Player A', 'Team A');
        insertUser.run('player-b', 'b@example.com', 'Player B', 'Team B');
        insertUser.run('player-c', 'c@example.com', 'Player C', 'Team C');
        insertUser.run('player-d', 'd@example.com', 'Player D', 'Team D');
    });

    afterEach(() => {
        sqlite.close();
    });

    it('does NOT use foulsOnBlack as a tiebreaker and assigns dense shared positions (1, 2, 2, 3)', () => {
        const players = [
            { playerId: 'player-a', name: 'Player A', team: 'Team A', wins: 3, losses: 0, ballsRemaining: 0, foulsOnBlack: 0 }, // 9 pts
            { playerId: 'player-b', name: 'Player B', team: 'Team B', wins: 2, losses: 0, ballsRemaining: 4, foulsOnBlack: 0 }, // 6 pts, 4 BD, 0 FoB
            { playerId: 'player-c', name: 'Player C', team: 'Team C', wins: 2, losses: 1, ballsRemaining: 4, foulsOnBlack: 1 }, // 6 pts, 4 BD, 1 FoB
            { playerId: 'player-d', name: 'Player D', team: 'Team D', wins: 1, losses: 2, ballsRemaining: 6, foulsOnBlack: 0 }  // 5 pts
        ];

        // No head-to-head games between B and C
        const ranked = rankLeaderboardPlayers(players, []);

        expect(ranked.map((p) => ({ playerId: p.playerId, points: p.points, position: p.position }))).toEqual([
            { playerId: 'player-a', points: 9, position: 1 },
            { playerId: 'player-b', points: 6, position: 2 },
            { playerId: 'player-c', points: 6, position: 2 },
            { playerId: 'player-d', points: 5, position: 3 }
        ]);
    });

    it('breaks ties on points and ballsRemaining using Premier League-style Head-to-Head points', () => {
        const players = [
            { playerId: 'player-a', name: 'Player A', team: 'Team A', wins: 3, losses: 0, ballsRemaining: 0, foulsOnBlack: 0 }, // 9 pts
            { playerId: 'player-b', name: 'Player B', team: 'Team B', wins: 2, losses: 1, ballsRemaining: 4, foulsOnBlack: 0 }, // 7 pts, 4 BD
            { playerId: 'player-c', name: 'Player C', team: 'Team C', wins: 2, losses: 1, ballsRemaining: 4, foulsOnBlack: 0 }, // 7 pts, 4 BD
            { playerId: 'player-d', name: 'Player D', team: 'Team D', wins: 0, losses: 3, ballsRemaining: 9, foulsOnBlack: 0 }  // 3 pts
        ];

        // Player C beat Player B in their head-to-head match (C gets 3 H2H pts, B gets 1 H2H pt)
        const games = [
            {
                homePlayerId: 'player-b',
                awayPlayerId: 'player-c',
                winnerHome: false,
                ballsRemaining: 2,
                fouledOnBlack: false
            }
        ];

        const ranked = rankLeaderboardPlayers(players, games);

        expect(ranked.map((p) => ({ playerId: p.playerId, position: p.position }))).toEqual([
            { playerId: 'player-a', position: 1 },
            { playerId: 'player-c', position: 2 },
            { playerId: 'player-b', position: 3 },
            { playerId: 'player-d', position: 4 }
        ]);
    });

    it('accounts for foul on black (0 pts vs 1 pt for legal loss) in Head-to-Head tiebreakers when players split wins 1-1', () => {
        const players = [
            { playerId: 'player-b', name: 'Player B', team: 'Team B', wins: 2, losses: 1, ballsRemaining: 4, foulsOnBlack: 1 }, // 6 pts, 4 BD
            { playerId: 'player-c', name: 'Player C', team: 'Team C', wins: 1, losses: 3, ballsRemaining: 4, foulsOnBlack: 0 }  // 6 pts, 4 BD
        ];

        // Match 1: B beat C legally -> B gets 3 H2H pts, C gets 1 H2H pt
        // Match 2: C beat B via B fouling on black -> C gets 3 H2H pts, B gets 0 H2H pts
        // Total H2H: C = 4 pts, B = 3 pts -> C wins head-to-head!
        const games = [
            { homePlayerId: 'player-b', awayPlayerId: 'player-c', winnerHome: true, ballsRemaining: 2, fouledOnBlack: false },
            { homePlayerId: 'player-c', awayPlayerId: 'player-b', winnerHome: true, ballsRemaining: 2, fouledOnBlack: true }
        ];

        const ranked = rankLeaderboardPlayers(players, games);
        expect(ranked.map((p) => ({ playerId: p.playerId, position: p.position }))).toEqual([
            { playerId: 'player-c', position: 1 },
            { playerId: 'player-b', position: 2 }
        ]);
    });

    it('does NOT notify Player B when Player C wins a match to tie Player B for 2nd place (1, 2, 3, 4 -> 1, 2, 2, 3)', async () => {
        let gameCounter = 0;
        const recordGame = (home, away, winnerHome, ballsRemaining, fouledOnBlack = false) => {
            gameCounter++;
            sqlite
                .prepare('INSERT INTO games (id, home_player_id, away_player_id, rematch_id) VALUES (?, ?, ?, ?)')
                .run(gameCounter, home, away, gameCounter);
            sqlite
                .prepare(`
                    INSERT INTO game_revisions (
                        game_id, revision_id, is_deleted, winner_id, balls_remaining, fouled_on_black, played_at, author_id
                    ) VALUES (?, 0, 0, ?, ?, ?, '2026-03-01', 'player-a')
                `)
                .run(gameCounter, winnerHome ? home : away, ballsRemaining, fouledOnBlack ? 1 : 0);
        };

        // Initial state:
        // Player A: 2 wins (vs D x2) = 6 pts, 0 BD -> 1st
        // Player B: 1 win (vs D) = 3 pts, 0 BD -> 2nd
        // Player C: 0 wins, 1 legal loss (vs A, 0 balls) = 1 pt, 0 BD -> 3rd (wait: A has 3 wins = 9 pts)
        // Let's set up exact standings:
        // Game 1: A beats D (8 balls, foul on black -> A: 3 pts, D: 0 pts, 8 BD)
        // Game 2: A beats D (8 balls, foul on black -> A: 6 pts, D: 0 pts, 16 BD)
        // Game 3: B beats D (8 balls, foul on black -> B: 3 pts, D: 0 pts, 24 BD)
        // Game 4: D beats C (2 balls, legal loss -> D: 3 pts, 24 BD; C: 1 pt, 2 BD)
        // Wait: let's make A=1st, B=2nd, C=3rd, D=4th before C's match!
        // Before match:
        // A: 2 wins (vs D, fouledOnBlack) = 6 pts, 0 BD -> #1
        // B: 1 win (vs D, fouledOnBlack) = 3 pts, 0 BD -> #2
        // C: 0 wins, 0 losses = 0 pts, 0 BD -> #3
        // D: 0 wins, 3 foul losses = 0 pts, 15 BD -> #4
        recordGame('player-a', 'player-d', true, 5, true);
        recordGame('player-a', 'player-d', true, 5, true);
        recordGame('player-b', 'player-d', true, 5, true);

        const prevRanks = await getLeaderboardRanks(d1);
        expect(prevRanks).toEqual({
            'player-a': 1,
            'player-b': 2,
            'player-c': 3,
            'player-d': 4
        });

        // Now Player C beats Player D (with D fouling on black so D stays on 0 pts, and C now has 3 pts, 0 BD — tied with B on points, BD, and H2H!)
        recordGame('player-c', 'player-d', true, 5, true);

        const newRanks = await getLeaderboardRanks(d1);
        expect(newRanks).toEqual({
            'player-a': 1,
            'player-b': 2,
            'player-c': 2,
            'player-d': 3
        });

        const changes = diffRankings(prevRanks, newRanks);

        // Player B MUST NOT receive any notification (rank remained 2!)
        const playerBChange = changes.find((c) => c.playerId === 'player-b');
        expect(playerBChange).toBeUndefined();

        // Player C moved up from 3 to 2
        const playerCChange = changes.find((c) => c.playerId === 'player-c');
        expect(playerCChange).toEqual({
            playerId: 'player-c',
            oldRank: 3,
            newRank: 2,
            improved: true
        });

        // Verify GET /api/leaderboard returns the complete single-source-of-truth state including position
        const res = await fullApp.request('https://example.com/api/leaderboard', {}, env);
        expect(res.status).toBe(200);
        const leaderboard = await res.json();
        expect(leaderboard.map((p) => ({
            playerId: p.playerId,
            name: p.name,
            team: p.team,
            points: p.points,
            wins: p.wins,
            losses: p.losses,
            ballsRemaining: p.ballsRemaining,
            foulsOnBlack: p.foulsOnBlack,
            position: p.position
        }))).toEqual([
            { playerId: 'player-a', name: 'Player A', team: 'Team A', points: 6, wins: 2, losses: 0, ballsRemaining: 0, foulsOnBlack: 0, position: 1 },
            { playerId: 'player-b', name: 'Player B', team: 'Team B', points: 3, wins: 1, losses: 0, ballsRemaining: 0, foulsOnBlack: 0, position: 2 },
            { playerId: 'player-c', name: 'Player C', team: 'Team C', points: 3, wins: 1, losses: 0, ballsRemaining: 0, foulsOnBlack: 0, position: 2 },
            { playerId: 'player-d', name: 'Player D', team: 'Team D', points: 0, wins: 0, losses: 4, ballsRemaining: 20, foulsOnBlack: 4, position: 3 }
        ]);
    });
});
