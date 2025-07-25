import { Hono } from 'hono';
import { protectAPI } from './middleware.js';
import * as db from './database.js';

const api = new Hono();

// --- UTILITY ---
function validateFields(fields, data) {
    for (const field of fields) {
        if (!data.hasOwnProperty(field)) {
            return { valid: false, message: `Missing required field: ${field}` };
        }
    }
    return { valid: true };
}

// --- PUBLIC ROUTES ---

api.get('/users/:id', async (c) => {
    const { id } = c.req.param();
    const user = await db.getUserById(c.env.DB, id);
    if (!user) return c.json({ message: 'User not found' }, 404);
    return c.json(user);
});

api.get('/users', async (c) => {
    const users = await db.getUsers(c.env.DB);
    return c.json(users);
});

api.get('/leaderboard', async (c) => {
    const stats = await db.getLeaderboardStats(c.env.DB);
    return c.json(stats);
});

api.get('/game-list', async (c) => {
    const games = await db.getGameList(c.env.DB);
    return c.json(games);
});

// --- AUTHENTICATED ROUTES ---

api.get('/users-sensitive', protectAPI, async (c) => {
    const users = await db.getSensitiveUsers(c.env.DB);
    return c.json(users);
});

api.get('/profile', protectAPI, async (c) => {
    const userPayload = await c.get('user');
    if (!userPayload) return c.json({ message: 'Unauthorized' }, 401);
    
    return c.json(await db.getUserById(c.env.DB, userPayload.sub));
});

api.patch('/profile', protectAPI, async (c) => {
    const userPayload = await c.get('user');
    const profileData = await c.req.json();

    // Application-level validation remains in the API layer
    if (!/^#[0-9a-fA-F]{6}$/.test(profileData.team_color)) {
        return c.json({ message: 'Invalid team color format. Must be hex color codes in format #RRGGBB' }, 400);
    }

    await db.updateProfile(c.env.DB, userPayload.sub, profileData);
    return c.json({ message: 'Profile updated successfully' });
});

api.post('/log-game', protectAPI, async (c) => {
    const userPayload = await c.get('user');
    const gameData = await c.req.json();
    
    // Input validation
    if (!gameData || typeof gameData !== 'object') return c.json({ message: 'Invalid game data format' }, 400);
    
    const requiredFields = ['winner', 'loser', 'balls_remaining', 'fouled_on_black', 'date'];
    const validation = validateFields(requiredFields, gameData);
    if (!validation.valid) return c.json({ message: validation.message }, 400);
    
    if (gameData.winner === gameData.loser) return c.json({ message: 'Winner and loser cannot be the same' }, 400);
    if (!db.userExists(c.env.DB, gameData.winner)) return c.json({ message: 'Winner does not exist' }, 404);
    if (!db.userExists(c.env.DB, gameData.loser)) return c.json({ message: 'Loser does not exist' }, 404);

    if (typeof gameData.balls_remaining !== 'number' || isNaN(gameData.balls_remaining) || gameData.balls_remaining < 0 || gameData.balls_remaining > 8)
        return c.json({ message: 'Balls remaining must be a number between 0 and 8' }, 400);
    if (typeof gameData.fouled_on_black !== 'boolean')
        return c.json({ message: 'Fouled on black must be a boolean value' }, 400);
    if (isNaN(Date.parse(gameData.date)))
        return c.json({ message: 'Invalid date format' }, 400);

    // Add author from the authenticated user context
    gameData.author_id = userPayload.sub;

    await db.createGameRevision(c.env.DB, gameData);
    return c.json({ message: 'Game logged successfully' }, 201);
});

api.get('/audit-log', protectAPI, async (c) => {
    const revisions = await db.getAuditLog(c.env.DB);
    return c.json(revisions);
});

api.get('/games/:player1Id/:player2Id/:rematchId', protectAPI, async (c) => {
    let { player1Id, player2Id, rematchId } = c.req.param();
    if (player1Id > player2Id) [player1Id, player2Id] = [player2Id, player1Id];

    const game = await db.getGameByCompositeId(c.env.DB, player1Id, player2Id, rematchId);
    if (!game) return c.json({ message: 'Game not found' }, 404);
    return c.json(game);
});

api.patch('/game', protectAPI, async (c) => {
    const userPayload = await c.get('user');
    const gameData = await c.req.json();

    // Input validation
    if (!gameData || typeof gameData !== 'object') return c.json({ message: 'Invalid game data format' }, 400);

    const requiredFields = ['player1_id', 'player2_id', 'rematch_id', 'winner_id', 'balls_remaining', 'fouled_on_black', 'played_at'];
    const validation = validateFields(requiredFields, gameData);
    if (!validation.valid) return c.json({ message: validation.message }, 400);

    if (gameData.player1_id === gameData.player2_id) return c.json({ message: 'Winner and loser cannot be the same' }, 400);
    if (!db.userExists(c.env.DB, gameData.player1_id)) return c.json({ message: 'Player 1 does not exist' }, 404);
    if (!db.userExists(c.env.DB, gameData.player2_id)) return c.json({ message: 'Player 2 does not exist' }, 404);

    if (typeof gameData.balls_remaining !== 'number' || isNaN(gameData.balls_remaining) || gameData.balls_remaining < 0 || gameData.balls_remaining > 8)
        return c.json({ message: 'Balls remaining must be a number between 0 and 8' }, 400);
    if (typeof gameData.fouled_on_black !== 'boolean')
        return c.json({ message: 'Fouled on black must be a boolean value' }, 400);
    if (isNaN(Date.parse(gameData.played_at)))
        return c.json({ message: 'Invalid date format' }, 400);

    gameData.author_id = userPayload.sub;

    try {
        await db.updateGame(c.env.DB, gameData);
        return c.json({ message: 'Game updated successfully by creating a new revision.' }, 200);
    } catch (error) {
        if (error.message.includes('does not exist')) {
            return c.json({ message: error.message }, 404);
        }
        console.error('Error updating game:', error);
        return c.json({ message: 'An internal error occurred.' }, 500);
    }
});

export default api;