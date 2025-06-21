import { Hono } from 'hono';
import { protectAPI } from './middleware.js';

const api = new Hono();

// --- PUBLIC ROUTES ---

// Get a specific user by ID
api.get('/users/:id', async (c) => {
    const { id } = c.req.param();
    const user = await c.env.DB.prepare('SELECT id, name, team, team_color FROM users WHERE id = ?').bind(id).first();
    if (!user) return c.json({ message: 'User not found' }, 404);
    return c.json(user);
});

// Get all users
api.get('/users', async (c) => {
    const { results } = await c.env.DB.prepare('SELECT id, name, team, team_color FROM users').all();
    return c.json(results);
});

// Get leaderboard stats
api.get('/leaderboard', async (c) => {
    const { results: games } = await c.env.DB.prepare(`
        WITH RankedRevisions AS (
            SELECT *, ROW_NUMBER() OVER (PARTITION BY player1_id, player2_id, rematch_id ORDER BY revision_id DESC) as rn
            FROM game_revisions
        )
        SELECT * FROM RankedRevisions WHERE rn = 1
    `).all();

    const { results: players } = await c.env.DB.prepare('SELECT id FROM users').all();
    const playerMap = new Map(players.map(p => [p.id, { wins: 0, losses: 0, balls_remaining: 0, fouls_on_black: 0 }]));

    for (const game of games) {
        const { player1_id, player2_id, winner_id, balls_remaining, fouled_on_black } = game;
        const winner = winner_id === player1_id ? player1_id : player2_id;
        const loser = winner_id === player1_id ? player2_id : player1_id;

        if (playerMap.has(winner)) playerMap.get(winner).wins++;
        if (playerMap.has(loser)) {
            playerMap.get(loser).losses++;
            playerMap.get(loser).balls_remaining += balls_remaining;
            if (fouled_on_black) playerMap.get(loser).fouls_on_black++;
        }
    }
    return c.json(Array.from(playerMap.entries()).map(([playerId, stats]) => ({ playerId, ...stats })));
});


// --- AUTHENTICATED ROUTES ---

api.get('/users-sensitive', protectAPI, async (c) => {
    const { results } = await c.env.DB.prepare('SELECT id, name, email FROM users').all();
    return c.json(results);
});

// Get the current user's profile
api.get('/profile', protectAPI, async (c) => {
    const userPayload = await c.get('user');

    const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userPayload.sub).first();
    return c.json(user);
});

// Update the current user's profile
api.patch('/profile', protectAPI, async (c) => {
    const userPayload = await c.get('user');
    const { name, team, team_color } = await c.req.json();

    // Here is where we add the application-level validation for the color
    if (!/^#[0-9a-fA-F]{6}$/.test(team_color)) {
        return c.json({ message: 'Invalid team color format. Use hex color codes like #RRGGBB' }, 400);
    }

    await c.env.DB.prepare('UPDATE users SET name = ?, team = ?, team_color = ? WHERE id = ?')
        .bind(name, team, team_color, userPayload.sub)
        .run();
    return c.json({ message: 'Profile updated successfully' });
});

// Log a new game
api.post('/log-game', protectAPI, async (c) => {
    const userPayload = await c.get('user');
    const { winner, loser, balls_remaining, fouled_on_black, date } = await c.req.json();

    const player1_id = winner < loser ? winner : loser;
    const player2_id = winner < loser ? loser : winner;

    const latestRematch = await c.env.DB.prepare(
        `SELECT rematch_id FROM game_revisions WHERE player1_id = ? AND player2_id = ? ORDER BY rematch_id DESC LIMIT 1`
    ).bind(player1_id, player2_id).first();
    const rematch_id = latestRematch ? latestRematch.rematch_id + 1 : 0;

    await c.env.DB.prepare(
        `INSERT INTO game_revisions (player1_id, player2_id, rematch_id, winner_id, balls_remaining, fouled_on_black, played_at, author_id, authored_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(player1_id, player2_id, rematch_id, winner, balls_remaining, fouled_on_black, date, userPayload.sub, new Date().toISOString()).run();

    return c.json({ message: 'Game logged successfully' }, 201);
});

// Get a list of all games (latest revisions)
api.get('/game-list', protectAPI, async (c) => {
     const { results } = await c.env.DB.prepare(`
        WITH RankedRevisions AS (
            SELECT *, ROW_NUMBER() OVER (PARTITION BY player1_id, player2_id, rematch_id ORDER BY revision_id DESC) as rn
            FROM game_revisions
        )
        SELECT * FROM RankedRevisions WHERE rn = 1 ORDER BY played_at DESC, player1_id, player2_id, rematch_id DESC
    `).all();
    return c.json(results);
});

// Get all revisions for the audit log
api.get('/audit-log', protectAPI, async (c) => {
    const { results } = await c.env.DB.prepare('SELECT * FROM game_revisions ORDER BY authored_at DESC').all();
    return c.json(results);
});

// (Add any other API routes like patchGame or getGameByIds here following the same pattern)

// Add these two new routes inside src/api.js, after the '/audit-log' route

// Get a specific game's latest revision by its composite ID
api.get('/games/:player1Id/:player2Id/:rematchId', protectAPI, async (c) => {
    let { player1Id, player2Id, rematchId } = c.req.param();

    // Ensure player1Id is always the smaller one, matching the model's logic
    if (player1Id > player2Id) {
        [player1Id, player2Id] = [player2Id, player1Id];
    }

    const game = await c.env.DB.prepare(
      `SELECT * FROM game_revisions
       WHERE player1_id = ? AND player2_id = ? AND rematch_id = ?
       ORDER BY revision_id DESC
       LIMIT 1`
    ).bind(player1Id, player2Id, rematchId).first();

    if (!game) {
        return c.json({ message: 'Game not found' }, 404);
    }
    return c.json(game);
});

// Update a game by creating a new revision
api.patch('/game', protectAPI, async (c) => {
    const userPayload = await c.get('user');
    const { player1_id, player2_id, rematch_id, winner_id, balls_remaining, fouled_on_black, played_at } = await c.req.json();

    // First, find the latest revision for this game to ensure it exists
    const latestRevision = await c.env.DB.prepare(
        `SELECT revision_id FROM game_revisions
         WHERE player1_id = ? AND player2_id = ? AND rematch_id = ?
         ORDER BY revision_id DESC LIMIT 1`
    ).bind(player1_id, player2_id, rematch_id).first();

    if (!latestRevision) {
        return c.json({ message: 'Cannot update a game that does not exist.' }, 404);
    }

    // Create a new revision by incrementing the last one
    const newRevisionId = latestRevision.revision_id + 1;

    await c.env.DB.prepare(
        `INSERT INTO game_revisions (revision_id, player1_id, player2_id, rematch_id, winner_id, balls_remaining, fouled_on_black, played_at, author_id, authored_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
        newRevisionId,
        player1_id,
        player2_id,
        rematch_id,
        winner_id,
        balls_remaining,
        fouled_on_black,
        played_at,
        userPayload.sub, // The author is the currently logged-in user
        new Date().toISOString()
    ).run();
    
    return c.json({ message: 'Game updated successfully by creating a new revision.' });
});


export default api;